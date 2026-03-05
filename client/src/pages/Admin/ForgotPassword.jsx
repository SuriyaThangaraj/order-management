import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

import NotificationModal from '../../components/NotificationModal';

const ForgotPassword = () => {
    const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: New Password
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

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

    const { sendOTP, verifyOTP } = useAuth();
    const navigate = useNavigate();

    const handleSendOTP = async (e) => {
        e.preventDefault();
        setLoading(true);

        // First check if user exists (handled by backend or context, 
        // effectively we just try to send OTP if email exists)
        // Here we reuse sendOTP which works for any valid email.
        // Ideally backend should check if email is registered first 
        // to prevent spam but for now we proceed.

        const result = await sendOTP(email, 'reset');
        setLoading(false);
        if (result.success) {
            showNotification(
                'OTP Sent',
                `A verification code has been sent to ${email}.`,
                'success',
                'Enter Code',
                () => {
                    closeNotification();
                    setStep(2);
                }
            );
        } else {
            showNotification('Error', result.message, 'error', 'Try Again');
        }
    };

    const handleVerifyOTP = async (e) => {
        e.preventDefault();
        setLoading(true);
        const result = await verifyOTP(email, otp, 'reset');
        setLoading(false);
        if (result.success) {
            showNotification(
                'Verified',
                'OTP Verified Successfully. You can now reset your password.',
                'success',
                'Set New Password',
                () => {
                    closeNotification();
                    setStep(3);
                }
            );
        } else {
            showNotification('Verification Failed', result.message, 'error', 'Try Again');
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            return showNotification('Error', 'Passwords do not match', 'error', 'Fix It');
        }

        setLoading(true);
        try {
            await axios.put('/auth/reset-password-email', {
                email,
                newPassword,
                otp
            });

            showNotification(
                'Success!',
                'Your password has been reset successfully.',
                'success',
                'Back to Login',
                () => {
                    navigate('/admin/login');
                }
            );

        } catch (error) {
            const msg = error.response?.data?.message || 'Failed to reset password';
            showNotification('Error', msg, 'error', 'Try Again');
        }
        setLoading(false);
    };

    return (
        <div className="tesla-split-container">
            {/* Left Panel: Red Background with Stats */}
            {/* Left Panel: Branding */}
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
                        <h2>Reset Password</h2>
                        <p>Enter your details to reset</p>
                    </div>

                    {/* Old Error/Message Displays Removed - Replaced by Modal */}


                    {step === 1 && (
                        <form onSubmit={handleSendOTP}>
                            <div style={{ marginBottom: '20px', textAlign: 'center', color: '#666', fontSize: '14px' }}>
                                Enter your email to receive a verification code.
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
                            <button type="submit" className="tesla-btn" disabled={loading}>
                                {loading ? 'Sending...' : 'Send OTP'}
                            </button>
                        </form>
                    )}

                    {step === 2 && (
                        <form onSubmit={handleVerifyOTP}>
                            <div style={{ textAlign: 'center', marginBottom: '20px', color: '#666', fontSize: '14px' }}>
                                OTP sent to <strong>{email}</strong>
                            </div>
                            <div className="tesla-input-group">
                                <label className="tesla-label">Enter 6-digit OTP</label>
                                <input
                                    type="text"
                                    className="tesla-input"
                                    placeholder="X X X X X X"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    maxLength="6"
                                    required
                                />
                            </div>
                            <button type="submit" className="tesla-btn" disabled={loading}>
                                {loading ? 'Verifying...' : 'Verify OTP'}
                            </button>
                        </form>
                    )}

                    {step === 3 && (
                        <form onSubmit={handleResetPassword}>
                            <div className="tesla-input-group">
                                <label className="tesla-label">New Password</label>
                                <input
                                    type="password"
                                    className="tesla-input"
                                    placeholder="Enter new password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="tesla-input-group">
                                <label className="tesla-label">Confirm Password</label>
                                <input
                                    type="password"
                                    className="tesla-input"
                                    placeholder="Confirm new password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <button type="submit" className="tesla-btn" disabled={loading}>
                                {loading ? 'Resetting...' : 'Reset Password'}
                            </button>
                        </form>
                    )}

                    <div className="tesla-footer-link">
                        Remembered your password? <a href="/admin/login" style={{ color: '#E82127', fontWeight: 'bold' }}>Back to Login</a>
                    </div>
                </div>
            </div>

            {/* Notification Modal */}
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

export default ForgotPassword;
