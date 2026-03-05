import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import NotificationModal from '../../components/NotificationModal';

const CustomerOrderPad = () => {
    const { tableNo } = useParams();
    const location = useLocation();
    const [assignedWaiterId, setAssignedWaiterId] = useState(null);
    const [restaurantId, setRestaurantId] = useState(null); // adminId

    // Feedback Logic (Moved to top)
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [feedbackRating, setFeedbackRating] = useState(5);
    const [feedbackComment, setFeedbackComment] = useState('');
    const [waiterName, setWaiterName] = useState('');

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
        if (assignedWaiterId) {
            axios.get(`/auth/public/${assignedWaiterId}`)
                .then(res => {
                    setWaiterName(res.data.username);
                    // Auto-set restaurant ID from waiter's profile if missing
                    if (res.data.adminId) {
                        setRestaurantId(prev => prev || res.data.adminId);
                        localStorage.setItem(`restaurantId_${tableNo}`, res.data.adminId);
                    }
                })
                .catch(err => console.error("Failed to get waiter name", err));
        }
    }, [assignedWaiterId, tableNo]);

    const submitFeedback = async () => {
        console.log("Submitting Feedback:", { adminId: restaurantId, tableNo, rating: feedbackRating, comment: feedbackComment });

        if (!restaurantId) {
            showNotification("Error", "Restaurant ID (Admin ID) is missing. Please scan the QR code again.", "error");
            return;
        }

        try {
            await axios.post('/feedback', {
                adminId: restaurantId,
                tableNo,
                rating: feedbackRating,
                comment: feedbackComment,
                customerName: 'Guest'
            });
            showNotification("Success", "❤️ Thank you for your feedback!", "success");
            setShowFeedbackModal(false);
            setFeedbackComment('');
            setFeedbackRating(5);
        } catch (error) {
            console.error("Feedback error:", error.response?.data || error.message);
            showNotification("Error", `Failed to submit feedback: ${error.response?.data?.message || error.message}`, "error");
        }
    };

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const wid = params.get('waiterId');
        const aid = params.get('adminId');

        if (wid) {
            setAssignedWaiterId(wid);
            localStorage.setItem(`assignedWaiter_${tableNo}`, wid);
        } else {
            const savedWid = localStorage.getItem(`assignedWaiter_${tableNo}`);
            if (savedWid) setAssignedWaiterId(savedWid);
        }

        if (aid) {
            setRestaurantId(aid);
            localStorage.setItem(`restaurantId_${tableNo}`, aid);
        } else {
            const savedAid = localStorage.getItem(`restaurantId_${tableNo}`);
            if (savedAid) setRestaurantId(savedAid);
        }
    }, [location, tableNo]);

    // Helper for simple error beep
    const playRejectionSound = () => {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.type = 'sawtooth'; // Harsher sound for rejection
            osc.frequency.setValueAtTime(200, ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.3);

            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.3);

            osc.start();
            osc.stop(ctx.currentTime + 0.3);
        } catch (e) {
            console.error("Audio failed", e);
        }
    };

    // --- State ---
    const [menu, setMenu] = useState([]);
    const [filteredMenu, setFilteredMenu] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('All');

    const [runningOrders, setRunningOrders] = useState([]); // Confirmed orders
    const [currentCart, setCurrentCart] = useState([]); // New items to add

    const [isLoading, setIsLoading] = useState(true);
    const [requestStatus, setRequestStatus] = useState(null); // 'PENDING', 'APPROVED', 'REJECTED'
    const socketRef = useRef();

    const [searchQuery, setSearchQuery] = useState('');
    const [isCartOpen, setIsCartOpen] = useState(false); // For mobile cart drawer
    const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);

    // Voice Recorder State
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState(null);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);

    // --- Effects ---

    // Mobile Detection
    useEffect(() => {
        const handleResize = () => {
            setIsMobileView(window.innerWidth < 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Socket Connection
    useEffect(() => {
        socketRef.current = io(import.meta.env.VITE_SOCKET_URL);

        // Listen for order updates (Approvals/Rejections)
        socketRef.current.on('customerOrderUpdated', (updatedOrder) => {
            if (updatedOrder.tableNo == tableNo) {
                // If it was our pending request and now it's SENT, it's approved
                if (updatedOrder.status === 'SENT') {
                    setRequestStatus('APPROVED');
                    setTimeout(() => setRequestStatus(null), 3000); // Clear message
                }
                fetchRunningOrders();
            }
        });

        socketRef.current.on('customerOrderRejected', (data) => {
            if (data.tableNo == tableNo) {
                setRequestStatus('REJECTED');
                playRejectionSound(); // Notify customer
                fetchRunningOrders();
                setTimeout(() => {
                    fetchRunningOrders();
                    setTimeout(() => {
                        showNotification("Order Rejected", "❌ Your order has been REJECTED by the waiter.", "error");
                        setRequestStatus(null);
                    }, 100);
                }, 100);
            }
        });

        // Listen for ANY new order context for this table (e.g. Waiter adds items)
        socketRef.current.on('newOrder', (newOrder) => {
            if (newOrder.tableNo == tableNo) {
                if (newOrder.orderSource === 'WAITER') {
                    if (newOrder.orderSource === 'WAITER') {
                        showNotification("Update", "🔔 The Waiter has added new items to your order.", "info");
                    }
                }
                fetchRunningOrders();
            }
        });

        // Listen for status updates (e.g. Kitchen starts preparing)
        socketRef.current.on('orderStatusUpdated', (updatedOrder) => {
            if (updatedOrder.tableNo == tableNo) {
                fetchRunningOrders();
            }
        });

        socketRef.current.on('menuUpdated', () => fetchMenu());

        return () => {
            socketRef.current.disconnect();
        };
    }, [tableNo]);

    // Initial Data Fetch
    useEffect(() => {
        if (restaurantId || assignedWaiterId) {
            // Only fetch if we have context. If neither, menu might be empty or default?
            // Actually menu API now requires adminId or auth.
            // If we have waiterId but no restaurantId, we can't easily fetch menu unless backend infers it (which menu API doesn't do yet, only orders API).
            // Requirement: Customer URL MUST have ?adminId=... OR ?waiterId=... AND we need to resolve it.
            // Current Menu API only accepts ?adminId.
            // So if we only have waiterId, we might fail to load menu unless we lookup waiter first.
            // For now assume adminId is passed.
            const initData = async () => {
                await Promise.all([fetchMenu(), fetchRunningOrders()]);
                setIsLoading(false);
            };
            initData();
        }
    }, [restaurantId, assignedWaiterId]);

    // Filtering Logic
    useEffect(() => {
        let items = menu;

        if (selectedCategory !== 'All') {
            items = items.filter(item => item.category === selectedCategory);
        }

        if (searchQuery) {
            items = items.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));
        }

        setFilteredMenu(items);
    }, [selectedCategory, menu, searchQuery]);

    // --- Helper Functions ---

    const fetchMenu = async () => {
        try {
            // Pass adminId if available
            const params = {};
            if (restaurantId) params.adminId = restaurantId;

            const { data } = await axios.get('/menu', { params });
            const availableItems = data.filter(item => item.isAvailable);
            setMenu(availableItems);

            const cats = ['All', ...new Set(availableItems.map(item => item.category))];
            setCategories(cats);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchRunningOrders = async () => {
        try {
            // Fetch public orders for this table
            // Pass adminId for scoping
            const queryParams = restaurantId ? `?adminId=${restaurantId}` : '';
            const { data } = await axios.get(`/orders/customer/${tableNo}${queryParams}`);

            // Only show approved/sent/preparing/ready orders as "Running"
            // We might also want to show PENDING ones if we want, but let's stick to confirmed
            // Actually user wants to see their order history.
            // Let's show everything that is NOT paid.
            setRunningOrders(data);
        } catch (error) {
            console.error("Failed to fetch customer orders", error);
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
                price: item.price, // Internal use only
                qty: 1,
                image: item.imageUrl
            }]);
        }
    };

    const removeFromCart = (menuId) => {
        setCurrentCart(currentCart.filter(c => c.menuId !== menuId));
    };

    const [isPlacing, setIsPlacing] = useState(false);

    // Note & Audio Logic
    const [orderNote, setOrderNote] = useState('');
    const [showNoteModal, setShowNoteModal] = useState(false);

    // Timer Logic
    useEffect(() => {
        let interval;
        if (isRecording) {
            interval = setInterval(() => {
                setRecordingTime((prev) => prev + 1);
            }, 1000);
        } else {
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [isRecording]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const startRecording = async () => {
        if (!window.isSecureContext) {
            if (!window.isSecureContext) {
                showNotification("Security Error", "🔴 SECURITY ERROR: Microphone requires HTTPS.", "error");
                return;
            }
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                setAudioBlob(blob);
                const tracks = stream.getTracks(); // Stop mic
                tracks.forEach(track => track.stop());
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            setRecordingTime(0);

            // Auto-stop 3 mins
            setTimeout(() => {
                if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                    stopRecording();
                    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                        stopRecording();
                        showNotification("Time Limit", "Max recording time (3 mins) reached.", "warning");
                    }
                }
            }, 180000);

        } catch (err) {
            console.error("Mic Error:", err);
            showNotification("Microphone Error", `${err.message}. Check permissions.`, "error");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const deleteRecording = () => {
        setAudioBlob(null);
        setRecordingTime(0);
    };

    const requestOrder = async () => {
        if (currentCart.length === 0) return;
        setIsPlacing(true);

        try {
            let voiceUrl = null;
            if (audioBlob) {
                const formData = new FormData();
                formData.append('file', audioBlob, 'voice-note.webm');
                const uploadRes = await axios.post('/upload', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                voiceUrl = uploadRes.data.filePath;
            }

            // Place Order
            const total = currentCart.reduce((acc, item) => acc + (item.price * item.qty), 0);

            await axios.post('/orders/customer', {
                tableNo,
                items: currentCart,
                totalAmount: total,
                note: orderNote,
                voiceNoteUrl: voiceUrl,
                waiterId: assignedWaiterId,
                adminId: restaurantId // Pass explicitly
            });

            // Optimistically show pending status?
            setRequestStatus('PENDING');
            setCurrentCart([]);
            setOrderNote('');
            setAudioBlob(null);
            setRecordingTime(0);
            await fetchRunningOrders();
        } catch (error) {
            console.error(error);
            showNotification("Error", `Failed to request order: ${error.response?.data?.message || error.message}`, "error");
        } finally {
            setIsPlacing(false);
        }
    };

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

    if (isLoading) return <div style={{ padding: '20px', textAlign: 'center', color: 'white' }}>Loading Menu...</div>;

    // MOVED TO TOP LEVEL


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

            {/* TOP BAR RESTORED */}
            <div style={{
                padding: '15px',
                background: 'rgba(0, 0, 0, 0.6)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <img src="/logo.png" alt="Logo" style={{ height: '80px', borderRadius: '8px' }} />
                    <div>
                        <h2 style={{ margin: 0, fontSize: '18px', color: 'white' }}>
                            <span style={{ color: 'var(--primary)' }}>Table {tableNo}</span>
                        </h2>
                        {waiterName && (
                            <div style={{ fontSize: '12px', color: '#ccc', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <span>💁‍♂️ Waiter:</span>
                                <span style={{ color: '#fff', fontWeight: 'bold' }}>{waiterName}</span>
                            </div>
                        )}
                    </div>
                </div>
                <div style={{ fontSize: '12px', color: '#ccc' }}>Customer View</div>
            </div>
            {/* TOP BAR REMOVED */}

            {/* NOTIFICATIONS */}
            {
                requestStatus === 'PENDING' && (
                    <div style={{ padding: '15px', background: 'rgba(255, 193, 7, 0.9)', color: '#000', textAlign: 'center', fontWeight: 'bold' }}>
                        ⏳ Order Requested! Waiting for Waiter...
                    </div>
                )
            }
            {
                requestStatus === 'APPROVED' && (
                    <div style={{ padding: '15px', background: 'rgba(76, 175, 80, 0.9)', color: 'white', textAlign: 'center', fontWeight: 'bold' }}>
                        ✅ Order Approved! Preparing...
                    </div>
                )
            }
            {
                requestStatus === 'REJECTED' && (
                    <div style={{ padding: '15px', background: 'rgba(244, 67, 54, 0.9)', color: 'white', textAlign: 'center', fontWeight: 'bold' }}>
                        ❌ Order Rejected by Waiter.
                    </div>
                )
            }

            {/* CONTENT */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: isMobileView ? 'column' : 'row' }}>

                {/* Categories */}
                <div style={{
                    background: 'rgba(0, 0, 0, 0.4)',
                    backdropFilter: 'blur(5px)',
                    padding: '0',
                    overflowX: 'auto',
                    display: 'flex',
                    flexDirection: isMobileView ? 'row' : 'column',
                    flexShrink: 0,
                    width: isMobileView ? '100%' : '140px',
                    borderRight: isMobileView ? 'none' : '1px solid rgba(255,255,255,0.1)',
                    borderBottom: isMobileView ? '1px solid rgba(255,255,255,0.1)' : 'none'
                }}>
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            style={{
                                padding: '15px 20px',
                                border: 'none',
                                background: selectedCategory === cat ? 'var(--primary)' : 'transparent',
                                color: selectedCategory === cat ? 'white' : '#aaa',
                                whiteSpace: 'nowrap',
                                cursor: 'pointer',
                                textAlign: isMobileView ? 'center' : 'left',
                                borderBottom: isMobileView ? 'none' : '1px solid rgba(255,255,255,0.05)',
                                transition: 'all 0.2s',
                                fontWeight: selectedCategory === cat ? 'bold' : 'normal'
                            }}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* Grid */}
                <div style={{ flex: 1, padding: '15px', overflowY: 'auto' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '15px' }}>
                        {filteredMenu.map(item => (
                            <div
                                key={item._id}
                                onClick={() => addToCart(item)}
                                style={{
                                    background: 'rgba(30, 30, 30, 0.6)', // Glass card
                                    backdropFilter: 'blur(10px)',
                                    borderRadius: '12px',
                                    overflow: 'hidden',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    boxShadow: '0 4px 6px rgba(0,0,0,0.2)',
                                    cursor: 'pointer',
                                    transition: 'transform 0.2s'
                                }}
                                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
                                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                <div style={{ height: '120px', background: 'rgba(255,255,255,0.05)', position: 'relative' }}>
                                    <img
                                        src={`${import.meta.env.VITE_API_URL.replace('/api', '')}${item.imageUrl}`}
                                        alt={item.name}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                    {/* Plus Overlay to indicate action */}
                                    <div style={{
                                        position: 'absolute', bottom: '5px', right: '5px',
                                        background: 'var(--primary)', color: 'white',
                                        width: '24px', height: '24px', borderRadius: '50%',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '16px', fontWeight: 'bold', boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
                                    }}>+</div>
                                </div>
                                <div style={{ padding: '10px' }}>
                                    <h4 style={{ margin: '0', fontSize: '14px', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</h4>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* CART SIDEBAR / DRAWER */}
                <div style={{
                    width: isMobileView ? '100%' : '350px',
                    background: 'rgba(20, 20, 20, 0.9)', // Darker glass
                    backdropFilter: 'blur(15px)',
                    WebkitBackdropFilter: 'blur(15px)',
                    borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    position: isMobileView ? 'fixed' : 'relative',
                    bottom: 0, left: 0, right: 0, top: isMobileView ? (isCartOpen ? '15%' : '100%') : 0,
                    transition: 'top 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: '0 -4px 20px rgba(0,0,0,0.5)',
                    zIndex: 100
                }}>
                    <div style={{
                        padding: '15px', borderBottom: '1px solid rgba(255,255,255,0.1)',
                        fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', color: 'white'
                    }}>
                        <span>Order Summary</span>
                        {isMobileView && <button onClick={() => setIsCartOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '14px' }}>▼ Close</button>}
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

                        {/* Running Orders */}
                        <div style={{ flex: '0 0 auto', maxHeight: '35%', overflowY: 'auto', padding: '15px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                            <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#888', textTransform: 'uppercase' }}>Orderd Orders</h4>
                            {runningOrders.length === 0 && <div style={{ fontSize: '13px', color: '#666', fontStyle: 'italic' }}>No  orders</div>}

                            {runningOrders.length > 0 && (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                    <thead>
                                        <tr style={{ color: '#888', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                            <th style={{ padding: '8px', textAlign: 'left' }}>Food Name</th>
                                            <th style={{ padding: '8px', textAlign: 'center' }}>Qty</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(() => {
                                            const flattened = [];
                                            runningOrders.forEach(order => {
                                                order.items.forEach(item => {
                                                    flattened.push({ ...item });
                                                });
                                            });

                                            const grouped = {};
                                            flattened.forEach(item => {
                                                if (grouped[item.name]) {
                                                    grouped[item.name].qty += item.qty;
                                                } else {
                                                    grouped[item.name] = { ...item };
                                                }
                                            });

                                            return Object.values(grouped).map((item, idx) => (
                                                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#ccc' }}>
                                                    <td style={{ padding: '6px' }}>{item.name}</td>
                                                    <td style={{ padding: '6px', textAlign: 'center' }}>{item.qty}</td>
                                                </tr>
                                            ));
                                        })()}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Current Cart */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                            <div style={{ padding: '10px 15px', background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '13px', fontWeight: 'bold', color: 'var(--primary)' }}>
                                new Order
                            </div>
                            <div style={{ flex: 1, overflowY: 'auto', padding: '0 15px' }}>
                                {currentCart.length === 0 ? (
                                    <div style={{ padding: '20px', textAlign: 'center', color: '#666', fontStyle: 'italic' }}>Cart is empty</div>
                                ) : (
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', color: 'white' }}>
                                        <tbody>
                                            {currentCart.map(item => (
                                                <tr key={item.menuId} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <td style={{ padding: '12px 0' }}>{item.name}</td>
                                                    <td style={{ padding: '12px 0', width: '90px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.1)', borderRadius: '20px', padding: '2px' }}>
                                                            <button onClick={() => {
                                                                const existing = currentCart.find(c => c.menuId === item.menuId);
                                                                if (existing.qty > 1) {
                                                                    setCurrentCart(currentCart.map(c => c.menuId === item.menuId ? { ...c, qty: c.qty - 1 } : c));
                                                                } else {
                                                                    removeFromCart(item.menuId);
                                                                }
                                                            }} style={{ border: 'none', background: 'none', color: 'white', padding: '5px 10px', cursor: 'pointer' }}>-</button>
                                                            <span style={{ flex: 1, textAlign: 'center', fontSize: '12px', fontWeight: 'bold' }}>{item.qty}</span>
                                                            <button onClick={() => addToCart({ _id: item.menuId, name: item.name, price: item.price, imageUrl: item.image })} style={{ border: 'none', background: 'none', color: 'white', padding: '5px 10px', cursor: 'pointer' }}>+</button>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '12px 0 12px 10px' }}>
                                                        <button onClick={() => removeFromCart(item.menuId)} style={{ border: 'none', background: 'none', color: '#ff5252', cursor: 'pointer', fontSize: '18px' }}>&times;</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>

                            {/* Footer Actions */}
                            <div style={{ padding: '15px', borderTop: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)' }}>
                                <button
                                    onClick={() => setShowNoteModal(true)}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        marginBottom: '10px',
                                        background: (orderNote) ? '#ff9800' : 'rgba(255,255,255,0.1)',
                                        color: 'white',
                                        border: '1px solid rgba(255,255,255,0.2)',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {(orderNote) ? '📝 Note Added' : '➕ Add Special Note / Voice'}
                                </button>

                                <button
                                    onClick={requestOrder}
                                    disabled={currentCart.length === 0 || isPlacing}
                                    style={{
                                        width: '100%',
                                        padding: '14px',
                                        background: 'var(--primary)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontSize: '16px',
                                        fontWeight: 'bold',
                                        opacity: currentCart.length === 0 ? 0.5 : 1,
                                        cursor: currentCart.length === 0 ? 'not-allowed' : 'pointer',
                                        boxShadow: '0 4px 15px rgba(255, 0, 0, 0.3)'
                                    }}
                                >
                                    {isPlacing ? 'Sending Order...' : 'Place Order'}
                                </button>

                                {/* FEEDBACK BUTTON */}
                                <button
                                    onClick={() => setShowFeedbackModal(true)}
                                    style={{
                                        width: '100%',
                                        marginTop: '10px',
                                        padding: '12px',
                                        background: 'transparent',
                                        color: '#bbb',
                                        border: '1px dashed #555',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    ⭐ Give Feedback
                                </button>
                            </div>

                            {/* FEEDBACK MODAL */}
                            {showFeedbackModal && (
                                <div style={{
                                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                                    background: 'rgba(0,0,0,0.8)', zIndex: 2050,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    backdropFilter: 'blur(5px)'
                                }} onClick={() => setShowFeedbackModal(false)}>
                                    <div style={{ background: '#222', padding: '30px', borderRadius: '16px', width: '90%', maxWidth: '350px', textAlign: 'center', color: 'white', border: '1px solid #444' }} onClick={e => e.stopPropagation()}>
                                        <h3 style={{ marginTop: 0 }}>Rate your experience</h3>
                                        <div style={{ fontSize: '30px', margin: '20px 0', cursor: 'pointer' }}>
                                            {[1, 2, 3, 4, 5].map(star => (
                                                <span key={star} onClick={() => setFeedbackRating(star)} style={{ color: star <= feedbackRating ? '#FFD700' : '#555', margin: '0 5px' }}>★</span>
                                            ))}
                                        </div>
                                        <textarea
                                            placeholder="Write your feedback..."
                                            value={feedbackComment}
                                            onChange={e => setFeedbackComment(e.target.value)}
                                            style={{ width: '100%', height: '80px', background: '#333', color: 'white', border: '1px solid #555', borderRadius: '8px', padding: '10px', marginBottom: '15px' }}
                                        />
                                        <button onClick={submitFeedback} style={{ width: '100%', padding: '12px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Submit</button>
                                    </div>
                                </div>
                            )}

                            {/* NOTE MODAL */}
                            {showNoteModal && (
                                <div style={{
                                    position: 'fixed',
                                    top: 0, left: 0, right: 0, bottom: 0,
                                    background: 'rgba(0,0,0,0.8)',
                                    zIndex: 2000,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backdropFilter: 'blur(5px)'
                                }} onClick={() => setShowNoteModal(false)}>
                                    <div style={{
                                        background: '#222',
                                        width: '90%',
                                        maxWidth: '400px',
                                        borderRadius: '16px',
                                        padding: '25px',
                                        border: '1px solid #444',
                                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                                        color: 'white'
                                    }} onClick={e => e.stopPropagation()}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                            <h3 style={{ margin: 0 }}>Special Instructions</h3>
                                            <button onClick={() => setShowNoteModal(false)} style={{ border: 'none', background: 'none', fontSize: '24px', color: '#777', cursor: 'pointer' }}>&times;</button>
                                        </div>

                                        <div style={{ marginBottom: '20px' }}>
                                            <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#aaa', display: 'block', marginBottom: '8px' }}>Text Note</label>
                                            <textarea
                                                value={orderNote}
                                                onChange={(e) => setOrderNote(e.target.value)}
                                                placeholder="e.g. No ice, extra spicy..."
                                                style={{
                                                    width: '100%',
                                                    padding: '12px',
                                                    borderRadius: '8px',
                                                    border: '1px solid #444',
                                                    background: '#333',
                                                    color: 'white',
                                                    fontSize: '14px',
                                                    resize: 'none',
                                                    height: '80px',
                                                    outline: 'none'
                                                }}
                                            />
                                        </div>

                                        <div style={{ marginBottom: '25px' }}>
                                            <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#aaa', display: 'block', marginBottom: '8px' }}>Voice Note</label>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', background: '#333', padding: '15px', borderRadius: '12px' }}>
                                                {!isRecording && !audioBlob ? (
                                                    <button
                                                        onClick={startRecording}
                                                        style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'var(--primary)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', boxShadow: '0 0 15px rgba(255,0,0,0.4)' }}
                                                    >
                                                        🎤
                                                    </button>
                                                ) : isRecording ? (
                                                    <button
                                                        onClick={stopRecording}
                                                        style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'transparent', border: '2px solid #ff5252', color: '#ff5252', cursor: 'pointer', animation: 'pulse 1s infinite', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}
                                                    >
                                                        ⏹
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={deleteRecording}
                                                        style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#555', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}
                                                    >
                                                        🗑️
                                                    </button>
                                                )}

                                                <div style={{ flex: 1 }}>
                                                    {isRecording ? (
                                                        <div style={{ color: '#ff5252', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            <div style={{ width: '8px', height: '8px', background: '#ff5252', borderRadius: '50%', animation: 'blink 1s infinite' }}></div>
                                                            Rec: {formatTime(recordingTime)}
                                                        </div>
                                                    ) : audioBlob ? (
                                                        <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            <div style={{ flex: 1, height: '4px', background: '#555', borderRadius: '2px' }}>
                                                                <div style={{ width: '60%', height: '100%', background: '#4caf50', borderRadius: '2px' }}></div>
                                                            </div>
                                                            <span style={{ fontSize: '12px', color: '#aaa' }}>Recorded</span>
                                                        </div>
                                                    ) : (
                                                        <div style={{ color: '#777', fontSize: '13px' }}>Tap mic to start</div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => setShowNoteModal(false)}
                                            style={{
                                                width: '100%',
                                                padding: '14px',
                                                background: 'white',
                                                color: 'black',
                                                border: 'none',
                                                borderRadius: '8px',
                                                fontWeight: 'bold',
                                                fontSize: '16px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Done
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </div >

            {/* Mobile Fab to open cart */}
            {
                isMobileView && !isCartOpen && currentCart.length > 0 && (
                    <button
                        onClick={() => setIsCartOpen(true)}
                        style={{
                            position: 'fixed', bottom: '20px', right: '20px',
                            padding: '12px 24px',
                            background: 'var(--primary)',
                            color: 'white',
                            borderRadius: '30px',
                            border: 'none',
                            boxShadow: '0 4px 20px rgba(255,0,0,0.5)',
                            fontWeight: 'bold',
                            zIndex: 50,
                            display: 'flex', alignItems: 'center', gap: '8px'
                        }}
                    >
                        🛒 View Cart ({currentCart.length})
                    </button>
                )
            }

        </div >
    );
};

export default CustomerOrderPad;
