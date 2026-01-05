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

    // 属性色の適用 (サポート以外)
    if (data.type === 'support') {
        el.style.border = '1px solid rgba(188,226,232,1)';
    } else {
        const colorVal = data.color || (data.type === 'ayle' ? data.name.charAt(0) : null);
        const colorKey = COLORS[colorVal] || 'white';
        el.classList.add('border-' + colorKey);
    }

    // 表面用の要素コンテナ
    const faceContainer = document.createElement('div');
    faceContainer.className = 'card-face-content';
    el.appendChild(faceContainer);

    // 内部表示の分岐
    if (data.type === 'ayle') {
        const centerIcon = document.createElement('div');
        centerIcon.className = 'ayle-center-icon-normal';
        centerIcon.style.background = COLORS[data.name.charAt(0)] || 'white';
        faceContainer.appendChild(centerIcon);
        // エールは文字を表示しない
    }
    else if (data.type === 'support') {
        const nameSpan = document.createElement('span');
        nameSpan.innerText = data.name || "";
        faceContainer.appendChild(nameSpan);

        if (data.category) {
            const catDiv = document.createElement('div');
            catDiv.className = 'card-support-category-initial';
            catDiv.innerText = data.category.charAt(0).toUpperCase();
            faceContainer.appendChild(catDiv);
        }
    }
    else if (data.type === 'oshi') {
        const nameSpan = document.createElement('span');
        nameSpan.innerText = data.name || "";
        faceContainer.appendChild(nameSpan);

        if (data.color) {
            const clDiv = document.createElement('div');
            clDiv.className = 'card-color-icon-oshi'; // 右下配置用クラス
            clDiv.style.background = COLORS[data.color] || 'white';
            faceContainer.appendChild(clDiv);
        }
    }
    else { // holomen
        const nameSpan = document.createElement('span');
        nameSpan.innerText = data.name || "";
        faceContainer.appendChild(nameSpan);

        if (data.color) {
            const clDiv = document.createElement('div');
            clDiv.className = 'card-color-icon';
            clDiv.style.background = COLORS[data.color] || 'white';
            faceContainer.appendChild(clDiv);
        }

        const currentHp = data.currentHp !== undefined ? data.currentHp : data.hp;
        const hpDiv = document.createElement('div');
        hpDiv.className = 'card-hp'; hpDiv.id = `hp-display-${data.id}`;
        hpDiv.innerText = currentHp || "";
        faceContainer.appendChild(hpDiv);

        if (data.bloom) {
            const bl = document.createElement('div'); bl.className = 'card-bloom';
            bl.innerText = data.bloom.charAt(0); faceContainer.appendChild(bl);
        }
        if (data.baton !== undefined) {
            const bDiv = document.createElement('div'); bDiv.className = 'card-baton';
            for (let i = 0; i < data.baton; i++) {
                const d = document.createElement('div'); d.className = 'baton-dot'; bDiv.appendChild(d);
            }
            faceContainer.appendChild(bDiv);
        }
    }

    el.classList.add(data.isFaceUp !== false ? 'face-up' : 'face-down');
    if (data.isRotated) el.classList.add('rotated');

    el.cardData = data;
    if (withEvents) setupCardEvents(el);
    return el;
}

/**
 * 拡大表示 (ズームとスタック管理)
 */
