const socket = io();

let MASTER_CARDS = [], OSHI_LIST = [], AYLE_MASTER = [];
let mainDeckList = [], cheerDeckList = [], selectedOshi = null;
let myRole = 'spectator', currentDragEl = null, isDragging = false;
let startX = 0, startY = 0, offsetX = 0, offsetY = 0, maxZIndex = 1000;
let currentFilter = 'all';

const field = document.getElementById('field');
const handDiv = document.getElementById('hand');
const zoomModal = document.getElementById('zoom-modal');

// --- 画面遷移 ---
function showPage(pageId) {
    document.querySelectorAll('.full-page').forEach(p => p.style.display = 'none');
    const target = document.getElementById(pageId);
    if (target) {
        target.style.display = 'flex';
        if (pageId === 'card-list-page') filterLibrary('all');
        if (pageId === 'setup-modal') updateLibrary("");
    }
}
window.onload = loadCardData;

// --- データ読み込み ---
async function loadCardData() {
    try {
        const res = await Promise.all([
            fetch('/data/holomen.json').then(r => r.json()),
            fetch('/data/support.json').then(r => r.json()),
            fetch('/data/ayle.json').then(r => r.json()),
            fetch('/data/oshi_holomen.json').then(r => r.json())
        ]);
        MASTER_CARDS = [...res[0], ...res[1], ...res[2]];
        AYLE_MASTER = res[2];
        OSHI_LIST = res[3];
        updateLibrary();
        renderDecks();
    } catch (e) { console.error("Data load failed", e); }
}

// --- 構築ライブラリ描画 (修正) ---
function updateLibrary(f = "") {
    const list = document.getElementById('libraryList');
    if (!list) return;
    list.innerHTML = "";
    const search = f.toLowerCase();
    
    // 全カードを統合（推し + メイン + サポート）
    const all = [...OSHI_LIST, ...MASTER_CARDS.filter(c => c.type !== 'ayle')];
    
    all.filter(c => c.name.toLowerCase().includes(search)).forEach(card => {
        const div = document.createElement('div');
        div.className = "library-item";
        
        const info = card.bloom ? card.bloom : (card.type === 'oshi' ? 'OSHI' : 'Support');
        div.innerHTML = `<span>${card.name}<span class="type-tag">${info}</span></span>`;
        
        const btn = document.createElement('button');
        btn.className = "btn-add";
        btn.innerText = card.type === 'oshi' ? '設定' : '追加';
        btn.onclick = () => addToDeck(card);
        
        div.appendChild(btn);
        list.appendChild(div);
    });
}

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

function renderDecks() {
    const oSum = document.getElementById('oshiSummary'), mSum = document.getElementById('mainDeckSummary'), cSum = document.getElementById('cheerDeckSummary');
    if (!oSum) return;

    // 推し
    oSum.innerHTML = selectedOshi ? `<div class="deck-item"><span>${selectedOshi.name}</span><button onclick="selectedOshi=null;renderDecks()" class="btn-remove">削除</button></div>` : "<p style='font-size:10px;color:#666'>未設定</p>";
    
    // メイン
    mSum.innerHTML = "";
    const grouped = mainDeckList.reduce((acc, c) => {
        const key = `${c.name}_${c.bloom || ""}`;
        acc[key] = (acc[key] || { d: c, n: 0 }); acc[key].n++;
        return acc;
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

    // エール
    cSum.innerHTML = "";
    AYLE_MASTER.forEach(c => {
        const n = cheerDeckList.filter(x => x.name === c.name).length;
        const div = document.createElement('div'); div.className = "deck-item";
        div.innerHTML = `<span>${c.name} : ${n}</span><div><button class="btn-minus">-</button><button class="btn-plus">+</button></div>`;
        div.querySelectorAll('button')[0].onclick = () => {
            const idx = cheerDeckList.findIndex(x => x.name === c.name);
            if (idx !== -1) cheerDeckList.splice(idx, 1); renderDecks();
        };
        div.querySelectorAll('button')[1].onclick = () => addToDeck(c);
        cSum.appendChild(div);
    });

    document.getElementById('mainBuildCount').innerText = mainDeckList.length;
    document.getElementById('cheerBuildCount').innerText = cheerDeckList.length;
    document.getElementById('startGameBtn').disabled = (!selectedOshi || mainDeckList.length === 0 || cheerDeckList.length !== 20);
}

// --- 検索イベント ---
document.getElementById('searchInput').oninput = (e) => updateLibrary(e.target.value);

// --- ゲーム開始 ---
document.getElementById('startGameBtn').onclick = () => {
    socket.emit('setGame', { main: mainDeckList, cheer: cheerDeckList, oshi: selectedOshi });
    showPage(''); 
};

// --- ルーム参加 ---
async function joinRoom(role) {
    const rid = document.getElementById('roomIdInput').value;
    if (!rid) return alert("Room ID Required");
    myRole = role; socket.emit('joinRoom', { roomId: rid, role });
    showPage('');
    document.getElementById('status').innerText = `Room: ${rid}`;
    if (role === 'player') showPage('setup-modal');
    else document.body.classList.add('spectator-mode');
}
document.getElementById('joinPlayerBtn').onclick = () => joinRoom('player');
document.getElementById('joinSpectatorBtn').onclick = () => joinRoom('spectator');

// --- 他の基本ロジック (既存維持) ---
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
// ... (repositionCards, setupCardEvents, socket.on などの既存ロジックを統合)
