/**
 * Wikelo's Emporium — Main Application
 * Loads data from JSON, renders the browseable interface,
 * and provides an inventory planner / shopping cart feature.
 */

let DATA = null;
let currentFilter = 'all';
let currentSection = 'items';

// Inventory state
let playerInventory = {};   // { "Carinite": 100, "Wikelo Favor": 5, ... }
let selectedMissions = {};  // { "item_001": true, "ship_012": true, ... }
let invFilterMode = 'all';  // 'all', 'completable', 'partial'
let allMaterialNames = [];  // Sorted unique list of all materials across all recipes

// ============================================================
// DATA LOADING
// ============================================================
async function loadData() {
    try {
        const resp = await fetch('data/wikelo_data.json');
        DATA = await resp.json();
        init();
    } catch (err) {
        console.error('Failed to load data:', err);
        document.querySelector('.main-content').innerHTML =
            '<div class="no-results">Failed to load data. Make sure wikelo_data.json exists in the data/ folder.</div>';
    }
}

function init() {
    const patches = [...new Set(DATA.items.map(i => i.patch).filter(Boolean))];
    const latestPatch = patches.sort().pop() || '4.5';
    document.getElementById('currentPatch').textContent = `Patch ${latestPatch}`;

    // Build master material list from all recipes
    buildMaterialList();

    renderItems();
    renderShips();
    renderCurrency();
    renderReputation();
    renderMaterialInputs();
    renderMissionMatches();

    setupNav();
    setupFilters();
    setupSearch();
}

// ============================================================
// NAVIGATION
// ============================================================
function setupNav() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            switchSection(link.dataset.section);
        });
    });
}

function switchSection(section) {
    currentSection = section;
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelector(`.nav-link[data-section="${section}"]`).classList.add('active');
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.getElementById(section).classList.add('active');
}

// ============================================================
// FILTERS & SEARCH
// ============================================================
function setupFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentFilter = btn.dataset.filter;
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderItems();
        });
    });
}

function setupSearch() {
    document.getElementById('itemSearch').addEventListener('input', () => renderItems());
    document.getElementById('shipSearch').addEventListener('input', () => renderShips());
}

// ============================================================
// PARSE RECIPE STRING
// ============================================================
function parseRecipe(recipeStr) {
    if (!recipeStr) return [];
    return recipeStr.split(';').map(part => {
        part = part.trim();
        const match = part.match(/^(\d+)x\s+(.+)$/);
        if (match) return { qty: parseInt(match[1]), name: match[2] };
        // Items with no quantity (like "1x Parallax Energy Assault Rifle" or just an item name)
        if (part) return { qty: 1, name: part };
        return null;
    }).filter(r => r && r.name);
}

// ============================================================
// RENDER ITEMS
// ============================================================
function renderItems() {
    const grid = document.getElementById('itemsGrid');
    const searchTerm = document.getElementById('itemSearch').value.toLowerCase();

    let items = DATA.items;
    if (currentFilter !== 'all') items = items.filter(i => i.category === currentFilter);
    if (searchTerm) {
        items = items.filter(i =>
            i.name.toLowerCase().includes(searchTerm) ||
            i.recipe.toLowerCase().includes(searchTerm) ||
            i.mission_name.toLowerCase().includes(searchTerm) ||
            (i.reward && i.reward.toLowerCase().includes(searchTerm))
        );
    }

    if (items.length === 0) {
        grid.innerHTML = '<div class="no-results">No items match your search.</div>';
        return;
    }

    grid.innerHTML = items.map(item => {
        const recipe = parseRecipe(item.recipe);
        const isRetired = item.name.toLowerCase().includes('retired');
        const sources = item.sources ? item.sources.split(';').map(s => s.trim()).filter(Boolean) : [];
        const links = item.further_reading || [];
        const hasDetails = sources.length > 0 || item.notes || links.length > 0;

        return `
        <div class="item-card" onclick="this.classList.toggle('expanded')">
            <div class="item-card-header">
                <div class="item-name">${escHtml(item.name)}</div>
                <div class="item-badges">
                    <span class="badge badge-${item.category}">${item.category}</span>
                    ${item.patch ? `<span class="badge badge-patch">${item.patch}</span>` : ''}
                    ${isRetired ? '<span class="badge badge-retired">retired</span>' : ''}
                </div>
            </div>
            ${item.mission_name ? `<div class="item-mission">Mission: "${escHtml(item.mission_name)}"</div>` : ''}
            <div class="item-card-body">
                ${recipe.length > 0 ? `
                    <div class="recipe-label">Recipe / Cost</div>
                    <div class="recipe-list">
                        ${recipe.map(r => `<span class="recipe-item">${r.qty ? `<span class="qty">${r.qty}x</span> ` : ''}${escHtml(r.name)}</span>`).join('')}
                    </div>
                ` : ''}
                ${item.reward ? `<div class="reward-line"><span>Reward: </span>${escHtml(item.reward)}</div>` : ''}
            </div>
            ${hasDetails ? '<div class="card-expand-hint">▾ Click for details</div>' : ''}
            <div class="item-details">
                ${item.image_url ? `<div class="detail-block"><img src="${escHtml(item.image_url)}" class="item-image" alt="${escHtml(item.name)}"></div>` : ''}
                ${sources.length > 0 ? `
                    <div class="detail-block">
                        <div class="detail-label">Where to Find Materials</div>
                        <div class="detail-text">${sources.map(s => escHtml(s)).join('<br>')}</div>
                    </div>
                ` : ''}
                ${item.notes ? `
                    <div class="detail-block">
                        <div class="detail-label">Notes</div>
                        <div class="detail-text">${escHtml(item.notes)}</div>
                    </div>
                ` : ''}
                ${links.length > 0 ? `
                    <div class="detail-block">
                        <div class="detail-label">Further Reading</div>
                        <div class="detail-text">${links.map(l => `<a href="${escHtml(l.url)}" target="_blank">${escHtml(l.title)}</a>`).join('<br>')}</div>
                    </div>
                ` : ''}
            </div>
        </div>`;
    }).join('');
}

