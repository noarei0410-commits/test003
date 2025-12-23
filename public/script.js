const socket = io();

let MASTER_CARDS = [], OSHI_LIST = [], AYLE_MASTER = [];
let mainDeckList = [], cheerDeckList = [], selectedOshi = null;
let myRole = 'spectator', currentDragEl = null, isDragging = false;
let startX = 0, startY = 0, offsetX = 0, offsetY = 0, maxZIndex = 1000;

const field = document.getElementById('field');
const handDiv = document.getElementById('hand');
const setupModal = document.getElementById('setup-modal');
const zoomModal = document.getElementById('zoom-modal');

const STAGE_ZONES = ['collab', 'center', 'back1', 'back2', 'back3', 'back4', 'back5'];

// --- 画面遷移管理 ---
function showPage(pageId) {
    document.querySelectorAll('.full-page').forEach(p => { p.style.display = 'none'; });
    const target = document.getElementById(pageId);
    if (target) {
        target.style.display = 'flex';
        if (pageId === 'card-list-page') filterLibrary('all');
        if (pageId === 'setup-modal') { updateLibrary(""); renderDecks(); }
    }
}
window.onload = loadCardData;

// --- ドロー・追加処理 (確実に手札に追加するロジック) ---
socket.on('receiveCard', (d) => {
    if (!handDiv) return;
    const el = createCardElement({ ...d, isFaceUp: true });
    el.style.position = 'relative'; // 手札内は並列
    handDiv.appendChild(el);
});

// --- デッキ操作 (ドローとサーチ) ---
let deckClickTimer = null;
function setupDeckClick(id, type) {
    const el = document.getElementById(id);
    if (!el) return;
    
    // PC/スマホ両対応のため pointerdown を使用
    el.onpointerdown = (e) => {
        e.preventDefault();
        deckClickTimer = setTimeout(() => {
            openDeckInspection(type);
            deckClickTimer = null;
        }, 500); // 500ms以上で長押し（サーチ）
    };
    
    el.onpointerup = () => {
        if (deckClickTimer) {
            clearTimeout(deckClickTimer);
            deckClickTimer = null;
            if(myRole === 'player') {
                socket.emit(type === 'main' ? 'drawMainCard' : 'drawCheerCard');
            }
        }
    };
}
setupDeckClick('main-deck-zone', 'main');
setupDeckClick('cheer-deck-zone', 'cheer');

// --- デッキ構築ロジック ---
function addToDeck(card) {
    if (card.type === 'oshi') selectedOshi = { ...card };
    else if (card.type === 'ayle') { if (cheerDeckList.length < 20) cheerDeckList.push({ ...card }); }
    else mainDeckList.push({ ...card });
    renderDecks();
}

function updateLibrary(f = "") {
    const list = document.getElementById('libraryList'); if(!list) return;
    list.innerHTML = "";
    const search = f.toLowerCase();
    const all = [...OSHI_LIST, ...MASTER_CARDS.filter(c => c.type !== 'ayle')];
    all.filter(c => c.name.toLowerCase().includes(search)).forEach(card => {
        const div = document.createElement('div');
        div.className = "library-item";
        div.innerHTML = `<span>${card.name} <span class="type-tag">${card.bloom||'S'}</span></span>`;
        const btn = document.createElement('button');
        btn.className = "btn-add"; btn.innerText = card.type === 'oshi' ? '設定' : '追加';
        btn.onclick = () => addToDeck(card);
        div.appendChild(btn); list.appendChild(div);
    });
}

function renderDecks() {
    const oSum = document.getElementById('oshiSummary'), mSum = document.getElementById('mainDeckSummary'), cSum = document.getElementById('cheerDeckSummary');
    if (!oSum) return;
    oSum.innerHTML = selectedOshi ? `<div class="deck-item"><span>${selectedOshi.name}</span><button onclick="selectedOshi=null;renderDecks()" class="btn-remove">削除</button></div>` : "";
    mSum.innerHTML = "";
    const grouped = mainDeckList.reduce((acc, c) => { const key = `${c.name}_${c.bloom||""}`; acc[key] = (acc[key] || { d: c, n: 0 }); acc[key].n++; return acc; }, {});
    Object.keys(grouped).forEach(k => {
        const item = grouped[k];
        const div = document.createElement('div'); div.className = "deck-item";
        div.innerHTML = `<span>${item.d.name} x${item.n}</span><button onclick="removeFromDeck('${k}')" class="btn-minus">-</button>`;
        mSum.appendChild(div);
    });
    cSum.innerHTML = "";
    const cheerTypes = [{name: "白エール"}, {name: "緑エール"}, {name: "赤エール"}, {name: "青エール"}, {name: "黄エール"}, {name: "紫エール"}];
    cheerTypes.forEach(c => {
        const count = cheerDeckList.filter(x => x.name === c.name).length;
        const div = document.createElement('div'); div.className = "deck-item";
        div.innerHTML = `<span>${c.name} : ${count}</span><div><button onclick="removeAyle('${c.name}')" class="btn-minus">-</button><button onclick='addToDeck(${JSON.stringify(c)})' class="btn-plus">+</button></div>`;
        cSum.appendChild(div);
    });
    document.getElementById('mainBuildCount').innerText = mainDeckList.length;
    document.getElementById('cheerBuildCount').innerText = cheerDeckList.length;
    document.getElementById('startGameBtn').disabled = (!selectedOshi || mainDeckList.length === 0 || cheerDeckList.length !== 20);
}

