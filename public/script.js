const socket = io();

let MASTER_CARDS = [], OSHI_LIST = [], AYLE_MASTER = [];
let mainDeckList = [], cheerDeckList = [], selectedOshi = null;
let myRole = 'spectator';

const roomModal = document.getElementById('room-modal');
const setupModal = document.getElementById('setup-modal');
const field = document.getElementById('field');
const handDiv = document.getElementById('hand');

// --- 座標の正規化ロジック ---
// pxを%に変換
function getPercentPos(pxX, pxY) {
    const rect = field.getBoundingClientRect();
    return {
        x: (parseFloat(pxX) / rect.width) * 100,
        y: (parseFloat(pxY) / rect.height) * 100
    };
}
// %をpxに変換
function getPixelPos(percentX, percentY) {
    const rect = field.getBoundingClientRect();
    return {
        x: (percentX / 100) * rect.width + 'px',
        y: (percentY / 100) * rect.height + 'px'
    };
}

// データ読み込み
async function loadCardData() {
    try {
        const [h, s, a, o] = await Promise.all([
            fetch('/data/holomen.json'), fetch('/data/support.json'),
            fetch('/data/ayle.json'), fetch('/data/oshi_holomen.json')
        ]);
        MASTER_CARDS = [...await h.json(), ...await s.json()];
        AYLE_MASTER = await a.json(); OSHI_LIST = await o.json();
        MASTER_CARDS = [...MASTER_CARDS, ...OSHI_LIST];
        updateLibrary(); renderDecks();
    } catch (e) { console.error("Data error", e); }
}

// ルーム入室
document.getElementById('joinPlayerBtn').onclick = () => joinRoom('player');
document.getElementById('joinSpectatorBtn').onclick = () => joinRoom('spectator');

async function joinRoom(role) {
    const roomId = document.getElementById('roomIdInput').value;
    if (!roomId) return alert("ルームIDを入力してください");
    myRole = role;
    socket.emit('joinRoom', { roomId, role });
    roomModal.style.display = 'none';
    if (role === 'player') {
        setupModal.style.display = 'flex';
        await loadCardData();
        initCollapsible();
    } else {
        document.body.classList.add('spectator-mode');
        document.getElementById('status').innerText = `Room: ${roomId} (観戦中)`;
        // 観戦者もカード位置を正しく描画するために必要
        await loadCardData(); 
    }
}

function initCollapsible() {
    document.querySelectorAll('.section-header').forEach(h => h.onclick = () => h.parentElement.classList.toggle('collapsed'));
}

// デッキ構築UI... (略さず全文維持)
function updateLibrary(f = "") {
    const list = document.getElementById('libraryList');
    list.innerHTML = "";
    MASTER_CARDS.filter(c => c.name.includes(f) && c.type !== 'ayle').forEach(card => {
        const div = document.createElement('div'); div.className = "library-item";
        const isOshi = OSHI_LIST.some(o => o.name === card.name);
        div.innerHTML = `<span>${card.name}</span><button class="btn-add">${isOshi ? '設定' : '追加'}</button>`;
        div.querySelector('.btn-add').onclick = () => addToDeck(card);
        list.appendChild(div);
    });
}

function addToDeck(card) {
    if (OSHI_LIST.some(o => o.name === card.name)) selectedOshi = { ...card };
    else if (card.type === 'ayle') { if (cheerDeckList.length < 20) cheerDeckList.push({ ...card }); }
    else mainDeckList.push({ ...card });
    renderDecks();
}

function removeFromDeck(name, type) {
    const list = (type === 'ayle') ? cheerDeckList : mainDeckList;
    const idx = list.findIndex(c => c.name === name);
    if (idx !== -1) list.splice(idx, 1);
    renderDecks();
}

