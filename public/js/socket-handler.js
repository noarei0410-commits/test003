function restoreCard(id, info) { 
    const el = createCardElement({ id, ...info }); el.dataset.zoneId = info.zoneId || ""; el.style.zIndex = info.zIndex || 100;
    if (info.isFaceUp !== undefined) { el.classList.toggle('face-up', info.isFaceUp); el.classList.toggle('face-down', !info.isFaceUp); }
    if (info.isRotated !== undefined) el.classList.toggle('rotated', info.isRotated);
    if (info.percentX) { el.dataset.percentX = info.percentX; el.dataset.percentY = info.percentY; }
    field.appendChild(el); repositionCards(); 
}

socket.on('init', (d) => {
    myRole = d.role; field.querySelectorAll('.card').forEach(c => c.remove());
    if (d.fieldState) for (const id in d.fieldState) restoreCard(id, d.fieldState[id]);
    if (d.deckCount) { document.getElementById('mainCount').innerText = d.deckCount.main; document.getElementById('cheerCount').innerText = d.deckCount.cheer; }
    document.getElementById('room-info').innerText = `Room: ${socket.roomId} (${d.role})`;
});

socket.on('gameStarted', (d) => { field.querySelectorAll('.card').forEach(c => c.remove()); handDiv.innerHTML = ""; for (const id in d.fieldState) restoreCard(id, d.fieldState[id]); repositionCards(); });
socket.on('receiveCard', (d) => { const el = createCardElement({ ...d, isFaceUp: true }); el.style.position = 'relative'; handDiv.appendChild(el); });
socket.on('cardMoved', (d) => { 
    let el = document.getElementById(d.id); if (!el) return restoreCard(d.id, d);
    el.dataset.zoneId = d.zoneId || ""; el.style.zIndex = d.zIndex;
    if (d.isFaceUp !== undefined) { el.classList.toggle('face-up', d.isFaceUp); el.classList.toggle('face-down', !d.isFaceUp); }
    if (d.isRotated !== undefined) el.classList.toggle('rotated', d.isRotated);
    if (d.currentHp !== undefined) { el.cardData.currentHp = d.currentHp; const fhp = document.getElementById(`hp-display-${d.id}`); if (fhp) fhp.innerText = d.currentHp; }
    if (el.parentElement !== field) field.appendChild(el); repositionCards();
});

socket.on('hpUpdated', (d) => { const el = document.getElementById(d.id); if (el && el.cardData) { el.cardData.currentHp = d.currentHp; const fhp = document.getElementById(`hp-display-${d.id}`); if (fhp) fhp.innerText = d.currentHp; } });
socket.on('cardRemoved', (d) => { const el = document.getElementById(d.id); if (el) el.remove(); });
socket.on('deckCount', (c) => { document.getElementById('mainCount').innerText = c.main; document.getElementById('cheerCount').innerText = c.cheer; });

socket.on('deckInspectionResult', (data) => {
    const { type, cards } = data; const isSpec = (myRole === 'spectator'); deckGrid.innerHTML = "";
    document.getElementById('inspection-title').innerText = `${type.toUpperCase()} DECK (${cards.length})`;
    cards.forEach(card => {
        const container = document.createElement('div'); container.className = "library-item";
        const el = createCardElement({...card, isRotated: false, isFaceUp: true}, false); el.onclick = () => openZoom(card, el);
        container.appendChild(el);
        if (!isSpec) {
            const btn = document.createElement('button'); btn.innerText = "手札へ"; btn.onclick = () => { socket.emit('pickCardFromDeck', { type, cardId: card.id }); deckModal.style.display = 'none'; };
            container.appendChild(btn);
        }
        deckGrid.appendChild(container);
    });
    deckModal.style.display = 'flex';
});

function closeDeckInspection() { deckModal.style.display = 'none'; }
function openArchive() {
    deckGrid.innerHTML = ""; const isSpec = (myRole === 'spectator');
    document.getElementById('inspection-title').innerText = "ARCHIVE";
    const cards = Array.from(document.querySelectorAll('#field > .card')).filter(c => c.dataset.zoneId === 'archive');
    cards.forEach(card => {
        const container = document.createElement('div'); container.className = "library-item";
        const el = createCardElement({...card.cardData, isRotated: false, isFaceUp: true}, false); el.onclick = () => openZoom(card.cardData, el);
        container.appendChild(el);
        if (!isSpec) {
            const btn = document.createElement('button'); btn.innerText = "手札へ"; btn.onclick = () => { returnToHand(card); deckModal.style.display = 'none'; };
            container.appendChild(btn);
        }
        deckGrid.appendChild(container);
    });
    deckModal.style.display = 'flex';
}
