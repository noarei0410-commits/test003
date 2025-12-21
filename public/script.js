const socket = io();

let MASTER_CARDS = [];
let OSHI_LIST = [];
let AYLE_MASTER = [];

let mainDeckList = [];
let cheerDeckList = [];
let selectedOshi = null;

const modal = document.getElementById('setup-modal');
const field = document.getElementById('field');
const handDiv = document.getElementById('hand');

// データ読み込み
async function loadCardData() {
    try {
        const [holomenRes, supportRes, ayleRes, oshiRes] = await Promise.all([
            fetch('/data/holomen.json'),
            fetch('/data/support.json'),
            fetch('/data/ayle.json'),
            fetch('/data/oshi_holomen.json')
        ]);
        MASTER_CARDS = [...await holomenRes.json(), ...await supportRes.json(), ...await ayleRes.json(), ...await oshiRes.json()];
        OSHI_LIST = MASTER_CARDS.filter(c => OSHI_LIST.some ? false : false); // JSON再取得
        const oshiData = await oshiRes.json();
        OSHI_LIST = oshiData;
        AYLE_MASTER = await ayleRes.json();
        updateLibrary();
        renderDecks();
    } catch (e) { console.error("Load failed", e); }
}
loadCardData();

// デッキ構築UI
function updateLibrary(filter = "") {
    const list = document.getElementById('libraryList');
    list.innerHTML = "";
    MASTER_CARDS.filter(c => c.name.includes(filter) && c.type !== 'ayle').forEach(card => {
        const div = document.createElement('div');
        div.className = "library-item";
        const isOshi = OSHI_LIST.some(o => o.name === card.name);
        div.innerHTML = `<span>${card.name}</span><button class="btn-add">${isOshi ? '推し' : '追加'}</button>`;
        div.querySelector('.btn-add').onclick = () => addToDeck(card);
        list.appendChild(div);
    });
}

function addToDeck(card) {
    if (OSHI_LIST.some(o => o.name === card.name)) selectedOshi = { ...card };
    else if (card.type === 'ayle') {
        if (cheerDeckList.length < 20) cheerDeckList.push({ ...card });
    } else mainDeckList.push({ ...card });
    renderDecks();
}

function removeFromDeckByName(name, type) {
    const list = (type === 'ayle') ? cheerDeckList : mainDeckList;
    const idx = list.findIndex(c => c.name === name);
    if (idx !== -1) list.splice(idx, 1);
    renderDecks();
}

function renderDecks() {
    const oSummary = document.getElementById('oshiSummary');
    const mSummary = document.getElementById('mainDeckSummary');
    const cSummary = document.getElementById('cheerDeckSummary');
    
    oSummary.innerHTML = selectedOshi ? `<div class="deck-item"><span>${selectedOshi.name}</span><button class="btn-remove">外す</button></div>` : "";
    if (selectedOshi) oSummary.querySelector('.btn-remove').onclick = () => { selectedOshi = null; renderDecks(); };

    // メイン構築
    mSummary.innerHTML = "";
    const groupedMain = mainDeckList.reduce((acc, c) => { acc[c.name] = (acc[c.name] || { d: c, n: 0 }); acc[c.name].n++; return acc; }, {});
    Object.keys(groupedMain).forEach(name => {
        const item = groupedMain[name];
        const div = document.createElement('div'); div.className = "deck-item";
        div.innerHTML = `<span>${name}</span><div class="deck-item-controls"><button class="btn-minus">-</button><span>${item.n}</span><button class="btn-plus">+</button></div>`;
        div.querySelector('.btn-minus').onclick = () => removeFromDeckByName(name, 'main');
        div.querySelector('.btn-plus').onclick = () => addToDeck(item.d);
        mSummary.appendChild(div);
    });

    // エール構築
    cSummary.innerHTML = "";
    AYLE_MASTER.forEach(card => {
        const count = cheerDeckList.filter(c => c.name === card.name).length;
        const div = document.createElement('div'); div.className = "deck-item";
        div.innerHTML = `<span>${card.name}</span><div class="deck-item-controls"><button class="btn-minus" ${count===0?'disabled':''}>-</button><span>${count}</span><button class="btn-plus" ${cheerDeckList.length>=20?'disabled':''}>+</button></div>`;
        div.querySelector('.btn-minus').onclick = () => removeFromDeckByName(card.name, 'ayle');
        div.querySelector('.btn-plus').onclick = () => addToDeck(card);
        cSummary.appendChild(div);
    });

    document.getElementById('mainBuildCount').innerText = mainDeckList.length;
    document.getElementById('cheerBuildCount').innerText = cheerDeckList.length;
    document.getElementById('startGameBtn').disabled = (!selectedOshi || mainDeckList.length === 0 || cheerDeckList.length === 0);
}

