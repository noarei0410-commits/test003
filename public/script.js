const socket = io();

let MASTER_CARDS = [], OSHI_LIST = [], AYLE_MASTER = [];
let mainDeckList = [], cheerDeckList = [], selectedOshi = null;
let myRole = 'spectator', currentDragEl = null, isDragging = false;
let startX = 0, startY = 0, offsetX = 0, offsetY = 0, maxZIndex = 1000;
let originalNextSibling = null, potentialZoomTarget = null;
let currentFilter = 'all';

const field = document.getElementById('field');
const handDiv = document.getElementById('hand');
const zoomModal = document.getElementById('zoom-modal');
const deckModal = document.getElementById('deck-inspection-modal');
const deckGrid = document.getElementById('deck-card-grid');

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

// --- デッキサーチ ---
function openDeckInspection(type) {
    if (myRole !== 'player') return;
    socket.emit('inspectDeck', type);
}
socket.on('deckInspectionResult', (data) => {
    const { type, cards } = data;
    deckGrid.innerHTML = "";
    document.getElementById('inspection-title').innerText = (type === 'main' ? 'Main Deck' : 'Cheer Deck') + ` (${cards.length})`;
    cards.forEach(card => {
        const container = document.createElement('div'); container.className = "archive-item";
        const el = createCardElement(card, false); el.classList.remove('face-down'); el.classList.add('face-up');
        const pickBtn = document.createElement('button'); pickBtn.className = "btn-recover"; pickBtn.innerText = "手札へ";
        pickBtn.onclick = () => { socket.emit('pickCardFromDeck', { type, cardId: card.id }); closeDeckInspection(); };
        container.appendChild(el); container.appendChild(pickBtn); deckGrid.appendChild(container);
    });
    deckModal.style.display = 'flex';
});
function closeDeckInspection() { deckModal.style.display = 'none'; }

// --- アーカイブ ---
function openArchive() {
    const grid = document.getElementById('archive-card-grid'); grid.innerHTML = "";
    const archiveCards = Array.from(document.querySelectorAll('#field > .card')).filter(c => c.dataset.zoneId === 'archive');
    if (archiveCards.length === 0) grid.innerHTML = "<p style='width:100%; text-align:center;'>空です</p>";
    else {
        archiveCards.forEach(card => {
            const container = document.createElement('div'); container.className = "archive-item";
            const el = createCardElement(card.cardData, false); el.classList.remove('face-down'); el.classList.add('face-up');
            if (myRole === 'player') {
                const recoverBtn = document.createElement('button'); recoverBtn.className = "btn-recover"; recoverBtn.innerText = "手札へ";
                recoverBtn.onclick = (e) => { e.stopPropagation(); returnToHand(card); closeArchive(); };
                container.appendChild(el); container.appendChild(recoverBtn);
            } else container.appendChild(el);
            grid.appendChild(container);
        });
    }
    document.getElementById('archive-modal').style.display = 'flex';
}
function closeArchive() { document.getElementById('archive-modal').style.display = 'none'; }

// --- カードリスト・フィルタ ---
function filterLibrary(type) {
    currentFilter = type;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        const text = btn.innerText;
        const typeMap = { all: 'すべて', holomen: 'ホロメン', support: 'サポート', ayle: 'エール', oshi: '推し' };
        btn.classList.toggle('active', text === typeMap[type]);
    });
    const grid = document.getElementById('global-card-grid'); if (!grid) return;
    grid.innerHTML = "";
    let list = (type === 'all') ? [...OSHI_LIST, ...MASTER_CARDS] : (type === 'oshi' ? OSHI_LIST : MASTER_CARDS.filter(c => c.type === type));
    list.forEach(card => {
        const el = createCardElement(card, false); el.onclick = () => openZoom(card, el); grid.appendChild(el);
    });
}

// --- ドロー・追加処理 (重要) ---
socket.on('receiveCard', (d) => {
    if (!handDiv) return;
    const el = createCardElement({ ...d, isFaceUp: true });
    el.style.position = 'relative'; // 手札内では相対位置にする
    handDiv.appendChild(el);
});

// --- ズーム機能 ---
function canUseArt(costReq, attachedAyles) {
    if (!costReq || costReq.length === 0) return true;
    let available = attachedAyles.reduce((acc, c) => {
        const colors = { '白': 'white', '緑': 'green', '赤': 'red', '青': 'blue', '黄': 'yellow', '紫': 'purple' };
        for (let k in colors) if (c.name && c.name.includes(k)) { acc[colors[k]] = (acc[colors[k]] || 0) + 1; break; }
        return acc;
    }, {});
    let specific = costReq.filter(c => c !== 'any'), anyCount = costReq.filter(c => c === 'any').length;
    for (let c of specific) { if (available[c] && available[c] > 0) available[c]--; else return false; }
    return Object.values(available).reduce((a, b) => a + b, 0) >= anyCount;
}