function openZoom(cardData, cardElement = null) {
    if (cardElement && cardElement.classList.contains('face-down')) {
        renderFaceDownZoom();
        return;
    }

    if (!cardData) return;
    const zoomOuter = document.getElementById('zoom-outer');
    const contentInner = document.querySelector('.zoom-content-inner');
    if (!zoomOuter || !contentInner) return;

    // スタック情報の取得
    let targetZoneId = cardData.zoneId;
    // cardElementからの取得を優先 (ドラッグ直後などで更新されている可能性があるため)
    if (cardElement && cardElement.dataset.zoneId) targetZoneId = cardElement.dataset.zoneId;

    let stackCards = [];
    if (targetZoneId && targetZoneId !== 'hand') {
        stackCards = Array.from(document.querySelectorAll('.card'))
            .filter(c => c.dataset.zoneId === targetZoneId)
            // zIndexの降順（上にあるものが先）
            .sort((a, b) => (parseInt(b.style.zIndex) || 0) - (parseInt(a.style.zIndex) || 0))
            .map(c => c.cardData);
    } else {
        stackCards = [cardData];
    }

    // データ不整合で空になった場合のフォールバック
    if (stackCards.length === 0) stackCards = [cardData];

    let currentDisplayCard = cardData;

    zoomOuter.className = 'zoom-outer-container-flex';
    zoomOuter.style.border = '';
    zoomOuter.style.backgroundColor = 'rgba(0,0,0,0.8)';

    const renderContent = () => {
        const hasStack = stackCards.length > 1;
        contentInner.innerHTML = `
            <div class="zoom-split-container">
                <div class="zoom-main-panel" id="zoom-main-panel"></div>
                ${hasStack ? `
                <div class="zoom-stack-panel">
                    <div class="stack-header">重なっているカード (${stackCards.length}枚)</div>
                    <div class="stack-list" id="zoom-stack-list"></div>
                </div>` : ''}
            </div>
        `;

        const mainPanel = document.getElementById('zoom-main-panel');
        mainPanel.innerHTML = generateCardDetailHtml(currentDisplayCard);

        if (hasStack) {
            const listPanel = document.getElementById('zoom-stack-list');
            const holoCount = stackCards.filter(c => c.type === 'holomen').length;
            const cheerCount = stackCards.filter(c => c.type === 'ayle').length;
            document.querySelector('.stack-header').innerHTML = `
                <div>Total: ${stackCards.length}枚</div>
                <div style="font-size:12px; font-weight:normal;">(Holomen: ${holoCount}, Cheer: ${cheerCount})</div>
            `;

            stackCards.forEach(c => {
                const item = document.createElement('div');
                item.className = 'stack-list-item';
                if (c.id === currentDisplayCard.id) item.classList.add('active');

                let label = c.name;
                let subInfo = "";
                if (c.type === 'ayle') {
                    label = `[エール] ${c.name}`;
                } else if (c.type === 'holomen') {
                    label = c.name;
                    subInfo = `<span class="stack-list-sub">${c.bloom}</span>`;
                } else {
                    label = `[${c.type.toUpperCase()}] ${c.name}`;
                }

                item.innerHTML = `
                    <div class="stack-item-info" onclick="switchZoomCard('${c.id}')">
                        <div class="stack-item-row">
                            <span class="stack-item-name">${label}</span>
                            ${subInfo}
                        </div>
                    </div>
                    <button class="btn-trash-stack" onclick="archiveStackCard('${c.id}')">破棄</button>
                `;
                listPanel.appendChild(item);
            });
        }
    };

    renderContent();
    zoomModal.style.display = 'flex';

    window.switchZoomCard = (id) => {
        const found = stackCards.find(c => c.id === id);
        if (found) {
            currentDisplayCard = found;
            renderContent();
        }
    };

    window.archiveStackCard = (id) => {
        if (!confirm("このカードをアーカイブ（トラッシュ）に送りますか？")) return;
        socket.emit('archiveCard', { id });
        zoomModal.style.display = 'none';
    };

    zoomModal.onclick = (e) => {
        if (e.target === zoomModal) zoomModal.style.display = 'none';
    };
}

