/**
 * Wikelo's Emporium — Main Application v5
 */

let DATA = null;
let currentFilter = 'all';
let currentShipFilter = 'all';
let currentSection = 'welcome';
let playerInventory = {};
let selectedMissionOrder = [];
let invFilterMode = 'all';
let allMaterialNames = [];

const STORAGE_KEY_INV = 'wikelo_inventory';
const STORAGE_KEY_SEL = 'wikelo_selected_order';

async function loadData() {
    try {
        const resp = await fetch('data/wikelo_data.json');
        DATA = await resp.json();
        if (!DATA.ingredients_info) DATA.ingredients_info = {};
        loadInventoryFromStorage();
        init();
    } catch (err) {
        console.error('Failed to load data:', err);
        document.querySelector('.main-content').innerHTML =
            '<div class="no-results">Failed to load data. Make sure wikelo_data.json exists in the data/ folder.</div>';
    }
}

function init() {
    const currentPatch = DATA.meta.current_patch || '';
    const dataUpdated = DATA.meta.data_updated || '';
    document.getElementById('currentPatch').textContent = currentPatch ? `Patch ${currentPatch}` : '';
    if (dataUpdated) document.getElementById('dataUpdated').textContent = `Data: ${dataUpdated}`;

    // News reel
    const newsReel = DATA.meta.news_reel || '';
    if (newsReel) {
        document.getElementById('newsReel').style.display = 'block';
        document.getElementById('newsReelText').textContent = newsReel;
    }

    buildMaterialList();
    renderItems();
    renderShips();
    renderCurrency();
    renderReputation();
    renderIntroMission();
    renderMaterialInputs();
    renderMissionMatches();
    setupNav();
    setupFilters();
    setupSearch();
}

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
// PARSE RECIPE & INGREDIENT INFO
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

function getIngredientInfo(name) {
    return (DATA.ingredients_info || {})[name] || null;
}

function renderIngredientDetails(recipe) {
    if (!DATA.ingredients_info) return '';
    const infoItems = recipe.filter(r => {
        const info = getIngredientInfo(r.name);
        return info && (info.location || info.link_url);
    });
    if (infoItems.length === 0) return '';
    return `
        <div class="detail-block">
            <div class="detail-label">Where to Find Materials</div>
            <div class="detail-text">
                ${infoItems.map(r => {
                    const info = getIngredientInfo(r.name);
                    let html = `<strong>${esc(r.name)}</strong>`;
                    if (info.location) html += ` — ${esc(info.location)}`;
                    if (info.link_url) html += ` <a href="${esc(info.link_url)}" target="_blank">${esc(info.link_title || 'More info')}</a>`;
                    return html;
                }).join('<br>')}
            </div>
        </div>`;
}

// ============================================================
// BADGE HELPERS
// ============================================================
function isRetired(item) {
    return item.status && item.status.startsWith('retired');
}

function renderBadges(item) {
    let html = `<span class="badge badge-${item.category}">${item.category}</span>`;
    if (item.patch_type === 'new') html += `<span class="badge badge-new">new</span>`;
    else if (item.patch_type === 'updated') html += `<span class="badge badge-updated">updated</span>`;
    if (item.status === 'retired-loot') html += `<span class="badge badge-retired">loot pool</span>`;
    else if (item.status === 'retired-store') html += `<span class="badge badge-retired">store exclusive</span>`;
    else if (item.status === 'retired') html += `<span class="badge badge-retired">retired</span>`;
    return html;
}

// ============================================================
// RENDER ITEMS
// ============================================================
function renderItems() {
    const grid = document.getElementById('itemsGrid');
    const searchTerm = document.getElementById('itemSearch').value.toLowerCase();
    let items = DATA.items;
    if (currentFilter === 'retired') {
        items = items.filter(i => isRetired(i));
    } else if (currentFilter !== 'all') {
        items = items.filter(i => i.category === currentFilter && !isRetired(i));
    }
    if (searchTerm) {
        items = items.filter(i =>
            (i.name || '').toLowerCase().includes(searchTerm) ||
            (i.recipe || '').toLowerCase().includes(searchTerm) ||
            (i.mission_name || '').toLowerCase().includes(searchTerm) ||
            (i.reward || '').toLowerCase().includes(searchTerm)
        );
    }
    document.getElementById('itemCount').textContent = items.length;
    if (items.length === 0) { grid.innerHTML = '<div class="no-results">No items match your search.</div>'; return; }
    grid.innerHTML = items.map(item => renderItemCard(item)).join('');
}