function openZoom(cardData, cardElement = null) {
    if (!cardData || (cardElement && cardElement.classList.contains('face-down') && cardElement.dataset.zoneId === 'life-zone')) return;
    const container = document.querySelector('.zoom-container');
    const isOshi = (cardData.type === 'oshi'), isHolomen = (cardData.type === 'holomen');
    let stackAyle = [], stackEquip = [], stackUnder = [];
    
    if (!isOshi && cardElement && cardElement.parentElement === field) {
        const r = cardElement.getBoundingClientRect();
        const stack = Array.from(document.querySelectorAll('.card')).filter(c => c !== cardElement).filter(c => {
            const cr = c.getBoundingClientRect();
            return Math.abs(cr.left - r.left) < 10 && Math.abs(cr.top - r.top) < 10;
        });
        stackAyle = stack.filter(c => c.cardData.type === 'ayle');
        stackEquip = stack.filter(c => c.cardData.type === 'support' && ['tool', 'mascot', 'fan'].includes((c.cardData.category || '').toLowerCase()));
        stackUnder = stack.filter(c => c.cardData.type === 'holomen' && c.cardData.name === cardData.name);
    }

    let skillsHtml = (cardData.skills || []).map(s => {
        let labelTxt = s.type === 'sp_oshi' ? 'SP OSHI' : s.type.toUpperCase();
        let ready = (s.type === 'arts' && canUseArt(s.cost, stackAyle.map(e => e.cardData))) ? `<span class="ready-badge">READY</span>` : "";
        let costHtml = (s.type === 'arts') ? `<div class="cost-container">${(s.cost || []).map(c => `<div class="cost-icon color-${c}"></div>`).join('')}</div>` : `<span class="skill-cost-hp">ホロパワー：-${s.cost || 0}</span>`;
        return `<div class="skill-item"><div class="skill-header"><div class="skill-type-label label-${s.type}">${labelTxt}</div>${costHtml}<div class="skill-name">${s.name}${ready}</div></div><div class="skill-text">${s.text || ''}</div></div>`;
    }).join('');

    let underHtml = stackUnder.length ? `<div class="zoom-under-section"><span class="section-title">進化前</span>${stackUnder.map(u => `<div class="ayle-list-item"><span>● ${u.cardData.bloom}</span><button class="btn-discard-ayle" onclick="discardFromZoom('${u.id}')">破棄</button></div>`).join('')}</div>` : "";
    let equipHtml = stackEquip.length ? `<div class="zoom-equip-section"><span class="section-title">装備中</span>${stackEquip.map(e => `<div class="ayle-list-item"><div><b>${e.cardData.name}</b><br><small>${e.cardData.text || ''}</small></div><button class="btn-discard-ayle" onclick="discardFromZoom('${e.id}')">破棄</button></div>`).join('')}</div>` : "";
    let ayleHtml = stackAyle.length ? `<div class="zoom-ayle-section"><span class="section-title">エール</span>${stackAyle.map(a => `<div class="ayle-list-item"><span>● ${a.cardData.name}</span><button class="btn-discard-ayle" onclick="discardFromZoom('${a.id}')">破棄</button></div>`).join('')}</div>` : "";

    let hpLife = isOshi ? `<div class="zoom-life">LIFE ${cardData.life || 0}</div>` : (isHolomen ? `<div class="zoom-hp">HP ${cardData.hp || 0}</div>` : "");

    container.innerHTML = `<div class="zoom-header"><div><b>${cardData.name}</b></div>${hpLife}</div><div class="zoom-skills-list">${skillsHtml}</div>${underHtml}${equipHtml}${ayleHtml}`;
    zoomModal.style.display = 'flex';
}
window.discardFromZoom = (id) => { const el = document.getElementById(id); if(!el) return; socket.emit('moveCard', {id, zoneId:'archive', zIndex:10, ...el.cardData}); el.dataset.zoneId='archive'; repositionCards(); zoomModal.style.display='none'; };
zoomModal.onclick = (e) => { if (e.target === zoomModal || e.target.className === 'zoom-hint-outside') zoomModal.style.display = 'none'; };

// --- 配置ロジック ---
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
                const off = zoneCounts[zid] * 20;
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

// --- カード生成・操作 ---
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

