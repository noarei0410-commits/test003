const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 1. 静的ファイルの設定（CSSやJSファイルを読み込むために必要）
app.use(express.static(path.join(__dirname, 'public')));

// 2. 【重要：裏技】ルートパスへのアクセスで index.html を強制的に返す
// express.static が効かない環境でも、これで確実に表示させます
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ゲームの状態管理
let gameState = {
    deck: [],
    hands: {}
};

// 山札の初期化
function initDeck() {
    const cards = [];
    for (let i = 1; i <= 52; i++) cards.push(i);
    return cards.sort(() => Math.random() - 0.5);
}
gameState.deck = initDeck();

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    gameState.hands[socket.id] = [];
    socket.emit('init', { id: socket.id, hand: gameState.hands[socket.id] });

    socket.on('drawCard', () => {
        if (gameState.deck.length > 0) {
            const card = gameState.deck.pop();
            gameState.hands[socket.id].push(card);
            socket.emit('updateHand', gameState.hands[socket.id]);
            io.emit('deckCount', gameState.deck.length);
        }
    });

    socket.on('disconnect', () => {
        delete gameState.hands[socket.id];
        console.log('User disconnected');
    });
});

// Render.com 用のポート設定
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
