const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
// Initialize WebSocket server with path support
const wss = new WebSocket.Server({ 
    server,
    path: '/ws' // Explicit WebSocket path
});

const port = 3000;

// Serve static files
app.use(express.static('public'));

// Store connected clients
const viewers = new Set();
let broadcaster = null;

// WebSocket connection handling
wss.on('connection', (ws, req) => {
    console.log(`New WebSocket connection from ${req.socket.remoteAddress}`);
    
    // Send immediate confirmation of connection
    ws.send(JSON.stringify({ type: 'connection', status: 'connected' }));

    // Handle viewer registration
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'register') {
                if (data.role === 'viewer') {
                    viewers.add(ws);
                    console.log(`Viewer registered. Total viewers: ${viewers.size}`);
                    ws.send(JSON.stringify({ type: 'registration', status: 'success', role: 'viewer' }));
                } else if (data.role === 'broadcaster') {
                    broadcaster = ws;
                    console.log('Broadcaster registered');
                    ws.send(JSON.stringify({ type: 'registration', status: 'success', role: 'broadcaster' }));
                }
            } else if (ws === broadcaster) {
                // Forward video data to all viewers
                viewers.forEach(viewer => {
                    if (viewer.readyState === WebSocket.OPEN) {
                        viewer.send(message);
                    }
                });
            }
        } catch (error) {
            // Handle binary video data
            if (ws === broadcaster) {
                viewers.forEach(viewer => {
                    if (viewer.readyState === WebSocket.OPEN) {
                        viewer.send(message);
                    }
                });
            }
        }
    });

    ws.on('close', () => {
        if (viewers.has(ws)) {
            viewers.delete(ws);
            console.log(`Viewer disconnected. Total viewers: ${viewers.size}`);
        } else if (ws === broadcaster) {
            broadcaster = null;
            console.log('Broadcaster disconnected');
        }
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'broadcaster.html'));
});

app.get('/view', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'viewer.html'));
});

server.listen(port, '0.0.0.0', () => {
    console.log(`\nServer running at http://localhost:${port}`);
    console.log('\nAvailable on:');
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                console.log(`  http://${net.address}:${port}`);
                console.log(`  http://${net.address}:${port}/view (for viewers)`);
            }
        }
    }
});