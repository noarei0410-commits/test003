/**
 * ソケット通信イベントハンドラー
 */

// メインデッキからカードを引いた時の処理 [cite: 2025-12-25]
socket.on('drawMainCard', (cardData) => {
    console.log("Main card drawn:", cardData.name);
    if (typeof addCardToHand === 'function') {
        addCardToHand(cardData);
    }
});

// エールデッキからカードを引いた時の処理 [cite: 2025-12-25]
socket.on('drawCheerCard', (cardData) => {
    console.log("Cheer card drawn:", cardData.name);
    if (typeof addCardToHand === 'function') {
        addCardToHand(cardData);
    }
});

// 枚数同期 [cite: 2025-12-25]
socket.on('updateDeckCounts', (counts) => {
    const mCount = document.getElementById('mainCount');
    const cCount = document.getElementById('cheerCount');
    if (mCount) mCount.innerText = counts.main;
    if (cCount) cCount.innerText = counts.cheer;
});

// ルーム更新 [cite: 2025-12-25]
socket.on('roomUpdate', (data) => {
    const info = document.getElementById('room-info');
    if (info) info.innerText = `Room: ${data.roomId} (${data.playerCount}人)`;
});
