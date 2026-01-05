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
        id,
        playerCount: rooms[id].players.length,
        spectatorCount: rooms[id].spectators.length
    }));
    io.emit('roomListUpdate', list);
}

io.on('connection', (socket) => {
    broadcastRoomList();

    socket.on('joinRoom', ({ roomId, role }) => {
        socket.join(roomId);
        socket.roomId = roomId;
        if (!rooms[roomId]) {
            rooms[roomId] = { fieldState: {}, mainDeck: [], cheerDeck: [], players: [], spectators: [] };
        }
        if (role === 'player') rooms[roomId].players.push(socket.id);
        else rooms[roomId].spectators.push(socket.id);

        socket.emit('init', {
            id: socket.id,
            role,
            fieldState: rooms[roomId].fieldState,
            deckCount: { main: rooms[roomId].mainDeck.length, cheer: rooms[roomId].cheerDeck.length }
        });
        broadcastRoomList();
    });

    // 対戦開始・デッキセットアップ
    // 対戦開始・デッキセットアップ
    socket.on('setGame', ({ oshi, main, cheer, sleeve }) => {
        const rid = socket.roomId;
        if (!rid || !rooms[rid]) return;
        const r = rooms[rid];

        // フィールドとデッキの再初期化
        r.fieldState = {};

        // カードオブジェクト生成ヘルパー
        // スリーブ情報は一旦無視（リバート済み）だが、引数には残っている可能性があるため受け取るだけにする
        const createCard = (c, type) => ({
            ...c,
            id: uuidv4(),
            owner: socket.id,
            isFaceUp: false, // デッキ内は裏向き
            isRotated: false
        });

        // デッキ生成
        r.mainDeck = main.map(c => createCard(c, 'holomen'));
        r.cheerDeck = cheer.map(c => ({ ...createCard(c, 'ayle'), type: 'ayle' }));

        // シャッフル
        const shuffle = (array) => {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
            return array;
        };
        r.mainDeck = shuffle(r.mainDeck);
        r.cheerDeck = shuffle(r.cheerDeck);

        // 推しホロメンの配置
        const oId = uuidv4();
        r.fieldState[oId] = {
            ...oshi,
            id: oId,
            type: 'oshi',
            zoneId: 'oshi',
            zIndex: 100,
            isFaceUp: true,
            owner: socket.id
        };

        // ライフの自動配置
        const lifeCount = oshi.hp || 0;
        for (let i = 0; i < lifeCount; i++) {
            if (r.cheerDeck.length > 0) {
                const c = r.cheerDeck.pop();
                r.fieldState[c.id] = {
                    ...c,
                    zoneId: 'life-zone',
                    isFaceUp: false,
                    isRotated: true, // 横向き
                    zIndex: 10 + i
                };
            }
        }

        // ターン管理の初期化
        r.turnState = {
            turnCount: 1,
            currentPlayer: r.players[0] || socket.id,
            phase: 'reset'
        };

        io.to(rid).emit('gameStarted', {
            fieldState: r.fieldState,
            deckCount: { main: r.mainDeck.length, cheer: r.cheerDeck.length },
            turnState: r.turnState
        });
    });

    // ドロー処理
    socket.on('drawMainCard', () => {
        const r = rooms[socket.roomId];
        if (r && r.mainDeck.length > 0) {
            socket.emit('receiveCard', r.mainDeck.pop());
            io.to(socket.roomId).emit('deckCount', { main: r.mainDeck.length, cheer: r.cheerDeck.length });
        }
    });

    socket.on('drawCheerCard', () => {
        const r = rooms[socket.roomId];
        if (r && r.cheerDeck.length > 0) {
            socket.emit('receiveCard', r.cheerDeck.pop());
            io.to(socket.roomId).emit('deckCount', { main: r.mainDeck.length, cheer: r.cheerDeck.length });
        }
    });

    // ホロパワー生成
    socket.on('generateHoloPower', () => {
        const r = rooms[socket.roomId];
        if (r && r.mainDeck.length > 0) {
            const c = r.mainDeck.pop();
            const pc = {
                ...c,
                id: uuidv4(),
                zoneId: 'holopower',
                isFaceUp: false,
                isRotated: true,
                zIndex: 200 + Object.keys(r.fieldState).length
            };
            r.fieldState[pc.id] = pc;
            io.to(socket.roomId).emit('cardMoved', pc);
            io.to(socket.roomId).emit('deckCount', { main: r.mainDeck.length, cheer: r.cheerDeck.length });
        }
    });

    socket.on('moveCard', (data) => {
        if (rooms[socket.roomId]) {
            rooms[socket.roomId].fieldState[data.id] = { ...rooms[socket.roomId].fieldState[data.id], ...data };
            socket.to(socket.roomId).emit('cardMoved', data);
        }
    });

    socket.on('attachAyle', ({ cheerId, targetId }) => {
        const r = rooms[socket.roomId];
        if (!r || !r.fieldState[cheerId] || !r.fieldState[targetId]) return;

        const cheer = r.fieldState[cheerId];
        const target = r.fieldState[targetId];

        // 対象と同じゾーンに移動
        cheer.zoneId = target.zoneId;
        cheer.attachedTo = targetId;

        // スタック内での並び順調整
        // ホロメンカードの下、かつ既存のエールカード等の下に来るようにZ-Indexを最小化する
        // そのゾーンにある全てのカードを取得
        const stackCards = Object.values(r.fieldState).filter(c => c.zoneId === target.zoneId);
        const minZ = Math.min(...stackCards.map(c => c.zIndex || 0));

        cheer.zIndex = minZ - 1; // 最背面へ
        // 位置合わせ（少しずらす等はクライアント側描画で処理するが、サーバーデータとしても一応同期）
        cheer.isRotated = false; // 通常は縦向き

        io.to(socket.roomId).emit('cardAttached', { cheerId, targetId, zoneId: target.zoneId, zIndex: cheer.zIndex });
        // Z-indexが変わったので全体更新が必要かもしれないが、個別通知で対応
        io.to(socket.roomId).emit('cardMoved', cheer);
    });

    socket.on('archiveCard', ({ id }) => {
        const r = rooms[socket.roomId];
        if (r && r.fieldState[id]) {
            const c = r.fieldState[id];
            c.zoneId = 'archive';
            c.attachedTo = null; // アタッチ解除
            c.zIndex = 0; // リセット
            // アーカイブゾーン内での整理（必要なら）
            io.to(socket.roomId).emit('cardMoved', c);
        }
    });

    socket.on('updateHp', (d) => {
        if (rooms[socket.roomId] && rooms[socket.roomId].fieldState[d.id]) {
            rooms[socket.roomId].fieldState[d.id].currentHp = d.currentHp;
            io.to(socket.roomId).emit('hpUpdated', d);
        }
    });

    socket.on('returnToHand', (d) => {
        if (rooms[socket.roomId]) {
            delete rooms[socket.roomId].fieldState[d.id];
            socket.to(socket.roomId).emit('cardRemoved', { id: d.id });
        }
    });

    socket.on('flipCard', (d) => {
        if (rooms[socket.roomId] && rooms[socket.roomId].fieldState[d.id]) {
            rooms[socket.roomId].fieldState[d.id].isFaceUp = d.isFaceUp;
            socket.to(socket.roomId).emit('cardFlipped', d);
        }
    });

    socket.on('inspectDeck', (type) => {
        const r = rooms[socket.roomId];
        if (r) socket.emit('deckInspectionResult', { type, cards: type === 'main' ? r.mainDeck : r.cheerDeck });
    });

    socket.on('pickCardFromDeck', ({ type, cardId }) => {
        const r = rooms[socket.roomId];
        let deck = type === 'main' ? r.mainDeck : r.cheerDeck;
        const idx = deck.findIndex(c => c.id === cardId);
        if (idx !== -1) {
            const c = deck.splice(idx, 1)[0];
            // 簡易シャッフル
            deck.sort(() => Math.random() - 0.5);
            socket.emit('receiveCard', c);
            io.to(socket.roomId).emit('deckCount', { main: r.mainDeck.length, cheer: r.cheerDeck.length });
        }
    });

    // ターン進行
    socket.on('nextPhase', () => {
        const r = rooms[socket.roomId];
        if (!r || !r.turnState) return;
        if (r.turnState.currentPlayer !== socket.id) return; // 自分のターンでないなら無視

        const phases = ['reset', 'draw', 'cheer', 'main', 'arts', 'end'];
        let currentIdx = phases.indexOf(r.turnState.phase);

        if (currentIdx < phases.length - 1) {
            r.turnState.phase = phases[currentIdx + 1];
        } else {
            // ターン終了 -> 次のプレイヤーへ
            const currentPlayerIdx = r.players.indexOf(r.turnState.currentPlayer);
            const nextPlayerIdx = (currentPlayerIdx + 1) % r.players.length;
            r.turnState.currentPlayer = r.players[nextPlayerIdx];
            r.turnState.phase = 'reset';
            r.turnState.turnCount++;
        }

        io.to(socket.roomId).emit('turnUpdate', r.turnState);
    });

    socket.on('disconnect', () => {
        const r = rooms[socket.roomId];
        if (r) {
            r.players = r.players.filter(id => id !== socket.id);
            r.spectators = r.spectators.filter(id => id !== socket.id);
            if (r.players.length === 0 && r.spectators.length === 0) delete rooms[socket.roomId];
            broadcastRoomList();
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`));