// ============================================================
// RENDER SHIPS
// ============================================================
function renderShips() {
    const grid = document.getElementById('shipsGrid');
    const searchTerm = document.getElementById('shipSearch').value.toLowerCase();

    let ships = DATA.ships;
    if (searchTerm) {
        ships = ships.filter(s =>
            s.name.toLowerCase().includes(searchTerm) ||
            s.recipe.toLowerCase().includes(searchTerm) ||
            s.mission_name.toLowerCase().includes(searchTerm) ||
            s.components_summary.toLowerCase().includes(searchTerm)
        );
    }

    if (ships.length === 0) {
        grid.innerHTML = '<div class="no-results">No ships match your search.</div>';
        return;
    }

    grid.innerHTML = ships.map(ship => {
        const recipe = parseRecipe(ship.recipe);
        const comps = ship.components || [];
        const hasDetails = ship.other_components || ship.image_credit;

        return `
        <div class="ship-card" onclick="this.classList.toggle('expanded')">
            <div class="ship-card-header">
                <div class="ship-name">${escHtml(ship.name)}</div>
                <div class="item-badges">
                    <span class="badge badge-ship">ship</span>
                    ${ship.patch ? `<span class="badge badge-patch">${ship.patch}</span>` : ''}
                </div>
            </div>
            ${ship.mission_name ? `<div class="item-mission">Mission: "${escHtml(ship.mission_name)}"</div>` : ''}
            <div class="ship-card-body">
                ${comps.length > 0 ? `
                    <table class="components-table">
                        <thead><tr><th>Type</th><th>Qty</th><th>Component</th><th>Size</th><th>Class</th><th>Grade</th></tr></thead>
                        <tbody>
                            ${comps.map(c => `<tr>
                                <td>${escHtml(c.type)}</td><td>${escHtml(c.quantity)}</td>
                                <td class="comp-name">${escHtml(c.name)}</td><td>${escHtml(c.size)}</td>
                                <td>${escHtml(c['class'])}</td><td class="comp-grade">${escHtml(c.grade)}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                ` : ''}
                ${recipe.length > 0 ? `
                    <div class="recipe-label">Trade Cost</div>
                    <div class="recipe-list">
                        ${recipe.map(r => `<span class="recipe-item">${r.qty ? `<span class="qty">${r.qty}x</span> ` : ''}${escHtml(r.name)}</span>`).join('')}
                    </div>
                ` : ''}
            </div>
            ${hasDetails ? '<div class="card-expand-hint">▾ Click for details</div>' : ''}
            <div class="ship-details">
                ${ship.other_components ? `<div class="detail-block"><div class="detail-label">Other Components</div><div class="detail-text">${escHtml(ship.other_components)}</div></div>` : ''}
                ${ship.image_credit ? `<div class="detail-block"><div class="detail-text" style="font-size:0.72rem; color: var(--text-dim);">Image: ${escHtml(ship.image_credit)}</div></div>` : ''}
            </div>
        </div>`;
    }).join('');
}

// ============================================================
// RENDER CURRENCY
// ============================================================
function renderCurrency() {
    const grid = document.getElementById('currencyGrid');
    grid.innerHTML = DATA.currency_exchanges.map(cx => {
        const inputs = cx.recipe.split(';').map(s => s.trim()).filter(Boolean);
        const outputs = cx.reward.split(';').map(s => s.trim()).filter(Boolean);
        const links = cx.further_reading || [];
        return `
        <div class="currency-card">
            <div class="exchange-visual">
                ${inputs.map((inp, i) => `${i > 0 ? '<span class="exchange-or">or</span>' : ''}<span class="exchange-input">${escHtml(inp)}</span>`).join('')}
                <span class="exchange-arrow">→</span>
                ${outputs.map(o => `<span class="exchange-output">${escHtml(o)}</span>`).join('')}
            </div>
            ${cx.description ? `<div class="currency-notes">${escHtml(cx.description)}</div>` : ''}
            ${cx.notes ? `<div class="currency-notes" style="margin-top:0.5rem; font-size:0.78rem;">${escHtml(cx.notes)}</div>` : ''}
            ${links.length > 0 ? `<div class="detail-block"><div class="detail-label">Further Reading</div><div class="detail-text">${links.map(l => `<a href="${escHtml(l.url)}" target="_blank">${escHtml(l.title)}</a>`).join('<br>')}</div></div>` : ''}
        </div>`;
    }).join('');

    const vh = DATA.very_hungry;
    if (vh && vh.rewards && vh.rewards.length > 0) {
        document.getElementById('hungrySection').innerHTML = `
            <div class="hungry-title">VERY HUNGRY / ARRIVE TO SYSTEM MISSIONS</div>
            ${vh.description ? `<div class="hungry-desc">${escHtml(vh.description)}</div>` : ''}
            <table class="hungry-table">
                <thead><tr><th>Gun Reward</th><th>Clothing Reward</th></tr></thead>
                <tbody>${vh.rewards.map(r => `<tr><td>${escHtml(r.gun)}</td><td>${escHtml(r.clothing)}</td></tr>`).join('')}</tbody>
            </table>
            ${vh.notes ? `<div class="currency-notes" style="margin-top:1rem; font-size:0.78rem;">${escHtml(vh.notes)}</div>` : ''}
        `;
    }
}

// ============================================================
// RENDER REPUTATION
// ============================================================
function renderReputation() {
    const rep = DATA.reputation;
    if (!rep || !rep.entries) return;

    document.getElementById('repInfo').innerHTML = `
        <p>${escHtml(rep.description || '')}</p>
        <p style="margin-top:0.5rem; font-size:0.82rem; color: var(--text-dim);">Patch ${escHtml(rep.patch || '')} — Updated ${escHtml(rep.date_updated || '')}</p>
    `;

    const sorted = [...rep.entries].sort((a, b) => b.reputation_reward - a.reputation_reward);
    document.getElementById('repTable').innerHTML = `
        <table class="rep-table">
            <thead><tr><th>Mission</th><th style="text-align:center">Rep Reward</th><th style="text-align:center">Rep Required</th></tr></thead>
            <tbody>${sorted.map(e => `
                <tr>
                    <td>${escHtml(e.mission_title)}</td>
                    <td class="rep-val">+${e.reputation_reward}</td>
                    <td class="rep-req ${e.reputation_required > 0 ? 'rep-locked' : ''}">${e.reputation_required > 0 ? e.reputation_required : '—'}</td>
                </tr>
            `).join('')}</tbody>
        </table>
    `;
}

// ============================================================
// INVENTORY PLANNER
// ============================================================

function buildMaterialList() {
    const materialSet = new Set();
    // Gather from items
    DATA.items.forEach(item => {
        parseRecipe(item.recipe).forEach(r => materialSet.add(r.name));
    });
    // Gather from ships
    DATA.ships.forEach(ship => {
        parseRecipe(ship.recipe).forEach(r => materialSet.add(r.name));
    });
    allMaterialNames = [...materialSet].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

function renderMaterialInputs() {
    const container = document.getElementById('materialsList');
    const search = document.getElementById('materialSearch').value.toLowerCase();

    let materials = allMaterialNames;
    if (search) {
        materials = materials.filter(m => m.toLowerCase().includes(search));
    }

    container.innerHTML = materials.map(mat => {
        const val = playerInventory[mat] || 0;
        const hasValue = val > 0;
        return `
        <div class="inv-material-row ${hasValue ? 'has-value' : ''}">
            <span class="inv-mat-name" title="${escHtml(mat)}">${escHtml(mat)}</span>
            <div class="inv-mat-controls">
                <button class="inv-qty-btn" onclick="adjustMaterial('${escJs(mat)}', -10)" ${!hasValue ? 'disabled' : ''}>-10</button>
                <button class="inv-qty-btn" onclick="adjustMaterial('${escJs(mat)}', -1)" ${!hasValue ? 'disabled' : ''}>-1</button>
                <input type="number" class="inv-qty-input" value="${val}" min="0"
                    onchange="setMaterial('${escJs(mat)}', parseInt(this.value)||0)"
                    onfocus="this.select()">
                <button class="inv-qty-btn" onclick="adjustMaterial('${escJs(mat)}', 1)">+1</button>
                <button class="inv-qty-btn" onclick="adjustMaterial('${escJs(mat)}', 10)">+10</button>
            </div>
        </div>`;
    }).join('');

    updateInvSummary();
}

function setMaterial(name, qty) {
    if (qty <= 0) {
        delete playerInventory[name];
    } else {
        playerInventory[name] = qty;
    }
    renderMaterialInputs();
    renderMissionMatches();
}

function adjustMaterial(name, delta) {
    const current = playerInventory[name] || 0;
    setMaterial(name, Math.max(0, current + delta));
}

function clearInventory() {
    playerInventory = {};
    selectedMissions = {};
    renderMaterialInputs();
    renderMissionMatches();
}

function updateInvSummary() {
    const el = document.getElementById('invSummary');
    const count = Object.keys(playerInventory).filter(k => playerInventory[k] > 0).length;
    const total = Object.values(playerInventory).reduce((a, b) => a + b, 0);
    if (count === 0) {
        el.innerHTML = '<span class="inv-summary-text">No materials entered yet</span>';
    } else {
        el.innerHTML = `<span class="inv-summary-text">${count} material types, ${total} total items</span>`;
    }
}

// Get all missions (items + ships) as unified list
function getAllMissions() {
    const missions = [];
    DATA.items.forEach(item => {
        const recipe = parseRecipe(item.recipe);
        if (recipe.length > 0) {
            missions.push({
                id: item.id,
                name: item.name,
                category: item.category,
                mission_name: item.mission_name,
                recipe: recipe,
                reward: item.reward,
                type: 'item',
            });
        }
    });
    DATA.ships.forEach(ship => {
        const recipe = parseRecipe(ship.recipe);
        if (recipe.length > 0) {
            missions.push({
                id: ship.id,
                name: ship.name,
                category: 'ship',
                mission_name: ship.mission_name,
                recipe: recipe,
                reward: ship.name,
                type: 'ship',
            });
        }
    });
    return missions;
}

// Calculate remaining inventory after deducting selected missions
function getRemainingInventory() {
    const remaining = { ...playerInventory };
    const missions = getAllMissions();

    missions.forEach(m => {
        if (!selectedMissions[m.id]) return;
        m.recipe.forEach(r => {
            if (remaining[r.name]) {
                remaining[r.name] = Math.max(0, remaining[r.name] - r.qty);
                if (remaining[r.name] === 0) delete remaining[r.name];
            }
        });
    });

    return remaining;
}

// Calculate completion % for a mission given available materials
function calcCompletion(recipe, available) {
    if (recipe.length === 0) return { percent: 0, details: [], timesCompletable: 0 };

    let minTimes = Infinity;
    const details = recipe.map(r => {
        const have = available[r.name] || 0;
        const need = r.qty;
        const ratio = need > 0 ? have / need : 0;
        const times = need > 0 ? Math.floor(have / need) : 0;
        minTimes = Math.min(minTimes, times);
        return {
            name: r.name,
            need: need,
            have: have,
            percent: Math.min(ratio * 100, 9999),
            enough: have >= need,
        };
    });

    const overallPercent = details.reduce((sum, d) => sum + Math.min(d.percent, 100), 0) / details.length;
    return {
        percent: overallPercent,
        details: details,
        timesCompletable: minTimes === Infinity ? 0 : minTimes,
    };
}

function setInvFilter(mode, btn) {
    invFilterMode = mode;
    document.querySelectorAll('.inv-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderMissionMatches();
}

function toggleMissionSelection(missionId, event) {
    event.stopPropagation();
    if (selectedMissions[missionId]) {
        delete selectedMissions[missionId];
    } else {
        selectedMissions[missionId] = true;
    }
    renderMissionMatches();
    // Also refresh material display to show "remaining" context
    updateInvSummary();
}

function renderMissionMatches() {
    const container = document.getElementById('missionsList');
    const remaining = getRemainingInventory();
    const hasAnyMaterials = Object.keys(playerInventory).some(k => playerInventory[k] > 0);

    if (!hasAnyMaterials) {
        container.innerHTML = '<div class="inv-empty-msg">Enter materials on the left to see matching missions here.</div>';
        return;
    }

    const missions = getAllMissions();

    // Calculate completion for each mission
    let results = missions.map(m => {
        const isSelected = !!selectedMissions[m.id];
        // For selected missions, show completion against full inventory
        // For non-selected, show completion against remaining (after selected are deducted)
        const available = isSelected ? playerInventory : remaining;
        const completion = calcCompletion(m.recipe, available);

        return { ...m, completion, isSelected };
    });

    // Only show missions where at least one ingredient matches something in inventory
    results = results.filter(r => {
        return r.completion.details.some(d => d.have > 0) || r.isSelected;
    });

    // Apply filter
    if (invFilterMode === 'completable') {
        results = results.filter(r => r.completion.percent >= 100);
    } else if (invFilterMode === 'partial') {
        results = results.filter(r => r.completion.percent > 0 && r.completion.percent < 100);
    }

    // Sort: selected first, then by completion % descending
    results.sort((a, b) => {
        if (a.isSelected !== b.isSelected) return a.isSelected ? -1 : 1;
        return b.completion.percent - a.completion.percent;
    });

    if (results.length === 0) {
        container.innerHTML = '<div class="inv-empty-msg">No matching missions for your current materials and filter.</div>';
        return;
    }

    container.innerHTML = results.map(r => {
        const pct = r.completion.percent;
        const times = r.completion.timesCompletable;
        const isComplete = pct >= 100;

        let pctDisplay = Math.round(pct) + '%';
        if (times > 1) pctDisplay = times + 'x (' + Math.round(pct) + '%)';

        const pctColor = isComplete ? 'var(--accent-green)' : pct >= 50 ? 'var(--accent-gold)' : 'var(--accent-red)';
        const barWidth = Math.min(pct, 100);

        return `
        <div class="inv-mission-card ${r.isSelected ? 'selected' : ''} ${isComplete ? 'completable' : ''}"
             onclick="toggleMissionSelection('${r.id}', event)">
            <div class="inv-mission-header">
                <div class="inv-mission-info">
                    <span class="inv-mission-name">${escHtml(r.name)}</span>
                    <span class="badge badge-${r.category}">${r.category}</span>
                    ${r.isSelected ? '<span class="inv-selected-tag">SELECTED</span>' : ''}
                </div>
                <div class="inv-mission-pct" style="color:${pctColor}">${pctDisplay}</div>
            </div>
            <div class="inv-progress-bar"><div class="inv-progress-fill" style="width:${barWidth}%; background:${pctColor}"></div></div>
            <div class="inv-mission-recipe">
                ${r.completion.details.map(d => {
                    const dColor = d.enough ? 'var(--accent-green)' : d.have > 0 ? 'var(--accent-gold)' : 'var(--text-dim)';
                    return `<span class="inv-recipe-chip" style="border-color:${dColor}">
                        <span style="color:${dColor}">${d.have}/${d.need}</span> ${escHtml(d.name)}
                    </span>`;
                }).join('')}
            </div>
            ${r.mission_name ? `<div class="inv-mission-sub">Mission: "${escHtml(r.mission_name)}"</div>` : ''}
            ${r.isSelected ? '<div class="inv-deselect-hint">Click to deselect — materials will be returned</div>' : ''}
            ${isComplete && !r.isSelected ? '<div class="inv-select-hint">Click to reserve materials for this mission</div>' : ''}
        </div>`;
    }).join('');
}

// ============================================================
// UTILS
// ============================================================
function escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function escJs(str) {
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// ============================================================
// START
// ============================================================
document.addEventListener('DOMContentLoaded', loadData);
