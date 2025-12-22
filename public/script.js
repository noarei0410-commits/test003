const socket = io();

let MASTER_CARDS = [], OSHI_LIST = [], AYLE_MASTER = [];
let mainDeckList = [], cheerDeckList = [], selectedOshi = null;
let myRole = 'spectator', currentCard = null, isDragging = false;
let startX = 0, startY = 0, offsetX = 0, offsetY = 0, maxZIndex = 1000;
let originalNextSibling = null, potentialZoomTarget = null;
let currentFilter = 'all';

const field = document.getElementById('field');
const handDiv = document.getElementById('hand');
const setupModal = document.getElementById('setup-modal');
const zoomModal = document.getElementById('zoom-modal');
const archiveModal = document.getElementById('archive-modal');
const archiveGrid = document.getElementById('archive-card-grid');
const deckModal = document.getElementById('deck-inspection-modal');
const deckGrid = document.getElementById('deck-card-grid');

// --- 画面遷移管理 ---
function showPage(pageId) {
    document.querySelectorAll('.full-page').forEach(p => p.style.display = 'none');
    const target = document.getElementById(pageId);
    if (target) target.style.display = 'flex';
    if (pageId === 'card-list-page') filterLibrary('all');
}
window.onload = loadCardData;

// --- デッキ内サーチ ---
function openDeckInspection(type) {
    if (myRole !== 'player') return;
    socket.emit('inspectDeck', type);
}
socket.on('deckInspectionResult', (data) => {
    const { type, cards } = data;
    deckGrid.innerHTML = "";
    document.getElementById('inspection-title').innerText = (type === 'main' ? 'Main Deck' : 'Cheer Deck') + ` (${cards.length})`;
    if (cards.length === 0) deckGrid.innerHTML = "<p style='width:100%; text-align:center; color:#aaa;'>空です</p>";
    else {
        cards.forEach(card => {
            const container = document.createElement('div'); container.className = "archive-item";
            const el = createCardElement(card, false); el.classList.remove('face-down'); el.classList.add('face-up');
            const pickBtn = document.createElement('button'); pickBtn.className = "btn-recover"; pickBtn.innerText = "手札に加える";
            pickBtn.onclick = () => { socket.emit('pickCardFromDeck', { type, cardId: card.id }); closeDeckInspection(); };
            container.appendChild(el); container.appendChild(pickBtn); deckGrid.appendChild(container);
        });
    }
    deckModal.style.display = 'flex';
});
function closeDeckInspection() { deckModal.style.display = 'none'; }

// --- アーカイブ ---
function openArchive() {
    archiveGrid.innerHTML = "";
    const archiveCards = Array.from(document.querySelectorAll('#field > .card')).filter(c => c.dataset.zoneId === 'archive');
    if (archiveCards.length === 0) archiveGrid.innerHTML = "<p style='width:100%; text-align:center; color:#aaa; font-size:12px;'>空です</p>";
    else {
        archiveCards.forEach(card => {
            const container = document.createElement('div'); container.className = "archive-item";
            const el = createCardElement(card.cardData, false); el.classList.remove('face-down'); el.classList.add('face-up');
            if (myRole === 'player') {
                const recoverBtn = document.createElement('button'); recoverBtn.className = "btn-recover"; recoverBtn.innerText = "手札へ";
                recoverBtn.onclick = (e) => { e.stopPropagation(); returnToHand(card); closeArchive(); };
                container.appendChild(el); container.appendChild(recoverBtn);
            } else container.appendChild(el);
            archiveGrid.appendChild(container);
        });
    }
    archiveModal.style.display = 'flex';
}
function closeArchive() { archiveModal.style.display = 'none'; }

