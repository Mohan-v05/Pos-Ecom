import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProductsPage from './pages/ProductsPage.jsx';
import PosPage from './pages/PosPage';
import EcomPage from './pages/EcomPage';

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
        <Navbar />
        <Routes>
          <Route path="/" element={<ProductsPage />} />
          <Route path="/pos" element={<PosPage />} />
          <Route path="/ecom" element={<EcomPage />} />
        </Routes>
        <footer className="border-t border-slate-200 bg-white py-5 text-center text-xs font-medium text-slate-400">Techloom Commerce OS · unified inventory for POS and online orders</footer>
      </div>
    </Router>
  );
}
