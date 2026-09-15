import { Link, useLocation } from 'react-router-dom';
import { LayoutGrid, Monitor, Package, ShoppingBag } from 'lucide-react';

const links = [
  { to: '/', label: 'Catalog', icon: LayoutGrid },
  { to: '/pos', label: 'POS Register', icon: Monitor },
  { to: '/ecom', label: 'Online store', icon: ShoppingBag },
];

export default function Navbar() {
  const { pathname } = useLocation();
  return <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/95 text-white backdrop-blur"><nav className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6"><Link to="/" className="flex shrink-0 items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 shadow-lg shadow-cyan-500/20"><Package className="h-5 w-5" /></span><span><span className="block text-sm font-black tracking-tight">Techloom</span><span className="block text-[10px] font-semibold uppercase tracking-[.16em] text-slate-400">Commerce OS</span></span></Link><div className="flex items-center gap-1 overflow-x-auto">{links.map(({ to, label, icon: Icon }) => <Link key={to} to={to} className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition sm:px-4 sm:text-sm ${pathname === to ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}><Icon className="h-4 w-4" /><span className="hidden sm:inline">{label}</span></Link>)}</div></nav></header>;
}
