import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import NotificationModal from '../../components/NotificationModal';

const MenuManage = () => {
    const [menuItems, setMenuItems] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ name: '', price: '', category: '', image: null });
    const { user } = useAuth();
    const token = user?.token;

    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

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
        if (token) {
            fetchMenu();
        }
    }, [token]);

    const fetchMenu = async () => {
        if (!token) return;
        try {
            const { data } = await axios.get('/menu', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMenuItems(data);
        } catch (error) {
            console.error('Error fetching menu:', error);
        }
    };

    const handleDelete = async (id) => {
        if (!token) return showNotification("Error", "User not authenticated", "error");
        if (!window.confirm('Are you sure you want to delete this item?')) return;
        try {
            await axios.delete(`/menu/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchMenu();
        } catch (error) {
            console.error(error);
        }
    };

    const toggleAvailability = async (item) => {
        if (!token) return showNotification("Error", "User not authenticated", "error");
        try {
            await axios.put(`/menu/${item._id}`,
                { isAvailable: !item.isAvailable },
                { headers: { Authorization: `Bearer ${token}` } });
            fetchMenu();
        } catch (error) {
            console.error(error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!token) return showNotification("Error", "User not authenticated. Please login again.", "error");

        const data = new FormData();
        data.append('name', formData.name);
        data.append('price', formData.price);
        data.append('category', formData.category);
        if (formData.shortCode) data.append('shortCode', formData.shortCode);
        data.append('image', formData.image);

        try {
            await axios.post('/menu', data, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            setShowForm(false);
            setFormData({ name: '', price: '', category: '', image: null, shortCode: '' });
            fetchMenu();
            showNotification("Success", "Item added successfully", "success");
        } catch (error) {
            showNotification("Error", "Error adding item", "error");
            console.error(error);
        }
    };

    return (
        <div>
            <NotificationModal
                isOpen={notification.isOpen}
                onClose={closeNotification}
                title={notification.title}
                message={notification.message}
                type={notification.type}
                actionLabel={notification.actionLabel}
                onAction={notification.onAction}
            />
            <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '15px' }}>
                <h2 className="page-title" style={{ marginBottom: 0, fontSize: isMobile ? '20px' : '24px' }}>Menu Management</h2>
                <button className="btn btn-primary" style={{ fontSize: isMobile ? '13px' : '15px' }} onClick={() => setShowForm(!showForm)}>
                    {showForm ? 'Cancel' : '+ Add New Item'}
                </button>
            </div>

            {showForm && (
                <div className="card" style={{ marginBottom: '30px', borderLeft: '4px solid var(--primary-red)' }}>
                    <h3 style={{ fontSize: '18px' }}>Add New Item</h3>
                    <form onSubmit={handleSubmit} style={{
                        marginTop: '20px',
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                        gap: '15px'
                    }}>
                        <div className="input-group">
                            <label className="input-label">Item Name</label>
                            <input type="text" className="form-control" required
                                value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Price (₹)</label>
                            <input type="number" className="form-control" required
                                value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Category</label>
                            <input
                                type="text"
                                list="category-suggestions"
                                className="form-control"
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                                placeholder="Type or select category"
                                required
                            />
                            <datalist id="category-suggestions">
                                {[...new Set(menuItems.map(item => item.category))].sort().map(cat => (
                                    <option key={cat} value={cat} />
                                ))}
                            </datalist>
                        </div>
                        <div className="input-group">
                            <label className="input-label">Short Code (Unique)</label>
                            <input type="text" className="form-control"
                                placeholder="e.g. 101, CB, PIZ1"
                                value={formData.shortCode || ''}
                                onChange={e => setFormData({ ...formData, shortCode: e.target.value.toUpperCase() })} />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Food Image (Optional)</label>
                            <input type="file" className="form-control" accept="image/*"
                                onChange={e => setFormData({ ...formData, image: e.target.files[0] })} />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ gridColumn: isMobile ? 'span 1' : 'span 2' }}>Add Item to Menu</button>
                    </form>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
                {menuItems.map(item => (
                    <div key={item._id} className="card" style={{ padding: '0', overflow: 'hidden', opacity: item.isAvailable ? 1 : 0.6 }}>
                        <div style={{ height: '150px', background: '#eee', position: 'relative' }}>
                            <img
                                src={`${import.meta.env.VITE_API_URL.replace('/api', '')}${item.imageUrl}`}
                                alt={item.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => { e.target.src = 'https://via.placeholder.com/300?text=No+Image' }}
                            />
                            {item.shortCode && (
                                <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                                    {item.shortCode}
                                </div>
                            )}
                            {!item.isAvailable && <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'red' }}>UNAVAILABLE</div>}
                        </div>
                        <div style={{ padding: '15px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                <h4 style={{ marginBottom: '5px' }}>{item.name}</h4>
                                <span style={{ fontWeight: 'bold', color: 'var(--primary-red)' }}>₹{item.price}</span>
                            </div>
                            <p style={{ color: '#888', fontSize: '14px', marginBottom: '15px' }}>{item.category}</p>

                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button className={`btn ${item.isAvailable ? 'btn-outline' : 'btn-primary'}`}
                                    style={{ flex: 1, padding: '5px', fontSize: '13px' }}
                                    onClick={() => toggleAvailability(item)}
                                >
                                    {item.isAvailable ? 'Disable' : 'Enable'}
                                </button>
                                <button className="btn btn-outline" style={{ borderColor: '#ccc', color: '#666', padding: '5px 10px' }}
                                    onClick={() => handleDelete(item._id)}
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MenuManage;