// ヘルパー: 詳細HTML生成
function generateCardDetailHtml(cardData) {
    const colorCode = COLORS[cardData.color] || (cardData.type === 'ayle' ? COLORS[cardData.name.charAt(0)] : 'white');

    // 共通ヘッダーパーツ
    const colorIconHtml = `<div class="zoom-color-icon-large" style="background: ${colorCode};"></div>`;
    const nameCenterHtml = `<div class="zoom-name-center">${cardData.name}</div>`;

    if (cardData.type === 'support') {
        const limitedHtml = cardData.limited ? `<div class="zoom-support-limited-bar">LIMITED</div>` : "";
        return `
            <div class="holomen-zoom-layout" style="border: 5px solid rgba(188,226,232,1);">
                <div class="zoom-header-row">
                     <div class="zoom-support-label-box" style="background:#bdc3c7; color:#fff; padding:2px 8px; border-radius:4px; font-weight:bold;">SUPPORT</div>
                     <div class="zoom-support-category-below" style="position: absolute; top: 50px; left: 25px; font-size:14px; font-weight:bold; color:#7f8c8d;">${cardData.category || ''}</div>
                     ${nameCenterHtml}
                </div>
                <div class="zoom-body-row">
                    ${limitedHtml}
                    <div class="zoom-main-content" style="display:flex; justify-content:center; align-items:center; text-align:center; font-size:16px;">
                        ${cardData.text}
                    </div>
                </div>
                <div class="zoom-footer-row">
                    <div class="zoom-bottom-left-group">
                         <div class="zoom-tags-row">#${cardData.tags ? cardData.tags.join(' #') : ''}</div>
                    </div>
                </div>
            </div>`;
    }
    else if (cardData.type === 'ayle') {
        return `
            <div class="holomen-zoom-layout" style="border: 5px solid ${colorCode}">
                <div class="zoom-body-row" style="flex:1; display:flex; justify-content:center; align-items:center;">
                     <div style="width:100px; height:100px; border-radius:50%; background:${colorCode}; border:4px solid rgba(0,0,0,0.1);"></div>
                </div>
            </div>`;
    }
    else if (cardData.type === 'oshi') {
        const skillsHtml = (cardData.skills || []).map(s => `
            <div class="oshi-skill-bar ${s.name.includes('SP') ? 'oshi-sp' : 'oshi-normal'}" style="margin-bottom:10px; padding:10px; background:#fff; border:1px solid #eee; border-radius:8px;">
                <div class="oshi-skill-header" style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span class="oshi-skill-label" style="font-weight:bold; color:#0984e3;">${s.name}</span>
                    <div class="oshi-skill-cost">${(s.cost || []).map(c => `<div class="cost-dot-small" style="background:${COLORS[c] || 'white'}"></div>`).join('')}</div>
                </div>
                <div class="oshi-skill-text" style="font-size:12px; color:#636e72;">${s.text}</div>
            </div>`).join('');

        return `
            <div class="holomen-zoom-layout border-${cardData.color}">
                 <div class="zoom-body-row">
                    <div class="zoom-main-content">
                        ${skillsHtml}
                    </div>
                 </div>
                 <div class="zoom-footer-row" style="position:relative; height:80px;">
                     <!-- 名前 左下 -->
                     <div style="position:absolute; bottom:10px; left:10px; font-size:24px; font-weight:bold;">${cardData.name}</div>
                     
                     <!-- 右下グループ: Lifeの上にエールアイコン -->
                     <div style="position:absolute; bottom:10px; right:10px; display:flex; flex-direction:column; align-items:center;">
                         <div class="zoom-oshi-life-container" style="margin-bottom:5px; text-align:center;">
                             <div class="zoom-oshi-life-label" style="font-size:10px; color:#e74c3c; font-weight:bold;">LIFE</div>
                             <div class="zoom-oshi-life" style="font-size:20px; font-weight:bold; color:#e74c3c;">${cardData.hp}</div>
                         </div>
                         ${colorIconHtml}
                     </div>
                 </div>
            </div>`;
    }
    else {
        // Holomen
        const skillsHtml = (cardData.skills || []).map(s => {
            let typeLabel = ""; let typeClass = ""; let damageHtml = `<div class="skill-damage-text">${s.damage || ""}</div>`;
            if (s.type === 'gift') { typeLabel = "Gift"; typeClass = "label-gift"; damageHtml = ""; }
            else if (s.type === 'bloom') { typeLabel = "Bloom Effect"; typeClass = "label-bloom-effect"; damageHtml = ""; }
            else if (s.type === 'collab') { typeLabel = "Collab Effect"; typeClass = "label-collab-effect"; damageHtml = ""; }

            return `<div class="skill-box">
                <div class="skill-top-row">
                    <div class="skill-label-container">${typeLabel ? `<div class="effect-label ${typeClass}">${typeLabel}</div>` :
                    `<div class="skill-name-text">${s.name}</div>`}</div>
                    ${damageHtml}
                </div>
                ${!typeLabel ? '' : `<div class="skill-name-below">${s.name}</div>`}
                <div class="skill-text-detail">${s.text}</div>
            </div>`;
        }).join('');

        const extraHtml = cardData.extra ? `<div class="zoom-extra-area"><span class="extra-label">Extra</span>: ${cardData.extra}</div>` : "";
        const tagsHtml = (cardData.tags || []).map(t => `<span class="tag-item">#${t}</span>`).join(' ');

        const batonDots = (cardData.baton !== undefined && cardData.baton > 0)
            ? Array(cardData.baton).fill(`<div class="baton-dot-large" style="background:#bdc3c7"></div>`).join('')
            : "";

        return `
            <div class="holomen-zoom-layout border-${cardData.color}">
                 <div class="zoom-header-row">
                    <div class="zoom-bloom-rank">${cardData.bloom || ""}</div>
                    <div class="zoom-name-center">${cardData.name}</div>
                    <div class="zoom-top-right-group">
                        <div class="zoom-color-icon-large" style="background: ${colorCode};"></div>
                        <div class="zoom-hp-display-large"><span style="font-size:14px;">HP</span> ${cardData.currentHp !== undefined ? cardData.currentHp : cardData.hp}</div>
                    </div>
                 </div>
                 <div class="zoom-body-row">
                    <div class="zoom-main-content">${skillsHtml}</div>
                 </div>
                 <div class="zoom-footer-row">
                    <div class="zoom-bottom-left-group">
                        <div class="zoom-tags-row">${tagsHtml}</div>
                        ${batonDots ? `<div class="zoom-baton-row"><span>バトンタッチ:</span><div class="baton-icon-list">${batonDots}</div></div>` : ""}
                    </div>
                    <div class="zoom-bottom-right-group">
                        ${extraHtml}
                    </div>
                 </div>
            </div>`;
    }
}

