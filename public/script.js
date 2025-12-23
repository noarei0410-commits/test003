const socket = io();

let MASTER_CARDS = [], OSHI_LIST = [], AYLE_MASTER = [];
let mainDeckList = [], cheerDeckList = [], selectedOshi = null;
let myRole = 'spectator', currentDragEl = null, isDragging = false;
let startX = 0, startY = 0, offsetX = 0, offsetY = 0, maxZIndex = 1000;

const field = document.getElementById('field');
const handDiv = document.getElementById('hand');
const zoomModal = document.getElementById('zoom-modal');

const STAGE_ZONES = ['collab', 'center', 'back1', 'back2', 'back3', 'back4', 'back5'];

// --- 画面遷移管理 (各モーダルを確実に制御) ---
function showPage(pageId) {
    document.querySelectorAll('.full-page').forEach(p => { p.style.display = 'none'; });
    const target = document.getElementById(pageId);
    if (target) {
        target.style.display = 'flex';
        if (pageId === 'card-list-page') filterLibrary('all');
        if (pageId === 'setup-modal') {
            updateLibrary(""); // 入室時にリストを初期化
            renderDecks();
        }
    }
}
window.onload = loadCardData;

// --- ルーム参加 (不具合修正: 確実に構築画面へ) ---
async function joinRoom(role) {
    const rid = document.getElementById('roomIdInput').value;
    if (!rid) return alert("ルームIDを入力してください");
    
    myRole = role; 
    socket.emit('joinRoom', { roomId: rid, role });
    
    document.getElementById('status').innerText = `Room: ${rid}${role==='spectator'?' (観戦)':''}`;
    
    if (role === 'player') {
        showPage('setup-modal'); // 確実に構築画面（Setup Modal）を表示
    } else {
        showPage(''); // 観戦者はフィールドへ
        document.body.classList.add('spectator-mode');
    }
}
document.getElementById('joinPlayerBtn').onclick = () => joinRoom('player');
document.getElementById('joinSpectatorBtn').onclick = () => joinRoom('spectator');

// --- デッキ構築ロジック (維持) ---
function addToDeck(card) {
    if (card.type === 'oshi') {
        selectedOshi = { ...card };
    } else if (card.type === 'ayle') {
        if (cheerDeckList.length < 20) cheerDeckList.push({ ...card });
    } else {
        mainDeckList.push({ ...card });
    }
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
        const typeInfo = card.bloom || (card.type === 'oshi' ? "OSHI" : "S");
        div.innerHTML = `<span>${card.name} <span class="type-tag">${typeInfo}</span></span>`;
        const btn = document.createElement('button');
        btn.className = "btn-add"; btn.innerText = card.type === 'oshi' ? '設定' : '追加';
        btn.onclick = () => addToDeck(card);
        div.appendChild(btn); list.appendChild(div);
    });
}

function renderDecks() {
    const oSum = document.getElementById('oshiSummary'), mSum = document.getElementById('mainDeckSummary'), cSum = document.getElementById('cheerDeckSummary');
    if (!oSum) return;

    oSum.innerHTML = selectedOshi ? `<div class="deck-item"><span>${selectedOshi.name}</span><button onclick="selectedOshi=null;renderDecks()" class="btn-remove">削除</button></div>` : "<p style='font-size:10px;color:#666'>未設定</p>";
    
    mSum.innerHTML = "";
    const grouped = mainDeckList.reduce((acc, c) => {
        const key = `${c.name}_${c.bloom || ""}`;
        acc[key] = (acc[key] || { d: c, n: 0 }); acc[key].n++; return acc;
    }, {});
    Object.keys(grouped).forEach(k => {
        const item = grouped[k];
        const div = document.createElement('div'); div.className = "deck-item";
        div.innerHTML = `<span>${item.d.name} x${item.n}</span><button class="btn-minus">-</button>`;
        div.querySelector('button').onclick = () => {
            const idx = mainDeckList.findIndex(c => `${c.name}_${c.bloom || ""}` === k);
            if (idx !== -1) mainDeckList.splice(idx, 1); renderDecks();
        };
        mSum.appendChild(div);
    });

    cSum.innerHTML = "";
    const cheerTypes = AYLE_MASTER.length ? AYLE_MASTER : [{name: "白エール"}, {name: "緑エール"}, {name: "赤エール"}, {name: "青エール"}, {name: "黄エール"}, {name: "紫エール"}];
    cheerTypes.forEach(c => {
        const count = cheerDeckList.filter(x => x.name === c.name).length;
        const div = document.createElement('div'); div.className = "deck-item";
        div.innerHTML = `<span>${c.name} : ${count}</span><div><button class="btn-minus">-</button><button class="btn-plus">+</button></div>`;
        div.querySelectorAll('button')[0].onclick = () => { const idx = cheerDeckList.findIndex(x => x.name === c.name); if(idx!==-1) cheerDeckList.splice(idx,1); renderDecks(); };
        div.querySelectorAll('button')[1].onclick = () => addToDeck(c);
        cSum.appendChild(div);
    });

    document.getElementById('mainBuildCount').innerText = mainDeckList.length;
    document.getElementById('cheerBuildCount').innerText = cheerDeckList.length;
    document.getElementById('startGameBtn').disabled = (!selectedOshi || mainDeckList.length === 0 || cheerDeckList.length !== 20);
}

