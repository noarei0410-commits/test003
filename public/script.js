const socket = io();

// --- 1. マスターカードリスト（全データ） ---
const MASTER_CARDS = [
    { name: "ときのそら (推し)", type: "holomen" },
    { name: "ときのそら (Debut)", type: "holomen" },
    { name: "ときのそら (Bloom)", type: "holomen" },
    { name: "AZKi (Debut)", type: "holomen" },
    { name: "AZKi (Bloom)", type: "holomen" },
    { name: "赤エール", type: "ayle" },
    { name: "青エール", type: "ayle" },
    { name: "白エール", type: "ayle" },
    { name: "マイク", type: "holomen" }, // サポートも一旦holomenタイプで代用
    { name: "友人A", type: "holomen" }
];

let constructedDeck = []; // 現在選んでいるカードのリスト

// DOM要素
const modal = document.getElementById('setup-modal');
const libraryList = document.getElementById('libraryList');
const deckSummary = document.getElementById('deckSummary');
const searchInput = document.getElementById('searchInput');
const startGameBtn = document.getElementById('startGameBtn');
const totalCountSpan = document.getElementById('totalCount');

const field = document.getElementById('field');
const handDiv = document.getElementById('hand');

// --- 2. デッキ構築UIの制御 ---

// カードリストの表示
function updateLibrary(filter = "") {
    libraryList.innerHTML = "";
    const filtered = MASTER_CARDS.filter(c => c.name.includes(filter));
    filtered.forEach(card => {
        const div = document.createElement('div');
        div.className = "library-item";
        div.innerHTML = `<span>${card.name} (${card.type === 'ayle' ? 'エール' : 'ホロメン'})</span>
                         <button class="btn-add">追加</button>`;
        div.querySelector('.btn-add').onclick = () => addToDeck(card);
        libraryList.appendChild(div);
    });
}

// デッキへの追加
function addToDeck(card) {
    constructedDeck.push({ ...card });
    renderDeck();
}

// デッキからの削除
function removeFromDeck(index) {
    constructedDeck.splice(index, 1);
    renderDeck();
}

// 構築中リストの描画
function renderDeck() {
    deckSummary.innerHTML = "";
    constructedDeck.forEach((card, index) => {
        const div = document.createElement('div');
        div.className = "deck-item";
        div.innerHTML = `<span>${card.name}</span>
                         <button class="btn-remove">削除</button>`;
        div.querySelector('.btn-remove').onclick = () => removeFromDeck(index);
        deckSummary.appendChild(div);
    });
    
    totalCountSpan.innerText = constructedDeck.length;
    // メイン50枚 + 推し1枚などのルールがあるが、今回は簡易的に1枚以上で開始可能に
    startGameBtn.disabled = constructedDeck.length === 0;
}

// 検索入力
searchInput.oninput = (e) => updateLibrary(e.target.value);

// ゲーム開始ボタン
startGameBtn.onclick = () => {
    // 種類ごとに分けてサーバーへ送信
    const mainList = constructedDeck.filter(c => c.type === 'holomen').map(c => c.name);
    const cheerList = constructedDeck.filter(c => c.type === 'ayle').map(c => c.name);
    
    socket.emit('setMainDeck', mainList);
    socket.emit('setCheerDeck', cheerList);
    
    modal.style.display = "none"; // ウィンドウを消す
};

// 初期表示
updateLibrary();

// --- 3. ゲーム同期・ドラッグロジック (維持) ---

let isDragging = false, currentCard = null, offsetX = 0, offsetY = 0, maxZIndex = 100;
const SNAP_THRESHOLD = 50;

function getLocalCoords(e) {
    const fRect = field.getBoundingClientRect();
    return { x: e.clientX - fRect.left, y: e.clientY - fRect.top };
}

socket.on('deckCount', (counts) => {
    document.getElementById('mainCount').innerText = counts.main;
    document.getElementById('cheerCount').innerText = counts.cheer;
});