function renderFaceDownZoom() {
    const zoomOuter = document.getElementById('zoom-outer');
    const contentInner = document.querySelector('.zoom-content-inner');
    zoomOuter.className = 'zoom-outer-container face-down-zoom';
    zoomOuter.style.border = '5px solid #fff';
    zoomOuter.style.backgroundColor = '#16213e';
    contentInner.innerHTML = `<div style="width:100%; height:100%; display:flex; justify-content:center; align-items:center;">
        <div style="font-size:20px; color:rgba(255,255,255,0.3); font-weight:bold;">HO-LIV</div>
    </div>`;
    zoomModal.style.display = 'flex';
    zoomModal.onclick = (e) => { if (e.target === zoomModal) zoomModal.style.display = 'none'; };
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
        // ... (省略なし)
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

    if (potentialZoomTarget && dist < 10) {
        openZoom(potentialZoomTarget.cardData, potentialZoomTarget);
    }

    if (isDragging && currentDragEl && dragStarted) {
        const hRect = handDiv.getBoundingClientRect();
        if (e.clientX > hRect.left && e.clientX < hRect.right && e.clientY > hRect.top && e.clientY < hRect.bottom) {
            currentStack.forEach(c => returnToHand(c));
        } else {
            let processed = false;

            // 1. エールのアタッチ判定
            if (currentStack.length === 1 && currentDragEl.cardData.type === 'ayle') {
                const centerP = { x: e.clientX, y: e.clientY };
                const targets = Array.from(document.querySelectorAll('.card')).filter(c =>
                    c !== currentDragEl &&
                    (c.cardData.type === 'holomen' || c.cardData.type === 'ayle') &&
                    c.dataset.zoneId && // ゾーンにあるもの限定
                    c.parentElement === field
                );

                for (let t of targets) {
                    const r = t.getBoundingClientRect();
                    if (centerP.x > r.left && centerP.x < r.right && centerP.y > r.top && centerP.y < r.bottom) {
                        let finalTargetId = t.id;
                        let finalZoneId = t.dataset.zoneId;

                        let holomenCard = null;
                        if (t.cardData.type === 'ayle') {
                            const parentHolomen = targets.find(cand => cand.dataset.zoneId === t.dataset.zoneId && cand.cardData.type === 'holomen');
                            if (parentHolomen) {
                                finalTargetId = parentHolomen.id;
                                holomenCard = parentHolomen;
                            }
                        } else {
                            holomenCard = t;
                        }

                        socket.emit('attachAyle', { cheerId: currentDragEl.id, targetId: finalTargetId });

                        // 楽観的更新
                        currentDragEl.dataset.zoneId = finalZoneId;

                        // Z-Index Logic: Always place newly attached Cheer at the BOTTOM of the stack
                        // Find the absolute minimum z-index in the target stack and go below it.
                        if (finalZoneId) {
                            const stack = Array.from(document.querySelectorAll('.card')).filter(c => c.dataset.zoneId === finalZoneId);
                            if (stack.length > 0) {
                                const minZ = Math.min(...stack.map(c => parseInt(c.style.zIndex) || 100));
                                // Make sure it goes below the lowest card
                                currentDragEl.style.zIndex = minZ - 1;
                            }
                        }

                        processed = true;
                        break;
                    }
                }
            }

            // 2. Bloom Logic (unchanged)
            if (!processed && currentStack.length === 1 && currentDragEl.cardData.type === 'holomen') {
                const centerP = { x: e.clientX, y: e.clientY };
                const targets = Array.from(document.querySelectorAll('.card')).filter(c =>
                    c !== currentDragEl && c.cardData.type === 'holomen' && c.parentElement === field
                );

                for (let t of targets) {
                    const r = t.getBoundingClientRect();
                    if (centerP.x > r.left && centerP.x < r.right && centerP.y > r.top && centerP.y < r.bottom) {
                        if (canBloom(currentDragEl.cardData, t.cardData)) {
                            currentDragEl.dataset.zoneId = t.dataset.zoneId;
                            const newZ = (parseInt(t.style.zIndex) || 0) + 1;
                            currentDragEl.style.zIndex = newZ;
                            socket.emit('moveCard', { id: currentDragEl.id, zoneId: t.dataset.zoneId, zIndex: newZ });
                            processed = true;
                        } else {
                            console.log("Bloom failure");
                        }
                        break;
                    }
                }
            }

            if (!processed) normalSnapStack(e);
        }
    }

    if (currentDragEl && e.pointerId !== undefined) currentDragEl.releasePointerCapture(e.pointerId);
    isDragging = false; dragStarted = false; currentDragEl = null; currentStack = []; potentialZoomTarget = null;
    repositionCards();
};

