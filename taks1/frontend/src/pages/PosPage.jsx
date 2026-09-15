import { useState, useEffect } from 'react';
import { addPosDraftItem, approveEcomRefund, createPosDraft, declineEcomRefund, fetchEcomOrders, fetchPosOrders, fetchProducts, processPosPayment, removePosDraftItem } from '../services/api';
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
  Package,
  BarChart3,
  ClipboardList,
  X,
  Check,
  Ban
} from 'lucide-react';

export default function PosPage() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [lastTx, setLastTx] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [posOrders, setPosOrders] = useState([]);
  const [onlineOrders, setOnlineOrders] = useState([]);
  const [showOnline, setShowOnline] = useState(false);
  const [selectedOnlineOrder, setSelectedOnlineOrder] = useState(null);
  const [draftOrderId, setDraftOrderId] = useState(null);

  useEffect(() => {
    loadProducts();
    loadAdminData();
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

  async function loadAdminData() {
    try {
      const [pos, online] = await Promise.all([fetchPosOrders(), fetchEcomOrders()]);
      setPosOrders(pos);
      setOnlineOrders(online);
    } catch { setErrorMsg('Could not load the sales dashboard.'); }
  }

  const addToCart = async (product) => {
    setErrorMsg('');
    try {
      const orderId = draftOrderId || (await createPosDraft('cashier_terminal_01')).order.id;
      await addPosDraftItem(orderId, product.id);
      if (!draftOrderId) setDraftOrderId(orderId);
      setCart((current) => {
        const existing = current.find((item) => item.product_id === product.id);
        return existing ? current.map((item) => item.product_id === product.id ? { ...item, quantity: item.quantity + 1 } : item) : [...current, { product_id: product.id, name: product.name, unit_price: product.price, quantity: 1, stock: product.stock }];
      });
      await loadProducts();
    } catch (error) { setErrorMsg(error.response?.data?.error || 'Unable to reserve this item.'); }
  };

  const updateQuantity = async (productId, delta) => {
    if (delta > 0) return addToCart(products.find((product) => product.id === productId));
    try { await removePosDraftItem(draftOrderId, productId); } catch (error) { setErrorMsg(error.response?.data?.error || 'Unable to release this item.'); return; }
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
    await loadProducts();
  };

  const removeFromCart = async (productId) => {
    const item = cart.find((entry) => entry.product_id === productId);
    try {
      for (let count = 0; count < item.quantity; count += 1) {
        await removePosDraftItem(draftOrderId, productId);
      }
      setCart((current) => current.filter((entry) => entry.product_id !== productId));
      await loadProducts();
    } catch (error) {
      setErrorMsg(error.response?.data?.error || 'Unable to release this item.');
    }
  };

  const clearCart = async () => {
    for (const item of cart) await removeFromCart(item.product_id);
    setErrorMsg('');
  };

  const subtotal = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    setErrorMsg('');
    setLastTx(null);

    try {
      const order = { id: draftOrderId, total_amount: subtotal };
      // Draft stock was reserved as items were selected; this converts it to a sale.
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

      setCart([]);
      setDraftOrderId(null);
      await loadProducts();
      await loadAdminData();
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
  const today = new Date().toDateString();
  const paidToday = [...posOrders, ...onlineOrders].filter((order) => order.status === 'PAID' && new Date(order.created_at).toDateString() === today);
  const todaySales = paidToday.reduce((sum, order) => sum + Number(order.total_amount), 0);
  const refundRequests = onlineOrders.flatMap((order) => (order.refunds || []).filter((refund) => refund.status === 'PENDING').map((refund) => ({ ...refund, order })));
  const decideRefund = async (refund, approve) => {
    setLoading(true);
    try { if (approve) await approveEcomRefund(refund.id); else await declineEcomRefund(refund.id); await loadProducts(); await loadAdminData(); }
    catch (error) { setErrorMsg(error.response?.data?.error || 'Could not process refund request.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Title */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-700">Shop admin</p><h1 className="text-3xl font-black text-slate-950 tracking-tight">POS Register</h1><p className="text-xs text-gray-500">In-store checkout and sales operations</p></div>
        <div className="flex gap-3"><div className="rounded-xl bg-slate-950 px-4 py-2 text-white"><span className="text-[10px] uppercase tracking-wider text-slate-400">Today’s sales</span><p className="flex items-center gap-1 text-lg font-black"><BarChart3 className="h-4 w-4 text-cyan-300"/>${todaySales.toFixed(2)}</p></div><button onClick={() => setShowOnline(true)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700"><ClipboardList className="mr-2 inline h-4 w-4 text-cyan-600"/>Online orders {refundRequests.length ? `(${refundRequests.length})` : ''}</button></div>
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
      {showOnline && <div className="fixed inset-0 z-50 bg-slate-950/40 p-4 sm:p-8"><section className="mx-auto max-w-4xl rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h2 className="text-xl font-black">Online order tracker</h2><p className="text-sm text-slate-500">Review customer orders and simulate refund decisions.</p></div><button onClick={() => setShowOnline(false)}><X className="text-slate-400"/></button></div>{refundRequests.length > 0 && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="mb-3 text-sm font-black text-amber-900">Refund requests awaiting your decision</p>{refundRequests.map((refund) => <div key={refund.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-amber-200 py-3 first:border-0"><div><p className="font-bold text-slate-800">Order #{refund.order.id.slice(0, 8)} · ${Number(refund.amount).toFixed(2)}</p><p className="text-xs text-slate-500">Customer: {refund.order.user_id}</p></div><div className="flex gap-2"><button disabled={loading} onClick={() => decideRefund(refund, true)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white"><Check className="h-3 w-3"/>Accept refund</button><button disabled={loading} onClick={() => decideRefund(refund, false)} className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-xs font-bold text-rose-600 ring-1 ring-rose-200"><Ban className="h-3 w-3"/>Decline</button></div></div>)}</div>}<div className="mt-5 max-h-[45vh] overflow-auto rounded-xl border border-slate-100">{onlineOrders.map((order) => <button onClick={() => setSelectedOnlineOrder(order)} key={order.id} className="flex w-full items-center justify-between border-b border-slate-100 p-4 text-left last:border-0 hover:bg-cyan-50"><div><p className="font-bold text-slate-800">Order #{order.id.slice(0, 8)}</p><p className="text-xs text-slate-500">{order.user_id} · {new Date(order.created_at).toLocaleString()}</p></div><div className="text-right"><p className="font-black">${Number(order.total_amount).toFixed(2)}</p><p className="text-xs font-bold text-cyan-700">{order.status}</p></div></button>)}{!onlineOrders.length && <p className="p-10 text-center text-sm text-slate-400">No online orders yet.</p>}</div></section></div>}{selectedOnlineOrder && <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/50 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><button onClick={() => setSelectedOnlineOrder(null)} className="float-right"><X className="text-slate-400"/></button><p className="text-xs font-bold uppercase text-cyan-700">Online order details</p><h2 className="mt-1 text-2xl font-black">#{selectedOnlineOrder.id.slice(0, 8)}</h2><p className="text-sm text-slate-500">Customer: {selectedOnlineOrder.user_id}</p><div className="mt-5 space-y-2 border-y border-slate-100 py-4">{selectedOnlineOrder.order_items?.map((item) => <div key={item.id} className="flex justify-between text-sm"><span>{item.quantity} × {item.product_id.slice(0, 8)}</span><span className="font-bold">${(Number(item.quantity) * Number(item.unit_price)).toFixed(2)}</span></div>)}</div><div className="mt-4 flex justify-between font-black"><span>Total</span><span>${Number(selectedOnlineOrder.total_amount).toFixed(2)}</span></div><p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm">Payment: {selectedOnlineOrder.payments?.[0]?.status || 'Not recorded'} · Refund: {selectedOnlineOrder.refunds?.[0]?.status || 'None'}</p></div></div>}
    </div>
  );
}
