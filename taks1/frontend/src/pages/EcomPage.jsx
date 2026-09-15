import { useEffect, useMemo, useState } from "react";
import {
  Eye,
  Minus,
  PackageOpen,
  Plus,
  Search,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  createEcomOrder,
  fetchEcomOrders,
  fetchProducts,
  processEcomPayment,
  requestEcomRefund,
} from "../services/api";

const CUSTOMER_ID = "cust_online_01";
const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export default function EcomPage() {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [cart, setCart] = useState([]);
  const [filters, setFilters] = useState({
    search: "",
    category: "",
    maxPrice: "",
    available: false,
  });
  const [productDetail, setProductDetail] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  // Refresh both the shared catalog and this customer's private order history.
  const loadStore = async () => {
    const [catalog, history] = await Promise.all([
      fetchProducts(),
      fetchEcomOrders(CUSTOMER_ID),
    ]);
    setProducts(catalog);
    setOrders(history);
  };

  useEffect(() => {
    let isMounted = true;

    Promise.all([fetchProducts(), fetchEcomOrders(CUSTOMER_ID)])
      .then(([catalog, history]) => {
        if (!isMounted) return;
        setProducts(catalog);
        setOrders(history);
      })
      .catch(() => {
        if (isMounted) setNotice("The store is temporarily unavailable.");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Build customer-facing filters from the catalog rather than hard-coding categories.
  const categories = useMemo(
    () => [
      ...new Set(products.map((product) => product.category).filter(Boolean)),
    ],
    [products],
  );

  const visibleProducts = useMemo(
    () =>
      products.filter((product) => {
        const text =
          `${product.name} ${product.description || ""}`.toLowerCase();
        return (
          (!filters.search || text.includes(filters.search.toLowerCase())) &&
          (!filters.category || product.category === filters.category) &&
          (!filters.maxPrice ||
            Number(product.price) <= Number(filters.maxPrice)) &&
          (!filters.available || product.stock > 0)
        );
      }),
    [products, filters],
  );

  // Cart is intentionally local until the customer completes mock payment.
  const cartTotal = cart.reduce(
    (sum, item) => sum + Number(item.price) * item.quantity,
    0,
  );

  const addToCart = (product) => {
    if (!product.stock) return;

    setCart((currentCart) => {
      const existing = currentCart.find((item) => item.id === product.id);
      if (!existing) return [...currentCart, { ...product, quantity: 1 }];

      return currentCart.map((item) =>
        item.id === product.id
          ? { ...item, quantity: Math.min(item.quantity + 1, product.stock) }
          : item,
      );
    });
  };

  const changeCartQuantity = (productId, delta) => {
    setCart((currentCart) =>
      currentCart
        .map((item) =>
          item.id === productId
            ? { ...item, quantity: item.quantity + delta }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  // The server validates live inventory and calculates the final order total.
  const checkout = async () => {
    if (!cart.length) return;

    setBusy(true);
    setNotice("");
    try {
      const { order } = await createEcomOrder(
        CUSTOMER_ID,
        cart.map((item) => ({ product_id: item.id, quantity: item.quantity })),
      );
      await processEcomPayment(
        order.id,
        order.total_amount,
        `web_${crypto.randomUUID()}`,
      );

      setCart([]);
      setNotice(
        `Payment approved — order #${order.id.slice(0, 8)} has been placed.`,
      );
      await loadStore();
    } catch (error) {
      setNotice(error.response?.data?.error || "Payment was not completed.");
    } finally {
      setBusy(false);
    }
  };

  // A customer requests cancellation; shop staff approves or declines it in POS.
  const requestCancellation = async (order) => {
    const payment = order.payments?.find((entry) => entry.status === "SUCCESS");
    if (!payment) return;

    setBusy(true);
    try {
      await requestEcomRefund(order.id, payment.id, order.total_amount);
      setNotice("Cancellation request sent to the shop for review.");
      await loadStore();
    } catch (error) {
      setNotice(
        error.response?.data?.error || "Unable to send cancellation request.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Storefront introduction */}
      <StoreHero />

      {notice && <Notice message={notice} />}

      {/* Catalog and the active customer cart */}
      <div className="grid gap-7 lg:grid-cols-[1fr_330px]">
        <section>
          <CatalogFilters
            categories={categories}
            filters={filters}
            onChange={setFilters}
          />
          <ProductGrid
            products={visibleProducts}
            onAdd={addToCart}
            onView={setProductDetail}
          />
        </section>

        <CartPanel
          busy={busy}
          cart={cart}
          total={cartTotal}
          onCheckout={checkout}
          onQuantityChange={changeCartQuantity}
        />
      </div>

      {/* Only the current customer's previous orders */}
      <OrderHistory
        busy={busy}
        orders={orders}
        onCancel={requestCancellation}
        onOpen={setSelectedOrder}
      />

      {productDetail && (
        <ProductModal
          product={productDetail}
          onAdd={() => {
            addToCart(productDetail);
            setProductDetail(null);
          }}
          onClose={() => setProductDetail(null)}
        />
      )}

      {selectedOrder && (
        <OrderDetail
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </main>
  );
}

function StoreHero() {
  return (
    <section className="mb-8 rounded-3xl bg-slate-950 px-6 py-10 text-white sm:px-10">
      <p className="text-xs font-bold uppercase tracking-[.22em] text-cyan-300">
        Techloom store
      </p>
      <h1 className="mt-2 text-4xl font-black tracking-tight">
        Work better, beautifully.
      </h1>
      <p className="mt-3 max-w-xl text-slate-300">
        Discover considered gear for your best desk setup. Live stock, simple
        checkout, no surprises.
      </p>
    </section>
  );
}

function Notice({ message }) {
  return (
    <div className="mb-5 rounded-xl bg-cyan-50 px-4 py-3 text-sm font-medium text-cyan-800">
      {message}
    </div>
  );
}

function CatalogFilters({ categories, filters, onChange }) {
  const update = (values) => onChange({ ...filters, ...values });
  return (
    <div className="mb-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:grid-cols-4">
      <label className="relative sm:col-span-2">
        <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
        <input
          value={filters.search}
          onChange={(event) => update({ search: event.target.value })}
          placeholder="Search the collection"
          className="w-full rounded-xl bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none ring-cyan-500 focus:ring-2"
        />
      </label>
      <select
        value={filters.category}
        onChange={(event) => update({ category: event.target.value })}
        className="rounded-xl bg-slate-50 px-3 text-sm"
      >
        <option value="">All categories</option>
        {categories.map((category) => (
          <option key={category}>{category}</option>
        ))}
      </select>
      <div className="flex gap-2">
        <select
          value={filters.maxPrice}
          onChange={(event) => update({ maxPrice: event.target.value })}
          className="min-w-0 flex-1 rounded-xl bg-slate-50 px-3 text-sm"
        >
          <option value="">Any price</option>
          <option value="50">Under $50</option>
          <option value="100">Under $100</option>
          <option value="500">Under $500</option>
        </select>
        <button
          onClick={() => update({ available: !filters.available })}
          title="In stock only"
          className={`rounded-xl px-3 ${filters.available ? "bg-cyan-600 text-white" : "bg-slate-100 text-slate-500"}`}
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function ProductGrid({ products, onAdd, onView }) {
  if (!products.length)
    return (
      <div className="py-16 text-center text-slate-500">
        <PackageOpen className="mx-auto mb-3 h-9 w-9" />
        No products match those filters.
      </div>
    );
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onAdd={onAdd}
          onView={onView}
        />
      ))}
    </div>
  );
}

function ProductCard({ product, onAdd, onView }) {
  const icon =
    product.category === "Displays"
      ? "🖥️"
      : product.category === "Peripherals"
        ? "⌨️"
        : "✨";
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <div className="mb-5 grid h-28 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-cyan-50 to-indigo-50 text-4xl">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          icon
        )}
      </div>
      <p className="text-xs font-bold uppercase tracking-wider text-cyan-700">
        {product.category}
      </p>
      <h2 className="mt-1 font-bold text-slate-900">{product.name}</h2>
      <p className="mt-2 line-clamp-2 text-sm text-slate-500">
        {product.description}
      </p>
      <div className="mt-5 flex items-center justify-between">
        <div>
          <p className="text-lg font-black">{money.format(product.price)}</p>
          <p
            className={`text-xs font-bold ${product.stock ? "text-emerald-600" : "text-rose-500"}`}
          >
            {product.stock ? `${product.stock} available` : "Sold out"}
          </p>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => onView(product)}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            disabled={!product.stock}
            onClick={() => onAdd(product)}
            className="rounded-lg bg-slate-950 p-2 text-white disabled:bg-slate-300"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

function CartPanel({ cart, total, busy, onCheckout, onQuantityChange }) {
  return (
    <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/50 lg:sticky lg:top-24">
      <h2 className="flex items-center gap-2 font-bold">
        <ShoppingCart className="h-5 w-5 text-cyan-600" />
        Your cart{" "}
        <span className="ml-auto text-sm text-slate-400">{cart.length}</span>
      </h2>
      <div className="my-4 space-y-3 border-y border-slate-100 py-4">
        {cart.length ? (
          cart.map((item) => (
            <div key={item.id} className="flex gap-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{item.name}</p>
                <p className="text-slate-500">{money.format(item.price)}</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onQuantityChange(item.id, -1)}
                  className="rounded p-1 hover:bg-slate-100"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="w-4 text-center font-bold">
                  {item.quantity}
                </span>
                <button
                  onClick={() => onQuantityChange(item.id, 1)}
                  disabled={item.quantity >= item.stock}
                  className="rounded p-1 hover:bg-slate-100 disabled:text-slate-300"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="py-5 text-center text-sm text-slate-400">
            Your cart is ready when you are.
          </p>
        )}
      </div>
      <div className="flex justify-between text-lg font-black">
        <span>Total</span>
        <span>{money.format(total)}</span>
      </div>
      <button
        disabled={!cart.length || busy}
        onClick={onCheckout}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 py-3 font-bold text-white hover:bg-cyan-700 disabled:bg-slate-300"
      >
        <ShoppingBag className="h-4 w-4" />
        {busy ? "Processing…" : "Mock payment"}
      </button>
      <p className="mt-3 text-center text-xs text-slate-400">
        This is a secure mock checkout.
      </p>
    </aside>
  );
}

function OrderHistory({ orders, busy, onOpen, onCancel }) {
  return (
    <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="font-bold text-slate-900">Your order history</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {orders.map((order) => (
          <button
            key={order.id}
            onClick={() => onOpen(order)}
            className="rounded-xl border border-slate-100 p-4 text-left transition hover:border-cyan-300 hover:shadow-sm"
          >
            <div className="flex justify-between">
              <div>
                <p className="font-bold">Order #{order.id.slice(0, 8)}</p>
                <p className="text-xs text-slate-500">
                  {new Date(order.created_at).toLocaleDateString()}
                </p>
              </div>
              <span className="text-sm font-bold text-slate-700">
                {money.format(order.total_amount)}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs font-bold text-cyan-700">
                {order.refunds?.[0]?.status === "PENDING"
                  ? "REFUND UNDER REVIEW"
                  : order.status}
              </span>
              {order.status === "PAID" && !order.refunds?.length && (
                <span
                  onClick={(event) => {
                    event.stopPropagation();
                    onCancel(order);
                  }}
                  className={`text-xs font-bold text-rose-600 ${busy ? "opacity-50" : ""}`}
                >
                  Request cancellation
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function ProductModal({ product, onAdd, onClose }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <button onClick={onClose} className="float-right text-slate-400">
          <X />
        </button>
        <p className="text-xs font-bold uppercase text-cyan-700">
          {product.category}
        </p>
        <h2 className="mt-2 text-2xl font-black">{product.name}</h2>
        <p className="mt-4 leading-6 text-slate-600">{product.description}</p>
        <div className="mt-6 flex items-center justify-between">
          <span className="text-xl font-black">
            {money.format(product.price)}
          </span>
          <button
            onClick={onAdd}
            className="flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 font-bold text-white"
          >
            <ShoppingCart className="h-4 w-4" />
            Add to cart
          </button>
        </div>
      </div>
    </div>
  );
}

function OrderDetail({ order, onClose }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <button onClick={onClose} className="float-right text-slate-400">
          <X />
        </button>
        <p className="text-xs font-bold uppercase tracking-wider text-cyan-700">
          Order details
        </p>
        <h2 className="mt-1 text-2xl font-black">
          Order #{order.id}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Placed {new Date(order.created_at).toLocaleString()}
        </p>
        <div className="mt-5 space-y-3 border-y border-slate-100 py-4">
          {order.order_items?.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span>
                {item.quantity} × {item.products?.name || "Product"}
              </span>
              <span className="font-bold">
                {money.format(item.quantity * item.unit_price)}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-between text-lg font-black">
          <span>Total paid</span>
          <span>{money.format(order.total_amount)}</span>
        </div>
        <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-600">
          Status:{" "}
          {order.refunds?.[0]?.status === "PENDING"
            ? "Refund request under shop review"
            : order.status}
        </p>
      </div>
    </div>
  );
}