function renderItemCard(item) {
    const recipe = parseRecipe(item.recipe);
    const sources = item.sources ? item.sources.split(';').map(s => s.trim()).filter(Boolean) : [];
    const links = item.further_reading || [];
    const ingredientDetails = renderIngredientDetails(recipe);
    const hasDetails = sources.length > 0 || item.notes || links.length > 0 || item.image_url || ingredientDetails;
    const repReq = item.reputation_required || 0;
    const reward = item.reward || item.category.charAt(0).toUpperCase() + item.category.slice(1);
    return `
    <div class="item-card ${isRetired(item) ? 'retired-card' : ''}" onclick="this.classList.toggle('expanded')">
        <div class="item-card-header">
            <div class="item-mission-title">${esc(item.mission_name || item.name)}</div>
            <div class="item-badges">${renderBadges(item)}</div>
        </div>
        <div class="item-card-body">
            ${recipe.length > 0 ? `
                <div class="recipe-label">Recipe / Cost</div>
                <div class="recipe-list">${recipe.map(r => `<span class="recipe-item">${r.qty ? `<span class="qty">${r.qty}x</span> ` : ''}${esc(r.name)}</span>`).join('')}</div>
            ` : ''}
            ${repReq > 0 ? `<div class="rep-req-line"><span>Reputation Required: </span>${repReq}</div>` : ''}
            <div class="reward-line"><span>Reward: </span>${esc(reward)}${item.reputation_reward ? ` <span class="rep-reward-inline">+${item.reputation_reward} rep</span>` : ''}</div>
        </div>
        ${hasDetails ? '<div class="card-expand-hint">▾ Click for details</div>' : ''}
        <div class="item-details">
            ${item.image_url ? `<div class="detail-block"><img src="${esc(item.image_url)}" class="item-image" alt="${esc(item.name)}"></div>` : ''}
            ${ingredientDetails}
            ${sources.length > 0 ? `<div class="detail-block"><div class="detail-label">Where to Find Materials</div><div class="detail-text">${sources.map(s => esc(s)).join('<br>')}</div></div>` : ''}
            ${item.notes ? `<div class="detail-block"><div class="detail-label">Notes</div><div class="detail-text">${esc(item.notes)}</div></div>` : ''}
            ${links.length > 0 ? `<div class="detail-block"><div class="detail-label">Further Reading</div><div class="detail-text">${links.map(l => `<a href="${esc(l.url)}" target="_blank">${esc(l.title)}</a>`).join('<br>')}</div></div>` : ''}
        </div>
    </div>`;
}

