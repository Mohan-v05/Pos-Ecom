const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');

// ==========================================
// ORDERS & ORDER ITEMS
// ==========================================

// CREATE: Create a new POS order with items
router.post('/orders', async (req, res) => {
  const { user_id, items } = req.body; // items: [{ product_id, quantity, unit_price }]

  if (!user_id || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'user_id and a non-empty items array are required.' });
  }

  // Calculate total amount
  const total_amount = items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);

  // 1. Insert order
  const { data: order, error: orderError } = await supabase
    .from('task01_orders')
    .insert([{ user_id, total_amount, status: 'PENDING' }])
    .select()
    .single();

  if (orderError) return res.status(400).json({ error: orderError.message });

  // 2. Insert order items linked to order ID
  const orderItemsPayload = items.map(item => ({
    order_id: order.id,
    product_id: item.product_id,
    quantity: item.quantity,
    unit_price: item.unit_price
  }));

  const { data: orderItems, error: itemsError } = await supabase
    .from('task01_order_items')
    .insert(orderItemsPayload)
    .select();

  if (itemsError) return res.status(400).json({ error: itemsError.message });

  res.status(201).json({ order, items: orderItems });
});

// READ ALL: Get all POS orders with items
router.get('/orders', async (req, res) => {
  const { data, error } = await supabase
    .from('task01_orders')
    .select('*, task01_order_items(*)');

  if (error) return res.status(400).json({ error: error.message });
  res.status(200).json(data);
});

// READ ONE: Get single POS order details
router.get('/orders/:id', async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('task01_orders')
    .select('*, task01_order_items(*), task01_reservations(*), task01_payments(*)')
    .eq('id', id)
    .single();

  if (error) return res.status(404).json({ error: 'Order not found' });
  res.status(200).json(data);
});

// UPDATE: Update order status
router.patch('/orders/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const { data, error } = await supabase
    .from('task01_orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(200).json(data);
});

// ==========================================
// RESERVATIONS
// ==========================================

// CREATE: Create stock reservation
router.post('/reservations', async (req, res) => {
  const { order_id, product_id, quantity, duration_minutes = 15 } = req.body;

  const expires_at = new Date(Date.now() + duration_minutes * 60000).toISOString();

  const { data, error } = await supabase
    .from('task01_reservations')
    .insert([{ order_id, product_id, quantity, expires_at, status: 'ACTIVE' }])
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// ==========================================
// PAYMENTS
// ==========================================

// CREATE: Process POS payment (with Idempotency Key)
router.post('/payments', async (req, res) => {
  const { order_id, idempotency_key, amount, status = 'SUCCESS' } = req.body;

  const { data, error } = await supabase
    .from('task01_payments')
    .insert([{ order_id, idempotency_key, amount, status }])
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

module.exports = router;