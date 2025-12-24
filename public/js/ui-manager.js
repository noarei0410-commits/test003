function showPage(pageId) {
    document.querySelectorAll('.full-page').forEach(p => p.style.display = 'none');
    const target = document.getElementById(pageId);
    if (target) {
        target.style.display = 'flex';
        if (pageId === 'card-list-page') filterLibrary('all');
        if (pageId === 'setup-modal') { updateLibrary(""); renderDecks(); }
    }
}

function updateLibrary(f = "") {
    const list = document.getElementById('libraryList'); if(!list) return;
    list.innerHTML = "";
    const all = [...OSHI_LIST, ...MASTER_CARDS.filter(c => c.type !== 'ayle')];
    all.filter(c => c.name.toLowerCase().includes(f.toLowerCase())).forEach(card => {
        const div = document.createElement('div'); div.className = "library-item";
        div.innerHTML = `<span>${card.name} <small>${card.bloom||card.category||""}</small></span>`;
        const btn = document.createElement('button'); btn.innerText = card.type === 'oshi' ? '設定' : '追加';
        btn.onclick = () => {
            if (card.type === 'oshi') selectedOshi = { ...card };
            else mainDeckList.push({ ...card });
            renderDecks();
        };
        div.appendChild(btn); list.appendChild(div);
    });
}

function renderDecks() {
    document.getElementById('oshiSummary').innerHTML = selectedOshi ? `<div class="deck-item">${selectedOshi.name} <button onclick="selectedOshi=null;renderDecks()">X</button></div>` : "";
    const mSum = document.getElementById('mainDeckSummary'); mSum.innerHTML = "";
    const grouped = mainDeckList.reduce((acc, c) => { const k = `${c.name}_${c.bloom||""}`; acc[k] = (acc[k]||{d:c,n:0}); acc[k].n++; return acc; }, {});
    Object.keys(grouped).forEach(k => {
        const div = document.createElement('div'); div.className = "deck-item";
        div.innerHTML = `<span>${grouped[k].d.name} x${grouped[k].n}</span><button onclick="removeFromMain('${k}')">-</button>`;
        mSum.appendChild(div);
    });
    const cSum = document.getElementById('cheerDeckSummary'); cSum.innerHTML = "";
    ["白","緑","赤","青","黄","紫"].forEach(color => {
        const name = `${color}エール`;
        const count = cheerDeckList.filter(x => x.name === name).length;
        const div = document.createElement('div'); div.className = "deck-item";
        div.innerHTML = `<span>${name}: ${count}</span><div><button onclick="addCheer('${name}')">+</button><button onclick="removeCheer('${name}')">-</button></div>`;
        cSum.appendChild(div);
    });
    document.getElementById('mainBuildCount').innerText = mainDeckList.length;
    document.getElementById('cheerBuildCount').innerText = cheerDeckList.length;
    document.getElementById('startGameBtn').disabled = (!selectedOshi || mainDeckList.length === 0 || cheerDeckList.length !== 20);
}

window.removeFromMain = (k) => { const idx = mainDeckList.findIndex(c => `${c.name}_${c.bloom||""}` === k); if(idx!==-1) mainDeckList.splice(idx,1); renderDecks(); };
window.addCheer = (n) => { if(cheerDeckList.length < 20) { cheerDeckList.push({name:n, type:'ayle'}); renderDecks(); } };
window.removeCheer = (n) => { const idx = cheerDeckList.findIndex(x => x.name === n); if(idx!==-1) cheerDeckList.splice(idx,1); renderDecks(); };

function filterLibrary(type) {
    const grid = document.getElementById('global-card-grid'); grid.innerHTML = "";
    let list = (type === 'all') ? [...OSHI_LIST, ...MASTER_CARDS] : (type === 'oshi' ? OSHI_LIST : MASTER_CARDS.filter(c => c.type === type));
    list.forEach(card => { const el = createCardElement(card, false); el.onclick = () => openZoom(card, el); grid.appendChild(el); });
}