function canBloom(dragCard, targetCard) {
    if (!dragCard || !targetCard || dragCard.type !== 'holomen' || targetCard.type !== 'holomen') return false;
    if (dragCard.name !== targetCard.name) return false;

    const ranks = { 'Debut': 0, '1st': 1, '2nd': 2 };
    const dragRank = ranks[dragCard.bloom];
    const targetRank = ranks[targetCard.bloom];

    if (dragRank === targetRank + 1) return true;
    if (dragRank === 1 && targetRank === 1) return true;

    return false;
}
function createCardElement(data, withEvents = true) {
    if (!data) return document.createElement('div');
    const el = document.createElement('div'); el.id = data.id || ""; el.className = 'card';

    // 種別クラスの付与
    if (data.type === 'oshi') el.classList.add('oshi-card');
    if (data.type === 'ayle') el.classList.add('ayle-card');
    if (data.type === 'support') el.classList.add('support-card');

    // 属性色の適用 (サポート以外)
    if (data.type !== 'support') {
        const colorVal = data.color || (data.type === 'ayle' ? data.name.charAt(0) : null);
        const colorKey = COLORS[colorVal] || 'white';
        el.classList.add('border-' + colorKey);
    }

    // 表面用の要素コンテナ（裏面時はCSSで隠す、あるいは裏返す）
    const faceContainer = document.createElement('div');
    faceContainer.className = 'card-face-content';
    el.appendChild(faceContainer);

    // 内部表示の分岐
    if (data.type === 'ayle') {
        const centerIcon = document.createElement('div');
        centerIcon.className = 'ayle-center-icon';
        centerIcon.style.background = COLORS[data.name.charAt(0)] || 'white';
        // 表面コンテナに追加（裏面時は隠れる）
        faceContainer.appendChild(centerIcon);
    }
    else if (data.type === 'support') {
        const nameSpan = document.createElement('span');
        nameSpan.innerText = data.name || "";
        faceContainer.appendChild(nameSpan);
        if (data.category) {
            const catDiv = document.createElement('div');
            catDiv.className = 'card-support-category-initial';
            catDiv.innerText = data.category.charAt(0).toUpperCase();
            faceContainer.appendChild(catDiv);
        }
    }
    else if (data.type === 'oshi') {
        const nameSpan = document.createElement('span');
        nameSpan.innerText = data.name || "";
        faceContainer.appendChild(nameSpan);

        if (data.color) {
            const clDiv = document.createElement('div');
            clDiv.className = 'card-color-icon';
            clDiv.style.background = COLORS[data.color] || 'white';
            faceContainer.appendChild(clDiv);
        }
    }
    else { // holomen
        const nameSpan = document.createElement('span');
        nameSpan.innerText = data.name || "";
        faceContainer.appendChild(nameSpan);

        if (data.color) {
            const clDiv = document.createElement('div');
            clDiv.className = 'card-color-icon';
            clDiv.style.background = COLORS[data.color] || 'white';
            faceContainer.appendChild(clDiv);
        }

        const currentHp = data.currentHp !== undefined ? data.currentHp : data.hp;
        const hpDiv = document.createElement('div');
        hpDiv.className = 'card-hp'; hpDiv.id = `hp-display-${data.id}`;
        hpDiv.innerText = currentHp || "";
        faceContainer.appendChild(hpDiv);

        if (data.bloom) {
            const bl = document.createElement('div'); bl.className = 'card-bloom';
            bl.innerText = data.bloom.charAt(0); faceContainer.appendChild(bl);
        }
        if (data.baton !== undefined) {
            const bDiv = document.createElement('div'); bDiv.className = 'card-baton';
            for (let i = 0; i < data.baton; i++) {
                const d = document.createElement('div'); d.className = 'baton-dot'; bDiv.appendChild(d);
            }
            faceContainer.appendChild(bDiv);
        }
    }

    el.classList.add(data.isFaceUp !== false ? 'face-up' : 'face-down');
    if (data.isRotated) el.classList.add('rotated');

    el.cardData = data;
    if (withEvents) setupCardEvents(el);
    return el;
}

/**
 * 拡大表示 (ズーム)
 * 背景クリックで閉じる機能を搭載
 */
/**
 * 拡大表示 (ズームとスタック管理)
 */
function openZoom(cardData, cardElement = null) {
    // 裏向きカードの場合は詳細を見せない
    if (cardElement && cardElement.classList.contains('face-down')) {
        renderFaceDownZoom();
        return;
    }

    if (!cardData) return;
    const zoomOuter = document.getElementById('zoom-outer');
    const contentInner = document.querySelector('.zoom-content-inner');
    if (!zoomOuter || !contentInner) return;

    // スタック情報の取得
    // 同一ゾーンにあるカードをすべて取得し、Z-Index順でソート
    // cardElementが属するゾーンIDを取得
    let targetZoneId = cardData.zoneId;
    if (cardElement && cardElement.dataset.zoneId) targetZoneId = cardElement.dataset.zoneId;

    let stackCards = [];
    if (targetZoneId && targetZoneId !== 'hand') { // 手札以外ならスタック判定
        stackCards = Array.from(document.querySelectorAll('.card'))
            .filter(c => c.dataset.zoneId === targetZoneId)
            .sort((a, b) => (parseInt(b.style.zIndex) || 0) - (parseInt(a.style.zIndex) || 0)) // 上から順
            .map(c => c.cardData);
    } else {
        stackCards = [cardData];
    }

    // 表示対象（一番上のカード、または選択されたカード）
    let currentDisplayCard = cardData;

    zoomOuter.className = 'zoom-outer-container-flex'; // Flexレイアウト用クラスに変更推奨 (css要調整)
    zoomOuter.style.border = '';
    zoomOuter.style.backgroundColor = 'rgba(0,0,0,0.8)'; // 全体背景暗く

    // HTML構築
    // 左側: 現在選択中のカード詳細
    // 右側: スタックリスト

    const renderContent = () => {
        const hasStack = stackCards.length > 1;
        contentInner.innerHTML = `
            <div class="zoom-split-container">
                <div class="zoom-main-panel" id="zoom-main-panel">
                    <!-- メインカード詳細がここに描画される -->
                </div>
                ${hasStack ? `
                <div class="zoom-stack-panel">
                    <div class="stack-header">重なっているカード (${stackCards.length}枚)</div>
                    <div class="stack-list" id="zoom-stack-list"></div>
                </div>` : ''}
            </div>
        `;

        // メインパネル描画
        const mainPanel = document.getElementById('zoom-main-panel');
        mainPanel.innerHTML = generateCardDetailHtml(currentDisplayCard);

        if (hasStack) {
            // スタックリスト描画
            const listPanel = document.getElementById('zoom-stack-list');
            // 重なっているカードの枚数等内訳を表示（デバッグ的にも便利）
            const holoCount = stackCards.filter(c => c.type === 'holomen').length;
            const cheerCount = stackCards.filter(c => c.type === 'ayle').length;
            document.querySelector('.stack-header').innerHTML = `
                <div>Total: ${stackCards.length}枚</div>
                <div style="font-size:12px; font-weight:normal;">(Holomen: ${holoCount}, Cheer: ${cheerCount})</div>
            `;

            stackCards.forEach(c => {
                const item = document.createElement('div');
                item.className = 'stack-list-item';
                if (c.id === currentDisplayCard.id) item.classList.add('active');

                let label = c.name;
                let subInfo = "";
                if (c.type === 'ayle') {
                    label = `[エール] ${c.name}`;
                } else if (c.type === 'holomen') {
                    label = c.name;
                    subInfo = `<span class="stack-list-sub">${c.bloom}</span>`;
                } else {
                    label = `[${c.type.toUpperCase()}] ${c.name}`;
                }

                item.innerHTML = `
                    <div class="stack-item-info" onclick="switchZoomCard('${c.id}')">
                        <div class="stack-item-row">
                            <span class="stack-item-name">${label}</span>
                            ${subInfo}
                        </div>
                    </div>
                    <button class="btn-trash-stack" onclick="archiveStackCard('${c.id}')">破棄</button>
                `;
                listPanel.appendChild(item);
            });
        }
    };

    renderContent();
    zoomModal.style.display = 'flex';

    // グローバル関数として登録（HTML内のonclickから呼ぶため）
    window.switchZoomCard = (id) => {
        const found = stackCards.find(c => c.id === id);
        if (found) {
            currentDisplayCard = found;
            renderContent();
        }
    };

    window.archiveStackCard = (id) => {
        if (!confirm("このカードをアーカイブ（トラッシュ）に送りますか？")) return;
        socket.emit('archiveCard', { id });
        zoomModal.style.display = 'none'; // 一旦閉じる
    };

    zoomModal.onclick = (e) => {
        if (e.target === zoomModal) zoomModal.style.display = 'none';
    };
}

