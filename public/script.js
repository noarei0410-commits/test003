const socket = io();

const field = document.getElementById('field');
const handDiv = document.getElementById('hand');
const drawBtn = document.getElementById('drawBtn');
const deckCountSpan = document.getElementById('deckCount');

let isDragging = false;
let currentCard = null;
let offset = { x: 0, y: 0 };

// サーバーから初期化情報を受信
socket.on('init', (data) => {
    document.getElementById('status').innerText = `ID: ${socket.id}`;
});

// 山札の枚数更新
socket.on('deckCount', (count) => {
    deckCountSpan.innerText = count;
});

// カードを引くボタン
drawBtn.addEventListener('click', () => {
    socket.emit('drawCard');
});

// サーバーからカード情報（新しいカード1枚）を受信
socket.on('receiveCard', (cardData) => {
    createCardElement(cardData);
});

// カード要素を作成する共通関数
function createCardElement(cardData) {
    const el = document.createElement('div');
    el.classList.add('card', 'face-up');
    el.id = cardData.id; // サーバー側で生成した一意のID
    el.innerText = cardData.number;

    // クリックで裏返し
    el.addEventListener('dblclick', (e) => {
        el.classList.toggle('face-up');
        el.classList.toggle('face-down');
        e.stopPropagation();
    });

    // ドラッグ開始
    el.addEventListener('mousedown', (e) => {
        isDragging = true;
        currentCard = el;
        
        // カードをフィールド（最前面）へ移動
        if (el.parentElement === handDiv) {
            field.appendChild(el);
        }
        
        const rect = el.getBoundingClientRect();
        offset.x = e.clientX - rect.left;
        offset.y = e.clientY - rect.top;
        
        el.style.position = 'absolute';
        updatePosition(e.clientX, e.clientY);
    });

    handDiv.appendChild(el);
}

// マウス移動時
document.addEventListener('mousemove', (e) => {
    if (!isDragging || !currentCard) return;
    updatePosition(e.clientX, e.clientY);
});

// マウスを離した時
document.addEventListener('mouseup', () => {
    if (isDragging && currentCard) {
        // サーバーに位置を報告（同期用）
        socket.emit('moveCard', {
            id: currentCard.id,
            x: currentCard.style.left,
            y: currentCard.style.top
        });
    }
    isDragging = false;
    currentCard = null;
});

function updatePosition(mouseX, mouseY) {
    const x = mouseX - offset.x;
    const y = mouseY - offset.y;
    currentCard.style.left = x + 'px';
    currentCard.style.top = y + 'px';
}

// 他のプレイヤーがカードを動かした時
socket.on('cardMoved', (data) => {
    const card = document.getElementById(data.id);
    if (card) {
        card.style.position = 'absolute';
        card.style.left = data.x;
        card.style.top = data.y;
        if (card.parentElement !== field) {
            field.appendChild(card);
        }
    }
});
