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
    let el = document.getElementById(d.id); if (!el) return restoreCard(d.id, d);
    el.dataset.zoneId = d.zoneId || ""; el.style.zIndex = d.zIndex; if (el.parentElement !== field) field.appendChild(el);
    el.classList.toggle('rotated', !!d.isRotated); repositionCards();
});

socket.on('cardRemoved', (d) => { const el = document.getElementById(d.id); if (el) el.remove(); });
socket.on('cardFlipped', (d) => { const el = document.getElementById(d.id); if (el) { el.classList.toggle('face-up', d.isFaceUp); el.classList.toggle('face-down', !d.isFaceUp); } });

socket.on('deckCount', (c) => { 
    document.getElementById('mainCount').innerText = c.main; 
    document.getElementById('cheerCount').innerText = c.cheer; 
});

socket.on('deckInspectionResult', (data) => {
    const { type, cards } = data;
    const grid = document.getElementById('deck-card-grid'); grid.innerHTML = "";
    document.getElementById('inspection-title').innerText = (type === 'main' ? 'Main Deck' : 'Cheer Deck') + ` (${cards.length})`;
    cards.forEach(card => {
        const container = document.createElement('div'); container.className = "archive-item";
        const el = createCardElement(card, false); el.classList.remove('face-down'); el.classList.add('face-up');
        const pickBtn = document.createElement('button'); pickBtn.className = "btn-recover"; pickBtn.innerText = "手札へ";
        pickBtn.onclick = () => { socket.emit('pickCardFromDeck', { type, cardId: card.id }); closeDeckInspection(); };
        container.appendChild(el); container.appendChild(pickBtn); grid.appendChild(container);
    });
    deckModal.style.display = 'flex';
});

function restoreCard(id, info) { 
    const el = createCardElement({ id, ...info }); 
    el.dataset.zoneId = info.zoneId || ""; 
    el.style.zIndex = info.zIndex; 
    field.appendChild(el); 
    repositionCards(); 
}

function closeDeckInspection() { deckModal.style.display = 'none'; }
function openArchive() { /* アーカイブ表示ロジックはui-managerに類似 */ }
