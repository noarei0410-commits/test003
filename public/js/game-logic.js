/**
 * カードDOMの生成
 * 各種カードタイプに応じた要素を構築します。
 */
function createCardElement(data, withEvents = true) {
    if (!data) return document.createElement('div');
    const el = document.createElement('div'); el.id = data.id || ""; el.className = 'card';

    // 種別クラスの付与
    if (data.type === 'oshi') el.classList.add('oshi-card');
    if (data.type === 'ayle') el.classList.add('ayle-card');
    if (data.type === 'support') el.classList.add('support-card');

    // 属性色の適用
    if (data.type !== 'support') {
        const colorVal = data.color || (data.type === 'ayle' ? data.name.charAt(0) : null);
        const colorKey = COLORS[colorVal] || 'white';
        el.classList.add('border-' + colorKey);
    }

    // 内部表示の分岐
    if (data.type === 'ayle') {
        const centerIcon = document.createElement('div');
        centerIcon.className = 'ayle-center-icon';
        centerIcon.style.background = COLORS[data.name.charAt(0)] || 'white';
        el.appendChild(centerIcon);
    } else {
        const nameSpan = document.createElement('span');
        nameSpan.innerText = data.name || "";
        el.appendChild(nameSpan);

        if (data.type === 'support' && data.category) {
            const catDiv = document.createElement('div');
            catDiv.className = 'card-support-category-initial';
            catDiv.innerText = data.category.charAt(0).toUpperCase();
            el.appendChild(catDiv);
        }
    }

    el.classList.add(data.isFaceUp !== false ? 'face-up' : 'face-down');
    if (data.isRotated) el.classList.add('rotated');

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
            for (let i = 0; i < data.baton; i++) {
                const d = document.createElement('div'); d.className = 'baton-dot'; bDiv.appendChild(d);
            }
            el.appendChild(bDiv);
        }
    }

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
 * 拡大表示 (ズーム)
 * 背景クリックで閉じる機能を搭載
 */
