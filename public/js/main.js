/**
 * メイン初期化処理
 */
window.addEventListener('load', async () => {
    // 1. 全カードデータのロードを待つ
    await loadCardData();

    // 2. 対戦開始ボタンに処理を紐付け
    const startBtn = document.getElementById('startGameBtn');
    if (startBtn) {
        startBtn.addEventListener('click', submitDeck);
    }

    // 3. 各画面の初期描画を強制実行 (データロード後) [cite: 2025-12-24]
    if (typeof updateLibrary === 'function') updateLibrary();
    if (typeof updateGlobalLibraryDisplay === 'function') updateGlobalLibraryDisplay();

    // 4. デッキクリック等のイベント設定
    setupDeckClick('main-deck-zone', 'main');
    setupDeckClick('cheer-deck-zone', 'cheer');

    window.addEventListener('resize', repositionCards);

    // 5. ハブ画面を表示
    showPage('hub-page');
});

/**
 * マスターデータのロード
 */
async function loadCardData() {
    try {
        const res = await Promise.all([
            fetch('/data/holomen.json').then(r => r.json()),
            fetch('/data/support.json').then(r => r.json()),
            fetch('/data/ayle.json').then(r => r.json()),
            fetch('/data/oshi.json').then(r => r.json())
        ]);
        
        // グローバル変数（constants.jsで宣言済み）へ格納
        MASTER_CARDS = [...res[0], ...res[1], ...res[2]];
        AYLE_MASTER = res[2];
        OSHI_LIST = res[3];
        
        console.log("Master Data Synced:", {
            master: MASTER_CARDS.length,
            oshi: OSHI_LIST.length
        });
    } catch (e) {
        console.error("Data Sync Failed - JSONファイルが存在するか確認してください", e);
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
