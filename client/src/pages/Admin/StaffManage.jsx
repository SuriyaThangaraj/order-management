import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import NotificationModal from '../../components/NotificationModal';

const StaffManage = () => {
    const [formData, setFormData] = useState({ username: '', password: '', role: 'waiter' });
    const [staffList, setStaffList] = useState([]);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [resetPwdId, setResetPwdId] = useState(null);
    const [newPassword, setNewPassword] = useState('');



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

    const { user, socket } = useAuth();
    const token = user?.token;

    const [onlineUsers, setOnlineUsers] = useState([]);

    useEffect(() => {
        if (socket) {
            socket.on('onlineUsersUpdate', (users) => {
                setOnlineUsers(users);
            });
            // Request initial state if needed, but server sends it on connect
        }
    }, [socket]);

    useEffect(() => {
        fetchStaff();
    }, []);

    const fetchStaff = async () => {
        try {
            const { data } = await axios.get('/auth/users', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStaffList(data);
        } catch (err) {
            console.error("Failed to fetch staff", err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        setError('');

        try {
            const { data } = await axios.post(
                '/auth/create-staff',
                formData,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setFormData({ username: '', password: '', role: 'waiter' });
            fetchStaff(); // Refresh list
            showNotification('Success', data.message, 'success');
        } catch (err) {
            showNotification('Error', err.response?.data?.message || 'Error creating account', 'error', 'Try Again');
        }
    };

    const handleDelete = async (id, username) => {
        if (!confirm(`Are you sure you want to delete user "${username}"?`)) return;

        try {
            await axios.delete(`/auth/users/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchStaff();
            showNotification('Deleted', 'User deleted successfully', 'success');
        } catch (err) {
            showNotification('Error', err.response?.data?.message || 'Delete failed', 'error');
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        if (!newPassword) return;

        try {
            await axios.put(
                `/auth/users/${resetPwdId}/password`,
                { password: newPassword },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setResetPwdId(null);
            setNewPassword('');

            showNotification('Success', 'Password updated successfully', 'success');
        } catch (err) {
            showNotification('Error', err.response?.data?.message || 'Password update failed', 'error');
        }
    };

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', color: '#fff' }}>
            <h2 className="page-title">Staff Management</h2>

            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', flexDirection: window.innerWidth < 768 ? 'column' : 'row' }}>
                {/* Create Form */}
                <div style={{ flex: '1', minWidth: '100%' }}>
                    <div className="card" style={{ background: '#2a2a2a', border: '1px solid #444', padding: '15px' }}>
                        <h3 style={{ marginBottom: '20px', color: '#4CAF50' }}>Create New Staff</h3>



                        {/* Messages handled by NotificationModal now */}

                        <form onSubmit={handleSubmit}>
                            <div className="input-group">
                                <label className="input-label">Username</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    required
                                    style={{ background: '#333', color: 'white', border: '1px solid #555' }}
                                />
                            </div>

                            {/* <div className="input-group">
                                <label className="input-label">Email (Optional for Staff)</label>
                                <input
                                    type="email"
                                    className="form-control"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    style={{ background: '#333', color: 'white', border: '1px solid #555' }}
                                />
                            </div> */}

                            <div className="input-group">
                                <label className="input-label">Password</label>
                                <input
                                    type="password"
                                    className="form-control"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    required
                                    style={{ background: '#333', color: 'white', border: '1px solid #555' }}
                                />
                            </div>

                            <div className="input-group">
                                <label className="input-label">Role</label>
                                <select
                                    className="form-control"
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    style={{ background: '#333', color: 'white', border: '1px solid #555' }}
                                >
                                    <option value="waiter">Waiter</option>
                                    <option value="kitchen">Kitchen</option>
                                </select>
                            </div>

                            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                                Create Account
                            </button>
                        </form>
                    </div>
                </div>

                {/* Staff List */}
                <div style={{ flex: '1', minWidth: '100%', marginTop: '20px' }}>
                    <div className="card" style={{ background: '#2a2a2a', border: '1px solid #444', padding: '15px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, color: '#2196F3' }}>Staff List</h3>
                            <span style={{ background: '#444', padding: '5px 10px', borderRadius: '12px', fontSize: '14px' }}>
                                Total Users: {staffList.length}
                            </span>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                <thead>
                                    <tr style={{ background: '#333', textAlign: 'left' }}>
                                        <th style={{ padding: '10px' }}>Username</th>
                                        <th style={{ padding: '10px' }}>Role</th>
                                        <th style={{ padding: '10px' }}>Email</th>
                                        <th style={{ padding: '10px' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {staffList.map(item => (
                                        <tr key={item._id} style={{ borderBottom: '1px solid #444' }}>
                                            <td style={{ padding: '10px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{
                                                        height: '10px',
                                                        width: '10px',
                                                        borderRadius: '50%',
                                                        background: onlineUsers.some(u => u.username === item.username) ? '#4CAF50' : '#757575',
                                                        display: 'inline-block'
                                                    }}></span>
                                                    {item.username}
                                                </div>
                                            </td>
                                            <td style={{ padding: '10px' }}>
                                                <span style={{
                                                    padding: '2px 8px',
                                                    borderRadius: '4px',
                                                    background: item.role === 'admin' ? '#9C27B0' : (item.role === 'waiter' ? '#FF9800' : '#4CAF50'),
                                                    fontSize: '12px'
                                                }}>
                                                    {item.role}
                                                </span>
                                            </td>
                                            <td style={{ padding: '10px', color: '#aaa' }}>{item.email || '-'}</td>
                                            <td style={{ padding: '10px' }}>
                                                {/* Allow deleting anyone EXCEPT self (backend also checks this) */}
                                                {item.username !== user.username && (
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <button
                                                            onClick={() => setResetPwdId(item._id)}
                                                            style={{ background: '#2196F3', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                                                            title="Reset Password"
                                                        >
                                                            Reset Pwd
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(item._id, item.username)}
                                                            style={{ background: '#f44336', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                                                            title="Delete User"
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Password Reset Modal (Simple Overlay) */}
            {resetPwdId && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div style={{ background: '#333', padding: '30px', borderRadius: '8px', minWidth: '300px' }}>
                        <h3 style={{ marginTop: 0 }}>Reset Password</h3>
                        <form onSubmit={handleResetPassword}>
                            <div style={{ marginBottom: '20px' }}>
                                <input
                                    type="text"
                                    placeholder="Enter new password"
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #444', background: '#222', color: 'white' }}
                                    required
                                />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                <button type="button" onClick={() => { setResetPwdId(null); setNewPassword(''); }} className="btn" style={{ background: '#666' }}>Cancel</button>
                                <button type="submit" className="btn" style={{ background: '#2196F3' }}>Update</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Notification Modal */}
            <NotificationModal
                isOpen={notification.isOpen}
                onClose={closeNotification}
                title={notification.title}
                message={notification.message}
                type={notification.type}
                actionLabel={notification.actionLabel}
                onAction={notification.onAction}
            />
        </div>
    );
};

export default StaffManage;
