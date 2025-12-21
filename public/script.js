const socket = io();

let MASTER_CARDS = [], OSHI_LIST = [], AYLE_MASTER = [];
let mainDeckList = [], cheerDeckList = [], selectedOshi = null;
let myRole = 'spectator';
let currentCard = null, isDragging = false;
let startX = 0, startY = 0, offsetX = 0, offsetY = 0, maxZIndex = 1000;
let originalNextSibling = null;

// --- 画面遷移管理 ---
function showPage(pageId) {
    // すべてのフルページ要素を隠す
    document.querySelectorAll('.full-page').forEach(page => page.style.display = 'none');
    // 指定されたページを表示
    const target = document.getElementById(pageId);
    if (target) target.style.display = 'flex';
    
    // カードリストを開いた場合はデータを再描画
    if (pageId === 'card-list-page') renderGlobalCardList();
}

// 起動時にマスターデータをロード
window.onload = loadCardData;

// --- ログイン処理 ---
document.getElementById('loginBtn').onclick = () => {
    const playerId = document.getElementById('playerIdInput').value;
    const password = document.getElementById('passwordInput').value;
    if (!playerId || !password) return alert("入力してください");
    socket.emit('login', { playerId, password });
};

socket.on('loginResponse', (data) => {
    if (data.success) {
        showPage('room-modal');
        document.getElementById('status').innerText = `Logged: ${data.playerId}`;
    } else {
        alert(data.message);
    }
});

// --- カードリスト描画 ---
function renderGlobalCardList() {
    const grid = document.getElementById('global-card-grid');
    grid.innerHTML = "";
    // 全マスターカードを表示
    MASTER_CARDS.forEach(card => {
        const el = document.createElement('div');
        el.className = 'card face-up';
        // タイプ別クラス
        if (card.type === 'ayle') {
            const colors = { '白': 'white', '緑': 'green', '赤': 'red', '青': 'blue', '黄': 'yellow', '紫': 'purple' };
            for (let k in colors) if (card.name.includes(k)) el.classList.add(`ayle-${colors[k]}`);
        } else {
            el.classList.add(`type-${card.type}`);
        }
        el.innerText = card.name;
        el.onclick = () => openZoom(card.name, el.className);
        grid.appendChild(el);
    });
}

// --- ズーム機能 ---
const zoomModal = document.getElementById('zoom-modal');
const zoomDisplay = document.getElementById('zoom-card-display');
function openZoom(name, classList) {
    zoomDisplay.innerText = name;
    zoomDisplay.className = classList; 
    zoomDisplay.classList.remove('face-down'); 
    zoomModal.style.display = 'flex';
}
zoomModal.onclick = () => zoomModal.style.display = 'none';

// --- 再配置・同期ロジック ---
function repositionCards() {
    const fRect = field.getBoundingClientRect();
    const cardW = 55, cardH = 77;
    document.querySelectorAll('.card').forEach(card => {
        if (card.parentElement !== field || card === currentCard) return; 
        if (card.dataset.zoneId) {
            const zone = document.getElementById(card.dataset.zoneId);
            if (zone) {
                const zr = zone.getBoundingClientRect();
                card.style.left = (zr.left - fRect.left) + (zr.width - cardW) / 2 + 'px';
                card.style.top = (zr.top - fRect.top) + (zr.height - cardH) / 2 + 'px';
                return;
            }
        }
        if (card.dataset.percentX) {
            card.style.left = (card.dataset.percentX / 100) * fRect.width + 'px';
            card.style.top = (card.dataset.percentY / 100) * fRect.height + 'px';
        }
    });
}
window.addEventListener('resize', repositionCards);

async function loadCardData() {
    try {
        const [h, s, a, o] = await Promise.all([
            fetch('/data/holomen.json'), fetch('/data/support.json'),
            fetch('/data/ayle.json'), fetch('/data/oshi_holomen.json')
        ]);
        MASTER_CARDS = [...await h.json(), ...await s.json(), ...await a.json()];
        OSHI_LIST = await o.json();
        MASTER_CARDS = [...MASTER_CARDS, ...OSHI_LIST];
        updateLibrary(); renderDecks();
    } catch (e) { console.error(e); }
}

