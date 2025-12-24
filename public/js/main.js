window.onload = async () => {
    await loadCardData();
    setupDeckClick('main-deck-zone', 'main');
    setupDeckClick('cheer-deck-zone', 'cheer');
    window.onresize = repositionCards;
    showPage('hub-page');
};

async function loadCardData() {
    try {
        const res = await Promise.all([
            fetch('/data/holomen.json').then(r => r.json()),
            fetch('/data/support.json').then(r => r.json()),
            fetch('/data/ayle.json').then(r => r.json()),
            fetch('/data/oshi_holomen.json').then(r => r.json())
        ]);
        MASTER_CARDS = [...res[0], ...res[1], ...res[2]];
        AYLE_MASTER = res[2];
        OSHI_LIST = res[3];
    } catch (e) { console.error("Data Load Error", e); }
}

async function joinRoom(role) {
    const rid = document.getElementById('roomIdInput').value.trim();
    if (!rid) return alert("IDを入力してください");
    socket.roomId = rid; myRole = role; 
    socket.emit('joinRoom', { roomId: rid, role });
    if (role === 'player') showPage('setup-modal');
    else { showPage(''); document.body.classList.add('spectator-mode'); }
}

function setupDeckClick(id, type) {
    const el = document.getElementById(id); if (!el) return;
    let timer = null;
    el.onpointerdown = (e) => {
        timer = setTimeout(() => { if (myRole === 'player') socket.emit('inspectDeck', type); timer = null; }, 500);
    };
    el.onpointerup = () => { if (timer) { clearTimeout(timer); if(myRole === 'player') socket.emit(type === 'main' ? 'drawMainCard' : 'drawCheerCard'); } };
}

document.getElementById('joinPlayerBtn').onclick = () => joinRoom('player');
document.getElementById('joinSpectatorBtn').onclick = () => joinRoom('spectator');
document.getElementById('startGameBtn').onclick = () => {
    socket.emit('setGame', { main: mainDeckList, cheer: cheerDeckList, oshi: selectedOshi });
    showPage(''); 
};
document.getElementById('searchInput').oninput = (e) => updateLibrary(e.target.value);
