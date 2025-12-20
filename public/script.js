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
let maxZIndex = 100;

// スナップ（吸着）の感度設定 (px)
const SNAP_THRESHOLD = 50;

// -------------------------------------------------------
// 1. サーバー受信イベント
// -------------------------------------------------------

socket.on('init', (data) => {
    document.getElementById('status').innerText = `Player: ${socket.id}`;
    // 既存のフィールド状態を復元
    for (const id in data.fieldState) {
        restoreCard(id, data.fieldState[id]);
    }
});

socket.on('deckCount', (count) => {
    if (deckCountSpan) deckCountSpan.innerText = count;
});

socket.on('receiveCard', (cardData) => {
    const el = createCardElement(cardData);
    handDiv.appendChild(el);
});

socket.on('cardRemoved', (data) => {
    const card = document.getElementById(data.id);
    if (card) card.remove();
});

socket.on('cardMoved', (data) => {
    let card = document.getElementById(data.id);
    if (!card) {
        restoreCard(data.id, data);
        return;
    }
    card.style.left = data.x;
    card.style.top = data.y;
    card.style.zIndex = data.zIndex;
    const remoteZ = parseInt(data.zIndex);
    if (remoteZ > maxZIndex) maxZIndex = remoteZ;
    if (card.parentElement !== field) field.appendChild(card);
});

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

// デッキをクリックしてドロー
if (mainDeck) {
    mainDeck.addEventListener('click', () => {
        socket.emit('drawCard');
    });
}

function createCardElement(cardData) {
    const el = document.createElement('div');
    el.className = 'card face-up';
    el.id = cardData.id;
    el.innerText = cardData.number;
    setupCardEvents(el);
    return el;
}

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

    // ドラッグ開始
    el.addEventListener('mousedown', (e) => {
        isDragging = true;
        currentCard = el;
        const rect = el.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;

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

document.addEventListener('mousemove', (e) => {
    if (!isDragging || !currentCard) return;
    currentCard.style.left = (e.clientX - offsetX) + 'px';
    currentCard.style.top = (e.clientY - offsetY) + 'px';
});

// ドラッグ終了（スナップと手札回収の判定）
document.addEventListener('mouseup', (e) => {
    if (isDragging && currentCard) {
        const handRect = handDiv.getBoundingClientRect();
        
        // 判定1: マウスが手札エリア（画面下部）にあれば回収
        if (e.clientY > handRect.top - 20) {
            returnToHand();
        } else {
            // 判定2: フィールド上のゾーンにスナップ
            snapToZone();
            syncMove();
        }
    }
    isDragging = false;
    currentCard = null;
});

// 最も近いゾーンを探して中央に吸着させる
function snapToZone() {
    const zones = document.querySelectorAll('.zone');
    let closestZone = null;
    let minDistance = SNAP_THRESHOLD;

    const cardRect = currentCard.getBoundingClientRect();
    const cardCenter = {
        x: cardRect.left + cardRect.width / 2,
        y: cardRect.top + cardRect.height / 2
    };

    zones.forEach(zone => {
        const zoneRect = zone.getBoundingClientRect();
        const zoneCenter = {
            x: zoneRect.left + zoneRect.width / 2,
            y: zoneRect.top + zoneRect.height / 2
        };

        // 距離の計算
        const dist = Math.hypot(cardCenter.x - zoneCenter.x, cardCenter.y - zoneCenter.y);

        if (dist < minDistance) {
            minDistance = dist;
            closestZone = zone;
        }
    });

    if (closestZone) {
        const zRect = closestZone.getBoundingClientRect();
        const fRect = field.getBoundingClientRect();
        
        // ゾーンの中央座標を計算（フィールド内相対座標）
        const targetX = (zRect.left - fRect.left) + (zRect.width - cardRect.width) / 2;
        const targetY = (zRect.top - fRect.top) + (zRect.height - cardRect.height) / 2;

        currentCard.style.left = targetX + 'px';
        currentCard.style.top = targetY + 'px';
    }
}

// 手札に戻す処理
function returnToHand() {
    currentCard.style.position = '';
    currentCard.style.left = '';
    currentCard.style.top = '';
    currentCard.style.zIndex = '';
    handDiv.appendChild(currentCard);
    
    socket.emit('returnToHand', { id: currentCard.id });
}

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
