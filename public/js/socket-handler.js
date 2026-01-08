/**
 * サーバーからの通信イベントを処理し、対戦フィールドの状態を同期します。
 */

/**
 * 盤面のカードを復元・生成するヘルパー関数
 */
function restoreCard(id, info) {
    const el = createCardElement({ id, ...info });
    el.dataset.zoneId = info.zoneId || "";
    el.style.zIndex = info.zIndex || 100;

    // 表裏・回転状態の適用
    if (info.isFaceUp !== undefined) {
        el.classList.toggle('face-up', info.isFaceUp);
        el.classList.toggle('face-down', !info.isFaceUp);
    }
    if (info.isRotated !== undefined) el.classList.toggle('rotated', info.isRotated);

    // フィールドへ追加
    field.appendChild(el);
    repositionCards();
}

// ---------------------------------------------------------
// Socket.io イベントリスナー
// ---------------------------------------------------------

/**
 * 初期化処理 (ルーム参加時)
 */
socket.on('init', (d) => {
    myRole = d.role;
    // フィールドのカードを一度リセット
    field.querySelectorAll('.card').forEach(c => c.remove());

    // サーバー上の fieldState から現在の盤面を復元
    if (d.fieldState) {
        for (const id in d.fieldState) restoreCard(id, d.fieldState[id]);
    }

    // デッキ枚数の初期同期
    if (d.deckCount) {
        const mc = document.getElementById('mainCount'); if (mc) mc.innerText = d.deckCount.main;
        const cc = document.getElementById('cheerCount'); if (cc) cc.innerText = d.deckCount.cheer;
    }

    document.getElementById('room-info').innerText = `Room: ${socket.roomId} (${d.role})`;
});

/**
 * ゲーム開始 (セットアップ完了時)
 */
socket.on('gameStarted', (d) => {
    // フィールドと手札を空にする
    field.querySelectorAll('.card').forEach(c => c.remove());
    handDiv.innerHTML = "";

    // サーバーから送られた初期配置（推し・ライフ等）を展開
    for (const id in d.fieldState) restoreCard(id, d.fieldState[id]);
    repositionCards();
});

/**
 * カードの受信 (ドロー・デッキからのピック時)
 */
socket.on('receiveCard', (d) => {
    // 自分が引いたカードを生成（手札用なので表向き）
    const el = createCardElement({ ...d, isFaceUp: true });
    el.style.position = 'relative';
    handDiv.appendChild(el);

    // 手札内の整列を促す（CSS側で制御されているが念のため）
    if (typeof repositionCards === 'function') repositionCards();
});

/**
 * 他プレイヤーによるカード移動の同期
 */
socket.on('cardMoved', (d) => {
    let el = document.getElementById(d.id);
    // もし手元に要素がない場合は新しく生成して配置
    if (!el) return restoreCard(d.id, d);

    el.dataset.zoneId = d.zoneId || "";
    el.style.zIndex = d.zIndex;

    // 状態（向き・HP）の更新
    if (d.isFaceUp !== undefined) {
        el.classList.toggle('face-up', d.isFaceUp);
        el.classList.toggle('face-down', !info.isFaceUp);
    }
    if (d.isRotated !== undefined) el.classList.toggle('rotated', d.isRotated);

    if (d.currentHp !== undefined) {
        el.cardData.currentHp = d.currentHp;
        const fhp = document.getElementById(`hp-display-${d.id}`);
        if (fhp) fhp.innerText = d.currentHp;
    }

    // ゾーンが変更されていたらDOMの親要素をフィールドへ移動
    if (el.parentElement !== field) field.appendChild(el);
    repositionCards();
});

/**
 * HP変更の同期
 */
socket.on('hpUpdated', (d) => {
    const el = document.getElementById(d.id);
    if (el && el.cardData) {
        el.cardData.currentHp = d.currentHp;
        const fhp = document.getElementById(`hp-display-${d.id}`);
        if (fhp) fhp.innerText = d.currentHp;
    }
});

/**
 * カードが手札に戻った、または削除された時の同期
 */
socket.on('cardRemoved', (d) => {
    const el = document.getElementById(d.id);
    if (el) el.remove();
});

/**
 * 山札・エールデッキの残り枚数同期
 */
socket.on('deckCount', (c) => {
    const mc = document.getElementById('mainCount'); if (mc) mc.innerText = c.main;
    const cc = document.getElementById('cheerCount'); if (cc) cc.innerText = c.cheer;
});

/**
 * ロビー画面のルームリスト更新 (安定版維持)
 */
