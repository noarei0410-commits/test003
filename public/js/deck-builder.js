/**
 * デッキ構築マネージャー (構築画面専用)
 */
let currentLibraryFilter = 'all';
let builderSearchText = ''; 
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
        tab.classList.toggle('active', clickAttr.includes(`'${type}'`));
    });
    updateLibrary();
}

function handleBuilderSearch() {
    const input = document.getElementById('searchInput');
    builderSearchText = input ? input.value.toLowerCase() : '';
    updateLibrary();
}

/**
 * 構築画面ライブラリのタイル描画
 */
function updateLibrary() {
    const list = document.getElementById('libraryList');
    if (!list) return;
    list.innerHTML = '';
    
    const baseCards = [...(OSHI_LIST || []), ...(MASTER_CARDS || [])];
    let pool = baseCards.filter(c => c.type !== 'ayle');

    if (currentLibraryFilter !== 'all') {
        pool = pool.filter(c => c.type === currentLibraryFilter);
    }

    const filtered = pool.filter(c => c.name.toLowerCase().includes(builderSearchText));

    filtered.forEach(data => {
        const wrapper = document.createElement('div');
        wrapper.className = 'library-item-v2';
        
        if (typeof createCardElement === 'function') {
            const cardEl = createCardElement(data, true);
            wrapper.appendChild(cardEl);
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
 * 制限ルールを「同名カード」から「同一IDのカード」に変更
 */
function addToDeck(data) {
    if (mainDeckList.length >= 50) return alert("メインデッキは50枚上限です");
    
    // カード名ではなく、カードIDで重複枚数をチェックするように変更
    const sameCardCount = mainDeckList.filter(c => c.id === data.id).length;
    
    // 特定のカード（ときのそらDebut等）を除き、完全に同じカードは4枚まで
    if (data.id !== "sora-00" && sameCardCount >= 4) {
        return alert("同じカードは4枚までです");
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
    const mainCount = document.getElementById('mainBuildCount');
    const cheerCount = document.getElementById('cheerBuildCount');
    if (mainCount) mainCount.innerText = mainDeckList.length;
    if (cheerCount) cheerCount.innerText = cheerDeckList.length;
    
    const startBtn = document.getElementById('startGameBtn');
    if (startBtn) {
        startBtn.disabled = !(mainDeckList.length === 50 && cheerDeckList.length === 20 && selectedOshi);
    }

    const oshiSummary = document.getElementById('oshiSummary');
    if (oshiSummary) {
        oshiSummary.innerHTML = selectedOshi ? `<div class="deck-item"><span>${selectedOshi.name}</span> <button class="btn-remove-oshi" onclick="removeOshi()">×</button></div>` : "未設定";
    }

    renderMainDeckSection();
    renderCheerDeckSection();
}

/**
 * メインデッキセクションの描画
 * IDごとに集計し、Bloomランク等の情報で個別に区別できるように修正
 */
function renderMainDeckSection() {
    const container = document.getElementById('mainDeckSummary');
    if (!container) return;
    container.innerHTML = '';
    
    // IDごとに集計を行うことで、同名でも別カード（別ID）なら別枠で表示
    const summary = mainDeckList.reduce((acc, curr) => {
        if (!acc[curr.id]) {
            acc[curr.id] = { 
                name: curr.name, 
                count: 0, 
                bloom: curr.bloom,
                type: curr.type
            };
        }
        acc[curr.id].count++;
        return acc;
    }, {});

    Object.keys(summary).forEach(id => {
        const item = summary[id];
        const div = document.createElement('div');
        div.className = 'deck-item';
        
        // ホロメンならBloomランクを表示に含めて、同名カードを区別しやすくする
        let displayName = item.name;
        if (item.type === 'holomen' && item.bloom) {
            displayName += ` [${item.bloom}]`;
        }
        
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
        div.style.borderLeftColor = COLORS[color];
        div.innerHTML = `
            <span style="color: ${COLORS[color]}">${color}エール x${count}</span>
            <div class="deck-item-controls">
                <button class="btn-minus" onclick="changeCheerQuantity('${color}', -1)">-</button>
                <button class="btn-plus" onclick="changeCheerQuantity('${color}', 1)">+</button>
            </div>`;
        container.appendChild(div);
    });
}

function setOshi(data) { selectedOshi = data; updateDeckSummary(); }
function removeOshi() { selectedOshi = null; updateDeckSummary(); }
