/**
 * メイン初期化処理
 */
window.addEventListener('load', async () => {
    // データのロード完了を待つ
    await loadCardData();

    // 構築画面の初期描画
    if (typeof updateLibrary === 'function') updateLibrary();

    // 対戦開始ボタンに処理を紐付け
    const startBtn = document.getElementById('startGameBtn');
    if (startBtn) {
        startBtn.addEventListener('click', submitDeck);
    }

    // デッキクリック（ドロー）等のイベント設定
    setupDeckClick('main-deck-zone', 'main');
    setupDeckClick('cheer-deck-zone', 'cheer');

    window.addEventListener('resize', repositionCards);

    // ハブ画面を表示
    showPage('hub-page');
});

/**
 * データロード
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
        console.log("Master Data Synced.");
    } catch (e) {
        console.error("Data Sync Failed", e);
    }
}

function setupDeckClick(id, type) {
    const el = document.getElementById(id);
    if (!el) return;
    let timer = null;
    el.addEventListener('pointerdown', (e) => {
        timer = setTimeout(() => {
            if (myRole === 'player') socket.emit('inspectDeck', type);
            timer = null;
        }, 500);
    });
    el.addEventListener('pointerup', () => {
        if (timer) {
            clearTimeout(timer);
            if(myRole === 'player') socket.emit(type === 'main' ? 'drawMainCard' : 'drawCheerCard');
        }
    });
}
