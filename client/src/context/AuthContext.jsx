import { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        const userInfo = JSON.parse(localStorage.getItem('userInfo'));
        if (userInfo) {
            setUser(userInfo);
        }
        setLoading(false);
    }, []);

    // Socket Connection Logic
    useEffect(() => {
        let newSocket;
        if (user) {
            import('socket.io-client').then(({ default: io }) => {
                newSocket = io(import.meta.env.VITE_SOCKET_URL);
                setSocket(newSocket);

                newSocket.on('connect', () => {
                    newSocket.emit('identify', {
                        userId: user._id,
                        username: user.username,
                        role: user.role
                    });
                });
            });
        }

        return () => {
            if (newSocket) newSocket.disconnect();
        };
    }, [user]);

    const login = async (username, password, email = null) => {
        try {
            const { data } = await axios.post('/auth/login', {
                username,
                password,
                email
            });
            localStorage.setItem('userInfo', JSON.stringify(data));
            setUser(data);
            return { success: true };
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Login failed'
            };
        }
    };

    const googleLogin = async (token) => {
        try {
            const { data } = await axios.post('/auth/google-login', { token });
            localStorage.setItem('userInfo', JSON.stringify(data));
            setUser(data);
            return { success: true };
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Google Login failed'
            };
        }
    };

    const googleSignup = async (token) => {
        try {
            const { data } = await axios.post('/auth/google-signup', { token });
            // For sign up, we don't necessarily log them in auto, but we can, or just return success
            return { success: true, message: data.message };
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Google Signup failed'
            };
        }
    };

    const signup = async (username, email, password) => {
        try {
            const { data } = await axios.post('/auth/signup', {
                name: username, // Mapping to backend expectation
                email,
                password
            });
            return { success: true, message: data.message };
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || error.message || 'Signup failed'
            };
        }
    };

    const sendOTP = async (email, type = 'login') => {
        try {
            const { data } = await axios.post('/auth/send-otp', { email, type });
            return { success: true, message: data.message };
        } catch (error) {
            console.error("OTP Error:", error);
            return {
                success: false,
                message: error.response?.data?.message || error.message || 'Failed to send OTP'
            };
        }
    };

    const verifyOTP = async (email, otp, type = 'login') => {
        try {
            const { data } = await axios.post('/auth/verify-otp', { email, otp, type });
            return { success: true, message: data.message };
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Invalid OTP'
            };
        }
    };

    const logout = async () => {
        try {
            localStorage.removeItem('userInfo');
            setUser(null);
            if (socket) socket.disconnect();
        } catch (error) {
            console.error("Logout error", error);
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            login,
            googleLogin,
            googleSignup,
            logout,
            signup,
            sendOTP,
            verifyOTP,
            loading,
            socket
        }}>
            {children}
        </AuthContext.Provider>
    );
};

