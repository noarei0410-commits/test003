/**
 * カード描画ロジック (HTML生成)
 */

// ヘルパー: 詳細HTML生成
function generateCardDetailHtml(cardData, stackCards = []) {
    const colorCode = COLORS[cardData.color] || (cardData.type === 'ayle' ? COLORS[cardData.name.charAt(0)] : 'white');

    if (cardData.type === 'holomen') {
        const skillsHtml = (cardData.skills || []).map(s => {
            let typeLabel = "";
            let typeClass = "";
            let damageHtml = s.damage ? `<div class="art-damage">${s.damage}</div>` : "";

            // コストアイコン生成
            let costHtml = "";
            let canActivate = false;

            if (s.cost && Array.isArray(s.cost)) {
                // COLORS['any'] (gray) will be used here from constants.js
                // アイコンスタイル: margin-right: 2px, size: 18px estimate
                const dots = s.cost.map(c => `<div class="cost-icon-art" style="background:${COLORS[c] || 'white'};"></div>`).join('');
                costHtml = `<div class="skill-cost-container">${dots}</div>`;

                // 発動可能か判定 (game-logic.jsの関数を使用)
                if (typeof checkCostSatisfied === 'function' && checkCostSatisfied(s.cost, stackCards)) {
                    canActivate = true;
                }
            } else {
                canActivate = true; // コストなしは発動可能
            }

            // Button HTML
            let buttonHtml = "";
            if (s.type === 'arts' || (!s.type && s.damage)) { // Normal Art assumption
                if (canActivate) {
                    buttonHtml = `<button class="btn-art-active" onclick="activateArt('${cardData.id}', '${s.name}')">発動</button>`;
                } else {
                    buttonHtml = `<button class="btn-art-inactive">不足</button>`;
                }
            }

            if (s.type === 'gift') {
                typeLabel = "G ギフト";
                typeClass = "label-gift";
            }
            else if (s.type === 'bloom') {
                typeLabel = "B ブルームエフェクト";
                typeClass = "label-bloom-effect";
            }
            else if (s.type === 'collab') {
                typeLabel = "C コラボエフェクト";
                typeClass = "label-collab-effect";
            }

            // Arts Layout Construction
            // Grid Layout: [Icons] [Name (Center)] [Damage] [Button]
            // If it's an effect, use flexible layout.

            let topRowContent = "";

            if (typeLabel) {
                // Effect Layout
                topRowContent = `
                    <div class="skill-effect-row">
                        <div class="effect-label ${typeClass}">${typeLabel}</div>
                        <div class="skill-name-center">${s.name}</div>
                    </div>
                 `;
            } else {
                // Art Layout
                topRowContent = `
                    <div class="skill-art-row">
                        <div class="art-cost-area">${costHtml}</div>
                        <div class="art-name-area">${s.name}</div>
                        <div class="art-damage-area">${damageHtml}</div>
                        <div class="art-button-area">${buttonHtml}</div>
                    </div>
                 `;
            }

            return `<div class="skill-box">
                <div class="skill-top-wrapper">
                    ${topRowContent}
                </div>
                <div class="skill-text-detail">${s.text}</div>
            </div>`;
        }).join('');

        const extraHtml = cardData.extra ? `<div class="zoom-extra-area"><span class="extra-label">エクストラ</span>: ${cardData.extra}</div>` : "";
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
    else if (cardData.type === 'support') {
        const skillsHtml = (cardData.skills || []).map(s => `
            <div class="support-skill-box">
                <div class="support-skill-name">${s.name || "Effect"}</div>
                <div class="support-skill-text">${s.text}</div>
            </div>`).join('');

        // Use the new reference style for Support
        return `
            <div class="zoom-support-container">
                <div class="support-top-decoration"></div>
                <div class="support-header">
                    <div class="support-label-box">SUPPORT</div>
                    <div class="support-category-tab">${cardData.subType || "ITEM"}</div>
                    <!-- LIMITED bar if needed -->
                    <div class="support-limited-bar"></div>
                </div>
                <div class="support-name-bar">
                    <span class="support-name-text">${cardData.name}</span>
                </div>
                <div class="support-body-box">
                    <div class="support-main-content">
                         ${skillsHtml}
                    </div>
                     <div class="support-tags-area">
                        ${(cardData.tags || []).map(t => `<span class="support-tag">#${t}</span>`).join('')}
                    </div>
                </div>
            </div>
        `;
    }
    else if (cardData.type === 'ayle') {
        return `
            <div class="holomen-zoom-layout border-${cardData.color || 'white'}">
                 <div class="zoom-header-row">
                    <div class="zoom-name-center" style="font-size:24px;">${cardData.name}</div>
                 </div>
                 <div class="zoom-body-row" style="justify-content:center; align-items:center;">
                    <div style="font-size:100px; color:${colorCode};">●</div>
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
                    <div class="zoom-name-center">${cardData.name}</div>
                    <div class="zoom-top-right-group">
                        <div class="zoom-color-icon-large" style="background: ${colorCode};"></div>
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


