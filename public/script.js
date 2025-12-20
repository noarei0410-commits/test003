const socket = io();

// マスターリスト定義
const MASTER_CARDS = [
    { name: "ときのそら (推し)", type: "holomen" },
    { name: "ときのそら (Debut)", type: "holomen" },
    { name: "AZKi (Debut)", type: "holomen" },
    { name: "友人A", type: "holomen" },
    { name: "赤エール", type: "ayle" },
    { name: "青エール", type: "ayle" }
];

let mainDeckList = [];
let cheerDeckList = [];
const modal = document.getElementById('setup-modal');
const field = document.getElementById('field');
const handDiv = document.getElementById('hand');

// --- デッキ構築UI ---
function updateLibrary(filter = "") {
    const list = document.getElementById('libraryList');
    list.innerHTML = "";
    MASTER_CARDS.filter(c => c.name.includes(filter)).forEach(card => {
        const div = document.createElement('div');
        div.className = "library-item";
        div.innerHTML = `<span>${card.name}</span><button class="btn-add">追加</button>`;
        div.querySelector('.btn-add').onclick = () => {
            if(card.type === 'ayle') cheerDeckList.push({...card});
            else mainDeckList.push({...card});
            renderDecks();
        };
        list.appendChild(div);
    });
}

function renderDecks() {
    const mainSummary = document.getElementById('mainDeckSummary');
    const cheerSummary = document.getElementById('cheerDeckSummary');
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
    document.getElementById('startGameBtn').disabled = (mainDeckList.length === 0 || cheerDeckList.length === 0);
}

document.getElementById('searchInput').oninput = (e) => updateLibrary(e.target.value);
document.getElementById('startGameBtn').onclick = () => {
    socket.emit('setMainDeck', mainDeckList.map(c => c.name));
    socket.emit('setCheerDeck', cheerDeckList.map(c => c.name));
    modal.style.display = "none";
};
updateLibrary();

// --- ゲームロジック ---
let isDragging = false, currentCard = null, offsetX = 0, offsetY = 0, maxZIndex = 100;

function getLocalCoords(e) {
    const rect = field.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

// 特定のカードがどのゾーンの上にいるか判定する関数
function getZoneUnderCard(card) {
    const zones = document.querySelectorAll('.zone');
    const cr = card.getBoundingClientRect();
    const cc = { x: cr.left + cr.width/2, y: cr.top + cr.height/2 };
    
    for (let z of zones) {
        const zr = z.getBoundingClientRect();
        if (cc.x >= zr.left && cc.x <= zr.right && 
            cc.y >= zr.top && cc.y <= zr.bottom) {
            return z.id; // ゾーンのHTML ID（back, center, collabなど）を返す
        }
    }
    return null;
}

socket.on('deckCount', (counts) => {
    document.getElementById('mainCount').innerText = counts.main;
    document.getElementById('cheerCount').innerText = counts.cheer;
});

socket.on('receiveCard', (data) => handDiv.appendChild(createCardElement(data)));

document.getElementById('main-deck-zone').onclick = () => socket.emit('drawMainCard');
document.getElementById('cheer-deck-zone').onclick = () => socket.emit('drawCheerCard');

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
    if (info.isFaceUp === false) el.classList.add('face-down');
    field.appendChild(el);
}

function setupCardEvents(el) {
    el.addEventListener('dblclick', (e) => {
        // 【修正】裏返し禁止エリアのチェック
        // 1. 手札枠にいる場合
        if (el.parentElement === handDiv) return;

        // 2. 特定のポジション（バック、センター、コラボ）にいる場合
        const protectedZones = ['back', 'center', 'collab'];
        const currentZoneId = getZoneUnderCard(el);
        if (protectedZones.includes(currentZoneId)) {
            console.log("このエリアではカードを裏返せません");
            return;
        }

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
    if (e.clientX > handRect.left && e.clientX < handRect.right && 
        e.clientY > handRect.top && e.clientY < handRect.bottom) {
        currentCard.style.position = 'relative'; currentCard.style.left = ''; currentCard.style.top = '';
        handDiv.appendChild(currentCard);
        socket.emit('returnToHand', { id: currentCard.id });
    } else {
        snapToZone();
        socket.emit('moveCard', { 
            id: currentCard.id, 
            name: currentCard.innerText, 
            x: currentCard.style.left, 
            y: currentCard.style.top, 
            zIndex: currentCard.style.zIndex, 
            type: currentCard.classList.contains('type-ayle') ? 'ayle' : 'holomen' 
        });
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
