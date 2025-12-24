// フィルターの状態管理用
let currentLibraryFilter = 'all';

/**
 * ページ/モーダルの表示切り替え
 */
function showPage(pageId) {
    document.querySelectorAll('.full-page').forEach(p => p.style.display = 'none');
    const target = document.getElementById(pageId);
    if (target) {
        target.style.display = 'flex';
        if (pageId === 'card-list-page') filterLibrary('all');
        if (pageId === 'setup-modal') { 
            currentLibraryFilter = 'all'; 
            updateLibrary(); 
            renderDecks(); 
        }
    }
}

/**
 * ライブラリのフィルター切り替え
 */
window.setLibraryFilter = (type) => {
    currentLibraryFilter = type;
    // ボタンのactive表示切り替え
    document.querySelectorAll('.filter-tab').forEach(btn => {
        const isMatch = btn.getAttribute('onclick').includes(`'${type}'`);
        btn.classList.toggle('active', isMatch);
    });
    updateLibrary();
};

/**
 * 構築画面のライブラリ描画
 */
function updateLibrary() {
    const list = document.getElementById('libraryList'); if(!list) return;
    const searchVal = document.getElementById('searchInput').value.toLowerCase();
    list.innerHTML = "";
    
    // 全てのマスターデータから、現在のフィルターと検索文字に合うものを抽出
    const all = [...OSHI_LIST, ...MASTER_CARDS.filter(c => c.type !== 'ayle')];
    
    all.filter(card => {
        // カテゴリーチェック
        const typeMatch = (currentLibraryFilter === 'all') || (card.type === currentLibraryFilter);
        // 検索文字チェック
        const nameMatch = card.name.toLowerCase().includes(searchVal);
        return typeMatch && nameMatch;
    }).forEach(card => {
        const div = document.createElement('div'); div.className = "library-item";
        const subInfo = card.bloom || card.category || "";
        div.innerHTML = `<span>${card.name} <small style="color:#aaa;">${subInfo}</small></span>`;
        
        const btn = document.createElement('button'); 
        btn.innerText = card.type === 'oshi' ? '設定' : '追加';
        btn.className = "btn-add-main";
        btn.onclick = () => {
            if (card.type === 'oshi') {
                selectedOshi = { ...card };
            } else {
                if (mainDeckList.length < 50) mainDeckList.push({ ...card });
            }
            renderDecks();
        };
        div.appendChild(btn); list.appendChild(div);
    });
}

/**
 * 構築サマリーの描画
 */
function renderDecks() {
    // 推し
    document.getElementById('oshiSummary').innerHTML = selectedOshi 
        ? `<div class="deck-item"><span>${selectedOshi.name}</span><button onclick="selectedOshi=null;renderDecks()" class="btn-remove-oshi">X</button></div>` 
        : "<small style='color:#666;'>未設定</small>";
    
    // メイン
    const mSum = document.getElementById('mainDeckSummary'); mSum.innerHTML = "";
    const grouped = mainDeckList.reduce((acc, c) => { 
        const k = `${c.name}_${c.bloom || ""}`; acc[k] = (acc[k] || { d: c, n: 0 }); acc[k].n++; return acc; 
    }, {});

    Object.keys(grouped).forEach(k => {
        const div = document.createElement('div'); div.className = "deck-item";
        const cardData = grouped[k].d;
        div.innerHTML = `
            <span>${cardData.name} x${grouped[k].n}</span>
            <div class="deck-item-controls">
                <button class="btn-minus" onclick="removeFromMain('${k}')">-</button>
                <button class="btn-plus" onclick="addMoreToMain('${k}')">+</button>
            </div>`;
        mSum.appendChild(div);
    });

    // エール (ボタン順: - +)
    const cSum = document.getElementById('cheerDeckSummary'); cSum.innerHTML = "";
    ["白", "緑", "赤", "青", "黄", "紫"].forEach(color => {
        const name = `${color}エール`;
        const count = cheerDeckList.filter(x => x.name === name).length;
        const div = document.createElement('div'); div.className = "deck-item";
        div.innerHTML = `
            <span>${name}: ${count}</span>
            <div class="deck-item-controls">
                <button class="btn-minus" onclick="removeCheer('${name}')">-</button>
                <button class="btn-plus" onclick="addCheer('${name}')">+</button>
            </div>`;
        cSum.appendChild(div);
    });

    document.getElementById('mainBuildCount').innerText = mainDeckList.length;
    document.getElementById('cheerBuildCount').innerText = cheerDeckList.length;
    document.getElementById('startGameBtn').disabled = (!selectedOshi || mainDeckList.length === 0 || cheerDeckList.length !== 20);
}

window.addMoreToMain = (k) => {
    if (mainDeckList.length >= 50) return;
    const target = mainDeckList.find(c => `${c.name}_${c.bloom || ""}` === k);
    if (target) { mainDeckList.push({ ...target }); renderDecks(); }
};

window.removeFromMain = (k) => { 
    const idx = mainDeckList.findIndex(c => `${c.name}_${c.bloom || ""}` === k); 
    if (idx !== -1) { mainDeckList.splice(idx, 1); renderDecks(); }
};

window.addCheer = (n) => { 
    if (cheerDeckList.length < 20) { cheerDeckList.push({ name: n, type: 'ayle' }); renderDecks(); } 
};

window.removeCheer = (n) => { 
    const idx = cheerDeckList.findIndex(x => x.name === n); 
    if (idx !== -1) { cheerDeckList.splice(idx, 1); renderDecks(); }
};

function filterLibrary(type) {
    const grid = document.getElementById('global-card-grid'); grid.innerHTML = "";
    let list = (type === 'all') ? [...OSHI_LIST, ...MASTER_CARDS] : (type === 'oshi' ? OSHI_LIST : MASTER_CARDS.filter(c => c.type === type));
    list.forEach(card => { 
        const el = createCardElement(card, false); 
        el.onclick = () => openZoom(card, el); grid.appendChild(el); 
    });
}
