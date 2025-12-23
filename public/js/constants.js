const STAGE_ZONES = ['collab', 'center', 'back1', 'back2', 'back3', 'back4', 'back5'];
const COLORS = { '白': 'white', '緑': 'green', '赤': 'red', '青': 'blue', '黄': 'yellow', '紫': 'purple' };

// グローバル状態
let MASTER_CARDS = [], OSHI_LIST = [], AYLE_MASTER = [];
let mainDeckList = [], cheerDeckList = [], selectedOshi = null;
let myRole = 'spectator';
let currentDragEl = null, isDragging = false;
let startX = 0, startY = 0, offsetX = 0, offsetY = 0, maxZIndex = 1000;
