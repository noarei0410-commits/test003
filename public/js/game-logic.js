/**
 * カードDOMの生成
 */
function createCardElement(data, withEvents = true) {
    if (!data) return document.createElement('div');
    const el = document.createElement('div'); el.id = data.id || ""; el.className = 'card';
    
    if ((data.type === 'holomen' || data.type === 'oshi') && data.color) {
        const colorKey = COLORS[data.color] || 'white';
        el.classList.add('border-' + colorKey);
    }

    const nameSpan = document.createElement('span'); nameSpan.innerText = data.name || ""; el.appendChild(nameSpan);
    el.classList.add(data.isFaceUp !== false ? 'face-up' : 'face-down');
    if (data.isRotated) el.classList.add('rotated');

    if (data.type === 'holomen' || data.type === 'oshi') {
        const currentHp = data.currentHp !== undefined ? data.currentHp : data.hp;
        const hpDiv = document.createElement('div'); hpDiv.className = 'card-hp'; hpDiv.id = `hp-display-${data.id}`; hpDiv.innerText = currentHp || data.life || ""; el.appendChild(hpDiv);
        if (data.bloom) { const blDiv = document.createElement('div'); blDiv.className = 'card-bloom'; blDiv.innerText = data.bloom.charAt(0); el.appendChild(blDiv); }
        if (data.color) { const clDiv = document.createElement('div'); clDiv.className = 'card-color-icon'; const colorCode = COLORS[data.color] || 'white'; clDiv.style.background = colorCode; el.appendChild(clDiv); }
        if (data.baton !== undefined) { const batonDiv = document.createElement('div'); batonDiv.className = 'card-baton'; for(let i=0; i<data.baton; i++) { const dot = document.createElement('div'); dot.className='baton-dot'; batonDiv.appendChild(dot); } el.appendChild(batonDiv); }
    }
    if (data.type === 'ayle') { for (let k in COLORS) { if (data.name.includes(k)) el.classList.add(`ayle-${COLORS[k]}`); } }
    el.cardData = data;
    if (withEvents) setupCardEvents(el);
    return el;
}

/**
 * フィールド再配置
 */
function repositionCards() {
    const fieldEl = document.getElementById('field'); if (!fieldEl) return;
    const fRect = fieldEl.getBoundingClientRect();
    const counts = {};

    document.querySelectorAll('.card').forEach(card => {
        if (card.parentElement !== fieldEl || currentStack.includes(card)) return;
        const zid = card.dataset.zoneId;
        if (zid) {
            const z = document.getElementById(zid);
            if (z) {
                const zr = z.getBoundingClientRect();
                if (!counts[zid]) counts[zid] = 0;
                let targetLeft = (zr.left - fRect.left) + (zr.width - 58) / 2;
                let targetTop = (zr.top - fRect.top) + (zr.height - 82) / 2;
                if (zid === 'life-zone') targetTop = (zr.top - fRect.top) + 15 + (counts[zid] * 30);
                else if (['holopower', 'archive'].includes(zid)) { targetLeft += counts[zid] * 2; targetTop += counts[zid] * 2; }
                card.style.left = targetLeft + 'px'; card.style.top = targetTop + 'px';
                counts[zid]++;
            }
        }
    });
}

/**
 * カードイベント設定
 */
function setupCardEvents(el) {
    el.onpointerdown = (e) => {
        startX = e.clientX; startY = e.clientY; potentialZoomTarget = el;
        if (myRole === 'spectator' || el.dataset.zoneId === 'archive') return;
        isDragging = true; dragStarted = false; currentDragEl = el; el.setPointerCapture(e.pointerId); el.oldZoneId = el.dataset.zoneId || "";
        currentStack = (el.dataset.zoneId) ? Array.from(document.querySelectorAll('.card')).filter(c => c.dataset.zoneId === el.dataset.zoneId) : [el];
        currentStack.sort((a,b) => (parseInt(a.style.zIndex)||0)-(parseInt(b.style.zIndex)||0));
        const rect = el.getBoundingClientRect(); offsetX = e.clientX - rect.left; offsetY = e.clientY - rect.top; e.stopPropagation();
    };
}

document.onpointermove = (e) => {
    if (!isDragging || !currentDragEl) return;
    const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
    if (!dragStarted && dist > 10) {
        dragStarted = true;
        currentStack.forEach(card => {
            maxZIndex++; card.style.zIndex = maxZIndex;
            if (card.parentElement !== field) { const r = card.getBoundingClientRect(), fr = field.getBoundingClientRect(); card.style.position = 'absolute'; card.style.left = (r.left - fr.left) + 'px'; card.style.top = (r.top - fr.top) + 'px'; field.appendChild(card); }
        });
    }
    if (dragStarted) {
        const fr = field.getBoundingClientRect();
        currentStack.forEach(card => {
            if (card === currentDragEl) { card.style.left = (e.clientX - fr.left - offsetX) + 'px'; card.style.top = (e.clientY - fr.top - offsetY) + 'px'; }
            else { if (!card.dataset.stackOffset) { const lR = currentDragEl.getBoundingClientRect(), cR = card.getBoundingClientRect(); card.dataset.stackOffset = JSON.stringify({ x: cR.left - lR.left, y: cR.top - lR.top }); } const off = JSON.parse(card.dataset.stackOffset); card.style.left = (parseFloat(currentDragEl.style.left) + off.x) + 'px'; card.style.top = (parseFloat(currentDragEl.style.top) + off.y) + 'px'; }
        });
    }
};