// ============================================================
// RENDER SHIPS
// ============================================================
function renderShips() {
    const grid = document.getElementById('shipsGrid');
    const searchTerm = document.getElementById('shipSearch').value.toLowerCase();
    let ships = DATA.ships;
    if (currentShipFilter === 'retired') {
        ships = ships.filter(s => isRetired(s));
    } else if (currentShipFilter !== 'all') {
        if (currentShipFilter === 'ship') ships = ships.filter(s => s.category !== 'vehicle' && !isRetired(s));
        else if (currentShipFilter === 'vehicle') ships = ships.filter(s => s.category === 'vehicle' && !isRetired(s));
    }
    if (searchTerm) {
        ships = ships.filter(s =>
            (s.name || '').toLowerCase().includes(searchTerm) ||
            (s.recipe || '').toLowerCase().includes(searchTerm) ||
            (s.mission_name || '').toLowerCase().includes(searchTerm) ||
            (s.reward || '').toLowerCase().includes(searchTerm)
        );
    }
    document.getElementById('shipCount').textContent = ships.length;
    if (ships.length === 0) { grid.innerHTML = '<div class="no-results">No ships or vehicles match your search.</div>'; return; }
    grid.innerHTML = ships.map(ship => {
        const recipe = parseRecipe(ship.recipe);
        const comps = ship.components || [];
        const ingredientDetails = renderIngredientDetails(recipe);
        const hasDetails = ship.other_components || ship.image_credit || ship.image_url || ingredientDetails;
        const isVehicle = ship.category === 'vehicle';
        const repReq = ship.reputation_required || 0;
        const reward = ship.reward || ship.name || (isVehicle ? 'Vehicle' : 'Ship');
        return `
        <div class="ship-card ${isRetired(ship) ? 'retired-card' : ''}" onclick="this.classList.toggle('expanded')">
            <div class="ship-card-header">
                <div class="item-mission-title">${esc(ship.mission_name || ship.name)}</div>
                <div class="item-badges">${renderBadges(ship)}</div>
            </div>
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
                ${repReq > 0 ? `<div class="rep-req-line"><span>Reputation Required: </span>${repReq}</div>` : ''}
                <div class="reward-line"><span>Reward: </span>${esc(reward)}${ship.reputation_reward ? ` <span class="rep-reward-inline">+${ship.reputation_reward} rep</span>` : ''}</div>
            </div>
            ${hasDetails ? '<div class="card-expand-hint">▾ Click for details</div>' : ''}
            <div class="ship-details">
                ${ship.image_url ? `<div class="detail-block"><img src="${esc(ship.image_url)}" class="item-image" alt="${esc(ship.name)}"></div>` : ''}
                ${ingredientDetails}
                ${ship.other_components ? `<div class="detail-block"><div class="detail-label">Other Components</div><div class="detail-text">${esc(ship.other_components)}</div></div>` : ''}
                ${ship.image_credit ? `<div class="detail-block"><div class="detail-text" style="font-size:0.72rem; color: var(--text-dim);">Image: ${esc(ship.image_credit)}</div></div>` : ''}
            </div>
        </div>`;
    }).join('');
}

// ============================================================
// INTRO MISSION (welcome page)
// ============================================================
function renderIntroMission() {
    const intro = DATA.intro_mission;
    if (!intro) return;
    const section = document.getElementById('introMissionSection');
    section.style.display = 'block';
    const recipe = parseRecipe(intro.recipe);
    section.innerHTML = `
        <div class="intro-mission-card">
            <div class="intro-label">⬡ INTRODUCTORY MISSION</div>
            <div class="intro-title">${esc(intro.mission_name)}</div>
            ${intro.description ? `<div class="intro-desc">"${esc(intro.description)}"</div>` : ''}
            ${recipe.length > 0 ? `
                <div class="recipe-label">Bring to Wikelo</div>
                <div class="recipe-list">${recipe.map(r => `<span class="recipe-item">${r.qty ? `<span class="qty">${r.qty}x</span> ` : ''}${esc(r.name)}</span>`).join('')}</div>
            ` : ''}
            ${intro.reputation_reward ? `<div class="reward-line" style="margin-top:0.75rem"><span>Reputation Reward: </span>+${intro.reputation_reward}</div>` : ''}
        </div>`;
}

