const socket = io();

let MASTER_CARDS = [];
let OSHI_LIST = [];

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
        const ayleData = await ayleRes.json();
        OSHI_LIST = await oshiRes.json();
        
        MASTER_CARDS = [...holomenData, ...ayleData, ...OSHI_LIST];
        updateLibrary();
    } catch (error) {
        console.error("Failed to load card data:", error);
    }
}

loadCardData();

// --- デッキ構築UI ---
function updateLibrary(filter = "") {
    const list = document.getElementById('libraryList');
    list.innerHTML = "";
    MASTER_CARDS.filter(c => c.name.includes(filter)).forEach(card => {
        const div = document.createElement('div');
        div.className = "library-item";
        // JSON内のデータから推しリストに含まれるか判定
        const isOshiCard = OSHI_LIST.some(o => o.name === card.name);
        
        div.innerHTML = `<span>${card.name}</span><button class="btn-add">${isOshiCard ? '推しに設定' : '追加'}</button>`;
        div.querySelector('.btn-add').onclick = () => {
            if (isOshiCard) {
                selectedOshi = { ...card };
            } else if (card.type === 'ayle') {
                cheerDeckList.push({ ...card });
            } else {
                mainDeckList.push({ ...card });
            }
            renderDecks();
        };
        list.appendChild(div);
    });
}

function renderDecks() {
    const oshiSummary = document.getElementById('oshiSummary');
    const mainSummary = document.getElementById('mainDeckSummary');
    const cheerSummary = document.getElementById('cheerDeckSummary');
    
    oshiSummary.innerHTML = selectedOshi ? `<div class="deck-item"><span>${selectedOshi.name}</span><button class="btn-remove">外す</button></div>` : "";
    if (selectedOshi) oshiSummary.querySelector('.btn-remove').onclick = () => { selectedOshi = null; renderDecks(); };

    mainSummary.innerHTML = "";
    mainDeckList.forEach((c, i) => {
        const d = document.createElement('div'); d.className = "deck-item";
        d.innerHTML = `<span>${c.name}</span><button class="btn-remove">削</button>`;
        d.querySelector('.btn-remove').onclick = () => { mainDeckList.splice(i, 1); renderDecks(); };
        mainSummary.appendChild(d);
    });

    cheerSummary.innerHTML = "";
    cheerDeckList.forEach((c, i) => {
        const d = document.createElement('div'); d.className = "deck-item";
        d.innerHTML = `<span>${c.name}</span><button class="btn-remove">削</button>`;
        d.querySelector('.btn-remove').onclick = () => { cheerDeckList.splice(i, 1); renderDecks(); };
        cheerSummary.appendChild(d);
    });

    document.getElementById('mainBuildCount').innerText = mainDeckList.length;
    document.getElementById('cheerBuildCount').innerText = cheerDeckList.length;
    document.getElementById('startGameBtn').disabled = (!selectedOshi || mainDeckList.length === 0 || cheerDeckList.length === 0);
}

document.getElementById('searchInput').oninput = (e) => updateLibrary(e.target.value);

document.getElementById('startGameBtn').onclick = () => {
    // 推しポジション(id="oshi")の座標を取得
    const oshiZone = document.getElementById('oshi');
    const zr = oshiZone.getBoundingClientRect();
    const fr = field.getBoundingClientRect();
    
    const oshiPos = {
        x: (zr.left - fr.left) + (zr.width - 65) / 2 + 'px',
        y: (zr.top - fr.top) + (zr.height - 92) / 2 + 'px'
    };

    socket.emit('setGame', {
        main: mainDeckList.map(c => c.name),
        cheer: cheerDeckList.map(c => c.name),
        oshi: { name: selectedOshi.name, pos: oshiPos }
    });
    modal.style.display = "none";
};

// --- ゲームプレイ ---
let isDragging = false, currentCard = null, offsetX = 0, offsetY = 0, maxZIndex = 100;

socket.on('gameStarted', (data) => {
    field.innerHTML = ""; // 既存カードをクリア
    for (const id in data.fieldState) restoreCard(id, data.fieldState[id]);
    document.getElementById('mainCount').innerText = data.deckCount.main;
    document.getElementById('cheerCount').innerText = data.deckCount.cheer;
});

socket.on('init', (data) => {
    for (const id in data.fieldState) restoreCard(id, data.fieldState[id]);
});

socket.on('deckCount', (counts) => {
    document.getElementById('mainCount').innerText = counts.main;
    document.getElementById('cheerCount').innerText = counts.cheer;
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
        const protectedZones = ['back', 'center', 'collab'];
        const currentZoneId = getZoneUnderCard(el);
        if (protectedZones.includes(currentZoneId)) return;

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
            el.style.left = (coords.x - offsetX) + 'px'; el.style.top = (coords.y - offsetY) + 'px';
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
    let closest = null, minDist = 50;
    const cr = currentCard.getBoundingClientRect();
    const cc = { x: cr.left + cr.width/2, y: cr.top + cr.height/2 };
    zones.forEach(z => {
        const zr = z.getBoundingClientRect();
        const zc = { x: zr.left + zr.width/2, y: zr.top + zr.height/2 };
        const d = Math.hypot(cc.x - zc.x, cc.y - zc.y);
        if (d < minDist) { minDist = d; closest = z; }
    });
    if (closest) {
        const zr = closest.getBoundingClientRect(), fr = field.getBoundingClientRect();
        currentCard.style.left = (zr.left - fr.left) + (zr.width - cr.width)/2 + 'px';
        currentCard.style.top = (zr.top - fr.top) + (zr.height - cr.height)/2 + 'px';
    }
}
