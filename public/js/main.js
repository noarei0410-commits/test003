/**
 * アプリケーション共通の初期化
 */
window.addEventListener('load', async () => {
    // 全カードデータのロード
    await loadCardData();

    // デッキクリック（ドロー）の共通設定
    setupDeckClick('main-deck-zone', 'main');
    setupDeckClick('cheer-deck-zone', 'cheer');

    // リサイズ時の再配置設定
    window.addEventListener('resize', repositionCards);

    // 最初の画面を表示
    showPage('hub-page');
});

/**
 * カードデータの一括ロード
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
        console.log("Card Database Synchronized.");
    } catch (e) {
        console.error("Critical: Data Load Failed", e);
    }
}

/**
 * デッキ長押し/クリック設定
 */
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