document.onpointerup = (e) => {
    const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
    if (potentialZoomTarget && dist < 10) { openZoom(potentialZoomTarget.cardData, potentialZoomTarget); }
    if (isDragging && currentDragEl && dragStarted) {
        const hRect = handDiv.getBoundingClientRect();
        if (e.clientX > hRect.left && e.clientX < hRect.right && e.clientY > hRect.top && e.clientY < hRect.bottom) { currentStack.forEach(c => returnToHand(c)); }
        else {
            const elementsUnder = document.elementsFromPoint(e.clientX, e.clientY);
            const target = elementsUnder.find(el => el.classList.contains('card') && !currentStack.includes(el));
            if (target && target.parentElement === field) {
                if (canBloom(currentDragEl.cardData, target.cardData)) { const damage = parseInt(target.cardData.hp || 0) - parseInt(target.cardData.currentHp || target.cardData.hp || 0); currentDragEl.cardData.currentHp = Math.max(0, parseInt(currentDragEl.cardData.hp) - damage); }
                currentStack.forEach(c => { c.style.left = target.style.left; c.style.top = target.style.top; c.dataset.zoneId = target.dataset.zoneId || ""; const isBase = ['holomen', 'oshi'].includes(c.cardData.type); c.style.zIndex = isBase ? target.style.zIndex : parseInt(target.style.zIndex) - 1; socket.emit('moveCard', { id: c.id, ...c.cardData, zoneId: c.dataset.zoneId, zIndex: c.style.zIndex, currentHp: c.cardData.currentHp }); });
            } else { normalSnapStack(e); }
        }
    }
    if (currentDragEl && e.pointerId !== undefined) currentDragEl.releasePointerCapture(e.pointerId);
    isDragging = false; dragStarted = false; currentDragEl = null; currentStack = []; repositionCards();
};

function normalSnapStack(e) {
    const zones = document.querySelectorAll('.zone'); let closest = null, minDist = 40;
    const cr = currentDragEl.getBoundingClientRect(), cc = { x: cr.left + cr.width/2, y: cr.top + cr.height/2 };
    zones.forEach(z => { const zr = z.getBoundingClientRect(), zc = { x: zr.left + zr.width/2, y: zr.top + zr.height/2 }; const d = Math.hypot(cc.x - zc.x, cc.y - zc.y); if (d < minDist) { minDist = d; closest = z; } });
    if (closest) {
        if (currentDragEl.oldZoneId && currentDragEl.oldZoneId.startsWith('back') && closest.id === 'collab') socket.emit('generateHoloPower');
        currentStack.forEach(c => {
            c.dataset.zoneId = closest.id; delete c.dataset.percentX;
            if (closest.id === 'archive') { c.classList.remove('rotated', 'face-down'); c.classList.add('face-up'); socket.emit('moveCard', { id: c.id, ...c.cardData, zoneId: 'archive', isRotated: false, isFaceUp: true, zIndex: 10 }); }
            else { const rotate = ['life-zone', 'holopower'].includes(closest.id); c.classList.toggle('rotated', rotate); socket.emit('moveCard', { id: c.id, ...c.cardData, zoneId: closest.id, isRotated: rotate, zIndex: c.style.zIndex }); }
        });
    } else { const fr = field.getBoundingClientRect(); currentStack.forEach(c => { delete c.dataset.zoneId; const px = (parseFloat(c.style.left)/fr.width)*100, py = (parseFloat(c.style.top)/fr.height)*100; socket.emit('moveCard', { id: c.id, ...c.cardData, percentX: px, percentY: py, zIndex: c.style.zIndex }); }); }
}

/**
 * 拡大表示 (HP操作ボタン配置変更とライン被り修正対応)
 */