// ヘルパー: 詳細HTML生成
function generateCardDetailHtml(cardData) {
    const colorCode = COLORS[cardData.color] || (cardData.type === 'ayle' ? COLORS[cardData.name.charAt(0)] : 'white');

    // 共通のレイアウトクラスを使用 (holomen-zoom-layoutを汎用化、あるいは各タイプで同じ構造を持つ)
    // ここでは各タイプ専用の内部コンテンツを生成し、共通ラッパーで包む形にするか、
    // 既存の `holomen-zoom-layout` のスタイルを流用する

    // 共通ヘッダーパーツ
    const colorIconHtml = `<div class="zoom-color-icon-large" style="background: ${colorCode};"></div>`;
    const nameCenterHtml = `<div class="zoom-name-center">${cardData.name}</div>`;

    if (cardData.type === 'support') {
        const limitedHtml = cardData.limited ? `<div class="zoom-support-limited-bar">LIMITED</div>` : "";
        return `
            <div class="holomen-zoom-layout border-${cardData.category ? 'blue' : 'white'}">
                <div class="zoom-header-row">
                     <div class="zoom-support-label-box" style="background:#bdc3c7; color:#fff; padding:2px 8px; border-radius:4px; font-weight:bold;">SUPPORT</div>
                     ${nameCenterHtml}
                     <div class="zoom-top-right-group">
                        <div class="zoom-support-category-ribbon" style="font-size:16px; color:#2c3e50; font-weight:bold;">${cardData.category || 'Event'}</div>
                     </div>
                </div>
                <div class="zoom-body-row">
                    ${limitedHtml}
                    <div class="zoom-main-content" style="display:flex; justify-content:center; align-items:center; text-align:center; font-size:16px;">
                        ${cardData.text}
                    </div>
                </div>
                <div class="zoom-footer-row">
                    <div class="zoom-bottom-left-group">
                         <div class="zoom-tags-row">#${cardData.tags ? cardData.tags.join(' #') : ''}</div>
                    </div>
                </div>
            </div>`;
    }
    else if (cardData.type === 'ayle') {
        return `
            <div class="holomen-zoom-layout" style="border: 5px solid ${colorCode}">
                <div class="zoom-header-row">
                     <div style="background:${colorCode}; color:#fff; padding:2px 8px; border-radius:4px; font-weight:bold;">CHEER</div>
                     ${nameCenterHtml}
                     <div class="zoom-top-right-group">
                        ${colorIconHtml}
                     </div>
                </div>
                <div class="zoom-body-row">
                    <div class="zoom-main-content" style="display:flex; justify-content:center; align-items:center;">
                         <!-- エールアイコンなどを大きく表示しても良い -->
                         <div style="font-size:40px; color:${colorCode};">●</div>
                    </div>
                </div>
            </div>`;
    }
    else if (cardData.type === 'oshi') {
        const skillsHtml = (cardData.skills || []).map(s => `
            <div class="oshi-skill-bar ${s.name.includes('SP') ? 'oshi-sp' : 'oshi-normal'}" style="margin-bottom:10px; padding:10px; background:#fff; border:1px solid #eee; border-radius:8px;">
                <div class="oshi-skill-header" style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span class="oshi-skill-label" style="font-weight:bold; color:#0984e3;">${s.name}</span>
                    <div class="oshi-skill-cost">${(s.cost || []).map(c => `<div class="cost-dot-small" style="background:${COLORS[c] || 'white'}"></div>`).join('')}</div>
                </div>
                <div class="oshi-skill-text" style="font-size:12px; color:#636e72;">${s.text}</div>
            </div>`).join('');

        return `
            <div class="holomen-zoom-layout border-${cardData.color}">
                 <div class="zoom-header-row">
                    <div style="background:#e84393; color:#fff; padding:2px 8px; border-radius:4px; font-weight:bold;">OSHI</div>
                    ${nameCenterHtml}
                    <div class="zoom-top-right-group">
                        ${colorIconHtml}
                        <div class="zoom-hp-display-large"><span style="font-size:14px;">LIFE</span> ${cardData.hp}</div>
                    </div>
                 </div>
                 <div class="zoom-body-row">
                    <div class="zoom-main-content">
                        ${skillsHtml}
                    </div>
                 </div>
            </div>`;
    }
    else {
        // Holomen
        const skillsHtml = (cardData.skills || []).map(s => {
            let typeLabel = "";
            let typeClass = "";
            let damageHtml = `<div class="skill-damage-text">${s.damage || ""}</div>`;
            let showDamage = true;

            if (s.type === 'gift') {
                typeLabel = "G ギフト";
                typeClass = "label-gift";
                showDamage = false;
            }
            else if (s.type === 'bloom') {
                typeLabel = "B ブルームエフェクト";
                typeClass = "label-bloom-effect";
                showDamage = false;
            }
            else if (s.type === 'collab') {
                typeLabel = "C コラボエフェクト";
                typeClass = "label-collab-effect";
                showDamage = false;
            }

            // Layout determination
            // If it's a special effect, Name is centered, Label is on left.
            // If it's a normal Art, Name is on left (no label), Damage is on right.

            let topRowContent = "";

            if (typeLabel) {
                // Effect Layout: Label(Left) - Name(Center)
                topRowContent = `
                    <div class="skill-label-container"><div class="effect-label ${typeClass}">${typeLabel}</div></div>
                    <div class="skill-name-center-absolute">${s.name}</div>
                 `;
            } else {
                // Normal Art Layout: Name(Left) - Damage(Right)
                topRowContent = `
                    <div class="skill-label-container"><div class="skill-name-text">${s.name}</div></div>
                    ${damageHtml}
                 `;
            }

            return `<div class="skill-box">
                <div class="skill-top-row">
                    ${topRowContent}
                </div>
                <div class="skill-text-detail">${s.text}</div>
            </div>`;
        }).join('');

        const extraHtml = cardData.extra ? `<div class="zoom-extra-area"><span class="extra-label">エクストラ</span>: ${cardData.extra}</div>` : "";
        const tagsHtml = (cardData.tags || []).map(t => `<span class="tag-item">#${t}</span>`).join(' ');

        // バトンタッチ詳細化
        const batonDots = (cardData.baton !== undefined && cardData.baton > 0)
            ? Array(cardData.baton).fill(`<div class="baton-dot-large" style="background:#bdc3c7"></div>`).join('')
            : "";

        return `
            <div class="holomen-zoom-layout border-${cardData.color}">
                 <div class="zoom-header-row">
                    <div class="zoom-bloom-rank">${cardData.bloom || ""}</div>
                    <div class="zoom-name-center">${cardData.name}</div>
                    <div class="zoom-top-right-group">
                        <div class="zoom-color-icon-large" style="background: ${colorCode};"></div>
                        <div class="zoom-hp-display-large"><span style="font-size:14px;">HP</span> ${cardData.currentHp !== undefined ? cardData.currentHp : cardData.hp}</div>
                    </div>
                 </div>
                 <div class="zoom-body-row">
                    <div class="zoom-main-content">${skillsHtml}</div>
                 </div>
                 <div class="zoom-footer-row">
                    <div class="zoom-bottom-left-group">
                        <div class="zoom-tags-row">${tagsHtml}</div>
                        ${batonDots ? `<div class="zoom-baton-row"><span>バトンタッチ:</span><div class="baton-icon-list">${batonDots}</div></div>` : ""}
                    </div>
                    <div class="zoom-bottom-right-group">
                        ${extraHtml}
                    </div>
                 </div>
            </div>`;
    }
}

