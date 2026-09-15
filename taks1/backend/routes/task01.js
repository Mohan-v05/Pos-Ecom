const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const { createOrder, fail, getChannelOrder, releaseExpiredReservations } = require('../services/orderService');

const respond = (res, error) => res.status(error.status || 500).json({ error: error.message || 'Unexpected server error.' });

router.post('/orders', async (req, res) => {
  try { res.status(201).json(await createOrder({ userId: req.body.user_id, channel: 'POS', items: req.body.items })); }
  catch (error) { respond(res, error); }
});

// A POS cart is a server-side draft so its stock holds are visible to E-commerce immediately.
router.post('/drafts', async (req, res) => {
  try {
    if (!req.body.user_id?.trim()) throw fail('user_id is required.');
    const { data, error } = await supabase.from('orders').insert({ user_id: req.body.user_id.trim(), channel: 'POS', total_amount: 0, status: 'PENDING' }).select().single();
    if (error) throw fail(error.message);
    res.status(201).json({ order: data });
  } catch (error) { respond(res, error); }
});

router.post('/orders/:id/items', async (req, res) => {
  try {
    await releaseExpiredReservations();
    const quantity = Number(req.body.quantity ?? 1);
    if (!req.body.product_id || !Number.isInteger(quantity) || quantity <= 0) throw fail('product_id and a positive quantity are required.');
    const order = await getChannelOrder(req.params.id, 'POS', true);
    if (!['PENDING', 'RESERVED'].includes(order.status)) throw fail('This POS cart is no longer active.');
    const { data: product, error: productError } = await supabase.from('products').select('id, name, price, stock').eq('id', req.body.product_id).single();
    if (productError || !product || Number(product.stock) < quantity) throw fail('Insufficient stock for this item.');
    const now = new Date().toISOString();
    const { data: debited } = await supabase.from('products').update({ stock: Number(product.stock) - quantity, updated_at: now }).eq('id', product.id).eq('stock', product.stock).select('id').maybeSingle();
    if (!debited) throw fail('Stock changed while reserving; please retry.');
    const existing = order.order_items.find((item) => item.product_id === product.id);
    let orderItem;
    if (existing) {
      const { data, error } = await supabase.from('order_items').update({ quantity: Number(existing.quantity) + quantity }).eq('id', existing.id).select().single();
      if (error) throw fail(error.message); orderItem = data;
    } else {
      const { data, error } = await supabase.from('order_items').insert({ order_id: order.id, product_id: product.id, quantity, unit_price: product.price }).select().single();
      if (error) throw fail(error.message); orderItem = data;
    }
    const { error: holdError } = await supabase.from('reservations').insert({ order_id: order.id, product_id: product.id, quantity, status: 'ACTIVE', expires_at: new Date(Date.now() + 5 * 60000).toISOString() });
    if (holdError) throw fail(holdError.message);
    const total = Number(order.total_amount) + Number(product.price) * quantity;
    await supabase.from('orders').update({ total_amount: total, status: 'RESERVED', updated_at: now }).eq('id', order.id);
    res.status(201).json({ item: orderItem, product, total_amount: total });
  } catch (error) { respond(res, error); }
});

router.delete('/orders/:id/items/:productId', async (req, res) => {
  try {
    const order = await getChannelOrder(req.params.id, 'POS', true);
    if (!['PENDING', 'RESERVED'].includes(order.status)) throw fail('This POS cart is no longer active.');
    const item = order.order_items.find((line) => line.product_id === req.params.productId);
    if (!item) throw fail('Item not found in this POS cart.', 404);
    const { data: reservation, error } = await supabase.from('reservations').select('*').eq('order_id', order.id).eq('product_id', item.product_id).eq('status', 'ACTIVE').order('created_at', { ascending: false }).limit(1).single();
    if (error || !reservation) throw fail('Active stock hold not found.', 404);
    const now = new Date().toISOString();
    await supabase.from('reservations').update({ status: 'RELEASED' }).eq('id', reservation.id);
    const { data: product } = await supabase.from('products').select('stock').eq('id', item.product_id).single();
    if (product) await supabase.from('products').update({ stock: Number(product.stock) + Number(reservation.quantity), updated_at: now }).eq('id', item.product_id);
    if (Number(item.quantity) === Number(reservation.quantity)) await supabase.from('order_items').delete().eq('id', item.id);
    else await supabase.from('order_items').update({ quantity: Number(item.quantity) - Number(reservation.quantity) }).eq('id', item.id);
    const total = Math.max(0, Number(order.total_amount) - Number(item.unit_price) * Number(reservation.quantity));
    await supabase.from('orders').update({ total_amount: total, status: total ? 'RESERVED' : 'PENDING', updated_at: now }).eq('id', order.id);
    res.json({ total_amount: total });
  } catch (error) { respond(res, error); }
});

