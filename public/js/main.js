window.onload = async () => {
    await loadCardData();
    setupDeckClick('main-deck-zone', 'main');
    setupDeckClick('cheer-deck-zone', 'cheer');
    window.onresize = repositionCards;
};

async function loadCardData() {
    const res = await Promise.all([
        fetch('/data/holomen.json').then(r => r.json()),
        fetch('/data/support.json').then(r => r.json()),
        fetch('/data/ayle.json').then(r => r.json()),
        fetch('/data/oshi_holomen.json').then(r => r.json())
    ]);
    MASTER_CARDS = [...res[0], ...res[1], ...res[2]];
    AYLE_MASTER = res[2];
    OSHI_LIST = res[3];
}

async function joinRoom(role) {
    const rid = document.getElementById('roomIdInput').value;
    if (!rid) return alert("Room ID!");
    myRole = role;
    socket.emit('joinRoom', { roomId: rid, role });
    if (role === 'player') showPage('setup-modal');
    else showPage('');
}

document.getElementById('startGameBtn').onclick = () => {
    socket.emit('setGame', { main: mainDeckList, cheer: cheerDeckList, oshi: selectedOshi });
    showPage(''); 
};