function renderFaceDownZoom() {
    const zoomOuter = document.getElementById('zoom-outer');
    const contentInner = document.querySelector('.zoom-content-inner');
    zoomOuter.className = 'zoom-outer-container face-down-zoom';
    zoomOuter.style.border = '5px solid #fff';
    zoomOuter.style.backgroundColor = '#16213e';
    contentInner.innerHTML = `<div style="width:100%; height:100%; display:flex; justify-content:center; align-items:center;">
        <div style="font-size:20px; color:rgba(255,255,255,0.3); font-weight:bold;">HO-LIV</div>
    </div>`;
    zoomModal.style.display = 'flex';
    zoomModal.onclick = (e) => { if (e.target === zoomModal) zoomModal.style.display = 'none'; };
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
            let processed = false;

            // 1. エールのアタッチ判定 (ドラッグ中のカードがエールで、単一選択の場合)
            if (currentStack.length === 1 && currentDragEl.cardData.type === 'ayle') {
                const centerP = { x: e.clientX, y: e.clientY };
                // ターゲット: ホロメンまたは既にアタッチされているエールカード
                const targets = Array.from(document.querySelectorAll('.card')).filter(c =>
                    c !== currentDragEl &&
                    (c.cardData.type === 'holomen' || c.cardData.type === 'ayle') &&
                    c.dataset.zoneId && // ゾーンにあるもの限定
                    c.parentElement === field
                );

                for (let t of targets) {
                    const r = t.getBoundingClientRect();
                    // 重なり判定
                    if (centerP.x > r.left && centerP.x < r.right && centerP.y > r.top && centerP.y < r.bottom) {
                        // ターゲットがエールの場合は、そのゾーンにいるホロメンを探してターゲットIDを差し替えるとより安全
                        // (サーバーの attachedTo の整合性のため)
                        let finalTargetId = t.id;
                        let finalZoneId = t.dataset.zoneId;

                        // Determine real target (Holomen)
                        let holomenCard = null;
                        if (t.cardData.type === 'ayle') {
                            // 同じゾーンのホロメンを探す
                            holomenCard = targets.find(cand => cand.dataset.zoneId === t.dataset.zoneId && cand.cardData.type === 'holomen');
                            if (holomenCard) finalTargetId = holomenCard.id;
                        } else {
                            holomenCard = t;
                        }

                        socket.emit('attachAyle', { cheerId: currentDragEl.id, targetId: finalTargetId });

                        // 楽観的更新 update (snap-back防止)
                        currentDragEl.dataset.zoneId = finalZoneId;

                        // Fix Z-Index layering locally: Cheer should be below Holomen
                        // Calculate expected zIndex based on socket-handler logic: minZ - 1 - existingCount
                        // For local update, we can just grab the Holomen's z-index and subtract 1 or more.
                        if (holomenCard) {
                            const stack = Array.from(document.querySelectorAll('.card')).filter(c => c.dataset.zoneId === finalZoneId);
                            const minZ = Math.min(...stack.map(c => parseInt(c.style.zIndex) || 100));
                            currentDragEl.style.zIndex = minZ - 1;
                        }

                        processed = true;
                        break;
                    }
                }
            }

            // 2. ブルーム（ホロメン重ね）判定
            if (!processed && currentStack.length === 1 && currentDragEl.cardData.type === 'holomen') {
                const centerP = { x: e.clientX, y: e.clientY };
                // フィールド上の他のホロメンを探す
                const targets = Array.from(document.querySelectorAll('.card')).filter(c =>
                    c !== currentDragEl && c.cardData.type === 'holomen' && c.parentElement === field
                );

                for (let t of targets) {
                    const r = t.getBoundingClientRect();
                    // 重なり判定
                    if (centerP.x > r.left && centerP.x < r.right && centerP.y > r.top && centerP.y < r.bottom) {
                        // Bloomルール判定
                        if (canBloom(currentDragEl.cardData, t.cardData)) {
                            // 成功: ターゲットの上に重ねる
                            // サーバーへ移動リクエスト (zoneIdをターゲットと同じにし、zIndexを上げる)
                            currentDragEl.dataset.zoneId = t.dataset.zoneId;
                            // 重ね順はターゲットより上
                            const newZ = (parseInt(t.style.zIndex) || 0) + 1;
                            currentDragEl.style.zIndex = newZ;

                            socket.emit('moveCard', {
                                id: currentDragEl.id,
                                zoneId: t.dataset.zoneId,
                                zIndex: newZ
                            });
                            processed = true;
                        } else {
                            console.log("Bloom条件を満たしていません");
                        }
                        break;
                    }
                }
            }

            if (!processed) normalSnapStack(e);
        }
    }

    if (currentDragEl && e.pointerId !== undefined) currentDragEl.releasePointerCapture(e.pointerId);
    isDragging = false; dragStarted = false; currentDragEl = null; currentStack = []; potentialZoomTarget = null;
    repositionCards();
};

