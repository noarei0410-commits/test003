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

function broadcastRoomList() {
    const list = Object.keys(rooms).map(id => ({
        id, playerCount: rooms[id].players.length, spectatorCount: rooms[id].spectators.length
    }));
    io.emit('roomListUpdate', list);
}

io.on('connection', (socket) => {
    broadcastRoomList();

    socket.on('joinRoom', ({ roomId, role }) => {
        socket.join(roomId); socket.roomId = roomId;
        if (!rooms[roomId]) rooms[roomId] = { fieldState: {}, mainDeck: [], cheerDeck: [], players: [], spectators: [] };
        if (role === 'player') rooms[roomId].players.push(socket.id);
        else rooms[roomId].spectators.push(socket.id);
        
        socket.emit('init', { id: socket.id, role, fieldState: rooms[roomId].fieldState, deckCount: { main: rooms[roomId].mainDeck.length, cheer: rooms[roomId].cheerDeck.length } });
        broadcastRoomList();
    });

    socket.on('setGame', (data) => {
        const rid = socket.roomId; if (!rooms[rid]) return;
        rooms[rid].fieldState = {}; 
        rooms[rid].mainDeck = data.main.map(c => ({ ...c, id: uuidv4(), currentHp: c.hp }));
        rooms[rid].cheerDeck = data.cheer.map(c => ({ ...c, id: uuidv4(), type: 'ayle' }));
        [rooms[rid].mainDeck, rooms[rid].cheerDeck].forEach(d => { for(let i=d.length-1; i>0; i--){ const j=Math.floor(Math.random()*(i+1)); [d[i],d[j]]=[d[j],d[i]]; } });

        const oId = uuidv4(); rooms[rid].fieldState[oId] = { ...data.oshi, id: oId, type: 'oshi', zoneId: 'oshi', zIndex: 100, isFaceUp: true };
        const lc = data.oshi.life || 0;
        for (let i = 0; i < lc; i++) {
            if (rooms[rid].cheerDeck.length > 0) {
                const c = rooms[rid].cheerDeck.pop();
                rooms[rid].fieldState[c.id] = { ...c, zoneId: 'life-zone', isFaceUp: false, isRotated: true, zIndex: 10 + i };
            }
        }
        io.to(rid).emit('gameStarted', { fieldState: rooms[rid].fieldState, deckCount: { main: rooms[rid].mainDeck.length, cheer: rooms[rid].cheerDeck.length } });
    });

    socket.on('drawMainCard', () => {
        const r = rooms[socket.roomId];
        if (r && r.mainDeck.length > 0) { socket.emit('receiveCard', r.mainDeck.pop()); io.to(socket.roomId).emit('deckCount', { main: r.mainDeck.length, cheer: r.cheerDeck.length }); }
    });

    socket.on('drawCheerCard', () => {
        const r = rooms[socket.roomId];
        if (r && r.cheerDeck.length > 0) { socket.emit('receiveCard', r.cheerDeck.pop()); io.to(socket.roomId).emit('deckCount', { main: r.mainDeck.length, cheer: r.cheerDeck.length }); }
    });

    socket.on('generateHoloPower', () => {
        const r = rooms[socket.roomId];
        if (r && r.mainDeck.length > 0) {
            const c = r.mainDeck.pop(); const pc = { ...c, id: uuidv4(), zoneId: 'holopower', isFaceUp: false, isRotated: true, zIndex: 200 + Object.keys(r.fieldState).length };
            r.fieldState[pc.id] = pc; io.to(socket.roomId).emit('cardMoved', pc); io.to(socket.roomId).emit('deckCount', { main: r.mainDeck.length, cheer: r.cheerDeck.length });
        }
    });

    socket.on('moveCard', (data) => { if (rooms[socket.roomId]) { rooms[socket.roomId].fieldState[data.id] = { ...rooms[socket.roomId].fieldState[data.id], ...data }; socket.to(socket.roomId).emit('cardMoved', data); } });
    socket.on('updateHp', (d) => { if (rooms[socket.roomId] && rooms[socket.roomId].fieldState[d.id]) { rooms[socket.roomId].fieldState[d.id].currentHp = d.currentHp; io.to(socket.roomId).emit('hpUpdated', d); } });
    socket.on('returnToHand', (d) => { if (rooms[socket.roomId]) { delete rooms[socket.roomId].fieldState[d.id]; socket.to(socket.roomId).emit('cardRemoved', { id: d.id }); } });
    socket.on('flipCard', (d) => { if (rooms[socket.roomId] && rooms[socket.roomId].fieldState[d.id]) { rooms[socket.roomId].fieldState[d.id].isFaceUp = d.isFaceUp; socket.to(socket.roomId).emit('cardFlipped', d); } });
    socket.on('inspectDeck', (type) => { const r = rooms[socket.roomId]; if (r) socket.emit('deckInspectionResult', { type, cards: type === 'main' ? r.mainDeck : r.cheerDeck }); });
    socket.on('pickCardFromDeck', ({ type, cardId }) => {
        const r = rooms[socket.roomId]; let deck = type === 'main' ? r.mainDeck : r.cheerDeck;
        const idx = deck.findIndex(c => c.id === cardId);
        if (idx !== -1) { const c = deck.splice(idx, 1)[0]; deck.sort(() => Math.random() - 0.5); socket.emit('receiveCard', c); io.to(socket.roomId).emit('deckCount', { main: r.mainDeck.length, cheer: r.cheerDeck.length }); }
    });

    socket.on('disconnect', () => {
        const r = rooms[socket.roomId];
        if (r) { r.players = r.players.filter(id => id !== socket.id); r.spectators = r.spectators.filter(id => id !== socket.id); if (r.players.length === 0 && r.spectators.length === 0) delete rooms[socket.roomId]; broadcastRoomList(); }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`));
