function createCardElement(data, withEvents = true) {
    if(!data) return document.createElement('div');
    const el = document.createElement('div'); el.id = data.id || ""; el.innerText = data.name; el.className = 'card';
    el.classList.add(data.isFaceUp !== false ? 'face-up' : 'face-down');
    if (data.isRotated) el.classList.add('rotated');
    if (data.type === 'holomen' || data.type === 'oshi') {
        const hp = document.createElement('div'); hp.className = 'card-hp'; hp.innerText = data.hp || '';
        const bl = document.createElement('div'); bl.className = 'card-bloom'; bl.innerText = (data.bloom || 'D').charAt(0);
        el.appendChild(hp); el.appendChild(bl);
        if (data.color) { const ci = document.createElement('div'); ci.className = `card-color-icon color-${data.color}`; el.appendChild(ci); }
    }
    el.cardData = data;
    if (withEvents) setupCardEvents(el);
    return el;
}

function repositionCards() {
    const fRect = field.getBoundingClientRect();
    const zoneCounts = {};
    document.querySelectorAll('.card').forEach(card => {
        if (card.parentElement !== field || card === currentDragEl) return;
        const zid = card.dataset.zoneId;
        if (zid) {
            const z = document.getElementById(zid);
            if(z) {
                const zr = z.getBoundingClientRect(), cr = card.getBoundingClientRect();
                if (!zoneCounts[zid]) zoneCounts[zid] = 0;
                const off = zid === 'life-zone' ? zoneCounts[zid] * 18 : 0;
                card.style.left = (zr.left - fRect.left) + (zr.width - cr.width) / 2 + 'px';
                card.style.top = (zr.top - fRect.top) + 5 + off + 'px';
                zoneCounts[zid]++;
            }
        }
    });
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
            el.style.position = 'absolute'; el.style.left = (rect.left - fRect.left) + 'px'; el.style.top = (rect.top - fRect.top) + 'px'; field.appendChild(el); 
        }
        e.stopPropagation();
    };
}

document.onpointermove = (e) => { if (!isDragging || !currentDragEl) return; const fr = field.getBoundingClientRect(); currentDragEl.style.left = (e.clientX - fr.left - offsetX) + 'px'; currentDragEl.style.top = (e.clientY - fr.top - offsetY) + 'px'; };
document.onpointerup = (e) => {
    const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
    // 指を離した際、移動距離が小さければ詳細表示
    if (potentialZoomTarget && dist < 15) openZoom(potentialZoomTarget.cardData, potentialZoomTarget);
    
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
    socket.emit('flipCard', { id: card.id, isFaceUp: true }); 
    socket.emit('moveCard', { id: card.id, isRotated: false, isFaceUp: true }); 
    socket.emit('returnToHand', { id: card.id });
}

function canBloom(s, t) {
    if (s.type !== 'holomen' || t.type !== 'holomen' || s.name !== t.name) return false;
    return (t.bloom === 'Debut' && s.bloom === '1st') || (t.bloom === '1st' && (s.bloom === '2nd' || s.bloom === '1st'));
}

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

// 修正: 詳細画面を開く処理と背景クリックで閉じるロジックの統合
function openZoom(cardData, cardElement = null) {
    if (!cardData || (cardElement && cardElement.classList.contains('face-down') && cardElement.dataset.zoneId === 'life-zone')) return;
    const container = document.querySelector('.zoom-container');
    const isOshi = (cardData.type === 'oshi'), isHolomen = (cardData.type === 'holomen');
    let stackAyle = [], stackUnder = [];
    
    if (!isOshi && cardElement && cardElement.parentElement === field) {
        const r = cardElement.getBoundingClientRect();
        const stack = Array.from(document.querySelectorAll('.card')).filter(c => c !== cardElement).filter(c => {
            const cr = c.getBoundingClientRect();
            return Math.abs(cr.left - r.left) < 10 && Math.abs(cr.top - r.top) < 10;
        });
        stackAyle = stack.filter(c => c.cardData.type === 'ayle');
        stackUnder = stack.filter(c => c.cardData.type === 'holomen' && c.cardData.name === cardData.name);
    }

    let skillsHtml = (cardData.skills || []).map(s => {
        let labelTxt = s.type === 'sp_oshi' ? 'SP OSHI' : s.type.toUpperCase();
        let ready = (s.type === 'arts' && canUseArt(s.cost, stackAyle.map(e => e.cardData))) ? `<span class="ready-badge">READY</span>` : "";
        let costHtml = (s.type === 'arts') ? `<div class="cost-container">${(s.cost || []).map(c => `<div class="cost-icon color-${c}"></div>`).join('')}</div>` : `<span class="skill-cost-hp">ホロパワー：-${s.cost || 0}</span>`;
        return `<div class="skill-item"><div class="skill-header"><div class="skill-type-label label-${s.type}">${labelTxt}</div>${costHtml}<div class="skill-name">${s.name}${ready}</div></div><div class="skill-text">${s.text || ''}</div></div>`;
    }).join('');

    let underHtml = stackUnder.length ? `<div class="zoom-under-section"><span class="section-title">進化前</span>${stackUnder.map(u => `<div class="ayle-list-item"><span>● ${u.cardData.bloom}</span></div>`).join('')}</div>` : "";
    let hpLife = isOshi ? `<div class="zoom-life">LIFE ${cardData.life || 0}</div>` : (isHolomen ? `<div class="zoom-hp">HP ${cardData.hp || 0}</div>` : "");

    container.innerHTML = `<div class="zoom-header"><div><b>${cardData.name}</b></div>${hpLife}</div><div class="zoom-skills-list">${skillsHtml}</div>${underHtml}`;
    zoomModal.style.display = 'flex';

    // 背景をクリックした際に閉じるイベントを設定
    zoomModal.onclick = (e) => {
        if (e.target === zoomModal) {
            zoomModal.style.display = 'none';
        }
    };
}
