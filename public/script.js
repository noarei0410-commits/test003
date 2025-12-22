const socket = io();

let MASTER_CARDS = [], OSHI_LIST = [], AYLE_MASTER = [];
let mainDeckList = [], cheerDeckList = [], selectedOshi = null;
let myRole = 'spectator', currentCard = null, isDragging = false;
let startX = 0, startY = 0, offsetX = 0, offsetY = 0, maxZIndex = 1000;
let originalNextSibling = null, potentialZoomTarget = null;

const field = document.getElementById('field');
const handDiv = document.getElementById('hand');
const setupModal = document.getElementById('setup-modal');
const zoomModal = document.getElementById('zoom-modal');

// --- 画面遷移 ---
function showPage(pageId) {
    document.querySelectorAll('.full-page').forEach(p => p.style.display = 'none');
    const target = document.getElementById(pageId);
    if (target) target.style.display = 'flex';
    if (pageId === 'card-list-page') renderGlobalCardList();
}
window.onload = loadCardData;

// --- カードリスト描画 ---
function renderGlobalCardList() {
    const grid = document.getElementById('global-card-grid');
    grid.innerHTML = "";
    MASTER_CARDS.forEach(card => {
        const el = createCardElement(card, false);
        el.onclick = () => openZoom(card);
        grid.appendChild(el);
    });
}

// --- ズーム機能 (詳細表示) ---
function openZoom(cardData) {
    const container = document.querySelector('.zoom-container');
    
    // HTMLの中身を動的に生成
    let tagsHtml = (cardData.tags || []).map(t => `<span class="tag-badge">${t}</span>`).join('');
    let batonHtml = Array(cardData.baton || 0).fill('<div class="baton-icon"></div>').join('');
    let artsHtml = (cardData.arts || []).map(a => `
        <div class="art-item">
            <div class="art-name">${a.name}</div>
            <div class="art-text">${a.text}</div>
        </div>
    `).join('');

    // 推しホロメンの場合は一部表示を制限（バトンやHPがないため）
    const isOshi = OSHI_LIST.some(o => o.name === cardData.name);

    container.innerHTML = `
        <div class="zoom-header">
            <div>
                <div class="zoom-bloom">${!isOshi ? (cardData.bloom || 'Debut') : 'OSHI'}</div>
                <div class="zoom-name">${cardData.name}</div>
            </div>
            <div class="zoom-hp">${!isOshi && cardData.hp ? 'HP ' + cardData.hp : ''}</div>
        </div>
        <div class="zoom-tags">${tagsHtml}</div>
        <div class="zoom-arts-list">${artsHtml}</div>
        <div class="zoom-footer">
            <div class="baton-container">
                ${!isOshi ? '<span style="font-size:10px; margin-right:5px;">バトン:</span>' + batonHtml : ''}
            </div>
            <div class="zoom-hint-bottom">タップで閉じる</div>
        </div>
    `;
    
    zoomModal.style.display = 'flex';
}
zoomModal.onclick = () => zoomModal.style.display = 'none';

// --- 再配置ロジック ---
function repositionCards() {
    const fRect = field.getBoundingClientRect();
    const cardW = 52, cardH = 74;
    document.querySelectorAll('.card').forEach(card => {
        if (card.parentElement !== field || card === currentCard) return; 
        if (card.dataset.zoneId) {
            const zone = document.getElementById(card.dataset.zoneId);
            if (zone) {
                const zr = zone.getBoundingClientRect();
                card.style.left = (zr.left - fRect.left) + (zr.width - cardW) / 2 + 'px';
                card.style.top = (zr.top - fRect.top) + (zr.height - cardH) / 2 + 'px';
            }
        } else if (card.dataset.percentX) {
            card.style.left = (card.dataset.percentX / 100) * fRect.width + 'px';
            card.style.top = (card.dataset.percentY / 100) * fRect.height + 'px';
        }
    });
}
window.addEventListener('resize', repositionCards);

// --- データ/入室 ---
async function loadCardData() {
    try {
        const [h, s, a, o] = await Promise.all([
            fetch('/data/holomen.json'), fetch('/data/support.json'),
            fetch('/data/ayle.json'), fetch('/data/oshi_holomen.json')
        ]);
        const hD = await h.json(), sD = await s.json();
        AYLE_MASTER = await a.json(); OSHI_LIST = await o.json();
        MASTER_CARDS = [...hD, ...sD, ...AYLE_MASTER, ...OSHI_LIST];
        updateLibrary(); renderDecks();
    } catch (e) { console.error(e); }
}

