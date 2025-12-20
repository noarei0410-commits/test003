const socket = io();

let MASTER_CARDS = [];
let OSHI_LIST = [];
let mainDeckList = [];
let cheerDeckList = [];
let selectedOshi = null;

const modal = document.getElementById('setup-modal');
const field = document.getElementById('field');
const handDiv = document.getElementById('hand');

// データ読み込み
async function loadCardData() {
    try {
        const [holomenRes, ayleRes, oshiRes] = await Promise.all([
            fetch('/data/holomen.json'),
            fetch('/data/ayle.json'),
            fetch('/data/oshi_holomen.json')
        ]);
        MASTER_CARDS = [...await holomenRes.json(), ...await ayleRes.json()];
        OSHI_LIST = await oshiRes.json();
        MASTER_CARDS = [...MASTER_CARDS, ...OSHI_LIST];
        updateLibrary();
    } catch (e) { console.error("Data load failed", e); }
}
loadCardData();

// デッキ構築UI
function updateLibrary(filter = "") {
    const list = document.getElementById('libraryList');
    list.innerHTML = "";
    MASTER_CARDS.filter(c => c.name.includes(filter)).forEach(card => {
        const div = document.createElement('div');
        div.className = "library-item";
        const isOshi = OSHI_LIST.some(o => o.name === card.name);
        div.innerHTML = `<span>${card.name}</span><button class="btn-add">${isOshi ? '推し' : '追加'}</button>`;
        div.querySelector('.btn-add').onclick = () => addToDeck(card);
        list.appendChild(div);
    });
}

function addToDeck(card) {
    const isOshi = OSHI_LIST.some(o => o.name === card.name);
    if (isOshi) selectedOshi = { ...card };
    else if (card.type === 'ayle') {
        if (cheerDeckList.length < 20) cheerDeckList.push({ ...card });
    } else mainDeckList.push({ ...card });
    renderDecks();
}

function renderDecks() {
    const oSummary = document.getElementById('oshiSummary');
    const mSummary = document.getElementById('mainDeckSummary');
    const cSummary = document.getElementById('cheerDeckSummary');
    
    oSummary.innerHTML = selectedOshi ? `<div class="deck-item"><span>${selectedOshi.name}</span><button class="btn-remove">外す</button></div>` : "";
    if (selectedOshi) oSummary.querySelector('.btn-remove').onclick = () => { selectedOshi = null; renderDecks(); };

    mSummary.innerHTML = "";
    mainDeckList.forEach((c, i) => {
        const d = document.createElement('div'); d.className = "deck-item";
        d.innerHTML = `<span>${c.name}</span><button class="btn-remove">削</button>`;
        d.querySelector('.btn-remove').onclick = () => { mainDeckList.splice(i, 1); renderDecks(); };
        mSummary.appendChild(d);
    });

    cSummary.innerHTML = "";
    const grouped = cheerDeckList.reduce((acc, c) => { acc[c.name] = (acc[c.name] || { d: c, n: 0 }); acc[c.name].n++; return acc; }, {});
    Object.keys(grouped).forEach(name => {
        const item = grouped[name];
        const div = document.createElement('div'); div.className = "deck-item";
        div.innerHTML = `<span>${name}</span><div class="deck-item-controls"><button class="btn-minus">-</button><span>${item.n}</span><button class="btn-plus" ${cheerDeckList.length >= 20 ? 'disabled' : ''}>+</button></div>`;
        div.querySelector('.btn-minus').onclick = () => { const idx = cheerDeckList.findIndex(c => c.name === name); cheerDeckList.splice(idx, 1); renderDecks(); };
        div.querySelector('.btn-plus').onclick = () => addToDeck(item.d);
        cSummary.appendChild(div);
    });

    document.getElementById('mainBuildCount').innerText = mainDeckList.length;
    document.getElementById('cheerBuildCount').innerText = cheerDeckList.length;
    document.getElementById('startGameBtn').disabled = (!selectedOshi || mainDeckList.length === 0 || cheerDeckList.length === 0);
}

document.getElementById('searchInput').oninput = (e) => updateLibrary(e.target.value);
document.getElementById('startGameBtn').onclick = () => {
    const oz = document.getElementById('oshi').getBoundingClientRect();
    const fr = field.getBoundingClientRect();
    const pos = { x: (oz.left - fr.left) + (oz.width - 60) / 2 + 'px', y: (oz.top - fr.top) + (oz.height - 85) / 2 + 'px' };
    socket.emit('setGame', { main: mainDeckList.map(c => c.name), cheer: cheerDeckList.map(c => c.name), oshi: { name: selectedOshi.name, pos } });
    modal.style.display = "none";
};

// --- ゲームプレイ ---
let isDragging = false, currentCard = null, offsetX = 0, offsetY = 0, maxZIndex = 100;

