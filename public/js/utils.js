/**
 * Utility functions for hOCG Simulator
 */

/**
 * Arts cost check function
 * @param {Array} cost - Array of required colors e.g. ["白", "any"]
 * @param {Array} stackCards - Array of stacked cards (including the Holomen itself + attached cards)
 * @returns {boolean} true if satisfied
 */
function checkCostSatisfied(cost, stackCards) {
    if (!cost || cost.length === 0) return true;

    // Count energies from Ayle cards in stack
    const energies = {};
    stackCards.forEach(c => {
        if (c.type === 'ayle') {
            // Assume first char represents color (e.g. '白' form '白エール')
            const colorKey = c.name.charAt(0);
            energies[colorKey] = (energies[colorKey] || 0) + 1;
        }
    });

    console.log("[CheckCost] Cost:", cost, "Energies:", energies);

    // Create a copy to process
    // We must process specific color requirements FIRST, then 'any'
    const required = [...cost];
    // Sort so that non-'any' comes first
    required.sort((a, b) => {
        if (a === 'any' && b !== 'any') return 1;
        if (a !== 'any' && b === 'any') return -1;
        return 0;
    });

    for (let req of required) {
        if (req === 'any') {
            // Satisfy with ANY available energy
            const anyColor = Object.keys(energies).find(k => energies[k] > 0);
            if (anyColor) {
                energies[anyColor]--;
            } else {
                return false;
            }
        } else {
            // Satisfy with SPECIFIC energy
            if (energies[req] && energies[req] > 0) {
                energies[req]--;
            } else {
                return false;
            }
        }
    }

    return true;
}
