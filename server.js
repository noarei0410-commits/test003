const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// ルームごとの状態を保持するオブジェクト
let rooms = {};

io.on('connection', (socket) => {
    socket.on('joinRoom', ({ roomId, role }) => {
        socket.join(roomId);
        socket.roomId = roomId;
        socket.role = role; // 'player' or 'spectator'

        // ルームの初期化（存在しない場合）
        if (!rooms[roomId]) {
            rooms[roomId] = {
                fieldState: {},
                mainDeck: [],
                cheerDeck: [],
                players: []
            };
        }

        if (role === 'player') rooms[roomId].players.push(socket.id);

        // 入室したクライアントに現在の状態を送信
        socket.emit('init', { 
            id: socket.id, 
            role: role,
            fieldState: rooms[roomId].fieldState 
        });

        // 山札の枚数を同期
        io.to(roomId).emit('deckCount', { 
            main: rooms[roomId].mainDeck.length, 
            cheer: rooms[roomId].cheerDeck.length 
        });

        console.log(`User ${socket.id} joined room ${roomId} as ${role}`);
    });

    socket.on('setGame', (data) => {
        const roomId = socket.roomId;
        if (!rooms[roomId] || socket.role !== 'player') return;

        rooms[roomId].fieldState = {}; 
        rooms[roomId].mainDeck = data.main.map(card => ({ id: uuidv4(), name: card.name, type: card.type }));
        rooms[roomId].cheerDeck = data.cheer.map(card => ({ id: uuidv4(), name: card.name, type: 'ayle' }));
        
        // シャッフル
        for (let i = rooms[roomId].mainDeck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [rooms[roomId].mainDeck[i], rooms[roomId].mainDeck[j]] = [rooms[roomId].mainDeck[j], rooms[roomId].mainDeck[i]];
        }

        const oshiId = uuidv4();
        rooms[roomId].fieldState[oshiId] = {
            id: oshiId, name: data.oshi.name, type: 'holomen',
            x: data.oshi.pos.x, y: data.oshi.pos.y,
            zIndex: 100, isFaceUp: true
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
        if (rooms[roomId]) {
            delete rooms[roomId].fieldState[data.id];
            socket.to(roomId).emit('cardRemoved', { id: data.id });
        }
    });

    socket.on('flipCard', (data) => {
        const roomId = socket.roomId;
        if (rooms[roomId] && rooms[roomId].fieldState[data.id]) {
            rooms[roomId].fieldState[data.id].isFaceUp = data.isFaceUp;
            socket.to(roomId).emit('cardFlipped', data);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`));
