require('dotenv').config();
const express = require('express');
const cors = require('cors');

const productRoutes = require('./routes/products');
const task01Routes = require('./routes/task01');
const task02Routes = require('./routes/task02');

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  'https://pos-ecom-seven.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

app.use(cors({
  origin(origin, callback) {
    // Requests from tools such as curl/Postman do not include an Origin header.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`Origin ${origin} is not allowed by CORS.`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Health Check
app.get('/', (req, res) => {
  res.send('Express + Supabase API is running!');
});

// Mount modular routes
app.use('/api/products', productRoutes);
app.use('/api/task01', task01Routes);
app.use('/api/task02', task02Routes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
