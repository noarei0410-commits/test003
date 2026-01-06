/**
 * Arts Activation Manager
 * Handles visual feedback and logic for Arts activation
 */

/**
 * Display Arts activation feedback
 * @param {string} cardId - ID of the card using the art
 * @param {string} artName - Name of the art being activated
 * @param {number} damage - Damage value (if applicable)
 * @param {string} effectText - Effect description
 */
function showArtsActivation(cardId, artName, damage, effectText) {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'arts-activation-overlay';
    overlay.innerHTML = `
        <div class="arts-activation-card">
            <div class="arts-activation-header">
                <span class="arts-label">ARTS</span>
                <span class="arts-name">${artName}</span>
            </div>
            ${damage ? `
                <div class="arts-damage-display">
                    <span class="damage-value">${damage}</span>
                    <span class="damage-label">DAMAGE</span>
                </div>
            ` : ''}
            ${effectText && effectText !== 'なし' ? `
                <div class="arts-effect-text">${effectText}</div>
            ` : ''}
            <div class="arts-activation-footer">
                <button class="btn-arts-confirm" onclick="closeArtsActivation()">確認</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Animate in
    setTimeout(() => {
        overlay.classList.add('active');
    }, 10);
}

/**
 * Close arts activation overlay
 */
window.closeArtsActivation = function () {
    const overlay = document.querySelector('.arts-activation-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        setTimeout(() => {
            overlay.remove();
        }, 300);
    }
};

/**
 * Activate an art
 * @param {string} cardId - Card ID
 * @param {string} artName - Art name
 * @param {Object} cardData - Card data object (optional, for direct access)
 * @param {Object} skill - Skill data object (optional, for direct access)
 */
window.activateArt = function (cardId, artName, cardData = null, skill = null) {
    console.log(`[Arts] Activating: ${artName} from ${cardId}`);

    // If cardData and skill are not provided, try to find them
    if (!cardData || !skill) {
        const cardElement = document.getElementById(cardId);
        if (!cardElement || !cardElement.cardData) {
            console.error('[Arts] Card not found:', cardId);
            return;
        }

        cardData = cardElement.cardData;
        skill = cardData.skills?.find(s => s.name === artName);

        if (!skill) {
            console.error('[Arts] Skill not found:', artName);
            return;
        }
    }

    // Show activation feedback
    showArtsActivation(
        cardId,
        artName,
        skill.damage || 0,
        skill.text || ''
    );

    // TODO: Send to server for game state update
    // socket.emit('activateArt', { cardId, artName, damage: skill.damage });

    // Close zoom modal after a delay
    setTimeout(() => {
        const zoomModal = document.getElementById('zoom-modal');
        if (zoomModal) {
            zoomModal.style.display = 'none';
        }
    }, 100);
};
