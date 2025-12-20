const socket = io();

// DOM要素の取得
const field = document.getElementById('field');
const handDiv = document.getElementById('hand');
const deckCountSpan = document.getElementById('deckCount');
const mainDeck = document.getElementById('main-deck');

// ドラッグ状態管理
let isDragging = false;
let currentCard = null;
let offsetX = 0;
let offsetY = 0;
let maxZIndex = 100; // 重なり順のベース

// -------------------------------------------------------
// 1. サーバーからの受信イベント
// -------------------------------------------------------

// 初期化：ログイン時に現在のフィールド状態を復元
socket.on('init', (data) => {
    document.getElementById('status').innerText = `Player: ${socket.id}`;
    
    // フィールド上のカードを再現
    for (const id in data.fieldState) {
        restoreCard(id, data.fieldState[id]);
    }
});

// 山札の枚数更新
socket.on('deckCount', (count) => {
    if (deckCountSpan) deckCountSpan.innerText = count;
});

// デッキからカードを受け取る（自分の手札に追加）
socket.on('receiveCard', (cardData) => {
    const el = createCardElement(cardData);
    handDiv.appendChild(el);
});

// 他のプレイヤーがカードを動かした時
socket.on('cardMoved', (data) => {
    let card = document.getElementById(data.id);
    if (!card) {
        // フィールドに存在しないカードなら作成して配置
        restoreCard(data.id, data);
        return;
    }
    // 位置と重なり順を同期
    card.style.left = data.x;
    card.style.top = data.y;
    card.style.zIndex = data.zIndex;
    
    // maxZIndexを同期（次に自分が触った時にさらに上に来るように）
    const remoteZ = parseInt(data.zIndex);
    if (remoteZ > maxZIndex) maxZIndex = remoteZ;

    // 手札からフィールドに出た場合の移動処理
    if (card.parentElement !== field) {
        field.appendChild(card);
    }
});

// 他のプレイヤーがカードを裏返した時
socket.on('cardFlipped', (data) => {
    const card = document.getElementById(data.id);
    if (card) {
        if (data.isFaceUp) {
            card.classList.add('face-up');
            card.classList.remove('face-down');
        } else {
            card.classList.add('face-down');
            card.classList.remove('face-up');
        }
    }
});

// -------------------------------------------------------
// 2. カード操作ロジック
// -------------------------------------------------------

// デッキをクリックしてカードを引く
if (mainDeck) {
    mainDeck.addEventListener('click', () => {
        socket.emit('drawCard');
    });
}

// 新しいカード要素を作成
function createCardElement(cardData) {
    const el = document.createElement('div');
    el.className = 'card face-up';
    el.id = cardData.id;
    el.innerText = cardData.number; // 将来的に画像パスなどに置き換え可能
    setupCardEvents(el);
    return el;
}

// 既存のカードをフィールドに復元
function restoreCard(id, info) {
    const el = createCardElement({ id: id, number: info.number });
    el.style.position = 'absolute';
    el.style.left = info.x;
    el.style.top = info.y;
    el.style.zIndex = info.zIndex;

    if (info.isFaceUp === false) {
        el.classList.add('face-down');
        el.classList.remove('face-up');
    }

    if (parseInt(info.zIndex) > maxZIndex) maxZIndex = parseInt(info.zIndex);
    
    field.appendChild(el);
}

// カードのイベント登録（ドラッグ＆ダブルクリック）
function setupCardEvents(el) {
    // ダブルクリックで裏返し
    el.addEventListener('dblclick', (e) => {
        el.classList.toggle('face-up');
        el.classList.toggle('face-down');
        
        socket.emit('flipCard', {
            id: el.id,
            isFaceUp: el.classList.contains('face-up')
        });
        e.stopPropagation();
    });

    // マウス押下（ドラッグ開始）
    el.addEventListener('mousedown', (e) => {
        isDragging = true;
        currentCard = el;

        const rect = el.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;

        // 触ったカードを最前面へ
        maxZIndex++;
        el.style.zIndex = maxZIndex;

        if (el.parentElement !== field) {
            el.style.left = (e.clientX - offsetX) + 'px';
            el.style.top = (e.clientY - offsetY) + 'px';
            el.style.position = 'absolute';
            field.appendChild(el);
        }
        syncMove();
    });
}

// マウス移動（ドラッグ中）
document.addEventListener('mousemove', (e) => {
    if (!isDragging || !currentCard) return;

    const x = e.clientX - offsetX;
    const y = e.clientY - offsetY;

    currentCard.style.left = x + 'px';
    currentCard.style.top = y + 'px';
});

// マウス離上（ドラッグ終了）
document.addEventListener('mouseup', () => {
    if (isDragging && currentCard) {
        syncMove();
    }
    isDragging = false;
    currentCard = null;
});

// 位置・重なり順をサーバーに送信
function syncMove() {
    if (!currentCard) return;
    socket.emit('moveCard', {
        id: currentCard.id,
        number: currentCard.innerText,
        x: currentCard.style.left,
        y: currentCard.style.top,
        zIndex: currentCard.style.zIndex
    });
}
