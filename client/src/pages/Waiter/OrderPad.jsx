import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import io from 'socket.io-client';
import NotificationModal from '../../components/NotificationModal';

// Simple beep for notification (Copied from KitchenDisplay)
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

const OrderPad = () => {
    const { tableNo } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();

    // --- State ---
    const [menu, setMenu] = useState([]);
    const [filteredMenu, setFilteredMenu] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('All');

    const [runningOrders, setRunningOrders] = useState([]); // Confirmed orders
    const [pendingOrders, setPendingOrders] = useState([]); // Requests waiting approval
    const [currentCart, setCurrentCart] = useState([]); // New items to add

    const [isLoading, setIsLoading] = useState(true);
    const [showBill, setShowBill] = useState(false); // Bill Modal State
    const socketRef = useRef();

    // Search & Short Code State
    const [searchQuery, setSearchQuery] = useState('');
    const [shortCode, setShortCode] = useState('');
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [isCartOpen, setIsCartOpen] = useState(false); // For mobile cart drawer
    const [showShortCodes, setShowShortCodes] = useState(false); // Short Code Modal State
    const [lastAddedMsg, setLastAddedMsg] = useState(null); // Feedback for Short Code Input

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

    // Sound Ref
    const audioIntervalRef = useRef(null);
    const hasPendingRef = useRef(false);

    // --- Effects ---

    // Handle Resize
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Socket Connection
    useEffect(() => {
        socketRef.current = io(import.meta.env.VITE_SOCKET_URL);

        // Identify for Tenant Isolation
        if (user) {
            socketRef.current.emit('identify', {
                userId: user._id,
                role: user.role,
                username: user.username
            });
        }

        // Listen for order updates
        socketRef.current.on('orderStatusUpdated', (updatedOrder) => {
            if (updatedOrder.tableNo == tableNo) {
                fetchRunningOrders();
            }
        });

        // Listen for NEW orders (Kitchen/Waiter confirmed)
        socketRef.current.on('newOrder', (newOrder) => {
            if (newOrder.tableNo == tableNo) {
                fetchRunningOrders();
            }
        });

        // Listen for Customer REQUESTS
        socketRef.current.on('newCustomerRequest', (order) => {
            if (order.tableNo == tableNo) {
                fetchRunningOrders(); // Re-fetch to separate pending vs active
            }
        });

        socketRef.current.on('menuUpdated', () => fetchMenu());

        socketRef.current.on('customerOrderRejected', (data) => {
            if (data.tableNo == tableNo) fetchRunningOrders();
        });

        return () => {
            socketRef.current.disconnect();
        };
    }, [tableNo]);

    // Sound Logic Effect
    useEffect(() => {
        hasPendingRef.current = pendingOrders.length > 0;

        if (pendingOrders.length > 0) {
            // Start looping sound if not already running
            if (!audioIntervalRef.current) {
                console.log("Starting Waiter Notification Sound...");
                playDefaultBeep(); // Play immediately
                audioIntervalRef.current = setInterval(() => {
                    playDefaultBeep();
                }, 3000); // Loop every 3 seconds
            }
        } else {
            // Stop sound
            if (audioIntervalRef.current) {
                console.log("Stopping Waiter Notification Sound.");
                clearInterval(audioIntervalRef.current);
                audioIntervalRef.current = null;
            }
        }

        return () => {
            if (audioIntervalRef.current) {
                clearInterval(audioIntervalRef.current);
                audioIntervalRef.current = null;
            }
        }
    }, [pendingOrders]);

    // Initial Data Fetch
    useEffect(() => {
        const initData = async () => {
            // Ensure user is present before fetching protected routes
            if (user?.token) {
                await Promise.all([fetchMenu(), fetchRunningOrders()]);
            } else {
                // If checking public menu is allowed, fetchMenu only? 
                // For now assuming protected.
            }
            setIsLoading(false);
        };
        initData();
    }, [user]); // Add user dep to retry if auth loads late

    // Filtering Logic
    useEffect(() => {
        let items = menu;

        // Filter by Category
        if (selectedCategory !== 'All') {
            items = items.filter(item => item.category === selectedCategory);
        }

        // Filter by Search Query (Name)
        if (searchQuery) {
            items = items.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));
        }

        // Filter by Short Code
        if (shortCode) {
            items = items.filter(item =>
                item.name.toLowerCase().includes(shortCode.toLowerCase()) ||
                (item.shortCode && item.shortCode.toLowerCase() === shortCode.toLowerCase()) ||
                (item.code && item.code.toLowerCase().includes(shortCode.toLowerCase()))
            );
        }

        setFilteredMenu(items);
    }, [selectedCategory, menu, searchQuery, shortCode]);

    // --- Helper Functions ---

    const fetchMenu = async () => {
        try {
            const { data } = await axios.get('/menu', {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            const availableItems = data.filter(item => item.isAvailable);
            setMenu(availableItems);

            const cats = ['All', ...new Set(availableItems.map(item => item.category))];
            setCategories(cats);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchRunningOrders = async () => {
        if (!user?.token) return;
        try {
            // Fetch ALL orders (active + pending)
            const { data } = await axios.get('/orders?status=active', {
                headers: { Authorization: `Bearer ${user.token}` }
            });

            const tableOrders = data.filter(o => o.tableNo == tableNo && o.status !== 'PAID');

            if (tableOrders.length > 0) {
                const myId = String(user._id || user.id);
            }

            setRunningOrders(tableOrders.filter(o => o.status !== 'PENDING_APPROVAL'));
            setPendingOrders(tableOrders.filter(o => o.status === 'PENDING_APPROVAL'));

        } catch (error) {
            console.error(error);
        }
    };

    const addToCart = (item) => {
        const existing = currentCart.find(c => c.menuId === item._id);
        if (existing) {
            setCurrentCart(currentCart.map(c =>
                c.menuId === item._id ? { ...c, qty: c.qty + 1 } : c
            ));
        } else {
            setCurrentCart([...currentCart, {
                menuId: item._id,
                name: item.name,
                price: item.price,
                qty: 1,
                image: item.imageUrl
            }]);
        }
    };

    const removeFromCart = (menuId) => {
        setCurrentCart(currentCart.filter(c => c.menuId !== menuId));
    };

    const [isPlacing, setIsPlacing] = useState(false);

    const handleApprove = async (orderId) => {
        try {
            await axios.put(`/orders/${orderId}`, { status: 'SENT' }, {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            // Socket will update UI from server event
        } catch (error) {
            console.error(error);
            console.error(error);
            showNotification("Error", "Failed to approve order", "error");
        }
    };

    const handleReject = async (orderId) => {
        if (!window.confirm("Reject this customer request?")) return;
        try {
            await axios.delete(`/orders/${orderId}`, {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            // Refresh to remove item
            await fetchRunningOrders();
        } catch (error) {
            console.error(error);
            console.error(error);
            showNotification("Error", "Failed to reject order", "error");
        }
    };

    const placeOrder = async () => {
        if (currentCart.length === 0) return;
        setIsPlacing(true);

        try {
            const total = currentCart.reduce((acc, item) => acc + (item.price * item.qty), 0);

            await axios.post('/orders', {
                tableNo,
                items: currentCart,
                totalAmount: total
            }, {
                headers: { Authorization: `Bearer ${user.token}` }
            });

            setCurrentCart([]);
            await fetchRunningOrders();
        } catch (error) {
            console.error(error);
            console.error(error);
            showNotification("Error", `Failed to place order: ${error.response?.data?.message || error.message}`, "error");
        } finally {
            setIsPlacing(false);
        }
    };

    const finishTable = async () => {
        if (!window.confirm(`Finish Table ${tableNo}? This will mark all orders as PAID.`)) return;

        try {
            await axios.put(`/orders/finish/${tableNo}`, { printBill: true }, {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            navigate('/waiter');
        } catch (error) {
            console.error(error);
            console.error(error);
            showNotification("Error", "Error finishing table", "error");
        }
    };

    // Totals
    const runningTotal = runningOrders.reduce((acc, order) => acc + order.totalAmount, 0);
    const cartTotal = currentCart.reduce((acc, item) => acc + (item.price * item.qty), 0);
    const grandTotal = runningTotal + cartTotal;

    const getStatusStyle = (status) => {
        switch (status) {
            case 'PENDING_APPROVAL': return { bg: 'rgba(255, 193, 7, 0.2)', color: '#ffc107', border: '#ffc107', label: 'Waiting Approval' };
            case 'SENT': return { bg: 'rgba(33, 150, 243, 0.2)', color: '#2196f3', border: '#2196f3', label: 'Sent to Kitchen' };
            case 'PREPARING': return { bg: 'rgba(255, 152, 0, 0.2)', color: '#ff9800', border: '#ff9800', label: 'Preparing...' };
            case 'READY': return { bg: 'rgba(76, 175, 80, 0.2)', color: '#4caf50', border: '#4caf50', label: 'Ready to Serve!' };
            case 'SERVED': return { bg: 'rgba(158, 158, 158, 0.2)', color: '#9e9e9e', border: '#9e9e9e', label: 'Served' };
            default: return { bg: 'rgba(255, 255, 255, 0.1)', color: '#fff', border: '#777', label: status };
        }
    };

    if (isLoading) return <div style={{ padding: '20px', color: 'white' }}>Loading Menu...</div>;

    // --- RENDER ---
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'transparent', fontFamily: 'var(--font-family)' }}>
            <NotificationModal
                isOpen={notification.isOpen}
                onClose={closeNotification}
                title={notification.title}
                message={notification.message}
                type={notification.type}
                actionLabel={notification.actionLabel}
                onAction={notification.onAction}
            />

            {/* 1. TOP BAR */}
            <div style={{
                minHeight: '60px',
                background: 'rgba(0, 0, 0, 0.4)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                alignItems: isMobile ? 'stretch' : 'center',
                padding: isMobile ? '10px' : '0 20px',
                gap: '10px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                zIndex: 10
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '18px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button onClick={() => {
                            if (currentCart.length > 0 && !window.confirm("Leaving will clear your cart. Use 'Right Click > Open Link in New Tab' to keep cart.")) return;
                            navigate('/waiter');
                        }} style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer', color: 'white' }}>⬅</button>
                        <span>Table {tableNo}</span>
                    </div>
                    {isMobile && <div style={{ fontSize: '12px', color: '#ccc' }}>{user?.username}</div>}
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '10px' }}>
                    <input
                        type="text"
                        placeholder="Search item..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            flex: 1,
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: '1px solid #444',
                            background: 'rgba(0, 0, 0, 0.3)',
                            color: 'white',
                            fontSize: '14px',
                            outline: 'none'
                        }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', position: 'relative' }}>
                        <input
                            type="text"
                            placeholder="Short Code"
                            value={shortCode}
                            onChange={(e) => setShortCode(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && shortCode.trim()) {
                                    const item = menu.find(i => (i.shortCode && i.shortCode.trim().toLowerCase() === shortCode.trim().toLowerCase()) || (i.code && i.code.trim().toLowerCase() === shortCode.trim().toLowerCase()));
                                    if (item) {
                                        addToCart(item);
                                        setShortCode(''); // Clear input
                                        setLastAddedMsg(`Added: ${item.name}`);
                                        setTimeout(() => setLastAddedMsg(null), 2000);
                                    } else {
                                        // Optional: Feedback for invalid code
                                        setLastAddedMsg(`❌ Invalid Code`);
                                        setTimeout(() => setLastAddedMsg(null), 2000);
                                    }
                                }
                            }}
                            style={{
                                flex: isMobile ? 1 : 'none',
                                width: isMobile ? 'auto' : '100px',
                                padding: '8px 12px',
                                borderRadius: '6px',
                                border: '1px solid #444',
                                background: 'rgba(0, 0, 0, 0.3)',
                                color: 'white',
                                fontSize: '14px',
                                outline: 'none'
                            }}
                        />
                        {lastAddedMsg && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                background: lastAddedMsg.startsWith('❌') ? '#d32f2f' : '#4CAF50',
                                color: 'white',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                whiteSpace: 'nowrap',
                                zIndex: 10,
                                marginTop: '5px',
                                boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
                            }}>
                                {lastAddedMsg}
                            </div>
                        )}
                        <button
                            onClick={() => setShowShortCodes(true)}
                            title="View Short Codes"
                            style={{ padding: '8px 12px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}
                        >
                            ?
                        </button>
                    </div>
                </div>

                {!isMobile && <div style={{ fontSize: '14px', color: '#ccc' }}>{user?.username}</div>}
            </div>

            {/* 2. MAIN CONTENT */}
            <div style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', overflow: 'hidden' }}>

                {/* Hide Categories and Menu if in Monitor Mode */}
                {location.state?.viewMode !== 'monitor' && (
                    <>
                        {/* LEFT: Categories */}
                        <div style={{
                            width: isMobile ? '100%' : '160px',
                            height: isMobile ? 'auto' : '100%',
                            background: 'rgba(0, 0, 0, 0.4)',
                            backdropFilter: 'blur(5px)',
                            overflowX: isMobile ? 'auto' : 'hidden',
                            overflowY: isMobile ? 'hidden' : 'auto',
                            display: 'flex',
                            flexDirection: isMobile ? 'row' : 'column',
                            whiteSpace: isMobile ? 'nowrap' : 'normal',
                            borderRight: isMobile ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
                            borderBottom: isMobile ? '1px solid rgba(255, 255, 255, 0.1)' : 'none'
                        }}>
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    style={{
                                        padding: isMobile ? '12px 20px' : '15px 10px',
                                        border: 'none',
                                        borderRight: isMobile ? '1px solid rgba(255,255,255,0.1)' : 'none',
                                        borderBottom: isMobile ? 'none' : '1px solid rgba(255,255,255,0.05)',
                                        background: selectedCategory === cat ? 'var(--primary)' : 'transparent',
                                        color: selectedCategory === cat ? 'white' : '#aaa',
                                        textAlign: isMobile ? 'center' : 'left',
                                        cursor: 'pointer',
                                        fontSize: '13px',
                                        fontWeight: selectedCategory === cat ? 'bold' : 'normal',
                                        transition: '0.2s',
                                        flexShrink: 0
                                    }}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>

                        {/* CENTER: Grid */}
                        <div style={{ flex: 1, padding: '10px', overflowY: 'auto', background: 'transparent', position: 'relative' }}>

                            {/* Blocking Overlay for Pending Requests */}
                            {pendingOrders.length > 0 && (
                                <div style={{
                                    position: 'absolute',
                                    top: 0, left: 0, right: 0, bottom: 0,
                                    background: 'rgba(0, 0, 0, 0.7)',
                                    zIndex: 20,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backdropFilter: 'blur(5px)',
                                    color: 'white'
                                }}>
                                    <div style={{ fontSize: '40px' }}>🔔</div>
                                    <h3 style={{ color: '#ffc107', margin: '10px 0' }}>Data Action Required</h3>
                                    <p style={{ color: '#ccc', textAlign: 'center' }}>Please Accept or Reject the customer request<br />to unlock the menu.</p>
                                </div>
                            )}

                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? '120px' : '140px'}, 1fr))`,
                                gap: '10px',
                                pointerEvents: pendingOrders.length > 0 ? 'none' : 'auto',
                                opacity: pendingOrders.length > 0 ? 0.3 : 1
                            }}>
                                {filteredMenu.map(item => (
                                    <div
                                        key={item._id}
                                        onClick={() => addToCart(item)}
                                        style={{
                                            background: 'rgba(30, 30, 30, 0.6)',
                                            backdropFilter: 'blur(10px)',
                                            borderRadius: '8px',
                                            overflow: 'hidden',
                                            boxShadow: '0 4px 6px rgba(0,0,0,0.2)',
                                            cursor: 'pointer',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            transition: 'transform 0.1s'
                                        }}
                                        onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
                                        onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                    >
                                        <div style={{ height: '80px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '30px', color: '#ccc', position: 'relative' }}>
                                            <img
                                                src={`${import.meta.env.VITE_API_URL.replace('/api', '')}${item.imageUrl}`}
                                                alt={item.name}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
                                            />
                                            <div style={{ display: 'none', fontSize: '12px', textAlign: 'center', padding: '5px' }}>{item.name}</div>
                                            {/* Add Icon */}
                                            <div style={{ position: 'absolute', bottom: '5px', right: '5px', background: 'var(--primary)', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: 'white', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>+</div>
                                        </div>
                                        <div style={{ padding: '8px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                            <div style={{ fontWeight: '600', fontSize: '13px', lineHeight: '1.2', marginBottom: '5px', color: 'white' }}>{item.name}</div>
                                            <div style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '13px' }}>₹{item.price}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                {/* RIGHT: Cart & Running */}
                {(!isMobile || isCartOpen || pendingOrders.length > 0) && (
                    <div style={{
                        width: isMobile || pendingOrders.length > 0 || location.state?.viewMode === 'monitor' ? '100%' : '380px',
                        height: isMobile ? '100%' : 'auto',
                        position: isMobile ? 'fixed' : 'relative',
                        top: 0, right: 0, bottom: 0,
                        background: 'rgba(20, 20, 20, 0.6)',
                        backdropFilter: 'blur(15px)',
                        borderLeft: isMobile ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        flexDirection: 'column',
                        zIndex: 1000,
                        boxShadow: '-5px 0 15px rgba(0,0,0,0.5)'
                    }}>
                        {isMobile && (
                            <div style={{ padding: '15px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' }}>
                                <span style={{ fontWeight: 'bold' }}>Order Summary</span>
                                <button onClick={() => setIsCartOpen(false)} style={{ border: 'none', background: 'none', fontSize: '24px', cursor: 'pointer', color: '#ff5252' }}>&times;</button>
                            </div>
                        )}

                        {/* Running Orders & Requests */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '15px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>

                            {/* PENDING REQUESTS SECTION */}
                            {pendingOrders.length > 0 && (
                                <div style={{ marginBottom: '20px', background: 'rgba(255, 193, 7, 0.15)', padding: '10px', borderRadius: '8px', border: '1px solid #ffc107' }}>
                                    <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#ffc107', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        🔔 Customer Request
                                        <span style={{ fontSize: '10px', background: '#28a745', color: 'white', padding: '2px 6px', borderRadius: '10px', animation: 'blink 1.5s infinite' }}>Action Required</span>
                                    </h4>
                                    {pendingOrders.map(order => (
                                        <div key={order._id} style={{ background: 'rgba(30, 30, 30, 0.8)', padding: '10px', borderRadius: '6px', marginBottom: '10px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                            {order.items.map((item, idx) => (
                                                <div key={idx} style={{ fontSize: '13px', marginBottom: '5px', color: 'white' }}>
                                                    <b>{item.qty} x {item.name}</b>
                                                </div>
                                            ))}

                                            {/* Note Display */}
                                            {order.note && (
                                                <div style={{ marginTop: '5px', padding: '5px', background: 'rgba(255, 193, 7, 0.2)', fontSize: '12px', borderRadius: '4px', fontStyle: 'italic', color: '#ffc107' }}>
                                                    📝 "{order.note}"
                                                </div>
                                            )}
                                            {/* Voice Note Display */}
                                            {order.voiceNoteUrl && (
                                                <div style={{ marginTop: '5px' }}>
                                                    <audio
                                                        controls
                                                        src={`${import.meta.env.VITE_API_URL.replace('/api', '')}${order.voiceNoteUrl}`}
                                                        style={{ width: '100%', height: '30px' }}
                                                    />
                                                </div>
                                            )}

                                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                                <button onClick={() => handleApprove(order._id)} style={{ flex: 1, padding: '8px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Approve</button>
                                                <button onClick={() => handleReject(order._id)} style={{ flex: 1, padding: '8px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Reject</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#888', textTransform: 'uppercase' }}>Running Orders</h4>
                            {runningOrders.length === 0 && <div style={{ fontSize: '13px', color: '#666', fontStyle: 'italic' }}>No running orders</div>}

                            {runningOrders.length > 0 && (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                    <thead>
                                        <tr style={{ color: '#888', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                            <th style={{ padding: '8px', textAlign: 'left' }}>Item</th>
                                            <th style={{ padding: '8px', textAlign: 'center' }}>Qty</th>
                                            <th style={{ padding: '8px', textAlign: 'center' }}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(() => {
                                            const flattened = [];
                                            runningOrders.forEach(order => {
                                                order.items.forEach(item => {
                                                    flattened.push({ ...item, status: order.status });
                                                });
                                            });

                                            const grouped = {};
                                            flattened.forEach(item => {
                                                const key = `${item.name}-${item.status}`;
                                                if (grouped[key]) {
                                                    grouped[key].qty += item.qty;
                                                } else {
                                                    grouped[key] = { ...item };
                                                }
                                            });

                                            return Object.values(grouped).map((item, idx) => {
                                                const statusStyle = getStatusStyle(item.status);
                                                return (
                                                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#ccc' }}>
                                                        <td style={{ padding: '6px' }}>{item.name}</td>
                                                        <td style={{ padding: '6px', textAlign: 'center' }}>{item.qty}</td>
                                                        <td style={{ padding: '6px', textAlign: 'center' }}>
                                                            <span style={{
                                                                fontSize: '10px', padding: '2px 6px', borderRadius: '4px',
                                                                background: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}`
                                                            }}>
                                                                {statusStyle.label}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            });
                                        })()}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Current Cart */}
                        <div style={{ height: '50%', display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.2)' }}>
                            <div style={{ padding: '10px 15px', background: 'rgba(255, 255, 255, 0.05)', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', fontSize: '13px', fontWeight: 'bold', color: 'var(--primary)' }}>
                                Current Order
                            </div>
                            <div style={{ flex: 1, overflowY: 'auto', padding: '0 15px' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', color: 'white' }}>
                                    <tbody>
                                        {currentCart.map(item => (
                                            <tr key={item.menuId} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                <td style={{ padding: '10px 0' }}>{item.name}</td>
                                                <td style={{ padding: '10px 0', width: '80px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', padding: '2px' }}>
                                                        <button onClick={() => setCurrentCart(currentCart.map(c => c.menuId === item.menuId ? { ...c, qty: Math.max(1, c.qty - 1) } : c))} style={{ border: 'none', background: 'none', padding: '2px 6px', cursor: 'pointer', color: 'white' }}>-</button>
                                                        <span style={{ flex: 1, textAlign: 'center', fontSize: '12px', fontWeight: 'bold' }}>{item.qty}</span>
                                                        <button onClick={() => addToCart({ _id: item.menuId })} style={{ border: 'none', background: 'none', padding: '2px 6px', cursor: 'pointer', color: 'white' }}>+</button>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 'bold', color: 'var(--primary)' }}>₹{item.price * item.qty}</td>
                                                <td style={{ padding: '10px 0 10px 10px' }}>
                                                    <button onClick={() => removeFromCart(item.menuId)} style={{ border: 'none', background: 'none', color: '#ff5252', cursor: 'pointer', fontSize: '16px' }}>&times;</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {currentCart.length === 0 && <div style={{ padding: '20px', textAlign: 'center', color: '#666', fontStyle: 'italic' }}>Cart is empty</div>}
                            </div>

                            {/* Footer */}
                            <div style={{ padding: '15px', borderTop: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', fontSize: '18px', fontWeight: 'bold', color: 'white' }}>
                                    <span>Total</span>
                                    <span style={{ color: 'var(--primary)' }}>₹{grandTotal}</span>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <button
                                        onClick={placeOrder}
                                        disabled={currentCart.length === 0 || isPlacing}
                                        style={{
                                            padding: '12px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', opacity: currentCart.length === 0 ? 0.6 : 1
                                        }}
                                    >
                                        KOT Print / Save
                                    </button>
                                    <button
                                        onClick={finishTable}
                                        style={{
                                            padding: '12px', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer'
                                        }}
                                    >
                                        Print Bill & Pay
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* MOBILE FOOTER BUTTON */}
            {
                isMobile && !isCartOpen && (
                    <div style={{
                        position: 'fixed',
                        bottom: '0', left: 0, right: 0,
                        padding: '10px 15px',
                        background: 'rgba(20, 20, 20, 0.95)',
                        backdropFilter: 'blur(10px)',
                        boxShadow: '0 -2px 10px rgba(0,0,0,0.5)',
                        display: 'flex',
                        gap: '10px',
                        zIndex: 100
                    }}>
                        <button
                            onClick={() => setIsCartOpen(true)}
                            style={{
                                flex: 1,
                                padding: '12px',
                                background: '#d32f2f',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: 'bold',
                                display: 'flex',
                                justifyContent: 'space-between'
                            }}
                        >
                            <span>View Order ({currentCart.length})</span>
                            <span>₹{grandTotal}</span>
                        </button>
                        <button
                            onClick={placeOrder}
                            disabled={currentCart.length === 0 || isPlacing}
                            style={{
                                padding: '12px',
                                background: 'var(--primary)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: 'bold',
                                opacity: currentCart.length === 0 ? 0.6 : 1
                            }}
                        >
                            KOT
                        </button>
                    </div>
                )
            }
            {/* SHORT CODES MODAL */}
            {showShortCodes && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.8)', zIndex: 3000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backdropFilter: 'blur(5px)'
                }} onClick={() => setShowShortCodes(false)}>
                    <div style={{
                        background: '#222', width: '90%', maxWidth: '500px', maxHeight: '80vh',
                        borderRadius: '16px', padding: '20px', border: '1px solid #444',
                        display: 'flex', flexDirection: 'column', color: 'white'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h3 style={{ margin: 0 }}>Short Codes</h3>
                            <button onClick={() => setShowShortCodes(false)} style={{ border: 'none', background: 'none', fontSize: '24px', color: '#777', cursor: 'pointer' }}>&times;</button>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                <thead style={{ position: 'sticky', top: 0, background: '#222' }}>
                                    <tr style={{ borderBottom: '1px solid #444', color: '#aaa', textAlign: 'left' }}>
                                        <th style={{ padding: '10px' }}>Item Name</th>
                                        <th style={{ padding: '10px', textAlign: 'right' }}>Short Code</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {menu.filter(item => item.shortCode || item.code).length === 0 ? (
                                        <tr><td colSpan="2" style={{ padding: '20px', textAlign: 'center', color: '#666' }}>No short codes found</td></tr>
                                    ) : (
                                        menu.filter(item => item.shortCode || item.code)
                                            .sort((a, b) => (a.shortCode || a.code || '').localeCompare(b.shortCode || b.code || ''))
                                            .map(item => (
                                                <tr key={item._id} style={{ borderBottom: '1px solid #333' }}>
                                                    <td style={{ padding: '10px' }}>{item.name}</td>
                                                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', color: 'var(--primary)' }}>{item.shortCode || item.code}</td>
                                                </tr>
                                            ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default OrderPad;
