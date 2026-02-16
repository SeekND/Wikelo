/**
 * Wikelo's Emporium — Main Application v3
 * 
 * INVENTORY LOGIC:
 * - Start with full player inventory as the "pool"
 * - Selected missions are processed in selection order, each deducting from the pool
 * - After all selections, unselected missions see whatever remains in the pool
 * - Colour coding: green = have enough, yellow = have some, grey = have none, red = was available but got taken by a selection
 */

let DATA = null;
let currentFilter = 'all';
let currentShipFilter = 'all';
let currentSection = 'welcome';

// Inventory state — persisted to localStorage
let playerInventory = {};
let selectedMissionOrder = [];  // Array of IDs in selection order
let invFilterMode = 'all';
let allMaterialNames = [];

const STORAGE_KEY_INV = 'wikelo_inventory';
const STORAGE_KEY_SEL = 'wikelo_selected_order';

// ============================================================
// DATA LOADING
// ============================================================
async function loadData() {
    try {
        const resp = await fetch('data/wikelo_data.json');
        DATA = await resp.json();
        loadInventoryFromStorage();
        init();
    } catch (err) {
        console.error('Failed to load data:', err);
        document.querySelector('.main-content').innerHTML =
            '<div class="no-results">Failed to load data. Make sure wikelo_data.json exists in the data/ folder.</div>';
    }
}

function init() {
    const patches = [...new Set([
        ...DATA.items.map(i => i.patch),
        ...DATA.ships.map(s => s.patch)
    ].filter(Boolean))];
    const latestPatch = patches.sort().pop() || '4.5';
    document.getElementById('currentPatch').textContent = `Patch ${latestPatch}`;

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
// LOCALSTORAGE
// ============================================================
function saveToStorage() {
    try {
        localStorage.setItem(STORAGE_KEY_INV, JSON.stringify(playerInventory));
        localStorage.setItem(STORAGE_KEY_SEL, JSON.stringify(selectedMissionOrder));
    } catch (e) {}
}

function loadInventoryFromStorage() {
    try {
        const inv = localStorage.getItem(STORAGE_KEY_INV);
        const sel = localStorage.getItem(STORAGE_KEY_SEL);
        if (inv) playerInventory = JSON.parse(inv);
        if (sel) selectedMissionOrder = JSON.parse(sel);
    } catch (e) {}
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
    const activeLink = document.querySelector(`.nav-link[data-section="${section}"]`);
    if (activeLink) activeLink.classList.add('active');
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.getElementById(section).classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================
// FILTERS & SEARCH
// ============================================================
function setupFilters() {
    document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
            currentFilter = btn.dataset.filter;
            document.querySelectorAll('.filter-btn[data-filter]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderItems();
        });
    });
    document.querySelectorAll('.filter-btn[data-shipfilter]').forEach(btn => {
        btn.addEventListener('click', () => {
            currentShipFilter = btn.dataset.shipfilter;
            document.querySelectorAll('.filter-btn[data-shipfilter]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderShips();
        });
    });
}

function setupSearch() {
    document.getElementById('itemSearch').addEventListener('input', () => renderItems());
    document.getElementById('shipSearch').addEventListener('input', () => renderShips());
}

