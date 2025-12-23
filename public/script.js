const socket = io();

let MASTER_CARDS = [], OSHI_LIST = [], AYLE_MASTER = [];
let mainDeckList = [], cheerDeckList = [], selectedOshi = null;
let myRole = 'spectator', currentDragEl = null, isDragging = false;
let startX = 0, startY = 0, offsetX = 0, offsetY = 0, maxZIndex = 1000;
let currentFilter = 'all';

const field = document.getElementById('field');
const handDiv = document.getElementById('hand');
const zoomModal = document.getElementById('zoom-modal');
const setupModal = document.getElementById('setup-modal');

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

// --- ルーム参加 (修正: 進行不能を解消) ---
async function joinRoom(role) {
    const rid = document.getElementById('roomIdInput').value;
    if (!rid) return alert("ルームIDを入力してください");
    
    myRole = role; 
    socket.emit('joinRoom', { roomId: rid, role });
    
    // 全ての選択用モーダルを隠す
    showPage(''); 
    document.getElementById('status').innerText = `Room: ${rid}${role==='spectator'?' (観戦)':''}`;
    
    if (role === 'player') {
        // プレイヤーなら構築画面へ確実に遷移
        showPage('setup-modal');
        updateLibrary("");
    } else {
        // 観戦者ならフィールドを表示
        document.body.classList.add('spectator-mode');
    }
}
document.getElementById('joinPlayerBtn').onclick = () => joinRoom('player');
document.getElementById('joinSpectatorBtn').onclick = () => joinRoom('spectator');

// --- ドロー処理 ---
socket.on('receiveCard', (d) => {
    if (!handDiv) return;
    const el = createCardElement({ ...d, isFaceUp: true });
    el.style.position = 'relative';
    handDiv.appendChild(el);
});

// --- 再配置ロジック ---
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

// --- 操作イベント (配置制限ルール) ---
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

// --- データ読込 & 初期化 ---
async function loadCardData() {
    try {
        const res = await Promise.all([ fetch('/data/holomen.json').then(r=>r.json()), fetch('/data/support.json').then(r=>r.json()), fetch('/data/ayle.json').then(r=>r.json()), fetch('/data/oshi_holomen.json').then(r=>r.json()) ]);
        MASTER_CARDS = [...res[0], ...res[1], ...res[2]]; AYLE_MASTER = res[2]; OSHI_LIST = res[3];
        updateLibrary(); renderDecks();
    } catch (e) { console.error(e); }
}

function updateLibrary(f = "") {
    const list = document.getElementById('libraryList'); if(!list) return;
    list.innerHTML = ""; const search = f.toLowerCase();
    const all = [...OSHI_LIST, ...MASTER_CARDS.filter(c => c.type !== 'ayle')];
    all.filter(c => c.name.toLowerCase().includes(search)).forEach(card => {
        const div = document.createElement('div'); div.className = "library-item";
        const info = card.bloom || (card.type === 'oshi' ? "OSHI" : "S");
        div.innerHTML = `<span>${card.name}<span class="type-tag">${info}</span></span>`;
        const btn = document.createElement('button'); btn.className = "btn-add"; btn.innerText = card.type === 'oshi' ? '設定' : '追加';
        btn.onclick = () => addToDeck(card); div.appendChild(btn); list.appendChild(div);
    });
}
// ... (その他のSocket同期・構築ロジック等は前回設定を維持)