function setupCardEvents(el) {
    el.onpointerdown = (e) => {
        startX = e.clientX; startY = e.clientY; potentialZoomTarget = el;
        if (myRole === 'spectator') return;
        isDragging = true; currentDragEl = el; el.setPointerCapture(e.pointerId);
        const rect = el.getBoundingClientRect(), fRect = field.getBoundingClientRect();
        offsetX = e.clientX - rect.left; offsetY = e.clientY - rect.top;
        maxZIndex++; el.style.zIndex = maxZIndex;
        if (el.parentElement !== field) { 
            el.style.position = 'absolute'; 
            el.style.left = (rect.left - fRect.left) + 'px'; 
            el.style.top = (rect.top - fRect.top) + 'px'; 
            field.appendChild(el); 
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
        currentDragEl.dataset.zoneId = closest.id; delete currentDragEl.dataset.percentX; moveData.zoneId = closest.id;
        currentDragEl.classList.toggle('rotated', closest.id === 'life-zone'); moveData.isRotated = (closest.id === 'life-zone');
    } else { 
        delete currentDragEl.dataset.zoneId; const fr = field.getBoundingClientRect(); 
        const px = (parseFloat(currentDragEl.style.left)/fr.width)*100, py = (parseFloat(currentDragEl.style.top)/fr.height)*100;
        currentDragEl.dataset.percentX = px; currentDragEl.dataset.percentY = py; moveData.percentX = px; moveData.percentY = py;
    }
}
function restoreCard(id, info) {
    const el = createCardElement({ id, ...info });
    el.dataset.zoneId = info.zoneId || ""; el.dataset.percentX = info.percentX || ""; el.dataset.percentY = info.percentY || "";
    el.style.zIndex = info.zIndex; field.appendChild(el); repositionCards();
}
function returnToHand(card) {
    card.style.position = 'relative'; card.style.left = ''; card.style.top = ''; 
    card.classList.remove('rotated', 'face-down'); card.classList.add('face-up');
    delete card.dataset.zoneId; delete card.dataset.percentX; 
    handDiv.appendChild(card);
    socket.emit('flipCard', { id: card.id, isFaceUp: true }); 
    socket.emit('moveCard', { id: card.id, isRotated: false, isFaceUp: true }); 
    socket.emit('returnToHand', { id: card.id });
}

// --- データ読み込み & UI反映 ---
async function loadCardData() {
    try {
        const [h, s, a, o] = await Promise.all([
            fetch('/data/holomen.json').then(r => r.json()),
            fetch('/data/support.json').then(r => r.json()),
            fetch('/data/ayle.json').then(r => r.json()),
            fetch('/data/oshi_holomen.json').then(r => r.json())
        ]);
        MASTER_CARDS = [...h, ...s, ...a];
        OSHI_LIST = o;
        AYLE_MASTER = a;
        updateLibrary(); renderDecks();
    } catch (e) { console.error("Data Load Error:", e); }
}

function updateLibrary(f = "") {
    const list = document.getElementById('libraryList'); if(!list) return;
    list.innerHTML = "";
    const search = f.toLowerCase();
    const all = [...OSHI_LIST, ...MASTER_CARDS.filter(c => c.type !== 'ayle')];
    all.filter(c => c.name.toLowerCase().includes(search)).forEach(card => {
        const div = document.createElement('div'); div.className = "library-item";
        const typeInfo = card.bloom || (card.type === 'oshi' ? "OSHI" : "");
        div.innerHTML = `<span>${card.name}${typeInfo?' ['+typeInfo+']':''}</span>`;
        const btn = document.createElement('button'); btn.className = "btn-add"; btn.innerText = card.type === 'oshi' ? '設定' : '追加';
        btn.onclick = () => addToDeck(card);
        div.appendChild(btn); list.appendChild(div);
    });
}
function addToDeck(card) {
    if (card.type === 'oshi') selectedOshi = { ...card };
    else if (card.type === 'ayle') { if (cheerDeckList.length < 20) cheerDeckList.push({ ...card }); }
    else mainDeckList.push({ ...card });
    renderDecks();
}
function renderDecks() {
    const oSum = document.getElementById('oshiSummary'), mSum = document.getElementById('mainDeckSummary'), cSum = document.getElementById('cheerDeckSummary');
    if (!oSum) return;
    oSum.innerHTML = "";
    if (selectedOshi) {
        const div = document.createElement('div'); div.className="deck-item"; div.innerHTML=`<span>${selectedOshi.name}</span><button class="btn-remove">X</button>`;
        div.querySelector('button').onclick = () => { selectedOshi = null; renderDecks(); }; oSum.appendChild(div);
    }
    mSum.innerHTML = "";
    const gMain = mainDeckList.reduce((acc, c) => { const key = `${c.name}_${c.bloom||c.category||""}`; acc[key] = (acc[key] || { d: c, n: 0 }); acc[key].n++; return acc; }, {});
    Object.keys(gMain).forEach(key => {
        const item = gMain[key], div = document.createElement('div'); div.className = "deck-item";
        div.innerHTML = `<span>${item.d.name}(${item.d.bloom||'S'}) x${item.n}</span><button class="btn-minus">-</button>`;
        div.querySelector('button').onclick = () => { const idx = mainDeckList.findIndex(c => `${c.name}_${c.bloom || c.category || ""}` === key); if (idx !== -1) mainDeckList.splice(idx, 1); renderDecks(); };
        mSum.appendChild(div);
    });
    cSum.innerHTML = "";
    AYLE_MASTER.forEach(c => {
        const n = cheerDeckList.filter(x => x.name === c.name).length;
        const div = document.createElement('div'); div.className = "deck-item";
        div.innerHTML = `<span>${c.name.charAt(0)}:${n}</span><div class="deck-item-controls"><button class="btn-minus">-</button><button class="btn-plus">+</button></div>`;
        div.querySelector('.btn-plus').onclick = () => addToDeck(c);
        div.querySelector('.btn-minus').onclick = () => { const idx = cheerDeckList.findIndex(x => x.name === c.name); if (idx !== -1) cheerDeckList.splice(idx, 1); renderDecks(); };
        cSum.appendChild(div);
    });
    document.getElementById('mainBuildCount').innerText = mainDeckList.length;
    document.getElementById('cheerBuildCount').innerText = cheerDeckList.length;
    document.getElementById('startGameBtn').disabled = (!selectedOshi || mainDeckList.length === 0 || cheerDeckList.length !== 20);
}

// --- デッキ・ドローイベント ---
let deckClickTimer = null;
function setupDeckClick(id, type) {
    const el = document.getElementById(id);
    if (!el) return;
    el.onpointerdown = (e) => {
        e.preventDefault();
        deckClickTimer = setTimeout(() => { openDeckInspection(type); deckClickTimer = null; }, 500);
    };
    el.onpointerup = () => {
        if (deckClickTimer) {
            clearTimeout(deckClickTimer);
            deckClickTimer = null;
            if(myRole === 'player') socket.emit(type === 'main' ? 'drawMainCard' : 'drawCheerCard');
        }
    };
}
setupDeckClick('main-deck-zone', 'main');
setupDeckClick('cheer-deck-zone', 'cheer');

function canBloom(s, t) {
    if (s.type !== 'holomen' || t.type !== 'holomen' || s.name !== t.name) return false;
    return (t.bloom === 'Debut' && s.bloom === '1st') || (t.bloom === '1st' && (s.bloom === '2nd' || s.bloom === '1st'));
}

async function joinRoom(role) {
    const rid = document.getElementById('roomIdInput').value;
    if (!rid) return alert("Required");
    myRole = role; socket.emit('joinRoom', { roomId: rid, role });
    showPage(''); document.getElementById('status').innerText = `Room: ${rid}${role==='spectator'?' (観戦)':''}`;
    if (role === 'player') document.getElementById('setup-modal').style.display = 'flex';
    else document.body.classList.add('spectator-mode');
}
document.getElementById('joinPlayerBtn').onclick = () => joinRoom('player');
document.getElementById('joinSpectatorBtn').onclick = () => joinRoom('spectator');
document.getElementById('startGameBtn').onclick = () => { socket.emit('setGame', { main: mainDeckList, cheer: cheerDeckList, oshi: selectedOshi }); showPage(''); };

// --- Socket受信 ---
socket.on('gameStarted', (d) => { field.querySelectorAll('.card').forEach(c => c.remove()); handDiv.innerHTML = ""; for (const id in d.fieldState) restoreCard(id, d.fieldState[id]); repositionCards(); });
socket.on('init', (d) => { field.querySelectorAll('.card').forEach(c => c.remove()); for (const id in d.fieldState) restoreCard(id, d.fieldState[id]); repositionCards(); });
socket.on('deckCount', (c) => { 
    const m = document.getElementById('mainCount'), ch = document.getElementById('cheerCount');
    if(m) m.innerText = c.main; if(ch) ch.innerText = c.cheer;
});
socket.on('cardMoved', (d) => { 
    let el = document.getElementById(d.id); if (!el) return restoreCard(d.id, d);
    el.dataset.zoneId = d.zoneId || ""; el.style.zIndex = d.zIndex; if (el.parentElement !== field) field.appendChild(el);
    el.classList.toggle('rotated', !!d.isRotated); repositionCards();
});
socket.on('cardRemoved', (d) => { const el = document.getElementById(d.id); if (el) el.remove(); });
socket.on('cardFlipped', (d) => { const el = document.getElementById(d.id); if (el) { el.classList.toggle('face-up', d.isFaceUp); el.classList.toggle('face-down', !d.isFaceUp); } });