function renderDecks() {
    const oSum = document.getElementById('oshiSummary'), mSum = document.getElementById('mainDeckSummary'), cSum = document.getElementById('cheerDeckSummary');
    if (!oSum) return;
    oSum.innerHTML = selectedOshi ? `<div class="deck-item"><span>${selectedOshi.name}</span><button class="btn-remove">外す</button></div>` : "";
    if (selectedOshi) oSum.querySelector('.btn-remove').onclick = () => { selectedOshi = null; renderDecks(); };
    mSum.innerHTML = "";
    const gMain = mainDeckList.reduce((acc, c) => { acc[c.name] = (acc[c.name] || { d: c, n: 0 }); acc[c.name].n++; return acc; }, {});
    Object.keys(gMain).forEach(n => {
        const item = gMain[n], div = document.createElement('div'); div.className = "deck-item";
        div.innerHTML = `<span>${n}</span><div class="deck-item-controls"><button class="btn-minus">-</button><span>${item.n}</span><button class="btn-plus">+</button></div>`;
        div.querySelector('.btn-minus').onclick = () => removeFromDeck(n, 'main');
        div.querySelector('.btn-plus').onclick = () => addToDeck(item.d);
        mSum.appendChild(div);
    });
    cSum.innerHTML = "";
    AYLE_MASTER.forEach(card => {
        const count = cheerDeckList.filter(c => c.name === card.name).length;
        const div = document.createElement('div'); div.className = "deck-item";
        div.innerHTML = `<span>${card.name}</span><div class="deck-item-controls"><button class="btn-minus" ${count===0?'disabled':''}>-</button><span>${count}</span><button class="btn-plus" ${cheerDeckList.length>=20?'disabled':''}>+</button></div>`;
        div.querySelector('.btn-minus').onclick = () => removeFromDeck(card.name, 'ayle');
        div.querySelector('.btn-plus').onclick = () => addToDeck(card);
        cSum.appendChild(div);
    });
    document.getElementById('mainBuildCount').innerText = mainDeckList.length;
    document.getElementById('cheerBuildCount').innerText = cheerDeckList.length;
    document.getElementById('startGameBtn').disabled = (!selectedOshi || mainDeckList.length === 0 || cheerDeckList.length === 0);
}

document.getElementById('searchInput').oninput = (e) => updateLibrary(e.target.value);
document.getElementById('startGameBtn').onclick = () => {
    const oz = document.getElementById('oshi').getBoundingClientRect(), fr = field.getBoundingClientRect();
    const pxX = (oz.left - fr.left) + (oz.width - 60) / 2;
    const pxY = (oz.top - fr.top) + (oz.height - 85) / 2;
    const pPos = getPercentPos(pxX, pxY);
    socket.emit('setGame', { main: mainDeckList, cheer: cheerDeckList, oshi: { name: selectedOshi.name, percentX: pPos.x, percentY: pPos.y } });
    setupModal.style.display = "none";
};

// --- ゲームプレイ同期 ---
let isDragging = false, currentCard = null, offsetX = 0, offsetY = 0, maxZIndex = 100;

socket.on('gameStarted', (data) => {
    field.querySelectorAll('.card').forEach(c => c.remove()); handDiv.innerHTML = "";
    for (const id in data.fieldState) restoreCard(id, data.fieldState[id]);
    updateDeckCounts(data.deckCount);
});

socket.on('init', (d) => { 
    if (d.role === 'player') document.getElementById('status').innerText = `Player ID: ${d.id}`;
    field.querySelectorAll('.card').forEach(c => c.remove()); 
    for (const id in d.fieldState) restoreCard(id, d.fieldState[id]); 
});

socket.on('deckCount', updateDeckCounts);
socket.on('receiveCard', (d) => handDiv.appendChild(createCardElement(d)));
socket.on('cardMoved', (d) => { 
    let el = document.getElementById(d.id); 
    if(!el) return restoreCard(d.id, d); 
    const pos = getPixelPos(d.percentX, d.percentY);
    el.style.left = pos.x; el.style.top = pos.y; el.style.zIndex = d.zIndex; 
    if(el.parentElement !== field) field.appendChild(el); 
});
socket.on('cardRemoved', (d) => { const el = document.getElementById(d.id); if(el) el.remove(); });
socket.on('cardFlipped', (d) => { 
    const el = document.getElementById(d.id); 
    if(el) { el.classList.toggle('face-up', d.isFaceUp); el.classList.toggle('face-down', !d.isFaceUp); } 
});

