import { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import MenuManage from './MenuManage';
import StaffManage from './StaffManage';
import Analytics from './Analytics';
import Settings from './Settings';
import AdminOrders from './AdminOrders';
import ShortCodeList from './ShortCodeList';
import FeedbackList from './FeedbackList';

import io from 'socket.io-client';

const AdminDashboard = () => {
    const { logout, user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const [hasNewFeedback, setHasNewFeedback] = useState(false);
    const [printJob, setPrintJob] = useState(null);

    // Socket for Printing & Feedback
    useEffect(() => {
        const socket = io(import.meta.env.VITE_SOCKET_URL);

        // Identify for Tenant Isolation
        if (user) {
            socket.emit('identify', {
                userId: user._id,
                role: user.role,
                username: user.username
            });
        }

        socket.on('printBill', (billData) => {
            console.log("Received Print Job:", billData);
            setPrintJob(billData);
            setTimeout(() => {
                window.print();
            }, 500);
        });

        socket.on('newFeedback', (data) => {
            console.log("New Feedback Received:", data);

            // Play Notification Sound
            const audio = new Audio('/sounds/notification.mp3'); // Assuming file exists or use default beep logic
            // Fallback beep if file missing
            try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, ctx.currentTime);
                osc.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.5);
            } catch (e) { console.error(e); }

            setHasNewFeedback(true);
        });

        return () => socket.disconnect();
    }, []);

    // Clear notification when visiting feedback page
    useEffect(() => {
        if (location.pathname === '/admin/feedback') {
            setHasNewFeedback(false);
        }
    }, [location.pathname]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // Navigation Items with Icons
    const navItems = [
        { path: '/admin', label: 'Menu', icon: <IconMenu /> },
        { path: '/admin/orders', label: 'Orders', icon: <IconOrders /> },
        { path: '/admin/staff', label: 'Staff', icon: <IconStaff /> },
        { path: '/admin/short-codes', label: 'Short Codes', icon: <IconShortCodes /> },
        {
            path: '/admin/feedback',
            label: 'Feedback',
            icon: (
                <div style={{ position: 'relative' }}>
                    <IconFeedback />
                    {hasNewFeedback && (
                        <div style={{
                            position: 'absolute', top: -2, right: -2,
                            width: '10px', height: '10px',
                            background: '#ff0000', borderRadius: '50%',
                            border: '2px solid white'
                        }} />
                    )}
                </div>
            )
        }, // NEW
        { path: '/admin/settings', label: 'Settings', icon: <IconSettings /> }
    ];

    if (printJob) {
        return (
            <div className="print-only">
                <div style={{ padding: '20px', fontFamily: 'monospace', width: '300px', margin: '0 auto' }}>
                    <h2 style={{ textAlign: 'center' }}>Tesla Hotel</h2>
                    <p style={{ textAlign: 'center' }}>Table: {printJob.tableNo}</p>
                    <p style={{ textAlign: 'center' }}>Waiter: {printJob.waiterName}</p>
                    <p style={{ textAlign: 'center' }}>Date: {new Date(printJob.timestamp).toLocaleString()}</p>
                    <hr />
                    <table style={{ width: '100%', fontSize: '12px' }}>
                        <tbody>
                            {printJob.items.map((item, i) => (
                                <tr key={i}>
                                    <td>{item.qty} x {item.name}</td>
                                    <td style={{ textAlign: 'right' }}>{item.total}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <hr />
                    <h3 style={{ textAlign: 'right' }}>Total: {printJob.grandTotal}</h3>
                    <div style={{ textAlign: 'center', marginTop: '20px' }}>
                        <p>Thank You!</p>
                    </div>
                </div>
                <button className="no-print" onClick={() => setPrintJob(null)} style={{ position: 'fixed', top: 10, right: 10 }}>Close Print View</button>
            </div>
        );
    }

    return (
        <div className="admin-layout" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', color: 'white' }} >

            {/* Top Navigation Bar - Floating Design */}
            <header style={{
                background: 'rgba(var(--nav-rgb, 0, 0, 0), var(--nav-opacity, 0.4))', // Dynamic Color + Opacity
                backdropFilter: 'blur(15px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '50px', // Pill shape container
                margin: '20px auto 0', // Floating from top
                width: '95%',
                maxWidth: '1200px',
                height: '80px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 30px',
                position: 'sticky',
                top: '20px',
                zIndex: 1000,
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
            }}>
                {/* Logo Section */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <img src="/logo.png" alt="Logo" style={{ height: '140px', borderRadius: '12px' }} onError={(e) => e.target.style.display = 'none'} />
                    <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0, color: 'white', letterSpacing: '1px', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                        Tesla <span style={{ color: 'var(--primary)', fontWeight: '300' }}>Manager</span>
                    </h1>
                </div>

                {/* Navigation Links - Active Pill Animation */}
                <nav style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {navItems.map(item => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: isActive ? '10px' : '0',
                                    padding: isActive ? '12px 25px' : '12px',
                                    borderRadius: '50px',
                                    background: isActive ? 'var(--primary)' : 'transparent',
                                    color: 'white',
                                    textDecoration: 'none',
                                    transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)', // Bouncy effect
                                    boxShadow: isActive ? '0 4px 15px rgba(255, 0, 0, 0.4)' : 'none',
                                    minWidth: isActive ? '140px' : '50px', // Expand when active
                                    overflow: 'hidden',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                <span style={{ fontSize: '22px' }}>{item.icon}</span>
                                <span style={{
                                    fontSize: '15px',
                                    fontWeight: '600',
                                    opacity: isActive ? 1 : 0,
                                    width: isActive ? 'auto' : 0,
                                    transition: 'opacity 0.2s',
                                    display: 'inline-block'
                                }}>
                                    {isActive && item.label}
                                </span>
                            </Link>
                        )
                    })}
                </nav>

                {/* Right Side: Power / Logout */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>

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
                            transition: 'all 0.3s'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.borderColor = 'red'; e.currentTarget.style.color = 'red'; }}
                        onMouseOut={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = 'white'; }}
                    >
                        ⏻
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <div className="main-content" style={{
                flex: 1,
                padding: '30px',
                maxWidth: '1600px',
                margin: '0 auto',
                width: '100%'
            }}>
                <Routes>
                    <Route path="/" element={<MenuManage />} />
                    <Route path="staff" element={<StaffManage />} />
                    <Route path="orders" element={<AdminOrders />} />
                    <Route path="analytics" element={<Analytics />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="short-codes" element={<ShortCodeList />} />
                    <Route path="feedback" element={<FeedbackList />} />
                </Routes>
            </div>
        </div >
    );
};

// Icons (SVG)
const IconMenu = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>;
const IconOrders = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>;
const IconStaff = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>;
const IconSettings = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>;
const IconShortCodes = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 17l6-6-6-6"></path><path d="M12 19h8"></path></svg>;
const IconFeedback = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>;

export default AdminDashboard;
