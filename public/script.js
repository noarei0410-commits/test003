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

socket.on('init', (data) => {
    document.getElementById('status').innerText = `Player Connected`;
    for (const id in data.fieldState) {
        restoreCard(id, data.fieldState[id]);
    }
});

socket.on('deckCount', (count) => {
    deckCountSpan.innerText = count;
});

drawBtn.addEventListener('click', () => socket.emit('drawCard'));

socket.on('receiveCard', (cardData) => {
    const el = createCardElement(cardData);
    handDiv.appendChild(el);
});

function createCardElement(cardData) {
    const el = document.createElement('div');
    el.className = 'card face-up';
    el.id = cardData.id;
    el.innerText = cardData.number; // 将来的にここに画像を入れる
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
    el.addEventListener('dblclick', (e) => {
        el.classList.toggle('face-up');
        el.classList.toggle('face-down');
        socket.emit('flipCard', { id: el.id, isFaceUp: el.classList.contains('face-up') });
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
        number: currentCard.innerText,
        x: currentCard.style.left,
        y: currentCard.style.top,
        zIndex: currentCard.style.zIndex
    });
}

socket.on('cardMoved', (data) => {
    let card = document.getElementById(data.id);
    if (!card) { restoreCard(data.id, data); return; }
    card.style.left = data.x;
    card.style.top = data.y;
    card.style.zIndex = data.zIndex;
    if (card.parentElement !== field) field.appendChild(card);
});

socket.on('cardFlipped', (data) => {
    const card = document.getElementById(data.id);
    if (card) {
        if (data.isFaceUp) { card.classList.add('face-up'); card.classList.remove('face-down'); }
        else { card.classList.add('face-down'); card.classList.remove('face-up'); }
    }
});