function openZoom(cardData, cardElement = null) {
    if (!cardData || (cardElement && cardElement.classList.contains('face-down') && cardElement.dataset.zoneId === 'life-zone')) return;

    const zoomOuter = document.getElementById('zoom-outer');
    const contentInner = document.querySelector('.zoom-content-inner');
    if (!zoomOuter || !contentInner) return;

    zoomOuter.className = 'zoom-outer-container';
    const colorCode = COLORS[cardData.color] || (cardData.type === 'ayle' ? COLORS[cardData.name.charAt(0)] : 'white');
    zoomOuter.classList.add('border-' + (COLORS[cardData.color] || 'white'));

    // --- 各カードタイプに応じた専用レイアウトの生成 ---
    if (cardData.type === 'support') {
        zoomOuter.classList.add('support-zoom');
        const limitedHtml = cardData.limited ? `<div class="zoom-support-limited-bar">LIMITED：ターンに1枚しか使えない。</div>` : "";
        contentInner.innerHTML = `
            <div class="support-zoom-layout">
                <div class="zoom-support-header">
                    <div class="zoom-support-label">サポート</div>
                    <div class="zoom-support-category-ribbon">${cardData.category}</div>
                </div>
                ${limitedHtml}
                <div class="zoom-support-name-box">${cardData.name}</div>
                <div class="zoom-support-main-text">${cardData.text}</div>
                <div class="zoom-support-tag">#${cardData.tags ? cardData.tags.join(' #') : ''}</div>
            </div>`;
    } else if (cardData.type === 'ayle') {
        zoomOuter.classList.add('ayle-zoom');
        contentInner.innerHTML = `
            <div class="ayle-zoom-layout">
                <div class="zoom-ayle-icon-large" style="background: ${colorCode};"></div>
                <div class="zoom-ayle-name-label">${cardData.name}</div>
            </div>`;
    } else if (cardData.type === 'oshi') {
        zoomOuter.classList.add('oshi-zoom');
        const skillsHtml = (cardData.skills || []).map(s => `
            <div class="oshi-skill-bar ${s.name.includes('SP') ? 'oshi-sp' : 'oshi-normal'}">
                <div class="oshi-skill-header"><span class="oshi-skill-label">${s.name}</span></div>
                <div class="oshi-skill-text">${s.text}</div>
            </div>`).join('');
        contentInner.innerHTML = `
            <div class="oshi-zoom-layout">
                <div class="oshi-skill-container">${skillsHtml}</div>
                <div class="zoom-oshi-name">${cardData.name}</div>
                <div class="zoom-oshi-right-bottom">
                    <div class="zoom-oshi-life-container">
                        <div class="zoom-oshi-life-label">LIFE</div>
                        <div class="zoom-oshi-life">${cardData.hp}</div>
                    </div>
                    <div class="zoom-oshi-color-large" style="background: ${colorCode};"></div>
                </div>
            </div>`;
    } else {
        // 通常ホロメン (3カラムスキルレイアウト)
        const skillsHtml = (cardData.skills || []).map(s => `
            <div class="skill-box">
                <div class="skill-top-row">
                    <div class="skill-label-container">${s.type === 'gift' ? '<div class="effect-label label-gift">G</div>' : ''}</div>
                    <div class="skill-name-container-center"><span class="skill-name-text">${s.name}</span></div>
                    <div class="skill-damage-text">${s.damage || ""}</div>
                </div>
                <div class="skill-text-detail">${s.text}</div>
            </div>`).join('');
        contentInner.innerHTML = `
            <div class="zoom-bloom-rank">${cardData.bloom || ""}</div>
            <div class="zoom-name-center">${cardData.name}</div>
            <div class="zoom-top-right-group">
                <div class="zoom-color-icon-large" style="background: ${colorCode};"></div>
                <div class="zoom-hp-container-row">
                    <div class="zoom-hp-controls-inline">
                        <button class="btn-zoom-hp-inline minus" onclick="changeHp('${cardData.id}', -10)">-</button>
                        <button class="btn-zoom-hp-inline plus" onclick="changeHp('${cardData.id}', 10)">+</button>
                    </div>
                    <div class="zoom-hp-display">HP ${cardData.currentHp || cardData.hp}</div>
                </div>
            </div>
            <div class="zoom-main-content">${skillsHtml}</div>`;
    }

    zoomModal.style.display = 'flex';

    // 背景をクリックした際に閉じる機能
    zoomModal.onclick = (e) => {
        if (e.target === zoomModal) {
            zoomModal.style.display = 'none';
        }
    };
}

/**
 * カードイベント設定
 */
