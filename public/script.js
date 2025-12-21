const socket = io();

// マスターリスト定義
let MASTER_CARDS = [];
let OSHI_LIST = [];
let AYLE_MASTER = []; // エールカードのマスターリストを個別に保持

let mainDeckList = [];
let cheerDeckList = [];
let selectedOshi = null;

const modal = document.getElementById('setup-modal');
const field = document.getElementById('field');
const handDiv = document.getElementById('hand');

// --- データの読み込み ---
async function loadCardData() {
    try {
        const [holomenRes, ayleRes, oshiRes] = await Promise.all([
            fetch('/data/holomen.json'),
            fetch('/data/ayle.json'),
            fetch('/data/oshi_holomen.json')
        ]);
        
        const holomenData = await holomenRes.json();
        AYLE_MASTER = await ayleRes.json();
        OSHI_LIST = await oshiRes.json();
        
        // 全カードリスト（検索用）
        MASTER_CARDS = [...holomenData, ...AYLE_MASTER, ...OSHI_LIST];
        
        updateLibrary();
        renderDecks(); // 初期描画
    } catch (error) {
        console.error("Failed to load card data:", error);
    }
}

loadCardData();

// --- デッキ構築UIロジック ---

function updateLibrary(filter = "") {
    const list = document.getElementById('libraryList');
    list.innerHTML = "";
    
    // 【変更】エールカード(type === 'ayle')を除外して表示
    MASTER_CARDS.filter(c => c.name.includes(filter) && c.type !== 'ayle').forEach(card => {
        const div = document.createElement('div');
        div.className = "library-item";
        const isOshiCard = OSHI_LIST.some(o => o.name === card.name);
        
        div.innerHTML = `<span>${card.name}</span><button class="btn-add">${isOshiCard ? '推しに設定' : '追加'}</button>`;
        div.querySelector('.btn-add').onclick = () => addToDeck(card);
        list.appendChild(div);
    });
}

// カードをデッキに追加する
function addToDeck(card) {
    const isOshiCard = OSHI_LIST.some(o => o.name === card.name);
    
    if (isOshiCard) {
        selectedOshi = { ...card };
    } else if (card.type === 'ayle') {
        if (cheerDeckList.length >= 20) return;
        cheerDeckList.push({ ...card });
    } else {
        mainDeckList.push({ ...card });
    }
    renderDecks();
}

// 名前とタイプを指定して1枚削除する
function removeFromDeckByName(name, type) {
    if (type === 'ayle') {
        const index = cheerDeckList.findIndex(c => c.name === name);
        if (index !== -1) cheerDeckList.splice(index, 1);
    } else {
        const index = mainDeckList.findIndex(c => c.name === name);
        if (index !== -1) mainDeckList.splice(index, 1);
    }
    renderDecks();
}

