/**
 * カードDOMの生成 (デザイン再現)
 */
function createCardElement(data, withEvents = true) {
    if (!data) return document.createElement('div');
    const el = document.createElement('div'); el.id = data.id || ""; el.className = 'card';
    
    const nameSpan = document.createElement('span');
    nameSpan.innerText = data.name || ""; el.appendChild(nameSpan);

    el.classList.add(data.isFaceUp !== false ? 'face-up' : 'face-down');
    if (data.isRotated) el.classList.add('rotated');

    if (data.type === 'holomen' || data.type === 'oshi') {
        if (data.hp) {
            const hp = document.createElement('div'); hp.className = 'card-hp'; hp.innerText = data.hp; el.appendChild(hp);
        }
        if (data.bloom) {
            const bl = document.createElement('div'); bl.className = 'card-bloom'; bl.innerText = data.bloom.charAt(0); el.appendChild(bl);
        }
        if (data.color) {
            const ci = document.createElement('div'); ci.className = `card-color-icon color-${data.color}`; el.appendChild(ci);
        }
    }

    if (data.type === 'ayle' || (data.name && data.name.includes('エール'))) {
        for (let kanji in COLORS) {
            if (data.name.includes(kanji)) { el.classList.add(`ayle-${COLORS[kanji]}`); break; }
        }
    }

    el.cardData = data;
    if (withEvents) setupCardEvents(el);
    return el;
}

/**
 * カード再配置 (枠の中央に配置するロジックを最適化)
 */
function repositionCards() {
    const fieldEl = document.getElementById('field');
    if (!fieldEl) return;
    const fRect = fieldEl.getBoundingClientRect();
    const zoneCounts = {};

    document.querySelectorAll('.card').forEach(card => {
        // 手札にあるカードやドラッグ中のカードは除外
        if (card.parentElement !== fieldEl || card === currentDragEl) return;

        const zid = card.dataset.zoneId;
        if (zid) {
            const z = document.getElementById(zid);
            if(z) {
                const zr = z.getBoundingClientRect();
                const cr = card.getBoundingClientRect();
                
                if (!zoneCounts[zid]) zoneCounts[zid] = 0;

                // 中央配置の計算: (枠の左端 - フィールドの左端) + (枠の幅 - カードの幅) / 2
                let targetLeft = (zr.left - fRect.left) + (zr.width - cr.width) / 2;
                let targetTop = (zr.top - fRect.top) + (zr.height - cr.height) / 2;

                // ライフゾーンのみ、重なりを見せるために少しずつずらす
                if (zid === 'life-zone') {
                    const offset = zoneCounts[zid] * 18;
                    targetTop = (zr.top - fRect.top) + 5 + offset;
                }

                card.style.left = targetLeft + 'px';
                card.style.top = targetTop + 'px';
                
                zoneCounts[zid]++;
            }
        } else if (card.dataset.percentX) {
            // 自由配置の場合
            card.style.left = (card.dataset.percentX / 100) * fRect.width + 'px';
            card.style.top = (card.dataset.percentY / 100) * fRect.height + 'px';
        }
    });
}

/**
 * ドラッグ開始
 */
function setupCardEvents(el) {
    el.onpointerdown = (e) => {
        startX = e.clientX; startY = e.clientY; potentialZoomTarget = el;
        if (myRole === 'spectator') return;
        isDragging = true; currentDragEl = el; el.setPointerCapture(e.pointerId);
        const rect = el.getBoundingClientRect();
        const fieldEl = document.getElementById('field');
        const fRect = fieldEl.getBoundingClientRect();
        offsetX = e.clientX - rect.left; offsetY = e.clientY - rect.top;
        maxZIndex++; el.style.zIndex = maxZIndex;
        
        if (el.parentElement !== fieldEl) { 
            el.style.position = 'absolute'; 
            el.style.left = (rect.left - fRect.left) + 'px'; 
            el.style.top = (rect.top - fRect.top) + 'px'; 
            fieldEl.appendChild(el); 
        }
        e.stopPropagation();
    };
}

document.onpointermove = (e) => { 
    if (!isDragging || !currentDragEl) return; 
    const fieldEl = document.getElementById('field');
    const fr = fieldEl.getBoundingClientRect(); 
    currentDragEl.style.left = (e.clientX - fr.left - offsetX) + 'px'; 
    currentDragEl.style.top = (e.clientY - fr.top - offsetY) + 'px'; 
};

