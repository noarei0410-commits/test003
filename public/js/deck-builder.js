/**
 * デッキ構築マネージャー (構築画面専用)
 * デッキに関する変数はここで一元管理し、二重宣言エラーを防止します [cite: 2025-12-24, 2025-12-25]。
 */
let currentLibraryFilter = 'all';
let builderSearchText = ''; 
let mainDeckList = [];     // メインデッキ (50枚)
let cheerDeckList = [];    // エールデッキ (20枚)
let selectedOshi = null;   // 推しホロメン

/**
 * 構築画面のフィルタ切り替え (4タブ構成: すべて, ホロメン, サポート, 推し)
 */
function setLibraryFilter(type) {
    currentLibraryFilter = type;
    document.querySelectorAll('.filter-tab').forEach(tab => {
        const clickAttr = tab.getAttribute('onclick') || "";
        tab.classList.toggle('active', clickAttr.includes(`'${type}'`));
    });
    updateLibrary();
}

/**
 * 構築画面専用の検索ハンドリング
 */
function handleBuilderSearch() {
    const input = document.getElementById('searchInput');
    builderSearchText = input ? input.value.toLowerCase() : '';
    updateLibrary();
}

/**
 * 構築画面ライブラリのタイル描画 (エールカードを除外して表示)
 */
function updateLibrary() {
    const list = document.getElementById('libraryList');
    if (!list) return;
    list.innerHTML = '';
    
    if (!MASTER_CARDS || MASTER_CARDS.length === 0) return;

    const baseCards = [...(OSHI_LIST || []), ...(MASTER_CARDS || [])];
    let pool = baseCards.filter(c => c && c.type !== 'ayle');

    if (currentLibraryFilter !== 'all') {
        pool = pool.filter(c => c.type === currentLibraryFilter);
    }

    const filtered = pool.filter(c => c.name.toLowerCase().includes(builderSearchText));

    filtered.forEach(data => {
        const wrapper = document.createElement('div');
        wrapper.className = 'library-item-v2';
        
        try {
            if (typeof createCardElement === 'function') {
                const cardEl = createCardElement(data, true);
                wrapper.appendChild(cardEl);
            }
        } catch (err) {
            console.error("Card Render Error:", data.name, err);
        }

        const btn = document.createElement('button');
        btn.className = 'btn-add-deck';
        if (data.type === 'oshi') {
            btn.innerText = '推しに設定';
            btn.onclick = () => setOshi(data);
        } else {
            btn.innerText = 'メインに追加';
            btn.onclick = () => addToDeck(data);
        }
        wrapper.appendChild(btn);
        list.appendChild(wrapper);
    });
}

/**
 * メインデッキへのカード追加
 */
function addToDeck(data) {
    if (mainDeckList.length >= 50) return alert("メインデッキは50枚上限です");
    const sameCardCount = mainDeckList.filter(c => c.id === data.id).length;
    if (data.id !== "sora-00" && sameCardCount >= 4) {
        return alert("同じカード(ID)は4枚までです");
    }
    mainDeckList.push({...data});
    updateDeckSummary();
}

/**
 * エールデッキの増減処理
 */
function changeCheerQuantity(colorName, delta) {
    const colorLabel = colorName + "エール";
    if (delta > 0) {
        if (cheerDeckList.length >= 20) return alert("エールデッキは20枚上限です");
        const ayleData = (AYLE_MASTER || []).find(a => a.name === colorLabel);
        if (ayleData) cheerDeckList.push({...ayleData});
    } else {
        const idx = cheerDeckList.findLastIndex(c => c.name === colorLabel);
        if (idx !== -1) cheerDeckList.splice(idx, 1);
    }
    updateDeckSummary();
}

/**
 * デッキサマリー表示の更新
 */
