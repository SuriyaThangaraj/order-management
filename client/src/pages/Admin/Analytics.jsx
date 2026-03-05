import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

const Analytics = () => {
    const [stats, setStats] = useState(null);
    const { user } = useAuth();

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const { data } = await axios.get('/orders/analytics', {
                    headers: { Authorization: `Bearer ${user.token}` }
                });
                setStats(data);
            } catch (error) {
                console.error(error);
            }
        };
        fetchStats();
    }, [user.token]);

    if (!stats) return <div>Loading Analytics...</div>;

    return (
        <div>
            <h2 className="page-title">Sales Analytics</h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '40px' }}>
                <div className="card" style={{ textAlign: 'center' }}>
                    <h3 style={{ fontSize: '16px', color: '#666' }}>Total Revenue</h3>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--primary-red)', marginTop: '10px' }}>
                        ₹{stats.totalRevenue.toLocaleString()}
                    </div>
                </div>
                <div className="card" style={{ textAlign: 'center' }}>
                    <h3 style={{ fontSize: '16px', color: '#666' }}>Total Orders</h3>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', marginTop: '10px' }}>
                        {stats.totalOrders}
                    </div>
                </div>
                <div className="card" style={{ textAlign: 'center' }}>
                    <h3 style={{ fontSize: '16px', color: '#666' }}>Active Orders</h3>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'orange', marginTop: '10px' }}>
                        {stats.unpaidOrders}
                    </div>
                </div>
            </div>

            <div className="card">
                <h3 style={{ marginBottom: '20px' }}>Top Selling Items</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#f8f8f8', textAlign: 'left' }}>
                            <th style={{ padding: '10px', borderBottom: '2px solid #eee' }}>Item Name</th>
                            <th style={{ padding: '10px', borderBottom: '2px solid #eee' }}>Quantity Sold</th>
                        </tr>
                    </thead>
                    <tbody>
                        {stats.topItems.map((item, index) => (
                            <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: '10px' }}>{item._id}</td>
                                <td style={{ padding: '10px', fontWeight: 'bold' }}>{item.count}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Analytics;
