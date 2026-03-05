import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import RoleRoute from './components/RoleRoute';
import Login from './pages/Login';
import AdminLogin from './pages/Admin/AdminLogin';
import RegisterAdmin from './pages/Admin/RegisterAdmin';
import ForgotPassword from './pages/Admin/ForgotPassword';
import VerifyEmail from './pages/VerifyEmail';
import ThemeController from './components/ThemeController';

// Admin Pages
import AdminDashboard from './pages/Admin/Dashboard';

// Customer Pages
import CustomerOrderPad from './pages/Customer/CustomerOrderPad';

// Waiter Pages
import WaiterDashboard from './pages/Waiter/Dashboard';

// Kitchen
import KitchenDisplay from './pages/Kitchen/KitchenDisplay';


import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <ThemeController />
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/forgot-password" element={<ForgotPassword />} />
            <Route path="/register-admin" element={<RegisterAdmin />} />
            <Route path="/verify-email" element={<VerifyEmail />} />

            {/* Admin Routes */}
            <Route
              path="/admin/*"
              element={
                <RoleRoute roles={['admin']}>
                  <AdminDashboard />
                </RoleRoute>
              }
            />

            {/* Waiter Routes */}
            <Route
              path="/waiter/*"
              element={
                <RoleRoute roles={['waiter']}>
                  <WaiterDashboard />
                </RoleRoute>
              }
            />

            {/* Kitchen Routes */}
            <Route
              path="/kitchen/*"
              element={
                <RoleRoute roles={['kitchen']}>
                  <KitchenDisplay />
                </RoleRoute>
              }
            />

            {/* Kitchen Routes */}
            <Route
              path="/kitchen/*"
              element={
                <RoleRoute roles={['kitchen']}>
                  <KitchenDisplay />
                </RoleRoute>
              }
            />

            {/* Customer Routes (Public) */}
            <Route path="/customer/table/:tableNo" element={<CustomerOrderPad />} />

            <Route path="/" element={<Navigate to="/login" />} />
          </Routes>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
