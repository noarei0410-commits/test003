const socket = io();

const field = document.getElementById('field');
const handDiv = document.getElementById('hand');
const drawBtn = document.getElementById('drawBtn');
const deckCountSpan = document.getElementById('deckCount');

let isDragging = false;
let currentCard = null;
let offsetX = 0;
let offsetY = 0;
let maxZIndex = 100;

// 初期化：サーバーに保存されているフィールド上のカードを復元
socket.on('init', (data) => {
    document.getElementById('status').innerText = `ID: ${socket.id}`;
    
    // すでにフィールドにあるカードを生成
    for (const cardId in data.fieldState) {
        const info = data.fieldState[cardId];
        restoreCard(cardId, info);
    }
});

socket.on('deckCount', (count) => {
    deckCountSpan.innerText = count;
});

drawBtn.addEventListener('click', () => {
    socket.emit('drawCard');
});

socket.on('receiveCard', (cardData) => {
    createCardElement(cardData);
});

// 手札に新しくカードを作る
function createCardElement(cardData) {
    const el = document.createElement('div');
    el.classList.add('card', 'face-up');
    el.id = cardData.id;
    el.innerText = cardData.number;
    setupCardEvents(el);
    handDiv.appendChild(el);
}

// すでにフィールドにあるカードを復元する
function restoreCard(id, info) {
    const el = document.createElement('div');
    el.classList.add('card');
    el.id = id;
    el.innerText = info.number;
    el.style.position = 'absolute';
    el.style.left = info.x;
    el.style.top = info.y;
    el.style.zIndex = info.zIndex;
    
    // 裏表の状態を復元
    if (info.isFaceUp === false) {
        el.classList.add('face-down');
    } else {
        el.classList.add('face-up');
    }

    if (parseInt(info.zIndex) > maxZIndex) maxZIndex = parseInt(info.zIndex);
    
    setupCardEvents(el);
    field.appendChild(el);
}

// カードのイベント（ドラッグ、ダブルクリック）を設定
function setupCardEvents(el) {
    el.addEventListener('dblclick', (e) => {
        el.classList.toggle('face-up');
        el.classList.toggle('face-down');
        // 裏返した状態をサーバーに送る
        socket.emit('flipCard', {
            id: el.id,
            isFaceUp: el.classList.contains('face-up')
        });
        e.stopPropagation();
    });

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

document.addEventListener('mouseup', () => {
    if (isDragging && currentCard) syncMove();
    isDragging = false;
    currentCard = null;
});

function syncMove() {
    if (!currentCard) return;
    socket.emit('moveCard', {
        id: currentCard.id,
        number: currentCard.innerText, // 保存用に数字も送る
        x: currentCard.style.left,
        y: currentCard.style.top,
        zIndex: currentCard.style.zIndex
    });
}

socket.on('cardMoved', (data) => {
    let card = document.getElementById(data.id);
    if (!card) {
        // 知らないカードが動いたら新しく作る（他人が引いてすぐ場に出した場合など）
        restoreCard(data.id, data);
        return;
    }
    card.style.left = data.x;
    card.style.top = data.y;
    card.style.zIndex = data.zIndex;
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
