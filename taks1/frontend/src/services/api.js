import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Products
export const fetchProducts = async (params = {}) => (await api.get('/products', { params })).data;
export const fetchProductById = async (id) => (await api.get(`/products/${id}`)).data;

// POS Channel (Task 01)
export const createPosOrder = async (userId, items) => (await api.post('/task01/orders', { user_id: userId, items })).data;
export const fetchPosOrders = async () => (await api.get('/task01/orders')).data;
export const reservePosStock = async (orderId, productId, quantity, durationMinutes = 5) => 
  (await api.post('/task01/reservations', { order_id: orderId, product_id: productId, quantity, duration_minutes: durationMinutes })).data;
export const processPosPayment = async (orderId, amount, idempotencyKey) => 
  (await api.post('/task01/payments', { order_id: orderId, amount, idempotency_key: idempotencyKey })).data;

// E-Commerce Channel (Task 02)
export const createEcomOrder = async (userId, items) => (await api.post('/task02/orders', { user_id: userId, items })).data;
export const fetchEcomOrders = async () => (await api.get('/task02/orders')).data;
export const processEcomPayment = async (orderId, amount, idempotencyKey) => 
  (await api.post('/task02/payments', { order_id: orderId, amount, idempotency_key: idempotencyKey })).data;
export const processEcomRefund = async (orderId, paymentId, amount) => 
  (await api.post('/task02/refunds', { order_id: orderId, payment_id: paymentId, amount })).data;

export default api;