socket.on('receiveCard', (cardData) => {
    handDiv.appendChild(createCardElement(cardData));
});

document.getElementById('main-deck-zone').onclick = () => socket.emit('drawMainCard');
document.getElementById('cheer-deck-zone').onclick = () => socket.emit('drawCheerCard');

function createCardElement(cardData) {
    const el = document.createElement('div');
    el.className = `card face-up type-${cardData.type}`;
    el.id = cardData.id; el.innerText = cardData.name;
    setupCardEvents(el);
    return el;
}

function restoreCard(id, info) {
    const el = createCardElement({ id: id, name: info.name, type: info.type });
    el.style.position = 'absolute'; el.style.left = info.x; el.style.top = info.y; el.style.zIndex = info.zIndex;
    if (info.isFaceUp === false) el.classList.add('face-down');
    field.appendChild(el);
}

function setupCardEvents(el) {
    el.addEventListener('dblclick', (e) => {
        el.classList.toggle('face-up'); el.classList.toggle('face-down');
        socket.emit('flipCard', { id: el.id, isFaceUp: el.classList.contains('face-up') });
        e.stopPropagation();
    });
    el.addEventListener('mousedown', (e) => {
        isDragging = true; currentCard = el;
        const rect = el.getBoundingClientRect();
        offsetX = e.clientX - rect.left; offsetY = e.clientY - rect.top;
        maxZIndex++; el.style.zIndex = maxZIndex;
        if (el.parentElement !== field) {
            const coords = getLocalCoords(e);
            el.style.position = 'absolute';
            el.style.left = (coords.x - offsetX) + 'px';
            el.style.top = (coords.y - offsetY) + 'px';
            field.appendChild(el);
        }
    });
}

document.addEventListener('mousemove', (e) => {
    if (!isDragging || !currentCard) return;
    const coords = getLocalCoords(e);
    currentCard.style.left = (coords.x - offsetX) + 'px';
    currentCard.style.top = (coords.y - offsetY) + 'px';
});

document.addEventListener('mouseup', (e) => {
    if (isDragging && currentCard) {
        const handRect = handDiv.getBoundingClientRect();
        if (e.clientX > handRect.left && e.clientX < handRect.right && 
            e.clientY > handRect.top && e.clientY < handRect.bottom) {
            returnToHand();
        } else {
            snapToZone();
            syncMove();
        }
    }
    isDragging = false; currentCard = null;
});

function snapToZone() {
    const zones = document.querySelectorAll('.zone');
    let closest = null, minDist = SNAP_THRESHOLD;
    const cardRect = currentCard.getBoundingClientRect();
    const cardCenter = { x: cardRect.left + cardRect.width/2, y: cardRect.top + cardRect.height/2 };
    zones.forEach(zone => {
        const zr = zone.getBoundingClientRect();
        const zc = { x: zr.left + zr.width/2, y: zr.top + zr.height/2 };
        const dist = Math.hypot(cardCenter.x - zc.x, cardCenter.y - zc.y);
        if (dist < minDist) { minDist = dist; closest = zone; }
    });
    if (closest) {
        const zr = closest.getBoundingClientRect(), fr = field.getBoundingClientRect();
        currentCard.style.left = (zr.left - fr.left) + (zr.width - cardRect.width)/2 + 'px';
        currentCard.style.top = (zr.top - fr.top) + (zr.height - cardRect.height)/2 + 'px';
    }
}

function returnToHand() {
    currentCard.style.position = 'relative'; currentCard.style.left = ''; currentCard.style.top = '';
    handDiv.appendChild(currentCard);
    socket.emit('returnToHand', { id: currentCard.id });
}

function syncMove() {
    if (!currentCard) return;
    socket.emit('moveCard', {
        id: currentCard.id, name: currentCard.innerText,
        type: currentCard.classList.contains('type-ayle') ? 'ayle' : 'holomen',
        x: currentCard.style.left, y: currentCard.style.top, zIndex: currentCard.style.zIndex
    });
}
