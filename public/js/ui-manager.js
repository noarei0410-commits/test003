let currentTab = 'all'; // グローバルライブラリ用
let searchText = '';     // グローバルライブラリ用
let currentLibraryFilter = 'all'; // 構築画面用

/**
 * ページの表示切り替え
 */
function showPage(pageId) {
    document.querySelectorAll('.full-page').forEach(p => p.style.display = 'none');
    const target = document.getElementById(pageId);
    if (target) {
        target.style.display = (pageId === 'hub-page') ? 'flex' : 'block';
        if (pageId === 'card-list-page') updateGlobalLibraryDisplay();
        if (pageId === 'setup-modal') updateLibrary(); // 構築画面表示時に描画更新
    }
}

/**
 * --- グローバルライブラリ (確認用画面) 制御 ---
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
 * --- デッキ構築画面 (セットアップ画面) 制御 ---
 */
function setLibraryFilter(type) {
    currentLibraryFilter = type;
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.classList.toggle('active', tab.onclick.toString().includes(`'${type}'`));
    });
    updateLibrary();
}

/**
 * 構築画面のライブラリ描画：カードの全情報を表示するように修正
 */
function updateLibrary() {
    const list = document.getElementById('libraryList');
    if (!list) return;
    list.innerHTML = '';
    const search = document.getElementById('searchInput').value.toLowerCase();
    
    // 表示対象のプールを選択
    let pool = [];
    if (currentLibraryFilter === 'oshi') pool = OSHI_LIST;
    else if (currentLibraryFilter === 'all') pool = [...OSHI_LIST, ...MASTER_CARDS];
    else pool = MASTER_CARDS.filter(c => c.type === currentLibraryFilter);

    const filtered = pool.filter(c => c.name.toLowerCase().includes(search));

    filtered.forEach(data => {
        // カードを包むコンテナを作成
        const wrapper = document.createElement('div');
        wrapper.className = 'library-item-v2';
        
        // カードDOMを生成（全情報を表示）
        const cardEl = createCardElement(data, true);
        wrapper.appendChild(cardEl);

        // 追加ボタンの作成
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

// デッキ追加/削除等の既存ロジック (現状に合わせて適宜維持)
let mainDeckList = [];
let cheerDeckList = [];
let selectedOshi = null;

function setOshi(data) {
    selectedOshi = data;
    updateDeckSummary();
}

function addToDeck(data) {
    const target = (data.type === 'ayle') ? cheerDeckList : mainDeckList;
    const limit = (data.type === 'ayle') ? 20 : 50;
    if (target.length >= limit) return alert("枚数上限です");
    
    // ときのそらDebut以外の同名カード制限チェック
    const sameNameCount = target.filter(c => c.name === data.name).length;
    if (data.id !== "sora-00" && sameNameCount >= 4) return alert("同名カードは4枚までです");

    target.push({...data});
    updateDeckSummary();
}

function updateDeckSummary() {
    document.getElementById('mainBuildCount').innerText = mainDeckList.length;
    document.getElementById('cheerBuildCount').innerText = cheerDeckList.length;
    document.getElementById('startGameBtn').disabled = !(mainDeckList.length === 50 && cheerDeckList.length === 20 && selectedOshi);
    
    // 簡易リスト表示の更新ロジック (省略)
}

function closeDeckInspection() {
    document.getElementById('deck-inspection-modal').style.display = 'none';
}
