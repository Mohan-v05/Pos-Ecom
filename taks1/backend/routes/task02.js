const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');

// ==========================================
// ORDERS & ORDER ITEMS (ECOMMERCE CHANNEL)
// ==========================================

// CREATE: Create a new E-Commerce order with items
router.post('/orders', async (req, res) => {
  const { user_id, items } = req.body;

  if (!user_id || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'user_id and a non-empty items array are required.' });
  }

  const total_amount = items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);

  // 1. Insert order with channel discriminator set to 'ECOMMERCE'
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert([{ user_id, channel: 'ECOMMERCE', total_amount, status: 'PENDING' }])
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
    .from('order_items')
    .insert(orderItemsPayload)
    .select();

  if (itemsError) return res.status(400).json({ error: itemsError.message });

  res.status(201).json({ order, items: orderItems });
});

// READ ALL: Get all E-Commerce orders with items
router.get('/orders', async (req, res) => {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('channel', 'ECOMMERCE')
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  res.status(200).json(data);
});

// READ ONE: Get single E-Commerce order details with payments, reservations & refunds
router.get('/orders/:id', async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*), reservations(*), payments(*), refunds(*)')
    .eq('id', id)
    .eq('channel', 'ECOMMERCE')
    .single();

  if (error) return res.status(404).json({ error: 'E-Commerce order not found' });
  res.status(200).json(data);
});

// ==========================================
// PAYMENTS
// ==========================================

// CREATE: Process E-Commerce payment
router.post('/payments', async (req, res) => {
  const { order_id, idempotency_key, amount, status = 'SUCCESS' } = req.body;

  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .insert([{ order_id, idempotency_key, amount, status }])
    .select()
    .single();

  if (paymentError) return res.status(400).json({ error: paymentError.message });

  // Update order status if payment is successful
  if (status === 'SUCCESS') {
    await supabase
      .from('orders')
      .update({ status: 'PAID', updated_at: new Date().toISOString() })
      .eq('id', order_id);
  }

  res.status(201).json(payment);
});

// ==========================================
// REFUNDS
// ==========================================

// CREATE: Initiate a refund for an order
router.post('/refunds', async (req, res) => {
  const { order_id, payment_id, amount, status = 'COMPLETED' } = req.body;

  const { data: refund, error: refundError } = await supabase
    .from('refunds')
    .insert([{ order_id, payment_id, amount, status }])
    .select()
    .single();

  if (refundError) return res.status(400).json({ error: refundError.message });

  // Update order status to REFUNDED
  await supabase
    .from('orders')
    .update({ status: 'REFUNDED', updated_at: new Date().toISOString() })
    .eq('id', order_id);

  res.status(201).json(refund);
});

module.exports = router;