async function joinRoom(role) {
    const rid = document.getElementById('roomIdInput').value;
    if (!rid) return alert("ルームIDを入力してください");
    myRole = role;
    socket.emit('joinRoom', { roomId: rid, role });
    showPage(''); // 全モーダルを閉じる
    document.getElementById('status').innerText = `Room: ${rid}${role==='spectator'?' (観戦)':''}`;
    if (role === 'player') {
        setupModal.style.display = 'flex';
        document.querySelectorAll('.section-header').forEach(h => h.onclick = () => h.parentElement.classList.toggle('collapsed'));
    } else {
        document.body.classList.add('spectator-mode');
    }
}
document.getElementById('joinPlayerBtn').onclick = () => joinRoom('player');
document.getElementById('joinSpectatorBtn').onclick = () => joinRoom('spectator');

// デッキ構築UI
function updateLibrary(f = "") {
    const list = document.getElementById('libraryList'); list.innerHTML = "";
    MASTER_CARDS.filter(c => c.name.includes(f) && c.type !== 'ayle').forEach(card => {
        const div = document.createElement('div'); div.className = "library-item";
        div.innerHTML = `<span>${card.name}</span><button class="btn-add">追加</button>`;
        div.querySelector('button').onclick = () => addToDeck(card);
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
    oSum.innerHTML = selectedOshi ? `<div class="deck-item"><span>${selectedOshi.name}</span><button class="btn-remove">X</button></div>` : "";
    if (selectedOshi) oSum.querySelector('button').onclick = () => { selectedOshi = null; renderDecks(); };
    mSum.innerHTML = "";
    const gMain = mainDeckList.reduce((acc, c) => { acc[c.name] = (acc[c.name] || { d: c, n: 0 }); acc[c.name].n++; return acc; }, {});
    Object.keys(gMain).forEach(n => {
        const item = gMain[n], div = document.createElement('div');
        div.innerHTML = `<span>${n} x${item.n}</span><button class="btn-minus">-</button>`;
        div.querySelector('button').onclick = () => removeFromDeck(n, 'main');
        mSum.appendChild(div);
    });
    cSum.innerHTML = "";
    AYLE_MASTER.forEach(card => {
        const count = cheerDeckList.filter(c => c.name === card.name).length;
        const div = document.createElement('div');
        div.innerHTML = `<span>${card.name}: ${count}</span><button class="btn-plus">+</button><button class="btn-minus">-</button>`;
        div.querySelector('.btn-plus').onclick = () => addToDeck(card);
        div.querySelector('.btn-minus').onclick = () => removeFromDeck(card.name, 'ayle');
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

// 同期・ドラッグ&ドロップ処理 (中略なし)
const field = document.getElementById('field');
const handDiv = document.getElementById('hand');
const setupModal = document.getElementById('setup-modal');

socket.on('gameStarted', (data) => {
    field.querySelectorAll('.card').forEach(c => c.remove()); handDiv.innerHTML = "";
    for (const id in data.fieldState) restoreCard(id, data.fieldState[id]);
    repositionCards();
});
socket.on('init', (d) => {
    field.querySelectorAll('.card').forEach(c => c.remove());
    for (const id in d.fieldState) restoreCard(id, d.fieldState[id]);
    repositionCards();
});
socket.on('deckCount', (c) => { document.getElementById('mainCount').innerText = c.main; document.getElementById('cheerCount').innerText = c.cheer; });
socket.on('receiveCard', (d) => handDiv.appendChild(createCardElement(d)));
socket.on('cardMoved', (d) => {
    let el = document.getElementById(d.id); if (!el) return restoreCard(d.id, d);
    el.dataset.zoneId = d.zoneId || ""; el.dataset.percentX = d.percentX || ""; el.dataset.percentY = d.percentY || "";
    el.style.zIndex = d.zIndex; if (el.parentElement !== field) field.appendChild(el);
    repositionCards();
});
socket.on('cardRemoved', (d) => { const el = document.getElementById(d.id); if (el) el.remove(); });
socket.on('cardFlipped', (d) => { const el = document.getElementById(d.id); if (el) { el.classList.toggle('face-up', d.isFaceUp); el.classList.toggle('face-down', !d.isFaceUp); } });

document.getElementById('main-deck-zone').onpointerdown = () => { if(myRole==='player') socket.emit('drawMainCard'); };
document.getElementById('cheer-deck-zone').onpointerdown = () => { if(myRole==='player') socket.emit('drawCheerCard'); };

function createCardElement(data) {
    const el = document.createElement('div'); el.id = data.id; el.innerText = data.name; el.classList.add('card', 'face-up');
    if (data.type === 'ayle') {
        const colors = { '白': 'white', '緑': 'green', '赤': 'red', '青': 'blue', '黄': 'yellow', '紫': 'purple' };
        for (let k in colors) if (data.name.includes(k)) { el.classList.add(`ayle-${colors[k]}`); break; }
    } else el.classList.add(`type-${data.type}`);
    setupCardEvents(el); return el;
}
function restoreCard(id, info) {
    const el = createCardElement({ id, name: info.name, type: info.type });
    el.dataset.zoneId = info.zoneId || ""; el.dataset.percentX = info.percentX || ""; el.dataset.percentY = info.percentY || "";
    el.style.position = 'absolute'; el.style.zIndex = info.zIndex;
    el.classList.toggle('face-up', info.isFaceUp !== false); el.classList.toggle('face-down', info.isFaceUp === false);
    field.appendChild(el);
}

function setupCardEvents(el) {
    el.addEventListener('dblclick', () => {
        if (myRole === 'spectator' || el.parentElement === handDiv) return;
        const noFlip = ['back1','back2','back3','back4','back5','center','collab'];
        if (el.dataset.zoneId && noFlip.includes(el.dataset.zoneId)) return;
        socket.emit('flipCard', { id: el.id, isFaceUp: !el.classList.contains('face-up') });
    });
    el.onpointerdown = (e) => {
        startX = e.clientX; startY = e.clientY; potentialZoomTarget = el;
        if (el.parentElement === handDiv) originalNextSibling = el.nextElementSibling;
        if (myRole === 'spectator') return;
        isDragging = true; currentCard = el; el.setPointerCapture(e.pointerId);
        const rect = el.getBoundingClientRect(), fRect = field.getBoundingClientRect();
        offsetX = e.clientX - rect.left; offsetY = e.clientY - rect.top;
        maxZIndex++; el.style.zIndex = maxZIndex;
        if (el.parentElement !== field) {
            el.style.position = 'absolute'; el.style.left = (rect.left - fRect.left) + 'px'; el.style.top = (rect.top - fRect.top) + 'px';
            field.appendChild(el);
        }
        e.stopPropagation();
    };
}

document.onpointermove = (e) => {
    if (!isDragging || !currentCard) return;
    const fRect = field.getBoundingClientRect();
    currentCard.style.left = (e.clientX - fRect.left - offsetX) + 'px';
    currentCard.style.top = (e.clientY - fRect.top - offsetY) + 'px';
};

document.onpointerup = (e) => {
    const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
    if (potentialZoomTarget && dist < 15) {
        if (!potentialZoomTarget.classList.contains('face-down')) openZoom(potentialZoomTarget.innerText, potentialZoomTarget.className);
    }
    if (myRole === 'spectator' || !isDragging || !currentCard) {
        if (!isDragging && potentialZoomTarget && potentialZoomTarget.parentElement === field && !potentialZoomTarget.dataset.zoneId && !potentialZoomTarget.dataset.percentX) {
            returnToHand(potentialZoomTarget);
        }
        isDragging = false; currentCard = null; return;
    }
    const hRect = handDiv.getBoundingClientRect();
    if (e.clientX > hRect.left && e.clientX < hRect.right && e.clientY > hRect.top && e.clientY < hRect.bottom) {
        returnToHand(currentCard);
    } else {
        const zones = document.querySelectorAll('.zone'); let closest = null, minDist = 40;
        const cr = currentCard.getBoundingClientRect(), cc = { x: cr.left + cr.width/2, y: cr.top + cr.height/2 };
        zones.forEach(z => {
            const zr = z.getBoundingClientRect(), zc = { x: zr.left + zr.width/2, y: zr.top + zr.height/2 };
            const d = Math.hypot(cc.x - zc.x, cc.y - zc.y);
            if (d < minDist) { minDist = d; closest = z; }
        });
        const fRect = field.getBoundingClientRect();
        let type = currentCard.classList.contains('type-holomen')?'holomen':'support';
        let moveData = { id: currentCard.id, name: currentCard.innerText, zIndex: currentCard.style.zIndex, type: type };
        if (closest) {
            currentCard.dataset.zoneId = closest.id; delete currentCard.dataset.percentX;
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
};

function returnToHand(card) {
    card.style.position = 'relative'; card.style.left = ''; card.style.top = ''; card.style.zIndex = '';
    delete card.dataset.zoneId; delete card.dataset.percentX;
    if (originalNextSibling && originalNextSibling.parentElement === handDiv) handDiv.insertBefore(card, originalNextSibling);
    else handDiv.appendChild(card);
    socket.emit('returnToHand', { id: card.id });
}
