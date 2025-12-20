const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let mainDeck = [];
let cheerDeck = [];
let fieldState = {}; 

io.on('connection', (socket) => {
    socket.emit('init', { id: socket.id, fieldState: fieldState });
    io.emit('deckCount', { main: mainDeck.length, cheer: cheerDeck.length });

    socket.on('setGame', (data) => {
        // デッキの初期化
        mainDeck = data.main.map(name => ({ id: uuidv4(), name: name, type: 'holomen' }));
        cheerDeck = data.cheer.map(name => ({ id: uuidv4(), name: name, type: 'ayle' }));
        shuffle(mainDeck);
        shuffle(cheerDeck);

        // 推しホロメンをフィールドの初期位置に登録
        const oshiId = uuidv4();
        fieldState = {}; // ゲーム開始時にフィールドをリセット
        fieldState[oshiId] = {
            id: oshiId,
            name: data.oshi.name,
            type: 'holomen',
            x: data.oshi.pos.x,
            y: data.oshi.pos.y,
            zIndex: 100,
            isFaceUp: true
        };

        io.emit('gameStarted', { 
            fieldState: fieldState, 
            deckCount: { main: mainDeck.length, cheer: cheerDeck.length } 
        });
    });

    socket.on('drawMainCard', () => {
        if (mainDeck.length > 0) {
            socket.emit('receiveCard', mainDeck.pop());
            io.emit('deckCount', { main: mainDeck.length, cheer: cheerDeck.length });
        }
    });

    socket.on('drawCheerCard', () => {
        if (cheerDeck.length > 0) {
            socket.emit('receiveCard', cheerDeck.pop());
            io.emit('deckCount', { main: mainDeck.length, cheer: cheerDeck.length });
        }
    });

    socket.on('moveCard', (data) => {
        fieldState[data.id] = { ...fieldState[data.id], ...data };
        socket.broadcast.emit('cardMoved', data);
    });

    socket.on('returnToHand', (data) => {
        delete fieldState[data.id];
        socket.broadcast.emit('cardRemoved', { id: data.id });
    });

    socket.on('flipCard', (data) => {
        if (fieldState[data.id]) fieldState[data.id].isFaceUp = data.isFaceUp;
        socket.broadcast.emit('cardFlipped', data);
    });

    socket.on('disconnect', () => { console.log('User disconnected'); });
});

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server: ${PORT}`));
