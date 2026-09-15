import { useEffect, useState } from "react";
import { Edit3, Package, Plus, Search, Trash2, X } from "lucide-react";
import {
  createProduct,
  deleteProduct,
  fetchProducts,
  uploadProductImage,
  updateProduct,
} from "../services/api";

const blank = {
  name: "",
  description: "",
  category: "Peripherals",
  price: "",
  stock: "",
};

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [form, setForm] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const categoryOptions = [...new Set(products.map((product) => product.category).filter(Boolean))].sort();
  // The default admin view mirrors sales channels by showing active products.
  // Admins can explicitly include deactivated products for audit or restoration.
  const load = async () =>
    setProducts(await fetchProducts({ search, includeInactive: String(showAll) }));

  // Load the inventory table once when the page opens.
  useEffect(() => {
    let active = true;
    fetchProducts({ includeInactive: "false" })
      .then((data) => {
        if (active) setProducts(data);
      })
      .catch(() => {
        if (active) setMessage("Could not load inventory.");
      });
    return () => {
      active = false;
    };
  }, []);
  // Create a product or update the selected product using the same form.
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const payload = {
        ...form,
        price: Number(form.price),
        stock: Number(form.stock),
      };
      delete payload.imageFile;
      const savedProduct = form.id
        ? await updateProduct(form.id, payload)
        : await createProduct(payload);
      if (form.imageFile) await uploadProductImage(savedProduct.id, form.imageFile);
      setForm(null);
      setMessage("Inventory saved successfully.");
      await load();
    } catch (error) {
      setMessage(error.response?.data?.error || "Could not save this product.");
    } finally {
      setBusy(false);
    }
  };
  // Soft delete preserves order history and hides the item from sales channels.
  const remove = async (product) => {
    if (
      !window.confirm(
        `Deactivate “${product.name}”? It will be hidden from sales channels, but order history is kept.`,
      )
    )
      return;
    try {
      await deleteProduct(product.id);
      setMessage("Product deactivated.");
      await load();
    } catch (error) {
      setMessage(
        error.response?.data?.error || "Could not deactivate this product.",
      );
    }
  };
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Page heading and create-product action */}
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-700">
            Admin inventory
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">
            Product control centre
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Manage the live catalog shared by the storefront and register.
          </p>
        </div>
        <button
          onClick={() => setForm(blank)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white"
        >
          <Plus className="h-4 w-4" />
          New product
        </button>
      </div>
      {message && (
        <div className="mb-5 rounded-xl bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
          {message}
        </div>
      )}
      {/* Inventory search */}
      <div className="mb-5 flex gap-3 rounded-2xl border border-slate-200 bg-white p-3">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Find a product"
            className="w-full bg-transparent py-2 pl-9 outline-none"
          />
        </label>
        <button
          onClick={load}
          className="rounded-xl bg-slate-100 px-4 text-sm font-bold"
        >
          Search
        </button>
        <select
          value={showAll ? "all" : "active"}
          onChange={(event) => {
            const includeInactive = event.target.value === "all";
            setShowAll(includeInactive);
            fetchProducts({ search, includeInactive: String(includeInactive) })
              .then(setProducts)
              .catch(() => setMessage("Could not load inventory."));
          }}
          className="rounded-xl bg-slate-100 px-3 text-sm font-bold text-slate-700"
          aria-label="Product visibility"
        >
          <option value="active">Active products</option>
          <option value="all">All products</option>
        </select>
      </div>
      {/* Shared catalog inventory table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="p-4">Product</th>
              <th className="p-4">Category</th>
              <th className="p-4">Price</th>
              <th className="p-4">Stock</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-t border-slate-100">
                <td className="p-4">
                  <p className="font-bold text-slate-800">
                    {product.name}
                    {product.is_active === false && (
                      <span className="ml-2 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        Inactive
                      </span>
                    )}
                  </p>
                  <p className="max-w-sm truncate text-xs text-slate-500">
                    {product.description}
                  </p>
                </td>
                <td className="p-4 text-slate-600">{product.category}</td>
                <td className="p-4 font-bold">
                  ${Number(product.price).toFixed(2)}
                </td>
                <td className="p-4">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-bold ${product.stock ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}
                  >
                    {product.stock}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setForm(product)}
                      className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => remove(product)}
                      className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!products.length && (
          <div className="p-12 text-center text-slate-400">
            <Package className="mx-auto mb-3" />
            No products found.
          </div>
        )}
      </div>
      {/* Product create/edit modal */}
      {form && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <form
            onSubmit={submit}
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-5 flex justify-between">
              <div>
                <h2 className="font-black">
                  {form.id ? "Edit product" : "New product"}
                </h2>
                <p className="text-sm text-slate-500">
                  Changes are live across every sales channel.
                </p>
              </div>
              <button type="button" onClick={() => setForm(null)}>
                <X className="text-slate-400" />
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2 text-sm font-bold">
                Name
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-3 font-normal"
                />
              </label>
              <label className="sm:col-span-2 text-sm font-bold">
                Description
                <textarea
                  value={form.description || ""}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 p-3 font-normal"
                />
              </label>
              <label className="text-sm font-bold">
                Category <span className="font-normal text-slate-400">(select or type a new category)</span>
                <input
                  required
                  list="product-categories"
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 p-3 font-normal"
                  placeholder="e.g. Audio"
                />
                <datalist id="product-categories">
                  {categoryOptions.map((category) => (
                    <option key={category} value={category} />
                  ))}
                </datalist>
              </label>
              <label className="text-sm font-bold">
                Price
                <input
                  required
                  min="0"
                  step="0.01"
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-3 font-normal"
                />
              </label>
              <label className="text-sm font-bold">
                Stock
                <input
                  required
                  min="0"
                  step="1"
                  type="number"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-3 font-normal"
                />
              </label>
              <label className="sm:col-span-2 text-sm font-bold">
                Product image <span className="font-normal text-slate-400">(optional: JPG, PNG, or WebP; max 5 MB)</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => setForm({ ...form, imageFile: event.target.files?.[0] || null })}
                  className="mt-1 block w-full rounded-xl border border-slate-200 p-3 font-normal text-sm"
                />
              </label>
              {(form.imageFile || form.image_url) && (
                <img
                  src={form.imageFile ? URL.createObjectURL(form.imageFile) : form.image_url}
                  alt="Product preview"
                  className="sm:col-span-2 h-36 w-full rounded-xl object-cover"
                />
              )}
            </div>
            <button
              disabled={busy}
              className="mt-6 w-full rounded-xl bg-cyan-600 py-3 font-bold text-white disabled:bg-slate-300"
            >
              {busy ? "Saving…" : "Save product"}
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
