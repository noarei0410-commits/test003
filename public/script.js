const socket = io();

let MASTER_CARDS = [], OSHI_LIST = [], AYLE_MASTER = [];
let mainDeckList = [], cheerDeckList = [], selectedOshi = null;
let myRole = 'spectator';

const roomModal = document.getElementById('room-modal');
const setupModal = document.getElementById('setup-modal');
const zoomModal = document.getElementById('zoom-modal');
const zoomDisplay = document.getElementById('zoom-card-display');
const field = document.getElementById('field');
const handDiv = document.getElementById('hand');

// --- ズーム機能 ---
function openZoom(name, classList) {
    zoomDisplay.innerText = name;
    zoomDisplay.className = classList; // 枠色や背景色を引き継ぐ
    zoomDisplay.classList.remove('face-down'); // 必ず表側で表示
    zoomModal.style.display = 'flex';
}
zoomModal.onclick = () => zoomModal.style.display = 'none';

// --- 再配置ロジック ---
function repositionCards() {
    const fieldRect = field.getBoundingClientRect();
    document.querySelectorAll('.card').forEach(card => {
        if (card.parentElement !== field || card === currentCard) return; 
        if (card.dataset.zoneId) {
            const zone = document.getElementById(card.dataset.zoneId);
            if (zone) {
                const zr = zone.getBoundingClientRect();
                card.style.left = (zr.left - fieldRect.left) + (zr.width - 60) / 2 + 'px';
                card.style.top = (zr.top - fieldRect.top) + (zr.height - 85) / 2 + 'px';
                return;
            }
        }
        if (card.dataset.percentX) {
            card.style.left = (card.dataset.percentX / 100) * fieldRect.width + 'px';
            card.style.top = (card.dataset.percentY / 100) * fieldRect.height + 'px';
        }
    });
}
window.addEventListener('resize', repositionCards);

// データロード
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

// 入室処理
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
        document.querySelectorAll('.section-header').forEach(h => h.onclick = () => h.parentElement.classList.toggle('collapsed'));
    } else {
        document.body.classList.add('spectator-mode');
        document.getElementById('status').innerText = `Room: ${roomId} (観戦中)`;
        await loadCardData(); 
    }
}

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
    socket.emit('setGame', { main: mainDeckList, cheer: cheerDeckList, oshi: { name: selectedOshi.name } });
    setupModal.style.display = "none";
};

// 同期イベント
socket.on('gameStarted', (data) => {
    field.querySelectorAll('.card').forEach(c => c.remove()); handDiv.innerHTML = "";
    for (const id in data.fieldState) restoreCard(id, data.fieldState[id]);
    repositionCards();
});
socket.on('init', (d) => { 
    if (d.role === 'player') document.getElementById('status').innerText = `Player ID: ${d.id}`;
    field.querySelectorAll('.card').forEach(c => c.remove()); 
    for (const id in d.fieldState) restoreCard(id, d.fieldState[id]); 
    repositionCards();
});
socket.on('deckCount', (c) => { document.getElementById('mainCount').innerText = c.main; document.getElementById('cheerCount').innerText = c.cheer; });
socket.on('receiveCard', (d) => handDiv.appendChild(createCardElement(d)));
socket.on('cardMoved', (d) => { 
    let el = document.getElementById(d.id); 
    if(!el) return restoreCard(d.id, d); 
    el.dataset.zoneId = d.zoneId || "";
    el.dataset.percentX = d.percentX || "";
    el.dataset.percentY = d.percentY || "";
    el.style.zIndex = d.zIndex;
    if(el.parentElement !== field) field.appendChild(el); 
    repositionCards();
});
socket.on('cardRemoved', (d) => { const el = document.getElementById(d.id); if(el) el.remove(); });
socket.on('cardFlipped', (d) => { 
    const el = document.getElementById(d.id); 
    if(el) { el.classList.toggle('face-up', d.isFaceUp); el.classList.toggle('face-down', !d.isFaceUp); } 
});

document.getElementById('main-deck-zone').onpointerdown = (e) => { if(myRole==='player') socket.emit('drawMainCard'); };
document.getElementById('cheer-deck-zone').onpointerdown = (e) => { if(myRole==='player') socket.emit('drawCheerCard'); };

function createCardElement(data) {
    const el = document.createElement('div'); el.id = data.id; el.innerText = data.name; el.classList.add('card', 'face-up');
    if (data.type === 'ayle') {
        const colors = { '白': 'white', '緑': 'green', '赤': 'red', '青': 'blue', '黄': 'yellow', '紫': 'purple' };
        for (let k in colors) if (data.name.includes(k)) { el.classList.add(`ayle-${colors[k]}`); break; }
    } else if (data.type === 'support') el.classList.add('type-support');
    else el.classList.add('type-holomen');
    setupCardEvents(el); return el;
}

