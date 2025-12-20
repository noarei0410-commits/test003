const socket = io();

const handDiv = document.getElementById('hand');
const drawBtn = document.getElementById('drawBtn');
const deckCountSpan = document.getElementById('deckCount');

socket.on('init', (data) => {
    document.getElementById('status').innerText = `Your ID: ${data.id}`;
});

// public/script.js (updateHandの部分のみ)

socket.on('updateHand', (hand) => {
    console.log("手札を更新します:", hand); // デバッグ用
    handDiv.innerHTML = '';
    
    hand.forEach(cardNum => {
        const el = document.createElement('div');
        el.classList.add('card', 'face-up'); // 最初は表面
        el.innerText = cardNum;
        
        // クリックイベント
        el.addEventListener('click', () => {
            console.log("カードがクリックされました:", cardNum); // ログ
            
            // クラスを入れ替える（toggleを使うと1行で書けます）
            el.classList.toggle('face-up');
            el.classList.toggle('face-down');
            
            console.log("現在のクラス:", el.className); // 状態を確認
        });

        handDiv.appendChild(el);
    });
});

socket.on('deckCount', (count) => {
    deckCountSpan.innerText = count;
});

drawBtn.addEventListener('click', () => {
    socket.emit('drawCard');

});
