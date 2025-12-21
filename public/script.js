const socket = io();

let MASTER_CARDS = [];
let OSHI_LIST = [];
let AYLE_MASTER = [];

let mainDeckList = [];
let cheerDeckList = [];
let selectedOshi = null;

const modal = document.getElementById('setup-modal');
const field = document.getElementById('field');
const handDiv = document.getElementById('hand');

// --- データの読み込み ---
async function loadCardData() {
    try {
        const [holomenRes, supportRes, ayleRes, oshiRes] = await Promise.all([
            fetch('/data/holomen.json'),
            fetch('/data/support.json'), // サポートカード追加
            fetch('/data/ayle.json'),
            fetch('/data/oshi_holomen.json')
        ]);
        
        const holomenData = await holomenRes.json();
        const supportData = await supportRes.json();
        AYLE_MASTER = await ayleRes.json();
        OSHI_LIST = await oshiRes.json();
        
        // メインデッキ用カードとしてホロメンとサポートを統合
        MASTER_CARDS = [...holomenData, ...supportData, ...AYLE_MASTER, ...OSHI_LIST];
        
        updateLibrary();
        renderDecks();
    } catch (error) {
        console.error("Failed to load card data:", error);
    }
}

loadCardData();

// --- デッキ構築UI ---

function updateLibrary(filter = "") {
    const list = document.getElementById('libraryList');
    list.innerHTML = "";
    
    // エールカード以外を表示
    MASTER_CARDS.filter(c => c.name.includes(filter) && c.type !== 'ayle').forEach(card => {
        const div = document.createElement('div');
        div.className = "library-item";
        const isOshiCard = OSHI_LIST.some(o => o.name === card.name);
        
        // 表示名のラベル作成
        let typeLabel = isOshiCard ? "推し" : (card.type === 'holomen' ? "ホロメン" : `サポート:${card.subType}`);
        
        div.innerHTML = `
            <div class="item-info">
                <span class="type-tag tag-${card.type}">${typeLabel}</span>
                <span class="card-name">${card.name}</span>
            </div>
            <button class="btn-add">${isOshiCard ? '設定' : '追加'}</button>
        `;
        div.querySelector('.btn-add').onclick = () => addToDeck(card);
        list.appendChild(div);
    });
}

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

function removeFromDeckByName(name, type) {
    const targetList = (type === 'ayle') ? cheerDeckList : mainDeckList;
    const index = targetList.findIndex(c => c.name === name);
    if (index !== -1) targetList.splice(index, 1);
    renderDecks();
}

function renderDecks() {
    const oshiSummary = document.getElementById('oshiSummary');
    const mainSummary = document.getElementById('mainDeckSummary');
    const cheerSummary = document.getElementById('cheerDeckSummary');
    
    oshiSummary.innerHTML = selectedOshi ? `<div class="deck-item"><span>${selectedOshi.name}</span><button class="btn-remove">外す</button></div>` : "";
    if (selectedOshi) oshiSummary.querySelector('.btn-remove').onclick = () => { selectedOshi = null; renderDecks(); };

    // メインデッキ（ホロメン & サポート）
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
        div.querySelector('.btn-minus').onclick = () => removeFromDeckByName(name, 'main');
        div.querySelector('.btn-plus').onclick = () => addToDeck(item.data);
        mainSummary.appendChild(div);
    });

    // エールデッキ
    cheerSummary.innerHTML = "";
    AYLE_MASTER.forEach(cardData => {
        const count = cheerDeckList.filter(c => c.name === cardData.name).length;
        const div = document.createElement('div');
        div.className = "deck-item";
        div.innerHTML = `<span>${cardData.name}</span><div class="deck-item-controls"><button class="btn-minus" ${count === 0 ? 'disabled' : ''}>-</button><span class="count-number">${count}</span><button class="btn-plus" ${cheerDeckList.length >= 20 ? 'disabled' : ''}>+</button></div>`;
        div.querySelector('.btn-minus').onclick = () => removeFromDeckByName(cardData.name, 'ayle');
        div.querySelector('.btn-plus').onclick = () => addToDeck(cardData);
        cheerSummary.appendChild(div);
    });

    document.getElementById('mainBuildCount').innerText = mainDeckList.length;
    document.getElementById('cheerBuildCount').innerText = cheerDeckList.length;
    document.getElementById('startGameBtn').disabled = (!selectedOshi || mainDeckList.length === 0 || cheerDeckList.length === 0);
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

// --- ゲームプレイ共通ロジック ---
let isDragging = false, currentCard = null, offsetX = 0, offsetY = 0, maxZIndex = 100;

socket.on('gameStarted', (data) => {
    field.querySelectorAll('.card').forEach(card => card.remove());
    handDiv.innerHTML = "";
    for (const id in data.fieldState) restoreCard(id, data.fieldState[id]);
});

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
    el.id = data.id;
    el.innerText = data.name;
    el.classList.add('card', 'face-up');
    
    // タイプに応じたクラス付与
    if (data.type === 'ayle') {
        el.classList.add('type-ayle');
        if (data.name.includes('白')) el.classList.add('ayle-white');
        else if (data.name.includes('緑')) el.classList.add('ayle-green');
        else if (data.name.includes('赤')) el.classList.add('ayle-red');
        else if (data.name.includes('青')) el.classList.add('ayle-blue');
        else if (data.name.includes('黄')) el.classList.add('ayle-yellow');
        else if (data.name.includes('紫')) el.classList.add('ayle-purple');
    } else if (data.type === 'support') {
        el.classList.add('type-support'); // サポート用クラス
    } else {
        el.classList.add('type-holomen');
    }

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
            const fRect = field.getBoundingClientRect();
            el.style.position = 'absolute';
            el.style.left = (e.clientX - fRect.left - offsetX) + 'px';
            el.style.top = (e.clientY - fRect.top - offsetY) + 'px';
            field.appendChild(el);
        }
    });
}

document.addEventListener('pointermove', (e) => {
    if (!isDragging || !currentCard) return;
    const fRect = field.getBoundingClientRect();
    currentCard.style.left = (e.clientX - fRect.left - offsetX) + 'px';
    currentCard.style.top = (e.clientY - fRect.top - offsetY) + 'px';
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
