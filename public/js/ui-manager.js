/**
 * UI管理・画面遷移マネージャー
 */
let globalSearchText = ''; 
let currentGlobalTab = 'all';

function showPage(pageId) {
    document.querySelectorAll('.full-page').forEach(p => p.style.display = 'none');
    if (!pageId) return; 
    const target = document.getElementById(pageId);
    if (target) {
        target.style.display = (pageId === 'hub-page') ? 'flex' : 'block';
        if (pageId === 'card-list-page') updateGlobalLibraryDisplay();
        if (pageId === 'setup-modal') updateLibrary();
    }
}

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
    
    // データロード完了を確認
    if (!MASTER_CARDS || MASTER_CARDS.length === 0) return;

    const allCards = [...(OSHI_LIST || []), ...(MASTER_CARDS || [])];
    const filtered = allCards.filter(c => {
        const matchesType = (currentGlobalTab === 'all' || c.type === currentGlobalTab);
        const matchesSearch = c.name.toLowerCase().includes(globalSearchText);
        return matchesType && matchesSearch;
    });

    filtered.forEach(data => {
        try {
            if (typeof createCardElement === 'function') {
                const cardEl = createCardElement(data, true);
                grid.appendChild(cardEl);
            }
        } catch (err) {
            console.error("Global Library Render Error:", data.name, err);
        }
    });
}

function closeDeckInspection() {
    const modal = document.getElementById('deck-inspection-modal');
    if (modal) modal.style.display = 'none';
}
