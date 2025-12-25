let currentTab = 'all';
let searchText = '';
let currentLibraryFilter = 'all';

/**
 * ページの表示切り替え
 * IDに基づいてページを非表示・表示し、必要な描画を更新します。
 */
function showPage(pageId) {
    // すべてのページを隠す
    document.querySelectorAll('.full-page').forEach(p => p.style.display = 'none');
    
    if (!pageId) return; // IDがない場合はフィールド（メイン画面）を表示

    const target = document.getElementById(pageId);
    if (target) {
        // ハブ画面のみ中央揃えのために flex を使用
        target.style.display = (pageId === 'hub-page') ? 'flex' : 'block';
        
        // 遷移先のページに応じた描画更新処理
        if (pageId === 'card-list-page') updateGlobalLibraryDisplay();
        if (pageId === 'setup-modal') updateLibrary();
    }
}

/**
 * --- カードライブラリ（確認用） ---
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

/**
 * --- デッキ構築（セットアップ） ---
 */
function setLibraryFilter(type) {
    currentLibraryFilter = type;
    document.querySelectorAll('.filter-tab').forEach(tab => {
        const clickAttr = tab.getAttribute('onclick') || "";
        tab.classList.toggle('active', clickAttr.includes(`'${type}'` || `"${type}"`));
    });
    updateLibrary();
}

function updateLibrary() {
    const list = document.getElementById('libraryList');
    const searchInput = document.getElementById('searchInput');
    if (!list) return;
    list.innerHTML = '';
    const search = searchInput ? searchInput.value.toLowerCase() : "";
    
    let pool = [];
    if (currentLibraryFilter === 'oshi') pool = OSHI_LIST || [];
    else if (currentLibraryFilter === 'all') pool = [...(OSHI_LIST || []), ...(MASTER_CARDS || [])];
    else pool = (MASTER_CARDS || []).filter(c => c.type === currentLibraryFilter);

    const filtered = pool.filter(c => c.name.toLowerCase().includes(search));

    filtered.forEach(data => {
        const wrapper = document.createElement('div');
        wrapper.className = 'library-item-v2';
        const cardEl = createCardElement(data, true);
        wrapper.appendChild(cardEl);

        const btn = document.createElement('button');
        btn.className = 'btn-add-deck';
        if (data.type === 'oshi') {
            btn.innerText = '推しに設定';
            btn.onclick = () => setOshi(data);
        } else {
            btn.innerText = '追加';
            btn.onclick = () => addToDeck(data);
        }
        wrapper.appendChild(btn);
        list.appendChild(wrapper);
    });
}

function closeDeckInspection() {
    const modal = document.getElementById('deck-inspection-modal');
    if (modal) modal.style.display = 'none';
}
