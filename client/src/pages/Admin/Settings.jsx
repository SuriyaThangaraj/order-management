import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

const Settings = () => {
    const { user } = useAuth();

    const [tableCount, setTableCount] = useState(20);
    const [soundUrl, setSoundUrl] = useState(null);
    const [file, setFile] = useState(null);
    const [message, setMessage] = useState('');

    // Branding State (Removed for now, handled by backend default or previous settings)
    const [themeColor] = useState('#E23744');

    useEffect(() => {
        fetchSettings();
        fetchTableConfig();
        // Branding fetched by ThemeController directly
    }, []);

    const fetchTableConfig = async () => {
        try {
            // Hardcoded URL for now as per user pattern, ideally use env
            const { data } = await axios.get('/settings/table-config', {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            setTableCount(data.tableCount);
        } catch (error) {
            console.error(error);
        }
    }

    const handleTableConfigSubmit = async (e) => {
        e.preventDefault();
        try {
            setMessage('Updating tables...');
            const { data } = await axios.post('/settings/table-config', { tableCount: parseInt(tableCount) }, {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            setTableCount(data.tableCount);
            setMessage('Table count updated!');
        } catch (error) {
            console.error(error);
            setMessage('Update failed');
        }
    }

    const fetchSettings = async () => {
        try {
            const { data } = await axios.get('/settings/notification-sound', {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            setSoundUrl(data.soundUrl);
        } catch (error) {
            console.error("Failed to fetch settings", error);
        }
    };

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
        setMessage('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file) return;

        const formData = new FormData();
        formData.append('sound', file);

        try {
            setMessage('Uploading...');
            const { data } = await axios.post('/settings/notification-sound', formData, {
                headers: {
                    Authorization: `Bearer ${user.token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            setSoundUrl(data.soundUrl);
            setMessage('Sound updated successfully!');
            setFile(null);
        } catch (error) {
            console.error(error);
            setMessage('Upload failed');
        }
    };

    const [currentAudio, setCurrentAudio] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);

    // Stop audio when component unmounts or sound changes
    useEffect(() => {
        return () => {
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.currentTime = 0;
            }
        };
    }, [currentAudio]);

    const toggleSound = () => {
        if (isPlaying && currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
            setIsPlaying(false);
            setCurrentAudio(null);
        } else {
            if (soundUrl) {
                const baseUrl = import.meta.env.VITE_API_URL.replace('/api', '');
                const fullUrl = `${baseUrl}${soundUrl}`;
                const audio = new Audio(fullUrl);

                audio.onended = () => {
                    setIsPlaying(false);
                    setCurrentAudio(null);
                };

                audio.play().catch(e => console.error(e));
                setCurrentAudio(audio);
                setIsPlaying(true);
            }
        }
    };

    return (
        <div style={{ padding: '20px', color: 'white', maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{ borderBottom: '1px solid #555', paddingBottom: '10px', marginBottom: '20px' }}>Settings</h2>

            {/* Restaurant Configuration */}
            <div className="card" style={{ padding: '30px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)', marginBottom: '30px' }}>
                <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#ddd' }}>Restaurant Configuration</h3>
                <form onSubmit={handleTableConfigSubmit}>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '10px', color: '#ddd' }}>Total Tables</label>
                        <input
                            type="number"
                            min="1"
                            value={tableCount}
                            onChange={(e) => setTableCount(e.target.value)}
                            style={{
                                display: 'block',
                                width: '100%',
                                padding: '10px',
                                background: '#333',
                                border: '1px solid #444',
                                borderRadius: '4px',
                                color: 'white'
                            }}
                        />
                        <p style={{ fontSize: '12px', color: '#aaa', marginTop: '5px' }}>Number of availability tables in the waiter app.</p>
                    </div>
                    <button
                        type="submit"
                        className="btn"
                        style={{
                            background: '#2196F3',
                            color: 'white',
                            border: 'none',
                            padding: '10px 20px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        Save Configuration
                    </button>
                </form>
            </div>

            <div className="card" style={{ background: '#2a2a2a', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
                <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#ddd' }}>Notification Sound</h3>

                <div style={{ marginBottom: '30px', padding: '15px', background: '#333', borderRadius: '8px' }}>
                    <p style={{ marginTop: 0, color: '#aaa', fontSize: '14px' }}>Current Sound Status</p>
                    {soundUrl ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#4CAF50' }}>
                                Custom sound is set
                            </div>
                            <button
                                onClick={toggleSound}
                                className="btn"
                                style={{
                                    background: isPlaying ? '#f44336' : '#2196F3',
                                    color: 'white',
                                    border: 'none',
                                    padding: '8px 16px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    minWidth: '120px'
                                }}
                            >
                                {isPlaying ? '⏹ Stop Sound' : '▶ Play Sound'}
                            </button>
                        </div>
                    ) : (
                        <p style={{ color: '#fff' }}>Using default system beep</p>
                    )}
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '10px', color: '#ddd' }}>Upload New Sound</label>
                        <input
                            type="file"
                            accept="audio/*"
                            onChange={handleFileChange}
                            style={{
                                display: 'block',
                                width: '100%',
                                padding: '10px',
                                background: '#333',
                                border: '1px solid #444',
                                borderRadius: '4px',
                                color: 'white'
                            }}
                        />
                        <p style={{ fontSize: '12px', color: '#777', marginTop: '5px' }}>Supported formats: MP3, WAV, OGG</p>
                    </div>

                    <button
                        type="submit"
                        disabled={!file}
                        className="btn"
                        style={{
                            background: file ? '#4CAF50' : '#444',
                            color: 'white',
                            border: 'none',
                            padding: '10px 20px',
                            borderRadius: '4px',
                            cursor: file ? 'pointer' : 'not-allowed',
                            width: '100%',
                            fontWeight: 'bold'
                        }}
                    >
                        {file ? 'Upload & Set Sound' : 'Select a file to upload'}
                    </button>
                </form>

                {message && (
                    <div style={{
                        marginTop: '20px',
                        padding: '10px',
                        borderRadius: '4px',
                        background: message.includes('failed') ? 'rgba(244, 67, 54, 0.1)' : 'rgba(76, 175, 80, 0.1)',
                        color: message.includes('failed') ? '#ff5252' : '#69f0ae',
                        textAlign: 'center'
                    }}>
                        {message}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Settings;
