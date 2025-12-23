const socket = io();

// ゾーン定義
const STAGE_ZONES = ['collab', 'center', 'oshi', 'back1', 'back2', 'back3', 'back4', 'back5'];
const COLORS = { '白': 'white', '緑': 'green', '赤': 'red', '青': 'blue', '黄': 'yellow', '紫': 'purple' };

// グローバル状態
let MASTER_CARDS = [], OSHI_LIST = [], AYLE_MASTER = [];
let mainDeckList = [], cheerDeckList = [], selectedOshi = null;
let myRole = 'spectator';
let currentDragEl = null, isDragging = false, dragStarted = false;
let currentStack = []; // 一括移動用のグループ保持
let startX = 0, startY = 0, offsetX = 0, offsetY = 0, maxZIndex = 1000;
let potentialZoomTarget = null;

// HTML要素参照
const field = document.getElementById('field');
const handDiv = document.getElementById('hand');
const setupModal = document.getElementById('setup-modal');
const zoomModal = document.getElementById('zoom-modal');
const deckModal = document.getElementById('deck-inspection-modal');
const deckGrid = document.getElementById('deck-card-grid');
