/**
 * UI管理・画面遷移マネージャー
 * 各画面の切り替えやグローバルライブラリの表示制御を行います。
 */
let globalSearchText = ''; 
let currentGlobalTab = 'all';

/**
 * ページ遷移処理
 */
function showPage(pageId) {
    document.querySelectorAll('.full-page').forEach(p => p.style.display = 'none');
    
    if (!pageId) return; // 対戦フィールド表示時 (null)

    const target = document.getElementById(pageId);
    if (target) {
        target.style.display = (pageId === 'hub-page') ? 'flex' : 'block';
        
        // 遷移時に表示内容を最新の状態に更新する
        if (pageId === 'card-list-page') updateGlobalLibraryDisplay();
        if (pageId === 'setup-modal') {
            if (typeof updateLibrary === 'function') updateLibrary();
        }
    }
}

/**
 * グローバルライブラリの検索処理
 */
function handleGlobalSearch(val) {
    globalSearchText = val.toLowerCase();
    updateGlobalLibraryDisplay();
}

/**
 * グローバルライブラリのフィルタ切り替え
 * * 【修正】innerText による部分一致判定を廃止し、onclick 属性内の引数文字列と
 * 直接比較するように変更しました。これにより「ホロメン」選択時に「推しホロメン」も
 * アクティブになってしまう問題を解消しています。
 */
function filterGlobalLibrary(type) {
    currentGlobalTab = type;
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
        // ボタンの onclick 属性 ('filterGlobalLibrary('oshi')' 等) を取得
        const onclickStr = btn.getAttribute('onclick') || "";
        
        // 引数部分 ('${type}') が含まれているか正確にチェックして active クラスを切り替える
        btn.classList.toggle('active', onclickStr.includes(`'${type}'`));
    });
    
    updateGlobalLibraryDisplay();
}

/**
 * グローバルライブラリの描画処理
 */
function updateGlobalLibraryDisplay() {
    const grid = document.getElementById('global-card-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    // データロード完了を確認
    if (!MASTER_CARDS || MASTER_CARDS.length === 0) return;

    // 推しホロメンとマスターカードを統合したリストを作成
    const allCards = [...(OSHI_LIST || []), ...(MASTER_CARDS || [])];
    
    // フィルタと検索条件に合致するカードを抽出
    const filtered = allCards.filter(c => {
        if (!c) return false;
        const matchesType = (currentGlobalTab === 'all' || c.type === currentGlobalTab);
        const matchesSearch = c.name.toLowerCase().includes(globalSearchText);
        return matchesType && matchesSearch;
    });

    filtered.forEach(data => {
        try {
            // game-logic.js の生成関数を使用してカードを表示
            if (typeof createCardElement === 'function') {
                const cardEl = createCardElement(data, true);
                grid.appendChild(cardEl);
            }
        } catch (err) {
            console.error("Global Library Render Error:", data.name, err);
        }
    });
}

/**
 * デッキ確認モーダルを閉じる
 */
function closeDeckInspection() {
    const modal = document.getElementById('deck-inspection-modal');
    if (modal) modal.style.display = 'none';
}