// ============================================================
// CURRENCY & REPUTATION
// ============================================================
function renderCurrency() {
    const grid = document.getElementById('currencyGrid');
    if (!DATA.currency_exchanges || DATA.currency_exchanges.length === 0) {
        grid.innerHTML = '<div class="no-results">No currency exchange data available.</div>';
    } else {
        grid.innerHTML = DATA.currency_exchanges.map(cx => {
            const inputs = (cx.recipe || '').split(';').map(s => s.trim()).filter(Boolean);
            const outputs = (cx.reward || '').split(';').map(s => s.trim()).filter(Boolean);
            const links = cx.further_reading || [];
            return `<div class="currency-card">
                <div class="exchange-visual">
                    ${inputs.map((inp, i) => `${i > 0 ? '<span class="exchange-or">+</span>' : ''}<span class="exchange-input">${esc(inp)}</span>`).join('')}
                    <span class="exchange-arrow">→</span>
                    ${outputs.map(o => `<span class="exchange-output">${esc(o)}</span>`).join('')}
                </div>
                ${cx.description ? `<div class="currency-notes">${esc(cx.description)}</div>` : ''}
                ${cx.notes ? `<div class="currency-notes" style="margin-top:0.5rem; font-size:0.78rem;">${esc(cx.notes)}</div>` : ''}
                ${links.length > 0 ? `<div class="detail-block"><div class="detail-label">Further Reading</div><div class="detail-text">${links.map(l => `<a href="${esc(l.url)}" target="_blank">${esc(l.title)}</a>`).join('<br>')}</div></div>` : ''}
            </div>`;
        }).join('');
    }
    const vh = DATA.very_hungry;
    if (vh && vh.rewards && vh.rewards.length > 0) {
        document.getElementById('hungrySection').innerHTML = `
            <div class="hungry-title">VERY HUNGRY / ARRIVE TO SYSTEM MISSIONS</div>
            ${vh.description ? `<div class="hungry-desc">${esc(vh.description)}</div>` : ''}
            <table class="hungry-table"><thead><tr><th>Gun Reward</th><th>Clothing Reward</th></tr></thead>
            <tbody>${vh.rewards.map(r => `<tr><td>${esc(r.gun)}</td><td>${esc(r.clothing)}</td></tr>`).join('')}</tbody></table>`;
    }
}

function renderReputation() {
    const rep = DATA.reputation;
    if (!rep || !rep.entries) return;
    document.getElementById('repInfo').innerHTML = `<p>${esc(rep.description || '')}</p>`;
    const sorted = [...rep.entries].sort((a, b) => b.reputation_reward - a.reputation_reward);
    document.getElementById('repTable').innerHTML = `<table class="rep-table"><thead><tr><th>Mission</th><th style="text-align:center">Rep Reward</th><th style="text-align:center">Rep Required</th></tr></thead>
        <tbody>${sorted.map(e => `<tr><td>${esc(e.mission_title)}</td><td class="rep-val">+${e.reputation_reward}</td><td class="rep-req ${e.reputation_required > 0 ? 'rep-locked' : ''}">${e.reputation_required > 0 ? e.reputation_required : '—'}</td></tr>`).join('')}</tbody></table>`;
}

// ============================================================
// INVENTORY PLANNER
// ============================================================
function buildMaterialList() {
    const materialSet = new Set();
    DATA.items.forEach(item => { if (!isRetired(item)) parseRecipe(item.recipe).forEach(r => materialSet.add(r.name)); });
    DATA.ships.forEach(ship => { if (!isRetired(ship)) parseRecipe(ship.recipe).forEach(r => materialSet.add(r.name)); });
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
    saveToStorage(); renderMaterialInputs(); renderMissionMatches();
}
function adjustMaterial(name, delta) { setMaterial(name, Math.max(0, (playerInventory[name] || 0) + delta)); }

function clearInventory() {
    if (!confirm('Clear all materials and deselect all missions?')) return;
    playerInventory = {}; selectedMissionOrder = [];
    saveToStorage(); renderMaterialInputs(); renderMissionMatches();
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
        if (isRetired(item)) return;
        const recipe = parseRecipe(item.recipe);
        if (recipe.length > 0) {
            const reward = item.reward || item.category.charAt(0).toUpperCase() + item.category.slice(1);
            missions.push({ id: item.id, name: item.mission_name || item.name, category: item.category, mission_name: item.mission_name, recipe, reward, reputation_reward: item.reputation_reward || 0 });
        }
    });
    DATA.ships.forEach(ship => {
        if (isRetired(ship)) return;
        const recipe = parseRecipe(ship.recipe);
        if (recipe.length > 0) {
            const reward = ship.reward || ship.name || 'Ship';
            missions.push({ id: ship.id, name: ship.mission_name || ship.name, category: ship.category === 'vehicle' ? 'vehicle' : 'ship', mission_name: ship.mission_name, recipe, reward, reputation_reward: ship.reputation_reward || 0 });
        }
    });
    return missions;
}

