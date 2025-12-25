/**
 * デッキ構築マネージャー (構築画面専用)
 */
let currentLibraryFilter = 'all';
let builderSearchText = ''; 
let mainDeckList = [];     
let cheerDeckList = [];    
let selectedOshi = null;   

let savedDecks = {}; 

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
        } catch (err) { console.error("Card Render Error:", data.name, err); }

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

function addToDeck(data) {
    if (mainDeckList.length >= 50) return alert("メインデッキは50枚上限です");
    const sameCardCount = mainDeckList.filter(c => c.id === data.id).length;
    if (data.id !== "sora-00" && sameCardCount >= 4) return alert("同じカード(ID)は4枚までです");
    mainDeckList.push({...data});
    updateDeckSummary();
}

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
 * 複数保存・上書き・読込機能
 */
function saveCurrentDeckWithTitle() {
    const titleInput = document.getElementById('deckTitleInput');
    const title = titleInput.value.trim();
    if (!title) return alert("デッキ名を入力してください");

    // 上書き確認ロジック
    if (savedDecks[title]) {
        if (!confirm(`デッキ「${title}」は既に存在します。上書きしますか？`)) return;
    }

    // メイン、エール、推しのすべてを保存
    savedDecks[title] = {
        main: [...mainDeckList],
        cheer: [...cheerDeckList],
        oshi: selectedOshi ? {...selectedOshi} : null
    };
    
    localStorage.setItem('hOCG_saved_decks_v2', JSON.stringify(savedDecks));
    titleInput.value = '';
    renderSavedDecksList();
    alert(`デッキ「${title}」を保存しました`);
}

/**
 * 現在の構築のリセット機能
 */
function resetDeck() {
    if (!confirm("現在の構築内容（メイン・エール・推し）をすべてリセットしますか？")) return;
    mainDeckList = [];
    cheerDeckList = [];
    selectedOshi = null;
    updateDeckSummary();
}

function loadDeckByTitle(title) {
    const data = savedDecks[title];
    if (!data) return;
    
    mainDeckList = [...(data.main || [])];
    cheerDeckList = [...(data.cheer || [])];
    selectedOshi = data.oshi ? {...data.oshi} : null;
    
    updateDeckSummary();
    alert(`デッキ「${title}」を読み込みました`);
}

function deleteDeckByTitle(title) {
    if (!confirm(`デッキ「${title}」を削除しますか？`)) return;
    delete savedDecks[title];
    localStorage.setItem('hOCG_saved_decks_v2', JSON.stringify(savedDecks));
    renderSavedDecksList();
}

function renderSavedDecksList() {
    const container = document.getElementById('savedDecksList');
    if (!container) return;
    container.innerHTML = '';
    const titles = Object.keys(savedDecks);
    if (titles.length === 0) {
        container.innerHTML = '<div style="font-size: 11px; color: #888;">保存されたデッキはありません</div>';
        return;
    }
    titles.forEach(title => {
        const div = document.createElement('div');
        div.className = 'deck-item';
        div.innerHTML = `
            <span style="cursor: pointer; flex: 1;" onclick="loadDeckByTitle('${title}')">📁 ${title}</span>
            <div class="deck-item-controls">
                <button class="btn-minus" onclick="deleteDeckByTitle('${title}')" title="削除">×</button>
            </div>`;
        container.appendChild(div);
    });
}

function loadDeckFromLocal() {
    const saved = localStorage.getItem('hOCG_saved_decks_v2');
    if (!saved) return;
    try {
        savedDecks = JSON.parse(saved);
        renderSavedDecksList();
    } catch (e) { console.error("Failed to parse saved decks", e); }
}

function updateDeckSummary() {
    const mainCountEl = document.getElementById('mainBuildCount');
    const cheerCountEl = document.getElementById('cheerBuildCount');
    if (mainCountEl) mainCountEl.innerText = mainDeckList.length;
    if (cheerCountEl) cheerCountEl.innerText = cheerDeckList.length;
    const startBtn = document.getElementById('startGameBtn');
    if (startBtn) startBtn.disabled = !(mainDeckList.length === 50 && cheerDeckList.length === 20 && selectedOshi);
    const oshiSummary = document.getElementById('oshiSummary');
    if (oshiSummary) oshiSummary.innerHTML = selectedOshi ? `<div class="deck-item"><span>${selectedOshi.name}</span> <button class="btn-remove-oshi" onclick="removeOshi()">×</button></div>` : "未設定";
    renderMainDeckSection();
    renderCheerDeckSection();
}

function renderMainDeckSection() {
    const container = document.getElementById('mainDeckSummary');
    if (!container) return;
    container.innerHTML = '';
    const summary = mainDeckList.reduce((acc, curr) => {
        if (!acc[curr.id]) acc[curr.id] = { name: curr.name, count: 0, bloom: curr.bloom, type: curr.type };
        acc[curr.id].count++;
        return acc;
    }, {});
    Object.keys(summary).forEach(id => {
        const item = summary[id];
        const div = document.createElement('div');
        div.className = 'deck-item';
        let displayName = item.name + (item.bloom ? ` [${item.bloom}]` : "");
        div.innerHTML = `<span>${displayName} x${item.count}</span><div class="deck-item-controls"><button class="btn-minus" onclick="changeMainQuantityById('${id}', -1)">-</button></div>`;
        container.appendChild(div);
    });
}

function renderCheerDeckSection() {
    const container = document.getElementById('cheerDeckSummary');
    if (!container) return;
    container.innerHTML = '';
    ["赤", "青", "緑", "黄", "紫", "白"].forEach(color => {
        const fullName = color + "エール";
        const count = cheerDeckList.filter(c => c.name === fullName).length;
        const div = document.createElement('div');
        div.className = 'deck-item cheer-item';
        const colorValue = COLORS[color];
        div.style.borderLeftColor = colorValue;
        div.innerHTML = `<span style="color: ${colorValue}">${color}エール x${count}</span><div class="deck-item-controls"><button class="btn-minus" onclick="changeCheerQuantity('${color}', -1)">-</button><button class="btn-plus" onclick="changeCheerQuantity('${color}', 1)">+</button></div>`;
        container.appendChild(div);
    });
}

function changeMainQuantityById(id, delta) {
    if (delta < 0) {
        const idx = mainDeckList.findLastIndex(c => c.id === id);
        if (idx !== -1) mainDeckList.splice(idx, 1);
    }
    updateDeckSummary();
}

function submitDeck() {
    if (mainDeckList.length !== 50 || cheerDeckList.length !== 20 || !selectedOshi) return alert("デッキ構成が不完全です");
    socket.emit('setupDeck', { oshi: selectedOshi, mainDeck: mainDeckList, cheerDeck: cheerDeckList });
    showPage(null);
}

function setOshi(data) { selectedOshi = data; updateDeckSummary(); }
function removeOshi() { selectedOshi = null; updateDeckSummary(); }
