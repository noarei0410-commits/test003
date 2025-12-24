/**
 * カードDOMの生成
 */
function createCardElement(data, withEvents = true) {
    if (!data) return document.createElement('div');
    const el = document.createElement('div'); el.id = data.id || ""; el.className = 'card';
    
    // カード名（中央表示用）
    const nameSpan = document.createElement('span');
    nameSpan.innerText = data.name || ""; 
    el.appendChild(nameSpan);

    el.classList.add(data.isFaceUp !== false ? 'face-up' : 'face-down');
    if (data.isRotated) el.classList.add('rotated');

    // 装飾パーツ（絶対配置される）
    if (data.type === 'holomen' || data.type === 'oshi') {
        const currentHp = data.currentHp !== undefined ? data.currentHp : data.hp;
        
        // HP表示 (右上)
        const hpDiv = document.createElement('div'); 
        hpDiv.className = 'card-hp'; 
        hpDiv.id = `hp-display-${data.id}`;
        hpDiv.innerText = currentHp || data.life || ""; 
        el.appendChild(hpDiv);

        // Bloom (左上)
        if (data.bloom) {
            const blDiv = document.createElement('div'); 
            blDiv.className = 'card-bloom'; 
            blDiv.innerText = data.bloom.charAt(0); 
            el.appendChild(blDiv);
        }
        
        // カラーアイコン (右上)
        if (data.color) {
            const clDiv = document.createElement('div'); 
            clDiv.className = 'card-color-icon'; 
            const colorCode = COLORS[data.color] || 'white';
            clDiv.style.background = colorCode;
            el.appendChild(clDiv);
        }
        
        // バトンタッチ (右下・ドット並び)
        if (data.baton !== undefined) {
            const batonDiv = document.createElement('div'); 
            batonDiv.className = 'card-baton';
            for(let i=0; i<data.baton; i++) { 
                const dot = document.createElement('div'); 
                dot.className = 'baton-dot'; 
                batonDiv.appendChild(dot); 
            }
            el.appendChild(batonDiv);
        }
    }

    // エール専用スタイル
    if (data.type === 'ayle') {
        for (let k in COLORS) { if (data.name.includes(k)) el.classList.add(`ayle-${COLORS[k]}`); }
    }

    el.cardData = data;
    if (withEvents) setupCardEvents(el);
    return el;
}