// デッキの状態を描画
function renderDecks() {
    const oshiSummary = document.getElementById('oshiSummary');
    const mainSummary = document.getElementById('mainDeckSummary');
    const cheerSummary = document.getElementById('cheerDeckSummary');
    
    // 1. 推しホロメン
    oshiSummary.innerHTML = selectedOshi ? `<div class="deck-item"><span>${selectedOshi.name}</span><button class="btn-remove">外す</button></div>` : "";
    if (selectedOshi) oshiSummary.querySelector('.btn-remove').onclick = () => { selectedOshi = null; renderDecks(); };

    // 2. メインデッキの描画（グループ化）
    mainSummary.innerHTML = "";
    const groupedMain = mainDeckList.reduce((acc, card) => {
        acc[card.name] = (acc[card.name] || { data: card, count: 0 });
        acc[card.name].count++;
        return acc;
    }, {});

    Object.keys(groupedMain).forEach(name => {
        const item = groupedMain[name];
        const div = document.createElement('div');
        div.className = "deck-item";
        div.innerHTML = `<span>${name}</span><div class="deck-item-controls"><button class="btn-minus">-</button><span class="count-number">${item.count}</span><button class="btn-plus">+</button></div>`;
        div.querySelector('.btn-minus').onclick = () => removeFromDeckByName(name, 'holomen');
        div.querySelector('.btn-plus').onclick = () => addToDeck(item.data);
        mainSummary.appendChild(div);
    });

    // 3. エールデッキの描画（【変更】マスターリストに基づき全色を常に表示）
    cheerSummary.innerHTML = "";
    const totalCheer = cheerDeckList.length;

    AYLE_MASTER.forEach(cardData => {
        const count = cheerDeckList.filter(c => c.name === cardData.name).length;
        const div = document.createElement('div');
        div.className = "deck-item";
        div.innerHTML = `
            <span>${cardData.name}</span>
            <div class="deck-item-controls">
                <button class="btn-minus" ${count === 0 ? 'disabled' : ''}>-</button>
                <span class="count-number">${count}</span>
                <button class="btn-plus" ${totalCheer >= 20 ? 'disabled' : ''}>+</button>
            </div>
        `;
        div.querySelector('.btn-minus').onclick = () => removeFromDeckByName(cardData.name, 'ayle');
        div.querySelector('.btn-plus').onclick = () => addToDeck(cardData);
        cheerSummary.appendChild(div);
    });

    document.getElementById('mainBuildCount').innerText = mainDeckList.length;
    document.getElementById('cheerBuildCount').innerText = totalCheer;
    document.getElementById('startGameBtn').disabled = (!selectedOshi || mainDeckList.length === 0 || totalCheer === 0);
}

document.getElementById('searchInput').oninput = (e) => updateLibrary(e.target.value);

document.getElementById('startGameBtn').onclick = () => {
    const oshiZone = document.getElementById('oshi');
    const zr = oshiZone.getBoundingClientRect();
    const fr = field.getBoundingClientRect();
    const oshiPos = {
        x: (zr.left - fr.left) + (zr.width - 60) / 2 + 'px',
        y: (zr.top - fr.top) + (zr.height - 85) / 2 + 'px'
    };
    socket.emit('setGame', {
        main: mainDeckList.map(c => c.name),
        cheer: cheerDeckList.map(c => c.name),
        oshi: { name: selectedOshi.name, pos: oshiPos }
    });
    modal.style.display = "none";
};

// --- ゲームプレイロジック（Pointer Events維持） ---
let isDragging = false, currentCard = null, offsetX = 0, offsetY = 0, maxZIndex = 100;

socket.on('gameStarted', (data) => {
    const existingCards = field.querySelectorAll('.card');
    existingCards.forEach(card => card.remove());
    handDiv.innerHTML = "";
    for (const id in data.fieldState) restoreCard(id, data.fieldState[id]);
    document.getElementById('mainCount').innerText = data.deckCount.main;
    document.getElementById('cheerCount').innerText = data.deckCount.cheer;
});

socket.on('init', (data) => {
    const existingCards = field.querySelectorAll('.card');
    existingCards.forEach(card => card.remove());
    for (const id in data.fieldState) restoreCard(id, data.fieldState[id]);
});

socket.on('receiveCard', (data) => handDiv.appendChild(createCardElement(data)));

document.getElementById('main-deck-zone').onclick = () => socket.emit('drawMainCard');
document.getElementById('cheer-deck-zone').onclick = () => socket.emit('drawCheerCard');

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
    el.className = `card face-up type-${data.type}`;
    el.id = data.id; el.innerText = data.name;
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
            const coords = getLocalCoords(e);
            el.style.position = 'absolute';
            el.style.left = (coords.x - offsetX) + 'px'; el.style.top = (coords.y - offsetY) + 'px';
            field.appendChild(el);
        }
    });
}

document.addEventListener('pointermove', (e) => {
    if (!isDragging || !currentCard) return;
    const coords = getLocalCoords(e);
    currentCard.style.left = (coords.x - offsetX) + 'px';
    currentCard.style.top = (coords.y - offsetY) + 'px';
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
        socket.emit('moveCard', { id: currentCard.id, name: currentCard.innerText, x: currentCard.style.left, y: currentCard.style.top, zIndex: currentCard.style.zIndex, type: currentCard.classList.contains('type-ayle')?'ayle':'holomen' });
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
