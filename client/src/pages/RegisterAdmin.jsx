import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const RegisterAdmin = () => {
    const [formData, setFormData] = useState({ username: '', password: '', email: '' });
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const { signup } = useAuth();
    const navigate = useNavigate();

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');

        const result = await signup(formData.username, formData.email, formData.password);

        if (result.success) {
            setMessage('Admin registered successfully with Firebase!');
            setTimeout(() => {
                navigate('/admin');
            }, 1500);
        } else {
            setError(result.message);
        }
    };

    return (
        <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '40px' }}>
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <img src="/logo.png" alt="Tesla order app " style={{ height: '280px', marginBottom: '10px' }} />
                    <h2 className="page-title" style={{ textAlign: 'center', color: 'var(--primary-red)', margin: 0 }}>Tesla order app </h2>
                </div>
                <h3 style={{ textAlign: 'center', marginBottom: '20px' }}>Admin Registration (Firebase)</h3>

                {error && <div style={{ color: 'red', marginBottom: '20px', textAlign: 'center' }}>{error}</div>}
                {message && <div style={{ color: 'green', marginBottom: '20px', textAlign: 'center' }}>{message}</div>}

                <form onSubmit={handleRegister}>
                    <div className="input-group">
                        <label className="input-label">Username</label>
                        <input
                            type="text"
                            className="form-control"
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            required
                        />
                    </div>
                    <div className="input-group">
                        <label className="input-label">Email Address</label>
                        <input
                            type="email"
                            className="form-control"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            required
                        />
                    </div>
                    <div className="input-group">
                        <label className="input-label">Password</label>
                        <input
                            type="password"
                            className="form-control"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            required
                        />
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                        Register with Email
                    </button>
                </form>

                <div style={{ marginTop: '20px', textAlign: 'center' }}>
                    <a href="/login" style={{ fontSize: '14px', color: 'var(--text-grey)' }}>Back to Login</a>
                </div>
            </div>
        </div>
    );
};

export default RegisterAdmin;

