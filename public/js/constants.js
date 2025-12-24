const socket = io();
const STAGE_ZONES = ['collab', 'center', 'oshi', 'back1', 'back2', 'back3', 'back4', 'back5'];
const COLORS = { '白': 'white', '緑': 'green', '赤': 'red', '青': 'blue', '黄': 'yellow', '紫': 'purple' };

let MASTER_CARDS = [], OSHI_LIST = [], AYLE_MASTER = [];
let mainDeckList = [], cheerDeckList = [], selectedOshi = null;
let myRole = 'spectator';
let currentDragEl = null, isDragging = false, dragStarted = false;
let currentStack = []; 
let startX = 0, startY = 0, offsetX = 0, offsetY = 0, maxZIndex = 1000;
let potentialZoomTarget = null;

const field = document.getElementById('field');
const handDiv = document.getElementById('hand');
const setupModal = document.getElementById('setup-modal');
const zoomModal = document.getElementById('zoom-modal');
const deckModal = document.getElementById('deck-inspection-modal');
const deckGrid = document.getElementById('deck-card-grid');