async function joinRoom(role) {
    const rid = document.getElementById('roomIdInput').value;
    if (!rid) return alert("Room ID required");
    myRole = role;
    socket.emit('joinRoom', { roomId: rid, role });
    showPage(''); 
    document.getElementById('status').innerText = `Room: ${rid}${role==='spectator'?' (観戦)':''}`;
    if (role === 'player') setupModal.style.display = 'flex';
    else document.body.classList.add('spectator-mode');
}
document.getElementById('joinPlayerBtn').onclick = () => joinRoom('player');
document.getElementById('joinSpectatorBtn').onclick = () => joinRoom('spectator');

// --- デッキ構築 ---
function updateLibrary(f = "") {
    const list = document.getElementById('libraryList'); list.innerHTML = "";
    MASTER_CARDS.filter(c => c.name.includes(f) && c.type !== 'ayle').forEach(card => {
        const div = document.createElement('div'); div.className = "library-item";
        const isOshi = OSHI_LIST.some(o => o.name === card.name);
        div.innerHTML = `<span>${card.name}</span><button class="btn-add">${isOshi?'設定':'追加'}</button>`;
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
        div.className = "deck-item"; div.innerHTML = `<span>${n} x${item.n}</span><button class="btn-minus">-</button>`;
        div.querySelector('button').onclick = () => removeFromDeck(n, 'main');
        mSum.appendChild(div);
    });
    cSum.innerHTML = "";
    AYLE_MASTER.forEach(card => {
        const count = cheerDeckList.filter(c => c.name === card.name).length;
        const div = document.createElement('div'); div.className = "deck-item";
        div.innerHTML = `<span>${card.name.charAt(0)}:${count}</span><div class="deck-item-controls"><button class="btn-plus">+</button><button class="btn-minus">-</button></div>`;
        div.querySelector('.btn-plus').onclick = () => addToDeck(card);
        div.querySelector('.btn-minus').onclick = () => removeFromDeck(card.name, 'ayle');
        cSum.appendChild(div);
    });
    document.getElementById('mainBuildCount').innerText = mainDeckList.length;
    document.getElementById('cheerBuildCount').innerText = cheerDeckList.length;
    document.getElementById('startGameBtn').disabled = (!selectedOshi || mainDeckList.length === 0 || cheerDeckList.length !== 20);
}
document.getElementById('searchInput').oninput = (e) => updateLibrary(e.target.value);
document.getElementById('startGameBtn').onclick = () => {
    socket.emit('setGame', { main: mainDeckList, cheer: cheerDeckList, oshi: { name: selectedOshi.name } });
    setupModal.style.display = "none";
};

// --- 同期/操作 ---
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

function createCardElement(data, withEvents = true) {
    const el = document.createElement('div'); el.id = data.id || ""; el.innerText = data.name; el.classList.add('card', 'face-up');
    
    // ステータス表示 (ホロメンのみ)
    if (data.type === 'holomen' && !OSHI_LIST.some(o => o.name === data.name)) {
        const hp = document.createElement('div'); hp.className = 'card-hp'; hp.innerText = data.hp || '';
        const bloom = document.createElement('div'); bloom.className = 'card-bloom'; bloom.innerText = (data.bloom || 'Debut').charAt(0);
        el.appendChild(hp); el.appendChild(bloom);
    }

    if (data.type === 'ayle' || data.name.includes('エール')) {
        const colors = { '白': 'white', '緑': 'green', '赤': 'red', '青': 'blue', '黄': 'yellow', '紫': 'purple' };
        for (let k in colors) if (data.name.includes(k)) { el.classList.add(`ayle-${colors[k]}`); break; }
    } else el.classList.add(`type-${data.type}`);
    
    // データ保存 (ズーム用)
    el.cardData = data;

    if (withEvents) setupCardEvents(el); return el;
}
function restoreCard(id, info) {
    const el = createCardElement({ id, ...info });
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
    if (potentialZoomTarget && dist < 12 && !potentialZoomTarget.classList.contains('face-down')) {
        openZoom(potentialZoomTarget.cardData);
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
        const zones = document.querySelectorAll('.zone'); let closest = null, minDist = 38;
        const cr = currentCard.getBoundingClientRect(), cc = { x: cr.left + cr.width/2, y: cr.top + cr.height/2 };
        zones.forEach(z => {
            const zr = z.getBoundingClientRect(), zc = { x: zr.left + zr.width/2, y: zr.top + zr.height/2 };
            const d = Math.hypot(cc.x - zc.x, cc.y - zc.y);
            if (d < minDist) { minDist = d; closest = z; }
        });
        const fRect = field.getBoundingClientRect();
        let moveData = { id: currentCard.id, ...currentCard.cardData, zIndex: currentCard.style.zIndex };
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
