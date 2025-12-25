/**
 * UI管理・画面遷移
 */
let currentTab = 'all';
let searchText = '';

/**
 * ページの表示切り替え
 * IDに基づいてページを非表示・表示し、必要な描画を更新します。
 */
function showPage(pageId) {
    document.querySelectorAll('.full-page').forEach(p => p.style.display = 'none');
    
    if (!pageId) return; // フィールド表示

    const target = document.getElementById(pageId);
    if (target) {
        // ハブ画面は中央揃えのため flex を維持
        target.style.display = (pageId === 'hub-page') ? 'flex' : 'block';
        
        if (pageId === 'card-list-page') updateGlobalLibraryDisplay();
        if (pageId === 'setup-modal' && typeof updateLibrary === 'function') updateLibrary();
    }
}

/**
 * グローバルライブラリのフィルタリング
 */
function filterGlobalLibrary(type) {
    currentTab = type;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.innerText.includes(getTabText(type)));
    });
    updateGlobalLibraryDisplay();
}

function getTabText(type) {
    const map = { all: 'すべて', oshi: '推し', holomen: 'ホロメン', support: 'サポート', ayle: 'エール' };
    return map[type];
}

function handleGlobalSearch(val) {
    searchText = val.toLowerCase();
    updateGlobalLibraryDisplay();
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
        const matchesType = (currentTab === 'all' || c.type === currentTab);
        const matchesSearch = c.name.toLowerCase().includes(searchText);
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
