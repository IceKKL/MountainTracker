import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AuthGuard from './components/AuthGuard';
import Layout from './components/Layout';
import MouseHistoryNavigation from './components/MouseHistoryNavigation';
import { AuthProvider } from './context/AuthContext';
import GroupDetailPage from './pages/GroupDetailPage';
import GroupsPage from './pages/GroupsPage';
import HomePage from './pages/HomePage';
import GearPage from './pages/GearPage';
import KgpPage from './pages/KgpPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import TripDetailsPage from './pages/TripDetailsPage';
import TripsPage from './pages/TripsPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <MouseHistoryNavigation />
        <Routes>
          <Route path="/logowanie" element={<LoginPage />} />
          <Route path="/rejestracja" element={<RegisterPage />} />
          <Route element={<AuthGuard />}>
            <Route element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="sprzet" element={<GearPage />} />
              <Route path="wycieczki" element={<TripsPage />} />
              <Route path="wycieczki/:idSlug" element={<TripDetailsPage />} />
              <Route path="grupy" element={<GroupsPage />} />
              <Route path="grupy/:id" element={<GroupDetailPage />} />
              <Route path="kgp" element={<KgpPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
