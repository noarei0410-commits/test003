function restoreCard(id, info) { 
    const el = createCardElement({ id, ...info }); 
    el.dataset.zoneId = info.zoneId || ""; 
    el.style.zIndex = info.zIndex || 100;
    if (info.percentX) { el.dataset.percentX = info.percentX; el.dataset.percentY = info.percentY; }
    field.appendChild(el); 
    repositionCards(); 
}

socket.on('gameStarted', (d) => { 
    field.querySelectorAll('.card').forEach(c => c.remove()); 
    handDiv.innerHTML = ""; 
    for (const id in d.fieldState) restoreCard(id, d.fieldState[id]); 
    repositionCards(); 
});

socket.on('receiveCard', (d) => {
    if (!handDiv) return;
    const el = createCardElement({ ...d, isFaceUp: true });
    el.style.position = 'relative';
    handDiv.appendChild(el);
});

socket.on('cardMoved', (d) => { 
    let el = document.getElementById(d.id);
    if (!el) return restoreCard(d.id, d);
    
    el.dataset.zoneId = d.zoneId || "";
    el.style.zIndex = d.zIndex;
    
    if (d.isFaceUp !== undefined) {
        el.classList.toggle('face-up', d.isFaceUp);
        el.classList.toggle('face-down', !d.isFaceUp);
    }
    if (d.isRotated !== undefined) {
        el.classList.toggle('rotated', d.isRotated);
    }

    if (d.currentHp !== undefined) {
        el.cardData.currentHp = d.currentHp;
        const fieldHp = document.getElementById(`hp-display-${d.id}`);
        if (fieldHp) fieldHp.innerText = d.currentHp;
    }

    if (el.parentElement !== field) field.appendChild(el);
    if (d.percentX) { el.dataset.percentX = d.percentX; el.dataset.percentY = d.percentY; } else { delete el.dataset.percentX; }
    repositionCards();
});

socket.on('hpUpdated', (d) => {
    const el = document.getElementById(d.id);
    if (el && el.cardData) {
        el.cardData.currentHp = d.currentHp;
        const fieldHp = document.getElementById(`hp-display-${d.id}`);
        if (fieldHp) fieldHp.innerText = d.currentHp;
        const zoomHp = document.getElementById('zoom-hp-val');
        if (zoomHp && zoomModal.style.display === 'flex') zoomHp.innerText = `HP ${d.currentHp}`;
    }
});

socket.on('cardRemoved', (d) => { const el = document.getElementById(d.id); if (el) el.remove(); });
socket.on('cardFlipped', (d) => { 
    const el = document.getElementById(d.id); 
    if (el) { el.classList.toggle('face-up', d.isFaceUp); el.classList.toggle('face-down', !d.isFaceUp); } 
});

socket.on('deckCount', (c) => { 
    const m = document.getElementById('mainCount'), ch = document.getElementById('cheerCount');
    if(m) m.innerText = c.main; if(ch) ch.innerText = c.cheer; 
});

socket.on('deckInspectionResult', (data) => {
    const { type, cards } = data;
    deckGrid.innerHTML = "";
    document.getElementById('inspection-title').innerText = (type === 'main' ? 'Main Deck' : 'Cheer Deck') + ` (${cards.length})`;
    cards.forEach(card => {
        const container = document.createElement('div'); container.className = "library-item";
        // 確認画面用: 強制的に縦向き、表向きで生成
        const el = createCardElement({...card, isRotated: false, isFaceUp: true}, false);
        el.onclick = () => openZoom(card, el); // 確認画面からも拡大可能に
        const pickBtn = document.createElement('button'); pickBtn.className = "btn-recover"; pickBtn.innerText = "手札へ";
        pickBtn.onclick = () => { socket.emit('pickCardFromDeck', { type, cardId: card.id }); deckModal.style.display = 'none'; };
        container.appendChild(el); container.appendChild(pickBtn); deckGrid.appendChild(container);
    });
    deckModal.style.display = 'flex';
});

function closeDeckInspection() { deckModal.style.display = 'none'; }

/**
 * アーカイブ確認機能 (縦向き・拡大対応)
 */
function openArchive() {
    deckGrid.innerHTML = "";
    document.getElementById('inspection-title').innerText = "Archive (確認)";
    const archiveCards = Array.from(document.querySelectorAll('#field > .card')).filter(c => c.dataset.zoneId === 'archive');
    archiveCards.forEach(card => {
        const container = document.createElement('div'); container.className = "library-item";
        // アーカイブ内のカードを強制的に縦向き(rotated: false)にして表示
        const previewData = { ...card.cardData, isRotated: false, isFaceUp: true };
        const el = createCardElement(previewData, false);
        
        // カードをクリックして拡大表示
        el.onclick = () => openZoom(card.cardData, el);
        
        const recoverBtn = document.createElement('button'); recoverBtn.className = "btn-recover"; recoverBtn.innerText = "手札へ";
        recoverBtn.onclick = () => { returnToHand(card); deckModal.style.display = 'none'; };
        
        container.appendChild(el); container.appendChild(recoverBtn); deckGrid.appendChild(container);
    });
    deckModal.style.display = 'flex';
}
