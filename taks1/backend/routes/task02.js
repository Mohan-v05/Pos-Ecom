const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const { createOrder, fail, getChannelOrder } = require('../services/orderService');

const respond = (res, error) => res.status(error.status || 500).json({ error: error.message || 'Unexpected server error.' });

router.post('/orders', async (req, res) => {
  try { res.status(201).json(await createOrder({ userId: req.body.user_id, channel: 'ECOMMERCE', items: req.body.items })); }
  catch (error) { respond(res, error); }
});

router.get('/orders', async (_req, res) => {
  const { data, error } = await supabase.from('orders').select('*, order_items(*), payments(*), refunds(*)').eq('channel', 'ECOMMERCE').order('created_at', { ascending: false });
  if (error) return respond(res, error);
  res.json(data);
});

router.get('/orders/:id', async (req, res) => {
  const { data, error } = await supabase.from('orders').select('*, order_items(*), payments(*), refunds(*)').eq('id', req.params.id).eq('channel', 'ECOMMERCE').single();
  if (error) return res.status(404).json({ error: 'E-commerce order not found.' });
  res.json(data);
});

router.post('/payments', async (req, res) => {
  try {
    const { order_id, idempotency_key } = req.body;
    if (!order_id || !idempotency_key) throw fail('order_id and idempotency_key are required.');
    const { data: previous } = await supabase.from('payments').select('*').eq('idempotency_key', idempotency_key).maybeSingle();
    if (previous) return res.json(previous);
    const order = await getChannelOrder(order_id, 'ECOMMERCE', true);
    if (order.status !== 'PENDING') throw fail('Only pending orders can be paid.');
    if (Number(req.body.amount) !== Number(order.total_amount)) throw fail('Payment amount does not match the order total.');
    const now = new Date().toISOString();
    for (const item of order.order_items) {
      const { data: product, error } = await supabase.from('products').select('stock').eq('id', item.product_id).single();
      if (error || Number(product.stock) < Number(item.quantity)) throw fail('An item is no longer in stock. Refresh the catalog and try again.');
      const { data: updated } = await supabase.from('products').update({ stock: Number(product.stock) - Number(item.quantity), updated_at: now }).eq('id', item.product_id).eq('stock', product.stock).select('id').maybeSingle();
      if (!updated) throw fail('Inventory changed while processing payment; please retry.');
    }
    const { data: payment, error } = await supabase.from('payments').insert({ order_id, idempotency_key, amount: order.total_amount, status: 'SUCCESS' }).select().single();
    if (error) throw fail(error.message);
    await supabase.from('orders').update({ status: 'PAID', updated_at: now }).eq('id', order_id);
    res.status(201).json(payment);
  } catch (error) { respond(res, error); }
});

router.post('/refunds', async (req, res) => {
  try {
    const { order_id, payment_id } = req.body;
    const order = await getChannelOrder(order_id, 'ECOMMERCE', true);
    if (order.status !== 'PAID') throw fail('Only paid orders can be refunded.');
    if (Number(req.body.amount) !== Number(order.total_amount)) throw fail('A full-order refund must match the order total.');
    const { data: payment, error: paymentError } = await supabase.from('payments').select('*').eq('id', payment_id).eq('order_id', order_id).eq('status', 'SUCCESS').single();
    if (paymentError || !payment) throw fail('The successful payment for this order was not found.', 404);
    const { data: existing } = await supabase.from('refunds').select('id').eq('order_id', order_id).maybeSingle();
    if (existing) throw fail('This order has already been refunded.');
    const { data: refund, error } = await supabase.from('refunds').insert({ order_id, payment_id, amount: order.total_amount, status: 'COMPLETED' }).select().single();
    if (error) throw fail(error.message);
    const now = new Date().toISOString();
    for (const item of order.order_items) {
      const { data: product } = await supabase.from('products').select('stock').eq('id', item.product_id).single();
      if (product) await supabase.from('products').update({ stock: Number(product.stock) + Number(item.quantity), updated_at: now }).eq('id', item.product_id);
    }
    await supabase.from('orders').update({ status: 'REFUNDED', updated_at: now }).eq('id', order_id);
    res.status(201).json(refund);
  } catch (error) { respond(res, error); }
});

module.exports = router;