socket.on('roomListUpdate', (list) => {
    const listEl = document.getElementById('roomList');
    if (!listEl) return;

    listEl.innerHTML = list.length === 0 ? '<p style="font-size:12px; color:#666; margin-top:20px;">現在稼働中のルームはありません</p>' : "";

    list.forEach(room => {
        const item = document.createElement('div');
        item.className = 'room-item';
        item.innerHTML = `
            <span style="font-weight:bold; color:#00d2ff;"># ${room.id}</span>
            <div style="font-size:11px; color:#aaa; display:flex; gap:10px;">
                <span>Player: <b style="color:#ff5e5e;">${room.playerCount}</b></span>
                <span>Spec: <b style="color:#2ecc71;">${room.spectatorCount}</b></span>
            </div>
        `;
        item.onclick = () => { document.getElementById('roomIdInput').value = room.id; };
        listEl.appendChild(item);
    });
});

/**
 * ターン・フェイズ状態の更新
 */
socket.on('turnUpdate', (state) => {
    // Phase UIの更新
    document.querySelectorAll('.phase-step').forEach(el => el.classList.remove('active'));
    const currentPhaseEl = document.getElementById(`ph-${state.phase}`);
    if (currentPhaseEl) currentPhaseEl.classList.add('active');

    // ボタンの制御 (自分のターンのみ有効)
    const btn = document.getElementById('btn-next-phase');
    if (state.currentPlayer === socket.id) {
        btn.disabled = false;
        btn.innerText = (state.phase === 'end') ? "Turn End" : "Next";
        // ターン変更時の通知など
        document.getElementById('room-info').style.borderBottom = "2px solid #00d2ff";
    } else {
        btn.disabled = true;
        btn.innerText = "Wait...";
        document.getElementById('room-info').style.borderBottom = "2px solid transparent";
    }
});

/**
 * エールアタッチの同期
 */
socket.on('cardAttached', (d) => {
    const cheer = document.getElementById(d.cheerId);
    const target = document.getElementById(d.targetId);

    if (cheer && target) {
        cheer.dataset.zoneId = d.zoneId;
        // ターゲットに少し重ねて配置
        const tRect = target.getBoundingClientRect();
        const fRect = field.getBoundingClientRect();

        // エールはターゲットの下に少しずらして表示
        // 既存のエール枚数に応じてずらす処理が必要だが、一旦簡易的に
        const existingAyles = Array.from(document.querySelectorAll('.card.ayle-card')).filter(c =>
            c.dataset.zoneId === d.zoneId && c.id !== d.cheerId &&
            Math.abs(c.getBoundingClientRect().left - tRect.left) < 10 &&
            c.getBoundingClientRect().top > tRect.top
        );

        cheer.style.left = (tRect.left - fRect.left) + 'px';
        cheer.style.top = (tRect.top - fRect.top + 20 + (existingAyles.length * 15)) + 'px';
        cheer.style.zIndex = (parseInt(target.style.zIndex) || 100) - 1 - existingAyles.length;

        if (cheer.parentElement !== field) field.appendChild(cheer);
    }
});

// ---------------------------------------------------------
// アーカイブ・デッキ確認操作
// ---------------------------------------------------------

/**
 * アーカイブ（トラッシュ）の内容を表示
 */
function openArchive() {
    deckGrid.innerHTML = "";
    const isSpec = (myRole === 'spectator');
    document.getElementById('inspection-title').innerText = "ARCHIVE";

    // フィールド上のアーカイブゾーンに所属するカードを抽出
    const cards = Array.from(document.querySelectorAll('#field > .card')).filter(c => c.dataset.zoneId === 'archive');

    cards.forEach(card => {
        const container = document.createElement('div');
        container.className = "library-item";

        // カードのクローン（プレビュー用）を生成
        const el = createCardElement({ ...card.cardData, isRotated: false, isFaceUp: true }, false);
        el.onclick = () => openZoom(card.cardData, el);
        container.appendChild(el);

        // プレイヤーであれば回収ボタンを表示
        if (!isSpec) {
            const btn = document.createElement('button');
            btn.innerText = "回収";
            btn.onclick = () => { returnToHand(card); deckModal.style.display = 'none'; };
            container.appendChild(btn);
        }
        deckGrid.appendChild(container);
    });
    deckModal.style.display = 'flex';
}

/**
 * デッキ・アーカイブ確認モーダルを閉じる
 */
function closeDeckInspection() {
    deckModal.style.display = 'none';
}
