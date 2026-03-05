import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import NotificationModal from '../../components/NotificationModal';

const ShortCodeList = () => {
    const [menuItems, setMenuItems] = useState([]);
    const [isEditing, setIsEditing] = useState(null);
    const [editCode, setEditCode] = useState('');
    const { user } = useAuth();

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
        fetchMenu();
    }, []);

    const fetchMenu = async () => {
        try {
            const { data } = await axios.get('/menu');
            setMenuItems(data);
        } catch (error) {
            console.error('Error fetching menu:', error);
        }
    };

    const handleEditClick = (item) => {
        setIsEditing(item._id);
        setEditCode(item.shortCode || '');
    };

    const handleSave = async (id) => {
        try {
            await axios.put(`/menu/${id}`,
                { shortCode: editCode },
                { headers: { Authorization: `Bearer ${user.token}` } }
            );
            setIsEditing(null);
            fetchMenu();
            showNotification("Success", "Shortcode updated successfully", "success");
        } catch (error) {
            console.error(error);
            showNotification("Error", error.response?.data?.message || 'Error updating code', "error");
        }
    };

    return (
        <div style={{ padding: '20px' }}>
            <NotificationModal
                isOpen={notification.isOpen}
                onClose={closeNotification}
                title={notification.title}
                message={notification.message}
                type={notification.type}
                actionLabel={notification.actionLabel}
                onAction={notification.onAction}
            />
            <h2>Short Code Management</h2>
            <p style={{ color: '#666', marginBottom: '20px' }}>Quickly assign short codes to menu items.</p>

            <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', color: 'white' }}>
                    <thead>
                        <tr style={{ background: 'var(--primary)', color: 'white', textAlign: 'left' }}>
                            <th style={{ padding: '15px' }}>Item Name</th>
                            <th style={{ padding: '15px' }}>Category</th>
                            <th style={{ padding: '15px' }}>Price</th>
                            <th style={{ padding: '15px' }}>Short Code</th>
                            <th style={{ padding: '15px' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {menuItems.map(item => (
                            <tr key={item._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                <td style={{ padding: '15px' }}>{item.name}</td>
                                <td style={{ padding: '15px' }}>{item.category}</td>
                                <td style={{ padding: '15px' }}>₹{item.price}</td>
                                <td style={{ padding: '15px' }}>
                                    {isEditing === item._id ? (
                                        <input
                                            type="text"
                                            value={editCode}
                                            onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                                            style={{ padding: '8px', width: '100px', textTransform: 'uppercase', background: '#333', color: 'white', border: '1px solid #555', borderRadius: '4px' }}
                                        />
                                    ) : (
                                        <span style={{ fontWeight: 'bold', color: item.shortCode ? '#4CAF50' : 'rgba(255,255,255,0.3)' }}>
                                            {item.shortCode || '-'}
                                        </span>
                                    )}
                                </td>
                                <td style={{ padding: '15px' }}>
                                    {isEditing === item._id ? (
                                        <div style={{ display: 'flex', gap: '5px' }}>
                                            <button onClick={() => handleSave(item._id)} className="btn" style={{ padding: '5px 10px', background: '#4CAF50', fontSize: '12px' }}>Save</button>
                                            <button onClick={() => setIsEditing(null)} className="btn" style={{ padding: '5px 10px', background: '#757575', fontSize: '12px' }}>X</button>
                                        </div>
                                    ) : (
                                        <button onClick={() => handleEditClick(item)} className="btn btn-outline" style={{ padding: '5px 10px', fontSize: '12px' }}>Edit</button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ShortCodeList;
