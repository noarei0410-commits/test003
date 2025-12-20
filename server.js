const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// ゲームの状態管理（簡易版）
let gameState = {
    deck: [],
    hands: {} // プレイヤーごとの手札
};

// 山札の初期化（例：52枚のカード）
function initDeck() {
    const cards = [];
    for (let i = 1; i <= 52; i++) cards.push(i);
    return cards.sort(() => Math.random() - 0.5);
}

gameState.deck = initDeck();

io.on('connection', (socket) => {
    console.log('ユーザーが接続しました:', socket.id);
    
    // プレイヤーの手札を初期化
    gameState.hands[socket.id] = [];

    // 現在の状態を送信
    socket.emit('init', { id: socket.id, hand: gameState.hands[socket.id] });

    // カードを引く処理
    socket.on('drawCard', () => {
        if (gameState.deck.length > 0) {
            const card = gameState.deck.pop();
            gameState.hands[socket.id].push(card);
            
            // 本人にのみ手札を更新
            socket.emit('updateHand', gameState.hands[socket.id]);
            // 全員に山札の残数を通知
            io.emit('deckCount', gameState.deck.length);
        }
    });

    socket.on('disconnect', () => {
        delete gameState.hands[socket.id];
        console.log('ユーザーが切断しました');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);

});


// server.js に追加
app.get('/', (req, res) => {
  res.send('Server is working!');
});