socket.on('gameStarted', (data) => {
    field.querySelectorAll('.card').forEach(c => c.remove());
    handDiv.innerHTML = "";
    for (const id in data.fieldState) restoreCard(id, data.fieldState[id]);
    document.getElementById('mainCount').innerText = data.deckCount.main;
    document.getElementById('cheerCount').innerText = data.deckCount.cheer;
});

socket.on('init', (data) => {
    field.querySelectorAll('.card').forEach(c => c.remove());
    for (const id in data.fieldState) restoreCard(id, data.fieldState[id]);
});

socket.on('receiveCard', (data) => handDiv.appendChild(createCardElement(data)));

document.getElementById('main-deck-zone').onclick = () => socket.emit('drawMainCard');
document.getElementById('cheer-deck-zone').onclick = () => socket.emit('drawCheerCard');

function getLocalCoords(e) {
    const rect = field.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function getZoneUnderCard(card) {
    const zones = document.querySelectorAll('.zone');
    const cr = card.getBoundingClientRect();
    const cc = { x: cr.left + cr.width/2, y: cr.top + cr.height/2 };
    for (let z of zones) {
        const zr = z.getBoundingClientRect();
        if (cc.x >= zr.left && cc.x <= zr.right && cc.y >= zr.top && cc.y <= zr.bottom) return z.id;
    }
    return null;
}

function createCardElement(data) {
    const el = document.createElement('div');
    el.className = `card face-up type-${data.type}`;
    el.id = data.id; el.innerText = data.name;
    setupCardEvents(el);
    return el;
}

function restoreCard(id, info) {
    const el = createCardElement({ id, name: info.name, type: info.type });
    el.style.position = 'absolute'; el.style.left = info.x; el.style.top = info.y; el.style.zIndex = info.zIndex;
    if (info.isFaceUp === false) { el.classList.add('face-down'); el.classList.remove('face-up'); }
    field.appendChild(el);
}

function setupCardEvents(el) {
    // スマホ向けにダブルタップで裏返し（dblclickはスマホでも動作しますがPointerとの相性に注意）
    el.addEventListener('dblclick', (e) => {
        if (el.parentElement === handDiv) return;
        if (['back', 'center', 'collab'].includes(getZoneUnderCard(el))) return;
        el.classList.toggle('face-up'); el.classList.toggle('face-down');
        socket.emit('flipCard', { id: el.id, isFaceUp: el.classList.contains('face-up') });
    });

    // Pointer Eventsによりマウス・タッチ両対応
    el.addEventListener('pointerdown', (e) => {
        isDragging = true; currentCard = el;
        el.setPointerCapture(e.pointerId); // タッチした指をカードに固定
        const rect = el.getBoundingClientRect();
        offsetX = e.clientX - rect.left; offsetY = e.clientY - rect.top;
        maxZIndex++; el.style.zIndex = maxZIndex;
        
        if (el.parentElement !== field) {
            const coords = getLocalCoords(e);
            el.style.position = 'absolute';
            el.style.left = (coords.x - offsetX) + 'px'; el.style.top = (coords.y - offsetY) + 'px';
            field.appendChild(el);
        }
    });
}

document.addEventListener('pointermove', (e) => {
    if (!isDragging || !currentCard) return;
    const coords = getLocalCoords(e);
    currentCard.style.left = (coords.x - offsetX) + 'px';
    currentCard.style.top = (coords.y - offsetY) + 'px';
});

document.addEventListener('pointerup', (e) => {
    if (!isDragging || !currentCard) return;
    const handRect = handDiv.getBoundingClientRect();
    if (e.clientX > handRect.left && e.clientX < handRect.right && e.clientY > handRect.top && e.clientY < handRect.bottom) {
        currentCard.style.position = 'relative'; currentCard.style.left = ''; currentCard.style.top = '';
        handDiv.appendChild(currentCard);
        socket.emit('returnToHand', { id: currentCard.id });
    } else {
        snapToZone();
        socket.emit('moveCard', { id: currentCard.id, name: currentCard.innerText, x: currentCard.style.left, y: currentCard.style.top, zIndex: currentCard.style.zIndex, type: currentCard.classList.contains('type-ayle')?'ayle':'holomen' });
    }
    isDragging = false; currentCard = null;
});

function snapToZone() {
    const zones = document.querySelectorAll('.zone');
    let closest = null, minDist = 40;
    const cr = currentCard.getBoundingClientRect();
    const cc = { x: cr.left + cr.width/2, y: cr.top + cr.height/2 };
    zones.forEach(z => {
        const zr = z.getBoundingClientRect(), zc = { x: zr.left + zr.width/2, y: zr.top + zr.height/2 };
        const d = Math.hypot(cc.x - zc.x, cc.y - zc.y);
        if (d < minDist) { minDist = d; closest = z; }
    });
    if (closest) {
        const zr = closest.getBoundingClientRect(), fr = field.getBoundingClientRect();
        currentCard.style.left = (zr.left - fr.left) + (zr.width - cr.width)/2 + 'px';
        currentCard.style.top = (zr.top - fr.top) + (zr.height - cr.height)/2 + 'px';
    }
}
