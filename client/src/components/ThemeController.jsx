import { useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';

const ThemeController = () => {
    useEffect(() => {
        const fetchBranding = async () => {
            try {
                // Fetch public branding settings (no auth needed)
                const { data } = await axios.get('/settings/branding');
                applyBranding(data);
            } catch (error) {
                console.error("Failed to fetch branding:", error);
            }
        };

        const applyBranding = (data) => {
            const root = document.documentElement;

            // Apply Theme Color
            if (data.themeColor) {
                root.style.setProperty('--primary', data.themeColor);
                // Simple hover calculation: darken by 20%? Or just same color.
                // For now, let's keep it simple or use a filtered version if needed.
                root.style.setProperty('--primary-hover', data.themeColor);
            }

            // Apply Nav Color (Convert Hex to RGB for opacity usage)
            if (data.navColor) {
                const hex = data.navColor.replace('#', '');
                const r = parseInt(hex.substring(0, 2), 16);
                const g = parseInt(hex.substring(2, 4), 16);
                const b = parseInt(hex.substring(4, 6), 16);
                root.style.setProperty('--nav-rgb', `${r}, ${g}, ${b}`);
            } else {
                root.style.setProperty('--nav-rgb', '0, 0, 0'); // Default Black
            }

            // Apply Nav Opacity
            if (data.navOpacity !== undefined) {
                root.style.setProperty('--nav-opacity', data.navOpacity);
            } else {
                root.style.setProperty('--nav-opacity', '0.4');
            }

            // Apply App Background Color
            if (data.backgroundColor) {
                root.style.setProperty('--bg-dark', data.backgroundColor);
                // Also update bg-light to match or be slightly lighter/darker if needed?
                // For now, let's assume single solid color for the main bg.
                root.style.setProperty('--bg-light', data.backgroundColor);
            }

            // Apply Watermark
            if (data.watermarkUrl) {
                // Handle relative URL from proxy
                const baseUrl = import.meta.env.VITE_API_URL.replace('/api', '');
                const fullUrl = `url('${baseUrl}${data.watermarkUrl}')`;
                root.style.setProperty('--watermark-url', fullUrl);
            } else {
                root.style.setProperty('--watermark-url', 'none');
            }

            // Apply Watermark Opacity
            if (data.watermarkOpacity !== undefined) {
                root.style.setProperty('--watermark-opacity', data.watermarkOpacity);
            } else {
                root.style.setProperty('--watermark-opacity', '0.1');
            }

            // Apply Watermark Size
            if (data.watermarkSize) {
                root.style.setProperty('--watermark-size', data.watermarkSize);
            } else {
                root.style.setProperty('--watermark-size', '300px');
            }

            // Apply Card Opacity
            if (data.cardOpacity !== undefined) {
                root.style.setProperty('--card-opacity', data.cardOpacity);
            } else {
                root.style.setProperty('--card-opacity', '0.8');
            }
        };

        fetchBranding();

        // Real-time Updates
        const socket = io(import.meta.env.VITE_SOCKET_URL);
        socket.on('brandingUpdated', (data) => {
            console.log("Branding updated via socket:", data);
            applyBranding(data);
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    return null; // Renderless component
};

export default ThemeController;
