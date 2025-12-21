const socket = io();

let MASTER_CARDS = [], OSHI_LIST = [], AYLE_MASTER = [];
let mainDeckList = [], cheerDeckList = [], selectedOshi = null;
let myRole = 'spectator';

const roomModal = document.getElementById('room-modal');
const setupModal = document.getElementById('setup-modal');
const field = document.getElementById('field');
const handDiv = document.getElementById('hand');

// --- ルーム入室処理 ---
document.getElementById('joinPlayerBtn').onclick = () => joinRoom('player');
document.getElementById('joinSpectatorBtn').onclick = () => joinRoom('spectator');

function joinRoom(role) {
    const roomId = document.getElementById('roomIdInput').value;
    if (!roomId) return alert("ルームIDを入力してください");

    myRole = role;
    socket.emit('joinRoom', { roomId, role });
    roomModal.style.display = 'none';

    if (role === 'player') {
        setupModal.style.display = 'flex'; // 対戦者はデッキ構築へ
    } else {
        document.body.classList.add('spectator-mode'); // 観戦者は操作禁止
    }
}

// --- 以下、以前のスクリプトをルーム対応に統合 ---

// データ読み込み
async function loadCardData() {
    try {
        const [h, s, a, o] = await Promise.all([
            fetch('/data/holomen.json'), fetch('/data/support.json'),
            fetch('/data/ayle.json'), fetch('/data/oshi_holomen.json')
        ]);
        MASTER_CARDS = [...await h.json(), ...await s.json()];
        AYLE_MASTER = await a.json(); OSHI_LIST = await o.json();
        MASTER_CARDS = [...MASTER_CARDS, ...OSHI_LIST];
        updateLibrary(); renderDecks();
    } catch (e) { console.error("Data error", e); }
}
loadCardData();

// 構築UI・デッキ構築ロジックは以前のまま維持...
// (文字数の都合上、変更点のみ記述)

function createCardElement(data) {
    const el = document.createElement('div'); el.id = data.id; el.innerText = data.name; 
    el.className = `card face-up type-${data.type}`;
    // 観戦者でも操作できないようにする（CSSのpointer-eventsでも制御）
    if (data.type === 'ayle') {
        const colors = { '白': 'white', '緑': 'green', '赤': 'red', '青': 'blue', '黄': 'yellow', '紫': 'purple' };
        for (let k in colors) if (data.name.includes(k)) el.classList.add(`ayle-${colors[k]}`);
    }
    setupCardEvents(el); return el;
}

// カードの操作イベント内で観戦者チェック
function setupCardEvents(el) {
    el.addEventListener('dblclick', (e) => {
        if (myRole === 'spectator') return; // 観戦者は不可
        if (el.parentElement === handDiv || ['back', 'center', 'collab'].includes(getZoneUnderCard(el))) return;
        el.classList.toggle('face-up'); el.classList.toggle('face-down');
        socket.emit('flipCard', { id: el.id, isFaceUp: el.classList.contains('face-up') });
    });

    el.addEventListener('pointerdown', (e) => {
        if (myRole === 'spectator') return; // 観戦者は不可
        // (ドラッグロジック続く...)
    });
}

// ゲーム開始ボタンの送信先を修正
document.getElementById('startGameBtn').onclick = () => {
    const oz = document.getElementById('oshi').getBoundingClientRect(), fr = field.getBoundingClientRect();
    const pos = { x: (oz.left - fr.left) + (oz.width - 60) / 2 + 'px', y: (oz.top - fr.top) + (oz.height - 85) / 2 + 'px' };
    socket.emit('setGame', { main: mainDeckList, cheer: cheerDeckList, oshi: { name: selectedOshi.name, pos } });
    setupModal.style.display = "none";
};

// ... (以下、ドラッグ＆ドロップ、同期、スナップ処理などは以前のものをそのまま使用)