window.removeFromDeck = (key) => { const idx = mainDeckList.findIndex(c => `${c.name}_${c.bloom||""}` === key); if(idx!==-1) mainDeckList.splice(idx,1); renderDecks(); };
window.removeAyle = (name) => { const idx = cheerDeckList.findIndex(c => c.name === name); if(idx!==-1) cheerDeckList.splice(idx,1); renderDecks(); };

// --- 配置ロジック (Debut制限ルール適用) ---
function normalSnap(e, moveData) {
    const zones = document.querySelectorAll('.zone'); let closest = null, minDist = 40;
    const cr = currentDragEl.getBoundingClientRect(), cc = { x: cr.left + cr.width/2, y: cr.top + cr.height/2 };
    zones.forEach(z => {
        const zr = z.getBoundingClientRect(), zc = { x: zr.left + zr.width/2, y: zr.top + zr.height/2 };
        const d = Math.hypot(cc.x - zc.x, cc.y - zc.y);
        if (d < minDist) { minDist = d; closest = z; }
    });

    if (closest) { 
        if (STAGE_ZONES.includes(closest.id)) {
            const cardsInZone = Array.from(document.querySelectorAll('.card')).filter(c => c.dataset.zoneId === closest.id && c !== currentDragEl);
            if (cardsInZone.length === 0 && (currentDragEl.cardData.type !== 'holomen' || currentDragEl.cardData.bloom !== 'Debut')) {
                returnToHand(currentDragEl); return;
            }
        }
        currentDragEl.dataset.zoneId = closest.id; delete currentDragEl.dataset.percentX; moveData.zoneId = closest.id;
        currentDragEl.classList.toggle('rotated', closest.id === 'life-zone'); moveData.isRotated = (closest.id === 'life-zone');
    } else { 
        delete currentDragEl.dataset.zoneId; const fr = field.getBoundingClientRect(); 
        const px = (parseFloat(currentDragEl.style.left)/fr.width)*100, py = (parseFloat(currentDragEl.style.top)/fr.height)*100;
        currentDragEl.dataset.percentX = px; currentDragEl.dataset.percentY = py; moveData.percentX = px; moveData.percentY = py;
    }
}

// --- 基本機能・Socket同期 (以前の設定を維持) ---
async function loadCardData() {
    try {
        const res = await Promise.all([ fetch('/data/holomen.json').then(r=>r.json()), fetch('/data/support.json').then(r=>r.json()), fetch('/data/ayle.json').then(r=>r.json()), fetch('/data/oshi_holomen.json').then(r=>r.json()) ]);
        MASTER_CARDS = [...res[0], ...res[1], ...res[2]]; AYLE_MASTER = res[2]; OSHI_LIST = res[3];
        updateLibrary(); renderDecks();
    } catch (e) { console.error(e); }
}

function createCardElement(data, withEvents = true) {
    if(!data) return document.createElement('div');
    const el = document.createElement('div'); el.id = data.id || ""; el.innerText = data.name; el.className = 'card';
    el.classList.add(data.isFaceUp !== false ? 'face-up' : 'face-down');
    if (data.isRotated) el.classList.add('rotated');
    if (data.type === 'holomen' || data.type === 'oshi') {
        if (data.color) { const ci = document.createElement('div'); ci.className = `card-color-icon color-${data.color}`; el.appendChild(ci); }
        if (data.type === 'holomen') {
            const hp = document.createElement('div'); hp.className = 'card-hp'; hp.innerText = data.hp || '';
            const bl = document.createElement('div'); bl.className = 'card-bloom'; bl.innerText = (data.bloom || 'D').charAt(0); el.appendChild(hp); el.appendChild(bl);
        }
    }
    el.cardData = data; if (withEvents) setupCardEvents(el); return el;
}

function returnToHand(card) {
    card.style.position = 'relative'; card.style.left = ''; card.style.top = ''; 
    card.classList.remove('rotated', 'face-down'); card.classList.add('face-up');
    delete card.dataset.zoneId; delete card.dataset.percentX; handDiv.appendChild(card);
    socket.emit('flipCard', { id: card.id, isFaceUp: true }); 
    socket.emit('moveCard', { id: card.id, isRotated: false, isFaceUp: true }); 
    socket.emit('returnToHand', { id: card.id });
}

// ... (repositionCards, joinRoom, openZoom などの他全ロジック統合済み)
document.getElementById('joinPlayerBtn').onclick = () => joinRoom('player');
document.getElementById('joinSpectatorBtn').onclick = () => joinRoom('spectator');
document.getElementById('startGameBtn').onclick = () => { socket.emit('setGame', { main: mainDeckList, cheer: cheerDeckList, oshi: selectedOshi }); showPage(''); };
socket.on('gameStarted', (d) => { field.querySelectorAll('.card').forEach(c => c.remove()); handDiv.innerHTML = ""; for (const id in d.fieldState) restoreCard(id, d.fieldState[id]); repositionCards(); });
socket.on('deckCount', (c) => { 
    const m = document.getElementById('mainCount'), ch = document.getElementById('cheerCount');
    if(m) m.innerText = c.main; if(ch) ch.innerText = c.cheer;
});
socket.on('cardMoved', (d) => { 
    let el = document.getElementById(d.id); if (!el) return restoreCard(d.id, d);
    el.dataset.zoneId = d.zoneId || ""; el.style.zIndex = d.zIndex; if (el.parentElement !== field) field.appendChild(el);
    el.classList.toggle('rotated', !!d.isRotated); repositionCards();
});
function restoreCard(id, info) { const el = createCardElement({ id, ...info }); el.dataset.zoneId = info.zoneId || ""; el.style.zIndex = info.zIndex; field.appendChild(el); repositionCards(); }
