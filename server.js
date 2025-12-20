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

function initDeck() {
    deck = [];
    for (let i = 1; i <= 52; i++) deck.push(i);
    deck.sort(() => Math.random() - 0.5);
}
initDeck();

io.on('connection', (socket) => {
    socket.emit('init', { id: socket.id, fieldState: fieldState });
    io.emit('deckCount', deck.length);

    socket.on('drawCard', () => {
        if (deck.length > 0) {
            const num = deck.pop();
            const cardData = { id: uuidv4(), number: num };
            socket.emit('receiveCard', cardData);
            io.emit('deckCount', deck.length);
        }
    });

    socket.on('moveCard', (data) => {
        fieldState[data.id] = {
            ...fieldState[data.id],
            x: data.x, y: data.y, zIndex: data.zIndex, number: data.number
        };
        socket.broadcast.emit('cardMoved', data);
    });

    socket.on('flipCard', (data) => {
        if (fieldState[data.id]) fieldState[data.id].isFaceUp = data.isFaceUp;
        socket.broadcast.emit('cardFlipped', data);
    });

    // 【新機能】手札に戻ったカードをフィールドデータから削除
    socket.on('returnToHand', (data) => {
        delete fieldState[data.id];
        // 他のプレイヤーに「このカードを消して」と通知
        socket.broadcast.emit('cardRemoved', { id: data.id });
    });

    socket.on('disconnect', () => { console.log('User disconnected'); });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server: ${PORT}`));
