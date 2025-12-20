const socket = io();

const field = document.getElementById('field');
const handDiv = document.getElementById('hand');
const drawBtn = document.getElementById('drawBtn');
const deckCountSpan = document.getElementById('deckCount');

let isDragging = false;
let currentCard = null;
let offsetX = 0;
let offsetY = 0;

// 重なり順を管理するための変数
let maxZIndex = 100;

socket.on('init', (data) => {
    document.getElementById('status').innerText = `ID: ${socket.id}`;
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

function createCardElement(cardData) {
    const el = document.createElement('div');
    el.classList.add('card', 'face-up');
    el.id = cardData.id;
    el.innerText = cardData.number;

    el.addEventListener('dblclick', (e) => {
        el.classList.toggle('face-up');
        el.classList.toggle('face-down');
        e.stopPropagation();
    });

    el.addEventListener('mousedown', (e) => {
        isDragging = true;
        currentCard = el;

        const rect = el.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;

        // 【新機能】掴んだカードの重なり順を一番上にする
        maxZIndex++;
        el.style.zIndex = maxZIndex;

        if (el.parentElement !== field) {
            el.style.left = (e.clientX - offsetX) + 'px';
            el.style.top = (e.clientY - offsetY) + 'px';
            el.style.position = 'absolute';
            field.appendChild(el);
        }

        // サーバーへ「触った」ことを通知して重なり順を同期
        syncMove();
    });

    handDiv.appendChild(el);
}

document.addEventListener('mousemove', (e) => {
    if (!isDragging || !currentCard) return;
    const x = e.clientX - offsetX;
    const y = e.clientY - offsetY;
    currentCard.style.left = x + 'px';
    currentCard.style.top = y + 'px';
});

document.addEventListener('mouseup', () => {
    if (isDragging && currentCard) {
        syncMove();
    }
    isDragging = false;
    currentCard = null;
});

// 位置と重なり順をサーバーに送る共通関数
function syncMove() {
    if (!currentCard) return;
    socket.emit('moveCard', {
        id: currentCard.id,
        x: currentCard.style.left,
        y: currentCard.style.top,
        zIndex: currentCard.style.zIndex // z-indexも送る
    });
}

// 他の人の動き（と重なり順）を同期
socket.on('cardMoved', (data) => {
    const card = document.getElementById(data.id);
    if (card) {
        card.style.position = 'absolute';
        card.style.left = data.x;
        card.style.top = data.y;
        card.style.zIndex = data.zIndex;
        
        // maxZIndexを更新して、次に誰かが触った時にさらに上に来るようにする
        const remoteZ = parseInt(data.zIndex);
        if (remoteZ > maxZIndex) maxZIndex = remoteZ;

        if (card.parentElement !== field) {
            field.appendChild(card);
        }
    }
});
