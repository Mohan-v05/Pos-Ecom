const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');

// ==========================================
// ORDERS & ORDER ITEMS
// ==========================================

// CREATE: Create a new E-Commerce order with items
router.post('/orders', async (req, res) => {
  const { user_id, items } = req.body;

  if (!user_id || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'user_id and a non-empty items array are required.' });
  }

  const total_amount = items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);

  const { data: order, error: orderError } = await supabase
    .from('task02_orders')
    .insert([{ user_id, total_amount, status: 'PENDING' }])
    .select()
    .single();

  if (orderError) return res.status(400).json({ error: orderError.message });

  const orderItemsPayload = items.map(item => ({
    order_id: order.id,
    product_id: item.product_id,
    quantity: item.quantity,
    unit_price: item.unit_price
  }));

  const { data: orderItems, error: itemsError } = await supabase
    .from('task02_order_items')
    .insert(orderItemsPayload)
    .select();

  if (itemsError) return res.status(400).json({ error: itemsError.message });

  res.status(201).json({ order, items: orderItems });
});

// READ ALL: Get all E-Commerce orders with items
router.get('/orders', async (req, res) => {
  const { data, error } = await supabase
    .from('task02_orders')
    .select('*, task02_order_items(*)');

  if (error) return res.status(400).json({ error: error.message });
  res.status(200).json(data);
});

// READ ONE: Get single E-Commerce order details with payments & refunds
router.get('/orders/:id', async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('task02_orders')
    .select('*, task02_order_items(*), task02_reservations(*), task02_payments(*), task02_refunds(*)')
    .eq('id', id)
    .single();

  if (error) return res.status(404).json({ error: 'Order not found' });
  res.status(200).json(data);
});

// ==========================================
// PAYMENTS
// ==========================================

// CREATE: Process E-Commerce payment
router.post('/payments', async (req, res) => {
  const { order_id, idempotency_key, amount, status = 'SUCCESS' } = req.body;

  const { data, error } = await supabase
    .from('task02_payments')
    .insert([{ order_id, idempotency_key, amount, status }])
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// ==========================================
// REFUNDS
// ==========================================

// CREATE: Initiate a refund for an order
router.post('/refunds', async (req, res) => {
  const { order_id, payment_id, amount, status = 'COMPLETED' } = req.body;

  const { data: refund, error: refundError } = await supabase
    .from('task02_refunds')
    .insert([{ order_id, payment_id, amount, status }])
    .select()
    .single();

  if (refundError) return res.status(400).json({ error: refundError.message });

  // Update order status to REFUNDED
  await supabase
    .from('task02_orders')
    .update({ status: 'REFUNDED', updated_at: new Date().toISOString() })
    .eq('id', order_id);

  res.status(201).json(refund);
});

module.exports = router;