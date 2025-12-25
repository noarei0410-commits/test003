/**
 * ゲーム共通ロジック
 * カードの生成、手札への追加、ドラッグ＆ドロップの基本動作を管理します [cite: 2025-12-25]。
 */

/**
 * 手札にカードを追加する
 * サーバーから受け取ったカードデータを元にDOMを生成し、手札エリアへ配置します [cite: 2025-12-25]。
 */
function addCardToHand(cardData) {
    if (!handDiv) return; // constants.js で取得済みの手札コンテナ

    // カード要素を生成
    const cardEl = createCardElement(cardData, false); // [cite: 2025-12-25]
    cardEl.classList.add('hand-card'); // [cite: 2025-12-25]

    // 手札のカードにドラッグイベントを設定
    setupDraggable(cardEl); // [cite: 2025-12-25]

    // 手札エリアに追加
    handDiv.appendChild(cardEl);
    
    // 配置の調整 (重なりや並びを整理)
    repositionCards(); // [cite: 2025-12-25]
}

/**
 * カードDOM要素の生成
 * JSONデータに基づき、属性色やHP、名前等を含むカードの外観を作成します。
 */
function createCardElement(data, isLibrary = false) {
    const card = document.createElement('div');
    card.className = `card ${data.type}`;
    card.dataset.id = data.id; // [cite: 2025-12-25]
    card.dataset.type = data.type;
    
    // 属性色の取得と適用
    const colorCode = COLORS[data.color] || '#ccc';
    card.style.borderColor = colorCode;
    card.style.boxShadow = `0 0 10px ${colorCode}44`;

    // 内部構造（ヘッダー、名前、フッター）の構築
    card.innerHTML = `
        <div class="card-header">
            <span class="card-bloom">${data.bloom || ''}</span>
            <span class="card-hp" style="color:${colorCode}">${data.hp || ''}</span>
        </div>
        <div class="card-name">${data.name}</div>
        <div class="card-footer">
            <div class="card-type-icon">${data.type === 'holomen' ? '●' : '■'}</div>
        </div>
    `;

    return card;
}

/**
 * ドラッグ可能にするための初期設定
 */
function setupDraggable(el) {
    el.addEventListener('pointerdown', onPointerDown);
}

/**
 * ドラッグ開始処理
 */
function onPointerDown(e) {
    if (myRole !== 'player') return; // 観戦者は操作不可
    
    isDragging = true; //
    dragStarted = false;
    currentDragEl = e.currentTarget; //
    
    const rect = currentDragEl.getBoundingClientRect();
    startX = e.clientX; //
    startY = e.clientY; //
    offsetX = e.clientX - rect.left; //
    offsetY = e.clientY - rect.top; //

    currentDragEl.style.zIndex = ++maxZIndex; //
    currentDragEl.setPointerCapture(e.pointerId);

    currentDragEl.addEventListener('pointermove', onPointerMove);
    currentDragEl.addEventListener('pointerup', onPointerUp);
}

function onPointerMove(e) {
    if (!isDragging || !currentDragEl) return;
    const x = e.clientX - offsetX;
    const y = e.clientY - offsetY;
    currentDragEl.style.position = 'fixed';
    currentDragEl.style.left = `${x}px`;
    currentDragEl.style.top = `${y}px`;
    dragStarted = true;
}

function onPointerUp(e) {
    if (!isDragging || !currentDragEl) return;
    isDragging = false;
    currentDragEl.releasePointerCapture(e.pointerId);
    currentDragEl.removeEventListener('pointermove', onPointerMove);
    currentDragEl.removeEventListener('pointerup', onPointerUp);
    repositionCards(); // [cite: 2025-12-25]
}

function repositionCards() {
    if (!handDiv) return;
    const cards = handDiv.querySelectorAll('.hand-card');
    cards.forEach(card => {
        if (isDragging && card === currentDragEl) return;
        card.style.position = 'relative';
        card.style.left = '0';
        card.style.top = '0';
    });
}
