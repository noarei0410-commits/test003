/**
 * デッキ構築マネージャー
 */
let currentLibraryFilter = 'all';
let mainDeckList = [];
let cheerDeckList = [];
let selectedOshi = null;

/**
 * 構築画面のフィルタ切り替え
 */
function setLibraryFilter(type) {
    currentLibraryFilter = type;
    document.querySelectorAll('.filter-tab').forEach(tab => {
        const clickAttr = tab.getAttribute('onclick') || "";
        // アクティブクラスの切り替えを確実に行う
        tab.classList.toggle('active', clickAttr.includes(`'${type}'`) || clickAttr.includes(`"${type}"`));
    });
    updateLibrary();
}

/**
 * 構築画面ライブラリのタイル描画（全情報表示）
 */
function updateLibrary() {
    const list = document.getElementById('libraryList');
    if (!list) return;
    list.innerHTML = ''; // リストをクリア
    
    const searchInput = document.getElementById('searchInput');
    const search = searchInput ? searchInput.value.toLowerCase() : "";
    
    // 表示対象のカードプールを決定
    let pool = [];
    if (currentLibraryFilter === 'oshi') pool = OSHI_LIST || [];
    else if (currentLibraryFilter === 'all') pool = [...(OSHI_LIST || []), ...(MASTER_CARDS || [])];
    else pool = (MASTER_CARDS || []).filter(c => c.type === currentLibraryFilter);

    // 検索ワードで絞り込み
    const filtered = pool.filter(c => c.name.toLowerCase().includes(search));

    // カードを描画
    filtered.forEach(data => {
        // 構築画面専用のコンテナを作成
        const wrapper = document.createElement('div');
        wrapper.className = 'library-item-v2';
        
        // game-logic.js から createCardElement を呼び出し、カードDOMを生成
        if (typeof createCardElement === 'function') {
            const cardEl = createCardElement(data, true);
            wrapper.appendChild(cardEl);
        } else {
            // 万が一関数がない場合のフォールバック（デバッグ用）
            wrapper.innerText = data.name;
        }

        // デッキ追加ボタンの作成
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

// --- 以下、デッキ操作ロジック（既存のまま） ---

function setOshi(data) {
    selectedOshi = data;
    updateDeckSummary();
}

function addToDeck(data) {
    const target = (data.type === 'ayle') ? cheerDeckList : mainDeckList;
    const limit = (data.type === 'ayle') ? 20 : 50;
    if (target.length >= limit) return alert(`${limit}枚上限です`);
    
    const sameNameCount = target.filter(c => c.name === data.name).length;
    if (data.id !== "sora-00" && sameNameCount >= 4) return alert("同名カードは4枚までです");

    target.push({...data});
    updateDeckSummary();
}

function updateDeckSummary() {
    document.getElementById('mainBuildCount').innerText = mainDeckList.length;
    document.getElementById('cheerBuildCount').innerText = cheerDeckList.length;
    
    const startBtn = document.getElementById('startGameBtn');
    if (startBtn) {
        startBtn.disabled = !(mainDeckList.length === 50 && cheerDeckList.length === 20 && selectedOshi);
    }

    const oshiSummary = document.getElementById('oshiSummary');
    if (oshiSummary) {
        oshiSummary.innerHTML = selectedOshi ? `<div class="deck-item">${selectedOshi.name} <button class="btn-remove-oshi" onclick="removeOshi()">×</button></div>` : "未設定";
    }

    renderDeckSection('mainDeckSummary', mainDeckList);
    renderDeckSection('cheerDeckSummary', cheerDeckList);
}

function removeOshi() {
    selectedOshi = null;
    updateDeckSummary();
}

function renderDeckSection(elementId, list) {
    const container = document.getElementById(elementId);
    if (!container) return;
    container.innerHTML = '';
    const summary = list.reduce((acc, curr) => { acc[curr.name] = (acc[curr.name] || 0) + 1; return acc; }, {});

    Object.keys(summary).forEach(name => {
        const div = document.createElement('div');
        div.className = 'deck-item';
        div.innerHTML = `<span>${name} x${summary[name]}</span><div class="deck-item-controls"><button class="btn-minus" onclick="changeQuantity('${name}', '${elementId}', -1)">-</button><button class="btn-plus" onclick="changeQuantity('${name}', '${elementId}', 1)">+</button></div>`;
        container.appendChild(div);
    });
}

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
