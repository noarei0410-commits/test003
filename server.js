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

const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
};

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
        rooms[roomId].mainDeck = data.main.map(card => ({ ...card, id: uuidv4() }));
        rooms[roomId].cheerDeck = data.cheer.map(card => ({ ...card, id: uuidv4(), type: 'ayle' }));
        
        shuffleArray(rooms[roomId].mainDeck);
        shuffleArray(rooms[roomId].cheerDeck);

        const oshiId = uuidv4();
        rooms[roomId].fieldState[oshiId] = { 
            id: oshiId, name: data.oshi.name, type: 'oshi', 
            zoneId: 'oshi', zIndex: 100, isFaceUp: true, ...data.oshi 
        };

        const lifeCount = data.oshi.life || 0;
        for (let i = 0; i < lifeCount; i++) {
            if (rooms[roomId].cheerDeck.length > 0) {
                const lifeCard = rooms[roomId].cheerDeck.pop();
                rooms[roomId].fieldState[lifeCard.id] = { ...lifeCard, zoneId: 'life-zone', isFaceUp: false, isRotated: true, zIndex: 10 + i };
            }
        }
        io.to(roomId).emit('gameStarted', { fieldState: rooms[roomId].fieldState, deckCount: { main: rooms[roomId].mainDeck.length, cheer: rooms[roomId].cheerDeck.length } });
    });

    socket.on('inspectDeck', (type) => {
        const roomId = socket.roomId;
        if (!rooms[roomId]) return;
        const cards = type === 'main' ? rooms[roomId].mainDeck : rooms[roomId].cheerDeck;
        socket.emit('deckInspectionResult', { type, cards });
    });

    socket.on('pickCardFromDeck', ({ type, cardId }) => {
        const roomId = socket.roomId;
        if (!rooms[roomId] || socket.role !== 'player') return;
        let deck = type === 'main' ? rooms[roomId].mainDeck : rooms[roomId].cheerDeck;
        const cardIdx = deck.findIndex(c => c.id === cardId);
        if (cardIdx !== -1) {
            const card = deck.splice(cardIdx, 1)[0];
            shuffleArray(deck);
            socket.emit('receiveCard', card);
            io.to(roomId).emit('deckCount', { main: rooms[roomId].mainDeck.length, cheer: rooms[roomId].cheerDeck.length });
        }
    });

    socket.on('drawMainCard', () => {
        const roomId = socket.roomId;
        if (rooms[roomId] && rooms[roomId].mainDeck.length > 0) {
            const card = rooms[roomId].mainDeck.pop();
            socket.emit('receiveCard', card);
            io.to(roomId).emit('deckCount', { main: rooms[roomId].mainDeck.length, cheer: rooms[roomId].cheerDeck.length });
        }
    });

    socket.on('drawCheerCard', () => {
        const roomId = socket.roomId;
        if (rooms[roomId] && rooms[roomId].cheerDeck.length > 0) {
            const card = rooms[roomId].cheerDeck.pop();
            socket.emit('receiveCard', card);
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
