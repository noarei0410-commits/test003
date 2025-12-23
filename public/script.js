const socket = io();

let MASTER_CARDS = [], OSHI_LIST = [], AYLE_MASTER = [];
let mainDeckList = [], cheerDeckList = [], selectedOshi = null;
let myRole = 'spectator', currentDragEl = null, isDragging = false;
let startX = 0, startY = 0, offsetX = 0, offsetY = 0, maxZIndex = 1000;
let originalNextSibling = null, potentialZoomTarget = null;
let currentFilter = 'all';

const field = document.getElementById('field');
const handDiv = document.getElementById('hand');
const zoomModal = document.getElementById('zoom-modal');
const deckModal = document.getElementById('deck-inspection-modal');
const deckGrid = document.getElementById('deck-card-grid');

// --- 画面遷移管理 (ハブ遷移の安定化) ---
function showPage(pageId) {
    const pages = document.querySelectorAll('.full-page');
    pages.forEach(p => { p.style.display = 'none'; });
    
    if (pageId) {
        const target = document.getElementById(pageId);
        if (target) {
            target.style.display = 'flex';
            if (pageId === 'card-list-page') filterLibrary('all');
        }
    }
}
window.onload = loadCardData;

// --- カードリスト描画 ---
function filterLibrary(type) {
    currentFilter = type;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        const text = btn.innerText;
        const typeMap = { all: 'すべて', holomen: 'ホロメン', support: 'サポート', ayle: 'エール', oshi: '推し' };
        btn.classList.toggle('active', text === typeMap[type]);
    });

    const grid = document.getElementById('global-card-grid'); if (!grid) return;
    grid.innerHTML = "";
    let list = (type === 'all') ? [...OSHI_LIST, ...MASTER_CARDS] : (type === 'oshi' ? OSHI_LIST : MASTER_CARDS.filter(c => c.type === type));
    list.forEach(card => {
        const el = createCardElement(card, false); 
        el.onclick = () => openZoom(card, el); 
        grid.appendChild(el);
    });
}

