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

socket.on('init', (data) => {
    document.getElementById('status').innerText = `Player: ${socket.id}`;
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

// 他人の画面からカードを消す同期
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

socket.on('cardFlipped', (data) => {
    const card = document.getElementById(data.id);
    if (card) {
        if (data.isFaceUp) { card.classList.add('face-up'); card.classList.remove('face-down'); }
        else { card.classList.add('face-down'); card.classList.remove('face-up'); }
    }
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
    if (info.isFaceUp === false) { el.classList.add('face-down'); el.classList.remove('face-up'); }
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

// 【修正】マウスを離した時に手札エリア内か判定する
document.addEventListener('mouseup', (e) => {
    if (isDragging && currentCard) {
        const handRect = handDiv.getBoundingClientRect();
        
        // マウスの位置が手札エリア（#hand）の中にあるかチェック
        if (
            e.clientX >= handRect.left && e.clientX <= handRect.right &&
            e.clientY >= handRect.top && e.clientY <= handRect.bottom
        ) {
            // 手札に戻す処理
            currentCard.style.position = '';
            currentCard.style.left = '';
            currentCard.style.top = '';
            currentCard.style.zIndex = '';
            handDiv.appendChild(currentCard);
            
            // サーバーに回収を通知
            socket.emit('returnToHand', { id: currentCard.id });
        } else {
            // フィールド上での移動を同期
            syncMove();
        }
    }
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
