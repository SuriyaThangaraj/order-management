import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import NotificationModal from '../../components/NotificationModal';

const AdminLogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { login, googleLogin } = useAuth();
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

    useEffect(() => {
        // Initialize Google Sign-In
        if (window.google) {
            window.google.accounts.id.initialize({
                client_id: "998701360087-guniljpa4v3fqkhj3hrrn05aapvid1gdf.apps.googleusercontent.com",
                callback: handleGoogleResponse
            });

            window.google.accounts.id.renderButton(
                document.getElementById("googleSignInDiv"),
                { theme: "outline", size: "large", width: 280 }
            );
        } else {
            showNotification("Error", "Google Sign-In could not be loaded. Please refresh.", "error", "Okay");
        }
    }, []);

    const handleGoogleResponse = async (response) => {
        const result = await googleLogin(response.credential);
        if (result.success) {
            const user = JSON.parse(localStorage.getItem('userInfo'));
            if (user.role === 'admin') navigate('/admin');
            else showNotification("Access Denied", "You are not an admin.", "error", "Okay");
        } else {
            showNotification("Login Failed", result.message, "error", "Try Again");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const result = await login(null, password, email);
        if (result.success) {
            const user = JSON.parse(localStorage.getItem('userInfo'));
            if (user.role === 'admin') navigate('/admin');
            else showNotification("Access Denied", "You are not an admin.", "error", "Okay");
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

            {/* Right Panel: White Background with Form */}
            <div className="tesla-right-panel">
                <div className="tesla-login-box">
                    <div className="tesla-welcome-header">
                        <h2>Welcome</h2>
                        <p>Sign in to Admin Console</p>
                    </div>

                    <form onSubmit={handleSubmit} style={{ marginTop: '20px' }}>
                        <div className="tesla-input-group">
                            <label className="tesla-label">Email</label>
                            <input
                                type="email"
                                className="tesla-input"
                                placeholder="Enter your email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
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

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
                            <a href="/admin/forgot-password" style={{ color: '#e94b11ff', fontSize: '14px', fontWeight: '500' }}>Forgot Password?</a>
                        </div>

                        <button type="submit" className="tesla-btn">
                            Sign In <span style={{ fontSize: '18px' }}>→</span>
                        </button>
                    </form>

                    <div style={{ width: '100%', display: 'flex', alignItems: 'center', margin: '30px 0' }}>
                        <div style={{ flex: 1, height: '1px', backgroundColor: '#444' }}></div>
                        <span style={{ padding: '0 15px', color: '#aaa', fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px' }}>OR</span>
                        <div style={{ flex: 1, height: '1px', backgroundColor: '#444' }}></div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginBottom: '30px' }}>
                        <div id="googleSignInDiv"></div>
                    </div>

                    <div className="tesla-footer-link" style={{ textTransform: 'uppercase', fontSize: '12px', letterSpacing: '1px' }}>
                        YOU DON'T HAVE ACCOUNT ? <a href="/register-admin" style={{ color: '#e94b11ff', fontWeight: 'bold', textDecoration: 'underline' }}> NEW ACCOUNT</a>
                    </div><br></br>
                    <div className="tesla-footer-link" style={{ marginTop: '10px', textAlign: 'center' }}>
                        Are you a Staff? <a href="/login" style={{ color: '#e94b11ff', fontWeight: 'bold' }}>Staff Login</a>
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

export default AdminLogin;
