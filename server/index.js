const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

dotenv.config(); // Must be called before requiring db

const connectDB = require('./db');
connectDB();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for simplicity in local network dev
        methods: ["GET", "POST", "PUT", "DELETE"],
    },
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads')); // Serve uploaded images

app.get('/', (req, res) => {
    res.json({
        message: 'API is running',
        dbConnected: global.dbConnected,
        dbError: global.dbError
    });
});
// Nodemon trigger 3

// Routes
const authRoutes = require('./routes/auth');
const menuRoutes = require('./routes/menu');
const orderRoutes = require('./routes/orders');
const settingsRoutes = require('./routes/settings');
const uploadRoutes = require('./routes/upload');
const feedbackRoutes = require('./routes/feedback'); // New feedback route import

app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/feedback', feedbackRoutes); // New feedback route usage

// Socket.IO
// Store online users: socketId -> { userId, role, username }
let onlineUsers = new Map();

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Initial emit of active users to the new connector (mainly for admins)
    socket.emit('onlineUsersUpdate', Array.from(onlineUsers.values()));

    socket.on('identify', (userData) => {
        // userData: { userId, role, username }
        onlineUsers.set(socket.id, userData);
        console.log(`User identified: ${userData.username} (${userData.role})`);

        console.log(`Socket ${socket.id} identified: ${userData.username}`);

        // Broadcast update to all clients
        io.emit('onlineUsersUpdate', Array.from(onlineUsers.values()));
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        if (onlineUsers.has(socket.id)) {
            const userData = onlineUsers.get(socket.id);
            onlineUsers.delete(socket.id);

            // Broadcast update to Tenant Room
            // Broadcast update to all
            io.emit('onlineUsersUpdate', Array.from(onlineUsers.values()));
        }
    });
});

// Make io accessible in routes
app.set('io', io);

const PORT = process.env.PORT || 5000;

// Forced restart for updates 
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
