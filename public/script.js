const socket = io();

const field = document.getElementById('field');
const handDiv = document.getElementById('hand');
const mainCountSpan = document.getElementById('mainCount');
const cheerCountSpan = document.getElementById('cheerCount');

const mainDeckBtn = document.getElementById('main-deck-zone');
const cheerDeckBtn = document.getElementById('cheer-deck-zone');
const setMainBtn = document.getElementById('setMainBtn');
const setCheerBtn = document.getElementById('setCheerBtn');
const sampleMainBtn = document.getElementById('sampleMainBtn');
const sampleCheerBtn = document.getElementById('sampleCheerBtn');
const mainInput = document.getElementById('mainDeckInput');
const cheerInput = document.getElementById('cheerDeckInput');

let isDragging = false, currentCard = null, offsetX = 0, offsetY = 0, maxZIndex = 100;
const SNAP_THRESHOLD = 50;

// サンプルデータ設定
sampleMainBtn.addEventListener('click', () => mainInput.value = "ときのそら (Debut)\nAZKi (Debut)\n友人A");
sampleCheerBtn.addEventListener('click', () => cheerInput.value = "赤エール\n青エール");

// デッキ送信・ドロー
setMainBtn.addEventListener('click', () => socket.emit('setMainDeck', mainInput.value.split('\n').filter(l => l.trim())));
setCheerBtn.addEventListener('click', () => socket.emit('setCheerDeck', cheerInput.value.split('\n').filter(l => l.trim())));
mainDeckBtn.addEventListener('click', () => socket.emit('drawMainCard'));
cheerDeckBtn.addEventListener('click', () => socket.emit('drawCheerCard'));

function getLocalCoords(e) {
    const fRect = field.getBoundingClientRect();
    return { x: e.clientX - fRect.left, y: e.clientY - fRect.top };
}

socket.on('init', (data) => {
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
    const el = document.getElementById(data.id);
    if (el) el.remove();
});

socket.on('cardMoved', (data) => {
    let el = document.getElementById(data.id);
    if (!el) { restoreCard(data.id, data); return; }
    el.style.left = data.x; el.style.top = data.y; el.style.zIndex = data.zIndex;
    if (el.parentElement !== field) field.appendChild(el);
});

socket.on('cardFlipped', (data) => {
    const el = document.getElementById(data.id);
    if (el) {
        if (data.isFaceUp) { el.classList.add('face-up'); el.classList.remove('face-down'); }
        else { el.classList.add('face-down'); el.classList.remove('face-up'); }
    }
});

function createCardElement(cardData) {
    const el = document.createElement('div');
    el.className = `card face-up type-${cardData.type}`;
    el.id = cardData.id; el.innerText = cardData.name;
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
        
        // フィールドに移動させる際に absolute に切り替える
        if (el.parentElement !== field) {
            const coords = getLocalCoords(e);
            el.style.position = 'absolute';
            el.style.left = (coords.x - offsetX) + 'px';
            el.style.top = (coords.y - offsetY) + 'px';
            field.appendChild(el);
        }
        syncMove();
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
        // 判定：マウスが手札エリアに入ったら回収
        if (e.clientX > handRect.left && e.clientX < handRect.right && 
            e.clientY > handRect.top && e.clientY < handRect.bottom) {
            returnToHand();
        } else {
            snapToZone();
            syncMove();
        }
    }
    isDragging = false; currentCard = null;
});

function snapToZone() {
    const zones = document.querySelectorAll('.zone');
    let closest = null, minDist = SNAP_THRESHOLD;
    const cardRect = currentCard.getBoundingClientRect();
    const cardCenter = { x: cardRect.left + cardRect.width/2, y: cardRect.top + cardRect.height/2 };
    
    zones.forEach(zone => {
        const zr = zone.getBoundingClientRect();
        const zc = { x: zr.left + zr.width/2, y: zr.top + zr.height/2 };
        const dist = Math.hypot(cardCenter.x - zc.x, cardCenter.y - zc.y);
        if (dist < minDist) { minDist = dist; closest = zone; }
    });

    if (closest) {
        const zr = closest.getBoundingClientRect(), fr = field.getBoundingClientRect();
        currentCard.style.left = (zr.left - fr.left) + (zr.width - cardRect.width)/2 + 'px';
        currentCard.style.top = (zr.top - fr.top) + (zr.height - cardRect.height)/2 + 'px';
    }
}

function returnToHand() {
    // 手札に戻す際は絶対配置を解除する
    currentCard.style.position = 'relative';
    currentCard.style.left = '';
    currentCard.style.top = '';
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
