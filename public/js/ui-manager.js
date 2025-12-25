/**
 * UI管理・状態保持
 */
let currentTab = 'all';           // グローバルライブラリ用タブ
let searchText = '';              // グローバルライブラリ用検索
let currentLibraryFilter = 'all'; // 構築画面用タブ

let mainDeckList = [];            // メインデッキ（50枚）
let cheerDeckList = [];           // エールデッキ（20枚）
let selectedOshi = null;          // 推しホロメン

/**
 * ページの表示切り替え
 * IDに基づいてページを表示・非表示にし、必要に応じて描画を更新します。
 */
function showPage(pageId) {
    // すべての全画面ページを非表示にする
    document.querySelectorAll('.full-page').forEach(p => p.style.display = 'none');
    
    if (!pageId) return; // IDが空の場合はフィールド画面（メイン）を表示

    const target = document.getElementById(pageId);
    if (target) {
        // ハブ画面は中央揃えのため flex、それ以外は block で表示
        target.style.display = (pageId === 'hub-page') ? 'flex' : 'block';
        
        // 遷移先に応じてライブラリ表示をリフレッシュ
        if (pageId === 'card-list-page') updateGlobalLibraryDisplay();
        if (pageId === 'setup-modal') updateLibrary();
    }
}

/**
 * --- グローバルライブラリ（カード確認画面）制御 ---
 */

/**
 * ライブラリのカテゴリフィルタリング（タブ切り替え）
 * 指定のカラーを維持しつつ、アクティブなボタンの状態を更新します。
 */
function filterGlobalLibrary(type) {
    currentTab = type;
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
        const btnText = btn.innerText;
        btn.classList.toggle('active', btnText.includes(getTabText(type)));
    });
    
    updateGlobalLibraryDisplay();
}

/**
 * タブ名取得の補助関数
 */
function getTabText(type) {
    const map = { all: 'すべて', oshi: '推し', holomen: 'ホロメン', support: 'サポート', ayle: 'エール' };
    return map[type];
}

/**
 * グローバルライブラリの検索ハンドリング
 */
function handleGlobalSearch(val) {
    searchText = val.toLowerCase();
    updateGlobalLibraryDisplay();
}

/**
 * グローバルライブラリの描画更新
 * 安定版のデザインに基づき、グリッド形式でカードを表示します。
 */
function updateGlobalLibraryDisplay() {
    const grid = document.getElementById('global-card-grid');
    if (!grid) return;
    grid.innerHTML = '';

    // 推しリストとマスターカードを統合
    const allCards = [...(OSHI_LIST || []), ...(MASTER_CARDS || [])];

    const filtered = allCards.filter(c => {
        const matchesType = (currentTab === 'all' || c.type === currentTab);
        const matchesSearch = c.name.toLowerCase().includes(searchText);
        return matchesType && matchesSearch;
    });

    filtered.forEach(data => {
        // game-logic.js の createCardElement を利用してカード描画
        const cardEl = createCardElement(data, true);
        grid.appendChild(cardEl);
    });
}

/**
 * --- デッキ構築（セットアップ画面）制御 ---
 */

/**
 * 構築画面のライブラリフィルタ（タブ切り替え）
 */
function setLibraryFilter(type) {
    currentLibraryFilter = type;
    document.querySelectorAll('.filter-tab').forEach(tab => {
        const clickAttr = tab.getAttribute('onclick') || "";
        tab.classList.toggle('active', clickAttr.includes(`'${type}'`) || clickAttr.includes(`"${type}"`));
    });
    updateLibrary();
}

/**
 * 構築画面のライブラリ描画更新
 * カードの全情報をタイル形式で表示し、「追加」ボタンを配置します。
 */
