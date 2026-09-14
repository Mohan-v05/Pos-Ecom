require('dotenv').config();
const express = require('express');
const cors = require('cors');

const task01Routes = require('./routes/task01');
const task02Routes = require('./routes/task02');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Health Check
app.get('/', (req, res) => {
  res.send('Express + Supabase API is running!');
});

// Mount modular routes
app.use('/api/task01', task01Routes);
app.use('/api/task02', task02Routes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});