// --- 検索イベント ---
const searchInput = document.getElementById('searchInput');
if(searchInput) searchInput.oninput = (e) => updateLibrary(e.target.value);

// --- ゲーム開始 ---
document.getElementById('startGameBtn').onclick = () => {
    socket.emit('setGame', { main: mainDeckList, cheer: cheerDeckList, oshi: selectedOshi });
    showPage(''); 
};

// --- 他の基本ロジック (既存維持) ---
async function loadCardData() {
    try {
        const res = await Promise.all([
            fetch('/data/holomen.json').then(r => r.json()),
            fetch('/data/support.json').then(r => r.json()),
            fetch('/data/ayle.json').then(r => r.json()),
            fetch('/data/oshi_holomen.json').then(r => r.json())
        ]);
        MASTER_CARDS = [...res[0], ...res[1], ...res[2]]; AYLE_MASTER = res[2]; OSHI_LIST = res[3];
        updateLibrary(); renderDecks();
    } catch (e) { console.error("Data load failed", e); }
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

function setupCardEvents(el) {
    el.onpointerdown = (e) => {
        startX = e.clientX; startY = e.clientY; potentialZoomTarget = el;
        if (myRole === 'spectator') return;
        isDragging = true; currentDragEl = el; el.setPointerCapture(e.pointerId);
        const rect = el.getBoundingClientRect(), fRect = field.getBoundingClientRect();
        offsetX = e.clientX - rect.left; offsetY = e.clientY - rect.top;
        maxZIndex++; el.style.zIndex = maxZIndex;
        if (el.parentElement !== field) { 
            el.style.position = 'absolute'; el.style.left = (rect.left - fRect.left) + 'px'; el.style.top = (rect.top - fRect.top) + 'px'; field.appendChild(el); 
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

function returnToHand(card) {
    card.style.position = 'relative'; card.style.left = ''; card.style.top = ''; 
    card.classList.remove('rotated', 'face-down'); card.classList.add('face-up');
    delete card.dataset.zoneId; delete card.dataset.percentX; handDiv.appendChild(card);
    socket.emit('flipCard', { id: card.id, isFaceUp: true }); socket.emit('moveCard', { id: card.id, isRotated: false, isFaceUp: true }); socket.emit('returnToHand', { id: card.id });
}

function canBloom(s, t) { if (s.type !== 'holomen' || t.type !== 'holomen' || s.name !== t.name) return false; return (t.bloom === 'Debut' && s.bloom === '1st') || (t.bloom === '1st' && (s.bloom === '2nd' || s.bloom === '1st')); }
function openZoom(cardData, cardElement = null) { /* 以前の詳細ロジック一式を維持... */ }
// --- Socket受信イベント等はそのまま統合 ---
socket.on('gameStarted', (d) => { field.querySelectorAll('.card').forEach(c => c.remove()); handDiv.innerHTML = ""; for (const id in d.fieldState) restoreCard(id, d.fieldState[id]); repositionCards(); });
socket.on('init', (d) => { field.querySelectorAll('.card').forEach(c => c.remove()); for (const id in d.fieldState) restoreCard(id, d.fieldState[id]); repositionCards(); });
socket.on('deckCount', (c) => { 
    const m = document.getElementById('mainCount'), ch = document.getElementById('cheerCount');
    if(m) m.innerText = c.main; if(ch) ch.innerText = c.cheer;
});
socket.on('receiveCard', (d) => { const el = createCardElement({...d, isFaceUp:true}); el.style.position='relative'; handDiv.appendChild(el); });
socket.on('cardMoved', (d) => { 
    let el = document.getElementById(d.id); if (!el) return restoreCard(d.id, d);
    el.dataset.zoneId = d.zoneId || ""; el.style.zIndex = d.zIndex; if (el.parentElement !== field) field.appendChild(el);
    el.classList.toggle('rotated', !!d.isRotated); repositionCards();
});
function restoreCard(id, info) { const el = createCardElement({ id, ...info }); el.dataset.zoneId = info.zoneId || ""; el.style.zIndex = info.zIndex; field.appendChild(el); repositionCards(); }
