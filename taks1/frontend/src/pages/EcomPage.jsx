import React, { useState, useEffect } from 'react';
import { fetchProducts, createEcomOrder, processEcomPayment, fetchEcomOrders, processEcomRefund } from '../services/api';
import { ShoppingBag, RotateCcw, CheckCircle } from 'lucide-react';

export default function EcomPage() {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [prodData, orderData] = await Promise.all([fetchProducts(), fetchEcomOrders()]);
    setProducts(prodData);
    setOrders(orderData);
  };

  const handleOnlineCheckout = async (e) => {
    e.preventDefault();
    if (!selectedProductId) return;
    setLoading(true);
    setMessage('');

    try {
      const product = products.find((p) => p.id === selectedProductId);
      const items = [{ product_id: product.id, quantity: Number(quantity), unit_price: product.price }];
      
      // 1. Create E-Commerce Order
      const { order } = await createEcomOrder('cust_online_01', items);

      // 2. Process E-Commerce Payment
      const idempotencyKey = `tx_ecom_${Date.now()}`;
      await processEcomPayment(order.id, order.total_amount, idempotencyKey);

      setMessage(`Order #${order.id.slice(0, 8)} created & paid!`);
      loadData();
    } catch (err) {
      alert(`Error: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRefund = async (order) => {
    const payment = order.payments?.[0];
    if (!payment) return alert('No payment record found for this order');

    setLoading(true);
    try {
      await processEcomRefund(order.id, payment.id, order.total_amount);
      setMessage(`Refund processed for Order #${order.id.slice(0, 8)}`);
      loadData();
    } catch (err) {
      alert(`Refund error: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Online Purchase Form */}
      <div className="bg-white border rounded-xl p-6 shadow-sm">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800">
          <ShoppingBag className="w-5 h-5 text-blue-600" /> E-Commerce Checkout
        </h2>
        <form onSubmit={handleOnlineCheckout} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Select Product</label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full border rounded-lg p-2.5"
              required
            >
              <option value="">-- Choose Item --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (${p.price}) - Stock: {p.stock}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Quantity</label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full border rounded-lg p-2.5"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
          >
            {loading ? 'Processing...' : 'Place E-Commerce Order'}
          </button>
        </form>
        {message && (
          <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm flex items-center gap-2">
            <CheckCircle className="w-4 h-4" /> {message}
          </div>
        )}
      </div>

      {/* Order History & Refunds */}
      <div className="bg-white border rounded-xl p-6 shadow-sm">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800">
          <RotateCcw className="w-5 h-5 text-purple-600" /> Online Orders & Refunds
        </h2>
        <div className="space-y-4 max-h-[500px] overflow-y-auto">
          {orders.length === 0 ? (
            <p className="text-gray-400">No online orders found.</p>
          ) : (
            orders.map((o) => (
              <div key={o.id} className="border p-4 rounded-lg flex justify-between items-center">
                <div>
                  <div className="font-semibold">Order #{o.id.slice(0, 8)}</div>
                  <div className="text-xs text-gray-500">User: {o.user_id}</div>
                  <div className="text-sm font-bold text-gray-800 mt-1">${o.total_amount}</div>
                </div>
                <div className="text-right">
                  <span className={`inline-block px-2.5 py-1 text-xs font-bold rounded-full mb-2 ${
                    o.status === 'PAID' ? 'bg-green-100 text-green-700' :
                    o.status === 'REFUNDED' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {o.status}
                  </span>
                  {o.status === 'PAID' && (
                    <button
                      onClick={() => handleRefund(o)}
                      className="block text-xs bg-red-50 text-red-600 border border-red-200 px-3 py-1 rounded hover:bg-red-100"
                    >
                      Issue Refund
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}