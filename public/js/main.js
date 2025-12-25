/**
 * メイン初期化処理
 */
window.addEventListener('load', async () => {
    // 1. 全カードデータのロードを待つ
    await loadCardData();

    // 2. 構築画面の初期状態をセット (データロード後に行う)
    if (typeof updateLibrary === 'function') updateLibrary();

    // 3. デッキクリック等のイベント設定
    setupDeckClick('main-deck-zone', 'main');
    setupDeckClick('cheer-deck-zone', 'cheer');

    // 4. 画面リサイズ対応
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