function calcAllMissionStates() {
    const missions = getAllMissions();
    const missionMap = {}; missions.forEach(m => { missionMap[m.id] = m; });
    const pool = { ...playerInventory };
    const originalHas = {};
    for (const k in playerInventory) { if (playerInventory[k] > 0) originalHas[k] = true; }
    const selectedResults = [];
    for (const missionId of selectedMissionOrder) {
        const m = missionMap[missionId]; if (!m) continue;
        const details = m.recipe.map(r => {
            const poolHas = pool[r.name] || 0; const take = Math.min(poolHas, r.qty);
            pool[r.name] = (pool[r.name] || 0) - take; if (pool[r.name] <= 0) delete pool[r.name];
            return { name: r.name, need: r.qty, got: take, short: r.qty - take, originallyHad: !!originalHas[r.name] };
        });
        const allComplete = details.every(d => d.short === 0);
        const pct = details.length > 0 ? details.reduce((s, d) => s + Math.min((d.got / d.need) * 100, 100), 0) / details.length : 0;
        selectedResults.push({ ...m, isSelected: true, details, isComplete: allComplete, pct });
    }
    const unselectedResults = []; const selectedIds = new Set(selectedMissionOrder);
    for (const m of missions) {
        if (selectedIds.has(m.id)) continue;
        const details = m.recipe.map(r => {
            const poolHas = pool[r.name] || 0;
            return { name: r.name, need: r.qty, got: Math.min(poolHas, r.qty), short: Math.max(0, r.qty - poolHas), originallyHad: !!originalHas[r.name] };
        });
        if (!details.some(d => d.originallyHad || d.got > 0)) continue;
        const allComplete = details.every(d => d.short === 0);
        const pct = details.length > 0 ? details.reduce((s, d) => s + Math.min((d.got / d.need) * 100, 100), 0) / details.length : 0;
        unselectedResults.push({ ...m, isSelected: false, details, isComplete: allComplete, pct });
    }
    return { selectedResults, unselectedResults };
}

function getChipColor(d) {
    if (d.got >= d.need) return 'green'; if (d.got > 0) return 'yellow';
    if (d.originallyHad) return 'red'; return 'grey';
}

function setInvFilter(mode, btn) {
    invFilterMode = mode;
    document.querySelectorAll('.inv-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active'); renderMissionMatches();
}

function addToCart(missionId, event) {
    event.stopPropagation();
    if (!selectedMissionOrder.includes(missionId)) selectedMissionOrder.push(missionId);
    saveToStorage(); renderMissionMatches(); updateInvSummary();
}

function removeFromCart(missionId, event) {
    event.stopPropagation();
    selectedMissionOrder = selectedMissionOrder.filter(id => id !== missionId);
    saveToStorage(); renderMissionMatches(); updateInvSummary();
}

function purchaseMission(missionId, event) {
    event.stopPropagation();
    const mission = getAllMissions().find(m => m.id === missionId); if (!mission) return;
    const lines = mission.recipe.map(r => `  ${r.qty}x ${r.name}`).join('\n');
    if (!confirm(`Complete "${mission.name}"?\n\nDeducting:\n${lines}\n\nThis cannot be undone.`)) return;
    mission.recipe.forEach(r => {
        if (playerInventory[r.name]) { playerInventory[r.name] = Math.max(0, playerInventory[r.name] - r.qty); if (playerInventory[r.name] === 0) delete playerInventory[r.name]; }
    });
    selectedMissionOrder = selectedMissionOrder.filter(id => id !== missionId);
    saveToStorage(); renderMaterialInputs(); renderMissionMatches(); updateInvSummary();
}