function updateLibrary() {
    const list = document.getElementById('libraryList');
    if (!list) return;
    list.innerHTML = '';
    
    const searchInput = document.getElementById('searchInput');
    const search = searchInput ? searchInput.value.toLowerCase() : "";
    
    let pool = [];
    if (currentLibraryFilter === 'oshi') pool = OSHI_LIST || [];
    else if (currentLibraryFilter === 'all') pool = [...(OSHI_LIST || []), ...(MASTER_CARDS || [])];
    else pool = (MASTER_CARDS || []).filter(c => c.type === currentLibraryFilter);

    const filtered = pool.filter(c => c.name.toLowerCase().includes(search));

    filtered.forEach(data => {
        const wrapper = document.createElement('div');
        wrapper.className = 'library-item-v2'; // タイル状レイアウト用クラス
        
        // カード本体（ game-logic.js を使用）
        const cardEl = createCardElement(data, true);
        wrapper.appendChild(cardEl);

        // デッキ操作ボタン
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

/**
 * 推しホロメンの設定
 */
function setOshi(data) {
    selectedOshi = data;
    updateDeckSummary();
}

/**
 * デッキへのカード追加
 * 50枚/20枚制限、および同名カード4枚制限を判定します。
 */
function addToDeck(data) {
    const target = (data.type === 'ayle') ? cheerDeckList : mainDeckList;
    const limit = (data.type === 'ayle') ? 20 : 50;
    
    if (target.length >= limit) return alert(`${limit}枚上限です`);
    
    // 同名カード制限（ときのそらDebut/sora-00 以外）
    const sameNameCount = target.filter(c => c.name === data.name).length;
    if (data.id !== "sora-00" && sameNameCount >= 4) return alert("同名カードは4枚までです");

    target.push({...data});
    updateDeckSummary();
}

/**
 * デッキ内容のサマリー表示更新
 */
function updateDeckSummary() {
    const mainCountEl = document.getElementById('mainBuildCount');
    const cheerCountEl = document.getElementById('cheerBuildCount');
    const startBtn = document.getElementById('startGameBtn');

    if (mainCountEl) mainCountEl.innerText = mainDeckList.length;
    if (cheerCountEl) cheerCountEl.innerText = cheerDeckList.length;

    // 枚数条件を満たした場合のみ「対戦開始」を有効化
    if (startBtn) {
        startBtn.disabled = !(mainDeckList.length === 50 && cheerDeckList.length === 20 && selectedOshi);
    }

    // 推しホロメン表示
    const oshiSummary = document.getElementById('oshiSummary');
    if (oshiSummary) {
        oshiSummary.innerHTML = selectedOshi ? `<div class="deck-item">${selectedOshi.name} <button class="btn-remove-oshi" onclick="removeOshi()">×</button></div>` : "未設定";
    }

    // メイン/エールデッキの簡易リスト（名前と枚数）の描画ロジック
    renderDeckSection('mainDeckSummary', mainDeckList);
    renderDeckSection('cheerDeckSummary', cheerDeckList);
}

function removeOshi() {
    selectedOshi = null;
    updateDeckSummary();
}

/**
 * デッキセクションのリスト表示（枚数操作付き）
 */
function renderDeckSection(elementId, list) {
    const container = document.getElementById(elementId);
    if (!container) return;
    container.innerHTML = '';

    // カード名ごとに集計
    const summary = list.reduce((acc, curr) => {
        acc[curr.name] = (acc[curr.name] || 0) + 1;
        return acc;
    }, {});

    Object.keys(summary).forEach(name => {
        const div = document.createElement('div');
        div.className = 'deck-item';
        div.innerHTML = `
            <span>${name} x${summary[name]}</span>
            <div class="deck-item-controls">
                <button class="btn-minus" onclick="changeQuantity('${name}', '${elementId}', -1)">-</button>
                <button class="btn-plus" onclick="changeQuantity('${name}', '${elementId}', 1)">+</button>
            </div>`;
        container.appendChild(div);
    });
}

/**
 * デッキ内の枚数増減
 */
function changeQuantity(name, sectionId, delta) {
    const isCheer = (sectionId === 'cheerDeckSummary');
    const target = isCheer ? cheerDeckList : mainDeckList;

    if (delta > 0) {
        const originalData = target.find(c => c.name === name);
        if (originalData) addToDeck(originalData);
    } else {
        const idx = target.findLastIndex(c => c.name === name);
        if (idx !== -1) target.splice(idx, 1);
    }
    updateDeckSummary();
}

/**
 * デッキ確認モーダルを閉じる
 */
function closeDeckInspection() {
    const modal = document.getElementById('deck-inspection-modal');
    if (modal) modal.style.display = 'none';
}
