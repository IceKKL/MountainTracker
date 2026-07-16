import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AuthGuard() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <div className="h-8 w-48 animate-pulse rounded-[8px] bg-[var(--border)]" />
      </div>
    );
  }

  if (!user) return <Navigate to="/logowanie" replace />;

  return <Outlet />;
}
