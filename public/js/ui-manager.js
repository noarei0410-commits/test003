function showPage(pageId) {
    document.querySelectorAll('.full-page').forEach(p => { p.style.display = 'none'; });
    const target = document.getElementById(pageId);
    if (target) {
        target.style.display = 'flex';
        if (pageId === 'setup-modal') { updateLibrary(""); renderDecks(); }
    }
}

function updateLibrary(f = "") {
    const list = document.getElementById('libraryList'); if(!list) return;
    list.innerHTML = "";
    const search = f.toLowerCase();
    const all = [...OSHI_LIST, ...MASTER_CARDS.filter(c => c.type !== 'ayle')];
    
    all.filter(c => c.name.toLowerCase().includes(search)).forEach(card => {
        const div = document.createElement('div');
        div.className = "library-item";
        div.innerHTML = `<span>${card.name} <span class="type-tag">${card.bloom||'S'}</span></span>`;
        const btn = document.createElement('button');
        btn.className = "btn-add"; btn.innerText = card.type === 'oshi' ? '設定' : '追加';
        btn.onclick = () => {
            if (card.type === 'oshi') selectedOshi = { ...card };
            else mainDeckList.push({ ...card });
            renderDecks();
        };
        div.appendChild(btn); list.appendChild(div);
    });
}

function renderDecks() {
    // 構築画面のサマリー表示 (既存のロジックをここに維持)
    // 枚数カウント、開始ボタンの活性化判定など
    const startBtn = document.getElementById('startGameBtn');
    startBtn.disabled = (!selectedOshi || mainDeckList.length === 0 || cheerDeckList.length !== 20);
}
