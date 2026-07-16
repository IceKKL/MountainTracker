import { LogOut, Mountain } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import TopoBackground from './TopoBackground';

const links = [
  { to: '/', label: 'Strona główna', end: true },
  { to: '/sprzet', label: 'Sprzęt', end: false },
  { to: '/wycieczki', label: 'Wycieczki', end: false },
  { to: '/grupy', label: 'Grupy', end: false },
  { to: '/kgp', label: 'KGP Tracker', end: false },
];

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="app">
      <TopoBackground />
      <header className="header">
        <div className="header-inner">
          <NavLink to="/" className="logo">
            <Mountain size={24} />
            <span>Mountain Tracker</span>
          </NavLink>
          <nav className="nav flex-1 justify-center">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          {user && (
            <div className="ml-auto flex items-center gap-3">
              <span className="hidden text-sm text-[var(--text-muted)] sm:inline">
                {user.name}{' '}
                <span className="text-[var(--stone)]">@{user.username}</span>
              </span>
              <button
                type="button"
                onClick={logout}
                className="flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-sm text-[var(--text-muted)] transition-colors hover:bg-[rgba(44,42,38,0.05)] hover:text-[var(--text)]"
                title="Wyloguj"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">Wyloguj</span>
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
