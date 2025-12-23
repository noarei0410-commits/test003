function createCardElement(data, withEvents = true) {
    if(!data) return document.createElement('div');
    const el = document.createElement('div'); el.id = data.id || ""; el.innerText = data.name; el.className = 'card';
    el.classList.add(data.isFaceUp !== false ? 'face-up' : 'face-down');
    if (data.isRotated) el.classList.add('rotated');
    
    // HP/Bloom表示
    if (data.type === 'holomen' || data.type === 'oshi') {
        const hp = document.createElement('div'); hp.className = 'card-hp'; hp.innerText = data.hp || '';
        el.appendChild(hp);
        if (data.color) {
            const ci = document.createElement('div'); ci.className = `card-color-icon color-${data.color}`; el.appendChild(ci);
        }
    }
    
    el.cardData = data;
    if (withEvents) setupCardEvents(el);
    return el;
}

function setupDeckClick(id, type) {
    const el = document.getElementById(id);
    if (!el) return;
    let clickTimer = null;
    el.onpointerdown = (e) => {
        e.preventDefault();
        clickTimer = setTimeout(() => {
            socket.emit('inspectDeck', type);
            clickTimer = null;
        }, 500);
    };
    el.onpointerup = () => {
        if (clickTimer) {
            clearTimeout(clickTimer);
            if(myRole === 'player') socket.emit(type === 'main' ? 'drawMainCard' : 'drawCheerCard');
            clickTimer = null;
        }
    };
}

function repositionCards() {
    const fRect = document.getElementById('field').getBoundingClientRect();
    const zoneCounts = {};
    document.querySelectorAll('.card').forEach(card => {
        if (card.parentElement !== field || card === currentDragEl) return;
        const zid = card.dataset.zoneId;
        if (zid) {
            const z = document.getElementById(zid);
            if(z) {
                const zr = z.getBoundingClientRect(), cr = card.getBoundingClientRect();
                if (!zoneCounts[zid]) zoneCounts[zid] = 0;
                // ライフの縦並び配置
                const off = zid === 'life-zone' ? zoneCounts[zid] * 18 : 0;
                card.style.left = (zr.left - fRect.left) + (zr.width - cr.width) / 2 + 'px';
                card.style.top = (zr.top - fRect.top) + 5 + off + 'px';
                zoneCounts[zid]++;
            }
        }
    });
}