/**
 * 新レイアウトに対応したカード再配置ロジック
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
                
                // カード中央揃え基準 (枠のサイズに合わせて自動計算)
                let targetLeft = (zr.left - fRect.left) + (zr.width - 58) / 2;
                let targetTop = (zr.top - fRect.top) + (zr.height - 82) / 2;
                
                // 重なり処理 (ライフ、パワー、アーカイブ)
                if (zid === 'life-zone') {
                    // ライフは縦に広くなったので、ずらし幅を調整
                    targetTop = (zr.top - fRect.top) + 15 + (counts[zid] * 30);
                } else if (['holopower', 'archive'].includes(zid)) {
                    // パワーとアーカイブは少し右下にずらす
                    targetLeft += counts[zid] * 2;
                    targetTop += counts[zid] * 2;
                }
                
                card.style.left = targetLeft + 'px';
                card.style.top = targetTop + 'px';
                counts[zid]++;
            }
        }
    });
}

function setupCardEvents(el) {
    el.onpointerdown = (e) => {
        startX = e.clientX; startY = e.clientY; potentialZoomTarget = el;
        
        // 観戦者、またはアーカイブにあるカードはドラッグ不可
        if (myRole === 'spectator' || el.dataset.zoneId === 'archive') return;
        
        isDragging = true; dragStarted = false;
        currentDragEl = el; el.setPointerCapture(e.pointerId);
        el.oldZoneId = el.dataset.zoneId || "";

        const rect = el.getBoundingClientRect();
        offsetX = e.clientX - rect.left; offsetY = e.clientY - rect.top;
        currentStack = (el.dataset.zoneId && el.dataset.zoneId !== "") 
            ? Array.from(document.querySelectorAll('.card')).filter(c => c.dataset.zoneId === el.dataset.zoneId)
            : [el];
        currentStack.sort((a, b) => (parseInt(a.style.zIndex) || 0) - (parseInt(b.style.zIndex) || 0));
        e.stopPropagation();
    };
}

document.onpointermove = (e) => { 
    if (!isDragging || !currentDragEl) return; 
    const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
    if (!dragStarted && dist > 5) {
        dragStarted = true;
        currentStack.forEach(card => {
            maxZIndex++; card.style.zIndex = maxZIndex;
            if (card.parentElement !== field) {
                const r = card.getBoundingClientRect(), fr = field.getBoundingClientRect();
                card.style.position = 'absolute'; card.style.left = (r.left - fr.left) + 'px'; card.style.top = (r.top - fr.top) + 'px';
                field.appendChild(card);
            }
        });
    }
    if (dragStarted) {
        const fr = field.getBoundingClientRect();
        currentStack.forEach(card => {
            if (card === currentDragEl) {
                card.style.left = (e.clientX - fr.left - offsetX) + 'px'; card.style.top = (e.clientY - fr.top - offsetY) + 'px';
            } else {
                if (!card.dataset.stackOffset) {
                    const lR = currentDragEl.getBoundingClientRect(), cR = card.getBoundingClientRect();
                    card.dataset.stackOffset = JSON.stringify({ x: cR.left - lR.left, y: cR.top - lR.top });
                }
                const off = JSON.parse(card.dataset.stackOffset);
                card.style.left = (parseFloat(currentDragEl.style.left) + off.x) + 'px';
                card.style.top = (parseFloat(currentDragEl.style.top) + off.y) + 'px';
            }
        });
    }
};

document.onpointerup = (e) => {
    const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
    if (potentialZoomTarget && dist < 10) openZoom(potentialZoomTarget.cardData, potentialZoomTarget);
    
    if (myRole === 'spectator' || !isDragging || !currentDragEl) { isDragging = false; dragStarted = false; currentStack = []; return; }
    
    if (dragStarted) {
        const hRect = handDiv.getBoundingClientRect();
        if (e.clientX > hRect.left && e.clientX < hRect.right && e.clientY > hRect.top && e.clientY < hRect.bottom) {
            currentStack.forEach(c => returnToHand(c));
        } else {
            const elementsUnder = document.elementsFromPoint(e.clientX, e.clientY);
            const target = elementsUnder.find(el => el.classList.contains('card') && !currentStack.includes(el));
            
            if (target && target.parentElement === field) {
                if (canBloom(currentDragEl.cardData, target.cardData)) {
                    const damage = parseInt(target.cardData.hp || 0) - parseInt(target.cardData.currentHp || target.cardData.hp || 0);
                    currentDragEl.cardData.currentHp = Math.max(0, parseInt(currentDragEl.cardData.hp) - damage);
                    const hpDisplay = document.getElementById(`hp-display-${currentDragEl.id}`);
                    if (hpDisplay) hpDisplay.innerText = currentDragEl.cardData.currentHp;
                }
                currentStack.forEach(c => {
                    c.style.left = target.style.left; c.style.top = target.style.top;
                    c.dataset.zoneId = target.dataset.zoneId || "";
                    const isBase = ['holomen', 'oshi'].includes(c.cardData.type);
                    c.style.zIndex = isBase ? target.style.zIndex : parseInt(target.style.zIndex) - 1;
                    socket.emit('moveCard', { id: c.id, ...c.cardData, zoneId: c.dataset.zoneId, zIndex: c.style.zIndex, currentHp: c.cardData.currentHp });
                });
            } else { normalSnapStack(e); }
        }
    }
    currentStack.forEach(c => delete c.dataset.stackOffset);
    isDragging = false; dragStarted = false; currentStack = []; repositionCards();
};

function normalSnapStack(e) {
    const zones = document.querySelectorAll('.zone');
    let closest = null, minDist = 40;
    const cr = currentDragEl.getBoundingClientRect(), cc = { x: cr.left + cr.width/2, y: cr.top + cr.height/2 };

    zones.forEach(z => {
        const zr = z.getBoundingClientRect(), zc = { x: zr.left + zr.width/2, y: zr.top + zr.height/2 };
        const d = Math.hypot(cc.x - zc.x, cc.y - zc.y); if (d < minDist) { minDist = d; closest = z; }
    });

    if (closest) {
        if (currentDragEl.oldZoneId.startsWith('back') && closest.id === 'collab') socket.emit('generateHoloPower');
        
        currentStack.forEach(c => {
            c.dataset.zoneId = closest.id; delete c.dataset.percentX;
            if (closest.id === 'archive') {
                c.classList.remove('rotated', 'face-down'); c.classList.add('face-up');
                socket.emit('moveCard', { id: c.id, ...c.cardData, zoneId: 'archive', isRotated: false, isFaceUp: true, zIndex: 10 });
            } else {
                const rotate = ['life-zone', 'holopower'].includes(closest.id);
                c.classList.toggle('rotated', rotate);
                socket.emit('moveCard', { id: c.id, ...c.cardData, zoneId: closest.id, isRotated: rotate, zIndex: c.style.zIndex });
            }
        });
    } else {
        const fr = field.getBoundingClientRect();
        currentStack.forEach(c => {
            delete c.dataset.zoneId;
            const px = (parseFloat(c.style.left)/fr.width)*100, py = (parseFloat(c.style.top)/fr.height)*100;
            socket.emit('moveCard', { id: c.id, ...c.cardData, percentX: px, percentY: py, zIndex: c.style.zIndex });
        });
    }
}

function openZoom(cardData, cardElement = null) {
    if (!cardData || (cardElement && cardElement.classList.contains('face-down') && cardElement.dataset.zoneId === 'life-zone')) return;
    const container = document.querySelector('.zoom-container');
    const isOshi = (cardData.type === 'oshi'), isHolomen = (cardData.type === 'holomen'), isSpec = (myRole === 'spectator');
    
    let stackAyle = [], stackEquip = [];
    if (cardElement && (cardElement.parentElement === field || cardElement.parentElement === handDiv || cardElement.closest('#deck-card-grid'))) {
        const r = cardElement.getBoundingClientRect();
        const stack = Array.from(document.querySelectorAll('.card')).filter(c => c !== cardElement).filter(c => {
            const cr = c.getBoundingClientRect(); return Math.abs(cr.left - r.left) < 10 && Math.abs(cr.top - r.top) < 10;
        });
        stackAyle = stack.filter(c => c.cardData.type === 'ayle');
        stackEquip = stack.filter(c => c.cardData.type === 'support');
    }
    const power = document.querySelectorAll('.card[data-zone-id="holopower"]').length;

    const skillsHtml = (cardData.skills || []).map((s, idx) => {
        let labelTxt = s.type === 'sp_oshi' ? 'SP OSHI' : s.type.toUpperCase();
        let isReady = s.type === 'arts' ? canUseArt(s.cost, stackAyle.map(e => e.cardData)) : (power >= (s.cost || 0));
        
        let actionBtn = "";
        if (isReady) {
            if ((s.type === 'oshi' || s.type === 'sp_oshi')) {
                actionBtn = isSpec ? "" : `<button class="btn-activate-skill" onclick="activateOshiSkill('${cardData.id}', ${idx}, ${s.cost})">発動</button>`;
            } else {
                actionBtn = `<span class="ready-badge">READY</span>`;
            }
        }

        let costHtml = (s.type === 'arts') 
            ? `<div class="cost-container">${(s.cost || []).map(c => `<div class="cost-icon color-${COLORS[c] || 'white'}"></div>`).join('')}</div>` 
            : `<span class="skill-cost-hp">-${s.cost || 0}</span>`;

        let damageHtml = s.damage ? `<span class="skill-damage">${s.damage}</span>` : "";
        return `
            <div class="skill-item">
                <div class="skill-header">
                    <div class="skill-type-label label-${s.type}">${labelTxt}</div>
                    ${costHtml}
                    <div class="skill-name-row"><span>${s.name}${actionBtn}</span>${damageHtml}</div>
                </div>
                <div class="skill-text">${s.text || ''}</div>
            </div>`;
    }).join('');

    const effectTextHtml = cardData.text ? `<div class="zoom-effect-text">${cardData.text}</div>` : "";

    let hpDisplayHtml = "";
    if (isHolomen) {
        const currentHp = cardData.currentHp !== undefined ? cardData.currentHp : cardData.hp;
        hpDisplayHtml = `
            <div class="zoom-hp-area">
                <div class="zoom-hp" id="zoom-hp-val">HP ${currentHp}</div>
                ${isSpec ? "" : `
                <div class="hp-control-btns">
                    <button class="btn-hp" style="background:#e74c3c" onclick="changeHp('${cardData.id}', -10)">-</button>
                    <button class="btn-hp" style="background:#2ecc71" onclick="changeHp('${cardData.id}', 10)">+</button>
                </div>`}
            </div>`;
    } else if (isOshi) {
        hpDisplayHtml = `<div class="zoom-life">LIFE ${cardData.life || 0} <span style="font-size:10px; color:#aaa; margin-left:5px;">(Power: ${power})</span></div>`;
    }

    let attachHtml = `<div class="zoom-attach-section">
        ${stackAyle.map(a => `<div class="attach-item"><span>● ${a.cardData.name}</span>${isSpec ? "" : `<button class="btn-discard-small" onclick="discardFromZoom('${a.id}')">破棄</button>`}</div>`).join('')}
        ${stackEquip.map(e => `<div class="attach-item"><div class="attach-item-header"><span>■ ${e.cardData.name}</span>${isSpec ? "" : `<button class="btn-discard-small" onclick="discardFromZoom('${e.id}')">破棄</button>`}</div><div class="attach-item-text">${e.cardData.text || ''}</div></div>`).join('')}
    </div>`;

    container.innerHTML = `
        <div class="zoom-header"><div class="zoom-name">${cardData.name}</div>${hpDisplayHtml}</div>
        ${effectTextHtml}
        <div class="zoom-skills-list">${skillsHtml}</div>
        ${attachHtml}
        <div class="zoom-footer"><div class="zoom-tags">${(cardData.tags || []).map(t => `<span>${t}</span>`).join('')}</div><div class="zoom-baton-row"><span>バトン:</span><div class="baton-dots-container">${Array(cardData.baton || 0).fill('<div class="baton-dot"></div>').join('')}</div></div></div>
    `;
    zoomModal.style.display = 'flex';
    zoomModal.onclick = (e) => { if (e.target === zoomModal) zoomModal.style.display = 'none'; };
}

window.activateOshiSkill = (oshiCardId, skillIdx, cost) => {
    if (myRole === 'spectator') return;
    const hpCards = Array.from(document.querySelectorAll('.card[data-zone-id="holopower"]'));
    if (hpCards.length < cost) return alert("ホロパワーが足りません");
    if (!confirm(`ホロパワーを ${cost} 枚消費してスキルを発動しますか？`)) return;

    for (let i = 0; i < cost; i++) {
        const c = hpCards[i];
        c.dataset.zoneId = 'archive';
        c.classList.remove('rotated', 'face-down');
        c.classList.add('face-up');
        socket.emit('moveCard', { id: c.id, ...c.cardData, zoneId: 'archive', isRotated: false, isFaceUp: true, zIndex: 10 });
    }

    zoomModal.style.display = 'none';
    repositionCards();
};

window.changeHp = (id, amount) => {
    if (myRole === 'spectator') return;
    const el = document.getElementById(id);
    if (!el || !el.cardData) return;
    let current = parseInt(el.cardData.currentHp !== undefined ? el.cardData.currentHp : el.cardData.hp);
    let newVal = Math.max(0, current + amount);
    el.cardData.currentHp = newVal;
    const zoomVal = document.getElementById('zoom-hp-val');
    if (zoomVal) zoomVal.innerText = `HP ${newVal}`;
    const fieldHp = document.getElementById(`hp-display-${id}`);
    if (fieldHp) fieldHp.innerText = newVal;
    socket.emit('updateHp', { id: id, currentHp: newVal });
};

window.discardFromZoom = (id) => { 
    if (myRole === 'spectator') return;
    const el = document.getElementById(id); if(!el) return;
    el.classList.remove('rotated', 'face-down');
    el.classList.add('face-up');
    el.dataset.zoneId = 'archive';
    socket.emit('moveCard', {id, zoneId:'archive', zIndex:10, isRotated: false, isFaceUp: true, ...el.cardData}); 
    zoomModal.style.display='none'; repositionCards(); 
};

function returnToHand(card) {
    card.style.position = 'relative'; card.style.left = ''; card.style.top = ''; 
    card.classList.remove('rotated', 'face-down'); card.classList.add('face-up');
    delete card.dataset.zoneId; delete card.dataset.percentX; handDiv.appendChild(card);
    socket.emit('returnToHand', { id: card.id });
}

function canBloom(s, t) { if (s.type !== 'holomen' || t.type !== 'holomen' || s.name !== t.name) return false; return (t.bloom === 'Debut' && s.bloom === '1st') || (t.bloom === '1st' && (s.bloom === '2nd' || s.bloom === '1st')); }

function canUseArt(cost, attached) {
    const counts = attached.reduce((acc, c) => { for(let k in COLORS) if(c.name && c.name.includes(k)) acc[COLORS[k]] = (acc[COLORS[k]]||0)+1; return acc; }, {});
    const req = cost.filter(c => c !== 'any'), any = cost.filter(c => c === 'any').length;
    for (let r of req) { if (counts[r] > 0) counts[r]--; else return false; }
    return Object.values(counts).reduce((a, b) => a + b, 0) >= any;
}