// --- ライブラリ・フィルタ ---
function filterLibrary(type) {
    currentFilter = type;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('onclick').includes(`'${type}'`));
    });
    const grid = document.getElementById('global-card-grid'); if (!grid) return;
    grid.innerHTML = "";
    let list = (type === 'oshi') ? OSHI_LIST : (type === 'all' ? MASTER_CARDS : MASTER_CARDS.filter(c => c.type === type));
    list.forEach(card => {
        const el = createCardElement(card, false); el.onclick = () => openZoom(card, el); grid.appendChild(el);
    });
}

// --- ズーム機能 & スタックスキャン ---
function canUseArt(costRequired, attachedAyles) {
    if (!costRequired || costRequired.length === 0) return true;
    let available = attachedAyles.reduce((acc, c) => {
        const colors = { '白': 'white', '緑': 'green', '赤': 'red', '青': 'blue', '黄': 'yellow', '紫': 'purple' };
        for (let k in colors) if (c.name.includes(k)) { acc[colors[k]] = (acc[colors[k]] || 0) + 1; break; }
        return acc;
    }, {});
    let specificCosts = costRequired.filter(c => c !== 'any'), anyCount = costRequired.filter(c => c === 'any').length;
    for (let color of specificCosts) { if (available[color] && available[color] > 0) available[color]--; else return false; }
    return Object.values(available).reduce((a, b) => a + b, 0) >= anyCount;
}

function openZoom(cardData, cardElement = null) {
    if (!cardData) return;
    const container = document.querySelector('.zoom-container');
    const isOshi = OSHI_LIST.some(o => o.name === cardData.name);
    const isHolomen = cardData.type === 'holomen' && !isOshi;
    
    let attachedAyles = [], attachedEquips = [], attachedUnderBlooms = [];
    if (isHolomen && cardElement && cardElement.parentElement === field) {
        const rect = cardElement.getBoundingClientRect();
        const stack = Array.from(document.querySelectorAll('.card')).filter(c => c !== cardElement).filter(c => {
            const r = c.getBoundingClientRect();
            return Math.abs(r.left - rect.left) < 10 && Math.abs(r.top - rect.top) < 10;
        });
        attachedAyles = stack.filter(c => c.cardData.type === 'ayle');
        attachedEquips = stack.filter(c => c.cardData.type === 'support' && ['tool', 'mascot', 'fan'].includes((c.cardData.category || '').toLowerCase()));
        attachedUnderBlooms = stack.filter(c => c.cardData.type === 'holomen' && c.cardData.name === cardData.name);
    }

    let tagsHtml = (cardData.tags || []).map(t => `<span class="tag-badge">${t}</span>`).join('');
    let skillsHtml = '', ayleListHtml = '', equipListHtml = '', underListHtml = '', batonHtml = '';
    let topLabel = isHolomen ? (cardData.bloom || 'Debut') : (isOshi ? 'OSHI' : cardData.type.toUpperCase());
    if (cardData.type === 'support' && cardData.category) topLabel = cardData.category.toUpperCase();

    if (isHolomen) {
        skillsHtml = (cardData.skills || []).map(s => {
            let h = '', d = s.damage ? `<span class="skill-damage">${s.damage}</span>` : '', ready = "";
            if (s.type === 'arts') {
                const iconHtml = (s.cost || []).map(c => `<div class="cost-icon color-${c}"></div>`).join('');
                if (canUseArt(s.cost, attachedAyles.map(e => e.cardData))) ready = `<span class="ready-badge">READY</span>`;
                h = `<div class="skill-type-label label-arts">Arts</div><div class="cost-container">${iconHtml}</div><div class="skill-name">${s.name}${ready}</div>${d}`;
            } else { h = `<div class="skill-type-label label-${s.type}">${s.type}</div><div class="skill-name">${s.name}</div>`; }
            return `<div class="skill-item"><div class="skill-header">${h}</div><div class="skill-text">${s.text || ''}</div></div>`;
        }).join('');

        if (attachedUnderBlooms.length > 0) {
            underListHtml = `<div class="zoom-under-section"><span class="section-title">進化前のカード</span>`;
            attachedUnderBlooms.forEach(u => { underListHtml += `<div class="ayle-list-item"><span>● ${u.cardData.name} [${u.cardData.bloom}]</span><button class="btn-discard-ayle" onclick="discardFromZoom('${u.id}')">破棄</button></div>`; });
            underListHtml += `</div>`;
        }
        if (attachedEquips.length > 0) {
            equipListHtml = `<div class="zoom-equip-section"><span class="section-title">装備中のカード</span>`;
            attachedEquips.forEach(e => { equipListHtml += `<div class="ayle-list-item"><div><b>${e.cardData.name}</b><br><small>${e.cardData.text || ''}</small></div><button class="btn-discard-ayle" onclick="discardFromZoom('${e.id}')">破棄</button></div>`; });
            equipListHtml += `</div>`;
        }
        if (attachedAyles.length > 0) {
            ayleListHtml = `<div class="zoom-ayle-section"><span class="section-title">付いているエール</span>`;
            attachedAyles.forEach(a => { ayleListHtml += `<div class="ayle-list-item"><span>● ${a.cardData.name}</span><button class="btn-discard-ayle" onclick="discardFromZoom('${a.id}')">破棄</button></div>`; });
            ayleListHtml += `</div>`;
        }
        const bIcons = Array(Number(cardData.baton) || 0).fill('<div class="baton-icon"></div>').join('');
        if (cardData.baton > 0) batonHtml = `<div class="baton-wrapper"><span class="baton-label">バトンタッチ:</span><div class="baton-icons-container">${bIcons}</div></div>`;
    } else if (cardData.type === 'support') skillsHtml = `<div class="skill-item"><div class="skill-text">${cardData.text || ''}</div></div>`;

    container.innerHTML = `
        <div class="zoom-header"><div><div class="zoom-bloom">${topLabel}</div><div class="zoom-name">${cardData.name}</div></div><div class="zoom-hp">${isHolomen && cardData.hp ? 'HP ' + cardData.hp : ''}</div></div>
        <div class="zoom-skills-list">${skillsHtml}</div>
        ${underListHtml} ${equipListHtml} ${ayleListHtml}
        <div class="zoom-tags">${tagsHtml}</div>
        <div class="zoom-footer">${batonHtml}</div>
    `;
    zoomModal.style.display = 'flex';
}

