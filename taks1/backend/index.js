const express = require('express');
const cors = require('cors');
require('dotenv').config();
const supabase = require('./supabaseClient');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Health Check
app.get('/', (req, res) => {
  res.send('Express + Supabase API is running!');
});

// CREATE: Add a new product
app.post('/api/products', async (req, res) => {
  const { name, description, price, category, stock, reserved_stock } = req.body;

  // Basic validation for required fields in schema
  if (!name || !price || !category) {
    return res.status(400).json({ error: 'Name, price, and category are required fields.' });
  }

  const { data, error } = await supabase
    .from('products')
    .insert([{
      name,
      description,
      price,
      category,
      stock: stock ?? 0,
      reserved_stock: reserved_stock ?? 0
    }])
    .select();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data[0]);
});

// READ ALL: Fetch all products
app.get('/api/products', async (req, res) => {
  console.log('---> GET /api/products hit!'); // 1. Check if route is reached

  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase Error:', error.message);
      return res.status(400).json({ error: error.message });
    }

    console.log('Data retrieved successfully:', data);
    return res.status(200).json(data);
  } catch (err) {
    console.error('Server Crash Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// READ ONE: Get product by UUID
app.get('/api/products/:id', async (req, res) => {
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
app.put('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description, price, category, stock, reserved_stock } = req.body;

  const { data, error } = await supabase
    .from('products')
    .update({
      name,
      description,
      price,
      category,
      stock,
      reserved_stock,
      updated_at: new Date().toISOString() // Updates timestamp on modification
    })
    .eq('id', id)
    .select();

  if (error) return res.status(400).json({ error: error.message });
  if (!data || data.length === 0) return res.status(404).json({ error: 'Product not found' });

  res.status(200).json(data[0]);
});

// DELETE: Remove product by UUID
app.delete('/api/products/:id', async (req, res) => {
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});