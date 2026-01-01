/**
 * Simple WebSocket Echo Server for Testing
 * 
 * This server echoes back any message it receives.
 * Run with: node test-server.js
 */

const WebSocket = require('ws');

const PORT = 8080;
const wss = new WebSocket.Server({ port: PORT });

console.log(`WebSocket Echo Server started on ws://localhost:${PORT}`);

wss.on('connection', (ws) => {
  console.log('Client connected');
  
  ws.on('message', (message) => {
    console.log('Received:', message.toString());
    // Echo the message back
    ws.send(`Echo: ${message.toString()}`);
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
  });
  
  // Send a welcome message
  ws.send('Welcome to WebSocket Echo Server!');
});