function renderMissionMatches() {
    const container = document.getElementById('missionsList');
    if (!Object.keys(playerInventory).some(k => playerInventory[k] > 0) && selectedMissionOrder.length === 0) {
        container.innerHTML = '<div class="inv-empty-msg">Enter materials on the left to see matching missions here.</div>'; return;
    }
    const { selectedResults, unselectedResults } = calcAllMissionStates();
    let filtered = unselectedResults;
    if (invFilterMode === 'completable') filtered = filtered.filter(r => r.isComplete);
    else if (invFilterMode === 'partial') filtered = filtered.filter(r => r.pct > 0 && !r.isComplete);
    filtered.sort((a, b) => { if (a.isComplete !== b.isComplete) return a.isComplete ? -1 : 1; return b.pct - a.pct; });
    let html = '';
    if (selectedResults.length > 0) {
        html += '<div class="inv-cart-header">🛒 YOUR CART</div>';
        html += selectedResults.map(r => renderInvMission(r, true)).join('');
        html += '<div class="inv-cart-divider"></div>';
    }
    if (filtered.length > 0) {
        html += '<div class="inv-available-header">AVAILABLE MISSIONS</div>';
        html += filtered.map(r => renderInvMission(r, false)).join('');
    } else if (selectedResults.length === 0) {
        html += '<div class="inv-empty-msg">No matching missions for your current materials and filter.</div>';
    }
    container.innerHTML = html;
}

function renderInvMission(r, isCart) {
    const pctColor = r.isComplete ? 'var(--accent-green)' : r.pct > 0 ? 'var(--accent-gold)' : 'var(--text-dim)';
    const barWidth = Math.min(r.pct, 100);
    let pctText = Math.round(r.pct) + '%';
    if (r.isComplete) { if (isCart) pctText = '✓ Ready'; else { let mt = Infinity; r.details.forEach(d => { mt = Math.min(mt, d.need > 0 ? Math.floor(d.got / d.need) : 0); }); pctText = mt > 1 ? mt + 'x' : '100%'; } }
    const chipHtml = r.details.map(d => {
        const color = getChipColor(d);
        const css = color === 'green' ? 'var(--accent-green)' : color === 'yellow' ? 'var(--accent-gold)' : color === 'red' ? 'var(--accent-red)' : 'var(--text-dim)';
        return `<span class="inv-recipe-chip" style="border-color:${css}"><span style="color:${css}">${d.got}/${d.need}</span> ${esc(d.name)}${isCart && d.short > 0 ? `<span class="inv-short-label">need ${d.short}</span>` : ''}</span>`;
    }).join('');
    const ingredientDetails = renderIngredientDetails(r.recipe);
    return `
    <div class="inv-mission-card ${isCart ? 'selected' : ''} ${r.isComplete ? (isCart ? 'cart-complete' : 'completable') : (isCart ? 'cart-partial' : '')}" onclick="this.classList.toggle('expanded')">
        <div class="inv-mission-header">
            <div class="inv-mission-info">
                ${isCart ? `<span class="inv-cart-icon">${r.isComplete ? '✅' : '🛒'}</span>` : ''}
                <span class="inv-mission-name">${esc(r.name)}</span>
                <span class="badge badge-${r.category}">${r.category}</span>
            </div>
            <div class="inv-mission-actions">
                <span class="inv-mission-pct" style="color:${pctColor}">${pctText}</span>
                ${isCart && r.isComplete ? `<button class="inv-purchase-btn" onclick="purchaseMission('${r.id}', event)">✓ Purchased</button>` : ''}
                ${isCart ? `<button class="inv-remove-btn" onclick="removeFromCart('${r.id}', event)">✕</button>` : `<button class="inv-add-btn" onclick="addToCart('${r.id}', event)">+ Cart</button>`}
            </div>
        </div>
        <div class="inv-progress-bar"><div class="inv-progress-fill" style="width:${barWidth}%; background:${pctColor}"></div></div>
        <div class="inv-mission-recipe">${chipHtml}</div>
        <div class="inv-mission-reward"><span>Reward: </span>${esc(r.reward || r.name)}${r.reputation_reward ? ` <span class="rep-reward-inline">+${r.reputation_reward} rep</span>` : ''}</div>
        ${ingredientDetails ? `<div class="card-expand-hint">▾ Click for details</div><div class="inv-mission-details">${ingredientDetails}</div>` : ''}
    </div>`;
}

// ============================================================
// UTILS
// ============================================================
function esc(str) { if (!str) return ''; const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }
function escJs(str) { return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

document.addEventListener('DOMContentLoaded', loadData);
