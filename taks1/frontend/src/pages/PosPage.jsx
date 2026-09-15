import { useState, useEffect } from 'react';
import { fetchProducts, createPosOrder, reservePosStock, processPosPayment } from '../services/api';
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Search,
  RefreshCw,
  Clock,
  Package
} from 'lucide-react';

export default function PosPage() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [lastTx, setLastTx] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      setCatalogLoading(true);
      const data = await fetchProducts();
      setProducts(data);
    } catch {
      setErrorMsg('Failed to load product catalog.');
    } finally {
      setCatalogLoading(false);
    }
  }

  const addToCart = (product) => {
    setErrorMsg('');
    const existingIndex = cart.findIndex((item) => item.product_id === product.id);

    if (existingIndex > -1) {
      const existingItem = cart[existingIndex];
      if (existingItem.quantity >= product.stock) {
        setErrorMsg(`Cannot add more than available stock (${product.stock}).`);
        return;
      }
      const updatedCart = [...cart];
      updatedCart[existingIndex].quantity += 1;
      setCart(updatedCart);
    } else {
      if (product.stock < 1) {
        setErrorMsg('Item is out of stock.');
        return;
      }
      setCart([
        ...cart,
        {
          product_id: product.id,
          name: product.name,
          unit_price: product.price,
          quantity: 1,
          stock: product.stock
        }
      ]);
    }
  };

  const updateQuantity = (productId, delta) => {
    setCart(
      cart
        .map((item) => {
          if (item.product_id === productId) {
            const newQty = item.quantity + delta;
            if (newQty > item.stock) {
              setErrorMsg(`Maximum available stock reached (${item.stock}).`);
              return item;
            }
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter((item) => item.product_id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setErrorMsg('');
  };

  const subtotal = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    setErrorMsg('');
    setLastTx(null);

    try {
      // 1. Prepare Payload & Create POS Order
      const itemsPayload = cart.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price
      }));

      const orderRes = await createPosOrder('cashier_terminal_01', itemsPayload);
      const order = orderRes.order;

      // 2. Reserve Stock (Default 5-minute lock)
      for (const item of cart) {
        await reservePosStock(order.id, item.product_id, item.quantity, 5);
      }

      // 3. Process POS Payment with unique Idempotency Key
      const idempotencyKey = `pos_tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const paymentRes = await processPosPayment(order.id, order.total_amount, idempotencyKey);

      // 4. Record successful transaction state & refresh products
      setLastTx({
        orderId: order.id,
        paymentId: paymentRes.id,
        idempotencyKey,
        amount: order.total_amount,
        itemCount: cart.reduce((sum, i) => sum + i.quantity, 0)
      });

      clearCart();
      await loadProducts();
    } catch (err) {
      console.error('POS Checkout Error:', err);
      setErrorMsg(err.response?.data?.error || 'Transaction failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">POS Register Terminal</h1>
        <p className="text-xs text-gray-500">Channel: POS | Quick cashier lookup and instant checkout</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Product Quick Select */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Quick search product name or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          {/* Product Grid */}
          {catalogLoading ? (
            <div className="text-center py-12 text-gray-500 flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
              <span>Loading terminal products...</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  disabled={product.stock < 1}
                  className={`p-4 rounded-xl border text-left transition flex flex-col justify-between h-32 ${
                    product.stock < 1
                      ? 'bg-gray-100 border-gray-200 opacity-60 cursor-not-allowed'
                      : 'bg-white border-gray-200 hover:border-blue-500 hover:shadow-sm active:scale-[0.98]'
                  }`}
                >
                  <div>
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
                      {product.category}
                    </span>
                    <h3 className="font-semibold text-gray-800 text-sm line-clamp-2 leading-snug">
                      {product.name}
                    </h3>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-bold text-gray-900">${product.price}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                      product.stock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {product.stock > 0 ? `${product.stock} in stock` : 'Out of Stock'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Active Terminal Cart */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col justify-between h-fit min-h-[500px]">
          <div>
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h2 className="font-bold text-gray-800 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-blue-600" /> Active Register Cart
              </h2>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-xs text-red-500 hover:text-red-700 font-medium"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Cart Items List */}
            {cart.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Click products to add to current sale</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div
                    key={item.product_id}
                    className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-100 text-sm"
                  >
                    <div className="flex-1 pr-2">
                      <div className="font-medium text-gray-800">{item.name}</div>
                      <div className="text-xs text-gray-500">${item.unit_price} each</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center border rounded-lg bg-white">
                        <button
                          onClick={() => updateQuantity(item.product_id, -1)}
                          className="p-1 hover:bg-gray-100 text-gray-600"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2 font-bold text-xs">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product_id, 1)}
                          className="p-1 hover:bg-gray-100 text-gray-600"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="font-bold text-gray-900 w-14 text-right">
                        ${(item.quantity * item.unit_price).toFixed(2)}
                      </span>
                      <button
                        onClick={() => removeFromCart(item.product_id)}
                        className="text-gray-400 hover:text-red-500 ml-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart Bottom Summary & Checkout Button */}
          <div className="border-t pt-4 mt-6">
            <div className="space-y-1.5 text-xs text-gray-600 mb-4">
              <div className="flex justify-between">
                <span>Items Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-blue-600">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Stock Lock Expiry
                </span>
                <span>5 Minutes</span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-gray-900 pt-2 border-t">
                <span>Total Due</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              disabled={loading || cart.length === 0}
              className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 shadow-sm"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Processing Payment...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" /> Complete POS Sale
                </>
              )}
            </button>

            {/* Success Receipt Alert */}
            {lastTx && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded-xl text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-green-700">
                  <CheckCircle2 className="w-4 h-4" /> Sale Completed (${lastTx.amount})
                </div>
                <div>Order ID: <span className="font-mono font-semibold">{lastTx.orderId.slice(0, 8)}...</span></div>
                <div>Idempotency Key: <span className="font-mono text-[10px] bg-white px-1 border rounded">{lastTx.idempotencyKey}</span></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
