/**
 * ハブ画面専用マネージャー
 * ルーム参加およびライブラリ遷移を確実に制御します。
 */
document.addEventListener('DOMContentLoaded', () => {
    // 対戦するボタン
    const joinPlayerBtn = document.getElementById('joinPlayerBtn');
    if (joinPlayerBtn) {
        joinPlayerBtn.addEventListener('click', () => hubJoinRoom('player'));
    }

    // 観戦するボタン
    const joinSpectatorBtn = document.getElementById('joinSpectatorBtn');
    if (joinSpectatorBtn) {
        joinSpectatorBtn.addEventListener('click', () => hubJoinRoom('spectator'));
    }

    // ライブラリ確認ボタン
    const btnLibrary = document.querySelector('.btn-library-item');
    if (btnLibrary) {
        btnLibrary.addEventListener('click', () => showPage('card-list-page'));
    }
});

/**
 * ルーム参加ロジック
 */
function hubJoinRoom(role) {
    const ridInput = document.getElementById('roomIdInput');
    const rid = ridInput ? ridInput.value.trim() : "";
    
    if (!rid) {
        alert("ルームIDを入力してください");
        return;
    }

    socket.roomId = rid;
    myRole = role; 
    socket.emit('joinRoom', { roomId: rid, role });

    if (role === 'player') {
        showPage('setup-modal');
    } else {
        showPage(''); // フィールドへ
        document.body.classList.add('spectator-mode');
    }
}