window.discardFromZoom = (cardId) => {
    const el = document.getElementById(cardId); if (!el) return;
    socket.emit('moveCard', { id: cardId, zoneId: 'archive', zIndex: 10, ...el.cardData });
    el.dataset.zoneId = 'archive'; repositionCards(); zoomModal.style.display = 'none';
};
zoomModal.onclick = (e) => { if (e.target === zoomModal || e.target.classList.contains('zoom-hint-outside')) zoomModal.style.display = 'none'; };

// --- 再配置 (座標ズレ修正版) ---
function repositionCards() {
    const fRect = field.getBoundingClientRect();
    document.querySelectorAll('.card').forEach(card => {
        if (card.parentElement !== field || card === currentDragEl) return; 
        if (card.dataset.zoneId) {
            const zone = document.getElementById(card.dataset.zoneId);
            if (zone) {
                const zr = zone.getBoundingClientRect();
                const cr = card.getBoundingClientRect();
                // フィールド内の相対位置を正確に中央へ
                card.style.left = (zr.left - fRect.left) + (zr.width - cr.width) / 2 + 'px';
                card.style.top = (zr.top - fRect.top) + (zr.height - cr.height) / 2 + 'px';
            }
        } else if (card.dataset.percentX) {
            card.style.left = (card.dataset.percentX / 100) * fRect.width + 'px';
            card.style.top = (card.dataset.percentY / 100) * fRect.height + 'px';
        }
    });
}
let currentDragEl = null;
window.addEventListener('resize', repositionCards);

