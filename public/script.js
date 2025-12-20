const socket = io();

const field = document.getElementById('field');
const handDiv = document.getElementById('hand');
const drawBtn = document.getElementById('drawBtn');
const deckCountSpan = document.getElementById('deckCount');

let isDragging = false;
let currentCard = null;
// マウスとカードの左上角の距離を保持する変数
let offsetX = 0;
let offsetY = 0;

socket.on('init', (data) => {
    document.getElementById('status').innerText = `ID: ${socket.id}`;
});

socket.on('deckCount', (count) => {
    deckCountSpan.innerText = count;
});

drawBtn.addEventListener('click', () => {
    socket.emit('drawCard');
});

socket.on('receiveCard', (cardData) => {
    createCardElement(cardData);
});

function createCardElement(cardData) {
    const el = document.createElement('div');
    el.classList.add('card', 'face-up');
    el.id = cardData.id;
    el.innerText = cardData.number;

    // ダブルクリックで裏返し
    el.addEventListener('dblclick', (e) => {
        el.classList.toggle('face-up');
        el.classList.toggle('face-down');
        e.stopPropagation();
    });

    // マウスを押した瞬間の処理
    el.addEventListener('mousedown', (e) => {
        isDragging = true;
        currentCard = el;

        // 現在のカードの表示位置を取得
        const rect = el.getBoundingClientRect();
        
        // 【重要】マウスがカードのどの位置（何ピクセル目）をクリックしたかを計算
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;

        // 手札からフィールドへ移動させる（親子関係の変更）
        if (el.parentElement !== field) {
            // 現在の見た目の位置を維持したまま移動
            el.style.left = (e.clientX - offsetX) + 'px';
            el.style.top = (e.clientY - offsetY) + 'px';
            el.style.position = 'absolute';
            field.appendChild(el);
        }

        el.style.zIndex = 1000; // 掴んでいるカードを一番上に
    });

    handDiv.appendChild(el);
}

// マウス移動中の処理
document.addEventListener('mousemove', (e) => {
    if (!isDragging || !currentCard) return;

    // 【重要】マウスの位置からオフセットを引くことで、クリックした場所を固定する
    const x = e.clientX - offsetX;
    const y = e.clientY - offsetY;

    currentCard.style.left = x + 'px';
    currentCard.style.top = y + 'px';
});

// マウスを離した時の処理
document.addEventListener('mouseup', () => {
    if (isDragging && currentCard) {
        currentCard.style.zIndex = ''; // 重なり順を戻す
        
        // サーバーに位置を同期
        socket.emit('moveCard', {
            id: currentCard.id,
            x: currentCard.style.left,
            y: currentCard.style.top
        });
    }
    isDragging = false;
    currentCard = null;
});

// 他の人の動きを同期
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
