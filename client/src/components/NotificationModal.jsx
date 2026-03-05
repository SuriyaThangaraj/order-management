
import React, { useEffect } from 'react';
import './NotificationModal.css';
import { playNotificationSound } from '../assets/sounds';

const NotificationModal = ({ isOpen, onClose, title, message, type = 'info', actionLabel = 'View Details', onAction }) => {

    // Play sound on open
    useEffect(() => {
        if (isOpen) {
            playNotificationSound();
        }
    }, [isOpen]);

    // Close on Escape key
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            window.addEventListener('keydown', handleEsc);
        }
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    // Handle background click to close
    const handleOverlayClick = (e) => {
        if (e.target.className === 'notification-overlay') {
            onClose();
        }
    };

    // Determine Logic based on 'type' if we want to change icons/colors
    // For now, adhering strictly to the image style provided (Bell Icon)
    // But allowing title/message customization.

    // Determine Icon based on type
    const getIcon = () => {
        switch (type) {
            case 'success':
                return <span className="notification-emoji">😊</span>;
            case 'error':
                return <span className="notification-emoji">😔</span>;
            case 'warning':
                return <span className="notification-emoji">⚠️</span>;
            default:
                // Default Info - can be a neutral happy face or the bell
                return <span className="notification-emoji">🔔</span>;
        }
    };

    const handleAction = () => {
        if (onAction) onAction();
        else onClose(); // Default to close if no specific action
    };

    return (
        <div className="notification-overlay" onClick={handleOverlayClick}>
            <div className={`notification-card type-${type}`}>
                {/* Floating Icon Wrapper */}
                <div className="icon-wrapper">
                    {getIcon()}

                    {/* Badge Count (only show if it makes sense, or maybe remove for emojis? keeping it simple for now) */}
                    {/* <div className="notification-badge">1</div> */}
                </div>

                {/* Close 'X' Button */}
                <button className="close-btn" onClick={onClose}>
                    &times;
                </button>

                {/* Content */}
                <h2 className="notification-title">{title || 'New Notification'}</h2>
                <p className="notification-message">
                    {message || 'You have a new message.'}
                </p>

                {/* Action Button */}
                <button className="notification-action-btn" onClick={handleAction}>
                    {actionLabel} <span className="arrow-icon">&rarr;</span>
                </button>
            </div>
        </div>
    );
};

export default NotificationModal;
