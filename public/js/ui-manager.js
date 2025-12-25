/**
 * UI管理マネージャー
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
        if (pageId === 'setup-modal') {
            if (typeof updateLibrary === 'function') updateLibrary();
        }
    }
}

function handleGlobalSearch(val) {
    globalSearchText = val.toLowerCase();
    updateGlobalLibraryDisplay();
}

/**
 * 【修正】タブの判定を onclick 属性の文字列比較に変更
 */
function filterGlobalLibrary(type) {
    currentGlobalTab = type;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        const onclickStr = btn.getAttribute('onclick') || "";
        // 厳密な判定を行い誤点灯を防止
        btn.classList.toggle('active', onclickStr.includes(`'${type}'`));
    });
    updateGlobalLibraryDisplay();
}

function updateGlobalLibraryDisplay() {
    const grid = document.getElementById('global-card-grid');
    if (!grid) return;
    grid.innerHTML = '';
    if (!MASTER_CARDS || MASTER_CARDS.length === 0) return;

    const allCards = [...(OSHI_LIST || []), ...(MASTER_CARDS || [])];
    const filtered = allCards.filter(c => {
        if (!c) return false;
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
        } catch (err) { console.error("Global Library Render Error:", data.name, err); }
    });
}

function closeDeckInspection() {
    const modal = document.getElementById('deck-inspection-modal');
    if (modal) modal.style.display = 'none';
}