function updateDeckCounts(c) { document.getElementById('mainCount').innerText = c.main; document.getElementById('cheerCount').innerText = c.cheer; }

document.getElementById('main-deck-zone').onpointerdown = (e) => { if(myRole==='player') socket.emit('drawMainCard'); };
document.getElementById('cheer-deck-zone').onpointerdown = (e) => { if(myRole==='player') socket.emit('drawCheerCard'); };

// ウィンドウサイズ変更時に全カードを再配置
window.onresize = () => {
    field.querySelectorAll('.card').forEach(card => {
        if (!card.dataset.percentX) return;
        const pos = getPixelPos(card.dataset.percentX, card.dataset.percentY);
        card.style.left = pos.x; card.style.top = pos.y;
    });
};

function createCardElement(data) {
    const el = document.createElement('div'); el.id = data.id; el.innerText = data.name; el.className = `card face-up type-${data.type}`;
    if (data.type === 'ayle') {
        const colors = { '白': 'white', '緑': 'green', '赤': 'red', '青': 'blue', '黄': 'yellow', '紫': 'purple' };
        for (let k in colors) if (data.name.includes(k)) el.classList.add(`ayle-${colors[k]}`);
    }
    setupCardEvents(el); return el;
}

function restoreCard(id, info) {
    const el = createCardElement({ id, name: info.name, type: info.type });
    el.dataset.percentX = info.percentX; el.dataset.percentY = info.percentY;
    const pos = getPixelPos(info.percentX, info.percentY);
    el.style.position = 'absolute'; el.style.left = pos.x; el.style.top = pos.y; el.style.zIndex = info.zIndex;
    el.classList.toggle('face-up', info.isFaceUp !== false); el.classList.toggle('face-down', info.isFaceUp === false);
    field.appendChild(el);
}

function setupCardEvents(el) {
    el.addEventListener('dblclick', (e) => {
        if (myRole === 'spectator' || el.parentElement === handDiv) return;
        el.classList.toggle('face-up'); el.classList.toggle('face-down');
        socket.emit('flipCard', { id: el.id, isFaceUp: el.classList.contains('face-up') });
    });
    el.addEventListener('pointerdown', (e) => {
        if (myRole === 'spectator') return;
        isDragging = true; currentCard = el; el.setPointerCapture(e.pointerId);
        const rect = el.getBoundingClientRect(); offsetX = e.clientX - rect.left; offsetY = e.clientY - rect.top;
        maxZIndex++; el.style.zIndex = maxZIndex;
        if (el.parentElement !== field) {
            const fRect = field.getBoundingClientRect(); el.style.position = 'absolute';
            el.style.left = (e.clientX - fRect.left - offsetX) + 'px'; el.style.top = (e.clientY - fRect.top - offsetY) + 'px';
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
    const hRect = handDiv.getBoundingClientRect();
    if (e.clientX > hRect.left && e.clientX < hRect.right && e.clientY > hRect.top && e.clientY < hRect.bottom) {
        currentCard.style.position = 'relative'; currentCard.style.left = ''; currentCard.style.top = '';
        delete currentCard.dataset.percentX; delete currentCard.dataset.percentY;
        handDiv.appendChild(currentCard); socket.emit('returnToHand', { id: currentCard.id });
    } else {
        snapToZone();
        const pPos = getPercentPos(currentCard.style.left, currentCard.style.top);
        currentCard.dataset.percentX = pPos.x; currentCard.dataset.percentY = pPos.y;
        socket.emit('moveCard', { id: currentCard.id, name: currentCard.innerText, percentX: pPos.x, percentY: pPos.y, zIndex: currentCard.style.zIndex, type: currentCard.classList.contains('type-ayle')?'ayle':(currentCard.classList.contains('type-support')?'support':'holomen') });
    }
    isDragging = false; currentCard = null;
});

function snapToZone() {
    const zones = document.querySelectorAll('.zone'); let closest = null, minDist = 40;
    const cr = currentCard.getBoundingClientRect(), cc = { x: cr.left + cr.width/2, y: cr.top + cr.height/2 };
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
