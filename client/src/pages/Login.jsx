import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import NotificationModal from '../components/NotificationModal';

const StaffLogin = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    // Notification State
    const [notification, setNotification] = useState({
        isOpen: false,
        title: '',
        message: '',
        type: 'info',
        actionLabel: 'Okay',
        onAction: null
    });

    const closeNotification = () => {
        setNotification(prev => ({ ...prev, isOpen: false }));
    };

    const showNotification = (title, message, type = 'info', actionLabel = 'Okay', onAction = null) => {
        setNotification({
            isOpen: true,
            title,
            message,
            type,
            actionLabel,
            onAction: onAction || closeNotification
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const result = await login(username, password);

        if (result.success) {
            const user = JSON.parse(localStorage.getItem('userInfo'));
            if (user.role === 'waiter') navigate('/waiter');
            else if (user.role === 'kitchen') navigate('/kitchen');
            else if (user.role === 'admin') navigate('/admin');
        } else {
            showNotification("Login Failed", result.message, "error", "Try Again");
        }
    };

    return (
        <div className="tesla-split-container">
            {/* Left Panel: Branding */}
            <div className="tesla-left-panel">
                <div className="tesla-brand-content">
                    <h1>“Run Your Restaurant. We Handle the Systems.”</h1>
                </div>
            </div>

            {/* Right Panel: Floating Card */}
            <div className="tesla-right-panel">
                <div className="tesla-login-box">
                    <div className="tesla-welcome-header">
                        <h2>Staff Portal</h2>
                        <p>Sign in to continue</p>
                    </div>

                    <form onSubmit={handleSubmit} style={{ marginTop: '20px' }}>
                        <div className="tesla-input-group">
                            <label className="tesla-label">Username</label>
                            <input
                                type="text"
                                className="tesla-input"
                                placeholder="Enter your username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                            />
                        </div>
                        <div className="tesla-input-group">
                            <label className="tesla-label">Password</label>
                            <input
                                type="password"
                                className="tesla-input"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        <button type="submit" className="tesla-btn" style={{ marginTop: '20px' }}>
                            Log In <span style={{ fontSize: '18px', marginLeft: '10px' }}>→</span>
                        </button>
                    </form>

                    <div className="tesla-footer-link" style={{ marginTop: '30px' }}>
                        Are you an Admin? <a href="/admin/login" style={{ color: '#E82127', fontWeight: 'bold' }}>Login here</a>
                    </div>
                </div>
            </div>

            {/* Error Notification Modal */}
            <NotificationModal
                isOpen={notification.isOpen}
                onClose={closeNotification}
                title={notification.title}
                message={notification.message}
                type={notification.type}
                actionLabel={notification.actionLabel}
                onAction={notification.onAction}
            />
        </div>
    );
};

export default StaffLogin;
