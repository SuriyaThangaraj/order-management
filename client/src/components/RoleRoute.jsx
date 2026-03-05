import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const RoleRoute = ({ children, roles }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return <div>Loading...</div>;
    }

    if (!user) {
        return <Navigate to="/login" />;
    }

    if (roles && !roles.includes(user.role)) {
        // Redirect based on role if unauthorized
        if (user.role === 'admin') return <Navigate to="/admin" />;
        if (user.role === 'waiter') return <Navigate to="/waiter" />;
        if (user.role === 'kitchen') return <Navigate to="/kitchen" />;
        return <Navigate to="/login" />;
    }

    return children;
};

export default RoleRoute;