/**
 * ゾーン再整列ロジック (ライフゾーン 25px 間隔版)
 */
/**
 * ゾーン再整列ロジック (ライフゾーン 25px 間隔版)
 */
function repositionCards() {
    const zones = document.querySelectorAll('.zone');
    zones.forEach(zone => {
        let cards = Array.from(document.querySelectorAll('.card')).filter(c => c.dataset.zoneId === zone.id);
        if (cards.length === 0) return;

        // Sort logic: Ayle cards at bottom, others on top. Preserve relative order within groups.
        cards.sort((a, b) => {
            const typeA = a.cardData.type;
            const typeB = b.cardData.type;
            const zA = parseInt(a.style.zIndex) || 0;
            const zB = parseInt(b.style.zIndex) || 0;

            if (typeA === 'ayle' && typeB !== 'ayle') return -1;
            if (typeA !== 'ayle' && typeB === 'ayle') return 1;

            return zA - zB;
        });

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
    // 名前が異なるカードは重ねられない
    if (dragCard.name !== targetCard.name) return false;

    const ranks = { 'Debut': 0, '1st': 1, '2nd': 2 };
    const dragRank = ranks[dragCard.bloom];
    const targetRank = ranks[targetCard.bloom];

    // 通常の進化 (Debut->1st, 1st->2nd)
    if (dragRank === targetRank + 1) return true;

    // 1stの上に1stを重ねる (特別ルール)
    if (dragRank === 1 && targetRank === 1) return true;

    return false;
}
