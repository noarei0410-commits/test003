/**
 * メイン初期化・データロード管理スクリプト
 * アプリ起動時のデータ同期と、各画面の初期描画を制御します。
 */

window.addEventListener('load', async () => {
    // 1. マスターデータのロード完了を待機
    await loadCardData();

    // 2. localStorage から保存されたデッキがあれば復元
    if (typeof loadDeckFromLocal === 'function') {
        loadDeckFromLocal();
    }

    // 3. 構築画面の「対戦開始」ボタンに送信イベントを紐付け
    const startBtn = document.getElementById('startGameBtn');
    if (startBtn) {
        startBtn.addEventListener('click', submitDeck);
    }

    // 4. 各画面の初期描画を強制実行 (データロード完了後) [cite: 2025-12-24, 2025-12-25]
    if (typeof updateLibrary === 'function') updateLibrary();
    if (typeof updateGlobalLibraryDisplay === 'function') updateGlobalLibraryDisplay();

    // 5. 対戦フィールドの山札クリック（ドロー・確認）イベントを設定
    setupDeckClick('main-deck-zone', 'main');
    setupDeckClick('cheer-deck-zone', 'cheer');

    // 6. ウィンドウリサイズ時のカード再配置設定
    window.addEventListener('resize', repositionCards);

    // 7. 初期画面としてハブ画面を表示
    showPage('hub-page');
});

/**
 * マスターデータの非同期ロード
 * holomen, support, ayle, oshi の4つのJSONを取得し、グローバル変数に格納します。
 */
async function loadCardData() {
    try {
        const res = await Promise.all([
            fetch('/data/holomen.json').then(r => r.json()),
            fetch('/data/support.json').then(r => r.json()),
            fetch('/data/ayle.json').then(r => r.json()),
            fetch('/data/oshi.json').then(r => r.json())
        ]);
        
        // constants.js で宣言されたグローバル変数へ展開
        MASTER_CARDS = [...res[0], ...res[1], ...res[2]]; // ホロメン, サポート, エール
        AYLE_MASTER = res[2];  // エール専用プール
        OSHI_LIST = res[3];    // 推し専用プール
        
        console.log("Master Data Synced:", {
            totalCards: MASTER_CARDS.length,
            oshiCards: OSHI_LIST.length
        });
    } catch (e) {
        console.error("Data Sync Failed: JSONファイルの設定を確認してください", e);
    }
}

/**
 * 山札のクリックハンドリング
 * 短押し: ドロー / 長押し: 内容確認モーダル表示
 */
function setupDeckClick(id, type) {
    const el = document.getElementById(id);
    if (!el) return;
    
    let timer = null;
    
    // ポインタが押された際、長押しタイマーを開始
    el.addEventListener('pointerdown', (e) => {
        timer = setTimeout(() => {
            // 長押し(500ms)でデッキ確認イベントを送信
            if (myRole === 'player') socket.emit('inspectDeck', type);
            timer = null;
        }, 500);
    });

    // ポインタが離れた際の処理
    el.addEventListener('pointerup', () => {
        if (timer) {
            clearTimeout(timer); // 長押し成立前に離された場合はタイマー解除
            // 短押し(ドロー)イベントを送信
            if (myRole === 'player') {
                socket.emit(type === 'main' ? 'drawMainCard' : 'drawCheerCard');
            }
        }
    });
}
