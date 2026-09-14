import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProductsPage from './pages/ProductsPage.jsx';
import PosPage from './pages/PosPage';
import EcomPage from './pages/EcomPage';

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50 font-sans">
        <Navbar />
        <Routes>
          <Route path="/" element={<ProductsPage />} />
          <Route path="/pos" element={<PosPage />} />
          <Route path="/ecom" element={<EcomPage />} />
        </Routes>
      </div>
    </Router>
  );
}