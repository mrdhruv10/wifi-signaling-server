// Simple Signaling Server for P2P WebRTC
// Run: node signaling-server.js

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

// Store connected users
const users = new Map();

io.on('connection', (socket) => {
    console.log('New connection:', socket.id);

    // Register user with their ID
    socket.on('register', (userId) => {
        users.set(userId, socket.id);
        console.log(`User registered: ${userId} -> ${socket.id}`);
        socket.userId = userId;
    });

    // Handle call request
    socket.on('call', ({ from, to, offer }) => {
        const targetSocketId = users.get(to);
        
        if (targetSocketId) {
            io.to(targetSocketId).emit('incoming-call', {
                from: from,
                offer: offer
            });
            console.log(`Call from ${from} to ${to}`);
        } else {
            socket.emit('call-failed', { message: 'User not found or offline' });
            console.log(`Call failed: ${to} not found`);
        }
    });

    // Handle call answer (from web)
    socket.on('call-answer', ({ to, answer }) => {
        const targetSocketId = users.get(to);
        
        if (targetSocketId) {
            io.to(targetSocketId).emit('call-answer', {
                answer: answer
            });
            console.log(`Call answered: ${socket.userId} -> ${to}`);
        }
    });
    
    // Handle call accepted (from Flutter)
    socket.on('call-accepted', ({ from, to }) => {
        const targetSocketId = users.get(to);
        
        if (targetSocketId) {
            io.to(targetSocketId).emit('call-accepted', {
                from: from
            });
            console.log(`Call accepted: ${from} -> ${to}`);
        }
    });

    // Handle ICE candidates
    socket.on('ice-candidate', ({ to, candidate }) => {
        const targetSocketId = users.get(to);
        
        if (targetSocketId) {
            io.to(targetSocketId).emit('ice-candidate', {
                candidate: candidate
            });
        }
    });

    // Handle call rejection
    socket.on('call-rejected', ({ to }) => {
        const targetSocketId = users.get(to);
        
        if (targetSocketId) {
            io.to(targetSocketId).emit('call-ended');
        }
    });
    
    // Handle end call
    socket.on('end-call', ({ from }) => {
        // Broadcast to all users except sender
        socket.broadcast.emit('call-ended');
        console.log(`Call ended by: ${from}`);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        if (socket.userId) {
            users.delete(socket.userId);
            console.log(`User disconnected: ${socket.userId}`);
        }
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`✅ Signaling server running on port ${PORT}`);
    console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}`);
});