document.onpointerup = (e) => {
    const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
    if (potentialZoomTarget && dist < 15) openZoom(potentialZoomTarget.cardData, potentialZoomTarget);
    if (myRole === 'spectator' || !isDragging || !currentDragEl) { isDragging = false; currentDragEl = null; return; }
    
    const hRect = handDiv.getBoundingClientRect();
    if (e.clientX > hRect.left && e.clientX < hRect.right && e.clientY > hRect.top && e.clientY < hRect.bottom) {
        returnToHand(currentDragEl);
    } else {
        const elementsUnder = document.elementsFromPoint(e.clientX, e.clientY);
        const target = elementsUnder.find(el => el.classList.contains('card') && el !== currentDragEl);
        let moveData = { id: currentDragEl.id, ...currentDragEl.cardData, zIndex: currentDragEl.style.zIndex };
        
        const fieldEl = document.getElementById('field');
        if (target && target.parentElement === fieldEl) {
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

/**
 * 枠への吸着ルール
 */
function normalSnap(e, moveData) {
    const zones = document.querySelectorAll('.zone');
    let closest = null;
    let minDist = 40;
    const cr = currentDragEl.getBoundingClientRect();
    const cc = { x: cr.left + cr.width/2, y: cr.top + cr.height/2 };

    zones.forEach(z => {
        const zr = z.getBoundingClientRect();
        const zc = { x: zr.left + zr.width/2, y: zr.top + zr.height/2 };
        const d = Math.hypot(cc.x - zc.x, cc.y - zc.y);
        if (d < minDist) { minDist = d; closest = z; }
    });

    if (closest) { 
        if (STAGE_ZONES.includes(closest.id)) {
            const cardsInZone = Array.from(document.querySelectorAll('.card')).filter(c => c.dataset.zoneId === closest.id && c !== currentDragEl);
            if (cardsInZone.length === 0 && (currentDragEl.cardData.type === 'holomen' && currentDragEl.cardData.bloom !== 'Debut')) {
                returnToHand(currentDragEl); return;
            }
        }
        currentDragEl.dataset.zoneId = closest.id; delete currentDragEl.dataset.percentX; moveData.zoneId = closest.id;
        currentDragEl.classList.toggle('rotated', closest.id === 'life-zone'); moveData.isRotated = (closest.id === 'life-zone');
    } else { 
        delete currentDragEl.dataset.zoneId; 
        const fieldEl = document.getElementById('field');
        const fr = fieldEl.getBoundingClientRect(); 
        const px = (parseFloat(currentDragEl.style.left)/fr.width)*100, py = (parseFloat(currentDragEl.style.top)/fr.height)*100;
        currentDragEl.dataset.percentX = px; currentDragEl.dataset.percentY = py; moveData.percentX = px; moveData.percentY = py;
    }
}

/**
 * 手札へ戻す (自動表向き)
 */
function returnToHand(card) {
    card.style.position = 'relative'; card.style.left = ''; card.style.top = ''; 
    card.classList.remove('rotated', 'face-down'); card.classList.add('face-up');
    delete card.dataset.zoneId; delete card.dataset.percentX; handDiv.appendChild(card);
    socket.emit('flipCard', { id: card.id, isFaceUp: true }); 
    socket.emit('moveCard', { id: card.id, isRotated: false, isFaceUp: true }); 
    socket.emit('returnToHand', { id: card.id });
}

/**
 * 進化判定
 */
function canBloom(s, t) {
    if (s.type !== 'holomen' || t.type !== 'holomen' || s.name !== t.name) return false;
    return (t.bloom === 'Debut' && s.bloom === '1st') || (t.bloom === '1st' && (s.bloom === '2nd' || s.bloom === '1st'));
}

/**
 * 詳細表示
 */
function openZoom(cardData, cardElement = null) {
    if (!cardData || (cardElement && cardElement.classList.contains('face-down') && cardElement.dataset.zoneId === 'life-zone')) return;
    const container = document.querySelector('.zoom-container');
    const isOshi = (cardData.type === 'oshi'), isHolomen = (cardData.type === 'holomen');
    
    let stackAyle = [], stackUnder = [];
    const fieldEl = document.getElementById('field');
    if (!isOshi && cardElement && cardElement.parentElement === fieldEl) {
        const r = cardElement.getBoundingClientRect();
        const stack = Array.from(document.querySelectorAll('.card')).filter(c => c !== cardElement).filter(c => {
            const cr = c.getBoundingClientRect(); return Math.abs(cr.left - r.left) < 10 && Math.abs(cr.top - r.top) < 10;
        });
        stackAyle = stack.filter(c => c.cardData.type === 'ayle');
        stackUnder = stack.filter(c => c.cardData.type === 'holomen' && c.cardData.name === cardData.name);
    }

    const skillsHtml = (cardData.skills || []).map(s => {
        let labelTxt = s.type === 'sp_oshi' ? 'SP OSHI' : s.type.toUpperCase();
        let costHtml = (s.type === 'arts') ? `<div class="cost-container">${(s.cost || []).map(c => `<div class="cost-icon color-${c}"></div>`).join('')}</div>` : `<span class="skill-cost-hp">-${s.cost || 0}</span>`;
        return `<div class="skill-item"><div class="skill-header"><div class="skill-type-label label-${s.type}">${labelTxt}</div>${costHtml}<div class="skill-name">${s.name}</div></div><div class="skill-text">${s.text || ''}</div></div>`;
    }).join('');

    let underHtml = stackUnder.length ? `<div class="zoom-under-section"><span class="section-title">進化前</span>${stackUnder.map(u => `<div class="ayle-list-item"><span>● ${u.cardData.bloom}</span></div>`).join('')}</div>` : "";
    let hpLife = isOshi ? `<div class="zoom-life">LIFE ${cardData.life || 0}</div>` : (isHolomen ? `<div class="zoom-hp">HP ${cardData.hp || 0}</div>` : "");

    container.innerHTML = `<div class="zoom-header"><div><b>${cardData.name}</b></div>${hpLife}</div><div class="zoom-skills-list">${skillsHtml}</div>${underHtml}`;
    zoomModal.style.display = 'flex';
    zoomModal.onclick = (e) => { if (e.target === zoomModal) zoomModal.style.display = 'none'; };
}
