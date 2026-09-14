import React, { useState, useEffect } from 'react';
import { fetchProducts } from '../services/api';
import { Search, Filter, RefreshCw, Package, Tag } from 'lucide-react';

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  useEffect(() => {
    loadProducts();
  }, [category]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await fetchProducts({
        search,
        category,
        minPrice: minPrice || undefined,
        maxPrice: maxPrice || undefined,
      });
      setProducts(data);
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadProducts();
  };

  const handleReset = () => {
    setSearch('');
    setCategory('');
    setMinPrice('');
    setMaxPrice('');
    loadProducts();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Package className="w-8 h-8 text-blue-600" /> Shared Product Catalog
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Unified inventory shared across POS Terminals and E-Commerce storefronts.
          </p>
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition shadow-sm w-fit"
        >
          <RefreshCw className="w-4 h-4 text-gray-500" /> Reset Filters
        </button>
      </div>

      {/* Search and Filters */}
      <form
        onSubmit={handleSearchSubmit}
        className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"
      >
        <div className="lg:col-span-2 relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="relative">
          <Filter className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">All Categories</option>
            <option value="Peripherals">Peripherals</option>
            <option value="Displays">Displays</option>
            <option value="Accessories">Accessories</option>
          </select>
        </div>

        <div>
          <input
            type="number"
            placeholder="Min Price ($)"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Max Price ($)"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="px-5 py-2 bg-blue-600 text-white font-medium text-sm rounded-lg hover:bg-blue-700 transition"
          >
            Apply
          </button>
        </div>
      </form>

      {/* Product Display Grid */}
      {loading ? (
        <div className="text-center py-16 text-gray-500 flex flex-col items-center gap-2">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
          <span>Loading inventory...</span>
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-700">No products found</h3>
          <p className="text-sm text-gray-500 mt-1">Try modifying your filter options or search term.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((product) => (
            <div
              key={product.id}
              className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
                    <Tag className="w-3 h-3" /> {product.category}
                  </span>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      product.stock > 10 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    Stock: {product.stock}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">{product.name}</h3>
                <p className="text-sm text-gray-500 mb-4 line-clamp-2">{product.description}</p>
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                <div>
                  <span className="text-xs text-gray-400 block">Price</span>
                  <span className="text-xl font-extrabold text-gray-900">${product.price}</span>
                </div>
                <span className="text-xs text-gray-400 font-mono">UUID: {product.id.slice(0, 8)}...</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}