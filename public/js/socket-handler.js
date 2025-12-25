/**
 * ソケット通信イベントハンドラー
 * サーバーから送信される対戦中のイベント（ドロー、数値更新、同期等）を処理します。
 */

/**
 * メインデッキからカードを引いた時の処理
 * サーバーから受け取ったカードデータを手札エリアに追加します [cite: 2025-12-25]。
 */
socket.on('drawMainCard', (cardData) => {
    console.log("Main card drawn:", cardData.name);
    if (typeof addCardToHand === 'function') {
        addCardToHand(cardData);
    }
});

/**
 * エールデッキからカードを引いた時の処理
 * エールカードを手札エリアに追加します [cite: 2025-12-25]。
 */
socket.on('drawCheerCard', (cardData) => {
    console.log("Cheer card drawn:", cardData.name);
    if (typeof addCardToHand === 'function') {
        addCardToHand(cardData);
    }
});

/**
 * 山札・エールデッキの残り枚数同期
 * 山札の枚数表示（UIレイヤー）を更新します [cite: 2025-12-25]。
 */
socket.on('updateDeckCounts', (counts) => {
    const mCount = document.getElementById('mainCount');
    const cCount = document.getElementById('cheerCount');
    if (mCount) mCount.innerText = counts.main;
    if (cCount) cCount.innerText = counts.cheer;
});

/**
 * ルーム状況の更新通知
 * 現在のルームIDや参加人数を画面左上に反映します [cite: 2025-12-25]。
 */
socket.on('roomUpdate', (data) => {
    const info = document.getElementById('room-info');
    if (info) {
        info.innerText = `Room: ${data.roomId} (${data.playerCount}人)`;
    }
});

/**
 * 対戦相手のドロー通知（演出用）
 * 相手がカードを引いた際にログを表示したり、アニメーションをトリガーしたりできます。
 */
socket.on('opponentDraw', (data) => {
    console.log(`Opponent drew a ${data.type} card.`);
    // 必要に応じて相手側の手札枚数表示などを更新する処理をここに追加
});