// --- データ読み込み ---
async function loadCardData() {
    try {
        const [h, s, a, o] = await Promise.all([fetch('/data/holomen.json'), fetch('/data/support.json'), fetch('/data/ayle.json'), fetch('/data/oshi_holomen.json')]);
        MASTER_CARDS = [...await h.json(), ...await s.json(), ...await a.json()];
        OSHI_LIST = await o.json(); AYLE_MASTER = MASTER_CARDS.filter(c => c.type === 'ayle');
        updateLibrary(); renderDecks();
    } catch (e) { console.error(e); }
}

async function joinRoom(role) {
    const rid = document.getElementById('roomIdInput').value;
    if (!rid) return alert("Required");
    myRole = role; socket.emit('joinRoom', { roomId: rid, role });
    showPage(''); document.getElementById('status').innerText = `Room: ${rid}${role==='spectator'?' (観戦)':''}`;
    if (role === 'player') setupModal.style.display = 'flex';
    else document.body.classList.add('spectator-mode');
}
document.getElementById('joinPlayerBtn').onclick = () => joinRoom('player');
document.getElementById('joinSpectatorBtn').onclick = () => joinRoom('spectator');

function updateLibrary(f = "") {
    const list = document.getElementById('libraryList'); if(!list) return;
    list.innerHTML = "";
    MASTER_CARDS.filter(c => c.name.includes(f) && c.type !== 'ayle').concat(OSHI_LIST.filter(c => c.name.includes(f))).forEach(card => {
        const div = document.createElement('div'); div.className = "library-item";
        const isOshi = OSHI_LIST.some(o => o.name === card.name);
        const typeInfo = card.bloom || card.category || (isOshi ? "OSHI" : "");
        div.innerHTML = `<span>${card.name}${typeInfo?' ['+typeInfo+']':''}</span><button class="btn-add">${isOshi?'設定':'追加'}</button>`;
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
function removeFromDeck(key) {
    const idx = mainDeckList.findIndex(c => `${c.name}_${c.bloom || c.category || ""}` === key);
    if (idx !== -1) mainDeckList.splice(idx, 1);
    renderDecks();
}
function removeAyleFromDeck(name) {
    const idx = cheerDeckList.findIndex(c => c.name === name);
    if (idx !== -1) cheerDeckList.splice(idx, 1);
    renderDecks();
}
function renderDecks() {
    const oSum = document.getElementById('oshiSummary'), mSum = document.getElementById('mainDeckSummary'), cSum = document.getElementById('cheerDeckSummary');
    if (!oSum) return;
    oSum.innerHTML = selectedOshi ? `<div class="deck-item"><span>${selectedOshi.name}</span><button class="btn-remove">X</button></div>` : "";
    if (selectedOshi) oSum.querySelector('button').onclick = () => { selectedOshi = null; renderDecks(); };
    mSum.innerHTML = "";
    const gMain = mainDeckList.reduce((acc, c) => { 
        const key = `${c.name}_${c.bloom || c.category || ""}`;
        acc[key] = (acc[key] || { d: c, n: 0 }); acc[key].n++; return acc; 
    }, {});
    Object.keys(gMain).forEach(key => {
        const item = gMain[key], div = document.createElement('div'); div.className = "deck-item";
        div.innerHTML = `<span>${item.d.name}${item.d.bloom||item.d.category?'('+ (item.d.bloom||item.d.category) +')':''} x${item.n}</span><button class="btn-minus">-</button>`;
        div.querySelector('button').onclick = () => removeFromDeck(key); mSum.appendChild(div);
    });
    cSum.innerHTML = "";
    AYLE_MASTER.forEach(card => {
        const count = cheerDeckList.filter(c => c.name === card.name).length;
        const div = document.createElement('div'); div.className = "deck-item";
        div.innerHTML = `<span>${card.name.charAt(0)}:${count}</span><div class="deck-item-controls"><button class="btn-minus">-</button><button class="btn-plus">+</button></div>`;
        div.querySelector('.btn-plus').onclick = () => addToDeck(card);
        div.querySelector('.btn-minus').onclick = () => removeAyleFromDeck(card.name);
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

// --- 同期 ---
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

let deckClickTimer = null;
const setupDeckClick = (id, type) => {
    const el = document.getElementById(id);
    el.onpointerdown = (e) => { deckClickTimer = setTimeout(() => { openDeckInspection(type); deckClickTimer = null; }, 500); };
    el.onpointerup = () => { if (deckClickTimer) { clearTimeout(deckClickTimer); deckClickTimer = null; if(myRole === 'player') socket.emit(type === 'main' ? 'drawMainCard' : 'drawCheerCard'); } };
};
setupDeckClick('main-deck-zone', 'main');
setupDeckClick('cheer-deck-zone', 'cheer');

function canBloom(sourceData, targetData) {
    if (sourceData.type !== 'holomen' || targetData.type !== 'holomen') return false;
    if (sourceData.name !== targetData.name) return false;
    const s = sourceData.bloom, t = targetData.bloom;
    return (t === 'Debut' && s === '1st') || (t === '1st' && (s === '2nd' || s === '1st'));
}

function createCardElement(data, withEvents = true) {
    const el = document.createElement('div'); el.id = data.id || ""; el.innerText = data.name; el.classList.add('card', 'face-up');
    const isOshi = OSHI_LIST.some(o => o.name === data.name);
    if (data.type === 'holomen' && !isOshi) {
        if (data.color) { const ci = document.createElement('div'); ci.className = `card-color-icon color-${data.color}`; el.appendChild(ci); }
        const hp = document.createElement('div'); hp.className = 'card-hp'; hp.innerText = data.hp || '';
        const bl = document.createElement('div'); bl.className = 'card-bloom'; bl.innerText = (data.bloom || 'Debut').charAt(0);
        el.appendChild(hp); el.appendChild(bl);
    }
    if (data.type === 'ayle' || data.name.includes('エール')) {
        const colors = { '白': 'white', '緑': 'green', '赤': 'red', '青': 'blue', '黄': 'yellow', '紫': 'purple' };
        for (let k in colors) if (data.name.includes(k)) { el.classList.add(`ayle-${colors[k]}`); break; }
    } else { el.classList.add(`type-${data.type}`); if (data.category) el.classList.add(`category-${data.category.toLowerCase()}`); }
    el.cardData = data; if (withEvents) setupCardEvents(el); return el;
}
function restoreCard(id, info) {
    const el = createCardElement({ id, ...info });
    el.dataset.zoneId = info.zoneId || ""; el.dataset.percentX = info.percentX || ""; el.dataset.percentY = info.percentY || "";
    el.style.position = 'absolute'; el.style.zIndex = info.zIndex;
    el.classList.toggle('face-up', info.isFaceUp !== false); el.classList.toggle('face-down', info.isFaceUp === false);
    field.appendChild(el);
}

function setupCardEvents(el) {
    el.addEventListener('dblclick', () => { if (myRole === 'spectator' || el.parentElement === handDiv) return; socket.emit('flipCard', { id: el.id, isFaceUp: !el.classList.contains('face-up') }); });
    el.onpointerdown = (e) => {
        startX = e.clientX; startY = e.clientY; potentialZoomTarget = el;
        if (el.parentElement === handDiv) originalNextSibling = el.nextElementSibling;
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

document.onpointermove = (e) => { if (!isDragging || !currentDragEl) return; const fRect = field.getBoundingClientRect(); currentDragEl.style.left = (e.clientX - fRect.left - offsetX) + 'px'; currentDragEl.style.top = (e.clientY - fRect.top - offsetY) + 'px'; };

document.onpointerup = (e) => {
    const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
    if (potentialZoomTarget && dist < 20) { if (!potentialZoomTarget.classList.contains('face-down')) openZoom(potentialZoomTarget.cardData, potentialZoomTarget); }
    if (myRole === 'spectator' || !isDragging || !currentDragEl) {
        if (!isDragging && potentialZoomTarget && potentialZoomTarget.parentElement === field && !potentialZoomTarget.dataset.zoneId && !potentialZoomTarget.dataset.percentX) returnToHand(potentialZoomTarget);
        isDragging = false; currentDragEl = null; potentialZoomTarget = null; return;
    }
    const hRect = handDiv.getBoundingClientRect();
    if (e.clientX > hRect.left && e.clientX < hRect.right && e.clientY > hRect.top && e.clientY < hRect.bottom) returnToHand(currentDragEl);
    else {
        const fRect = field.getBoundingClientRect();
        let moveData = { id: currentDragEl.id, ...currentDragEl.cardData, zIndex: currentDragEl.style.zIndex };
        const elementsUnder = document.elementsFromPoint(e.clientX, e.clientY);
        const targetCardEl = elementsUnder.find(el => el.classList.contains('card') && el !== currentDragEl);
        if (targetCardEl && targetCardEl.parentElement === field) {
            const isEquip = ['tool', 'mascot', 'fan'].includes((currentDragEl.cardData.category || '').toLowerCase());
            if ((currentDragEl.cardData.type === 'ayle' || isEquip) && targetCardEl.cardData.type === 'holomen') {
                currentDragEl.style.left = targetCardEl.style.left; currentDragEl.style.top = targetCardEl.style.top;
                currentDragEl.style.zIndex = parseInt(targetCardEl.style.zIndex) - 1; moveData.zIndex = currentDragEl.style.zIndex;
                if (targetCardEl.dataset.zoneId) currentDragEl.dataset.zoneId = targetCardEl.dataset.zoneId;
                moveData.zoneId = targetCardEl.dataset.zoneId || "";
            } else if (canBloom(currentDragEl.cardData, targetCardEl.cardData)) {
                currentDragEl.style.left = targetCardEl.style.left; currentDragEl.style.top = targetCardEl.style.top;
                if (targetCardEl.dataset.zoneId) currentDragEl.dataset.zoneId = targetCardEl.dataset.zoneId;
                moveData.zoneId = targetCardEl.dataset.zoneId || "";
            } else normalZoneSnap(e, moveData);
        } else normalZoneSnap(e, moveData);
        socket.emit('moveCard', moveData); repositionCards();
    }
    isDragging = false; currentDragEl = null; potentialZoomTarget = null;
};

function normalZoneSnap(e, moveData) {
    const zones = document.querySelectorAll('.zone'); let closest = null, minDist = 40;
    const cr = currentDragEl.getBoundingClientRect(), cc = { x: cr.left + cr.width/2, y: cr.top + cr.height/2 };
    zones.forEach(z => {
        const zr = z.getBoundingClientRect(), zc = { x: zr.left + zr.width/2, y: zr.top + zr.height/2 };
        const d = Math.hypot(cc.x - zc.x, cc.y - zc.y);
        if (d < minDist) { minDist = d; closest = z; }
    });
    if (closest) { currentDragEl.dataset.zoneId = closest.id; delete currentDragEl.dataset.percentX; moveData.zoneId = closest.id; }
    else { delete currentDragEl.dataset.zoneId; const pRect = field.getBoundingClientRect(); const pX = (parseFloat(currentDragEl.style.left) / pRect.width) * 100, pY = (parseFloat(currentDragEl.style.top) / pRect.height) * 100; currentDragEl.dataset.percentX = pX; currentDragEl.dataset.percentY = pY; moveData.percentX = pX; moveData.percentY = pY; }
}

function returnToHand(card) {
    card.style.position = 'relative'; card.style.left = ''; card.style.top = ''; card.style.zIndex = '';
    delete card.dataset.zoneId; delete card.dataset.percentX;
    if (originalNextSibling && originalNextSibling.parentElement === handDiv) handDiv.insertBefore(card, originalNextSibling);
    else handDiv.appendChild(card);
    socket.emit('returnToHand', { id: card.id });
}
