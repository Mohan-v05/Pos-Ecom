import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CreditCard, PackageOpen, RefreshCw, RotateCcw, ShoppingBag, Sparkles } from 'lucide-react';
import { createEcomOrder, fetchEcomOrders, fetchProducts, processEcomPayment, processEcomRefund } from '../services/api';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default function EcomPage() {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const loadData = async () => {
    try {
      const [catalog, history] = await Promise.all([fetchProducts(), fetchEcomOrders()]);
      setProducts(catalog);
      setOrders(history);
    } catch (error) {
      setNotice({ type: 'error', text: error.response?.data?.error || 'Could not load the storefront. Check that the API is running.' });
    }
  };

  useEffect(() => {
    let active = true;
    Promise.all([fetchProducts(), fetchEcomOrders()])
      .then(([catalog, history]) => {
        if (!active) return;
        setProducts(catalog);
        setOrders(history);
      })
      .catch((error) => {
        if (active) setNotice({ type: 'error', text: error.response?.data?.error || 'Could not load the storefront. Check that the API is running.' });
      });
    return () => { active = false; };
  }, []);

  const selected = useMemo(() => products.find((product) => product.id === selectedProductId), [products, selectedProductId]);
  const requestedQuantity = Math.max(1, Number(quantity) || 1);

  const checkout = async (event) => {
    event.preventDefault();
    if (!selected) return;
    if (requestedQuantity > selected.stock) return setNotice({ type: 'error', text: `Only ${selected.stock} unit(s) are currently available.` });
    setBusy(true);
    setNotice(null);
    try {
      const { order } = await createEcomOrder('cust_online_01', [{ product_id: selected.id, quantity: requestedQuantity }]);
      await processEcomPayment(order.id, order.total_amount, `ecom_${crypto.randomUUID()}`);
      setNotice({ type: 'success', text: `Order #${order.id.slice(0, 8)} is paid and on its way.` });
      setSelectedProductId('');
      setQuantity(1);
      await loadData();
    } catch (error) {
      setNotice({ type: 'error', text: error.response?.data?.error || 'Checkout could not be completed.' });
    } finally { setBusy(false); }
  };

  const refund = async (order) => {
    const payment = order.payments?.find((entry) => entry.status === 'SUCCESS');
    if (!payment) return setNotice({ type: 'error', text: 'A successful payment was not found for that order.' });
    setBusy(true);
    setNotice(null);
    try {
      await processEcomRefund(order.id, payment.id, order.total_amount);
      setNotice({ type: 'success', text: `Refund for order #${order.id.slice(0, 8)} has been completed.` });
      await loadData();
    } catch (error) {
      setNotice({ type: 'error', text: error.response?.data?.error || 'Refund could not be completed.' });
    } finally { setBusy(false); }
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
      <section className="relative mb-8 overflow-hidden rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-2xl shadow-slate-900/15 sm:px-10">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute bottom-0 right-28 h-32 w-32 rounded-full bg-indigo-500/30 blur-2xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-cyan-300"><Sparkles className="h-4 w-4" /> Direct storefront</p><h1 className="text-3xl font-black tracking-tight sm:text-4xl">One inventory. Every channel.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">Buy from the online store with the same live catalog your POS team uses.</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 backdrop-blur"><p className="text-xs text-slate-300">Live catalog</p><p className="text-xl font-bold">{products.length} products available</p></div>
        </div>
      </section>

      {notice && <div className={`mb-6 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${notice.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{notice.text}</div>}

      <div className="grid gap-7 lg:grid-cols-[1.05fr_.95fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-8">
          <div className="mb-7 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-50 text-cyan-700"><ShoppingBag className="h-5 w-5" /></span><div><h2 className="font-bold text-slate-900">Build your order</h2><p className="text-sm text-slate-500">Secure checkout with real-time availability.</p></div></div>
          <form onSubmit={checkout} className="space-y-5">
            <label className="block text-sm font-semibold text-slate-700">Choose a product<select value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10" required><option value="">Select from the catalog</option>{products.map((product) => <option disabled={product.stock < 1} key={product.id} value={product.id}>{product.name} — {money.format(product.price)} · {product.stock} left</option>)}</select></label>
            <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold text-slate-700">Quantity<input type="number" min="1" max={selected?.stock || 1} value={quantity} onChange={(event) => setQuantity(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10" /></label><div className="rounded-xl bg-slate-50 px-4 py-3"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Order total</p><p className="mt-1 text-xl font-black text-slate-900">{selected ? money.format(selected.price * requestedQuantity) : '—'}</p></div></div>
            {selected && <div className="flex items-center justify-between rounded-xl border border-cyan-100 bg-cyan-50/60 px-4 py-3 text-sm"><span className="font-medium text-slate-700">{selected.name}</span><span className="font-bold text-cyan-800">{selected.stock} in stock</span></div>}
            <button disabled={busy || !selected || selected.stock < 1} className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 py-3.5 font-bold text-white shadow-lg shadow-slate-900/20 transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-300">{busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}{busy ? 'Processing securely…' : 'Pay & place order'}</button>
          </form>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-8"><div className="mb-6 flex items-center justify-between"><div><h2 className="font-bold text-slate-900">Order activity</h2><p className="text-sm text-slate-500">Manage online payments and refunds.</p></div><button onClick={loadData} aria-label="Refresh order history" className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"><RefreshCw className="h-4 w-4" /></button></div><div className="max-h-[430px] space-y-3 overflow-y-auto pr-1">{orders.length === 0 ? <div className="grid place-items-center py-16 text-center text-slate-500"><PackageOpen className="mb-3 h-10 w-10 text-slate-300" /><p className="font-medium">No online orders yet</p><p className="mt-1 text-sm">Your completed purchases will appear here.</p></div> : orders.map((order) => <article key={order.id} className="rounded-2xl border border-slate-100 p-4 transition hover:border-slate-200 hover:shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-slate-800">Order #{order.id.slice(0, 8)}</p><p className="mt-1 text-xs text-slate-500">{new Date(order.created_at).toLocaleString()}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${order.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : order.status === 'REFUNDED' ? 'bg-violet-100 text-violet-700' : 'bg-amber-100 text-amber-700'}`}>{order.status}</span></div><div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3"><span className="font-bold text-slate-900">{money.format(order.total_amount)}</span>{order.status === 'PAID' && <button disabled={busy} onClick={() => refund(order)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"><RotateCcw className="h-3.5 w-3.5" />Refund order</button>}</div></article>)}</div></section>
      </div>
    </main>
  );
}
