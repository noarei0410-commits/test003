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
function initDeck() {
    deck = [];
    for (let i = 1; i <= 52; i++) deck.push(i);
    deck.sort(() => Math.random() - 0.5);
}
initDeck();

io.on('connection', (socket) => {
    socket.emit('init', { id: socket.id });
    io.emit('deckCount', deck.length);

    socket.on('drawCard', () => {
        if (deck.length > 0) {
            const num = deck.pop();
            const cardData = {
                id: uuidv4(),
                number: num
            };
            socket.emit('receiveCard', cardData);
            io.emit('deckCount', deck.length);
        }
    });

    socket.on('moveCard', (data) => {
        // 全員（自分以外）に座標と重なり順を送信
        socket.broadcast.emit('cardMoved', data);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
