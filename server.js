const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let rooms = {};

io.on('connection', (socket) => {
    socket.on('joinRoom', ({ roomId, role }) => {
        socket.join(roomId);
        socket.roomId = roomId;
        socket.role = role;
        if (!rooms[roomId]) {
            rooms[roomId] = { fieldState: {}, mainDeck: [], cheerDeck: [], players: [] };
        }
        if (role === 'player') rooms[roomId].players.push(socket.id);
        socket.emit('init', { id: socket.id, role: role, fieldState: rooms[roomId].fieldState });
        io.to(roomId).emit('deckCount', { main: rooms[roomId].mainDeck.length, cheer: rooms[roomId].cheerDeck.length });
    });

    socket.on('setGame', (data) => {
        const roomId = socket.roomId;
        if (!rooms[roomId] || socket.role !== 'player') return;

        rooms[roomId].fieldState = {}; 
        // データを丸ごとコピーして保持するように修正
        rooms[roomId].mainDeck = data.main.map(card => ({ ...card, id: uuidv4() }));
        rooms[roomId].cheerDeck = data.cheer.map(card => ({ ...card, id: uuidv4(), type: 'ayle' }));
        
        const shuffle = (array) => {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
        };
        shuffle(rooms[roomId].mainDeck);
        shuffle(rooms[roomId].cheerDeck);

        const oshiId = uuidv4();
        rooms[roomId].fieldState[oshiId] = {
            id: oshiId, name: data.oshi.name, type: 'holomen',
            zoneId: 'oshi', zIndex: 100, isFaceUp: true
        };

        io.to(roomId).emit('gameStarted', { 
            fieldState: rooms[roomId].fieldState, 
            deckCount: { main: rooms[roomId].mainDeck.length, cheer: rooms[roomId].cheerDeck.length } 
        });
    });

    socket.on('drawMainCard', () => {
        const roomId = socket.roomId;
        if (rooms[roomId] && rooms[roomId].mainDeck.length > 0) {
            socket.emit('receiveCard', rooms[roomId].mainDeck.pop());
            io.to(roomId).emit('deckCount', { main: rooms[roomId].mainDeck.length, cheer: rooms[roomId].cheerDeck.length });
        }
    });
    socket.on('drawCheerCard', () => {
        const roomId = socket.roomId;
        if (rooms[roomId] && rooms[roomId].cheerDeck.length > 0) {
            socket.emit('receiveCard', rooms[roomId].cheerDeck.pop());
            io.to(roomId).emit('deckCount', { main: rooms[roomId].mainDeck.length, cheer: rooms[roomId].cheerDeck.length });
        }
    });
    socket.on('moveCard', (data) => {
        const roomId = socket.roomId;
        if (rooms[roomId]) {
            rooms[roomId].fieldState[data.id] = { ...rooms[roomId].fieldState[data.id], ...data };
            socket.to(roomId).emit('cardMoved', data);
        }
    });
    socket.on('returnToHand', (data) => {
        const roomId = socket.roomId;
        if (rooms[roomId]) { delete rooms[roomId].fieldState[data.id]; socket.to(roomId).emit('cardRemoved', { id: data.id }); }
    });
    socket.on('flipCard', (data) => {
        const roomId = socket.roomId;
        if (rooms[roomId] && rooms[roomId].fieldState[data.id]) {
            rooms[roomId].fieldState[data.id].isFaceUp = data.isFaceUp;
            socket.to(roomId).emit('cardFlipped', data);
        }
    });
    socket.on('disconnect', () => {
        const roomId = socket.roomId;
        if (rooms[roomId]) rooms[roomId].players = rooms[roomId].players.filter(id => id !== socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`));
