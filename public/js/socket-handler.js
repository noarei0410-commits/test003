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
    if (d.currentHp !== undefined) {
        el.cardData.currentHp = d.currentHp;
        const fieldHp = document.getElementById(`hp-display-${d.id}`);
        if (fieldHp) fieldHp.innerText = d.currentHp;
    }
    if (el.parentElement !== field) field.appendChild(el);
    el.classList.toggle('rotated', !!d.isRotated);
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
        if (zoomHp && zoomModal.style.display === 'flex') {
            zoomHp.innerText = `HP ${d.currentHp}`;
        }
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
        const el = createCardElement(card, false); el.classList.remove('face-down'); el.classList.add('face-up');
        const pickBtn = document.createElement('button'); pickBtn.className = "btn-recover"; pickBtn.innerText = "手札へ";
        pickBtn.onclick = () => { socket.emit('pickCardFromDeck', { type, cardId: card.id }); deckModal.style.display = 'none'; };
        container.appendChild(el); container.appendChild(pickBtn); deckGrid.appendChild(container);
    });
    deckModal.style.display = 'flex';
});

function closeDeckInspection() { deckModal.style.display = 'none'; }
function openArchive() {
    deckGrid.innerHTML = "";
    document.getElementById('inspection-title').innerText = "Archive (確認)";
    const archiveCards = Array.from(document.querySelectorAll('#field > .card')).filter(c => c.dataset.zoneId === 'archive');
    archiveCards.forEach(card => {
        const container = document.createElement('div'); container.className = "library-item";
        const el = createCardElement(card.cardData, false); el.classList.remove('face-down'); el.classList.add('face-up');
        const recoverBtn = document.createElement('button'); recoverBtn.className = "btn-recover"; recoverBtn.innerText = "手札へ";
        recoverBtn.onclick = () => { returnToHand(card); deckModal.style.display = 'none'; };
        container.appendChild(el); container.appendChild(recoverBtn); deckGrid.appendChild(container);
    });
    deckModal.style.display = 'flex';
}
