const socket = io();

const field = document.getElementById('field');
const handDiv = document.getElementById('hand');
const mainCountSpan = document.getElementById('mainCount');
const cheerCountSpan = document.getElementById('cheerCount');

// UI要素
const mainDeckBtn = document.getElementById('main-deck-zone');
const cheerDeckBtn = document.getElementById('cheer-deck-zone');
const setMainBtn = document.getElementById('setMainBtn');
const setCheerBtn = document.getElementById('setCheerBtn');
const sampleMainBtn = document.getElementById('sampleMainBtn');
const sampleCheerBtn = document.getElementById('sampleCheerBtn');
const mainInput = document.getElementById('mainDeckInput');
const cheerInput = document.getElementById('cheerDeckInput');

let isDragging = false;
let currentCard = null;
let offsetX = 0, offsetY = 0, maxZIndex = 100;
const SNAP_THRESHOLD = 50;

// サンプルデータ読み込み機能
sampleMainBtn.addEventListener('click', () => {
    mainInput.value = "ときのそら (Debut)\nときのそら (Bloom)\nAZKi (Debut)\n友人A\n春先のどか\nマイク";
});
sampleCheerBtn.addEventListener('click', () => {
    cheerInput.value = "赤エール\n赤エール\n青エール\n青エール\n無色エール";
});

// デッキ送信
setMainBtn.addEventListener('click', () => {
    const list = mainInput.value.split('\n').filter(l => l.trim() !== "");
    socket.emit('setMainDeck', list);
});
setCheerBtn.addEventListener('click', () => {
    const list = cheerInput.value.split('\n').filter(l => l.trim() !== "");
    socket.emit('setCheerDeck', list);
});

// ドロー
mainDeckBtn.addEventListener('click', () => socket.emit('drawMainCard'));
cheerDeckBtn.addEventListener('click', () => socket.emit('drawCheerCard'));

function getLocalCoords(e) {
    const fRect = field.getBoundingClientRect();
    return { x: e.clientX - fRect.left, y: e.clientY - fRect.top };
}

socket.on('init', (data) => {
    document.getElementById('status').innerText = `ID: ${socket.id}`;
    for (const id in data.fieldState) restoreCard(id, data.fieldState[id]);
});

socket.on('deckCount', (counts) => {
    mainCountSpan.innerText = counts.main;
    cheerCountSpan.innerText = counts.cheer;
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
    if (!card) { restoreCard(data.id, data); return; }
    card.style.left = data.x; card.style.top = data.y; card.style.zIndex = data.zIndex;
    if (card.parentElement !== field) field.appendChild(card);
});

function createCardElement(cardData) {
    const el = document.createElement('div');
    el.className = `card face-up type-${cardData.type}`;
    el.id = cardData.id;
    el.innerText = cardData.name;
    setupCardEvents(el);
    return el;
}

function restoreCard(id, info) {
    const el = createCardElement({ id: id, name: info.name, type: info.type });
    el.style.position = 'absolute'; el.style.left = info.x; el.style.top = info.y; el.style.zIndex = info.zIndex;
    if (info.isFaceUp === false) el.classList.add('face-down');
    field.appendChild(el);
}

function setupCardEvents(el) {
    el.addEventListener('dblclick', (e) => {
        el.classList.toggle('face-up'); el.classList.toggle('face-down');
        socket.emit('flipCard', { id: el.id, isFaceUp: el.classList.contains('face-up') });
        e.stopPropagation();
    });
    el.addEventListener('mousedown', (e) => {
        isDragging = true; currentCard = el;
        const rect = el.getBoundingClientRect();
        offsetX = e.clientX - rect.left; offsetY = e.clientY - rect.top;
        maxZIndex++; el.style.zIndex = maxZIndex;
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
        if (e.clientY > handRect.top - 20) returnToHand();
        else { snapToZone(); syncMove(); }
    }
    isDragging = false; currentCard = null;
});

function snapToZone() {
    const zones = document.querySelectorAll('.zone');
    let closestZone = null, minDistance = SNAP_THRESHOLD;
    const cardRect = currentCard.getBoundingClientRect();
    const cardCenter = { x: cardRect.left + cardRect.width/2, y: cardRect.top + cardRect.height/2 };
    zones.forEach(zone => {
        const zoneRect = zone.getBoundingClientRect();
        const zoneCenter = { x: zoneRect.left + zoneRect.width/2, y: zoneRect.top + zoneRect.height/2 };
        const dist = Math.hypot(cardCenter.x - zoneCenter.x, cardCenter.y - zoneCenter.y);
        if (dist < minDistance) { minDistance = dist; closestZone = zone; }
    });
    if (closestZone) {
        const zRect = closestZone.getBoundingClientRect(), fRect = field.getBoundingClientRect();
        currentCard.style.left = (zRect.left - fRect.left) + (zRect.width - cardRect.width)/2 + 'px';
        currentCard.style.top = (zRect.top - fRect.top) + (zRect.height - cardRect.height)/2 + 'px';
    }
}

function returnToHand() {
    currentCard.style.position = ''; currentCard.style.left = ''; currentCard.style.top = '';
    handDiv.appendChild(currentCard);
    socket.emit('returnToHand', { id: currentCard.id });
}

function syncMove() {
    if (!currentCard) return;
    socket.emit('moveCard', {
        id: currentCard.id, name: currentCard.innerText,
        type: currentCard.classList.contains('type-ayle') ? 'ayle' : 'holomen',
        x: currentCard.style.left, y: currentCard.style.top, zIndex: currentCard.style.zIndex
    });
}
