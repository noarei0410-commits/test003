const socket = io();

const field = document.getElementById('field');
const handDiv = document.getElementById('hand');
const deckCountSpan = document.getElementById('deckCount');
const mainDeck = document.getElementById('main-deck');

let isDragging = false;
let currentCard = null;
let offsetX = 0;
let offsetY = 0;
let maxZIndex = 100;

const SNAP_THRESHOLD = 50;

// -------------------------------------------------------
// 1. 座標計算の修正
// -------------------------------------------------------

function getLocalCoords(e) {
    const fRect = field.getBoundingClientRect();
    return {
        x: e.clientX - fRect.left,
        y: e.clientY - fRect.top
    };
}

// -------------------------------------------------------
// 2. イベント処理
// -------------------------------------------------------

socket.on('init', (data) => {
    document.getElementById('status').innerText = `Player: ${socket.id}`;
    for (const id in data.fieldState) restoreCard(id, data.fieldState[id]);
});

socket.on('deckCount', (count) => { if (deckCountSpan) deckCountSpan.innerText = count; });

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
    if (!card) { restoreCard(data.id, data); return; }
    card.style.left = data.x;
    card.style.top = data.y;
    card.style.zIndex = data.zIndex;
    if (card.parentElement !== field) field.appendChild(card);
});

if (mainDeck) {
    mainDeck.addEventListener('click', () => socket.emit('drawCard'));
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
    if (info.isFaceUp === false) el.classList.add('face-down');
    field.appendChild(el);
}

function setupCardEvents(el) {
    el.addEventListener('mousedown', (e) => {
        isDragging = true;
        currentCard = el;

        const rect = el.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;

        maxZIndex++;
        el.style.zIndex = maxZIndex;

        if (el.parentElement !== field) {
            const coords = getLocalCoords(e);
            el.style.position = 'absolute';
            el.style.left = (coords.x - offsetX) + 'px';
            el.style.top = (coords.y - offsetY) + 'px';
            field.appendChild(el);
        }
    });
}

document.addEventListener('mousemove', (e) => {
    if (!isDragging || !currentCard) return;
    const coords = getLocalCoords(e);
    currentCard.style.left = (coords.x - offsetX) + 'px';
    currentCard.style.top = (coords.y - offsetY) + 'px';
});

document.addEventListener('mouseup', (e) => {
    if (isDragging && currentCard) {
        const handRect = handDiv.getBoundingClientRect();
        
        // 判定：マウスが手札エリア（画面下部）にあれば回収
        if (e.clientY > handRect.top - 20) {
            returnToHand();
        } else {
            snapToZone();
            syncMove();
        }
    }
    isDragging = false;
    currentCard = null;
});

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

        const dist = Math.hypot(cardCenter.x - zoneCenter.x, cardCenter.y - zoneCenter.y);
        if (dist < minDistance) {
            minDistance = dist;
            closestZone = zone;
        }
    });

    if (closestZone) {
        const zRect = closestZone.getBoundingClientRect();
        const fRect = field.getBoundingClientRect();
        
        const targetX = (zRect.left - fRect.left) + (zRect.width - cardRect.width) / 2;
        const targetY = (zRect.top - fRect.top) + (zRect.height - cardRect.height) / 2;

        currentCard.style.left = targetX + 'px';
        currentCard.style.top = targetY + 'px';
    }
}

function returnToHand() {
    currentCard.style.position = '';
    currentCard.style.left = '';
    currentCard.style.top = '';
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