function updateDeckSummary() {
    const mainCountEl = document.getElementById('mainBuildCount');
    const cheerCountEl = document.getElementById('cheerBuildCount');
    if (mainCountEl) mainCountEl.innerText = mainDeckList.length;
    if (cheerCountEl) cheerCountEl.innerText = cheerDeckList.length;
    
    const startBtn = document.getElementById('startGameBtn');
    if (startBtn) {
        startBtn.disabled = !(mainDeckList.length === 50 && cheerDeckList.length === 20 && selectedOshi);
    }

    const oshiSummary = document.getElementById('oshiSummary');
    if (oshiSummary) {
        oshiSummary.innerHTML = selectedOshi ? 
            `<div class="deck-item"><span>${selectedOshi.name}</span> <button class="btn-remove-oshi" onclick="removeOshi()">×</button></div>` : 
            "未設定";
    }

    renderMainDeckSection();
    renderCheerDeckSection();

    // デッキの状態が変わるたびにローカルストレージへ保存
    saveDeckToLocal();
}

/**
 * ローカルストレージへの保存処理
 */
function saveDeckToLocal() {
    const deckData = {
        main: mainDeckList,
        cheer: cheerDeckList,
        oshi: selectedOshi
    };
    localStorage.setItem('hOCG_saved_deck', JSON.stringify(deckData));
    console.log("Deck saved to localStorage.");
}

/**
 * ローカルストレージからの読み込み処理
 */
function loadDeckFromLocal() {
    const saved = localStorage.getItem('hOCG_saved_deck');
    if (!saved) return;

    try {
        const deckData = JSON.parse(saved);
        mainDeckList = deckData.main || [];
        cheerDeckList = deckData.cheer || [];
        selectedOshi = deckData.oshi || null;
        
        console.log("Deck loaded from localStorage.");
        updateDeckSummary();
    } catch (e) {
        console.error("Failed to load deck from localStorage", e);
    }
}

/**
 * メインデッキセクションの描画 (ID集計・Bloomランク表示)
 */
function renderMainDeckSection() {
    const container = document.getElementById('mainDeckSummary');
    if (!container) return;
    container.innerHTML = '';
    
    const summary = mainDeckList.reduce((acc, curr) => {
        if (!acc[curr.id]) {
            acc[curr.id] = { name: curr.name, count: 0, bloom: curr.bloom, type: curr.type };
        }
        acc[curr.id].count++;
        return acc;
    }, {});

    Object.keys(summary).forEach(id => {
        const item = summary[id];
        const div = document.createElement('div');
        div.className = 'deck-item';
        let displayName = item.name + (item.bloom ? ` [${item.bloom}]` : "");
        div.innerHTML = `
            <span>${displayName} x${item.count}</span>
            <div class="deck-item-controls">
                <button class="btn-minus" onclick="changeMainQuantityById('${id}', -1)">-</button>
            </div>`;
        container.appendChild(div);
    });
}

/**
 * ID指定でメインデッキの枚数を減らす
 */
function changeMainQuantityById(id, delta) {
    if (delta < 0) {
        const idx = mainDeckList.findLastIndex(c => c.id === id);
        if (idx !== -1) mainDeckList.splice(idx, 1);
    }
    updateDeckSummary();
}

/**
 * エールデッキセクションの描画
 */
function renderCheerDeckSection() {
    const container = document.getElementById('cheerDeckSummary');
    if (!container) return;
    container.innerHTML = '';
    const colors = ["赤", "青", "緑", "黄", "紫", "白"];
    colors.forEach(color => {
        const fullName = color + "エール";
        const count = cheerDeckList.filter(c => c.name === fullName).length;
        const div = document.createElement('div');
        div.className = 'deck-item cheer-item';
        const colorValue = COLORS[color];
        div.style.borderLeftColor = colorValue;
        div.innerHTML = `
            <span style="color: ${colorValue}">${color}エール x${count}</span>
            <div class="deck-item-controls">
                <button class="btn-minus" onclick="changeCheerQuantity('${color}', -1)">-</button>
                <button class="btn-plus" onclick="changeCheerQuantity('${color}', 1)">+</button>
            </div>`;
        container.appendChild(div);
    });
}

/**
 * 対戦画面へ進む
 */
function submitDeck() {
    if (mainDeckList.length !== 50 || cheerDeckList.length !== 20 || !selectedOshi) {
        return alert("デッキ構成が不完全です");
    }
    socket.emit('setupDeck', { oshi: selectedOshi, mainDeck: mainDeckList, cheerDeck: cheerDeckList });
    showPage(null);
}

function setOshi(data) { selectedOshi = data; updateDeckSummary(); }
function removeOshi() { selectedOshi = null; updateDeckSummary(); }
