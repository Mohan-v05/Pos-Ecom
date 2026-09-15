import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Products
export const fetchProducts = async (params = {}) => (await api.get('/products', { params })).data;
export const fetchProductById = async (id) => (await api.get(`/products/${id}`)).data;
export const createProduct = async (product) => (await api.post('/products', product)).data;
export const updateProduct = async (id, product) => (await api.put(`/products/${id}`, product)).data;
export const deleteProduct = async (id) => (await api.delete(`/products/${id}`)).data;
export const uploadProductImage = async (id, image) => {
  const formData = new FormData();
  formData.append('image', image);
  return (await api.post(`/products/${id}/image`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
};
export const removeProductImage = async (id) => (await api.delete(`/products/${id}/image`)).data;

// POS Channel (Task 01)
export const createPosOrder = async (userId, items) => (await api.post('/task01/orders', { user_id: userId, items })).data;
export const createPosDraft = async (userId) => (await api.post('/task01/drafts', { user_id: userId })).data;
export const addPosDraftItem = async (orderId, productId, quantity = 1) => (await api.post(`/task01/orders/${orderId}/items`, { product_id: productId, quantity })).data;
export const removePosDraftItem = async (orderId, productId) => (await api.delete(`/task01/orders/${orderId}/items/${productId}`)).data;
export const fetchPosOrders = async () => (await api.get('/task01/orders')).data;
export const reservePosStock = async (orderId, productId, quantity, durationMinutes = 5) => 
  (await api.post('/task01/reservations', { order_id: orderId, product_id: productId, quantity, duration_minutes: durationMinutes })).data;
export const processPosPayment = async (orderId, amount, idempotencyKey) => 
  (await api.post('/task01/payments', { order_id: orderId, amount, idempotency_key: idempotencyKey })).data;

// E-Commerce Channel (Task 02)
export const createEcomOrder = async (userId, items) => (await api.post('/task02/orders', { user_id: userId, items })).data;
export const fetchEcomOrders = async (userId) => (await api.get('/task02/orders', { params: userId ? { user_id: userId } : {} })).data;
export const processEcomPayment = async (orderId, amount, idempotencyKey) => 
  (await api.post('/task02/payments', { order_id: orderId, amount, idempotency_key: idempotencyKey })).data;
export const requestEcomRefund = async (orderId, paymentId, amount) =>
  (await api.post('/task02/refunds/request', { order_id: orderId, payment_id: paymentId, amount })).data;
export const approveEcomRefund = async (refundId) => (await api.post(`/task02/refunds/${refundId}/approve`)).data;
export const declineEcomRefund = async (refundId) => (await api.delete(`/task02/refunds/${refundId}`)).data;

export default api;
