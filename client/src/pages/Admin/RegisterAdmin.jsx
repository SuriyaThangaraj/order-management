import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import NotificationModal from '../../components/NotificationModal';

const RegisterAdmin = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const { signup, googleSignup } = useAuth();
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
        // Initialize Google Sign-In for Signup
        if (window.google) {
            window.google.accounts.id.initialize({
                client_id: "998701360087-guniljpa4v3fqkhj3hrm05aapvid1gdf.apps.googleusercontent.com",
                callback: handleGoogleResponse
            });

            window.google.accounts.id.renderButton(
                document.getElementById("googleSignUpDiv"),
                { theme: "outline", size: "large", width: 280, text: "signup_with" }
            );
        } else {
            showNotification("Error", "Google Sign-In could not be loaded. Please refresh.", "error", "Okay");
        }
    }, [message]); // re-run if message changes because form hides, but let's just let it be

    const handleGoogleResponse = async (response) => {
        setLoading(true);
        const result = await googleSignup(response.credential);
        setLoading(false);
        if (result.success) {
            setMessage(result.message);
            showNotification("Success!", result.message, "success", "Go to Login", () => navigate('/admin/login'));
        } else {
            showNotification("Signup Failed", result.message, "error", "Try Again");
        }
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        setMessage('');
        setLoading(true);

        const result = await signup(name, email, password);
        setLoading(false);

        if (result.success) {
            setMessage(result.message);
            showNotification("Success!", result.message, "success", "Go to Login", () => navigate('/admin/login'));
        } else {
            showNotification("Signup Failed", result.message, "error", "Try Again");
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
                        <h2>Create Account</h2>
                        <p>Start your journey with our service</p>
                    </div>

                    {message ? (
                        <div style={{ textAlign: 'center', padding: '20px' }}>
                            <h3 style={{ color: '#4CAF50', marginBottom: '10px', fontSize: '24px' }}>Signup Successful!</h3>
                            <p style={{ color: '#aaa', marginBottom: '30px' }}>{message}</p>
                            <button className="tesla-btn" onClick={() => navigate('/admin/login')}>
                                Go to Login
                            </button>
                        </div>
                    ) : (
                        <>
                            <form onSubmit={handleSignup}>
                                <div className="tesla-input-group">
                                    <label className="tesla-label">Name (Username)</label>
                                    <input
                                        type="text"
                                        className="tesla-input"
                                        placeholder="Enter your name"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="tesla-input-group">
                                    <label className="tesla-label">Email Address</label>
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
                                        placeholder="Create a password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                </div>
                                <button type="submit" className="tesla-btn" disabled={loading}>
                                    {loading ? 'SIGNING UP...' : 'SIGN UP'}
                                </button>
                            </form>

                            <div style={{ width: '100%', display: 'flex', alignItems: 'center', margin: '30px 0' }}>
                                <div style={{ flex: 1, height: '1px', backgroundColor: '#444' }}></div>
                                <span style={{ padding: '0 15px', color: '#aaa', fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px' }}>OR</span>
                                <div style={{ flex: 1, height: '1px', backgroundColor: '#444' }}></div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginBottom: '20px' }}>
                                <div id="googleSignUpDiv"></div>
                            </div>
                        </>
                    )}

                    {!message && (
                        <div className="tesla-footer-link" style={{ marginTop: '10px' }}>
                            ALREADY HAVE AN ACCOUNT? <a href="/admin/login" style={{ color: '#1db751ff', fontWeight: 'bold' }}>LOGIN HERE</a>
                        </div>
                    )}
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

export default RegisterAdmin;
