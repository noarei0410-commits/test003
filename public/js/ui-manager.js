/**
 * ページ/モーダルの表示切り替え
 */
function showPage(pageId) {
    document.querySelectorAll('.full-page').forEach(p => { p.style.display = 'none'; });
    const target = document.getElementById(pageId);
    if (target) {
        target.style.display = 'flex';
        // ライブラリ画面なら初期表示を実行
        if (pageId === 'card-list-page') filterLibrary('all');
        if (pageId === 'setup-modal') { updateLibrary(""); renderDecks(); }
    }
}

/**
 * 構築画面のライブラリ描画
 */
function updateLibrary(f = "") {
    const list = document.getElementById('libraryList'); if(!list) return;
    list.innerHTML = "";
    const search = f.toLowerCase();
    const all = [...OSHI_LIST, ...MASTER_CARDS.filter(c => c.type !== 'ayle')];
    
    all.filter(c => c.name.toLowerCase().includes(search)).forEach(card => {
        const div = document.createElement('div');
        div.className = "library-item";
        const typeInfo = card.type === 'oshi' ? "OSHI" : (card.bloom || card.category || "S");
        div.innerHTML = `<span>${card.name} <span class="type-tag">${typeInfo}</span></span>`;
        const btn = document.createElement('button');
        btn.className = "btn-add"; btn.innerText = card.type === 'oshi' ? '設定' : '追加';
        btn.onclick = () => addToDeck(card);
        div.appendChild(btn); list.appendChild(div);
    });
}

function addToDeck(card) {
    if (card.type === 'oshi') selectedOshi = { ...card };
    else if (card.type === 'ayle') { if (cheerDeckList.length < 20) cheerDeckList.push({ ...card, type: 'ayle' }); }
    else mainDeckList.push({ ...card });
    renderDecks();
}

function renderDecks() {
    const oSum = document.getElementById('oshiSummary'), mSum = document.getElementById('mainDeckSummary'), cSum = document.getElementById('cheerDeckSummary');
    if (!oSum) return;
    oSum.innerHTML = selectedOshi ? `<div class="deck-item"><span>${selectedOshi.name}</span><button onclick="selectedOshi=null;renderDecks()" class="btn-remove">X</button></div>` : "";
    mSum.innerHTML = "";
    const grouped = mainDeckList.reduce((acc, c) => { 
        const key = `${c.name}_${c.bloom||c.category||""}`; 
        acc[key] = (acc[key] || { d: c, n: 0 }); acc[key].n++; return acc; 
    }, {});
    Object.keys(grouped).forEach(k => {
        const div = document.createElement('div'); div.className = "deck-item";
        div.innerHTML = `<span>${grouped[k].d.name} x${grouped[k].n}</span><button class="btn-minus">-</button>`;
        div.querySelector('button').onclick = () => { 
            const idx = mainDeckList.findIndex(c => `${c.name}_${c.bloom||c.category||""}` === k);
            if (idx !== -1) mainDeckList.splice(idx, 1); renderDecks(); 
        };
        mSum.appendChild(div);
    });
    cSum.innerHTML = "";
    const types = [{name:"白エール"},{name:"緑エール"},{name:"赤エール"},{name:"青エール"},{name:"黄エール"},{name:"紫エール"}];
    types.forEach(c => {
        const n = cheerDeckList.filter(x => x.name === c.name).length;
        const div = document.createElement('div'); div.className = "deck-item";
        div.innerHTML = `<span>${c.name} : ${n}</span><div><button class="btn-minus">-</button><button class="btn-plus">+</button></div>`;
        div.querySelectorAll('button')[0].onclick = () => { const idx = cheerDeckList.findIndex(x => x.name === c.name); if(idx!==-1) cheerDeckList.splice(idx,1); renderDecks(); };
        div.querySelectorAll('button')[1].onclick = () => { if(cheerDeckList.length<20) { cheerDeckList.push({...c, type:'ayle'}); renderDecks(); } };
        cSum.appendChild(div);
    });
    document.getElementById('startGameBtn').disabled = (!selectedOshi || mainDeckList.length === 0 || cheerDeckList.length !== 20);
}

/**
 * カードリスト（確認用ライブラリ）のフィルタリング描画修正
 */
function filterLibrary(type) {
    const grid = document.getElementById('global-card-grid'); if (!grid) return;
    grid.innerHTML = "";
    
    // アクティブクラスの切り替え
    document.querySelectorAll('.filter-btn').forEach(btn => {
        const typeMap = { all: 'すべて', holomen: 'ホロメン', support: 'サポート', ayle: 'エール', oshi: '推し' };
        btn.classList.toggle('active', btn.innerText === typeMap[type]);
    });

    // データの統合
    let list = [];
    if (type === 'all') {
        list = [...OSHI_LIST, ...MASTER_CARDS];
    } else if (type === 'oshi') {
        list = OSHI_LIST;
    } else {
        list = MASTER_CARDS.filter(c => c.type === type);
    }

    // 描画実行
    list.forEach(card => {
        const el = createCardElement(card, false); 
        el.onclick = () => openZoom(card, el); 
        grid.appendChild(el);
    });
}
