import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import io from 'socket.io-client';

const TableSelect = () => {
    const navigate = useNavigate();
    const { logout, user } = useAuth();

    const [tableCount, setTableCount] = useState(20);
    const [selectedTable, setSelectedTable] = useState(null); // For modal
    const [modeSelect, setModeSelect] = useState(null); // { tableNo: '1A' }
    const [showQR, setShowQR] = useState(false);
    const [activeTables, setActiveTables] = useState([]);
    const [activeOrders, setActiveOrders] = useState([]); // NEW: Store active orders to check pending status
    const [isLoading, setIsLoading] = useState(true);

    const tables = Array.from({ length: tableCount }, (_, i) => i + 1);

    useEffect(() => {
        fetchActiveTables();
        fetchTableCount();

        // Real-time updates for table status
        const socket = io(import.meta.env.VITE_SOCKET_URL);

        socket.on('newOrder', () => fetchActiveTables());
        socket.on('tableFinished', () => fetchActiveTables());

        // NEW: Also listen for customer requests to update Badges AND Play Sound
        socket.on('newCustomerRequest', (newOrder) => {
            fetchActiveTables();

            // LOGIC: If targetWaiterId is set, ONLY notify that waiter.
            // If NOT set (null/undefined), notify EVERYONE (round robin / first to grab) or just broadcast.

            // Ensure we compare strings to avoid ObjectId vs String issues
            const myId = String(user._id || user.id);
            const targetId = newOrder.targetWaiterId ? String(newOrder.targetWaiterId) : null;

            console.log(`[NOTIFY] New Order for Table ${newOrder.tableNo}. Target: ${targetId}, Me: ${myId}`);

            // STRICT Condition: Only notify if explicitly targeted to ME
            if (targetId && targetId === myId) {
                console.log("✅ playing notification for me");
                playNotification();
                // Redirect to the table that made the request
                if (newOrder && newOrder.tableNo) {
                    navigate(`/waiter/table/${newOrder.tableNo}`);
                }
            } else {
                console.log("❌ ignoring notification (not for me)");
            }
        });

        return () => socket.disconnect();
    }, []);

    const playNotification = () => {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            // Pleasant notification chime
            osc.type = 'sine';
            osc.frequency.setValueAtTime(500, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.1);
            osc.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.3);

            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);

            osc.start();
            osc.stop(ctx.currentTime + 0.5);
        } catch (e) {
            console.error("Audio play failed", e);
        }
    };

    const fetchTableCount = async () => {
        try {
            const { data } = await axios.get('/settings/table-config', {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            setTableCount(data.tableCount);
        } catch (error) {
            console.error(error);
        }
    }

    const fetchActiveTables = async () => {
        try {
            // Fetch all active orders to determine which tables are busy
            const { data } = await axios.get('/orders?status=active', {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            // Extract unique table numbers
            const occupied = [...new Set(data.map(o => o.tableNo))];
            setActiveTables(occupied);
            setActiveOrders(data); // Store full data
            setIsLoading(false);
        } catch (error) {
            console.error(error);
            setIsLoading(false);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleTableClick = (num) => {
        setSelectedTable(num);
    };

    const handleSubTableSelect = (sub) => {
        const fullTableNo = `${selectedTable}${sub}`;
        // Always show mode selection to allow Monitor Mode even if busy
        setModeSelect({ tableNo: fullTableNo });

        setSelectedTable(null); // Close sub table modal
    };

    const isTableActive = (num) => {
        // Check if ANY sub-table (A, B, C, D) is active for this number
        // Or if the number itself is active (legacy)
        return activeTables.some(t => t === String(num) || ['A', 'B', 'C', 'D'].some(l => t === `${num}${l}`));
    };

    // Helper to see which letters are busy for a specific table
    const getBusySubTables = (num) => {
        return activeTables.filter(t => t === String(num) || ['A', 'B', 'C', 'D'].some(l => t === `${num}${l}`)).map(t => t.replace(String(num), ''));
    };

    return (
        <div className="container" style={{ padding: '15px 15px' }}>
            <div className="mobile-stack" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '30px',
                gap: '15px',
                flexWrap: 'wrap' // Allow wrapping
            }}>
                <h2 className="page-title" style={{ marginBottom: 0 }}>Select Table</h2>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    flexWrap: 'wrap',
                    justifyContent: 'flex-start' // Align left on wrap
                }}>
                    <button onClick={() => navigate('/waiter/short-codes')} className="btn btn-primary" style={{ fontSize: '13px', padding: '8px 12px' }}>Short Codes</button>
                    <span style={{ fontWeight: '500', fontSize: '14px' }}>{user?.username}</span>
                    <button onClick={handleLogout} className="btn btn-outline" style={{ fontSize: '13px', padding: '8px 12px' }}>Logout</button>
                </div>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                gap: '15px'
            }}>
                {tables.map(num => {
                    const myId = String(user._id || user.id);

                    const tableOrders = activeOrders.filter(o => {
                        const tNo = String(o.tableNo);
                        return tNo === String(num) || ['A', 'B', 'C', 'D'].some(l => tNo === `${num}${l}`);
                    });

                    const isActive = tableOrders.length > 0;

                    // The ENTIRE GROUP of table orders for this root number
                    const hasMyOrdersInGroup = tableOrders.some(o =>
                        !o.waiterId || String(o.waiterId._id || o.waiterId) === myId
                    );

                    // If any sub-table (A, B, C, D) has an order from someone else
                    const hasOtherOrdersInGroup = tableOrders.some(o =>
                        o.waiterId && String(o.waiterId._id || o.waiterId) !== myId
                    );

                    // Check if I have orders
                    const hasMyOrders = hasMyOrdersInGroup;
                    const hasOtherOrders = hasOtherOrdersInGroup;

                    // Pending badge
                    const hasPending = tableOrders.some(o =>
                        o.status === 'PENDING_APPROVAL' &&
                        (!o.waiterId || String(o.waiterId._id || o.waiterId) === myId)
                    );

                    // Styling & Label Logic
                    let bgColor = 'rgba(255, 255, 255, 0.9)';
                    let textColor = '#333333';
                    let label = 'Empty';

                    // Helper to get waiter name
                    const getWaiterName = () => {
                        // Find first order with a waiter
                        const order = tableOrders.find(o => o.waiterId && o.waiterId.username);
                        return order ? order.waiterId.username : 'Unknown';
                    };

                    if (hasMyOrders) {
                        bgColor = 'var(--primary)'; // Mine
                        textColor = 'white';
                        label = `Table ${num}`;
                    } else if (hasOtherOrders) {
                        bgColor = '#fff3e0'; // Shared/Busy
                        textColor = '#07cb56ff'; // Orange text
                        const waiterName = getWaiterName();
                        label = `${waiterName}`; // Show specific waiter name
                    }

                    return (
                        <button
                            key={num}
                            className="card"
                            onClick={() => handleTableClick(num)}
                            style={{
                                height: '100px',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center',
                                fontSize: '20px',
                                fontWeight: 'bold',
                                color: textColor,
                                background: bgColor,
                                cursor: 'pointer',
                                border: '2px solid transparent',
                                transition: 'all 0.2s',
                                padding: '10px',
                                boxShadow: isActive ? '0 4px 15px rgba(0,0,0,0.2)' : '0 2px 4px rgba(0,0,0,0.1)',
                                position: 'relative'
                            }}
                        >
                            {hasPending && (
                                <div style={{
                                    position: 'absolute',
                                    top: '5px',
                                    right: '5px',
                                    width: '12px',
                                    height: '12px',
                                    background: '#8f1705ff',
                                    borderRadius: '50%',
                                    border: '2px solid white',
                                    boxShadow: '0 0 5px rgba(0,0,0,0.3)',
                                    animation: 'pulse 1.5s infinite'
                                }} />
                            )}
                            <span style={{ fontSize: '30px', marginBottom: '5px' }}>
                                {isActive ? '🍽️' : num}
                            </span>
                            <span style={{ fontSize: '14px', fontWeight: '500' }}>
                                {label}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Sub-Table Selection Modal */}
            {selectedTable && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    backdropFilter: 'blur(3px)'
                }} onClick={() => setSelectedTable(null)}>
                    <div style={{
                        background: 'white',
                        padding: '30px',
                        borderRadius: '16px',
                        width: '90%',
                        maxWidth: '450px',
                        textAlign: 'center',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
                    }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ marginBottom: '25px', color: '#2d3436', fontSize: '22px' }}>Table {selectedTable}</h3>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '10px' }}>
                            {['A', 'B', 'C', 'D'].map(letter => {
                                const fullTableNo = `${selectedTable}${letter}`;
                                const myId = String(user._id || user.id);

                                // Filter orders strictly for this sub-table to check busyness
                                const subTableOrders = activeOrders.filter(o => o.tableNo === fullTableNo);
                                const isBusy = subTableOrders.length > 0;

                                // Lock ONLY if THIS SPECIFIC sub-table belongs to someone else
                                const lockedOrder = subTableOrders.find(o =>
                                    o.waiterId && String(o.waiterId._id || o.waiterId) !== myId
                                );
                                const isLocked = !!lockedOrder;

                                const isPending = subTableOrders.some(o =>
                                    o.status === 'PENDING_APPROVAL' &&
                                    (!o.waiterId || String(o.waiterId._id || o.waiterId) === myId)
                                );

                                return (
                                    <SubTableButton
                                        key={letter}
                                        letter={letter}
                                        isBusy={isBusy}
                                        isLocked={isLocked}
                                        isPending={isPending}
                                        onClick={() => !isLocked && handleSubTableSelect(letter)}
                                    />
                                )
                            })}
                        </div>
                        <button
                            onClick={() => setSelectedTable(null)}
                            style={{ width: '100%', marginTop: '20px', padding: '12px', background: 'transparent', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', color: '#666' }}
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

            {/* Mode Selection Modal (Customer vs Oral) */}
            {modeSelect && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(224, 217, 217, 0)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100
                }} onClick={() => setModeSelect(null)}>
                    <div style={{ background: 'white', padding: '30px', borderRadius: '16px', width: '90%', maxWidth: '400px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ marginBottom: '10px' }}>Table {modeSelect.tableNo} - Select Mode</h3>
                        <p style={{ color: '#666', marginBottom: '25px' }}>How will the order be placed?</p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <button
                                onClick={() => {
                                    navigate(`/waiter/table/${modeSelect.tableNo}`);
                                    setModeSelect(null);
                                }}
                                style={{ padding: '20px', background: '#3498db', color: 'white', border: 'none', borderRadius: '10px', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                            >
                                📝 Oral Order (Waiter)
                            </button>

                            <button
                                onClick={() => setShowQR(true)}
                                style={{ padding: '20px', background: '#2ecc71', color: 'white', border: 'none', borderRadius: '10px', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                            >
                                Customer Order (QR)
                            </button>
                        </div>
                        <button onClick={() => setModeSelect(null)} style={{ marginTop: '20px', border: 'none', background: 'none', textDecoration: 'underline', cursor: 'pointer', color: '#888' }}>Cancel</button>
                    </div>
                </div>
            )}

            {/* QR Code Modal */}
            {showQR && modeSelect && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200
                }} onClick={() => { setShowQR(false); setModeSelect(null); }}>
                    <div style={{ background: 'white', padding: '40px', borderRadius: '20px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ marginBottom: '20px', color: '#2c3e50' }}>Scan to Order</h2>
                        <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '10px', display: 'inline-block', marginBottom: '20px' }}>
                            {/* Simple QR Placeholder using API or just text for now. Using goqr.me API for real QR */}
                            <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(`${window.location.origin}/customer/table/${modeSelect.tableNo}?waiterId=${user._id || user.id}`)}`}
                                alt="QR Code"
                                style={{ display: 'block' }}
                            />
                        </div>
                        <p style={{ fontSize: '18px', fontWeight: 'bold' }}>Table {modeSelect.tableNo}</p>
                        <p style={{ color: '#666', marginTop: '10px', fontSize: '14px' }}>{`${window.location.origin}/customer/table/${modeSelect.tableNo}`}</p>

                        <div style={{ marginTop: '30px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
                            <button
                                onClick={() => { setShowQR(false); setModeSelect(null); }}
                                style={{ padding: '10px 30px', background: '#ecf0f1', color: '#7f8c8d', border: 'none', borderRadius: '30px', fontSize: '16px', cursor: 'pointer' }}
                            >
                                Close
                            </button>
                            <button
                                onClick={() => {
                                    navigate(`/waiter/table/${modeSelect.tableNo}`, { state: { viewMode: 'monitor' } });
                                    setModeSelect(null);
                                    setShowQR(false);
                                }}
                                style={{ padding: '10px 30px', background: '#f1c40f', color: '#2c3e50', border: 'none', borderRadius: '30px', fontSize: '16px', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                                View/Monitor Table
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const SubTableButton = ({ letter, isBusy, isLocked, isPending, onClick }) => (
    <button
        onClick={onClick}
        disabled={isLocked}
        style={{
            background: isLocked ? '#f0f0f0' : (isBusy ? '#ffebee' : '#f8f9fa'),
            color: isLocked ? '#999' : (isBusy ? '#c0392b' : '#2c3e50'),
            border: isLocked ? '2px solid #ddd' : (isBusy ? '2px solid #e74c3c' : '2px solid #bdc3c7'),
            padding: '20px',
            fontSize: '24px',
            fontWeight: 'bold',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px',
            borderRadius: '12px',
            cursor: isLocked ? 'not-allowed' : 'pointer',
            transition: 'transform 0.1s',
            position: 'relative',
            opacity: isLocked ? 0.6 : 1
        }}
    >
        {isPending && (
            <div style={{
                position: 'absolute',
                top: '5px',
                right: '5px',
                width: '10px',
                height: '10px',
                background: '#2ecc71',
                borderRadius: '50%',
                border: '2px solid white',
                boxShadow: '0 0 5px rgba(0,0,0,0.3)',
                animation: 'pulse 1.5s infinite'
            }} />
        )}
        <span>{letter}</span>
        {isLocked ? <span style={{ fontSize: '10px' }}>🔒</span> : (isBusy && <span style={{ fontSize: '10px', textTransform: 'uppercase', background: '#c0392b', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>Busy</span>)}
    </button>
)

export default TableSelect;