router.get('/orders', async (_req, res) => {
  const { data, error } = await supabase.from('orders').select('*, order_items(*), payments(*)').eq('channel', 'POS').order('created_at', { ascending: false });
  if (error) return respond(res, error);
  res.json(data);
});

router.get('/orders/:id', async (req, res) => {
  const { data, error } = await supabase.from('orders').select('*, order_items(*), reservations(*), payments(*)').eq('id', req.params.id).eq('channel', 'POS').single();
  if (error) return res.status(404).json({ error: 'POS order not found.' });
  res.json(data);
});

router.post('/reservations', async (req, res) => {
  try {
    await releaseExpiredReservations();
    const { order_id, product_id } = req.body;
    const quantity = Number(req.body.quantity);
    const duration = Number(req.body.duration_minutes ?? 5);
    if (!order_id || !product_id || !Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(duration) || duration <= 0 || duration > 30) throw fail('A valid order, product, quantity, and 1–30 minute duration are required.');
    const order = await getChannelOrder(order_id, 'POS', true);
    if (!['PENDING', 'RESERVED'].includes(order.status)) throw fail('This order can no longer be reserved.');
    if (!order.order_items.some((line) => line.product_id === product_id && Number(line.quantity) === quantity)) throw fail('Reservation does not match an order line.');
    const { data: existing } = await supabase.from('reservations').select('id').eq('order_id', order_id).eq('product_id', product_id).eq('status', 'ACTIVE').maybeSingle();
    if (existing) throw fail('This item is already reserved for the order.');
    const { data: product, error: productError } = await supabase.from('products').select('stock').eq('id', product_id).single();
    if (productError || Number(product.stock) < quantity) throw fail('Insufficient stock to reserve this item.');
    const now = new Date().toISOString();
    const { data: debited } = await supabase.from('products').update({ stock: Number(product.stock) - quantity, updated_at: now }).eq('id', product_id).eq('stock', product.stock).select('id').maybeSingle();
    if (!debited) throw fail('Stock changed while reserving; please retry.');
    const { data, error } = await supabase.from('reservations').insert({ order_id, product_id, quantity, expires_at: new Date(Date.now() + duration * 60000).toISOString(), status: 'ACTIVE' }).select().single();
    if (error) {
      await supabase.from('products').update({ stock: Number(product.stock), updated_at: new Date().toISOString() }).eq('id', product_id);
      throw fail(error.message);
    }
    await supabase.from('orders').update({ status: 'RESERVED', updated_at: now }).eq('id', order_id);
    res.status(201).json(data);
  } catch (error) { respond(res, error); }
});

router.post('/payments', async (req, res) => {
  try {
    await releaseExpiredReservations();
    const { order_id, idempotency_key } = req.body;
    if (!order_id || !idempotency_key) throw fail('order_id and idempotency_key are required.');
    const { data: previous } = await supabase.from('payments').select('*').eq('idempotency_key', idempotency_key).maybeSingle();
    if (previous) return res.json(previous);
    const order = await getChannelOrder(order_id, 'POS', true);
    if (order.status !== 'RESERVED') throw fail('A POS order must have active stock reservations before payment.');
    if (Number(req.body.amount) !== Number(order.total_amount)) throw fail('Payment amount does not match the order total.');
    const { data: reservations } = await supabase.from('reservations').select('*').eq('order_id', order_id).eq('status', 'ACTIVE').gt('expires_at', new Date().toISOString());
    const held = new Map();
    for (const reservation of reservations || []) held.set(reservation.product_id, (held.get(reservation.product_id) || 0) + Number(reservation.quantity));
    if (order.order_items.some((item) => held.get(item.product_id) !== Number(item.quantity))) throw fail('All order items must have active reservations.');
    const { data: payment, error } = await supabase.from('payments').insert({ order_id, idempotency_key, amount: order.total_amount, status: 'SUCCESS' }).select().single();
    if (error) throw fail(error.message);
    const now = new Date().toISOString();
    await supabase.from('reservations').update({ status: 'CONVERTED' }).eq('order_id', order_id).eq('status', 'ACTIVE');
    await supabase.from('orders').update({ status: 'PAID', updated_at: now }).eq('id', order_id);
    res.status(201).json(payment);
  } catch (error) { respond(res, error); }
});

module.exports = router;
