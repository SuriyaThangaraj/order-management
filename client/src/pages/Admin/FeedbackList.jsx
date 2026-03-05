import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import NotificationModal from '../../components/NotificationModal';

const FeedbackList = () => {
    const { user } = useAuth();
    const [feedbacks, setFeedbacks] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

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
        fetchFeedbacks();
    }, []);

    const fetchFeedbacks = async () => {
        try {
            const { data } = await axios.get('/feedback', {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            setFeedbacks(data);
            setIsLoading(false);
        } catch (error) {
            console.error("Failed to fetch feedback", error);
            setIsLoading(false);
        }
    };

    const clearAllFeedback = async () => {
        if (!window.confirm("Are you sure you want to delete ALL feedback? This cannot be undone.")) return;

        try {
            await axios.delete('/feedback', {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            fetchFeedbacks(); // Refresh list
            showNotification("Success", "All feedback cleared!", "success");
        } catch (error) {
            console.error(error);
            showNotification("Error", "Failed to clear feedback", "error");
        }
    };

    if (isLoading) return <div className="p-4">Loading Feedback...</div>;

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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 className="page-title" style={{ margin: 0 }}>Customer Feedback</h2>
                {feedbacks.length > 0 && (
                    <button
                        onClick={clearAllFeedback}
                        style={{
                            background: '#d32f2f',
                            color: 'white',
                            border: 'none',
                            padding: '8px 15px',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        🗑️ Clear All
                    </button>
                )}
            </div>

            {feedbacks.length === 0 ? (
                <div style={{ color: 'white', fontSize: '18px', textAlign: 'center', marginTop: '50px', background: 'rgba(255,255,255,0.1)', padding: '20px', borderRadius: '10px' }}>
                    No feedback received yet.
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '15px' }}>
                    {feedbacks.map(item => (
                        <div key={item._id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px', color: '#333' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontWeight: 'bold', fontSize: '18px', color: '#e8fc0eff' }}>{item.rating} ⭐</span>
                                    <span style={{ color: '#555', fontSize: '14px' }}>Table {item.tableNo}</span>
                                </div>
                                <span style={{ fontSize: '12px', color: '#444' }}>
                                    {new Date(item.createdAt).toLocaleString()}
                                </span>
                            </div>

                            {item.comment && (
                                <div style={{ padding: '10px', background: '#f8f9fa', color: '#000', borderRadius: '8px', fontStyle: 'italic', borderLeft: '3px solid var(--primary-red)' }}>
                                    "{item.comment}"
                                </div>
                            )}

                            <div style={{ fontSize: '12px', color: '#555', alignSelf: 'flex-end', fontWeight: '500' }}>
                                - {item.customerName}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default FeedbackList;