function openZoom(cardData, cardElement = null) {
    if (!cardData || (cardElement && cardElement.classList.contains('face-down') && cardElement.dataset.zoneId === 'life-zone')) return;
    
    const zoomOuter = document.getElementById('zoom-outer');
    const contentInner = document.querySelector('.zoom-content-inner');
    if (!zoomOuter || !contentInner) return;

    const isSpec = (myRole === 'spectator');
    
    zoomOuter.className = 'zoom-outer-container';
    if (cardData.color) { zoomOuter.classList.add('border-' + (COLORS[cardData.color] || 'white')); }

    let attachedAyles = [];
    if (cardElement && cardElement.parentElement === field) {
        const r = cardElement.getBoundingClientRect();
        attachedAyles = Array.from(document.querySelectorAll('.card')).filter(c => c !== cardElement && c.cardData.type === 'ayle').filter(c => { const cr = c.getBoundingClientRect(); return Math.abs(cr.left - r.left) < 10 && Math.abs(cr.top - r.top) < 10; }).map(c => c.cardData);
    }

    // HP操作ボタンのHTMLを生成 (プレイヤーかつホロメンの場合のみ)
    const hpControlsHtml = (!isSpec && cardData.type === 'holomen') ? `
        <div class="zoom-hp-controls-inline">
            <button class="btn-zoom-hp-inline minus" onclick="changeHp('${cardData.id}', -10)">-</button>
            <button class="btn-zoom-hp-inline plus" onclick="changeHp('${cardData.id}', 10)">+</button>
        </div>` : "";

    const skillsHtml = (cardData.skills || []).map((s) => {
        const costIconsHtml = (s.cost || []).map(c => { const colorCode = c === 'any' ? '#ddd' : (COLORS[c] || c); return `<div class="cost-dot-small" style="background: ${colorCode};"></div>`; }).join('');
        const isReady = canUseArt(s.cost, attachedAyles);
        const readyBadge = isReady ? `<span class="ready-badge">READY</span>` : "";
        return `
            <div class="skill-box">
                <div class="skill-top-row">
                    <div class="skill-cost-container-row">${costIconsHtml}</div>
                    <div class="skill-name-container-center"><span class="skill-name-text">${s.name}</span>${readyBadge}</div>
                    <div class="skill-damage-text">${s.damage || ""}</div>
                </div>
                <div class="skill-text-detail">${s.text || ""}</div>
            </div>`;
    }).join('');

    const colorCode = COLORS[cardData.color] || 'white';
    const batonIcons = Array(cardData.baton || 0).fill('<div class="baton-dot-large"></div>').join('');
    const extraHtml = cardData.extra ? `<div class="zoom-extra-area"><span class="extra-label">エクストラ：</span>${cardData.extra}</div>` : "";

    contentInner.innerHTML = `
        <div class="zoom-bloom-rank">${cardData.bloom || ""}</div>
        <div class="zoom-name-center">${cardData.name}</div>
        <div class="zoom-top-right-group">
            <div class="zoom-color-icon-large" style="background: ${colorCode};"></div>
            <div class="zoom-hp-container-row">
                ${hpControlsHtml}
                <div class="zoom-hp-display" id="zoom-hp-val">HP ${cardData.currentHp || cardData.hp || cardData.life || 0}</div>
            </div>
        </div>
        <div class="zoom-main-content">${skillsHtml}</div>
        <div class="zoom-bottom-left-group">
            <div class="zoom-tags-row">${(cardData.tags || []).map(t => `<span>#${t}</span>`).join(' ')}</div>
            <div class="zoom-baton-row"><span>バトンタッチ:</span><div class="baton-icon-list">${batonIcons}</div></div>
        </div>
        ${extraHtml}
    `;

    zoomModal.style.display = 'flex';
    zoomModal.onclick = (e) => { if (e.target === zoomModal) zoomModal.style.display = 'none'; };
}

function canUseArt(costArray, attachedAyles) {
    if (!costArray || costArray.length === 0) return true;
    let available = attachedAyles.reduce((acc, c) => { for (let kanji in COLORS) { if (c.name && c.name.includes(kanji)) { acc[COLORS[kanji]] = (acc[COLORS[kanji]] || 0) + 1; break; } } return acc; }, {});
    let reqSpecific = costArray.filter(c => c !== 'any'), reqAny = costArray.filter(c => c === 'any').length;
    for (let color of reqSpecific) { if (available[color] && available[color] > 0) available[color]--; else return false; }
    return Object.values(available).reduce((sum, v) => sum + v, 0) >= reqAny;
}

window.changeHp = (id, amt) => {
    const el = document.getElementById(id); if(!el) return;
    let current = parseInt(el.cardData.currentHp || el.cardData.hp || 0);
    let newVal = Math.max(0, current + amt);
    el.cardData.currentHp = newVal;
    const valDisplay = document.getElementById('zoom-hp-val'); if (valDisplay) valDisplay.innerText = `HP ${newVal}`;
    const fieldHp = document.getElementById(`hp-display-${id}`); if (fieldHp) fieldHp.innerText = newVal;
    socket.emit('updateHp', { id, currentHp: newVal });
};

function returnToHand(card) {
    card.style.position = 'relative'; card.style.left = ''; card.style.top = ''; 
    card.classList.remove('rotated', 'face-down'); card.classList.add('face-up');
    delete card.dataset.zoneId; delete card.dataset.percentX; handDiv.appendChild(card);
    socket.emit('returnToHand', { id: card.id });
}

function canBloom(s, t) { if (s.type !== 'holomen' || t.type !== 'holomen' || s.name !== t.name) return false; return (t.bloom === 'Debut' && s.bloom === '1st') || (t.bloom === '1st' && (s.bloom === '2nd' || s.bloom === '1st')); }
