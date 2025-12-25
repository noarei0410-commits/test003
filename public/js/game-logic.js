/**
 * カードDOMの生成
 * 各種カードタイプ（ホロメン、推し、エール、サポート）に応じた要素を構築します。
 */
function createCardElement(data, withEvents = true) {
    if (!data) return document.createElement('div');
    const el = document.createElement('div'); el.id = data.id || ""; el.className = 'card';
    
    // 種別クラスの付与
    if (data.type === 'oshi') el.classList.add('oshi-card');
    if (data.type === 'ayle') el.classList.add('ayle-card');
    if (data.type === 'support') el.classList.add('support-card');

    // 属性色・枠線の適用（サポート以外は属性に基づく）
    if (data.type !== 'support') {
        const colorVal = data.color || (data.type === 'ayle' ? data.name.charAt(0) : null);
        const colorKey = COLORS[colorVal] || 'white';
        el.classList.add('border-' + colorKey);
    }

    // --- 内部表示の分岐判定 ---
    if (data.type === 'ayle') {
        // エールカード：中央にアイコンのみを表示し、テキストやステータスは除外
        const centerIcon = document.createElement('div');
        centerIcon.className = 'ayle-center-icon';
        centerIcon.style.background = COLORS[data.name.charAt(0)] || 'white';
        el.appendChild(centerIcon);
    } else {
        // サポート・ホロメン・推し：カード名を表示
        const nameSpan = document.createElement('span');
        nameSpan.innerText = data.name || ""; 
        el.appendChild(nameSpan);

        if (data.type === 'support' && data.category) {
            // サポート：左上にカテゴリの頭文字を表示
            const catDiv = document.createElement('div');
            catDiv.className = 'card-support-category-initial';
            catDiv.innerText = data.category.charAt(0).toUpperCase();
            el.appendChild(catDiv);
        }
    }

    el.classList.add(data.isFaceUp !== false ? 'face-up' : 'face-down');
    if (data.isRotated) el.classList.add('rotated');

    // --- ホロメン専用ステータス（HP, Bloomランク, バトン）の生成 ---
    if (data.type === 'holomen') {
        const currentHp = data.currentHp !== undefined ? data.currentHp : data.hp;
        const hpDiv = document.createElement('div'); 
        hpDiv.className = 'card-hp'; hpDiv.id = `hp-display-${data.id}`;
        hpDiv.innerText = currentHp || ""; el.appendChild(hpDiv);

        if (data.bloom) {
            const bl = document.createElement('div'); bl.className = 'card-bloom'; 
            bl.innerText = data.bloom.charAt(0); el.appendChild(bl);
        }
        if (data.baton !== undefined) {
            const bDiv = document.createElement('div'); bDiv.className = 'card-baton';
            for(let i=0; i<data.baton; i++) { const d=document.createElement('div'); d.className='baton-dot'; bDiv.appendChild(d); }
            el.appendChild(bDiv);
        }
    }

    // 属性アイコン表示（エール・サポート以外）
    if ((data.type === 'holomen' || data.type === 'oshi') && data.color) {
        const clDiv = document.createElement('div'); 
        clDiv.className = 'card-color-icon'; 
        clDiv.style.background = COLORS[data.color] || 'white';
        el.appendChild(clDiv);
    }

    el.cardData = data;
    if (withEvents) setupCardEvents(el);
    return el;
}

/**
 * 拡大表示 (各カードタイプに応じた専用レイアウト)
 */
