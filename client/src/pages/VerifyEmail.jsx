import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const VerifyEmail = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();
    const [status, setStatus] = useState('Verifying...');
    const [isSuccess, setIsSuccess] = useState(false);

    useEffect(() => {
        const verify = async () => {
            if (!token) {
                setStatus('Invalid link: No token provided.');
                return;
            }

            try {
                const { data } = await axios.post('/auth/verify-email', { token });
                setStatus(data.message);
                setIsSuccess(true);
                // Optional: Redirect after search seconds
                setTimeout(() => {
                    navigate('/admin/login');
                }, 3000);
            } catch (error) {
                setStatus(error.response?.data?.message || 'Verification failed. Token may be invalid or expired.');
            }
        };

        verify();
    }, [token, navigate]);

    return (
        <div className="tesla-split-container">
            {/* Left Panel: Branding */}
            {/* Left Panel: Branding */}
            <div className="tesla-left-panel">
                <div className="tesla-brand-content">
                    <h1>“Run Your Restaurant. We Handle the Systems.”</h1>
                </div>
            </div>

            {/* Right Panel: White Background with Verification Content */}
            <div className="tesla-right-panel">
                <div className="tesla-login-box">
                    <div className="tesla-welcome-header">
                        <h2>Email Verification</h2>
                        <p>Verifying your account status</p>
                    </div>

                    <p style={{
                        fontSize: '18px',
                        fontWeight: 'bold',
                        color: isSuccess ? '#28a745' : (status.includes('Verifying') ? '#666' : '#dc3545'),
                        marginBottom: '20px',
                        textAlign: 'center'
                    }}>
                        {status}
                    </p>

                    {isSuccess && <p style={{ fontSize: '14px', color: '#666', textAlign: 'center' }}>Redirecting to login...</p>}

                    {!isSuccess && !status.includes('Verifying') && (
                        <button
                            className="tesla-btn"
                            onClick={() => navigate('/register-admin')}
                            style={{ marginTop: '20px' }}
                        >
                            Back to Signup
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VerifyEmail;
