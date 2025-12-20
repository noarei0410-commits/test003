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
let cheerDeck = []; // エール専用デッキ
let fieldState = {}; 

io.on('connection', (socket) => {
    socket.emit('init', { id: socket.id, fieldState: fieldState });
    io.emit('deckCount', { main: mainDeck.length, cheer: cheerDeck.length });

    // メインデッキ設定
    socket.on('setMainDeck', (list) => {
        mainDeck = list.map(name => ({ id: uuidv4(), name: name.trim(), type: 'holomen' }));
        shuffle(mainDeck);
        io.emit('deckCount', { main: mainDeck.length, cheer: cheerDeck.length });
    });

    // エールデッキ設定
    socket.on('setCheerDeck', (list) => {
        cheerDeck = list.map(name => ({ id: uuidv4(), name: name.trim(), type: 'ayle' }));
        shuffle(cheerDeck);
        io.emit('deckCount', { main: mainDeck.length, cheer: cheerDeck.length });
    });

    // メインデッキから引く
    socket.on('drawMainCard', () => {
        if (mainDeck.length > 0) {
            const cardData = mainDeck.pop();
            socket.emit('receiveCard', cardData);
            io.emit('deckCount', { main: mainDeck.length, cheer: cheerDeck.length });
        }
    });

    // エールデッキから引く
    socket.on('drawCheerCard', () => {
        if (cheerDeck.length > 0) {
            const cardData = cheerDeck.pop();
            socket.emit('receiveCard', cardData);
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
