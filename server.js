const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// サーバー側の状態管理
let deck = [];
let fieldState = {}; // { cardId: { number, x, y, zIndex, isFaceUp } }

function initDeck() {
    deck = [];
    for (let i = 1; i <= 52; i++) deck.push(i);
    deck.sort(() => Math.random() - 0.5);
}
initDeck();

io.on('connection', (socket) => {
    // 1. 新規接続した人に、現在のフィールドの状態をすべて送る
    socket.emit('init', { 
        id: socket.id, 
        fieldState: fieldState 
    });
    io.emit('deckCount', deck.length);

    // カードを引く
    socket.on('drawCard', () => {
        if (deck.length > 0) {
            const num = deck.pop();
            const cardData = {
                id: uuidv4(),
                number: num
            };
            // 引いた本人にだけカードを送る（この時点ではフィールド未登録）
            socket.emit('receiveCard', cardData);
            io.emit('deckCount', deck.length);
        }
    });

    // 移動と状態の保存
    socket.on('moveCard', (data) => {
        // フィールドの状態を更新・保存
        if (!fieldState[data.id]) fieldState[data.id] = {};
        fieldState[data.id] = {
            ...fieldState[data.id],
            x: data.x,
            y: data.y,
            zIndex: data.zIndex,
            number: data.number // 数字も保存しておく
        };
        socket.broadcast.emit('cardMoved', data);
    });

    // 裏返しの保存
    socket.on('flipCard', (data) => {
        if (fieldState[data.id]) {
            fieldState[data.id].isFaceUp = data.isFaceUp;
        }
        socket.broadcast.emit('cardFlipped', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server: ${PORT}`));