document.getElementById('startGameBtn').onclick = () => {
    const oz = document.getElementById('oshi').getBoundingClientRect();
    const fr = field.getBoundingClientRect();
    const pos = { x: (oz.left - fr.left) + (oz.width - 60) / 2 + 'px', y: (oz.top - fr.top) + (oz.height - 85) / 2 + 'px' };
    
    socket.emit('setGame', {
        main: mainDeckList, // オブジェクトごと送る
        cheer: cheerDeckList,
        oshi: { name: selectedOshi.name, pos }
    });
    modal.style.display = "none";
};

// --- ゲームプレイ同期 ---
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

socket.on('deckCount', (counts) => {
    document.getElementById('mainCount').innerText = counts.main;
    document.getElementById('cheerCount').innerText = counts.cheer;
});

socket.on('receiveCard', (data) => {
    handDiv.appendChild(createCardElement(data));
});

// 【修正】onclickからonpointerdownに変更して感度を向上
document.getElementById('main-deck-zone').onpointerdown = (e) => {
    e.preventDefault();
    socket.emit('drawMainCard');
};
document.getElementById('cheer-deck-zone').onpointerdown = (e) => {
    e.preventDefault();
    socket.emit('drawCheerCard');
};

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
    el.id = data.id; el.innerText = data.name;
    el.className = `card face-up type-${data.type}`;
    
    if (data.type === 'ayle') {
        const colors = { '白': 'white', '緑': 'green', '赤': 'red', '青': 'blue', '黄': 'yellow', '紫': 'purple' };
        for (let kanji in colors) if (data.name.includes(kanji)) el.classList.add(`ayle-${colors[kanji]}`);
    }
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
    el.addEventListener('dblclick', (e) => {
        if (el.parentElement === handDiv) return;
        if (['back', 'center', 'collab'].includes(getZoneUnderCard(el))) return;
        el.classList.toggle('face-up'); el.classList.toggle('face-down');
        socket.emit('flipCard', { id: el.id, isFaceUp: el.classList.contains('face-up') });
    });

    el.addEventListener('pointerdown', (e) => {
        isDragging = true; currentCard = el;
        el.setPointerCapture(e.pointerId);
        const rect = el.getBoundingClientRect();
        offsetX = e.clientX - rect.left; offsetY = e.clientY - rect.top;
        maxZIndex++; el.style.zIndex = maxZIndex;
        if (el.parentElement !== field) {
            const fRect = field.getBoundingClientRect();
            el.style.position = 'absolute';
            el.style.left = (e.clientX - fRect.left - offsetX) + 'px';
            el.style.top = (e.clientY - fRect.top - offsetY) + 'px';
            field.appendChild(el);
        }
    });
}

document.addEventListener('pointermove', (e) => {
    if (!isDragging || !currentCard) return;
    const fRect = field.getBoundingClientRect();
    currentCard.style.left = (e.clientX - fRect.left - offsetX) + 'px';
    currentCard.style.top = (e.clientY - fRect.top - offsetY) + 'px';
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
        socket.emit('moveCard', { id: currentCard.id, name: currentCard.innerText, x: currentCard.style.left, y: currentCard.style.top, zIndex: currentCard.style.zIndex, type: currentCard.classList.contains('type-ayle')?'ayle': (currentCard.classList.contains('type-support')?'support':'holomen') });
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
