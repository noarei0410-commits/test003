let currentTab = 'all';
let searchText = '';

/**
 * ページの表示切り替え
 */
function showPage(pageId) {
    document.querySelectorAll('.full-page').forEach(p => p.style.display = 'none');
    const target = document.getElementById(pageId);
    if (target) {
        target.style.display = (pageId === 'hub-page') ? 'flex' : 'block';
        if (pageId === 'card-list-page') updateGlobalLibraryDisplay();
    }
}

/**
 * グローバルライブラリのフィルタリング（タブ切り替え）
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

/**
 * カード名検索のハンドリング
 */
function handleGlobalSearch(val) {
    searchText = val.toLowerCase();
    updateGlobalLibraryDisplay();
}

/**
 * カードライブラリの描画更新
 */
function updateGlobalLibraryDisplay() {
    const grid = document.getElementById('global-card-grid');
    if (!grid) return;
    grid.innerHTML = '';

    // 推しリストとマスターカードを統合して表示
    const allCards = [...OSHI_LIST, ...MASTER_CARDS];

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

/**
 * デッキ構築画面（setup-modal）のフィルタリングロジック
 */
function setLibraryFilter(type) { updateLibrary(); }

function updateLibrary() {
    // デッキ構築画面用の既存の描画ロジックをここに記述
}

function closeDeckInspection() {
    document.getElementById('deck-inspection-modal').style.display = 'none';
}
