/**
 * ハブ画面専用マネージャー
 * HTMLの読み込み完了（DOMContentLoaded）を待ってから確実にイベントを登録します。
 */
document.addEventListener('DOMContentLoaded', () => {
    // 1. 対戦するボタンのイベント登録
    const joinPlayerBtn = document.getElementById('joinPlayerBtn');
    if (joinPlayerBtn) {
        joinPlayerBtn.addEventListener('click', () => hubJoinRoom('player'));
    }

    // 2. 観戦するボタンのイベント登録
    const joinSpectatorBtn = document.getElementById('joinSpectatorBtn');
    if (joinSpectatorBtn) {
        joinSpectatorBtn.addEventListener('click', () => hubJoinRoom('spectator'));
    }

    // 3. カードライブラリ確認ボタンのイベント登録
    const btnLibrary = document.querySelector('.btn-library-item');
    if (btnLibrary) {
        btnLibrary.addEventListener('click', () => {
            if (typeof showPage === 'function') {
                showPage('card-list-page');
            }
        });
    }
});

/**
 * ルーム参加ロジック
 * ID入力の取得とサーバーへの送信、画面遷移を管理します。
 */
function hubJoinRoom(role) {
    const ridInput = document.getElementById('roomIdInput');
    const rid = ridInput ? ridInput.value.trim() : "";
    
    if (!rid) {
        alert("ルームIDを入力してください");
        return;
    }

    // グローバル変数/ソケットへの割り当て
    if (typeof socket !== 'undefined') {
        socket.roomId = rid;
        socket.emit('joinRoom', { roomId: rid, role });
    }
    
    // ロール（役割）の保存
    myRole = role; 

    // 遷移先の決定
    if (role === 'player') {
        // プレイヤーなら構築（セットアップ）画面へ
        showPage('setup-modal');
    } else {
        // 観戦者なら直接フィールド画面へ
        showPage(''); // フィールドを表示
        document.body.classList.add('spectator-mode');
    }
}