function openZoom(cardData, cardElement = null) {
    if (!cardData || (cardElement && cardElement.classList.contains('face-down') && cardElement.dataset.zoneId === 'life-zone')) return;
    
    const zoomOuter = document.getElementById('zoom-outer');
    const contentInner = document.querySelector('.zoom-content-inner');
    if (!zoomOuter || !contentInner) return;

    zoomOuter.className = 'zoom-outer-container';

    // --- 1. サポートカード用レイアウト (画像デザイン準拠) ---
    if (cardData.type === 'support') {
        zoomOuter.classList.add('support-zoom');
        const limitedHtml = cardData.limited ? `<div class="zoom-support-limited-bar">LIMITED：ターンに1枚しか使えない。</div>` : "";
        const tagHtml = cardData.tag ? `<div class="zoom-support-tag">#${cardData.tag}</div>` : "";
        
        contentInner.innerHTML = `
            <div class="support-zoom-layout">
                <div class="zoom-support-header">
                    <div class="zoom-support-label">サポート</div>
                    <div class="zoom-support-category-ribbon">${cardData.category}</div>
                </div>
                ${limitedHtml}
                <div class="zoom-support-name-box">${cardData.name}</div>
                <div class="zoom-support-main-text">${cardData.text}</div>
                ${tagHtml}
            </div>`;
    } 
    // --- 2. エールカード用レイアウト (アイコン強調) ---
    else if (cardData.type === 'ayle') {
        zoomOuter.classList.add('ayle-zoom');
        const colorVal = cardData.color || cardData.name.charAt(0);
        const colorCode = COLORS[colorVal] || 'white';
        zoomOuter.classList.add('border-' + (COLORS[colorVal] || 'white'));
        contentInner.innerHTML = `
            <div class="ayle-zoom-layout">
                <div class="zoom-ayle-icon-large" style="background: ${colorCode};"></div>
                <div class="zoom-ayle-name-label">${cardData.name}</div>
            </div>`;
    }
    // --- 3. 推しホロメン用レイアウト (ライフ・仕切り線修正版) ---
    else if (cardData.type === 'oshi') {
        zoomOuter.classList.add('oshi-zoom');
        const colorCode = COLORS[cardData.color] || 'white';
        zoomOuter.classList.add('border-' + (COLORS[cardData.color] || 'white'));
        const skillsHtml = (cardData.skills || []).map((s) => {
            const isSP = s.name.includes("SP");
            const costIcons = (s.cost || []).map(() => `<div class="cost-dot-small" style="background: #9b59b6;"></div>`).join('');
            return `
                <div class="oshi-skill-bar ${isSP ? 'oshi-sp' : 'oshi-normal'}">
                    <div class="oshi-skill-header">
                        <span class="oshi-skill-label">${s.name}</span>
                        <div class="oshi-skill-cost">${costIcons}</div>
                    </div>
                    <div class="oshi-skill-text">${s.text || ""}</div>
                </div>`;
        }).join('');

        contentInner.innerHTML = `
            <div class="oshi-zoom-layout">
                <div class="oshi-skill-container">${skillsHtml}</div>
                <div class="zoom-oshi-name">${cardData.name}</div>
                <div class="zoom-oshi-right-bottom">
                    <div class="zoom-oshi-life-container">
                        <div class="zoom-oshi-life-label">LIFE</div>
                        <div class="zoom-oshi-life">${cardData.hp || 0}</div>
                    </div>
                    <div class="zoom-oshi-color-large" style="background: ${colorCode};"></div>
                </div>
            </div>`;
    } 
    // --- 4. 通常ホロメン用レイアウト ---
    else {
        const isSpec = (myRole === 'spectator');
        const colorCode = COLORS[cardData.color] || 'white';
        zoomOuter.classList.add('border-' + colorCode);
        
        let attachedAyles = [];
        if (cardElement && cardElement.parentElement === field) {
            const r = cardElement.getBoundingClientRect();
            attachedAyles = Array.from(document.querySelectorAll('.card'))
                .filter(c => c !== cardElement && c.cardData.type === 'ayle')
                .filter(c => {
                    const cr = c.getBoundingClientRect();
                    return Math.abs(cr.left - r.left) < 10 && Math.abs(cr.top - r.top) < 10;
                }).map(c => c.cardData);
        }

        const hpControlsHtml = (!isSpec && cardData.type === 'holomen') ? `<div class="zoom-hp-controls-inline"><button class="btn-zoom-hp-inline minus" onclick="changeHp('${cardData.id}', -10)">-</button><button class="btn-zoom-hp-inline plus" onclick="changeHp('${cardData.id}', 10)">+</button></div>` : "";
        
        const skillsHtml = (cardData.skills || []).map((s) => {
            let leftContent = ""; let showDamage = false;
            if (s.type === 'gift') leftContent = `<div class="effect-label label-gift">G ギフト</div>`;
            else if (s.type === 'bloom') leftContent = `<div class="effect-label label-bloom-effect">B ブルームエフェクト</div>`;
            else if (s.type === 'collab') leftContent = `<div class="effect-label label-collab-effect">C コラボエフェクト</div>`;
            else { 
                showDamage = true; 
                const costIcons = (s.cost || []).map(c => `<div class="cost-dot-small" style="background: ${COLORS[c] || '#ddd'};"></div>`).join('');
                leftContent = `<div class="skill-label-container">${costIcons}</div>`; 
            }
            const isReady = (s.type === 'arts' || !s.type) && canUseArt(s.cost, attachedAyles);
            const readyBadge = isReady ? `<span class="ready-badge">READY</span>` : "";
            return `
                <div class="skill-box">
                    <div class="skill-top-row">
                        <div class="skill-label-container">${leftContent}</div>
                        <div class="skill-name-container-center"><span class="skill-name-text">${s.name}</span>${readyBadge}</div>
                        <div class="skill-damage-text">${showDamage ? (s.damage || "") : ""}</div>
                    </div>
                    ${s.text ? `<div class="skill-text-detail">${s.text}</div>` : ""}
                </div>`;
        }).join('');

        contentInner.innerHTML = `
            <div class="zoom-bloom-rank">${cardData.bloom || ""}</div>
            <div class="zoom-name-center">${cardData.name}</div>
            <div class="zoom-top-right-group">
                <div class="zoom-color-icon-large" style="background: ${colorCode};"></div>
                <div class="zoom-hp-container-row">
                    ${hpControlsHtml}
                    <div class="zoom-hp-display" id="zoom-hp-val">HP ${cardData.currentHp || cardData.hp || 0}</div>
                </div>
            </div>
            <div class="zoom-main-content">${skillsHtml}</div>
            <div class="zoom-bottom-left-group">
                <div class="zoom-tags-row">${(cardData.tags || []).map(t => `<span>#${t}</span>`).join(' ')}</div>
                <div class="zoom-baton-row"><span>バトンタッチ:</span><div class="baton-icon-list">${Array(cardData.baton || 0).fill('<div class="baton-dot-large"></div>').join('')}</div></div>
            </div>`;
    }

    zoomModal.style.display = 'flex';
    zoomModal.onclick = (e) => { if (e.target === zoomModal) zoomModal.style.display = 'none'; };
}

/**
 * カードイベント設定 (ドラッグ・クリック制御)
 */
function setupCardEvents(el) {
    el.onpointerdown = (e) => {
        startX = e.clientX; startY = e.clientY; potentialZoomTarget = el;
        if (myRole === 'spectator' || el.dataset.zoneId === 'archive') return;
        isDragging = true; dragStarted = false; currentDragEl = el; el.setPointerCapture(e.pointerId);
        el.oldZoneId = el.dataset.zoneId || "";
        currentStack = (el.dataset.zoneId) ? Array.from(document.querySelectorAll('.card')).filter(c => c.dataset.zoneId === el.dataset.zoneId) : [el];
        currentStack.sort((a,b) => (parseInt(a.style.zIndex)||0)-(parseInt(b.style.zIndex)||0));
        const rect = el.getBoundingClientRect(); offsetX = e.clientX - rect.left; offsetY = e.clientY - rect.top;
        e.stopPropagation();
    };
}

document.onpointermove = (e) => {
    if (!isDragging || !currentDragEl) return;
    const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
    if (!dragStarted && dist > 10) {
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
            if (card === currentDragEl) { card.style.left = (e.clientX - fr.left - offsetX) + 'px'; card.style.top = (e.clientY - fr.top - offsetY) + 'px'; }
            else {
                if (!card.dataset.stackOffset) { const lR = currentDragEl.getBoundingClientRect(), cR = card.getBoundingClientRect(); card.dataset.stackOffset = JSON.stringify({ x: cR.left - lR.left, y: cR.top - lR.top }); }
                const off = JSON.parse(card.dataset.stackOffset); card.style.left = (parseFloat(currentDragEl.style.left) + off.x) + 'px'; card.style.top = (parseFloat(currentDragEl.style.top) + off.y) + 'px';
            }
        });
    }
};

document.onpointerup = (e) => {
    const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
    if (potentialZoomTarget && dist < 10) openZoom(potentialZoomTarget.cardData, potentialZoomTarget);
    
    if (isDragging && currentDragEl && dragStarted) {
        const hRect = handDiv.getBoundingClientRect();
        if (e.clientX > hRect.left && e.clientX < hRect.right && e.clientY > hRect.top && e.clientY < hRect.bottom) { currentStack.forEach(c => returnToHand(c)); }
        else {
            const elementsUnder = document.elementsFromPoint(e.clientX, e.clientY);
            const target = elementsUnder.find(el => el.classList.contains('card') && !currentStack.includes(el));
            if (target && target.parentElement === field) {
                if (canBloom(currentDragEl.cardData, target.cardData)) {
                    const damage = parseInt(target.cardData.hp || 0) - parseInt(target.cardData.currentHp || target.cardData.hp || 0);
                    currentDragEl.cardData.currentHp = Math.max(0, parseInt(currentDragEl.cardData.hp) - damage);
                }
                currentStack.forEach(c => {
                    c.style.left = target.style.left; c.style.top = target.style.top; c.dataset.zoneId = target.dataset.zoneId || "";
                    const isBase = ['holomen', 'oshi'].includes(c.cardData.type);
                    c.style.zIndex = isBase ? target.style.zIndex : parseInt(target.style.zIndex) - 1;
                    socket.emit('moveCard', { id: c.id, ...c.cardData, zoneId: c.dataset.zoneId, zIndex: c.style.zIndex, currentHp: c.cardData.currentHp });
                });
            } else { normalSnapStack(e); }
        }
    }
    if (currentDragEl && e.pointerId !== undefined) currentDragEl.releasePointerCapture(e.pointerId);
    isDragging = false; dragStarted = false; currentDragEl = null; currentStack = []; repositionCards();
};

/**
 * アーツ使用判定ロジック
 */
function canUseArt(costArr, attachedAyles) {
    if (!costArr || costArr.length === 0) return true;
    let available = attachedAyles.map(a => a.name.replace('エール', ''));
    let needed = [...costArr];
    let anyCount = needed.filter(c => c === 'any').length;
    let coloredNeeded = needed.filter(c => c !== 'any');
    for (let c of coloredNeeded) {
        let idx = available.indexOf(c);
        if (idx !== -1) available.splice(idx, 1);
        else return false;
    }
    return available.length >= anyCount;
}

/**
 * HP変更・同期処理
 */
function changeHp(id, delta) {
    const el = document.getElementById(id);
    if (el && el.cardData) {
        el.cardData.currentHp = Math.max(0, (el.cardData.currentHp || el.cardData.hp || 0) + delta);
        const fhp = document.getElementById(`hp-display-${id}`); if (fhp) fhp.innerText = el.cardData.currentHp;
        const zhp = document.getElementById('zoom-hp-val'); if (zhp) zhp.innerText = `HP ${el.cardData.currentHp}`;
        socket.emit('updateHp', { id, currentHp: el.cardData.currentHp });
    }
}

/**
 * 手札への返却処理
 */
function returnToHand(el) {
    if (el.dataset.zoneId === 'life-zone') { if (!confirm("ライフを手札に戻しますか？")) return; }
    socket.emit('returnToHand', { id: el.id });
    el.dataset.zoneId = ""; el.style.position = 'relative'; el.style.left = 'auto'; el.style.top = 'auto'; el.style.zIndex = 'auto';
    el.classList.remove('rotated'); el.classList.add('face-up'); el.classList.remove('face-down');
    handDiv.appendChild(el); repositionCards();
}

/**
 * ブルーム判定処理
 */
function canBloom(dragCard, targetCard) {
    if (!dragCard || !targetCard || dragCard.type !== 'holomen' || targetCard.type !== 'holomen') return false;
    if (dragCard.name !== targetCard.name) return false;
    const ranks = { 'Debut': 0, '1st': 1, '2nd': 2 };
    return ranks[dragCard.bloom] === ranks[targetCard.bloom] + 1;
}

/**
 * ゾーン再整列処理
 */
function repositionCards() {
    const zones = document.querySelectorAll('.zone');
    zones.forEach(zone => {
        const cards = Array.from(document.querySelectorAll('.card')).filter(c => c.dataset.zoneId === zone.id);
        if (cards.length === 0) return;
        const rect = zone.getBoundingClientRect();
        const fieldRect = field.getBoundingClientRect();
        cards.forEach((card) => {
            card.style.position = 'absolute';
            card.style.left = (rect.left - fieldRect.left + (rect.width - 58)/2) + 'px';
            card.style.top = (rect.top - fieldRect.top + (rect.height - 82)/2) + 'px';
        });
    });
}

/**
 * ゾーンへの吸着処理
 */
function normalSnapStack(e) {
    const zones = Array.from(document.querySelectorAll('.zone'));
    const targetZone = zones.find(z => {
        const r = z.getBoundingClientRect();
        return e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom;
    });
    if (targetZone) {
        currentStack.forEach(c => {
            c.dataset.zoneId = targetZone.id;
            socket.emit('moveCard', { id: c.id, ...c.cardData, zoneId: c.dataset.zoneId, zIndex: c.style.zIndex });
        });
    } else {
        currentStack.forEach(c => {
            c.dataset.zoneId = c.oldZoneId;
            socket.emit('moveCard', { id: c.id, ...c.cardData, zoneId: c.dataset.zoneId, zIndex: c.style.zIndex });
        });
    }
}
