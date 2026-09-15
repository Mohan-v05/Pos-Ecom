const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const { releaseExpiredReservations } = require('../services/orderService');

// CREATE: Add a new product
router.post('/', async (req, res) => {
  const { name, description, price, category, stock } = req.body;

  if (!name || price === undefined || !category) {
    return res.status(400).json({ error: 'Name, price, and category are required fields.' });
  }

  const { data, error } = await supabase
    .from('products')
    .insert([{
      name,
      description,
      price,
      category,
      stock: stock ?? 0
    }])
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// READ ALL: Fetch products with search, category, and price filtering
router.get('/', async (req, res) => {
  const { search, category, minPrice, maxPrice } = req.query;
  await releaseExpiredReservations();

  let query = supabase.from('products').select('*');

  // Apply query filters sent from React frontend
  if (search) {
    query = query.ilike('name', `%${search}%`);
  }
  if (category) {
    query = query.eq('category', category);
  }
  if (minPrice) {
    query = query.gte('price', parseFloat(minPrice));
  }
  if (maxPrice) {
    query = query.lte('price', parseFloat(maxPrice));
  }

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) return res.status(400).json({ error: error.message });
  res.status(200).json(data);
});

// READ ONE: Get product by UUID
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return res.status(404).json({ error: 'Product not found' });
  res.status(200).json(data);
});

// UPDATE: Modify product by UUID
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description, price, category, stock } = req.body;

  const updates = { updated_at: new Date().toISOString() };
  for (const [key, value] of Object.entries({ name, description, price, category, stock })) {
    if (value !== undefined) updates[key] = value;
  }

  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Product not found' });

  res.status(200).json(data);
});

// DELETE: Remove product by UUID
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('products')
    .delete()
    .eq('id', id)
    .select();

  if (error) return res.status(400).json({ error: error.message });
  if (!data || data.length === 0) return res.status(404).json({ error: 'Product not found' });

  res.status(200).json({ message: 'Product deleted successfully' });
});

module.exports = router;
