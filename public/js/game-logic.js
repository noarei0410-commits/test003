/**
 * カードDOMの生成
 */
function createCardElement(data, withEvents = true) {
    if (!data) return document.createElement('div');
    const el = document.createElement('div'); el.id = data.id || ""; el.className = 'card';
    
    // エール色に基づいたボーダークラスを追加
    if (data.color) {
        const colorKey = COLORS[data.color] || 'white';
        el.classList.add('border-' + colorKey);
    }

    // 推しホロメン専用クラス
    if (data.type === 'oshi') {
        el.classList.add('oshi-card');
    }

    const nameSpan = document.createElement('span');
    nameSpan.innerText = data.name || ""; 
    el.appendChild(nameSpan);

    el.classList.add(data.isFaceUp !== false ? 'face-up' : 'face-down');
    if (data.isRotated) el.classList.add('rotated');

    // 共通パーツの配置
    if (data.type === 'holomen' || data.type === 'oshi') {
        const currentHp = data.currentHp !== undefined ? data.currentHp : data.hp;
        
        // 拡大前カラーアイコン (推しはoshi.cssで右下に配置される)
        if (data.color) {
            const clDiv = document.createElement('div'); 
            clDiv.className = 'card-color-icon'; 
            const colorCode = COLORS[data.color] || 'white';
            clDiv.style.background = colorCode;
            el.appendChild(clDiv);
        }

        // ホロメンのみHPを表示
        if (data.type === 'holomen') {
            const hpDiv = document.createElement('div'); 
            hpDiv.className = 'card-hp'; 
            hpDiv.id = `hp-display-${data.id}`;
            hpDiv.innerText = currentHp || ""; 
            el.appendChild(hpDiv);
            if (data.bloom) {
                const bl = document.createElement('div'); bl.className = 'card-bloom'; bl.innerText = data.bloom.charAt(0); el.appendChild(bl);
            }
            if (data.baton !== undefined) {
                const bDiv = document.createElement('div'); bDiv.className = 'card-baton';
                for(let i=0; i<data.baton; i++) { const d=document.createElement('div'); d.className='baton-dot'; bDiv.appendChild(d); }
                el.appendChild(bDiv);
            }
        }
    }

    el.cardData = data;
    if (withEvents) setupCardEvents(el);
    return el;
}

/**
 * 拡大表示 (推しホロメン専用レイアウト対応)
 */
function openZoom(cardData, cardElement = null) {
    if (!cardData) return;
    
    const zoomOuter = document.getElementById('zoom-outer');
    const contentInner = document.querySelector('.zoom-content-inner');
    if (!zoomOuter || !contentInner) return;

    zoomOuter.className = 'zoom-outer-container';
    if (cardData.color) { zoomOuter.classList.add('border-' + (COLORS[cardData.color] || 'white')); }
    const colorCode = COLORS[cardData.color] || 'white';

    // --- 推しホロメン用レイアウト ---
    if (cardData.type === 'oshi') {
        zoomOuter.classList.add('oshi-zoom');
        
        const skillsHtml = (cardData.skills || []).map((s, idx) => {
            const isSP = s.name.includes("SP");
            const costIcons = (s.cost || []).map(c => `<div class="cost-dot-small" style="background: #ddd;"></div>`).join('');
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
                    <div class="zoom-oshi-life">${cardData.hp || 0}</div>
                    <div class="zoom-oshi-color-large" style="background: ${colorCode};"></div>
                </div>
            </div>
        `;
    } 
    // --- 通常ホロメン用レイアウト (既存) ---
    else {
        // ... (以前のホロメン用ロジックをここに記述)
        const isSpec = (myRole === 'spectator');
        let attachedAyles = [];
        if (cardElement && cardElement.parentElement === field) {
            const r = cardElement.getBoundingClientRect();
            attachedAyles = Array.from(document.querySelectorAll('.card')).filter(c => c !== cardElement && c.cardData.type === 'ayle').filter(c => { const cr = c.getBoundingClientRect(); return Math.abs(cr.left - r.left) < 10 && Math.abs(cr.top - r.top) < 10; }).map(c => c.cardData);
        }
        const hpControlsHtml = (!isSpec && cardData.type === 'holomen') ? `<div class="zoom-hp-controls-inline"><button class="btn-zoom-hp-inline minus" onclick="changeHp('${cardData.id}', -10)">-</button><button class="btn-zoom-hp-inline plus" onclick="changeHp('${cardData.id}', 10)">+</button></div>` : "";
        const skillsHtml = (cardData.skills || []).map((s) => {
            let leftContent = ""; let showDamage = false;
            if (s.type === 'gift') leftContent = `<div class="effect-label label-gift">G ギフト</div>`;
            else if (s.type === 'bloom') leftContent = `<div class="effect-label label-bloom-effect">B ブルームエフェクト</div>`;
            else if (s.type === 'collab') leftContent = `<div class="effect-label label-collab-effect">C コラボエフェクト</div>`;
            else { showDamage = true; const costIcons = (s.cost || []).map(c => { const colorCode = c === 'any' ? '#ddd' : (COLORS[c] || c); return `<div class="cost-dot-small" style="background: ${colorCode};"></div>`; }).join(''); leftContent = `<div class="skill-label-container">${costIcons}</div>`; }
            const isReady = (s.type === 'arts' || !s.type) && canUseArt(s.cost, attachedAyles);
            const readyBadge = isReady ? `<span class="ready-badge">READY</span>` : "";
            const skillText = (s.text === "なし" || !s.text) ? "" : s.text;
            return `<div class="skill-box"><div class="skill-top-row"><div class="skill-label-container">${leftContent}</div><div class="skill-name-container-center"><span class="skill-name-text">${s.name}</span>${readyBadge}</div><div class="skill-damage-text">${showDamage ? (s.damage || "") : ""}</div></div>${skillText ? `<div class="skill-text-detail">${skillText}</div>` : ""}</div>`;
        }).join('');
        const batonIcons = Array(cardData.baton || 0).fill('<div class="baton-dot-large"></div>').join('');
        const extraHtml = cardData.extra ? `<div class="zoom-extra-area"><span class="extra-label">エクストラ：</span>${cardData.extra}</div>` : "";
        contentInner.innerHTML = `<div class="zoom-bloom-rank">${cardData.bloom || ""}</div><div class="zoom-name-center">${cardData.name}</div><div class="zoom-top-right-group"><div class="zoom-color-icon-large" style="background: ${colorCode};"></div><div class="zoom-hp-container-row">${hpControlsHtml}<div class="zoom-hp-display" id="zoom-hp-val">HP ${cardData.currentHp || cardData.hp || 0}</div></div></div><div class="zoom-main-content">${skillsHtml}</div><div class="zoom-bottom-left-group"><div class="zoom-tags-row">${(cardData.tags || []).map(t => `<span>#${t}</span>`).join(' ')}</div><div class="zoom-baton-row"><span>バトンタッチ:</span><div class="baton-icon-list">${batonIcons}</div></div></div>${extraHtml}`;
    }

    zoomModal.style.display = 'flex';
    zoomModal.onclick = (e) => { if (e.target === zoomModal) zoomModal.style.display = 'none'; };
}

// ... (repositionCards, changeHp, setupCardEvents 等の残りの関数は既存のまま)
