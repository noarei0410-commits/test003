const socket = io();

const handDiv = document.getElementById('hand');
const drawBtn = document.getElementById('drawBtn');
const deckCountSpan = document.getElementById('deckCount');

socket.on('init', (data) => {
    document.getElementById('status').innerText = `Your ID: ${data.id}`;
});

socket.on('updateHand', (hand) => {
    handDiv.innerHTML = '';
    hand.forEach(card => {
        const el = document.createElement('div');
        el.className = 'card';
        el.innerText = `Card ${card}`;
        handDiv.appendChild(el);
    });
});

socket.on('deckCount', (count) => {
    deckCountSpan.innerText = count;
});

drawBtn.addEventListener('click', () => {
    socket.emit('drawCard');
});