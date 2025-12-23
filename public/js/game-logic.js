/**
 * カードDOMの生成
 */
function createCardElement(data, withEvents = true) {
    if (!data) return document.createElement('div');
    const el = document.createElement('div'); el.id = data.id || ""; el.className = 'card';
    
    const nameSpan = document.createElement('span');
    nameSpan.innerText = data.name || ""; el.appendChild(nameSpan);

    el.classList.add(data.isFaceUp !== false ? 'face-up' : 'face-down');
    if (data.isRotated) el.classList.add('rotated');

    // ホロメン・推しの装飾
    if (data.type === 'holomen' || data.type === 'oshi') {
        const currentHp = data.currentHp !== undefined ? data.currentHp : data.hp;
        const hpDiv = document.createElement('div'); 
        hpDiv.className = 'card-hp'; 
        hpDiv.id = `hp-display-${data.id}`;
        hpDiv.innerText = currentHp || data.life || ""; 
        el.appendChild(hpDiv);

        if (data.bloom) {
            const blDiv = document.createElement('div'); blDiv.className = 'card-bloom'; blDiv.innerText = data.bloom.charAt(0); el.appendChild(blDiv);
        }
        if (data.color) {
            const clDiv = document.createElement('div'); clDiv.className = `card-color-icon color-${data.color.toLowerCase()}`; el.appendChild(clDiv);
        }
        if (data.tags && Array.isArray(data.tags)) {
            const tagsDiv = document.createElement('div'); tagsDiv.className = 'card-tags';
            tagsDiv.innerHTML = data.tags.join('<br>'); el.appendChild(tagsDiv);
        }
        if (data.baton !== undefined) {
            const batonDiv = document.createElement('div'); batonDiv.className = 'card-baton';
            for(let i=0; i<data.baton; i++) { const dot = document.createElement('div'); dot.className='baton-dot'; batonDiv.appendChild(dot); }
            el.appendChild(batonDiv);
        }
    }

    if (data.type === 'ayle' || (data.name && data.name.includes('エール'))) {
        for (let kanji in COLORS) { if (data.name.includes(kanji)) { el.classList.add(`ayle-${COLORS[kanji]}`); break; } }
    }

    el.cardData = data;
    if (withEvents) setupCardEvents(el);
    return el;
}

/**
 * カード再配置
 */
function repositionCards() {
    const fieldEl = document.getElementById('field'); if (!fieldEl) return;
    const fRect = fieldEl.getBoundingClientRect();
    const zoneCounts = {};

    document.querySelectorAll('.card').forEach(card => {
        if (card.parentElement !== fieldEl || currentStack.includes(card)) return;
        const zid = card.dataset.zoneId;
        if (zid) {
            const z = document.getElementById(zid);
            if(z) {
                const zr = z.getBoundingClientRect(), cr = card.getBoundingClientRect();
                if (!zoneCounts[zid]) zoneCounts[zid] = 0;
                let targetLeft = (zr.left - fRect.left) + (zr.width - cr.width) / 2;
                let targetTop = (zr.top - fRect.top) + (zr.height - cr.height) / 2;
                if (zid === 'life-zone') { const offset = zoneCounts[zid] * 18; targetTop = (zr.top - fRect.top) + 5 + offset; }
                card.style.left = targetLeft + 'px'; card.style.top = targetTop + 'px';
                zoneCounts[zid]++;
            }
        } else if (card.dataset.percentX) {
            card.style.left = (card.dataset.percentX / 100) * fRect.width + 'px';
            card.style.top = (card.dataset.percentY / 100) * fRect.height + 'px';
        }
    });
}

