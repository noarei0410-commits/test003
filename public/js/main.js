/**
 * 起動時の初期化処理
 */
window.onload = async () => {
    // マスターデータのロード
    await loadCardData();

    // ハブ画面のボタンイベント登録
    const joinPlayerBtn = document.getElementById('joinPlayerBtn');
    if (joinPlayerBtn) joinPlayerBtn.onclick = () => joinRoom('player');

    const joinSpectatorBtn = document.getElementById('joinSpectatorBtn');
    if (joinSpectatorBtn) joinSpectatorBtn.onclick = () => joinRoom('spectator');

    // デッキ構築画面のイベント登録
    const startGameBtn = document.getElementById('startGameBtn');
    if (startGameBtn) {
        startGameBtn.onclick = () => {
            socket.emit('setGame', { main: mainDeckList, cheer: cheerDeckList, oshi: selectedOshi });
            showPage(''); // フィールド表示
        };
    }

    // デッキクリック（ドロー）の設定
    setupDeckClick('main-deck-zone', 'main');
    setupDeckClick('cheer-deck-zone', 'cheer');

    // 画面リサイズ時の位置補正
    window.onresize = repositionCards;

    // ハブ画面を表示して開始
    showPage('hub-page');
};

/**
 * カードデータのロード
 */
async function loadCardData() {
    try {
        const res = await Promise.all([
            fetch('/data/holomen.json').then(r => r.json()),
            fetch('/data/support.json').then(r => r.json()),
            fetch('/data/ayle.json').then(r => r.json()),
            fetch('/data/oshi.json').then(r => r.json())
        ]);
        MASTER_CARDS = [...res[0], ...res[1], ...res[2]];
        AYLE_MASTER = res[2];
        OSHI_LIST = res[3];
        console.log("Card Data Loaded Successfully");
    } catch (e) {
        console.error("Data Load Error", e);
    }
}

/**
 * ルーム参加処理
 */
async function joinRoom(role) {
    const ridInput = document.getElementById('roomIdInput');
    const rid = ridInput ? ridInput.value.trim() : "";
    if (!rid) return alert("ルームIDを入力してください");

    socket.roomId = rid;
    myRole = role; 
    socket.emit('joinRoom', { roomId: rid, role });

    if (role === 'player') {
        showPage('setup-modal'); // 構築画面へ
    } else {
        showPage(''); // フィールド（観戦）へ
        document.body.classList.add('spectator-mode');
    }
}

/**
 * デッキのクリック/長押しイベント設定
 */
function setupDeckClick(id, type) {
    const el = document.getElementById(id);
    if (!el) return;
    let timer = null;
    el.onpointerdown = (e) => {
        timer = setTimeout(() => {
            if (myRole === 'player') socket.emit('inspectDeck', type);
            timer = null;
        }, 500);
    };
    el.onpointerup = () => {
        if (timer) {
            clearTimeout(timer);
            if(myRole === 'player') socket.emit(type === 'main' ? 'drawMainCard' : 'drawCheerCard');
        }
    };
}