// --- カード生成 ---
function createCardElement(data, withEvents = true) {
    if (!data) return document.createElement('div');
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

// --- 配置ロジック (ライフの縦並びと枠吸着) ---
function repositionCards() {
    const fRect = field.getBoundingClientRect();
    const zoneCounts = {};
    document.querySelectorAll('.card').forEach(card => {
        if (card.parentElement !== field || card === currentDragEl) return;
        const zid = card.dataset.zoneId;
        if (zid) {
            const z = document.getElementById(zid); if(!z) return;
            const zr = z.getBoundingClientRect(), cr = card.getBoundingClientRect();
            if (!zoneCounts[zid]) zoneCounts[zid] = 0;
            if (zid === 'life-zone') {
                const off = zoneCounts[zid] * 18;
                card.style.left = (zr.left - fRect.left) + (zr.width - cr.width) / 2 + 'px';
                card.style.top = (zr.top - fRect.top) + 5 + off + 'px';
            } else {
                card.style.left = (zr.left - fRect.left) + (zr.width - cr.width) / 2 + 'px';
                card.style.top = (zr.top - fRect.top) + (zr.height - cr.height) / 2 + 'px';
            }
            zoneCounts[zid]++;
        } else if (card.dataset.percentX) {
            card.style.left = (card.dataset.percentX/100)*fRect.width + 'px';
            card.style.top = (card.dataset.percentY/100)*fRect.height + 'px';
        }
    });
}
window.onresize = repositionCards;

// --- ステージ制限エリア定義 ---
const STAGE_ZONES = ['collab', 'center', 'back1', 'back2', 'back3', 'back4', 'back5'];

// --- 操作イベント (配置制限・手札管理) ---
function setupCardEvents(el) {
    el.onpointerdown = (e) => {
        startX = e.clientX; startY = e.clientY; potentialZoomTarget = el;
        if (myRole === 'spectator') return;
        isDragging = true; currentDragEl = el; el.setPointerCapture(e.pointerId);
        const rect = el.getBoundingClientRect(), fRect = field.getBoundingClientRect();
        offsetX = e.clientX - rect.left; offsetY = e.clientY - rect.top;
        maxZIndex++; el.style.zIndex = maxZIndex;
        if (el.parentElement !== field) { 
            el.style.position = 'absolute'; 
            el.style.left = (rect.left - fRect.left) + 'px'; 
            el.style.top = (rect.top - fRect.top) + 'px'; 
            field.appendChild(el); 
        }
        e.stopPropagation();
    };
}

document.onpointermove = (e) => { if (!isDragging || !currentDragEl) return; const fr = field.getBoundingClientRect(); currentDragEl.style.left = (e.clientX - fr.left - offsetX) + 'px'; currentDragEl.style.top = (e.clientY - fr.top - offsetY) + 'px'; };
document.onpointerup = (e) => {
    const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
    if (potentialZoomTarget && dist < 20) openZoom(potentialZoomTarget.cardData, potentialZoomTarget);
    if (myRole === 'spectator' || !isDragging || !currentDragEl) { isDragging = false; currentDragEl = null; return; }
    
    const hRect = handDiv.getBoundingClientRect();
    if (e.clientX > hRect.left && e.clientX < hRect.right && e.clientY > hRect.top && e.clientY < hRect.bottom) {
        returnToHand(currentDragEl);
    } else {
        const elementsUnder = document.elementsFromPoint(e.clientX, e.clientY);
        const target = elementsUnder.find(el => el.classList.contains('card') && el !== currentDragEl);
        let moveData = { id: currentDragEl.id, ...currentDragEl.cardData, zIndex: currentDragEl.style.zIndex };
        
        if (target && target.parentElement === field) {
            // 重なり判定
            const isE = ['tool', 'mascot', 'fan'].includes((currentDragEl.cardData.category || '').toLowerCase());
            if ((currentDragEl.cardData.type === 'ayle' || isE) && (target.cardData.type === 'holomen' || target.cardData.type === 'oshi')) {
                currentDragEl.style.left = target.style.left; currentDragEl.style.top = target.style.top;
                currentDragEl.style.zIndex = parseInt(target.style.zIndex) - 1; currentDragEl.dataset.zoneId = target.dataset.zoneId || ""; moveData.zIndex = currentDragEl.style.zIndex; moveData.zoneId = currentDragEl.dataset.zoneId;
            } else if (canBloom(currentDragEl.cardData, target.cardData)) {
                currentDragEl.style.left = target.style.left; currentDragEl.style.top = target.style.top;
                currentDragEl.dataset.zoneId = target.dataset.zoneId || ""; moveData.zoneId = currentDragEl.dataset.zoneId;
            } else normalSnap(e, moveData);
        } else normalSnap(e, moveData);
        socket.emit('moveCard', moveData); repositionCards();
    }
    isDragging = false; currentDragEl = null;
};

function normalSnap(e, moveData) {
    const zones = document.querySelectorAll('.zone'); let closest = null, minDist = 40;
    const cr = currentDragEl.getBoundingClientRect(), cc = { x: cr.left + cr.width/2, y: cr.top + cr.height/2 };
    zones.forEach(z => {
        const zr = z.getBoundingClientRect(), zc = { x: zr.left + zr.width/2, y: zr.top + zr.height/2 };
        const d = Math.hypot(cc.x - zc.x, cc.y - zc.y);
        if (d < minDist) { minDist = d; closest = z; }
    });

    if (closest) { 
        // --- 修正: ステージ制限 ---
        if (STAGE_ZONES.includes(closest.id)) {
            const cardsInZone = Array.from(document.querySelectorAll('.card')).filter(c => c.dataset.zoneId === closest.id && c !== currentDragEl);
            // 空の枠に置く場合、Debutのみ許可
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

function returnToHand(card) {
    card.style.position = 'relative'; card.style.left = ''; card.style.top = ''; 
    card.classList.remove('rotated', 'face-down'); card.classList.add('face-up');
    delete card.dataset.zoneId; delete card.dataset.percentX; handDiv.appendChild(card);
    socket.emit('flipCard', { id: card.id, isFaceUp: true }); 
    socket.emit('moveCard', { id: card.id, isRotated: false, isFaceUp: true }); 
    socket.emit('returnToHand', { id: card.id });
}

// --- 初期化 ---
async function loadCardData() {
    try {
        const [h, s, a, o] = await Promise.all([
            fetch('/data/holomen.json').then(r => r.json()),
            fetch('/data/support.json').then(r => r.json()),
            fetch('/data/ayle.json').then(r => r.json()),
            fetch('/data/oshi_holomen.json').then(r => r.json())
        ]);
        MASTER_CARDS = [...h, ...s, ...a]; AYLE_MASTER = a; OSHI_LIST = o;
        updateLibrary(); renderDecks();
    } catch (e) { console.error("Load Error:", e); }
}

function updateLibrary(f = "") {
    const list = document.getElementById('libraryList'); if(!list) return;
    list.innerHTML = "";
    const search = f.toLowerCase();
    const all = [...OSHI_LIST, ...MASTER_CARDS.filter(c => c.type !== 'ayle')];
    all.filter(c => c.name.toLowerCase().includes(search)).forEach(card => {
        const div = document.createElement('div'); div.className = "library-item";
        div.innerHTML = `<span>${card.name} [${card.bloom || 'S'}]</span>`;
        const btn = document.createElement('button'); btn.className = "btn-add"; btn.innerText = card.type === 'oshi' ? '設定' : '追加';
        btn.onclick = () => addToDeck(card); div.appendChild(btn); list.appendChild(div);
    });
}
function addToDeck(card) {
    if (card.type === 'oshi') selectedOshi = { ...card };
    else if (card.type === 'ayle') { if (cheerDeckList.length < 20) cheerDeckList.push({ ...card }); }
    else mainDeckList.push({ ...card });
    renderDecks();
}
function renderDecks() {
    const oSum = document.getElementById('oshiSummary'), mSum = document.getElementById('mainDeckSummary'), cSum = document.getElementById('cheerDeckSummary');
    if (!oSum) return;
    oSum.innerHTML = selectedOshi ? `<div class="deck-item"><span>${selectedOshi.name}</span><button onclick="selectedOshi=null;renderDecks()" class="btn-remove">X</button></div>` : "";
    const gMain = mainDeckList.reduce((acc, c) => { const key = `${c.name}_${c.bloom||""}`; acc[key] = (acc[key] || { d: c, n: 0 }); acc[key].n++; return acc; }, {});
    mSum.innerHTML = Object.keys(gMain).map(k => `<div class="deck-item"><span>${gMain[k].d.name} x${gMain[k].n}</span><button onclick="removeFromDeck('${k}')" class="btn-minus">-</button></div>`).join('');
    cSum.innerHTML = AYLE_MASTER.map(c => { const n = cheerDeckList.filter(x => x.name === c.name).length; return `<div class="deck-item"><span>${c.name.charAt(0)}:${n}</span><button onclick="removeAyle('${c.name}')" class="btn-minus">-</button><button onclick='addToDeck(${JSON.stringify(c)})' class="btn-plus">+</button></div>`; }).join('');
    document.getElementById('mainBuildCount').innerText = mainDeckList.length;
    document.getElementById('cheerBuildCount').innerText = cheerDeckList.length;
    document.getElementById('startGameBtn').disabled = (!selectedOshi || mainDeckList.length === 0 || cheerDeckList.length !== 20);
}
window.removeFromDeck = (key) => { const idx = mainDeckList.findIndex(c => `${c.name}_${c.bloom||""}` === key); if(idx!==-1) mainDeckList.splice(idx,1); renderDecks(); };
window.removeAyle = (name) => { const idx = cheerDeckList.findIndex(c => c.name === name); if(idx!==-1) cheerDeckList.splice(idx,1); renderDecks(); };

// --- 参加処理の安定化 ---
async function joinRoom(role) {
    const rid = document.getElementById('roomIdInput').value;
    if (!rid) return alert("ルームIDを入力してください");
    myRole = role; socket.emit('joinRoom', { roomId: rid, role });
    
    // 全ページ隠してから遷移
    showPage(''); 
    document.getElementById('status').innerText = `Room: ${rid}${role==='spectator'?' (観戦)':''}`;
    
    if (role === 'player') {
        showPage('setup-modal'); // 正確に構築画面へ
    } else {
        document.body.classList.add('spectator-mode');
    }
}
document.getElementById('joinPlayerBtn').onclick = () => joinRoom('player');
document.getElementById('joinSpectatorBtn').onclick = () => joinRoom('spectator');
document.getElementById('startGameBtn').onclick = () => { socket.emit('setGame', { main: mainDeckList, cheer: cheerDeckList, oshi: selectedOshi }); showPage(''); };

// --- その他同期処理 ---
socket.on('gameStarted', (d) => { field.querySelectorAll('.card').forEach(c => c.remove()); handDiv.innerHTML = ""; for (const id in d.fieldState) restoreCard(id, d.fieldState[id]); repositionCards(); });
socket.on('init', (d) => { field.querySelectorAll('.card').forEach(c => c.remove()); for (const id in d.fieldState) restoreCard(id, d.fieldState[id]); repositionCards(); });
socket.on('receiveCard', (d) => { const el = createCardElement({...d, isFaceUp:true}); el.style.position='relative'; handDiv.appendChild(el); });
socket.on('cardMoved', (d) => { 
    let el = document.getElementById(d.id); if (!el) return restoreCard(d.id, d);
    el.dataset.zoneId = d.zoneId || ""; el.style.zIndex = d.zIndex; if (el.parentElement !== field) field.appendChild(el);
    el.classList.toggle('rotated', !!d.isRotated); repositionCards();
});
function restoreCard(id, info) { const el = createCardElement({ id, ...info }); el.dataset.zoneId = info.zoneId || ""; el.style.zIndex = info.zIndex; field.appendChild(el); repositionCards(); }
function canBloom(s, t) { if (s.type !== 'holomen' || t.type !== 'holomen' || s.name !== t.name) return false; return (t.bloom === 'Debut' && s.bloom === '1st') || (t.bloom === '1st' && (s.bloom === '2nd' || s.bloom === '1st')); }
function openZoom(cardData, cardElement = null) { /* 以前のズームロジック維持... */ }
