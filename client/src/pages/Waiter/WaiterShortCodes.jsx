import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const WaiterShortCodes = () => {
    const [menuItems, setMenuItems] = useState([]);
    const [filter, setFilter] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        fetchMenu();
    }, []);

    const fetchMenu = async () => {
        try {
            const { data } = await axios.get('/menu');
            // Only show items that have a short code, sorted by code
            const sorted = data
                .filter(item => item.shortCode)
                .sort((a, b) => a.shortCode.localeCompare(b.shortCode));
            setMenuItems(sorted);
        } catch (error) {
            console.error('Error fetching menu:', error);
        }
    };

    const filteredItems = menuItems.filter(item =>
        item.name.toLowerCase().includes(filter.toLowerCase()) ||
        item.shortCode.toLowerCase().includes(filter.toLowerCase()) ||
        item.category.toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <div style={{ minHeight: '100vh', background: '#f8f9fa', fontFamily: "'Inter', sans-serif" }}>
            {/* Sticky Header */}
            <div style={{
                position: 'sticky', top: 0, zIndex: 100, background: 'white',
                padding: '15px 20px', borderBottom: '1px solid #eee',
                display: 'flex', alignItems: 'center', gap: '20px'
            }}>
                <button
                    onClick={() => {
                        if (window.opener) {
                            window.close();
                        } else {
                            navigate('/waiter');
                        }
                    }}
                    style={{
                        border: 'none', background: '#f8f9fa', width: '36px', height: '36px',
                        borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', fontSize: '18px', color: '#555'
                    }}>
                    ✕
                </button>

                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#333', whiteSpace: 'nowrap' }}>Short Codes</h2>
                    <input
                        type="text"
                        placeholder="Search..."
                        autoFocus
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        style={{
                            width: '100%', maxWidth: '400px', padding: '8px 12px',
                            background: '#f1f3f5', border: 'none', borderRadius: '6px',
                            fontSize: '15px', outline: 'none'
                        }}
                    />
                </div>
            </div>

            <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
                <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f8f9fa', color: '#555', textAlign: 'left', borderBottom: '2px solid #eee' }}>
                                <th style={{ padding: '15px' }}>Item Name</th>
                                <th style={{ padding: '15px' }}>Category</th>
                                <th style={{ padding: '15px' }}>Price</th>
                                <th style={{ padding: '15px' }}>Short Code</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan="4" style={{ padding: '30px', textAlign: 'center', color: '#888' }}>
                                        No items found
                                    </td>
                                </tr>
                            ) : (
                                filteredItems.map(item => (
                                    <tr key={item._id} style={{ borderBottom: '1px solid #eee' }}>
                                        <td style={{ padding: '15px', fontWeight: '500' }}>{item.name}</td>
                                        <td style={{ padding: '15px', color: '#666' }}>{item.category}</td>
                                        <td style={{ padding: '15px' }}>₹{item.price}</td>
                                        <td style={{ padding: '15px' }}>
                                            <span style={{
                                                fontWeight: 'bold',
                                                color: '#d9534f',
                                                background: '#fff0f0',
                                                padding: '4px 8px',
                                                borderRadius: '4px'
                                            }}>
                                                {item.shortCode}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default WaiterShortCodes;
