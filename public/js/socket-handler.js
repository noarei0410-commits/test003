/**
 * ソケット通信イベントハンドラー
 * サーバーからの通知（ドロー、対戦相手の動き等）を各マネージャーに振り分けます。
 */

// メインデッキからカードを引いた時の処理 [cite: 2025-12-25]
socket.on('drawMainCard', (cardData) => {
    console.log("Main card drawn:", cardData.name);
    addCardToHand(cardData);
});

// エールデッキからカードを引いた時の処理 [cite: 2025-12-25]
socket.on('drawCheerCard', (cardData) => {
    console.log("Cheer card drawn:", cardData.name);
    addCardToHand(cardData);
});

// デッキの残り枚数更新通知
socket.on('updateDeckCounts', (counts) => {
    const mCount = document.getElementById('mainCount');
    const cCount = document.getElementById('cheerCount');
    if (mCount) mCount.innerText = counts.main;
    if (cCount) cCount.innerText = counts.cheer;
});

// ルーム情報の更新
socket.on('roomUpdate', (data) => {
    const info = document.getElementById('room-info');
    if (info) info.innerText = `Room: ${data.roomId} (${data.playerCount}人)`;
});
