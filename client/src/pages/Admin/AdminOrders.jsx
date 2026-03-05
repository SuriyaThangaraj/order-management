import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import io from 'socket.io-client';

const AdminOrders = () => {
    const { user, socket } = useAuth();
    const [activeOrders, setActiveOrders] = useState([]);
    const [groupedOrders, setGroupedOrders] = useState({});

    useEffect(() => {
        fetchOrders();

        // Socket Logic
        let orderSocket = socket;
        if (!orderSocket) {
            orderSocket = io(import.meta.env.VITE_SOCKET_URL);
        }

        const handleNewOrder = () => fetchOrders();
        const handleUpdate = () => fetchOrders();

        orderSocket.on('newOrder', handleNewOrder);
        orderSocket.on('orderStatusUpdated', handleUpdate);
        orderSocket.on('tableFinished', handleUpdate);

        return () => {
            if (!socket) orderSocket.disconnect();
            else {
                orderSocket.off('newOrder', handleNewOrder);
                orderSocket.off('orderStatusUpdated', handleUpdate);
                orderSocket.off('tableFinished', handleUpdate);
            }
        };
    }, [socket]);

    const fetchOrders = async () => {
        try {
            const { data } = await axios.get('/orders?status=active', {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            setActiveOrders(data);
            groupOrdersByTable(data);
        } catch (error) {
            console.error("Error fetching orders:", error);
        }
    };

    const groupOrdersByTable = (orders) => {
        const grouped = {};
        orders.forEach(order => {
            if (!grouped[order.tableNo]) {
                grouped[order.tableNo] = [];
            }
            grouped[order.tableNo].push(order);
        });
        setGroupedOrders(grouped);
    };

    const calculateTableTotal = (orders) => {
        return orders.reduce((sum, order) => sum + order.totalAmount, 0);
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'SENT': return 'var(--primary-red)';
            case 'RECEIVED': return '#FF9800';
            case 'PREPARING': return '#2196F3';
            case 'READY': return '#4CAF50';
            default: return '#999';
        }
    };

    return (
        <div style={{ paddingBottom: '50px' }}>
            <h2 className="page-title">Live Floor Monitor (All Orders)</h2>

            {Object.keys(groupedOrders).length === 0 ? (
                <div style={{ textAlign: 'center', color: '#777', marginTop: '50px' }}>
                    <h3>No Active Orders</h3>
                    <p>Tables are currently empty.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
                    {Object.keys(groupedOrders).sort().map(tableNo => {
                        const waiters = [...new Set(groupedOrders[tableNo].map(o => o.waiterId?.username || 'Unknown'))].join(', ');
                        const orderCount = groupedOrders[tableNo].length;
                        const totalAmount = calculateTableTotal(groupedOrders[tableNo]);

                        return (
                            <div key={tableNo} className="card" style={{ background: 'white', color: '#333', border: '1px solid #eee', display: 'flex', flexDirection: 'column', height: '400px', overflow: 'hidden', padding: '0' }}>
                                {/* Header: Table & Waiter Info */}
                                <div style={{ background: '#E23744', color: 'white', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h3 style={{ margin: 0, fontSize: '20px' }}>Table {tableNo}</h3>
                                    <div style={{ fontSize: '14px', fontWeight: '500' }}>
                                        {waiters}
                                    </div>
                                </div>

                                {/* Body: Aggregated Items */}
                                <div style={{ flex: 1, overflowY: 'auto', padding: '15px' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                        <thead style={{ position: 'sticky', top: 0, background: 'white' }}>
                                            <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left', color: '#666' }}>
                                                <th style={{ paddingBottom: '8px', width: '55%' }}>Item Name</th>
                                                <th style={{ paddingBottom: '8px', width: '15%', textAlign: 'center' }}>Qty</th>
                                                <th style={{ paddingBottom: '8px', width: '30%', textAlign: 'right' }}>Price</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Object.values(groupedOrders[tableNo].reduce((acc, order) => {
                                                order.items.forEach(item => {
                                                    if (!acc[item.name]) {
                                                        acc[item.name] = { ...item, qty: 0, total: 0 };
                                                    }
                                                    acc[item.name].qty += item.qty;
                                                    acc[item.name].total += (item.price * item.qty);
                                                });
                                                return acc;
                                            }, {})).map((item, idx) => (
                                                <tr key={idx} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                                    <td style={{ padding: '8px 0' }}>{item.name}</td>
                                                    <td style={{ padding: '8px 0', textAlign: 'center', fontWeight: 'bold' }}>{item.qty}</td>
                                                    <td style={{ padding: '8px 0', textAlign: 'right' }}>₹{item.total.toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Footer: Total Amount */}
                                <div style={{ background: '#f8f9fa', padding: '15px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '14px', color: '#666', fontWeight: 'bold' }}>Total Bill</span>
                                    <span style={{ fontSize: '20px', color: '#2c3e50', fontWeight: 'bold' }}>₹{totalAmount.toFixed(2)}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default AdminOrders;
