import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';

// Simple beep function using Web Audio API to avoid external file deps
const playDefaultBeep = () => {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;

        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.5);

        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

        osc.start();
        osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
        console.error("Audio play failed", e);
    }
};

const KitchenDisplay = () => {
    const { logout, user } = useAuth();
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const socketRef = useRef();
    const soundUrlRef = useRef(null);
    const currentAudioRef = useRef(null);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        fetchOrders();
        fetchSettings();

        // Socket connection
        socketRef.current = io(import.meta.env.VITE_SOCKET_URL);

        // Identify for Tenant Isolation
        if (user) {
            socketRef.current.emit('identify', {
                userId: user._id,
                role: user.role,
                username: user.username
            });
        }

        socketRef.current.on('newOrder', (newOrder) => {
            console.log("New order received:", newOrder);
            setOrders(prev => [newOrder, ...prev]);
        });

        socketRef.current.on('orderStatusUpdated', (updatedOrder) => {
            console.log("Order status updated via socket:", updatedOrder);
            setOrders(prev => prev.map(o => o._id === updatedOrder._id ? updatedOrder : o));
        });

        socketRef.current.on('ordersCleared', (data) => {
            console.log("Orders cleared:", data);
            if (data.status === 'READY') {
                setOrders(prev => prev.filter(o => o.status !== 'READY'));
            }
        });

        socketRef.current.on('settingsUpdated', (data) => {
            if (data.type === 'sound') {
                soundUrlRef.current = data.value;
                console.log("Sound setting updated:", data.value);
            }
        });

        return () => {
            socketRef.current.disconnect();
            stopNotification();
        };
    }, []);

    // Effect to manage sound based on order status
    useEffect(() => {
        const hasPendingOrders = orders.some(o => o.status === 'SENT');

        if (hasPendingOrders) {
            // Start looping if not already playing
            if (!currentAudioRef.current || currentAudioRef.current.paused) {
                console.log("Found pending orders, starting loop...");
                playNotification(true);
            }
        } else {
            // Stop if playing
            if (currentAudioRef.current) {
                console.log("No pending orders, stopping sound.");
                stopNotification();
            }
        }
    }, [orders]);

    const fetchSettings = async () => {
        try {
            const { data } = await axios.get('/settings/notification-sound', {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            if (data.soundUrl) {
                soundUrlRef.current = data.soundUrl;
            }
        } catch (error) {
            console.error("Failed to fetch settings", error);
        }
    };



    const stopNotification = () => {
        if (currentAudioRef.current) {
            currentAudioRef.current.pause();
            currentAudioRef.current.currentTime = 0;
            currentAudioRef.current = null;
        }
    };

    const playNotification = (loop = false) => {
        console.log("Attempting to play notification...", loop ? "(Looping)" : "(Once)");
        stopNotification(); // Stop any currently playing sound

        if (soundUrlRef.current) {
            const baseUrl = import.meta.env.VITE_API_URL.replace('/api', '');
            const fullUrl = `${baseUrl}${soundUrlRef.current}`;
            console.log("Playing custom sound from:", fullUrl);

            const audio = new Audio(fullUrl);
            audio.loop = loop;
            currentAudioRef.current = audio;

            audio.play()
                .then(() => console.log("Audio played successfully"))
                .catch(e => {
                    console.error("Custom sound play failed, using default", e);
                    playDefaultBeep();
                });

            // Clean up ref when audio ends
            if (!loop) {
                audio.onended = () => {
                    if (currentAudioRef.current === audio) {
                        currentAudioRef.current = null;
                    }
                };
            }
        } else {
            console.log("No custom sound set, playing default beep");
            playDefaultBeep();
        }
    };

    const fetchOrders = async () => {
        try {
            const { data } = await axios.get('/orders?status=active', {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            // Sort by time
            setOrders(data);
        } catch (error) {
            console.error(error);
        }
    };

    const updateStatus = async (orderId, newStatus) => {
        try {
            const { data } = await axios.put(`/orders/${orderId}`,
                { status: newStatus },
                { headers: { Authorization: `Bearer ${user.token}` } }
            );

            // Optimistic update
            setOrders(prev => prev.map(o => o._id === orderId ? data : o));
        } catch (error) {
            console.error(error);
        }
    };

    const handleClearReady = async () => {
        if (!window.confirm("Are you sure you want to clear all READY orders?")) return;
        try {
            await axios.delete('/orders/ready', {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            // State update handled by socket
        } catch (error) {
            console.error("Failed to clear ready orders", error);
        }
    };

    const handleLogout = () => {
        stopNotification(); // Ensure sound stops on logout
        logout();
        navigate('/login');
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'SENT': return 'var(--primary-red)'; // Blink?
            case 'RECEIVED': return '#FF9800'; // Orange
            case 'PREPARING': return '#2196F3'; // Blue
            case 'READY': return '#4CAF50'; // Green
            default: return '#999';
        }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', color: 'white' }}>

            {/* Top Navigation Bar - Floating Design (Matching Admin) */}
            <header style={{
                background: 'rgba(0, 0, 0, 0.4)',
                backdropFilter: 'blur(15px)',
                WebkitBackdropFilter: 'blur(15px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '50px',
                margin: '20px auto 0',
                width: '95%',
                maxWidth: '1200px',
                height: isMobile ? 'auto' : '80px',
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: isMobile ? '15px' : '0 30px',
                position: 'sticky',
                top: '20px',
                zIndex: 1000,
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                gap: isMobile ? '15px' : '0'
            }}>
                {/* Logo Section */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <img src="/logo.png" alt="Logo" style={{ height: '140px', borderRadius: '12px' }} onError={(e) => e.target.style.display = 'none'} />
                    <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0, color: 'white', letterSpacing: '1px', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                        Tesla <span style={{ color: 'var(--primary)', fontWeight: '300' }}>Kitchen</span>
                    </h1>
                </div>

                {/* Center Actions */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: isMobile ? 'wrap' : 'nowrap', justifyContent: 'center' }}>
                    <button
                        onClick={handleClearReady}
                        title="Clear all READY orders"
                        style={{
                            background: '#FF9800', color: 'white', border: 'none',
                            padding: '10px 20px', borderRadius: '30px', fontWeight: 'bold', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '5px',
                            boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
                        }}
                    >
                        <span>🧹</span> Clear Ready
                    </button>

                    <button
                        onClick={() => playNotification(false)}
                        className="btn-outline"
                        style={{
                            background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.3)',
                            padding: '10px 20px', borderRadius: '30px', cursor: 'pointer', fontSize: '13px'
                        }}
                    >
                        Test Sound
                    </button>

                    <button
                        onClick={stopNotification}
                        style={{
                            background: 'transparent', color: '#ff5252', border: '1px solid currentColor',
                            padding: '10px 20px', borderRadius: '30px', cursor: 'pointer', fontSize: '13px'
                        }}
                    >
                        Stop Sound
                    </button>
                </div>

                {/* Right Side: User & Logout */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    {!isMobile && <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--primary)' }}>{user?.username}</span>}

                    {/* Power / Logout */}
                    <button
                        onClick={handleLogout}
                        title="Logout"
                        style={{
                            background: 'transparent',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            color: 'white',
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '18px',
                            transition: 'all 0.3s',
                            cursor: 'pointer'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.borderColor = 'red'; e.currentTarget.style.color = 'red'; }}
                        onMouseOut={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = 'white'; }}
                    >
                        ⏻
                    </button>
                </div>
            </header>

            {/* Main Content Grid */}
            <div style={{
                flex: 1,
                padding: '30px',
                maxWidth: '1600px',
                margin: '0 auto',
                width: '100%'
            }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? '280px' : '320px'}, 1fr))`,
                    gap: '20px'
                }}>
                    {orders.filter(o => o.status !== 'PAID' && o.status !== 'PENDING_APPROVAL').map(order => (
                        <div key={order._id} className={`card ${order.status === 'SENT' ? 'blink-red' : ''}`} style={{
                            background: 'rgba(20, 20, 20, 0.6)',
                            backdropFilter: 'blur(10px)',
                            WebkitBackdropFilter: 'blur(10px)',
                            border: '1px solid rgba(255,255,255,0.05)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
                                <div>
                                    <span style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--primary)', display: 'block' }}>Table {order.tableNo}</span>
                                    <span style={{ fontSize: '12px', color: '#ccc' }}>By: {order.waiterId?.username || 'Unknown'}</span>
                                </div>
                                <span style={{
                                    padding: '6px 12px',
                                    borderRadius: '4px',
                                    background: getStatusColor(order.status),
                                    color: 'white',
                                    fontSize: '12px',
                                    fontWeight: 'bold',
                                    height: 'fit-content',
                                    boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                                }}>
                                    {order.status}
                                </span>
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                {order.items.map((item, idx) => (
                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '16px', fontWeight: '500', color: 'white' }}>
                                        <span>{item.qty} x {item.name}</span>
                                    </div>
                                ))}

                                {/* Note Display */}
                                {order.note && (
                                    <div style={{ marginTop: '10px', padding: '10px', background: 'rgba(255, 193, 7, 0.1)', fontSize: '14px', borderRadius: '4px', fontStyle: 'italic', borderLeft: '3px solid #ffc107', color: '#ffc107' }}>
                                        📝 "{order.note}"
                                    </div>
                                )}
                                {/* Voice Note Display */}
                                {order.voiceNoteUrl && (
                                    <div style={{ marginTop: '10px' }}>
                                        <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '4px' }}>🎤 Voice Note:</div>
                                        <audio
                                            controls
                                            src={`${import.meta.env.VITE_API_URL.replace('/api', '')}${order.voiceNoteUrl}`}
                                            style={{ width: '100%', height: '30px' }}
                                        />
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '10px' }}>
                                {order.status === 'SENT' && (
                                    <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => updateStatus(order._id, 'RECEIVED')}>
                                        Accept Order
                                    </button>
                                )}
                                {order.status === 'RECEIVED' && (
                                    <button className="btn" style={{ width: '100%', background: '#2196F3', color: 'white' }} onClick={() => updateStatus(order._id, 'PREPARING')}>
                                        Start Preparing
                                    </button>
                                )}
                                {order.status === 'PREPARING' && (
                                    <button className="btn" style={{ width: '100%', background: '#4CAF50', color: 'white', boxShadow: '0 4px 10px rgba(76, 175, 80, 0.3)' }} onClick={() => updateStatus(order._id, 'READY')}>
                                        Mark Ready
                                    </button>
                                )}
                            </div>
                            <div style={{ marginTop: '15px', fontSize: '12px', color: 'rgba(255,255,255,0.3)', textAlign: 'right' }}>
                                {new Date(order.createdAt).toLocaleTimeString()}
                            </div>
                        </div>
                    ))}
                </div>
                {orders.length === 0 && <div style={{ textAlign: 'center', color: '#888', marginTop: '100px', fontSize: '18px' }}>No Active Orders</div>}
            </div>
        </div >
    );
};

export default KitchenDisplay;