function setupCardEvents(el) {
    el.onpointerdown = (e) => {
        startX = e.clientX; startY = e.clientY;
        potentialZoomTarget = el;

        if (myRole === 'spectator' || el.dataset.zoneId === 'archive') return;

        isDragging = true; dragStarted = false; currentDragEl = el;
        el.setPointerCapture(e.pointerId);
        el.oldZoneId = el.dataset.zoneId || "";

        currentStack = (el.dataset.zoneId) ? Array.from(document.querySelectorAll('.card')).filter(c => c.dataset.zoneId === el.dataset.zoneId) : [el];
        currentStack.sort((a, b) => (parseInt(a.style.zIndex) || 0) - (parseInt(b.style.zIndex) || 0));

        const rect = el.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
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
                card.style.position = 'absolute';
                card.style.left = (r.left - fr.left) + 'px';
                card.style.top = (r.top - fr.top) + 'px';
                field.appendChild(card);
            }
        });
    }

    if (dragStarted) {
        const fr = field.getBoundingClientRect();
        currentStack.forEach(card => {
            if (card === currentDragEl) {
                card.style.left = (e.clientX - fr.left - offsetX) + 'px';
                card.style.top = (e.clientY - fr.top - offsetY) + 'px';
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

    // クリック判定によるズーム表示
    if (potentialZoomTarget && dist < 10) {
        openZoom(potentialZoomTarget.cardData, potentialZoomTarget);
    }

    if (isDragging && currentDragEl && dragStarted) {
        const hRect = handDiv.getBoundingClientRect();
        if (e.clientX > hRect.left && e.clientX < hRect.right && e.clientY > hRect.top && e.clientY < hRect.bottom) {
            currentStack.forEach(c => returnToHand(c));
        } else {
            // エールのアタッチ判定 (ドラッグ中のカードがエールで、単一選択の場合)
            let attached = false;
            if (currentStack.length === 1 && currentDragEl.cardData.type === 'ayle') {
                const centerP = { x: e.clientX, y: e.clientY };

                // 他のカード（ホロメン）との重なり判定
                const targets = Array.from(document.querySelectorAll('.card')).filter(c =>
                    c !== currentDragEl && c.cardData.type === 'holomen' && c.parentElement === field
                );

                for (let t of targets) {
                    const r = t.getBoundingClientRect();
                    if (centerP.x > r.left && centerP.x < r.right && centerP.y > r.top && centerP.y < r.bottom) {
                        // アタッチ処理
                        socket.emit('attachAyle', { cheerId: currentDragEl.id, targetId: t.id });
                        attached = true;
                        break;
                    }
                }
            }

            if (!attached) normalSnapStack(e);
        }
    }

    if (currentDragEl && e.pointerId !== undefined) currentDragEl.releasePointerCapture(e.pointerId);
    isDragging = false; dragStarted = false; currentDragEl = null; currentStack = []; potentialZoomTarget = null;
    repositionCards();
};

/**
 * ゾーン再整列ロジック (ライフゾーン 25px 間隔版)
 */
function repositionCards() {
    const zones = document.querySelectorAll('.zone');
    zones.forEach(zone => {
        const cards = Array.from(document.querySelectorAll('.card')).filter(c => c.dataset.zoneId === zone.id);
        if (cards.length === 0) return;

        const rect = zone.getBoundingClientRect();
        const fieldRect = field.getBoundingClientRect();

        cards.forEach((card, index) => {
            card.style.position = 'absolute';

            if (zone.id === 'life-zone') {
                const offsetX = (rect.width - 82) / 2;
                const offsetY = 20 + (index * 25); // ライフ同士の幅を広めに確保
                card.style.left = (rect.left - fieldRect.left + offsetX) + 'px';
                card.style.top = (rect.top - fieldRect.top + offsetY) + 'px';
            } else {
                const offsetX = (rect.width - 58) / 2;
                const offsetY = (rect.height - 82) / 2;
                card.style.left = (rect.left - fieldRect.left + offsetX) + 'px';
                card.style.top = (rect.top - fieldRect.top + offsetY) + 'px';
            }
            card.style.zIndex = 100 + index;
        });
    });
}

/**
 * ゾーン吸着処理
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
            socket.emit('moveCard', { id: c.id, zoneId: c.dataset.zoneId, zIndex: c.style.zIndex });
        });
    } else {
        currentStack.forEach(c => {
            c.dataset.zoneId = c.oldZoneId;
            socket.emit('moveCard', { id: c.id, zoneId: c.dataset.zoneId, zIndex: c.style.zIndex });
        });
    }
}

/**
 * HP変更・同期処理
 */
function changeHp(id, delta) {
    const el = document.getElementById(id);
    if (el && el.cardData) {
        el.cardData.currentHp = Math.max(0, (el.cardData.currentHp || el.cardData.hp || 0) + delta);
        const fhp = document.getElementById(`hp-display-${id}`); if (fhp) fhp.innerText = el.cardData.currentHp;
        socket.emit('updateHp', { id, currentHp: el.cardData.currentHp });
    }
}

/**
 * 手札への返却
 */
function returnToHand(el) {
    if (el.dataset.zoneId === 'life-zone') { if (!confirm("ライフを手札に戻しますか？")) return; }
    socket.emit('returnToHand', { id: el.id });
    el.dataset.zoneId = ""; el.style.position = 'relative'; el.style.left = 'auto'; el.style.top = 'auto';
    el.classList.remove('rotated'); el.classList.add('face-up'); el.classList.remove('face-down');
    handDiv.appendChild(el);
    repositionCards();
}

/**
 * ブルーム判定ロジック
 */
function canBloom(dragCard, targetCard) {
    if (!dragCard || !targetCard || dragCard.type !== 'holomen' || targetCard.type !== 'holomen') return false;
    if (dragCard.name !== targetCard.name) return false;
    const ranks = { 'Debut': 0, '1st': 1, '2nd': 2 };
    return ranks[dragCard.bloom] === ranks[targetCard.bloom] + 1;
}