function restoreCard(id, info) {
    const el = createCardElement({ id, name: info.name, type: info.type });
    el.dataset.zoneId = info.zoneId || ""; el.dataset.percentX = info.percentX || ""; el.dataset.percentY = info.percentY || "";
    el.style.position = 'absolute'; el.style.zIndex = info.zIndex;
    el.classList.toggle('face-up', info.isFaceUp !== false); el.classList.toggle('face-down', info.isFaceUp === false);
    field.appendChild(el);
}

// --- ドラッグ&ズームロジック ---
let isDragging = false, currentCard = null, offsetX = 0, offsetY = 0, maxZIndex = 1000;
let startX = 0, startY = 0; // クリック判定用
let potentialZoomTarget = null; // 観戦者用のクリック判定ターゲット

function setupCardEvents(el) {
    el.addEventListener('dblclick', (e) => {
        if (myRole === 'spectator' || el.parentElement === handDiv) return;
        if (el.dataset.zoneId && ['back', 'center', 'collab'].includes(el.dataset.zoneId)) return;
        el.classList.toggle('face-up'); el.classList.toggle('face-down');
        socket.emit('flipCard', { id: el.id, isFaceUp: el.classList.contains('face-up') });
    });

    el.addEventListener('pointerdown', (e) => {
        // クリック開始位置を全員記録
        startX = e.clientX; startY = e.clientY;
        potentialZoomTarget = el;

        if (myRole === 'spectator') return; // 観戦者はドラッグ開始処理をスキップ
        
        isDragging = true; currentCard = el; el.setPointerCapture(e.pointerId);
        
        const rect = el.getBoundingClientRect();
        const fRect = field.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;

        maxZIndex++; el.style.zIndex = maxZIndex;

        if (el.parentElement !== field) {
            const initialLeft = rect.left - fRect.left;
            const initialTop = rect.top - fRect.top;
            el.style.position = 'absolute'; el.style.left = initialLeft + 'px'; el.style.top = initialTop + 'px';
            field.appendChild(el);
        }
        e.stopPropagation();
    });
}

document.addEventListener('pointermove', (e) => {
    if (!isDragging || !currentCard) return;
    const fRect = field.getBoundingClientRect();
    currentCard.style.left = (e.clientX - fRect.left - offsetX) + 'px';
    currentCard.style.top = (e.clientY - fRect.top - offsetY) + 'px';
});

document.addEventListener('pointerup', (e) => {
    // クリック判定（移動距離がわずかならズーム表示）
    // 観戦者でもプレイヤーでも動作するようにする
    const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
    if (dist < 5 && potentialZoomTarget && !potentialZoomTarget.classList.contains('face-down')) {
        openZoom(potentialZoomTarget.innerText, potentialZoomTarget.className);
    }
    potentialZoomTarget = null;

    if (myRole === 'spectator' || !isDragging || !currentCard) {
        isDragging = false; currentCard = null;
        return;
    }

    const hRect = handDiv.getBoundingClientRect();
    if (e.clientX > hRect.left && e.clientX < hRect.right && e.clientY > hRect.top && e.clientY < hRect.bottom) {
        currentCard.style.position = 'relative'; currentCard.style.left = ''; currentCard.style.top = ''; currentCard.style.zIndex = '';
        delete currentCard.dataset.zoneId; delete currentCard.dataset.percentX; delete currentCard.dataset.percentY;
        handDiv.appendChild(currentCard);
        socket.emit('returnToHand', { id: currentCard.id });
    } else {
        const zones = document.querySelectorAll('.zone');
        let closest = null, minDist = 45;
        const cr = currentCard.getBoundingClientRect();
        const cc = { x: cr.left + cr.width / 2, y: cr.top + cr.height / 2 };
        zones.forEach(z => {
            const zr = z.getBoundingClientRect(), zc = { x: zr.left + zr.width / 2, y: zr.top + zr.height / 2 };
            const d = Math.hypot(cc.x - zc.x, cc.y - zc.y);
            if (d < minDist) { minDist = d; closest = z; }
        });
        const fRect = field.getBoundingClientRect();
        let type = currentCard.classList.contains('type-ayle') ? 'ayle' : (currentCard.classList.contains('type-support') ? 'support' : 'holomen');
        let moveData = { id: currentCard.id, name: currentCard.innerText, zIndex: currentCard.style.zIndex, type: type };
        if (closest) {
            currentCard.dataset.zoneId = closest.id; delete currentCard.dataset.percentX; delete currentCard.dataset.percentY;
            moveData.zoneId = closest.id;
        } else {
            delete currentCard.dataset.zoneId;
            const pX = (parseFloat(currentCard.style.left) / fRect.width) * 100, pY = (parseFloat(currentCard.style.top) / fRect.height) * 100;
            currentCard.dataset.percentX = pX; currentCard.dataset.percentY = pY;
            moveData.percentX = pX; moveData.percentY = pY;
        }
        socket.emit('moveCard', moveData); repositionCards();
    }
    isDragging = false; currentCard = null;
});
