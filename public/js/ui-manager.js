/**
 * UI管理・画面遷移マネージャー
 */
let globalSearchText = ''; // 変数名の重複を避けるために変更
let currentGlobalTab = 'all';

/**
 * ページの表示切り替え
 */
function showPage(pageId) {
    document.querySelectorAll('.full-page').forEach(p => p.style.display = 'none');
    
    if (!pageId) return; // IDがない場合は対戦フィールド表示

    const target = document.getElementById(pageId);
    if (target) {
        // ハブ画面は中央揃えのため flex を適用
        target.style.display = (pageId === 'hub-page') ? 'flex' : 'block';
        
        if (pageId === 'card-list-page') updateGlobalLibraryDisplay();
        if (pageId === 'setup-modal' && typeof updateLibrary === 'function') updateLibrary();
    }
}

/**
 * グローバルライブラリの検索
 */
function handleGlobalSearch(val) {
    globalSearchText = val.toLowerCase();
    updateGlobalLibraryDisplay();
}

/**
 * グローバルライブラリのフィルタリング
 */
function filterGlobalLibrary(type) {
    currentGlobalTab = type;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.innerText.includes(getTabText(type)));
    });
    updateGlobalLibraryDisplay();
}

function getTabText(type) {
    const map = { all: 'すべて', oshi: '推し', holomen: 'ホロメン', support: 'サポート', ayle: 'エール' };
    return map[type];
}

/**
 * カード確認画面の描画
 */
function updateGlobalLibraryDisplay() {
    const grid = document.getElementById('global-card-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const allCards = [...(OSHI_LIST || []), ...(MASTER_CARDS || [])];
    const filtered = allCards.filter(c => {
        const matchesType = (currentGlobalTab === 'all' || c.type === currentGlobalTab);
        const matchesSearch = c.name.toLowerCase().includes(globalSearchText);
        return matchesType && matchesSearch;
    });
    filtered.forEach(data => {
        const cardEl = createCardElement(data, true);
        grid.appendChild(cardEl);
    });
}

function closeDeckInspection() {
    const modal = document.getElementById('deck-inspection-modal');
    if (modal) modal.style.display = 'none';
}
