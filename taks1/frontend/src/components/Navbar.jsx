import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShoppingBag, Monitor, Package } from 'lucide-react';

export default function Navbar() {
  const location = useLocation();
  const isActive = (path) => location.pathname === path ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800';

  return (
    <nav className="bg-gray-900 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 flex justify-between items-center h-16">
        <span className="font-bold text-xl tracking-wide flex items-center gap-2">
          <Package className="w-6 h-6 text-blue-400" /> TechLoom POS & E-Com
        </span>
        <div className="flex gap-2">
          <Link to="/" className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${isActive('/')}`}>
            <Package className="w-4 h-4" /> Catalog
          </Link>
          <Link to="/pos" className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${isActive('/pos')}`}>
            <Monitor className="w-4 h-4" /> POS Register
          </Link>
          <Link to="/ecom" className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${isActive('/ecom')}`}>
            <ShoppingBag className="w-4 h-4" /> E-Store & Refunds
          </Link>
        </div>
      </div>
    </nav>
  );
}