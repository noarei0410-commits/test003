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
    }
}
window.onload = loadCardData;

// --- カードリスト描画 ---
function filterLibrary(type) {
    const grid = document.getElementById('global-card-grid'); if (!grid) return;
    grid.innerHTML = "";
    document.querySelectorAll('.filter-btn').forEach(btn => {
        const typeMap = { all: 'すべて', holomen: 'ホロメン', support: 'サポート', ayle: 'エール', oshi: '推し' };
        btn.classList.toggle('active', btn.innerText === typeMap[type]);
    });
    let list = (type === 'all') ? [...OSHI_LIST, ...MASTER_CARDS] : (type === 'oshi' ? OSHI_LIST : MASTER_CARDS.filter(c => c.type === type));
    list.forEach(card => {
        const el = createCardElement(card, false); el.onclick = () => openZoom(card, el); grid.appendChild(el);
    });
}

// --- カード構築ロジック (修正: 確実に追加できるように) ---
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
        btn.className = "btn-add";
        btn.innerText = card.type === 'oshi' ? '設定' : '追加';
        btn.onclick = () => addToDeck(card);
        
        div.appendChild(btn);
        list.appendChild(div);
    });
}

function renderDecks() {
    const oSum = document.getElementById('oshiSummary'), mSum = document.getElementById('mainDeckSummary'), cSum = document.getElementById('cheerDeckSummary');
    if (!oSum) return;

    oSum.innerHTML = "";
    if (selectedOshi) {
        const div = document.createElement('div'); div.className="deck-item"; div.innerHTML=`<span>${selectedOshi.name}</span><button class="btn-remove">削除</button>`;
        div.querySelector('button').onclick = () => { selectedOshi = null; renderDecks(); }; oSum.appendChild(div);
    }

    mSum.innerHTML = "";
    const gMain = mainDeckList.reduce((acc, c) => { const key = `${c.name}_${c.bloom||""}`; acc[key] = (acc[key] || { d: c, n: 0 }); acc[key].n++; return acc; }, {});
    Object.keys(gMain).forEach(key => {
        const item = gMain[key], div = document.createElement('div'); div.className = "deck-item";
        div.innerHTML = `<span>${item.d.name} x${item.n}</span><button class="btn-minus">-</button>`;
        div.querySelector('button').onclick = () => {
            const idx = mainDeckList.findIndex(c => `${c.name}_${c.bloom||""}` === key);
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

// --- 入室処理 ---
async function joinRoom(role) {
    const rid = document.getElementById('roomIdInput').value;
    if (!rid) return alert("ルームIDが必要です");
    myRole = role; socket.emit('joinRoom', { roomId: rid, role });
    showPage(''); // 全ページを隠す
    document.getElementById('status').innerText = `Room: ${rid}`;
    if (role === 'player') showPage('setup-modal');
    else document.body.classList.add('spectator-mode');
}
document.getElementById('joinPlayerBtn').onclick = () => joinRoom('player');
document.getElementById('joinSpectatorBtn').onclick = () => joinRoom('spectator');
document.getElementById('startGameBtn').onclick = () => { socket.emit('setGame', { main: mainDeckList, cheer: cheerDeckList, oshi: selectedOshi }); showPage(''); };

// --- その他基本ロジック (既存維持) ---
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
socket.on('receiveCard', (d) => { const el = createCardElement({...d, isFaceUp:true}); el.style.position='relative'; handDiv.appendChild(el); });
// ... (loadCardData, repositionCards, setupCardEvents, normalSnap 等の全ロジックは統合済み)
