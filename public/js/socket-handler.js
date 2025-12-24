function restoreCard(id, info) { 
    const el = createCardElement({ id, ...info }); 
    el.dataset.zoneId = info.zoneId || ""; el.style.zIndex = info.zIndex || 100;
    if (info.isFaceUp !== undefined) { el.classList.toggle('face-up', info.isFaceUp); el.classList.toggle('face-down', !info.isFaceUp); }
    if (info.isRotated !== undefined) el.classList.toggle('rotated', info.isRotated);
    field.appendChild(el); repositionCards(); 
}

socket.on('init', (d) => {
    myRole = d.role; field.querySelectorAll('.card').forEach(c => c.remove());
    if (d.fieldState) for (const id in d.fieldState) restoreCard(id, d.fieldState[id]);
    if (d.deckCount) { 
        const mc = document.getElementById('mainCount'); if(mc) mc.innerText = d.deckCount.main; 
        const cc = document.getElementById('cheerCount'); if(cc) cc.innerText = d.deckCount.cheer;
    }
    document.getElementById('room-info').innerText = `Room: ${socket.roomId} (${d.role})`;
});

socket.on('gameStarted', (d) => { 
    field.querySelectorAll('.card').forEach(c => c.remove()); handDiv.innerHTML = ""; 
    for (const id in d.fieldState) restoreCard(id, d.fieldState[id]); repositionCards(); 
});

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
socket.on('deckCount', (c) => { 
    const mc = document.getElementById('mainCount'); if(mc) mc.innerText = c.main; 
    const cc = document.getElementById('cheerCount'); if(cc) cc.innerText = c.cheer;
});

/**
 * ロビー画面のルームリスト更新 (新デザイン対応)
 */
socket.on('roomListUpdate', (list) => {
    const listEl = document.getElementById('roomList'); if (!listEl) return;
    listEl.innerHTML = list.length === 0 ? '<p style="font-size:12px; color:#666; margin-top:20px;">現在稼働中のルームはありません</p>' : "";
    list.forEach(room => {
        const item = document.createElement('div'); item.className = 'room-item';
        item.innerHTML = `
            <span style="font-weight:bold; color:#00d2ff;"># ${room.id}</span>
            <div style="font-size:11px; color:#aaa; display:flex; gap:10px;">
                <span>Player: <b style="color:#ff5e5e;">${room.playerCount}</b></span>
                <span>Spec: <b style="color:#2ecc71;">${room.spectatorCount}</b></span>
            </div>
        `;
        item.onclick = () => { document.getElementById('roomIdInput').value = room.id; };
        listEl.appendChild(item);
    });
});

function openArchive() {
    deckGrid.innerHTML = ""; const isSpec = (myRole === 'spectator');
    document.getElementById('inspection-title').innerText = "ARCHIVE";
    const cards = Array.from(document.querySelectorAll('#field > .card')).filter(c => c.dataset.zoneId === 'archive');
    cards.forEach(card => {
        const container = document.createElement('div'); container.className = "library-item";
        const el = createCardElement({ ...card.cardData, isRotated: false, isFaceUp: true }, false);
        el.onclick = () => openZoom(card.cardData, el);
        container.appendChild(el);
        if (!isSpec) {
            const btn = document.createElement('button'); btn.innerText = "回収";
            btn.onclick = () => { returnToHand(card); deckModal.style.display = 'none'; };
            container.appendChild(btn);
        }
        deckGrid.appendChild(container);
    });
    deckModal.style.display = 'flex';
}
function closeDeckInspection() { deckModal.style.display = 'none'; }
