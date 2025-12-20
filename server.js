const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let deck = [];
let fieldState = {}; 

io.on('connection', (socket) => {
    socket.emit('init', { id: socket.id, fieldState: fieldState });
    io.emit('deckCount', deck.length);

    // デッキリストを設定してシャッフル
    socket.on('setDeck', (list) => {
        deck = list.map(name => ({
            id: uuidv4(),
            name: name.trim()
        }));
        // シャッフル
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        io.emit('deckCount', deck.length);
        console.log("Deck initialized with " + deck.length + " cards.");
    });

    socket.on('drawCard', () => {
        if (deck.length > 0) {
            const cardData = deck.pop();
            socket.emit('receiveCard', cardData);
            io.emit('deckCount', deck.length);
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server: ${PORT}`));