function setupCardEvents(el) {
    el.onpointerdown = (e) => {
        startX = e.clientX; startY = e.clientY; potentialZoomTarget = el;
        if (myRole === 'spectator') return;
        isDragging = true; dragStarted = false;
        currentDragEl = el; el.setPointerCapture(e.pointerId);
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
                    const lR = currentDragEl.getBoundingClientRect();
                    const cR = card.getBoundingClientRect();
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
                // Bloom（進化）のダメージ引き継ぎロジック
                if (canBloom(currentDragEl.cardData, target.cardData)) {
                    // ダメージ計算: 最大HP - 現在HP
                    const prevMax = parseInt(target.cardData.hp || 0);
                    const prevCurrent = parseInt(target.cardData.currentHp !== undefined ? target.cardData.currentHp : prevMax);
                    const damageTaken = prevMax - prevCurrent;

                    // 新しいHP = 進化後の最大HP - ダメージ
                    const nextMax = parseInt(currentDragEl.cardData.hp || 0);
                    currentDragEl.cardData.currentHp = Math.max(0, nextMax - damageTaken);

                    // 表示更新
                    const hpDisplay = document.getElementById(`hp-display-${currentDragEl.id}`);
                    if (hpDisplay) hpDisplay.innerText = currentDragEl.cardData.currentHp;
                }

                currentStack.forEach(c => {
                    c.style.left = target.style.left; c.style.top = target.style.top;
                    c.dataset.zoneId = target.dataset.zoneId || "";
                    const isBase = (c.cardData.type === 'holomen' || c.cardData.type === 'oshi');
                    c.style.zIndex = isBase ? target.style.zIndex : parseInt(target.style.zIndex) - 1;
                    // ダメージ情報を乗せた状態で同期
                    socket.emit('moveCard', { 
                        id: c.id, ...c.cardData, zoneId: c.dataset.zoneId, zIndex: c.style.zIndex, currentHp: c.cardData.currentHp 
                    });
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
        if (STAGE_ZONES.includes(closest.id)) {
            const cardsInZone = Array.from(document.querySelectorAll('.card')).filter(c => c.dataset.zoneId === closest.id && !currentStack.includes(c));
            if (cardsInZone.length === 0 && (currentDragEl.cardData.type === 'holomen' && currentDragEl.cardData.bloom !== 'Debut')) {
                currentStack.forEach(c => returnToHand(c)); return;
            }
        }
        currentStack.forEach(c => {
            c.dataset.zoneId = closest.id; delete c.dataset.percentX;
            const rotate = (closest.id === 'life-zone'); c.classList.toggle('rotated', rotate);
            socket.emit('moveCard', { id: c.id, ...c.cardData, zoneId: closest.id, isRotated: rotate, zIndex: c.style.zIndex });
        });
    } else {
        const fr = field.getBoundingClientRect();
        currentStack.forEach(c => {
            delete c.dataset.zoneId;
            const px = (parseFloat(c.style.left)/fr.width)*100, py = (parseFloat(c.style.top)/fr.height)*100;
            c.dataset.percentX = px; c.dataset.percentY = py;
            socket.emit('moveCard', { id: c.id, ...c.cardData, percentX: px, percentY: py, zIndex: c.style.zIndex });
        });
    }
}

function returnToHand(card) {
    card.style.position = 'relative'; card.style.left = ''; card.style.top = ''; 
    card.classList.remove('rotated', 'face-down'); card.classList.add('face-up');
    delete card.dataset.zoneId; delete card.dataset.percentX; handDiv.appendChild(card);
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

/**
 * ズーム詳細
 */
function openZoom(cardData, cardElement = null) {
    if (!cardData || (cardElement && cardElement.classList.contains('face-down') && cardElement.dataset.zoneId === 'life-zone')) return;
    const container = document.querySelector('.zoom-container');
    const isOshi = (cardData.type === 'oshi'), isHolomen = (cardData.type === 'holomen');
    
    let stackAyle = [], stackEquip = [];
    if (cardElement && (cardElement.parentElement === field || cardElement.parentElement === handDiv)) {
        const r = cardElement.getBoundingClientRect();
        const stack = Array.from(document.querySelectorAll('.card')).filter(c => c !== cardElement).filter(c => {
            const cr = c.getBoundingClientRect(); return Math.abs(cr.left - r.left) < 10 && Math.abs(cr.top - r.top) < 10;
        });
        stackAyle = stack.filter(c => c.cardData.type === 'ayle');
        stackEquip = stack.filter(c => c.cardData.type === 'support');
    }

    const tagsHtml = (cardData.tags && cardData.tags.length) 
        ? `<div class="zoom-tags">${cardData.tags.map(t => `<span class="zoom-tag-item">${t}</span>`).join('')}</div>` : "";
    const batonHtml = (cardData.baton !== undefined)
        ? `<div class="zoom-baton-row"><span>バトンタッチ:</span><div class="baton-dots-container">${Array(cardData.baton).fill('<div class="baton-dot"></div>').join('')}</div></div>` : "";

    const skillsHtml = (cardData.skills || []).map(s => {
        let labelTxt = s.type === 'sp_oshi' ? 'SP OSHI' : s.type.toUpperCase();
        let ready = (s.type === 'arts' && canUseArt(s.cost, stackAyle.map(e => e.cardData))) ? `<span class="ready-badge">READY</span>` : "";
        let costHtml = (s.type === 'arts') ? `<div class="cost-container">${(s.cost || []).map(c => `<div class="cost-icon color-${c}"></div>`).join('')}</div>` : `<span class="skill-cost-hp">-${s.cost || 0}</span>`;
        let damageHtml = s.damage ? `<span class="skill-damage">${s.damage}</span>` : "";
        return `
            <div class="skill-item">
                <div class="skill-header">
                    <div class="skill-type-label label-${s.type}">${labelTxt}</div>
                    ${costHtml}
                    <div class="skill-name-row"><span>${s.name}${ready}</span>${damageHtml}</div>
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
                <div class="hp-control-btns">
                    <button class="btn-hp btn-hp-minus" onclick="changeHp('${cardData.id}', -10)">-</button>
                    <button class="btn-hp btn-hp-plus" onclick="changeHp('${cardData.id}', 10)">+</button>
                </div>
            </div>`;
    } else if (isOshi) {
        hpDisplayHtml = `<div class="zoom-life">LIFE ${cardData.life || 0}</div>`;
    }

    let attachHtml = "";
    if(stackAyle.length) attachHtml += `<div class="zoom-attach-section"><span class="attach-title">装着エール</span>${stackAyle.map(a => `<div class="attach-item"><span>● ${a.cardData.name}</span><button class="btn-discard-small" onclick="discardFromZoom('${a.id}')">破棄</button></div>`).join('')}</div>`;
    if(stackEquip.length) attachHtml += `
        <div class="zoom-attach-section"><span class="attach-title">装備アイテム / サポート</span>
            ${stackEquip.map(e => `<div class="attach-item"><div class="attach-item-header"><span>■ ${e.cardData.name}</span><button class="btn-discard-small" onclick="discardFromZoom('${e.id}')">破棄</button></div><div class="attach-item-text">${e.cardData.text || '(効果文なし)'}</div></div>`).join('')}
        </div>`;

    container.innerHTML = `
        <div class="zoom-header"><div class="zoom-name">${cardData.name}</div>${hpDisplayHtml}</div>
        ${effectTextHtml}
        <div class="zoom-skills-list">${skillsHtml}</div>
        ${attachHtml}
        <div class="zoom-footer">${tagsHtml}${batonHtml}</div>
    `;
    zoomModal.style.display = 'flex';
    zoomModal.onclick = (e) => { if (e.target === zoomModal) zoomModal.style.display = 'none'; };
}

window.changeHp = (id, amount) => {
    const el = document.getElementById(id);
    if (!el || !el.cardData) return;
    let current = parseInt(el.cardData.currentHp !== undefined ? el.cardData.currentHp : el.cardData.hp);
    let newVal = current + amount;
    if (newVal < 0) newVal = 0;
    el.cardData.currentHp = newVal;
    const zoomVal = document.getElementById('zoom-hp-val');
    if (zoomVal) zoomVal.innerText = `HP ${newVal}`;
    const fieldHp = document.getElementById(`hp-display-${id}`);
    if (fieldHp) fieldHp.innerText = newVal;
    socket.emit('updateHp', { id: id, currentHp: newVal });
};

window.discardFromZoom = (id) => { 
    const el = document.getElementById(id); if(!el) return;
    socket.emit('moveCard', {id, zoneId:'archive', zIndex:10, ...el.cardData}); 
    el.dataset.zoneId='archive'; repositionCards(); zoomModal.style.display='none'; 
};
