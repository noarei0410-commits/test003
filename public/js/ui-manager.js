/**
 * UI管理・画面遷移マネージャー
 */
let globalSearchText = ''; 
let currentGlobalTab = 'all';

/**
 * ページの表示切り替え
 */
function showPage(pageId) {
    document.querySelectorAll('.full-page').forEach(p => p.style.display = 'none');
    
    if (!pageId) return; // フィールド表示

    const target = document.getElementById(pageId);
    if (target) {
        target.style.display = (pageId === 'hub-page') ? 'flex' : 'block';
        
        if (pageId === 'card-list-page') updateGlobalLibraryDisplay();
        // deck-builder.js 側の関数を安全に呼び出す
        if (pageId === 'setup-modal' && typeof updateLibrary === 'function') {
            updateLibrary();
        }
    }
}

/**
 * グローバルライブラリ（確認画面）の検索・フィルタ
 */
function handleGlobalSearch(val) {
    globalSearchText = val.toLowerCase();
    updateGlobalLibraryDisplay();
}

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