// ============================================================
// PARSE RECIPE
// ============================================================
function parseRecipe(recipeStr) {
    if (!recipeStr) return [];
    return recipeStr.split(';').map(part => {
        part = part.trim();
        const match = part.match(/^(\d+)x\s+(.+)$/);
        if (match) return { qty: parseInt(match[1]), name: match[2] };
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
    if (items.length === 0) { grid.innerHTML = '<div class="no-results">No items match your search.</div>'; return; }
    grid.innerHTML = items.map(item => renderItemCard(item)).join('');
}

function renderItemCard(item) {
    const recipe = parseRecipe(item.recipe);
    const isRetired = item.name.toLowerCase().includes('retired');
    const sources = item.sources ? item.sources.split(';').map(s => s.trim()).filter(Boolean) : [];
    const links = item.further_reading || [];
    const hasDetails = sources.length > 0 || item.notes || links.length > 0 || item.image_url;
    return `
    <div class="item-card" onclick="this.classList.toggle('expanded')">
        <div class="item-card-header">
            <div class="item-name">${esc(item.name)}</div>
            <div class="item-badges">
                <span class="badge badge-${item.category}">${item.category}</span>
                ${item.patch ? `<span class="badge badge-patch">${item.patch}</span>` : ''}
                ${isRetired ? '<span class="badge badge-retired">retired</span>' : ''}
            </div>
        </div>
        ${item.mission_name ? `<div class="item-mission">Mission: "${esc(item.mission_name)}"</div>` : ''}
        <div class="item-card-body">
            ${recipe.length > 0 ? `
                <div class="recipe-label">Recipe / Cost</div>
                <div class="recipe-list">${recipe.map(r => `<span class="recipe-item">${r.qty ? `<span class="qty">${r.qty}x</span> ` : ''}${esc(r.name)}</span>`).join('')}</div>
            ` : ''}
            ${item.reward ? `<div class="reward-line"><span>Reward: </span>${esc(item.reward)}</div>` : ''}
        </div>
        ${hasDetails ? '<div class="card-expand-hint">▾ Click for details</div>' : ''}
        <div class="item-details">
            ${item.image_url ? `<div class="detail-block"><img src="${esc(item.image_url)}" class="item-image" alt="${esc(item.name)}"></div>` : ''}
            ${sources.length > 0 ? `<div class="detail-block"><div class="detail-label">Where to Find Materials</div><div class="detail-text">${sources.map(s => esc(s)).join('<br>')}</div></div>` : ''}
            ${item.notes ? `<div class="detail-block"><div class="detail-label">Notes</div><div class="detail-text">${esc(item.notes)}</div></div>` : ''}
            ${links.length > 0 ? `<div class="detail-block"><div class="detail-label">Further Reading</div><div class="detail-text">${links.map(l => `<a href="${esc(l.url)}" target="_blank">${esc(l.title)}</a>`).join('<br>')}</div></div>` : ''}
        </div>
    </div>`;
}

// ============================================================
// RENDER SHIPS & VEHICLES
// ============================================================
function renderShips() {
    const grid = document.getElementById('shipsGrid');
    const searchTerm = document.getElementById('shipSearch').value.toLowerCase();
    let ships = DATA.ships;
    if (currentShipFilter !== 'all') {
        if (currentShipFilter === 'ship') ships = ships.filter(s => s.category !== 'vehicle');
        else if (currentShipFilter === 'vehicle') ships = ships.filter(s => s.category === 'vehicle');
    }
    if (searchTerm) {
        ships = ships.filter(s =>
            s.name.toLowerCase().includes(searchTerm) ||
            s.recipe.toLowerCase().includes(searchTerm) ||
            (s.mission_name && s.mission_name.toLowerCase().includes(searchTerm)) ||
            (s.components_summary && s.components_summary.toLowerCase().includes(searchTerm))
        );
    }
    if (ships.length === 0) { grid.innerHTML = '<div class="no-results">No ships or vehicles match your search.</div>'; return; }
    grid.innerHTML = ships.map(ship => {
        const recipe = parseRecipe(ship.recipe);
        const comps = ship.components || [];
        const hasDetails = ship.other_components || ship.image_credit || ship.image_url;
        const isVehicle = ship.category === 'vehicle';
        return `
        <div class="ship-card" onclick="this.classList.toggle('expanded')">
            <div class="ship-card-header">
                <div class="ship-name">${esc(ship.name)}</div>
                <div class="item-badges">
                    <span class="badge ${isVehicle ? 'badge-vehicle' : 'badge-ship'}">${isVehicle ? 'vehicle' : 'ship'}</span>
                    ${ship.patch ? `<span class="badge badge-patch">${ship.patch}</span>` : ''}
                </div>
            </div>
            ${ship.mission_name ? `<div class="item-mission">Mission: "${esc(ship.mission_name)}"</div>` : ''}
            <div class="ship-card-body">
                ${comps.length > 0 ? `
                    <table class="components-table">
                        <thead><tr><th>Type</th><th>Qty</th><th>Component</th><th>Size</th><th>Class</th><th>Grade</th></tr></thead>
                        <tbody>${comps.map(c => `<tr><td>${esc(c.type)}</td><td>${esc(c.quantity)}</td><td class="comp-name">${esc(c.name)}</td><td>${esc(c.size)}</td><td>${esc(c['class'])}</td><td class="comp-grade">${esc(c.grade)}</td></tr>`).join('')}</tbody>
                    </table>` : ''}
                ${recipe.length > 0 ? `
                    <div class="recipe-label">Trade Cost</div>
                    <div class="recipe-list">${recipe.map(r => `<span class="recipe-item">${r.qty ? `<span class="qty">${r.qty}x</span> ` : ''}${esc(r.name)}</span>`).join('')}</div>
                ` : ''}
            </div>
            ${hasDetails ? '<div class="card-expand-hint">▾ Click for details</div>' : ''}
            <div class="ship-details">
                ${ship.image_url ? `<div class="detail-block"><img src="${esc(ship.image_url)}" class="item-image" alt="${esc(ship.name)}"></div>` : ''}
                ${ship.other_components ? `<div class="detail-block"><div class="detail-label">Other Components</div><div class="detail-text">${esc(ship.other_components)}</div></div>` : ''}
                ${ship.image_credit ? `<div class="detail-block"><div class="detail-text" style="font-size:0.72rem; color: var(--text-dim);">Image: ${esc(ship.image_credit)}</div></div>` : ''}
            </div>
        </div>`;
    }).join('');
}

// ============================================================
// RENDER CURRENCY & REPUTATION (unchanged)
// ============================================================
function renderCurrency() {
    const grid = document.getElementById('currencyGrid');
    grid.innerHTML = DATA.currency_exchanges.map(cx => {
        const inputs = cx.recipe.split(';').map(s => s.trim()).filter(Boolean);
        const outputs = cx.reward.split(';').map(s => s.trim()).filter(Boolean);
        const links = cx.further_reading || [];
        return `<div class="currency-card">
            <div class="exchange-visual">
                ${inputs.map((inp, i) => `${i > 0 ? '<span class="exchange-or">or</span>' : ''}<span class="exchange-input">${esc(inp)}</span>`).join('')}
                <span class="exchange-arrow">→</span>
                ${outputs.map(o => `<span class="exchange-output">${esc(o)}</span>`).join('')}
            </div>
            ${cx.description ? `<div class="currency-notes">${esc(cx.description)}</div>` : ''}
            ${cx.notes ? `<div class="currency-notes" style="margin-top:0.5rem; font-size:0.78rem;">${esc(cx.notes)}</div>` : ''}
            ${links.length > 0 ? `<div class="detail-block"><div class="detail-label">Further Reading</div><div class="detail-text">${links.map(l => `<a href="${esc(l.url)}" target="_blank">${esc(l.title)}</a>`).join('<br>')}</div></div>` : ''}
        </div>`;
    }).join('');
    const vh = DATA.very_hungry;
    if (vh && vh.rewards && vh.rewards.length > 0) {
        document.getElementById('hungrySection').innerHTML = `
            <div class="hungry-title">VERY HUNGRY / ARRIVE TO SYSTEM MISSIONS</div>
            ${vh.description ? `<div class="hungry-desc">${esc(vh.description)}</div>` : ''}
            <table class="hungry-table"><thead><tr><th>Gun Reward</th><th>Clothing Reward</th></tr></thead>
            <tbody>${vh.rewards.map(r => `<tr><td>${esc(r.gun)}</td><td>${esc(r.clothing)}</td></tr>`).join('')}</tbody></table>
            ${vh.notes ? `<div class="currency-notes" style="margin-top:1rem; font-size:0.78rem;">${esc(vh.notes)}</div>` : ''}`;
    }
}

function renderReputation() {
    const rep = DATA.reputation;
    if (!rep || !rep.entries) return;
    document.getElementById('repInfo').innerHTML = `<p>${esc(rep.description || '')}</p><p style="margin-top:0.5rem; font-size:0.82rem; color: var(--text-dim);">Patch ${esc(rep.patch || '')} — Updated ${esc(rep.date_updated || '')}</p>`;
    const sorted = [...rep.entries].sort((a, b) => b.reputation_reward - a.reputation_reward);
    document.getElementById('repTable').innerHTML = `<table class="rep-table"><thead><tr><th>Mission</th><th style="text-align:center">Rep Reward</th><th style="text-align:center">Rep Required</th></tr></thead>
        <tbody>${sorted.map(e => `<tr><td>${esc(e.mission_title)}</td><td class="rep-val">+${e.reputation_reward}</td><td class="rep-req ${e.reputation_required > 0 ? 'rep-locked' : ''}">${e.reputation_required > 0 ? e.reputation_required : '—'}</td></tr>`).join('')}</tbody></table>`;
}

// ============================================================
// INVENTORY PLANNER — COMPLETELY REWRITTEN
// ============================================================

function buildMaterialList() {
    const materialSet = new Set();
    DATA.items.forEach(item => parseRecipe(item.recipe).forEach(r => materialSet.add(r.name)));
    DATA.ships.forEach(ship => parseRecipe(ship.recipe).forEach(r => materialSet.add(r.name)));
    allMaterialNames = [...materialSet].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

function renderMaterialInputs() {
    const container = document.getElementById('materialsList');
    const search = document.getElementById('materialSearch').value.toLowerCase();
    let materials = allMaterialNames;
    if (search) materials = materials.filter(m => m.toLowerCase().includes(search));

    container.innerHTML = materials.map(mat => {
        const val = playerInventory[mat] || 0;
        const hasValue = val > 0;
        return `
        <div class="inv-material-row ${hasValue ? 'has-value' : ''}">
            <span class="inv-mat-name" title="${esc(mat)}">${esc(mat)}</span>
            <div class="inv-mat-controls">
                <button class="inv-qty-btn" onclick="adjustMaterial('${escJs(mat)}', -10)" ${!hasValue ? 'disabled' : ''}>-10</button>
                <button class="inv-qty-btn" onclick="adjustMaterial('${escJs(mat)}', -1)" ${!hasValue ? 'disabled' : ''}>-1</button>
                <input type="number" class="inv-qty-input" value="${val}" min="0"
                    onchange="setMaterial('${escJs(mat)}', parseInt(this.value)||0)" onfocus="this.select()">
                <button class="inv-qty-btn" onclick="adjustMaterial('${escJs(mat)}', 1)">+1</button>
                <button class="inv-qty-btn" onclick="adjustMaterial('${escJs(mat)}', 10)">+10</button>
            </div>
        </div>`;
    }).join('');
    updateInvSummary();
}

function setMaterial(name, qty) {
    if (qty <= 0) delete playerInventory[name]; else playerInventory[name] = qty;
    saveToStorage();
    renderMaterialInputs();
    renderMissionMatches();
}
function adjustMaterial(name, delta) { setMaterial(name, Math.max(0, (playerInventory[name] || 0) + delta)); }

function clearInventory() {
    if (!confirm('Clear all materials and deselect all missions?')) return;
    playerInventory = {};
    selectedMissionOrder = [];
    saveToStorage();
    renderMaterialInputs();
    renderMissionMatches();
}

function updateInvSummary() {
    const el = document.getElementById('invSummary');
    const count = Object.keys(playerInventory).filter(k => playerInventory[k] > 0).length;
    const total = Object.values(playerInventory).reduce((a, b) => a + b, 0);
    const selCount = selectedMissionOrder.length;
    if (count === 0) el.innerHTML = '<span class="inv-summary-text">No materials entered yet</span>';
    else el.innerHTML = `<span class="inv-summary-text">${count} materials, ${total} total${selCount > 0 ? ` · ${selCount} in cart` : ''}</span>`;
}

function getAllMissions() {
    const missions = [];
    DATA.items.forEach(item => {
        const recipe = parseRecipe(item.recipe);
        if (recipe.length > 0) missions.push({ id: item.id, name: item.name, category: item.category, mission_name: item.mission_name, recipe, reward: item.reward });
    });
    DATA.ships.forEach(ship => {
        const recipe = parseRecipe(ship.recipe);
        if (recipe.length > 0) missions.push({ id: ship.id, name: ship.name, category: ship.category === 'vehicle' ? 'vehicle' : 'ship', mission_name: ship.mission_name, recipe, reward: ship.name });
    });
    return missions;
}

/**
 * CORE INVENTORY LOGIC
 * 
 * 1. Start with a copy of playerInventory as "pool"
 * 2. Process selected missions in order — each deducts what it can from the pool
 *    - For each selected mission, record what it actually got from the pool
 * 3. After all selections, unselected missions are evaluated against the remaining pool
 * 4. Colour logic per ingredient:
 *    - GREEN: have >= need (fully covered)
 *    - YELLOW: have > 0 but < need (partial)
 *    - GREY: player never had this item (0 in original inventory)
 *    - RED: player had this item but it's been consumed by earlier selections (was > 0, now 0)
 */
function calcAllMissionStates() {
    const missions = getAllMissions();
    const missionMap = {};
    missions.forEach(m => { missionMap[m.id] = m; });

    // Pool starts as copy of player inventory
    const pool = { ...playerInventory };

    // Track what the player originally had (to distinguish grey vs red)
    const originalHas = {};
    for (const k in playerInventory) {
        if (playerInventory[k] > 0) originalHas[k] = true;
    }

    // Process selected missions in order
    const selectedResults = [];
    for (const missionId of selectedMissionOrder) {
        const m = missionMap[missionId];
        if (!m) continue;

        const details = m.recipe.map(r => {
            const poolHas = pool[r.name] || 0;
            const take = Math.min(poolHas, r.qty);
            // Deduct from pool
            pool[r.name] = (pool[r.name] || 0) - take;
            if (pool[r.name] <= 0) delete pool[r.name];

            const got = take;
            const need = r.qty;
            const short = need - got;
            return { name: r.name, need, got, short, originallyHad: !!originalHas[r.name] };
        });

        const allComplete = details.every(d => d.short === 0);
        const pct = details.length > 0
            ? details.reduce((s, d) => s + Math.min((d.got / d.need) * 100, 100), 0) / details.length
            : 0;

        selectedResults.push({
            ...m, isSelected: true, details, isComplete: allComplete, pct,
            selectionIndex: selectedResults.length,
        });
    }

    // Now evaluate unselected missions against remaining pool
    const unselectedResults = [];
    const selectedIds = new Set(selectedMissionOrder);

    for (const m of missions) {
        if (selectedIds.has(m.id)) continue;

        const details = m.recipe.map(r => {
            const poolHas = pool[r.name] || 0;
            const need = r.qty;
            return {
                name: r.name, need, got: Math.min(poolHas, need),
                short: Math.max(0, need - poolHas),
                originallyHad: !!originalHas[r.name],
                poolRemaining: poolHas,
            };
        });

        // Does this mission have any relevance? (player has or had at least one ingredient)
        const relevant = details.some(d => d.originallyHad || d.got > 0);
        if (!relevant) continue;

        const allComplete = details.every(d => d.short === 0);
        const pct = details.length > 0
            ? details.reduce((s, d) => s + Math.min((d.got / d.need) * 100, 100), 0) / details.length
            : 0;

        unselectedResults.push({
            ...m, isSelected: false, details, isComplete: allComplete, pct,
        });
    }

    return { selectedResults, unselectedResults };
}

function getChipColor(d) {
    // d has: got, need, short, originallyHad
    if (d.got >= d.need) return 'green';    // Fully covered
    if (d.got > 0) return 'yellow';          // Partial
    if (d.originallyHad) return 'red';       // Had it but it's been consumed
    return 'grey';                            // Never had it
}

function setInvFilter(mode, btn) {
    invFilterMode = mode;
    document.querySelectorAll('.inv-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderMissionMatches();
}

function addToCart(missionId, event) {
    event.stopPropagation();
    if (!selectedMissionOrder.includes(missionId)) {
        selectedMissionOrder.push(missionId);
    }
    saveToStorage();
    renderMissionMatches();
    updateInvSummary();
}

function removeFromCart(missionId, event) {
    event.stopPropagation();
    selectedMissionOrder = selectedMissionOrder.filter(id => id !== missionId);
    saveToStorage();
    renderMissionMatches();
    updateInvSummary();
}

function purchaseMission(missionId, event) {
    event.stopPropagation();

    // Find the mission data
    const allMissions = getAllMissions();
    const mission = allMissions.find(m => m.id === missionId);
    if (!mission) return;

    // Build a readable summary of what will be deducted
    const lines = mission.recipe.map(r => `  ${r.qty}x ${r.name}`).join('\n');
    const ok = confirm(
        `Complete "${mission.name}"?\n\nThe following materials will be permanently deducted from your inventory:\n\n${lines}\n\nThis cannot be undone.`
    );
    if (!ok) return;

    // Deduct materials from inventory
    mission.recipe.forEach(r => {
        if (playerInventory[r.name]) {
            playerInventory[r.name] = Math.max(0, playerInventory[r.name] - r.qty);
            if (playerInventory[r.name] === 0) delete playerInventory[r.name];
        }
    });

    // Remove from cart
    selectedMissionOrder = selectedMissionOrder.filter(id => id !== missionId);

    saveToStorage();
    renderMaterialInputs();
    renderMissionMatches();
    updateInvSummary();
}

function renderMissionMatches() {
    const container = document.getElementById('missionsList');
    const hasAnyMaterials = Object.keys(playerInventory).some(k => playerInventory[k] > 0);

    if (!hasAnyMaterials && selectedMissionOrder.length === 0) {
        container.innerHTML = '<div class="inv-empty-msg">Enter materials on the left to see matching missions here.</div>';
        return;
    }

    const { selectedResults, unselectedResults } = calcAllMissionStates();

    // Apply filter to unselected
    let filteredUnselected = unselectedResults;
    if (invFilterMode === 'completable') {
        filteredUnselected = filteredUnselected.filter(r => r.isComplete);
    } else if (invFilterMode === 'partial') {
        filteredUnselected = filteredUnselected.filter(r => r.pct > 0 && !r.isComplete);
    }

    // Sort unselected: completable first, then by %
    filteredUnselected.sort((a, b) => {
        if (a.isComplete !== b.isComplete) return a.isComplete ? -1 : 1;
        return b.pct - a.pct;
    });

    let html = '';

    // Render selected (cart) missions first
    if (selectedResults.length > 0) {
        html += '<div class="inv-cart-header">🛒 YOUR CART</div>';
        html += selectedResults.map(r => renderCartMission(r)).join('');
        html += '<div class="inv-cart-divider"></div>';
    }

    // Render unselected
    if (filteredUnselected.length > 0) {
        html += '<div class="inv-available-header">AVAILABLE MISSIONS</div>';
        html += filteredUnselected.map(r => renderAvailableMission(r)).join('');
    } else if (selectedResults.length === 0) {
        html += '<div class="inv-empty-msg">No matching missions for your current materials and filter.</div>';
    }

    container.innerHTML = html;
}

function renderCartMission(r) {
    const pctColor = r.isComplete ? 'var(--accent-green)' : 'var(--accent-gold)';
    const pctText = r.isComplete ? '✓ Ready' : Math.round(r.pct) + '%';
    const barWidth = Math.min(r.pct, 100);

    return `
    <div class="inv-mission-card selected ${r.isComplete ? 'cart-complete' : 'cart-partial'}">
        <div class="inv-mission-header">
            <div class="inv-mission-info">
                <span class="inv-cart-icon">${r.isComplete ? '✅' : '🛒'}</span>
                <span class="inv-mission-name">${esc(r.name)}</span>
                <span class="badge badge-${r.category}">${r.category}</span>
            </div>
            <div class="inv-mission-actions">
                <span class="inv-mission-pct" style="color:${pctColor}">${pctText}</span>
                ${r.isComplete ? `<button class="inv-purchase-btn" onclick="purchaseMission('${r.id}', event)" title="Mark as purchased — deducts materials">✓ Purchased</button>` : ''}
                <button class="inv-remove-btn" onclick="removeFromCart('${r.id}', event)" title="Remove from cart">✕</button>
            </div>
        </div>
        <div class="inv-progress-bar"><div class="inv-progress-fill" style="width:${barWidth}%; background:${pctColor}"></div></div>
        <div class="inv-mission-recipe">
            ${r.details.map(d => {
                const color = getChipColor(d);
                const cssColor = color === 'green' ? 'var(--accent-green)' : color === 'yellow' ? 'var(--accent-gold)' : color === 'red' ? 'var(--accent-red)' : 'var(--text-dim)';
                return `<span class="inv-recipe-chip" style="border-color:${cssColor}">
                    <span style="color:${cssColor}">${d.got}/${d.need}</span> ${esc(d.name)}
                    ${d.short > 0 ? `<span class="inv-short-label">need ${d.short}</span>` : ''}
                </span>`;
            }).join('')}
        </div>
        ${r.mission_name ? `<div class="inv-mission-sub">Mission: "${esc(r.mission_name)}"</div>` : ''}
    </div>`;
}

function renderAvailableMission(r) {
    const pctColor = r.isComplete ? 'var(--accent-green)' : r.pct > 0 ? 'var(--accent-gold)' : 'var(--text-dim)';
    const barWidth = Math.min(r.pct, 100);

    // For unselected: calculate times completable
    let pctText = Math.round(r.pct) + '%';
    if (r.isComplete) {
        let minTimes = Infinity;
        r.details.forEach(d => { minTimes = Math.min(minTimes, d.need > 0 ? Math.floor(d.got / d.need) : 0); });
        if (minTimes > 1) pctText = minTimes + 'x';
        else pctText = '100%';
    }

    return `
    <div class="inv-mission-card ${r.isComplete ? 'completable' : ''}">
        <div class="inv-mission-header">
            <div class="inv-mission-info">
                <span class="inv-mission-name">${esc(r.name)}</span>
                <span class="badge badge-${r.category}">${r.category}</span>
            </div>
            <div class="inv-mission-actions">
                <span class="inv-mission-pct" style="color:${pctColor}">${pctText}</span>
                <button class="inv-add-btn" onclick="addToCart('${r.id}', event)" title="Add to cart">+ Cart</button>
            </div>
        </div>
        <div class="inv-progress-bar"><div class="inv-progress-fill" style="width:${barWidth}%; background:${pctColor}"></div></div>
        <div class="inv-mission-recipe">
            ${r.details.map(d => {
                const color = getChipColor(d);
                const cssColor = color === 'green' ? 'var(--accent-green)' : color === 'yellow' ? 'var(--accent-gold)' : color === 'red' ? 'var(--accent-red)' : 'var(--text-dim)';
                return `<span class="inv-recipe-chip" style="border-color:${cssColor}">
                    <span style="color:${cssColor}">${d.got}/${d.need}</span> ${esc(d.name)}
                </span>`;
            }).join('')}
        </div>
        ${r.mission_name ? `<div class="inv-mission-sub">Mission: "${esc(r.mission_name)}"</div>` : ''}
    </div>`;
}

// ============================================================
// UTILS
// ============================================================
function esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
function escJs(str) { return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

// ============================================================
// START
// ============================================================
document.addEventListener('DOMContentLoaded', loadData);
