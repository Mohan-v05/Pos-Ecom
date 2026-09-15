const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const { createOrder, fail, getChannelOrder, releaseExpiredReservations } = require('../services/orderService');

const respond = (res, error) => res.status(error.status || 500).json({ error: error.message || 'Unexpected server error.' });

router.post('/orders', async (req, res) => {
  try { res.status(201).json(await createOrder({ userId: req.body.user_id, channel: 'POS', items: req.body.items })); }
  catch (error) { respond(res, error); }
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
    if (!reservations || reservations.length !== order.order_items.length) throw fail('All order items must have active reservations.');
    const { data: payment, error } = await supabase.from('payments').insert({ order_id, idempotency_key, amount: order.total_amount, status: 'SUCCESS' }).select().single();
    if (error) throw fail(error.message);
    const now = new Date().toISOString();
    await supabase.from('reservations').update({ status: 'CONVERTED' }).eq('order_id', order_id).eq('status', 'ACTIVE');
    await supabase.from('orders').update({ status: 'PAID', updated_at: now }).eq('id', order_id);
    res.status(201).json(payment);
  } catch (error) { respond(res, error); }
});

module.exports = router;
