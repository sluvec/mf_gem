/**
 * @fileoverview CRM Application Entry Point
 * @description Streamlined main entry point using modular architecture
 */

import { logInfo, logError, logDebug } from './utils.js';
import { db } from './database.js';
import { uiModals } from './ui-modals.js';

/**
 * @description Simplified CRM Application Class
 */
class CRMApplication {
    constructor() {
        this.initialized = false;
        this.currentPage = null;
        this.builderContext = { pcId: null, editingQuoteId: null };
        this.builderState = {
            priceListId: '', currency: 'GBP', vatRate: 20,
            plItems: [], recyclingItems: [], rebateItems: [], otherCosts: [],
            categoryOptions: { labour: [], vehicles: [], materials: [], other: [] }
        };
        this.currentPage = 'dashboard';
        this.currentUser = null;
        
        // Constants for cleaner code
        this.ACTIVITY_VIEWS = ['list', 'calendar'];
        this.CALENDAR_VIEWS = ['month', 'week'];
        this.ACTIVITY_STATUSES = ['pending', 'in-progress', 'completed', 'cancelled'];
        
        // UI Colors
        this.COLORS = {
            primary: '#3b82f6',
            secondary: '#6b7280',
            neutral: '#374151',
            transparent: 'transparent',
            white: 'white'
        };
        
        // Display values
        this.DISPLAY = {
            none: 'none',
            block: 'block',
            flex: 'flex'
        };
        
        // Performance optimization - caching
        this.calendarCache = new Map();
        this.activitiesCache = null;
        this.lastActivitiesLoad = null;
        this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
        
        // Smart filters state
        this.activeFilters = {
            activities: {
                company: '',
                accountManager: '',
                pcNumber: ''
            }
        };

        // Cache for account managers
        this.accountManagersCache = [];
    }

    /**
     * @description Open full-screen Quote Builder
     * @param {string|null} pcId Optional PC ID to prefill
     */
    async openQuoteBuilder(pcId = null) {
        try {
            // Navigate to builder page
            await this.navigateToPage('quote-builder');

            // Track current page
            this.currentPage = 'quote-builder';

            // Prefill PC if provided
            // not editing mode
            this.builderContext.editingQuoteId = null;

            if (pcId) {
                const pc = await db.load('pcNumbers', pcId);
                if (pc) {
                    this.builderContext.pcId = pcId;
                    // Populate company + load activities list (placeholder)
                    const titleEl = document.getElementById('quote-builder-title');
                    if (titleEl) titleEl.textContent = `New Quote for ${pc.pcNumber} — ${pc.company || ''}`;
                    // Prefill Collection address/contact from PC
                    this.prefillCollectionFromPc(pc);

                    // Ensure AM selects are populated and default to PC's AM if present
                    try {
                        if (!this.accountManagersCache || this.accountManagersCache.length === 0) {
                            this.accountManagersCache = await db.loadAll('accountManagers');
                            this.accountManagersCache.sort((a,b)=> (a.name||'').localeCompare(b.name||''));
                        }
                        this.populateAllAccountManagerSelects();
                        const amSelect = document.getElementById('quote-modal-account-manager');
                        if (amSelect && pc.accountManager) amSelect.value = pc.accountManager;
                    } catch (_) {}

                    // Show selected PC chip in smart input
                    const chipWrap = document.getElementById('builder-pc-selected');
                    const chip = document.getElementById('builder-pc-selected-chip');
                    const smart = document.getElementById('builder-pc-smart');
                    if (chip && chipWrap) {
                        chip.textContent = `${pc.pcNumber} — ${pc.company || ''}`;
                        chipWrap.style.display = '';
                    }
                    if (smart) smart.value = pc.pcNumber || '';
                }
            } else {
                const titleEl = document.getElementById('quote-builder-title');
                if (titleEl) titleEl.textContent = 'New Quote';
                this.builderContext.pcId = null;
            }

            // Initialize default VAT
            const vatInput = document.getElementById('quote-vat-rate');
            if (vatInput && !vatInput.value) vatInput.value = '20.00';

            // Ensure Step 1 & Step 2 are visible by default; items section hidden until PL selected
            const step1Card = document.getElementById('builder-step-client');
            const plSelector = document.getElementById('price-list-selector');
            const itemsSection = document.getElementById('quote-items-section');
            if (step1Card) step1Card.style.display = '';
            if (plSelector) plSelector.style.display = '';
            if (itemsSection) itemsSection.style.display = 'none';

            // Reset filters that affect PC dropdown so it shows all PCs by default
            const clientInput = document.getElementById('builder-client-name');
            if (clientInput) clientInput.value = '';
            const manualPcInput = document.getElementById('builder-pc-number-manual');
            if (manualPcInput) manualPcInput.value = '';

            // Initialize builder state
            this.builderState = {
                priceListId: '',
                currency: 'GBP',
                vatRate: parseFloat(document.getElementById('quote-vat-rate')?.value || '20') || 20,
                plItems: [],
                categoryOptions: { labour: [], vehicles: [], materials: [], other: [] }
            };

            // Load account managers and populate selects early
            try {
                this.accountManagersCache = await db.loadAll('accountManagers');
                this.accountManagersCache.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                this.populateAllAccountManagerSelects();
            } catch (e) { logDebug('AM preload failed (non-blocking):', e); }

            // Populate price lists selector
            const priceListSelect = document.getElementById('quote-price-list');
            if (priceListSelect) {
                const priceLists = await db.loadAll('priceLists');
                priceListSelect.innerHTML = '<option value="">Select Price List...</option>';
                priceLists.forEach(pl => {
                    const opt = document.createElement('option');
                    opt.value = pl.id;
                    opt.textContent = pl.name || pl.id;
                    priceListSelect.appendChild(opt);
                });
            }

            // Initialize PC dropdown (all PCs or filtered by client)
            await this.builderUpdatePcDropdown();

        } catch (error) {
            logError('Failed to open Quote Builder:', error);
            uiModals.showToast('Failed to open Quote Builder', 'error');
        }
    }

    /**
     * @description Open Quote Builder in edit mode for an existing quote
     */
    async openQuoteBuilderForEdit(quoteId) {
        try {
            const quote = await db.load('quotes', quoteId);
            if (!quote) {
                uiModals.showToast('Quote not found', 'error');
                return;
            }
            await this.navigateToPage('quote-builder');
            this.currentPage = 'quote-builder';
            this.builderContext.editingQuoteId = quoteId;
            this.builderContext.pcId = quote.pcId || null;

            // Title
            const titleEl = document.getElementById('quote-builder-title');
            if (titleEl) titleEl.textContent = `Edit Quote ${quote.quoteNumber || quote.id}`;

            // Prefill client & AM & property
            const setVal = (id,val)=>{const el=document.getElementById(id); if(el) el.value = val || '';};
            setVal('builder-client-name', quote.clientName || '');
            setVal('builder-account-manager', quote.accountManager || '');
            setVal('builder-property-type', quote.propertyType || '');

            // VAT
            const vatInput = document.getElementById('quote-vat-rate');
            if (vatInput) vatInput.value = (quote.vatRate ?? 20).toString();

            // Discount UI
            const discType = document.getElementById('quote-discount-type');
            const discVal = document.getElementById('quote-discount-value');
            if (discType) discType.value = (quote.discount?.type) || 'percent';
            if (discVal) discVal.value = (quote.discount?.value ?? 0);

            // Addresses
            const fillAddr = (prefix, obj)=>{
                setVal(`${prefix}-name`, obj?.contactName||'');
                setVal(`${prefix}-phone`, obj?.phone||'');
                setVal(`${prefix}-email`, obj?.email||'');
                if (obj?.date) setVal(`${prefix}-date`, obj.date.split('T')[0]);
                setVal(`${prefix}-address1`, obj?.address1||'');
                setVal(`${prefix}-address2`, obj?.address2||'');
                setVal(`${prefix}-city`, obj?.city||'');
                setVal(`${prefix}-county`, obj?.county||'');
                setVal(`${prefix}-postcode`, obj?.postcode||'');
            };
            fillAddr('quote-collection', quote.collectionAddress || {});
            fillAddr('quote-delivery', quote.deliveryAddress || {});

            // Setup PC dropdown/manual based on quote
            await this.builderUpdatePcDropdown();
            const sel = document.getElementById('builder-pc-select');
            const hint = document.getElementById('builder-pc-hint');
            const manual = document.getElementById('builder-pc-number-manual');
            if (sel && quote.pcId) sel.value = quote.pcId;
            if (manual) manual.value = quote.pcNumber || '';
            if (hint) hint.textContent = quote.pcNumber ? `Selected: ${quote.pcNumber} — ${quote.clientName||quote.company||''}` : 'No PC selected';

            // State
            this.builderState = {
                priceListId: quote.priceListId || '',
                currency: quote.currency || 'GBP',
                vatRate: quote.vatRate ?? 20,
                plItems: quote.itemsPriceList || quote.items || [],
                recyclingItems: quote.recyclingItems || [],
                rebateItems: quote.rebateItems || [],
                otherCosts: quote.otherCostsManual || quote.otherCosts || [],
                categoryOptions: { labour: [], vehicles: [], materials: [], other: [] }
            };

            // PL select and categories
            const priceListSelect = document.getElementById('quote-price-list');
            if (priceListSelect) {
                const priceLists = await db.loadAll('priceLists');
                priceListSelect.innerHTML = '<option value="">Select Price List...</option>';
                priceLists.forEach(pl => {
                    const opt = document.createElement('option');
                    opt.value = pl.id; opt.textContent = pl.name || pl.id; priceListSelect.appendChild(opt);
                });
                priceListSelect.value = this.builderState.priceListId;
                const pl = this.builderState.priceListId ? await db.load('priceLists', this.builderState.priceListId) : null;
                await this.loadBuilderCategoryOptions(pl);
                this.renderBuilderCategory('labour', 'quote-human');
                this.renderBuilderCategory('vehicles', 'quote-vehicles');
                this.renderBuilderCategory('materials', 'quote-materials');
                this.renderBuilderCategory('other', 'quote-other');
            }

            // Render recycling/rebates/other cost tables
            if (this.renderRecyclingTable) this.renderRecyclingTable();
            if (this.renderRebatesTable) this.renderRebatesTable();
            if (this.renderOtherCostsTable) this.renderOtherCostsTable();

            this.recalcBuilderTotals();
        } catch (e) {
            logError('openQuoteBuilderForEdit error:', e);
            uiModals.showToast('Failed to open Quote Builder', 'error');
        }
    }

    /**
     * @description Update PC dropdown based on client name or manual input prefix
     */
    async builderUpdatePcDropdown() {
        try {
            const client = document.getElementById('builder-client-name')?.value?.trim().toLowerCase() || '';
            const manual = document.getElementById('builder-pc-number-manual')?.value?.trim().toLowerCase() || '';
            const pcs = await db.loadAll('pcNumbers');
            let list = pcs;
            if (client) list = list.filter(pc => (pc.company||'').toLowerCase().includes(client));
            if (manual) list = list.filter(pc => (pc.pcNumber||'').toLowerCase().includes(manual));
            const sel = document.getElementById('builder-pc-select');
            if (!sel) return;
            sel.innerHTML = '<option value="">Select PC Number...</option>';
            list.forEach(pc => {
                const opt = document.createElement('option');
                opt.value = pc.id; opt.textContent = `${pc.pcNumber} — ${pc.company||''}`; sel.appendChild(opt);
            });
        } catch (e) { logError('builderUpdatePcDropdown error:', e); }
    }

    builderSelectPcFromDropdown = async () => {
        try {
            const sel = document.getElementById('builder-pc-select');
            const hint = document.getElementById('builder-pc-hint');
            const val = sel?.value || '';
            if (!val) { if (hint) hint.textContent = 'No PC selected'; this.builderContext.pcId = null; return; }
            const pc = await db.load('pcNumbers', val);
            // Validate before selecting
            const validation = this.validatePcForQuoteCreation(pc);
            if (!validation.isValid) {
                uiModals.showToast('Selected PC cannot be used. Missing: ' + validation.missingFields.join(', '), 'error');
                sel.value = '';
                if (hint) hint.textContent = 'No PC selected';
                this.builderContext.pcId = null;
                return;
            }
            this.builderContext.pcId = val;
            if (hint) hint.textContent = `Selected: ${pc.pcNumber} — ${pc.company||''}`;
            // Prefill client if empty
            const clientInput = document.getElementById('builder-client-name');
            if (clientInput && !clientInput.value) clientInput.value = pc.company || '';
            // Prefill collection address
            this.prefillCollectionFromPc(pc);
        } catch (e) { logError('builderSelectPcFromDropdown error:', e); }
    }

    builderValidatePcManual = async () => {
        try {
            const manualVal = document.getElementById('builder-pc-number-manual')?.value?.trim();
            const hint = document.getElementById('builder-pc-hint');
            if (!manualVal) { if (hint) hint.textContent='No PC selected'; return; }
            const pcs = await db.loadAll('pcNumbers');
            const match = pcs.find(pc => (pc.pcNumber||'').toLowerCase() === manualVal.toLowerCase());
            if (match) {
                // Validate
                const validation = this.validatePcForQuoteCreation(match);
                if (!validation.isValid) {
                    uiModals.showToast('Selected PC cannot be used. Missing: ' + validation.missingFields.join(', '), 'error');
                    if (hint) hint.textContent='No PC selected';
                    this.builderContext.pcId = null;
                    return;
                }
                this.builderContext.pcId = match.id;
                const sel = document.getElementById('builder-pc-select');
                if (sel) sel.value = match.id;
                if (hint) hint.textContent = `Matched: ${match.pcNumber} — ${match.company||''}`;
                const clientInput = document.getElementById('builder-client-name');
                if (clientInput && !clientInput.value) clientInput.value = match.company || '';
                this.prefillCollectionFromPc(match);
            } else {
                this.builderContext.pcId = null;
                if (hint) hint.textContent = 'PC not found';
            }
        } catch (e) { logError('builderValidatePcManual error:', e); }
    }

    /**
     * @description Prefill collection address from PC record
     */
    prefillCollectionFromPc(pc) {
        try {
            const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
            const contactName = [pc.contactFirstName, pc.contactLastName].filter(Boolean).join(' ').trim();
            set('quote-collection-name', contactName);
            set('quote-collection-phone', pc.contactPhone || '');
            set('quote-collection-email', pc.contactEmail || '');
            set('quote-collection-address1', pc.address1 || '');
            set('quote-collection-address2', pc.address2 || '');
            set('quote-collection-city', pc.address3 || '');
            set('quote-collection-county', pc.address4 || '');
            set('quote-collection-postcode', pc.addressPostcode || '');
        } catch (e) {
            logError('Failed to prefill collection from PC:', e);
        }
    }

    /**
     * @description Handle price list selection change in builder
     */
    async handlePriceListChange() {
        try {
            const select = document.getElementById('quote-price-list');
            const itemsSection = document.getElementById('quote-items-section');
            if (select && select.value) {
                if (itemsSection) itemsSection.style.display = '';
                // Load PL and build options per category
                const pl = await db.load('priceLists', select.value);
                this.builderState.priceListId = pl?.id || '';
                this.builderState.currency = pl?.currency || 'GBP';
                await this.loadBuilderCategoryOptions(pl);
                this.renderBuilderCategory('labour', 'quote-human');
                this.renderBuilderCategory('vehicles', 'quote-vehicles');
                this.renderBuilderCategory('materials', 'quote-materials');
                this.renderBuilderCategory('other', 'quote-other');
                
                // Phase 1: Initialize category tabs - default to 'human' tab
                this.switchCategoryTab('human');
                
                // Phase 3: Initialize section counts
                this.updateSectionCounts();
                
                this.recalcBuilderTotals();
            } else {
                if (itemsSection) itemsSection.style.display = 'none';
            }
        } catch (e) {
            logError('handlePriceListChange error:', e);
        }
    }

    /**
     * @description Build category options from Price List or fallback to Resources
     */
    async loadBuilderCategoryOptions(priceList) {
        const byCat = { labour: [], vehicles: [], materials: [], other: [] };
        try {
            const items = Array.isArray(priceList?.items) ? priceList.items : [];
            if (items.length > 0) {
                // Use price list items to build options
                const normalizeCategory = (val) => {
                    const v = String(val || '').toLowerCase();
                    if (v === 'material' || v === 'materials') return 'materials';
                    if (v === 'vehicle' || v === 'vehicles') return 'vehicles';
                    if (v === 'labour' || v === 'human' || v === 'human resources') return 'labour';
                    if (v === 'crates') return 'materials';
                    return ['labour','vehicles','materials','other'].includes(v) ? v : 'other';
                };
                const mapHourLabel = (rateType) => {
                    const map = { standard: 'Hour Standard', ot1: 'Hour OT1', ot2: 'Hour OT2', overnight: 'Hour Overnight' };
                    return map[String(rateType || 'standard').toLowerCase()] || 'Hour';
                };
                // Group items by resource name and category to avoid duplicates
                const resourceMap = new Map();
                
                items.forEach(it => {
                    const cat = normalizeCategory(it.resourceCategory || it.category || it.type || 'other');
                    const resourceName = it.resourceName || it.name || 'Item';
                    const unitLabel = (String(it.unit || '').toLowerCase() === 'hour') ? mapHourLabel(it.labourRateType) : (it.unit || 'unit');
                    const unitPrice = parseFloat(it.clientPrice ?? it.unitPrice ?? it.netCost ?? 0) || 0;
                    
                    const key = `${cat}-${resourceName}`;
                    
                    if (!resourceMap.has(key)) {
                        resourceMap.set(key, {
                            id: it.id || `${cat}-${resourceName}`,
                            name: resourceName,
                            category: cat,
                            units: new Map() // Map of unit -> price
                        });
                    }
                    
                    // Add this unit-price combination
                    resourceMap.get(key).units.set(unitLabel, unitPrice);
                });
                
                // Convert to final structure - each resource appears once but with all units stored
                resourceMap.forEach(resource => {
                    // For display in dropdown, we'll use the resource name only
                    // All units will be available in the units Map
                    byCat[resource.category].push({
                        id: resource.id,
                        name: resource.name,
                        units: resource.units, // Map of all available units with prices
                        // For backward compatibility, set default unit and price (first available)
                        unit: Array.from(resource.units.keys())[0] || 'unit',
                        unitPrice: Array.from(resource.units.values())[0] || 0
                    });
                });
            } else {
                // Fallback: use resources DB to compose options
                const resources = await db.loadAll('resources');
                resources.forEach(r => {
                    const category = (r.category || r.type || 'other').toLowerCase();
                    const cat = ['labour','vehicles','materials','other'].includes(category) ? category : 'other';
                    const unit = r.unit || (r.costPerHour ? 'hour' : r.costPerDay ? 'day' : 'unit');
                    const unitPrice = parseFloat(r.costPerUnit || r.costPerHour || r.costPerDay || 0) || 0;
                    byCat[cat].push({ id: r.id, name: r.name || r.id, unit, unitPrice });
                });
            }
        } catch (e) {
            logError('Failed to load category options:', e);
        }
        this.builderState.categoryOptions = byCat;
    }

    /**
     * @description Render UI for category add/select and list
     */
    renderBuilderCategory(category, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const tableId = `builder-${category}-table`;
        
        // Phase 1: Simplified rendering - just the table, no old controls
        container.innerHTML = `
            <table style="width:100%; border:1px solid #e5e7eb; border-radius:6px;">
                <thead><tr><th style="width:40%">Item</th><th>Unit</th><th>Qty</th><th>Unit Price</th><th>Line Total</th><th></th></tr></thead>
                <tbody id="${tableId}"></tbody>
            </table>
        `;
        
        // Render existing items of this category
        this.renderPlItemsTable(category, tableId);
    }

    addPlItemFromSelect(category, selectId, qtyId, tableId) {
        const sel = document.getElementById(selectId);
        const qtyEl = document.getElementById(qtyId);
        if (!sel || !qtyEl) return;
        const selectedId = sel.value;
        const opt = sel.selectedOptions[0];
        if (!opt || !opt.value) { uiModals.showToast('Please select an item first', 'warning'); return; }
        const name = opt?.textContent?.split(' — ')[0] || 'Item';
        const unit = opt?.dataset?.unit || 'unit';
        const unitPrice = parseFloat(opt?.dataset?.price || '0') || 0;
        const quantity = Math.max(0, Math.floor(parseFloat(qtyEl.value || '1') || 1));
        const id = `pli-${Date.now()}-${Math.floor(Math.random()*1000)}`;
        this.builderState.plItems.push({ id, category, name, unit, quantity, unitPrice, lineDiscount: 0, lineTotal: quantity * unitPrice, isManualPrice: false, manualPrice: unitPrice });
        this.renderPlItemsTable(category, tableId);
        this.recalcBuilderTotals();
    }

    renderPlItemsTable(category, tableId) {
        const tbody = document.getElementById(tableId);
        if (!tbody) return;
        const rows = this.builderState.plItems.filter(i => i.category === category).map(i => {
            const currentPrice = i.isManualPrice ? i.manualPrice : i.unitPrice;
            const priceStyle = i.isManualPrice ? 'background: #fef3c7; border: 1px solid #f59e0b;' : 'background: #f3f4f6;';
            return `
            <tr>
                <td>${i.name}</td>
                <td>${i.unit}</td>
                <td><input type="number" value="${i.quantity}" min="0" step="1" style="width:90px" onchange="window.app.updatePlItemQty('${i.id}', this.value)"></td>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <input type="number" value="${currentPrice.toFixed(2)}" step="0.01" min="0" 
                               style="width: 80px; ${priceStyle}" 
                               ${i.isManualPrice ? '' : 'readonly'} 
                               onchange="window.app.updatePlItemPrice('${i.id}', this.value)">
                        <label style="display: flex; align-items: center; font-size: 0.75rem; cursor: pointer;">
                            <input type="checkbox" ${i.isManualPrice ? 'checked' : ''} 
                                   onchange="window.app.togglePlItemManualPrice('${i.id}', this.checked)" 
                                   style="margin-right: 0.25rem; transform: scale(0.8);">
                            Manual
                        </label>
                    </div>
                </td>
                <td>£${(i.quantity * currentPrice).toFixed(2)}</td>
                <td><button class="danger small" onclick="window.app.removePlItem('${i.id}')">Remove</button></td>
            </tr>`;
        }).join('');
        tbody.innerHTML = rows || `<tr><td colspan="6" style="text-align:center; color:#6b7280;">No items added</td></tr>`;
    }

    updatePlItemQty(itemId, newQty) {
        const item = (this.builderState.plItems || []).find(x => x.id === itemId);
        if (!item) return;
        const q = Math.max(0, Math.floor(parseFloat(newQty || '0') || 0));
        item.quantity = q;
        const currentPrice = item.isManualPrice ? item.manualPrice : item.unitPrice;
        item.lineTotal = q * currentPrice;
        // Re-render category table
        const tableId = `builder-${item.category}-table`;
        this.renderPlItemsTable(item.category, tableId);
        this.recalcBuilderTotals();
    }

    // Phase 2: Manual price override for individual line items
    updatePlItemPrice(itemId, newPrice) {
        const item = (this.builderState.plItems || []).find(x => x.id === itemId);
        if (!item || !item.isManualPrice) return;
        
        const price = Math.max(0, parseFloat(newPrice || '0') || 0);
        item.manualPrice = price;
        item.lineTotal = item.quantity * price;
        
        // Re-render category table
        const tableId = `builder-${item.category}-table`;
        this.renderPlItemsTable(item.category, tableId);
        this.recalcBuilderTotals();
    }

    togglePlItemManualPrice(itemId, isManual) {
        const item = (this.builderState.plItems || []).find(x => x.id === itemId);
        if (!item) return;
        
        item.isManualPrice = isManual;
        if (!isManual) {
            // Reset to original price list price
            item.manualPrice = item.unitPrice;
        }
        
        const currentPrice = isManual ? item.manualPrice : item.unitPrice;
        item.lineTotal = item.quantity * currentPrice;
        
        // Re-render category table
        const tableId = `builder-${item.category}-table`;
        this.renderPlItemsTable(item.category, tableId);
        this.recalcBuilderTotals();
    }

    removePlItem(itemId) {
        const idx = (this.builderState.plItems || []).findIndex(x => x.id === itemId);
        if (idx >= 0) {
            const cat = this.builderState.plItems[idx].category;
            this.builderState.plItems.splice(idx, 1);
            this.renderPlItemsTable(cat, `builder-${cat}-table`);
            this.recalcBuilderTotals();
        }
    }

    // Phase 1: New functions for category tabs and unified add panel
    switchCategoryTab(category) {
        // Update tab styles
        document.querySelectorAll('.category-tab').forEach(tab => {
            tab.style.borderBottom = '2px solid transparent';
            tab.style.color = '#6b7280';
            tab.style.fontWeight = 'normal';
        });
        
        const activeTab = document.getElementById(`tab-${category}`);
        if (activeTab) {
            activeTab.style.borderBottom = '2px solid #3b82f6';
            activeTab.style.color = '#3b82f6';
            activeTab.style.fontWeight = '600';
        }

        // Show/hide category content
        document.querySelectorAll('.category-content').forEach(content => {
            content.style.display = 'none';
        });
        
        const activeContent = document.getElementById(`category-content-${category}`);
        if (activeContent) {
            activeContent.style.display = 'block';
        }

        // Update unified add panel for current category
        this.updateUnifiedAddPanel(category);
    }

    updateUnifiedAddPanel(category) {
        const resourceContainer = document.querySelector('#unified-add-panel .resource-select-container');
        if (!resourceContainer) return;

        // Map category names to match builderState.categoryOptions
        const categoryMap = {
            'human': 'labour',
            'vehicles': 'vehicles', 
            'materials': 'materials',
            'other': 'other'
        };
        
        const mappedCategory = categoryMap[category] || category;
        
        // For "Other" category, show free text field
        if (category === 'other') {
            resourceContainer.innerHTML = `
                <label style="display: block; margin-bottom: 0.25rem; font-weight: 500;">Resource Name</label>
                <input type="text" id="unified-resource-text" placeholder="Enter resource name..." style="width: 100%;">
            `;
        } else {
            // For other categories, show dropdown with options
            const options = this.builderState.categoryOptions[mappedCategory] || [];
            resourceContainer.innerHTML = `
                <label style="display: block; margin-bottom: 0.25rem; font-weight: 500;">Select Resource</label>
                <select id="unified-resource-select" style="width: 100%;" onchange="window.app && window.app.onUnifiedResourceChange && window.app.onUnifiedResourceChange()">
                    <option value="">Choose a resource...</option>
                    ${options.map(o => `<option value="${o.id}" data-unit="${o.unit}" data-price="${o.unitPrice}" data-category="${mappedCategory}">${o.name}</option>`).join('')}
                </select>
            `;
        }
        
        // Reset other fields
        document.getElementById('unified-quantity').value = '1';
        document.getElementById('unified-price').value = '';
        document.getElementById('unified-total').value = '';
        document.getElementById('unified-manual-price').checked = false;
        document.getElementById('unified-price').readOnly = true;
        document.getElementById('unified-price').style.background = '#f3f4f6';
        
        // Update unit dropdown for this category
        this.updateUnifiedUnitDropdown(mappedCategory);
    }

    // Phase 3: Update total price in real-time (Price × Quantity)
    updateUnifiedTotal() {
        const priceInput = document.getElementById('unified-price');
        const quantityInput = document.getElementById('unified-quantity');
        const totalInput = document.getElementById('unified-total');
        
        if (!priceInput || !quantityInput || !totalInput) return;
        
        const price = parseFloat(priceInput.value || '0') || 0;
        const quantity = Math.max(0, parseFloat(quantityInput.value || '1') || 1);
        const total = price * quantity;
        
        totalInput.value = total.toFixed(2);
        
        // Add visual feedback for non-zero totals
        if (total > 0) {
            totalInput.style.background = '#dcfce7';
            totalInput.style.borderColor = '#16a34a';
            totalInput.style.color = '#15803d';
        } else {
            totalInput.style.background = '#e0f2fe';
            totalInput.style.borderColor = '#0ea5e9';
            totalInput.style.color = '#0c4a6e';
        }
    }

    updateUnifiedUnitDropdown(category) {
        const unitSelect = document.getElementById('unified-unit-select');
        if (!unitSelect) return;

        // Get all unique units from price list items for this category
        const options = this.builderState.categoryOptions[category] || [];
        const units = [...new Set(options.map(o => o.unit))];
        
        unitSelect.innerHTML = '<option value="">Select unit...</option>' + 
            units.map(unit => `<option value="${unit}">${unit}</option>`).join('');
    }

    onUnifiedUnitChange() {
        const unitSelect = document.getElementById('unified-unit-select');
        const priceInput = document.getElementById('unified-price');
        
        if (!unitSelect || !priceInput) return;
        
        const selectedUnit = unitSelect.value;
        if (!selectedUnit) {
            priceInput.value = '';
            return;
        }
        
        // Check if we have a selected resource
        const resourceSelect = document.getElementById('unified-resource-select');
        if (resourceSelect && resourceSelect.value) {
            // Find the price for this resource and unit combination
            const selectedOption = resourceSelect.selectedOptions[0];
            if (selectedOption) {
                const category = selectedOption.dataset.category;
                const resourceId = selectedOption.value;
                
                // Find the specific unit price for this resource from the units Map
                const options = this.builderState.categoryOptions[category] || [];
                const selectedResource = options.find(o => o.id === resourceId);
                
                if (selectedResource && selectedResource.units && selectedResource.units.has(selectedUnit)) {
                    const unitPrice = selectedResource.units.get(selectedUnit);
                    priceInput.value = unitPrice.toFixed(2);
                } else {
                    priceInput.value = '';
                }
            }
        } else {
            // For "Other" category or when no resource selected, reset price
            priceInput.value = '';
        }
        
        // Reset manual override
        const manualCheckbox = document.getElementById('unified-manual-price');
        if (manualCheckbox) {
            manualCheckbox.checked = false;
            priceInput.readOnly = true;
            priceInput.style.background = '#f3f4f6';
        }
        
        // Update total price
        this.updateUnifiedTotal();
    }
    onUnifiedResourceChange() {
        const select = document.getElementById('unified-resource-select');
        const unitSelect = document.getElementById('unified-unit-select');
        const priceInput = document.getElementById('unified-price');
        const manualCheckbox = document.getElementById('unified-manual-price');
        
        if (!select || !priceInput) return;
        
        const selectedOption = select.selectedOptions[0];
        if (selectedOption && selectedOption.value) {
            // Update unit dropdown based on selected resource
            const category = selectedOption.dataset.category;
            const resourceId = selectedOption.value;
            const options = this.builderState.categoryOptions[category] || [];
            const selectedResource = options.find(o => o.id === resourceId);
            
            if (selectedResource && selectedResource.units && unitSelect) {
                // Get all units available for this resource
                const units = Array.from(selectedResource.units.keys());
                
                unitSelect.innerHTML = '<option value="">Select unit...</option>' + 
                    units.map(unit => `<option value="${unit}">${unit}</option>`).join('');
                
                // If only one unit available, auto-select it
                if (units.length === 1) {
                    unitSelect.value = units[0];
                    this.onUnifiedUnitChange();
                }
            }
        } else {
            // Reset unit dropdown to show all units for category
            const currentTab = document.querySelector('.category-tab.active');
            if (currentTab) {
                const category = currentTab.id.replace('tab-', '');
                const categoryMap = { 'human': 'labour', 'vehicles': 'vehicles', 'materials': 'materials', 'other': 'other' };
                const mappedCategory = categoryMap[category] || category;
                this.updateUnifiedUnitDropdown(mappedCategory);
            }
            priceInput.value = '';
        }
        
        // Reset manual override
        if (manualCheckbox) {
            manualCheckbox.checked = false;
            priceInput.readOnly = true;
            priceInput.style.background = '#f3f4f6';
        }
        
        // Update total price
        this.updateUnifiedTotal();
    }

    toggleManualPrice() {
        const checkbox = document.getElementById('unified-manual-price');
        const priceInput = document.getElementById('unified-price');
        
        if (!checkbox || !priceInput) return;
        
        if (checkbox.checked) {
            priceInput.readOnly = false;
            priceInput.style.background = 'white';
            priceInput.focus();
        } else {
            priceInput.readOnly = true;
            priceInput.style.background = '#f3f4f6';
            // Reset to original price
            this.onUnifiedResourceChange();
        }
        
        // Update total price when manual override is toggled
        this.updateUnifiedTotal();
    }

    addFromUnifiedPanel() {
        const quantityInput = document.getElementById('unified-quantity');
        const priceInput = document.getElementById('unified-price');
        const unitSelect = document.getElementById('unified-unit-select');
        
        if (!quantityInput || !priceInput || !unitSelect) return;
        
        // Get current active category
        const currentTab = document.querySelector('.category-tab.active');
        if (!currentTab) return;
        
        const category = currentTab.id.replace('tab-', '');
        const categoryMap = { 'human': 'labour', 'vehicles': 'vehicles', 'materials': 'materials', 'other': 'other' };
        const mappedCategory = categoryMap[category] || category;
        
        let name = '';
        let originalUnitPrice = 0;
        
        // Handle different resource selection methods
        if (category === 'other') {
            // For "Other" category, get name from text input
            const textInput = document.getElementById('unified-resource-text');
            if (!textInput || !textInput.value.trim()) {
                uiModals.showToast('Please enter a resource name', 'warning');
                return;
            }
            name = textInput.value.trim();
        } else {
            // For other categories, get name from dropdown
            const select = document.getElementById('unified-resource-select');
            if (!select || !select.value) {
                uiModals.showToast('Please select a resource first', 'warning');
                return;
            }
            const selectedOption = select.selectedOptions[0];
            name = selectedOption.textContent;
            
            // Find the original price for this resource and unit from the units Map
            const resourceId = selectedOption.value;
            const options = this.builderState.categoryOptions[mappedCategory] || [];
            const selectedResource = options.find(o => o.id === resourceId);
            
            if (selectedResource && selectedResource.units && selectedResource.units.has(unitSelect.value)) {
                originalUnitPrice = selectedResource.units.get(unitSelect.value);
            } else {
                originalUnitPrice = 0;
            }
        }
        
        // Validate unit selection
        if (!unitSelect.value) {
            uiModals.showToast('Please select a unit type', 'warning');
            return;
        }
        
        const unit = unitSelect.value;
        const quantity = Math.max(1, Math.floor(parseFloat(quantityInput.value || '1') || 1));
        const unitPrice = parseFloat(priceInput.value || '0') || 0;
        
        if (unitPrice <= 0) {
            uiModals.showToast('Please enter a valid price', 'warning');
            return;
        }
        
        const id = `pli-${Date.now()}-${Math.floor(Math.random()*1000)}`;
        const isManualPrice = document.getElementById('unified-manual-price').checked;
        
        this.builderState.plItems.push({ 
            id, 
            category: mappedCategory, 
            name, 
            unit, 
            quantity, 
            unitPrice: isManualPrice ? unitPrice : originalUnitPrice, 
            lineDiscount: 0, 
            lineTotal: quantity * unitPrice,
            isManualPrice: isManualPrice,
            manualPrice: unitPrice
        });
        
        // Re-render the current category table
        const tableId = `builder-${mappedCategory}-table`;
        this.renderPlItemsTable(mappedCategory, tableId);
        this.recalcBuilderTotals();
        
        // Phase 3: Highlight new row
        this.highlightNewRow(tableId, id);
        
        // Reset form
        if (category === 'other') {
            document.getElementById('unified-resource-text').value = '';
        } else {
            document.getElementById('unified-resource-select').value = '';
        }
        quantityInput.value = '1';
        unitSelect.value = '';
        priceInput.value = '';
        document.getElementById('unified-total').value = '';
        document.getElementById('unified-manual-price').checked = false;
        priceInput.readOnly = true;
        priceInput.style.background = '#f3f4f6';
        
        // Phase 2: Check for consolidation of duplicates
        this.consolidateDuplicateItems();
        
        uiModals.showToast('Item added to quote', 'success');
    }

    // Phase 3: Collapsible sections functionality
    toggleSection(sectionName) {
        const content = document.getElementById(`${sectionName}-content`);
        const toggle = document.getElementById(`${sectionName}-toggle`);
        
        if (!content || !toggle) return;
        
        const isVisible = content.style.display !== 'none';
        
        if (isVisible) {
            content.style.display = 'none';
            toggle.textContent = '▶';
            toggle.style.transform = 'rotate(0deg)';
        } else {
            content.style.display = 'block';
            toggle.textContent = '▼';
            toggle.style.transform = 'rotate(0deg)';
        }
        
        // Add smooth transition effect
        content.style.transition = 'all 0.3s ease-in-out';
    }

    // Phase 3: Update section item counts
    updateSectionCounts() {
        // Update recycling count
        const recyclingCount = (this.builderState.recyclingItems || []).length;
        const recyclingCountEl = document.getElementById('recycling-count');
        if (recyclingCountEl) {
            recyclingCountEl.textContent = `${recyclingCount} ${recyclingCount === 1 ? 'item' : 'items'}`;
        }

        // Update rebates count
        const rebatesCount = (this.builderState.rebateItems || []).length;
        const rebatesCountEl = document.getElementById('rebates-count');
        if (rebatesCountEl) {
            rebatesCountEl.textContent = `${rebatesCount} ${rebatesCount === 1 ? 'item' : 'items'}`;
        }

        // Update other costs count
        const otherCostsCount = (this.builderState.otherCosts || []).length;
        const otherCostsCountEl = document.getElementById('othercosts-count');
        if (otherCostsCountEl) {
            otherCostsCountEl.textContent = `${otherCostsCount} ${otherCostsCount === 1 ? 'item' : 'items'}`;
        }
    }

    // Phase 3: Highlight new row with animation
    highlightNewRow(tableId, itemId) {
        setTimeout(() => {
            const table = document.getElementById(tableId);
            if (!table) return;
            
            // Find the row with data for this item (look for the remove button with itemId)
            const rows = table.querySelectorAll('tbody tr');
            let targetRow = null;
            
            rows.forEach(row => {
                const removeButton = row.querySelector(`button[onclick*="${itemId}"]`);
                if (removeButton) {
                    targetRow = row;
                }
            });
            
            if (targetRow) {
                // Add highlight effect
                targetRow.style.backgroundColor = '#dcfce7';
                targetRow.style.border = '2px solid #16a34a';
                targetRow.style.transform = 'scale(1.02)';
                targetRow.style.transition = 'all 0.3s ease-in-out';
                targetRow.style.boxShadow = '0 4px 12px rgba(22, 163, 74, 0.3)';
                
                // Remove highlight after 2 seconds
                setTimeout(() => {
                    targetRow.style.backgroundColor = '';
                    targetRow.style.border = '';
                    targetRow.style.transform = '';
                    targetRow.style.boxShadow = '';
                    
                    // Remove transition after animation completes
                    setTimeout(() => {
                        targetRow.style.transition = '';
                    }, 300);
                }, 2000);
            }
        }, 100); // Small delay to ensure row is rendered
    }

    // Phase 2: Consolidate duplicate items (same name, unit, price, category)
    consolidateDuplicateItems() {
        const itemsToRemove = [];
        const processedItems = new Set();
        
        for (let i = 0; i < this.builderState.plItems.length; i++) {
            const item = this.builderState.plItems[i];
            if (processedItems.has(item.id)) continue;
            
            const currentPrice = item.isManualPrice ? item.manualPrice : item.unitPrice;
            const duplicates = [];
            
            // Find all duplicates of this item
            for (let j = i + 1; j < this.builderState.plItems.length; j++) {
                const otherItem = this.builderState.plItems[j];
                if (processedItems.has(otherItem.id)) continue;
                
                const otherPrice = otherItem.isManualPrice ? otherItem.manualPrice : otherItem.unitPrice;
                
                // Check if items are identical (same name, unit, price, category, manual price status)
                if (item.name === otherItem.name && 
                    item.unit === otherItem.unit && 
                    item.category === otherItem.category &&
                    Math.abs(currentPrice - otherPrice) < 0.01 && // Price comparison with tolerance
                    item.isManualPrice === otherItem.isManualPrice) {
                    
                    duplicates.push(otherItem);
                    processedItems.add(otherItem.id);
                }
            }
            
            // If duplicates found, consolidate them
            if (duplicates.length > 0) {
                const totalQuantity = item.quantity + duplicates.reduce((sum, dup) => sum + dup.quantity, 0);
                item.quantity = totalQuantity;
                item.lineTotal = totalQuantity * currentPrice;
                
                // Mark duplicates for removal
                duplicates.forEach(dup => itemsToRemove.push(dup.id));
                
                // Show consolidation message
                if (duplicates.length > 0) {
                    uiModals.showToast(`Consolidated ${duplicates.length + 1} identical items: ${item.name}`, 'info');
                }
            }
            
            processedItems.add(item.id);
        }
        
        // Remove duplicate items
        itemsToRemove.forEach(id => {
            const idx = this.builderState.plItems.findIndex(item => item.id === id);
            if (idx >= 0) {
                this.builderState.plItems.splice(idx, 1);
            }
        });
        
        // Re-render all category tables if consolidation occurred
        if (itemsToRemove.length > 0) {
            this.renderBuilderCategory('labour', 'quote-human');
            this.renderBuilderCategory('vehicles', 'quote-vehicles');
            this.renderBuilderCategory('materials', 'quote-materials');
            this.renderBuilderCategory('other', 'quote-other');
        }
    }

    recalcBuilderTotals() {
        const sumCat = cat => (this.builderState.plItems || []).filter(i => i.category === cat).reduce((a,b)=>{
            const currentPrice = b.isManualPrice ? b.manualPrice : b.unitPrice;
            return a + (b.quantity * currentPrice);
        }, 0);
        const human = sumCat('labour');
        const vehicles = sumCat('vehicles');
        const materials = sumCat('materials');
        const other = sumCat('other');
        const subtotal = human + vehicles + materials + other;

        // Discount from UI
        const typeEl = document.getElementById('quote-discount-type');
        const valEl = document.getElementById('quote-discount-value');
        let discountAmount = 0;
        if (typeEl && valEl) {
            const t = typeEl.value || 'percent';
            const v = parseFloat(valEl.value || '0') || 0;
            if (t === 'percent') discountAmount = Math.min(100, Math.max(0, v)) * subtotal / 100;
            else discountAmount = Math.min(subtotal, Math.max(0, v));
        }
        // Non-discount sections
        const recycling = (this.builderState.recyclingItems||[]).reduce((a,b)=>a+(b.amount||0),0);
        const otherManual = (this.builderState.otherCosts||[]).reduce((a,b)=>a+(b.amount||0),0);
        const rebates = (this.builderState.rebateItems||[]).reduce((a,b)=>a+(b.amount||0),0); // negative values expected

        const netAfterDiscount = Math.max(0, subtotal - discountAmount) + recycling + otherManual + rebates;
        const vatRate = parseFloat(document.getElementById('quote-vat-rate')?.value || `${this.builderState.vatRate}`) || 20;
        const vat = netAfterDiscount * vatRate / 100;
        const total = netAfterDiscount + vat;

        const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = `£${val.toFixed(2)}`; };
        setText('sum-human', human);
        setText('sum-vehicles', vehicles);
        setText('sum-materials', materials);
        setText('sum-other', other);
        setText('sum-subtotal', subtotal);
        setText('sum-discount', discountAmount);
        setText('sum-net', netAfterDiscount);
        const setTextPlain = (id, val) => { const el=document.getElementById(id); if (el) el.textContent = `£${val.toFixed(2)}`; };
        setTextPlain('sum-recycling', recycling);
        setTextPlain('sum-other-manual', otherManual);
        setTextPlain('sum-rebates', rebates);
        setText('sum-vat', vat);
        setText('sum-total', total);
    }

    // Recycling
    addRecyclingItem() {
        try {
            const type = document.getElementById('recycling-type')?.value || 'general';
            const mode = document.getElementById('recycling-mode')?.value || 'byWeight';
            let amount = 0; let details = '';
            if (mode === 'byWeight') {
                const kg = parseFloat(document.getElementById('recycling-weight')?.value || '0')||0;
                const rate = parseFloat(document.getElementById('recycling-rate')?.value || '0')||0;
                amount = kg * (rate/1000); details = `${kg} kg @ £${rate}/t`;
            } else {
                amount = parseFloat(document.getElementById('recycling-amount')?.value || '0')||0;
                details = `Manual`;
            }
            const id = `rc-${Date.now()}`;
            this.builderState.recyclingItems.push({ id, type, mode, amount, details });
            this.renderRecyclingTable();
            this.recalcBuilderTotals();
        } catch(e){ logError('addRecyclingItem error:', e); }
    }
    renderRecyclingTable() {
        const tbody = document.getElementById('recycling-table'); if (!tbody) return;
        tbody.innerHTML = (this.builderState.recyclingItems||[]).map(x=>`
            <tr>
                <td>${x.type}</td><td>${x.mode}</td><td>${x.details||''}</td>
                <td>£${(x.amount||0).toFixed(2)}</td>
                <td><button class="danger small" onclick="window.app.removeRecyclingItem('${x.id}')">Remove</button></td>
            </tr>`).join('') || `<tr><td colspan="5" style="text-align:center; color:#6b7280;">No recycling items</td></tr>`;
        this.updateSectionCounts();
    }
    removeRecyclingItem(id) {
        const i=(this.builderState.recyclingItems||[]).findIndex(r=>r.id===id); if(i>=0){this.builderState.recyclingItems.splice(i,1);this.renderRecyclingTable();this.recalcBuilderTotals();}
    }

    // Rebates
    addRebateItem() {
        try {
            const type = document.getElementById('rebate-type')?.value || 'furniture';
            let mode = 'manual';
            let amount = 0; let details='';
            if (type==='furniture') {
                mode = 'manual';
                details = (document.getElementById('rebate-desc')?.value || '').trim();
                amount = parseFloat(document.getElementById('rebate-amount')?.value || '0')||0;
            } else {
                mode = document.getElementById('rebate-mode')?.value || 'manual';
                if (mode==='byWeight') {
                    const kg = parseFloat(document.getElementById('rebate-weight')?.value || '0')||0;
                    const rate = parseFloat(document.getElementById('rebate-rate')?.value || '0')||0;
                    amount = -(kg * (rate/1000)); details = `${kg} kg @ £${rate}/t`;
                } else {
                    amount = -Math.abs(parseFloat(document.getElementById('rebate-amount')?.value || '0')||0);
                    details = 'Manual';
                }
            }
            const id = `rb-${Date.now()}`;
            this.builderState.rebateItems.push({ id, type, mode, amount, details });
            this.renderRebatesTable();
            this.recalcBuilderTotals();
        } catch(e){ logError('addRebateItem error:', e); }
    }
    renderRebatesTable() {
        const tbody = document.getElementById('rebates-table'); if (!tbody) return;
        tbody.innerHTML = (this.builderState.rebateItems||[]).map(x=>`
            <tr>
                <td>${x.type}</td><td>${x.mode}</td><td>${x.details||''}</td>
                <td>£${(x.amount||0).toFixed(2)}</td>
                <td><button class="danger small" onclick="window.app.removeRebateItem('${x.id}')">Remove</button></td>
            </tr>`).join('') || `<tr><td colspan="5" style="text-align:center; color:#6b7280;">No rebates</td></tr>`;
        this.updateSectionCounts();
    }
    removeRebateItem(id) {
        const i=(this.builderState.rebateItems||[]).findIndex(r=>r.id===id); if(i>=0){this.builderState.rebateItems.splice(i,1);this.renderRebatesTable();this.recalcBuilderTotals();}
    }

    // Other Costs (Manual)
    addOtherCostManual() {
        try {
            const desc=(document.getElementById('other-desc')?.value||'').trim();
            const amount=parseFloat(document.getElementById('other-amount')?.value||'0')||0;
            if(!desc){uiModals.showToast('Please enter description for other cost','error');return;}
            const id = `oc-${Date.now()}`;
            this.builderState.otherCosts.push({ id, description: desc, amount });
            this.renderOtherCostsTable();
            this.recalcBuilderTotals();
        } catch(e){ logError('addOtherCostManual error:', e); }
    }
    renderOtherCostsTable() {
        const tbody=document.getElementById('othercosts-table'); if(!tbody) return;
        tbody.innerHTML=(this.builderState.otherCosts||[]).map(x=>`
            <tr>
                <td>${x.description}</td>
                <td>£${(x.amount||0).toFixed(2)}</td>
                <td><button class="danger small" onclick="window.app.removeOtherCost('${x.id}')">Remove</button></td>
            </tr>`).join('') || `<tr><td colspan="3" style="text-align:center; color:#6b7280;">No other costs</td></tr>`;
        this.updateSectionCounts();
    }
    removeOtherCost(id){
        const i=(this.builderState.otherCosts||[]).findIndex(r=>r.id===id); if(i>=0){this.builderState.otherCosts.splice(i,1);this.renderOtherCostsTable();this.recalcBuilderTotals();}
    }

    /**
     * @description Toggle address sections visibility based on move type
     */
    toggleAddressSections() {
        const moveType = document.getElementById('quote-move-type')?.value || '';
        const col = document.getElementById('collection-section');
        const del = document.getElementById('delivery-section');
        if (!col || !del) return;
        if (moveType === 'Collection Only') { col.style.display = ''; del.style.display = 'none'; }
        else if (moveType === 'Delivery Only') { col.style.display = 'none'; del.style.display = ''; }
        else if (moveType === 'Collection + Delivery') { col.style.display = ''; del.style.display = ''; }
        else { col.style.display = 'none'; del.style.display = 'none'; }
    }

    /**
     * @description Copy collection address to delivery
     */
    copyCollectionToDelivery() {
        const checked = document.getElementById('quote-same-address')?.checked;
        if (!checked) return;
        const copy = (src, dst) => {
            const s = document.getElementById(src); const d = document.getElementById(dst);
            if (s && d) d.value = s.value;
        };
        copy('quote-collection-name', 'quote-delivery-name');
        copy('quote-collection-phone', 'quote-delivery-phone');
        copy('quote-collection-email', 'quote-delivery-email');
        copy('quote-collection-address1', 'quote-delivery-address1');
        copy('quote-collection-address2', 'quote-delivery-address2');
        copy('quote-collection-city', 'quote-delivery-city');
        copy('quote-collection-county', 'quote-delivery-county');
        copy('quote-collection-postcode', 'quote-delivery-postcode');
    }
    /**
     * @description Save Quote from full-screen builder as Draft
     */
    async saveQuoteFromBuilder() {
        try {
            // Generate quote number
            const quotes = await db.loadAll('quotes');
            const nextNumber = String(quotes.length + 1).padStart(6, '0');
            const quoteNumber = `QT-${nextNumber}`;

            // Read basic fields
            const priceListId = document.getElementById('quote-price-list')?.value || '';
            const vatRateStr = document.getElementById('quote-vat-rate')?.value || '20';
            const vatRate = Math.max(0, Math.min(100, parseFloat(vatRateStr) || 20));

            // Addresses
            const readAddr = (prefix) => ({
                contactName: document.getElementById(`${prefix}-name`)?.value || '',
                phone: document.getElementById(`${prefix}-phone`)?.value || '',
                email: document.getElementById(`${prefix}-email`)?.value || '',
                date: document.getElementById(`${prefix}-date`)?.value || '',
                address1: document.getElementById(`${prefix}-address1`)?.value || '',
                address2: document.getElementById(`${prefix}-address2`)?.value || '',
                city: document.getElementById(`${prefix}-city`)?.value || '',
                county: document.getElementById(`${prefix}-county`)?.value || '',
                postcode: document.getElementById(`${prefix}-postcode`)?.value || '',
            });
            const collectionAddress = readAddr('quote-collection');
            const deliveryAddress = readAddr('quote-delivery');

            // Currency from price list (if selected)
            let currency = 'GBP';
            if (priceListId) {
                const pl = await db.load('priceLists', priceListId);
                if (pl?.currency) currency = pl.currency;
            }

            // Optional PC linkage
            const pcId = this.builderContext.pcId || null;
            let pcNumber = '';
            if (pcId) {
                const pc = await db.load('pcNumbers', pcId);
                pcNumber = pc?.pcNumber || '';
            }

            const now = new Date().toISOString();
            // Client & AM
            const clientName = document.getElementById('builder-client-name')?.value || '';
            const accountManager = document.getElementById('builder-account-manager')?.value || '';
            const propertyType = document.getElementById('builder-property-type')?.value || '';

            // Compute financial snapshot
            const sumCat = cat => (this.builderState.plItems || []).filter(i => i.category === cat).reduce((a,b)=>a+(b.quantity*b.unitPrice),0);
            const subtotalPL = sumCat('labour') + sumCat('vehicles') + sumCat('materials') + sumCat('other');
            const discTypeEl = document.getElementById('quote-discount-type');
            const discValEl = document.getElementById('quote-discount-value');
            const discountType = discTypeEl ? discTypeEl.value : 'percent';
            const discountValue = discValEl ? parseFloat(discValEl.value || '0') || 0 : 0;
            let discountAmount = 0;
            if (discountType === 'percent') discountAmount = Math.min(100, Math.max(0, discountValue)) * subtotalPL / 100;
            else discountAmount = Math.min(subtotalPL, Math.max(0, discountValue));
            const recyclingTotal = (this.builderState.recyclingItems||[]).reduce((a,b)=>a+(b.amount||0),0);
            const otherCostsTotal = (this.builderState.otherCosts||[]).reduce((a,b)=>a+(b.amount||0),0);
            const rebatesTotal = (this.builderState.rebateItems||[]).reduce((a,b)=>a+(b.amount||0),0);
            const netAfterDiscount = Math.max(0, subtotalPL - discountAmount) + recyclingTotal + otherCostsTotal + rebatesTotal;
            const vatRateEffective = Math.max(0, Math.min(100, vatRate));
            const vatAmount = netAfterDiscount * vatRateEffective / 100;
            const totalCost = netAfterDiscount + vatAmount;

            const editingId = this.builderContext.editingQuoteId || null;
            const baseId = editingId || `quote-${Date.now()}`;
            const baseNumber = editingId ? (await db.load('quotes', editingId))?.quoteNumber || quoteNumber : quoteNumber;
            const draft = {
                id: baseId,
                quoteNumber: baseNumber,
                status: (editingId ? (await db.load('quotes', editingId))?.status || 'draft' : 'draft'),
                priceListId,
                vatRate,
                currency,
                pcId: pcId || undefined,
                pcNumber,
                clientName,
                accountManager,
                propertyType,
                bulkProvisionalValue: null,
                itemsPriceList: this.builderState.plItems || [],
                recyclingItems: this.builderState.recyclingItems || [],
                rebateItems: this.builderState.rebateItems || [],
                otherCostsManual: this.builderState.otherCosts || [],
                discount: { type: discountType, value: discountValue, amount: discountAmount },
                collectionAddress,
                deliveryAddress,
                // Snapshot totals for detail view
                subtotalPL,
                recyclingTotal,
                rebatesTotal,
                otherCostsTotal,
                netTotal: netAfterDiscount,
                vatAmount,
                totalCost,
                totalAmount: totalCost,
                createdAt: now,
                lastModifiedAt: now,
                createdBy: this.currentUser || 'User',
                editedBy: this.currentUser || 'User'
            };

            await db.save('quotes', draft);
            uiModals.showToast(`Draft ${quoteNumber} saved`, 'success');

            // Go to quotes list
            await this.navigateToPage('quotes');
            await this.loadQuotesData();

        } catch (e) {
            logError('Failed to save draft from builder:', e);
            uiModals.showToast('Failed to save draft', 'error');
        }
    }

    /**
     * @description Validate and send quote to customer (status: pending)
     */
    async sendQuoteFromBuilder() {
        try {
            const plId = document.getElementById('quote-price-list')?.value;
            const clientName = document.getElementById('builder-client-name')?.value?.trim();
            const accountManager = document.getElementById('builder-account-manager')?.value?.trim();
            const cPost = document.getElementById('quote-collection-postcode')?.value?.trim();
            const dPost = document.getElementById('quote-delivery-postcode')?.value?.trim();
            if (!clientName || !accountManager || !plId || !cPost || !dPost) {
                uiModals.showToast('Please fill in Client, Account Manager, Price List, and both postcodes', 'error');
                return;
            }
            this.recalcBuilderTotals();
            const totalStr = document.getElementById('sum-total')?.textContent || '£0.00';
            const total = parseFloat(totalStr.replace(/[^0-9\.\-]/g,''))||0;
            if (total <= 0) {
                uiModals.showToast('Total must be greater than 0 to send to customer', 'error');
                return;
            }

            // Save
            await this.saveQuoteFromBuilder();
            // Set status to pending on the correct record
            const editingId = this.builderContext.editingQuoteId || null;
            if (editingId) {
                const q = await db.load('quotes', editingId);
                if (q) { q.status = 'pending'; q.lastModifiedAt = new Date().toISOString(); await db.save('quotes', q); }
            } else {
                const quotes = await db.loadAll('quotes');
                const latest = quotes.sort((a,b)=> (b.createdAt||'').localeCompare(a.createdAt||''))[0];
                if (latest) { latest.status = 'pending'; latest.lastModifiedAt = new Date().toISOString(); await db.save('quotes', latest); }
            }
            uiModals.showToast('Quote sent to customer (awaiting approval)', 'success');
            await this.navigateToPage('quotes');
            await this.loadQuotesData();
        } catch (e) {
            logError('sendQuoteFromBuilder error:', e);
            uiModals.showToast('Failed to send quote', 'error');
        }
    }

    /**
     * @description Initialize the application
     */
    async initialize() {
        const initTimeout = setTimeout(() => {
            logError('Application initialization timed out');
            this.hideLoadingOverlay();
        }, 30000);

        try {
            logInfo('🚀 Initializing CRM Application...');
            this.showLoadingOverlay('Initializing application...');
            
            this.updateProgress(20, 'Connecting to database...');
            await this.initializeDatabase();
            
            this.updateProgress(50, 'Setting up user interface...');
            this.setupUI();
            
            this.updateProgress(75, 'Setting up event listeners...');
            this.setupEventListeners();
            
            this.updateProgress(90, 'Finalizing setup...');
            await this.navigateToPage(this.currentPage);

            this.updateProgress(100, 'Ready!');
            
            this.initialized = true;
            clearTimeout(initTimeout);
            setTimeout(() => this.hideLoadingOverlay(), 1000);
            
            logInfo('✅ CRM Application initialized successfully');

        } catch (error) {
            clearTimeout(initTimeout);
            logError('❌ Failed to initialize CRM application:', error);
            this.hideLoadingOverlay();
            throw error;
        }
    }

    /**
     * @description Initialize database
     */
    async initializeDatabase() {
        try {
            logDebug('🔵 Starting database initialization...');
            await db.initialize();
            logDebug('🔵 Database initialization completed');
            
            // Load sample data if database is empty
            await this.loadSampleDataIfNeeded();

            // Migrate existing PC Numbers to the new schema
            if (typeof this.migratePcNumbersToNewSchema === 'function') {
                await this.migratePcNumbersToNewSchema();
            }
        } catch (error) {
            // Friendly guidance if blocked/version issues
            if (String(error).toLowerCase().includes('version') || String(error).toLowerCase().includes('blocked')) {
                uiModals.showToast('App is open in another tab. Please close other tabs and reload.', 'warning', 10000);
            }
            logError('Database initialization failed:', error);
            throw error;
        }
    }
    
    /**
     * @description Load sample data if database is empty
     */
    async loadSampleDataIfNeeded() {
        try {
            const stats = await db.getStats();
            console.log('🔍 Database stats:', stats);
            
            // Check if quotes exist and have proper totalAmount
            const quotes = await db.loadAll('quotes');
            console.log('🔍 Existing quotes in database:', quotes.length, 'quotes');
            
            let needsReload = false;
            if (stats.pcNumbers === 0 || quotes.length === 0) {
                console.log('🔵 Database is empty, loading sample data...');
                needsReload = true;
            } else {
                // Check if quotes have totalAmount field
                const hasValidAmounts = quotes.every(quote => quote.totalAmount && quote.totalAmount > 0);
                console.log('🔍 Quotes have valid totalAmount:', hasValidAmounts);
                
                quotes.forEach(quote => {
                    console.log(`🔍 Quote ${quote.id}: totalAmount=${quote.totalAmount}, clientName=${quote.clientName}`);
                });
                
                if (!hasValidAmounts) {
                    console.log('🔵 Quotes missing totalAmount, clearing database and reloading...');
                    // Clear quotes store and reload sample data
                    await db.clearStore('quotes');
                    needsReload = true;
                }
            }
            
            if (needsReload) {
                await this.loadSampleData();
            } else {
                console.log('🔍 Database contains valid data, skipping sample data load');
            }
        } catch (error) {
            console.error('❌ Failed to check/load sample data:', error);
        }
    }
    /**
     * @description Load sample data
     */
    async loadSampleData() {
        try {
            logInfo('Loading sample data...');
            
            // Load basic sample PC Numbers
            const samplePCNumbers = [
                {
                    id: 'pc-1',
                    pcNumber: 'PC-000001',
                    company: 'Fintech Innovations Ltd',
                    projectTitle: 'Complete Office Relocation - City to Canary Wharf',
                    projectDescription: 'Full office relocation for 85 staff',
                    accountManager: 'John Smith',
                    clientName: 'Fintech Innovations Ltd',
                    contactName: 'James Morrison',
                    contactEmail: 'james.morrison@fintech-innovations.co.uk',
                    contactPhone: '+44 20 7946 0958',
                    estimatedValue: 45000,
                    status: 'active',
                    createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
                    lastModifiedAt: new Date().toISOString(),
                    createdBy: 'Slav',
                    editedBy: 'Slav'
                },
                {
                    id: 'pc-2',
                    pcNumber: 'PC-000002',
                    company: 'Chambers & Associates',
                    projectTitle: 'Law Firm Relocation - Fleet Street to Temple',
                    projectDescription: 'Traditional law firm moving offices',
                    accountManager: 'Sarah Johnson',
                    clientName: 'Chambers & Associates',
                    contactName: 'Victoria Chambers',
                    contactEmail: 'v.chambers@chamberslaw.co.uk',
                    contactPhone: '+44 20 7353 2468',
                    estimatedValue: 28000,
                    status: 'active',
                    createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
                    lastModifiedAt: new Date().toISOString(),
                    createdBy: 'Rob',
                    editedBy: 'Rob'
                },
                {
                    id: 'pc-3',
                    pcNumber: 'PC-000003',
                    company: 'TechStart Solutions',
                    projectTitle: 'Startup Office Setup - Shoreditch Hub',
                    projectDescription: 'New tech startup office setup',
                    accountManager: 'Mike Wilson',
                    clientName: 'TechStart Solutions',
                    contactName: 'Alex Chen',
                    contactEmail: 'alex@techstart.io',
                    contactPhone: '+44 20 7739 1234',
                    estimatedValue: 15000,
                    status: 'pending',
                    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
                    lastModifiedAt: new Date().toISOString(),
                    createdBy: 'Kayleigh',
                    editedBy: 'Kayleigh'
                }
            ];
            
            // Load sample quotes
            const sampleQuotes = [
                {
                    id: 'quote-1',
                    quoteNumber: 'QT-000001',
                    pcId: 'pc-1',
                    pcNumber: 'PC-000001',
                    clientName: 'Fintech Innovations Ltd',
                    accountManager: 'John Smith',
                    totalAmount: 42500,
                    status: 'approved',
                    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
                    lastModifiedAt: new Date().toISOString(),
                    createdBy: 'Slav',
                    editedBy: 'Slav',
                    items: []
                },
                {
                    id: 'quote-2',
                    quoteNumber: 'QT-000002',
                    pcId: 'pc-2',
                    pcNumber: 'PC-000002',
                    clientName: 'Chambers & Associates',
                    accountManager: 'Sarah Johnson',
                    totalAmount: 26800,
                    status: 'pending',
                    createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
                    lastModifiedAt: new Date().toISOString(),
                    createdBy: 'Rob',
                    editedBy: 'Rob',
                    items: []
                }
            ];
            
            // Load sample activities
            const sampleActivities = [
                {
                    id: 'activity-1',
                    title: 'Initial Site Survey',
                    type: 'Survey',
                    pcId: 'pc-1',
                    pcNumber: 'PC-000001',
                    scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
                    duration: 120,
                    status: 'scheduled',
                    priority: 'high',
                    assignedTo: 'Marcus Thompson',
                    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
                    lastModifiedAt: new Date().toISOString(),
                    createdBy: 'Slav',
                    editedBy: 'Slav'
                },
                {
                    id: 'activity-2',
                    title: 'Pre-move Consultation',
                    type: 'Meeting',
                    pcId: 'pc-2',
                    pcNumber: 'PC-000002',
                    scheduledDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
                    duration: 90,
                    status: 'scheduled',
                    priority: 'medium',
                    assignedTo: 'Victoria Chambers',
                    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
                    lastModifiedAt: new Date().toISOString(),
                    createdBy: 'Rob',
                    editedBy: 'Rob'
                }
            ];
            
            // Load sample resources
            const sampleResources = [
                {
                    id: 'resource-1',
                    name: 'Office Fitter',
                    category: 'labour',
                    type: 'labour',
                    costPerHour: 35,
                    unit: 'hour',
                    status: 'available',
                    createdAt: new Date().toISOString(),
                    lastModifiedAt: new Date().toISOString(),
                    createdBy: 'Slav',
                    editedBy: 'Slav'
                },
                {
                    id: 'resource-2',
                    name: 'HGV Driver',
                    category: 'labour',
                    type: 'labour',
                    costPerHour: 28,
                    unit: 'hour',
                    status: 'available',
                    createdAt: new Date().toISOString(),
                    lastModifiedAt: new Date().toISOString(),
                    createdBy: 'Slav',
                    editedBy: 'Slav'
                },
                {
                    id: 'resource-3',
                    name: 'Moving Van (7.5T)',
                    category: 'vehicles',
                    type: 'vehicles',
                    costPerDay: 180,
                    unit: 'day',
                    status: 'available',
                    createdAt: new Date().toISOString(),
                    lastModifiedAt: new Date().toISOString(),
                    createdBy: 'Slav',
                    editedBy: 'Slav'
                }
            ];
            
            // Load sample price lists
            const samplePriceLists = [
                {
                    id: 'pricelist-1',
                    name: 'Standard Office Relocation Rates',
                    description: 'Standard pricing for office relocations up to 50 staff',
                    currency: 'GBP',
                    status: 'active',
                    markup: 25,
                    discount: 0,
                    effectiveFrom: new Date().toISOString(),
                    isDefault: true,
                    items: [],
                    createdAt: new Date().toISOString(),
                    lastModifiedAt: new Date().toISOString(),
                    createdBy: 'Slav',
                    editedBy: 'Slav'
                },
                {
                    id: 'pricelist-2',
                    name: 'Premium Commercial Rates',
                    description: 'Premium pricing for large commercial relocations',
                    currency: 'GBP',
                    status: 'active',
                    markup: 30,
                    discount: 5,
                    effectiveFrom: new Date().toISOString(),
                    isDefault: false,
                    items: [],
                    createdAt: new Date().toISOString(),
                    lastModifiedAt: new Date().toISOString(),
                    createdBy: 'Rob',
                    editedBy: 'Rob'
                }
            ];
            
            // Save to database
            for (const pcNumber of samplePCNumbers) {
                await db.save('pcNumbers', pcNumber);
            }
            
            for (const quote of sampleQuotes) {
                await db.save('quotes', quote);
            }
            
            for (const activity of sampleActivities) {
                await db.save('activities', activity);
            }
            
            for (const resource of sampleResources) {
                await db.save('resources', resource);
            }
            
            for (const priceList of samplePriceLists) {
                await db.save('priceLists', priceList);
            }
            
            logInfo(`Sample data loaded: ${samplePCNumbers.length} PC Numbers, ${sampleQuotes.length} Quotes, ${sampleActivities.length} Activities, ${sampleResources.length} Resources, ${samplePriceLists.length} Price Lists`);
            
        } catch (error) {
            logError('Failed to load sample data:', error);
        }
    }

    /**
     * @description Setup UI components
     */
    setupUI() {
        this.setupLoginSystem();
        this.setupNavigation();
        this.initializeMobileMenu();
    }

    /**
     * @description Setup login system
     */
    setupLoginSystem() {
        const userSelect = document.getElementById('user-select');
        if (userSelect) {
            userSelect.innerHTML = `
                <option value="">Select User...</option>
                <option value="slav">👨‍💼 Slav (admin)</option>
                <option value="rob">👨‍💻 Rob (manager)</option>
                <option value="kayleigh">👩‍💼 Kayleigh (manager)</option>
                <option value="terry">👨‍🔧 Terry (user)</option>
                <option value="phil">👨‍📊 Phil (user)</option>
            `;
        }

        const savedUser = localStorage.getItem('currentUser');
        if (savedUser && userSelect) {
            userSelect.value = savedUser;
            this.setCurrentUser(savedUser);
            } else {
            this.showLoginModal();
        }
    }

    /**
     * @description Setup navigation
     */
    setupNavigation() {
        const navItems = document.querySelectorAll('[data-show-page]');
        navItems.forEach(item => {
            item.addEventListener('click', async (e) => {
                e.preventDefault();
                const page = item.getAttribute('data-show-page');
                await this.navigateToPage(page);
            });
        });
    }

    /**
     * @description Setup event listeners
     */
    setupEventListeners() {
        // Setup form listeners
        this.setupFormListeners();
        
        // Setup import file listener
        this.setupImportFileListener();
        
        // Additional event listeners can be added here
        logDebug('Event listeners setup completed');
    }

    /**
     * @description Setup import file listener
     */
    setupImportFileListener() {
        const importFileInput = document.getElementById('import-file');
        const importButton = document.getElementById('import-button');
        
        if (importFileInput && importButton) {
            importFileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                importButton.disabled = !file;
                
                if (file) {
                    logDebug('File selected for import:', file.name);
                }
            });
        }
    }

    /**
     * @description Setup form event listeners
     */
    setupFormListeners() {
        // PC Number form
        const pcForm = document.getElementById('pc-form');
        if (pcForm) {
            pcForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.savePcNumber();
            });
        }

        // PC Edit form
        const pcEditForm = document.getElementById('pc-edit-form');
        if (pcEditForm) {
            pcEditForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.updatePcNumber();
            });
        }

        // Quote Step 1 modal form → proceed to full-screen builder
        const quoteForm = document.getElementById('new-quote-form');
        if (quoteForm) {
            quoteForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.proceedToQuoteBuilderFromModal();
            });
        }

        // Quote Edit form
        const quoteEditForm = document.getElementById('quote-edit-form');
        if (quoteEditForm) {
            quoteEditForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.updateQuote();
            });
        }

        // Activity form
        const activityForm = document.getElementById('activity-form');
        if (activityForm) {
            activityForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.saveActivity();
            });
        }

        // Resource form
        const resourceForm = document.getElementById('resource-form');
        if (resourceForm) {
            resourceForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.saveResource();
            });
        }

        // Price List form
        const priceListForm = document.getElementById('pricelist-form');
        if (priceListForm) {
            priceListForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.savePriceList();
            });
        }

        // Setup dynamic field indicator updates
        this.setupFieldIndicatorListeners();

        // Setup table sorting
        this.setupTableSorting();

        logDebug('Form listeners setup completed');
    }

    /**
     * @description Setup table sorting functionality
     */
    setupTableSorting() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('sortable')) {
                const column = e.target.getAttribute('data-sort');
                const table = e.target.closest('table');
                const tbody = table.querySelector('tbody');
                
                this.sortTable(tbody, column, e.target);
            }
        });
    }

    /**
     * @description Sort table by column
     */
    sortTable(tbody, column, headerElement) {
        const rows = Array.from(tbody.querySelectorAll('tr'));
        const isCurrentlySorted = headerElement.classList.contains('sorted-asc');
        const isDesc = headerElement.classList.contains('sorted-desc');
        
        // Clear all sorted indicators
        const table = headerElement.closest('table');
        table.querySelectorAll('.sortable').forEach(th => {
            th.classList.remove('sorted-asc', 'sorted-desc');
        });
        
        // Determine sort direction
        let ascending = true;
        if (isCurrentlySorted) {
            ascending = false;
            headerElement.classList.add('sorted-desc');
        } else {
            headerElement.classList.add('sorted-asc');
        }
        
        // Sort rows
        rows.sort((a, b) => {
            const aValue = this.getCellValue(a, column);
            const bValue = this.getCellValue(b, column);
            
            // Handle different data types
            if (this.isDate(aValue) && this.isDate(bValue)) {
                const aDate = new Date(aValue);
                const bDate = new Date(bValue);
                return ascending ? aDate - bDate : bDate - aDate;
            } else if (this.isNumber(aValue) && this.isNumber(bValue)) {
                const aNum = parseFloat(aValue);
                const bNum = parseFloat(bValue);
                return ascending ? aNum - bNum : bNum - aNum;
            } else {
                // String comparison
                const aStr = aValue.toString().toLowerCase();
                const bStr = bValue.toString().toLowerCase();
                if (ascending) {
                    return aStr.localeCompare(bStr);
                } else {
                    return bStr.localeCompare(aStr);
                }
            }
        });
        
        // Re-append sorted rows
        rows.forEach(row => tbody.appendChild(row));
    }

    /**
     * @description Get cell value based on column name and row data
     */
    getCellValue(row, column) {
        // This will be overridden to get actual data values
        // For now, get text content from the appropriate cell
        const cells = row.querySelectorAll('td');
        const headers = row.closest('table').querySelectorAll('th');
        
        let columnIndex = -1;
        headers.forEach((header, index) => {
            if (header.getAttribute('data-sort') === column) {
                columnIndex = index;
            }
        });
        
        return columnIndex >= 0 && cells[columnIndex] ? cells[columnIndex].textContent.trim() : '';
    }

    /**
     * @description Check if value is a date
     */
    isDate(value) {
        return !isNaN(Date.parse(value)) && value.includes('-');
    }

    /**
     * @description Check if value is a number
     */
    isNumber(value) {
        return !isNaN(value) && !isNaN(parseFloat(value));
    }

    /**
     * @description Format date for display
     */
    formatDate(dateString) {
        if (!dateString) return 'N/A';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: '2-digit', 
                year: 'numeric'
            }) + ' ' + date.toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return 'N/A';
        }
    }
    /**
     * @description Setup listeners for dynamic field indicator updates
     */
    setupFieldIndicatorListeners() {
        const allPcFields = [
            // New form fields
            'pc-company-name', 'pc-account-manager', 'pc-contact-first-name',
            'pc-contact-last-name', 'pc-address-postcode', 'pc-industry', 
            'pc-client-category', 'pc-client-source', 'pc-client-source-detail', 
            'pc-sic-code-1', 'pc-contact-email', 'pc-contact-phone',
            // Edit form fields
            'pc-edit-company', 'pc-edit-account-manager', 'pc-edit-contact-first-name',
            'pc-edit-contact-last-name', 'pc-edit-address-postcode', 'pc-edit-industry',
            'pc-edit-client-category', 'pc-edit-client-source', 'pc-edit-client-source-detail',
            'pc-edit-sic-code-1', 'pc-edit-contact-email', 'pc-edit-contact-phone'
        ];

        allPcFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                // Update indicators when user types or changes selection
                field.addEventListener('input', () => {
                    setTimeout(() => this.applyPcFieldIndicators(), 50);
                });
                field.addEventListener('change', () => {
                    setTimeout(() => this.applyPcFieldIndicators(), 50);
                });
            }
        });
    }

    /**
     * @description Navigate to a page
     * @param {string} pageName - Page name to navigate to
     */
    async navigateToPage(pageName) {
        try {
            logDebug(`Attempting to navigate to: ${pageName}`);
            
            // Hide all pages
            const pages = document.querySelectorAll('.page');
            pages.forEach(page => page.style.display = 'none');

            // Map page names if needed (for compatibility)
            const pageMap = {
                'pcnumbers': 'pcnumbers',
                'pc-numbers': 'pcnumbers',
                'quotes': 'quotes', 
                'activities': 'activities',
                'resources': 'resources',
                'pricelists': 'pricelists',
                'price-lists': 'pricelists',
                'dashboard': 'dashboard',
                'settings': 'settings'
            };
            
            const targetPageId = pageMap[pageName] || pageName;
            const targetPage = document.getElementById(targetPageId);
            
            if (targetPage) {
                targetPage.style.display = 'block';
                this.currentPage = targetPageId;

                // Update navigation state (use original pageName for button highlighting)
                this.updateNavigationState(pageName);

                // Load data for the page
                await this.loadPageData(targetPageId);

                // Apply field indicators for PC Number forms
                if (targetPageId === 'new-pc') {
                    // Small delay to ensure DOM is ready
                    setTimeout(() => this.applyPcFieldIndicators(), 100);
                }

                logDebug(`Successfully navigated to page: ${targetPageId}`);
            } else {
                logError(`Page not found: ${pageName} (mapped to: ${targetPageId})`);
                logDebug('Available pages:', Array.from(document.querySelectorAll('.page')).map(p => p.id));
            }
        } catch (error) {
            logError('Navigation error:', error);
        }
    }

    /**
     * @description Update navigation state
     */
    updateNavigationState(activePageId) {
        const navItems = document.querySelectorAll('[data-show-page]');
        navItems.forEach(item => {
            const pageId = item.getAttribute('data-show-page');
            if (pageId === activePageId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    /**
     * @description Load data for a specific page
     * @param {string} pageId - Page ID
     */
    async loadPageData(pageId) {
        try {
            switch (pageId) {
                case 'dashboard':
                    await this.loadDashboardData();
                    break;
                case 'pcnumbers':
                    await this.loadPcNumbersData();
                    break;
                case 'pc-detail':
                    await this.loadPcDetailData();
                    break;
                case 'quotes':
                    await this.loadQuotesData();
                    break;
                case 'quote-detail':
                    await this.loadQuoteDetailData();
                    break;
                case 'activities':
                    await this.loadActivitiesData();
                    break;
                case 'resources':
                    await this.loadResourcesData();
                    break;
                case 'pricelists':
                    await this.loadPriceListsData();
                    break;
                case 'settings':
                    await this.loadSettingsData();
                    break;
                default:
                    logDebug(`No data loading required for page: ${pageId}`);
                    break;
            }
        } catch (error) {
            logError(`Failed to load data for page ${pageId}:`, error);
        }
    }

    /**
     * @description Load and render settings data, including Account Managers
     */
    async loadSettingsData() {
        try {
            // Stats
            const stats = await db.getStats();
            const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = String(val); };
            set('settings-pc-count', stats.pcNumbers ?? '-');
            set('settings-quotes-count', stats.quotes ?? '-');
            set('settings-activities-count', stats.activities ?? '-');
            set('settings-pricelists-count', stats.priceLists ?? '-');
            set('settings-resources-count', stats.resources ?? '-');

            // Current user
            const userDisplay = document.getElementById('settings-current-user');
            if (userDisplay) userDisplay.textContent = this.currentUser || '-';

            // Account Managers list
            await this.refreshAccountManagersUI();
        } catch (error) {
            logError('Failed to load settings data:', error);
        }
    }

    async calculateAccountManagerStats(accountManagerName) {
        try {
            // Load all data types
            const [pcNumbers, quotes, priceLists, activities] = await Promise.all([
                this.db.loadAll('pcNumbers'),
                this.db.loadAll('quotes'),
                this.db.loadAll('priceLists'),
                this.db.loadAll('activities')
            ]);

            // Debug logging
            logDebug(`Calculating stats for AM: "${accountManagerName}"`);
            logDebug(`Total data: PC Numbers: ${pcNumbers.length}, Quotes: ${quotes.length}, Price Lists: ${priceLists.length}, Activities: ${activities.length}`);
            
            // Debug: Log all unique account managers found in data
            const allAMs = new Set();
            pcNumbers.forEach(pc => { if (pc.accountManager) allAMs.add(`PC: "${pc.accountManager}"`); });
            quotes.forEach(quote => { if (quote.accountManager) allAMs.add(`Quote: "${quote.accountManager}"`); });
            priceLists.forEach(pl => { if (pl.accountManager) allAMs.add(`PL: "${pl.accountManager}"`); });
            activities.forEach(activity => { if (activity.accountManager) allAMs.add(`Activity: "${activity.accountManager}"`); });
            logDebug('All Account Managers found in data:', Array.from(allAMs).sort());
            
            // Count usage in each data type with debug
            const pcMatches = pcNumbers.filter(pc => {
                const matches = pc.accountManager === accountManagerName;
                if (matches) logDebug(`PC Match: "${pc.accountManager}" === "${accountManagerName}" -> ${matches}`);
                return matches;
            });
            
            const quoteMatches = quotes.filter(quote => {
                const matches = quote.accountManager === accountManagerName;
                if (matches) logDebug(`Quote Match: "${quote.accountManager}" === "${accountManagerName}" -> ${matches}`);
                return matches;
            });
            
            const plMatches = priceLists.filter(pl => {
                const matches = pl.accountManager === accountManagerName;
                if (matches) logDebug(`PL Match: "${pl.accountManager}" === "${accountManagerName}" -> ${matches}`);
                return matches;
            });
            
            const activityMatches = activities.filter(activity => {
                const matches = activity.accountManager === accountManagerName;
                if (matches) logDebug(`Activity Match: "${activity.accountManager}" === "${accountManagerName}" -> ${matches}`);
                return matches;
            });

            const stats = {
                pcNumbers: pcMatches.length,
                quotes: quoteMatches.length,
                priceLists: plMatches.length,
                activities: activityMatches.length
            };

            logDebug(`Stats for "${accountManagerName}":`, stats);
            return stats;
        } catch (error) {
            logError('Error calculating Account Manager stats:', error);
            return { pcNumbers: 0, quotes: 0, priceLists: 0, activities: 0 };
        }
    }

    async refreshAccountManagersUI() {
        this.accountManagersCache = await db.loadAll('accountManagers');
        this.accountManagersCache.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        const list = document.getElementById('account-managers-list');
        if (list) {
            if (this.accountManagersCache.length === 0) {
                list.innerHTML = '<tr><td colspan="6" style="padding: 1rem; text-align: center; color: #6b7280;">No account managers yet</td></tr>';
            } else {
                // Calculate stats for each account manager
                const rows = await Promise.all(this.accountManagersCache.map(async (am) => {
                    const stats = await this.calculateAccountManagerStats(am.name);
                    const total = stats.pcNumbers + stats.quotes + stats.priceLists + stats.activities;
                    
                    return `
                        <tr style="border-bottom: 1px solid #e5e7eb;">
                            <td style="padding: 0.75rem; font-weight: 500;">${am.name}</td>
                            <td style="padding: 0.75rem; text-align: center;">
                                <span style="display: inline-block; background: #dbeafe; color: #1e40af; padding: 0.25rem 0.5rem; border-radius: 0.375rem; font-size: 0.875rem; font-weight: 500;">
                                    ${stats.pcNumbers}
                                </span>
                            </td>
                            <td style="padding: 0.75rem; text-align: center;">
                                <span style="display: inline-block; background: #dcfce7; color: #166534; padding: 0.25rem 0.5rem; border-radius: 0.375rem; font-size: 0.875rem; font-weight: 500;">
                                    ${stats.quotes}
                                </span>
                            </td>
                            <td style="padding: 0.75rem; text-align: center;">
                                <span style="display: inline-block; background: #fef3c7; color: #92400e; padding: 0.25rem 0.5rem; border-radius: 0.375rem; font-size: 0.875rem; font-weight: 500;">
                                    ${stats.priceLists}
                                </span>
                            </td>
                            <td style="padding: 0.75rem; text-align: center;">
                                <span style="display: inline-block; background: #fce7f3; color: #be185d; padding: 0.25rem 0.5rem; border-radius: 0.375rem; font-size: 0.875rem; font-weight: 500;">
                                    ${stats.activities}
                                </span>
                            </td>
                            <td style="padding: 0.75rem; text-align: center;">
                                ${total > 0 ? 
                                    `<button class="secondary" onclick="window.deleteAccountManager('${am.id}')" title="Cannot delete - Account Manager is in use" disabled style="opacity: 0.5; cursor: not-allowed;">Delete</button>` :
                                    `<button class="secondary" onclick="window.deleteAccountManager('${am.id}')">Delete</button>`
                                }
                            </td>
                        </tr>
                    `;
                }));
                
                list.innerHTML = rows.join('');
            }
        }
        this.populateAllAccountManagerSelects();
    }
    populateAccountManagerSelect(selectEl, selectedValue = '') {
        if (!selectEl) return;
        const current = selectedValue || selectEl.value || '';
        selectEl.innerHTML = '<option value="">Select Account Manager...</option>';
        this.accountManagersCache.forEach(am => {
            const opt = document.createElement('option');
            opt.value = am.name;
            opt.textContent = am.name;
            if (am.name === current) opt.selected = true;
            selectEl.appendChild(opt);
        });
    }

    populateAllAccountManagerSelects() {
        const ids = [
            'pc-account-manager',
            'pc-edit-account-manager',
            'builder-account-manager',
            'quote-modal-account-manager',
            'quote-edit-account-manager'
        ];
        ids.forEach(id => this.populateAccountManagerSelect(document.getElementById(id)));
    }

    async addAccountManagerFromInput() {
        const input = document.getElementById('new-account-manager-name');
        const name = input?.value?.trim();
        if (!name) { uiModals.showToast('Enter a name', 'warning'); return; }
        const existing = (await db.loadAll('accountManagers')).find(am => (am.name || '').toLowerCase() === name.toLowerCase());
        if (existing) { uiModals.showToast('This name already exists', 'warning'); return; }
        await db.save('accountManagers', { name, createdAt: new Date().toISOString() });
        if (input) input.value = '';
        uiModals.showToast('Account Manager added', 'success');
        await this.refreshAccountManagersUI();
    }

    async deleteAccountManagerById(id) {
        try {
            const am = await db.load('accountManagers', id);
            if (!am) { uiModals.showToast('Account Manager not found', 'error'); return; }
            // Validate usage in pcNumbers, quotes, activities
            const [pcs, quotes, activities] = await Promise.all([
                db.loadAll('pcNumbers'), db.loadAll('quotes'), db.loadAll('activities')
            ]);
            const inUse = (
                pcs.some(x => (x.accountManager || '') === am.name) ||
                quotes.some(x => (x.accountManager || '') === am.name) ||
                activities.some(x => (x.accountManager || '') === am.name)
            );
            if (inUse) {
                uiModals.showToast('Cannot delete: this Account Manager is in use', 'error');
                return;
            }
            if (!confirm('Delete this account manager?')) return;
            await db.delete('accountManagers', id);
            uiModals.showToast('Account Manager deleted', 'success');
            await this.refreshAccountManagersUI();
        } catch (e) {
            logError('deleteAccountManager error:', e);
            uiModals.showToast('Failed to delete account manager', 'error');
        }
    }

    /**
     * @description Load dashboard data
     */
    async loadDashboardData() {
        try {
            const [pcNumbers, quotes, activities] = await Promise.all([
                db.loadAll('pcNumbers'),
                db.loadAll('quotes'),
                db.loadAll('activities')
            ]);

            // Update dashboard stats
            const statPc = document.getElementById('stat-pc');
            const statQuotes = document.getElementById('stat-quotes');
            const statActivities = document.getElementById('stat-activities');
            const statValue = document.getElementById('stat-value');

            if (statPc) statPc.textContent = pcNumbers.length;
            if (statQuotes) statQuotes.textContent = quotes.length;
            if (statActivities) statActivities.textContent = activities.length;
            
            const totalValue = quotes.reduce((sum, quote) => sum + (parseFloat(quote.totalAmount) || 0), 0);
            if (statValue) statValue.textContent = `£${totalValue.toLocaleString()}`;

            // Update recent PC Numbers (latest 5)
            const recentPcContainer = document.getElementById('recent-pc');
            if (recentPcContainer) {
                const recentPcNumbers = pcNumbers
                    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
                    .slice(0, 5);
                
                if (recentPcNumbers.length === 0) {
                    recentPcContainer.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #6b7280; padding: 1rem;">No PC Numbers found</td></tr>';
                } else {
                    recentPcContainer.innerHTML = recentPcNumbers.map(pc => `
                        <tr onclick="window.viewPcDetails('${pc.id}')" style="cursor: pointer;" onmouseover="this.style.backgroundColor='#f8fafc'" onmouseout="this.style.backgroundColor=''">
                            <td><strong>${pc.pcNumber || 'N/A'}</strong></td>
                            <td>${pc.company || 'N/A'}</td>
                            <td>${pc.projectTitle || 'N/A'}</td>
                            <td>${pc.createdAt ? new Date(pc.createdAt).toLocaleDateString() : 'N/A'}</td>
                        </tr>
                    `).join('');
                }
            }

            // Update recent Quotes (latest 5)
            const recentQuotesContainer = document.getElementById('recent-quotes');
            if (recentQuotesContainer) {
                const recentQuotes = quotes
                    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
                    .slice(0, 5);
                
                if (recentQuotes.length === 0) {
                    recentQuotesContainer.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #6b7280; padding: 1rem;">No Quotes found</td></tr>';
                } else {
                    recentQuotesContainer.innerHTML = recentQuotes.map(quote => `
                        <tr onclick="window.viewQuoteDetails('${quote.id}')" style="cursor: pointer;" onmouseover="this.style.backgroundColor='#f8fafc'" onmouseout="this.style.backgroundColor=''">
                            <td><strong>${quote.quoteNumber || 'N/A'}</strong></td>
                            <td>${quote.pcNumber || 'N/A'}</td>
                            <td>${quote.clientName || 'N/A'}</td>
                            <td>£${(quote.totalAmount || 0).toLocaleString()}</td>
                            <td><span class="status-badge ${quote.status || 'pending'}">${(quote.status === 'pending') ? 'Send to Customer, awaiting approval' : (quote.status || 'pending')}</span></td>
                            <td>${quote.createdAt ? new Date(quote.createdAt).toLocaleDateString() : 'N/A'}</td>
                        </tr>
                    `).join('');
                }
            }

            // Update recent Activities (latest 5)
            const recentActivitiesContainer = document.getElementById('recent-activities');
            if (recentActivitiesContainer) {
                const recentActivities = activities
                    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
                    .slice(0, 5);
                
                if (recentActivities.length === 0) {
                    recentActivitiesContainer.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #6b7280; padding: 1rem;">No Activities found</td></tr>';
                } else {
                    recentActivitiesContainer.innerHTML = recentActivities.map(activity => {
                        // Get scheduled date safely
                        let scheduledDisplay = 'Not scheduled';
                        if (activity.scheduledDate) {
                            try {
                                scheduledDisplay = new Date(activity.scheduledDate).toLocaleDateString();
                            } catch (e) {
                                scheduledDisplay = 'Invalid date';
                            }
                        }

                        return `
                        <tr onclick="window.viewActivityDetails('${activity.id}')" style="cursor: pointer;" onmouseover="this.style.backgroundColor='#f8fafc'" onmouseout="this.style.backgroundColor=''">
                            <td><strong>${activity.title || 'N/A'}</strong></td>
                            <td>${activity.type || 'N/A'}</td>
                            <td>${activity.quoteNumber || activity.pcNumber || 'N/A'}</td>
                            <td><span class="status-badge ${activity.status || 'pending'}">${activity.status || 'pending'}</span></td>
                            <td>${scheduledDisplay}</td>
                            <td>${activity.createdAt ? new Date(activity.createdAt).toLocaleDateString() : 'N/A'}</td>
                        </tr>
                        `;
                    }).join('');
                }
            }

            logDebug('Dashboard data loaded');
        } catch (error) {
            logError('Failed to load dashboard data:', error);
        }
    }

    /**
     * @description Load PC Detail data
     */
    async loadPcDetailData() {
        try {
            if (!window.currentPC) {
                logError('No current PC data available for detail view');
                return;
            }

            const pcData = window.currentPC;
            logDebug('Loading PC detail data:', pcData);

            // Populate main data fields (normalized schema)
            const fields = [
                { id: 'pc-detail-number', value: pcData.pcNumber || 'N/A' },
                { id: 'pc-detail-company-name', value: pcData.company || 'N/A' },
                { id: 'pc-detail-project-name', value: pcData.projectTitle || 'N/A' },
                { id: 'pc-detail-account-manager', value: pcData.accountManager || 'N/A' },
                { id: 'pc-detail-client-industry', value: pcData.industry || pcData.clientIndustry || 'N/A' },
                { id: 'pc-detail-client-source', value: pcData.clientSource || 'N/A' },
                { id: 'pc-detail-client-source-detail', value: pcData.clientSourceDetail || 'N/A' },
                { id: 'pc-detail-status', value: pcData.status || 'Draft' },
                { id: 'pc-detail-project-description', value: pcData.projectDescription || 'No description available' },
                { id: 'pc-detail-contact-name', value: ((pcData.contactFirstName || '') + (pcData.contactLastName ? ' ' + pcData.contactLastName : '')).trim() || 'N/A' },
                { id: 'pc-detail-contact-phone', value: pcData.contactPhone || 'N/A' },
                { id: 'pc-detail-contact-email', value: pcData.contactEmail || 'N/A' },
                { id: 'pc-detail-address-postcode', value: pcData.addressPostcode || pcData.postcode || 'N/A' },
                { id: 'pc-detail-address-1', value: pcData.address1 || '' },
                { id: 'pc-detail-address-2', value: pcData.address2 || '' },
                { id: 'pc-detail-address-3', value: pcData.address3 || '' },
                { id: 'pc-detail-address-4', value: pcData.address4 || '' },
                { id: 'pc-detail-address-country', value: pcData.addressCountry || '' }
            ];

            fields.forEach(field => {
                const element = document.getElementById(field.id);
                if (element) {
                    element.textContent = field.value;
                    logDebug(`Set ${field.id} = ${field.value}`);
                } else {
                    logError(`Field not found: ${field.id}`);
                }
            });

            // Update page title
            const titleElement = document.getElementById('pc-detail-title');
            if (titleElement) {
                titleElement.textContent = `PC Details - ${pcData.pcNumber || 'Unknown'}`;
            }

            logDebug('PC detail data loaded successfully');

        } catch (error) {
            logError('Failed to load PC detail data:', error);
        }
    }

    /**
     * @description Load Quote detail data
     */
    async loadQuoteDetailData() {
        try {
            if (!window.currentQuote) {
                logError('No current Quote data available for detail view');
                return;
            }

            const quoteData = window.currentQuote;
            logDebug('Loading Quote detail data:', quoteData);

            // Populate main data fields
            const fields = [
                { id: 'quote-detail-number', value: quoteData.quoteNumber || quoteData.id || 'N/A' },
                { id: 'quote-detail-pc-number', value: quoteData.pcNumber || 'N/A' },
                { id: 'quote-detail-client-name', value: quoteData.clientName || quoteData.companyName || 'N/A' },
                { id: 'quote-detail-project-title', value: quoteData.projectTitle || 'N/A' },
                { id: 'quote-detail-account-manager', value: quoteData.accountManager || 'N/A' },
                { id: 'quote-detail-value', value: quoteData.totalAmount ? `£${quoteData.totalAmount.toLocaleString()}` : 'N/A' },
                { id: 'quote-detail-status', value: quoteData.status || 'draft' },
                { id: 'quote-detail-valid-until', value: quoteData.validUntil ? new Date(quoteData.validUntil).toLocaleDateString() : 'N/A' },
                { id: 'quote-detail-created-at', value: quoteData.createdAt ? new Date(quoteData.createdAt).toLocaleDateString() : 'N/A' },
                { id: 'quote-detail-description', value: quoteData.description || 'No description' },
                { id: 'quote-detail-version', value: quoteData.version || '1.0' },
                { id: 'quote-detail-net-total', value: quoteData.netTotal ? `£${quoteData.netTotal.toLocaleString()}` : 'N/A' },
                { id: 'quote-detail-vat-rate', value: quoteData.vatRate ? `${quoteData.vatRate}%` : '20%' },
                { id: 'quote-detail-vat-amount', value: quoteData.vatAmount ? `£${quoteData.vatAmount.toLocaleString()}` : 'N/A' },
                { id: 'quote-detail-discount', value: quoteData.discount ? `£${quoteData.discount.toLocaleString()}` : '£0' },
                { id: 'quote-detail-total-cost', value: quoteData.totalCost ? `£${quoteData.totalCost.toLocaleString()}` : 'N/A' },
                { id: 'quote-detail-standard-liability', value: quoteData.standardLiability || 'Standard' },
                { id: 'quote-detail-declared-value', value: quoteData.declaredValue ? `£${quoteData.declaredValue.toLocaleString()}` : 'N/A' },
                { id: 'quote-detail-price-list', value: quoteData.priceList || 'Standard Price List' },
                { id: 'quote-detail-recycling-fee', value: quoteData.recyclingFee ? `£${quoteData.recyclingFee}` : '£0' },
                { id: 'quote-detail-environmental-fee', value: quoteData.environmentalFee ? `£${quoteData.environmentalFee}` : '£0' },
                { id: 'quote-detail-volume-rebate', value: quoteData.volumeRebate ? `£${quoteData.volumeRebate}` : '£0' },
                { id: 'quote-detail-loyalty-rebate', value: quoteData.loyaltyRebate ? `£${quoteData.loyaltyRebate}` : '£0' }
            ];

            fields.forEach(field => {
                const element = document.getElementById(field.id);
                if (element) {
                    element.textContent = field.value;
                    logDebug(`Set ${field.id} = ${field.value}`);
                } else {
                    logError(`Field not found: ${field.id}`);
                }
            });

            // Update page title
            const titleElement = document.getElementById('quote-detail-title');
            if (titleElement) {
                titleElement.textContent = `Quote Details - ${quoteData.quoteNumber || quoteData.id || 'Unknown'}`;
            }

            // Handle PL items display (new structure)
            const itemsContainer = document.getElementById('quote-detail-items');
            if (itemsContainer) {
                const plItems = quoteData.itemsPriceList || quoteData.items || [];
                if (plItems.length > 0) {
                    itemsContainer.innerHTML = plItems.map(item => `
                        <div style="padding: 0.5rem 0; border-bottom: 1px solid #e5e7eb;">
                            <strong>${item.name || 'Item'}</strong><br>
                            <small>Category: ${item.category || '-'} | Qty: ${item.quantity || 1} ${item.unit || ''} | Unit: £${(item.unitPrice || 0).toFixed(2)} | Line: £${((item.quantity || 1) * (item.unitPrice || 0)).toFixed(2)}</small>
                        </div>
                    `).join('');
                } else {
                    itemsContainer.innerHTML = '<p style="margin: 0; color: #6b7280;">No items added to this quote yet.</p>';
                }
            }

            // Handle other manual costs
            const otherCostsSection = document.getElementById('quote-detail-other-costs-section');
            const otherCostsContainer = document.getElementById('quote-detail-other-costs');
            const otherCosts = quoteData.otherCostsManual || quoteData.otherCosts || [];
            if (otherCosts.length > 0) {
                if (otherCostsSection) otherCostsSection.style.display = 'block';
                if (otherCostsContainer) {
                    otherCostsContainer.innerHTML = otherCosts.map(cost => `
                        <div style="padding: 0.25rem 0;">
                            ${cost.description}: £${(cost.amount||0).toFixed(2)}
                        </div>
                    `).join('');
                }
            } else {
                if (otherCostsSection) otherCostsSection.style.display = 'none';
            }

            // TODO: optionally render recycling and rebates breakdown in details later

            logDebug('Quote detail data loaded successfully');

        } catch (error) {
            logError('Failed to load Quote detail data:', error);
        }
    }

    /**
     * @description Add Quote for specific PC Number
     * @param {string} pcId - PC Number ID
     */
    async addQuoteForPc(pcId) {
        try {
            logDebug(`Opening Quote modal for PC ID: ${pcId}`);
            
            // Load PC data to get details
            const pcData = await db.load('pcNumbers', pcId);
            if (!pcData) {
                uiModals.showToast('PC Number not found', 'error');
                return;
            }
            
            // Validate PC Number has required fields for Quote creation
            const validation = this.validatePcForQuoteCreation(pcData);
            if (!validation.isValid) {
                uiModals.showToast(
                    `⚠️ Cannot create Quote from PC Number ${pcData.pcNumber}!\n\nMissing required fields:\n• ${validation.missingFields.join('\n• ')}\n\nPlease edit the PC Number and fill in these fields first.`, 
                    'error'
                );
                return;
            }
            
            // Open quote modal with PC ID to disable dropdown
            await this.openQuoteModal(pcId);
            
            // Pre-fill company name if it exists
            const companyInput = document.getElementById('quote-modal-company');
            if (companyInput && pcData.company) {
                companyInput.value = pcData.company;
                // Trigger company search to filter PC Numbers
                await this.searchCompanies(pcData.company);
                logDebug(`Pre-filled company: ${pcData.company}`);
            }
            
            uiModals.showToast(`Creating quote for ${pcData.pcNumber}`, 'info');
            
        } catch (error) {
            logError('Failed to add quote for PC:', error);
            uiModals.showToast('Failed to open quote form', 'error');
        }
    }

    /**
     * @description Add Activity for specific Quote
     * @param {string} quoteId - Quote ID
     */
    async addActivityForQuote(quoteId) {
        try {
            logDebug(`Opening Activity modal for Quote ID: ${quoteId}`);
            
            // Load Quote data to get details
            const quoteData = await db.load('quotes', quoteId);
            if (!quoteData) {
                uiModals.showToast('Quote not found', 'error');
                return;
            }
            
            // Open activity modal
            await this.openActivityModal();
            
            // Pre-fill the Quote dropdown
            const quoteSelect = document.getElementById('activity-quote-id');
            if (quoteSelect) {
                quoteSelect.value = quoteData.quoteNumber || quoteData.id;
                logDebug(`Pre-selected Quote: ${quoteData.quoteNumber || quoteData.id}`);
            }
            
            // Pre-fill the PC Number dropdown if quote has one
            const pcSelect = document.getElementById('activity-pc-number');
            if (pcSelect && quoteData.pcNumber) {
                pcSelect.value = quoteData.pcNumber;
                logDebug(`Pre-selected PC Number: ${quoteData.pcNumber}`);
            }
            
            // Pre-fill activity title with quote reference
            const titleInput = document.getElementById('activity-title');
            if (titleInput) {
                titleInput.value = `Activity for Quote ${quoteData.quoteNumber || quoteData.id}`;
                logDebug(`Pre-filled title: Activity for Quote ${quoteData.quoteNumber || quoteData.id}`);
            }
            
            uiModals.showToast(`Creating activity for Quote ${quoteData.quoteNumber || quoteData.id}`, 'info');
            
        } catch (error) {
            logError('Failed to add activity for Quote:', error);
            uiModals.showToast('Failed to open activity form', 'error');
        }
    }

    /**
     * @description Load PC Numbers data
     */
    async loadPcNumbersData() {
        try {
            const [pcNumbers] = await Promise.all([
                db.loadAll('pcNumbers'),
                (async () => { try { this.accountManagersCache = await db.loadAll('accountManagers'); this.accountManagersCache.sort((a,b)=> (a.name||'').localeCompare(b.name||'')); this.populateAllAccountManagerSelects(); } catch(_){} })()
            ]);
            const container = document.getElementById('pc-list');
            
            if (container) {
                if (pcNumbers.length === 0) {
                    container.innerHTML = '<tr><td colspan="7">No PC Numbers found. <button onclick="window.showNewPcModal()" class="button primary">Create First PC Number</button></td></tr>';
                } else {
                    container.innerHTML = pcNumbers.map(pc => `
                        <tr onclick="window.viewPcDetails('${pc.id}')" style="cursor: pointer;" onmouseover="this.style.backgroundColor='#f8fafc'" onmouseout="this.style.backgroundColor=''">
                            <td><strong>${pc.pcNumber || 'N/A'}</strong></td>
                            <td>${pc.company || 'N/A'}</td>
                            <td>${pc.projectTitle || 'N/A'}</td>
                            <td>${(pc.contactFirstName || '') + ' ' + (pc.contactLastName || '') || pc.contactName || 'N/A'}</td>
                            <td>${pc.accountManager || 'N/A'}</td>
                            <td>${this.formatDate(pc.lastModifiedAt || pc.createdAt)}</td>
                            <td onclick="event.stopPropagation()">
                                <button onclick="window.editPC('${pc.id}')" class="button warning small">Edit</button>
                                <button onclick="window.viewPcDetails('${pc.id}')" class="button primary small">View</button>
                                <button onclick="window.addQuoteForPc('${pc.id}')" class="button success small">Add Quote</button>
                            </td>
                        </tr>
                    `).join('');
                }
            } else {
                logError('PC Numbers container not found: #pc-list');
            }
            
            logDebug(`Loaded ${pcNumbers.length} PC Numbers`);
        } catch (error) {
            logError('Failed to load PC Numbers data:', error);
        }
    }

    /**
     * @description Load Quotes data
     */
    async loadQuotesData() {
        try {
            const quotes = await db.loadAll('quotes');
            const container = document.getElementById('quotes-list');
            
            if (container) {
                if (quotes.length === 0) {
                    container.innerHTML = '<tr><td colspan="8">No quotes found. <button onclick="window.showNewQuoteModal()" class="button primary">Create First Quote</button></td></tr>';
                } else {
                    container.innerHTML = quotes.map(quote => `
                        <tr onclick="window.viewQuoteDetails('${quote.id}')" style="cursor: pointer;" onmouseover="this.style.backgroundColor='#f8fafc'" onmouseout="this.style.backgroundColor=''">
                            <td><strong>${quote.quoteNumber || 'N/A'}</strong></td>
                            <td>${quote.pcNumber || 'N/A'}</td>
                            <td>${quote.clientName || 'N/A'}</td>
                            <td>£${(quote.totalAmount || 0).toLocaleString()}</td>
                            <td><span class="status-badge ${quote.status || 'pending'}">${quote.status || 'pending'}</span></td>
                            <td>${quote.accountManager || 'N/A'}</td>
                            <td>${this.formatDate(quote.lastModifiedAt || quote.createdAt)}</td>
                            <td onclick="event.stopPropagation()">
                                <button onclick="window.editQuote('${quote.id}')" class="button warning small">Edit</button>
                                <button onclick="window.viewQuoteDetails('${quote.id}')" class="button primary small">View</button>
                                <button onclick="window.addActivityForQuote('${quote.id}')" class="button info small">Add Activity</button>
                            </td>
                        </tr>
                    `).join('');
                }
            } else {
                logError('Quotes container not found: #quotes-list');
            }
            
            console.log(`🔍 Loaded ${quotes.length} quotes for display`);
            // Debug: Log quote data to see what we actually have
            quotes.forEach(quote => {
                console.log(`🔍 Quote ${quote.id}: totalAmount=${quote.totalAmount}, clientName=${quote.clientName}`);
            });
        } catch (error) {
            logError('Failed to load quotes data:', error);
        }
    }

    /**
     * @description Load Activities data
     */
    async loadActivitiesData() {
        try {
            const activities = await db.loadAll('activities');
            const container = document.getElementById('activities-list');
            
            if (container) {
                if (activities.length === 0) {
                    container.innerHTML = '<tr><td colspan="10">No activities found. <button onclick="window.showActivityModal()" class="button primary">Create First Activity</button></td></tr>';
                } else {
                    container.innerHTML = activities.map(activity => {
                        // Get scheduled date safely
                        let scheduledDisplay = 'Not scheduled';
                        if (activity.scheduledDate) {
                            try {
                                scheduledDisplay = new Date(activity.scheduledDate).toLocaleDateString();
                            } catch (e) {
                                scheduledDisplay = 'Invalid date';
                            }
                        }

                        return `
                        <tr onclick="window.viewActivityDetails('${activity.id}')" style="cursor: pointer;" onmouseover="this.style.backgroundColor='#f8fafc'" onmouseout="this.style.backgroundColor=''">
                            <td><strong>${activity.title || 'N/A'}</strong></td>
                            <td>${activity.pcNumber || 'N/A'}</td>
                            <td>${activity.companyName || 'N/A'}</td>
                            <td>${activity.type || 'N/A'}</td>
                            <td>${scheduledDisplay}</td>
                            <td>${activity.priority || 'Medium'}</td>
                            <td><span class="status-badge ${activity.status || 'pending'}">${activity.status || 'pending'}</span></td>
                            <td>${activity.accountManager || 'N/A'}</td>
                            <td>${this.formatDate(activity.lastModifiedAt || activity.createdAt)}</td>
                            <td onclick="event.stopPropagation()">
                                <button onclick="window.editActivity('${activity.id}')" class="button warning small">Edit</button>
                                <button onclick="window.viewActivityDetails('${activity.id}')" class="button primary small">View</button>
                            </td>
                        </tr>
                        `;
                    }).join('');
                }
            } else {
                logError('Activities container not found: #activities-list');
            }
            
            logDebug(`Loaded ${activities.length} activities`);
        } catch (error) {
            logError('Failed to load activities data:', error);
        }
    }
    /**
     * @description Load Resources data
     */
    async loadResourcesData() {
        try {
            const resources = await db.loadAll('resources');
            const priceLists = await db.loadAll('priceLists');
            const container = document.getElementById('resources-list');
            const nameFilter = (document.getElementById('resource-filter-name')?.value || '').toLowerCase();
            const categoryFilter = (document.getElementById('resource-filter-category')?.value || '').toLowerCase();
            const unitFilter = (document.getElementById('resource-filter-unit')?.value || '').toLowerCase();
            
            if (container) {
                if (resources.length === 0) {
                    container.innerHTML = '<tr><td colspan="6">No resources found. <button onclick="window.showResourceModal()" class="button primary">Create First Resource</button></td></tr>';
                } else {
                    // Expand resources into rows per unit price (split hour variants into separate rows)
                    const rows = [];
                    for (const r of resources) {
                        const normalizedCategory = (r.category || r.type || '').toString().toLowerCase();
                        const structured = Array.isArray(r.unitPrices) ? r.unitPrices : [];
                        if (structured.length > 0) {
                            for (const up of structured) {
                                if (!up) continue;
                                if (up.unit === 'hour' && up.rates && typeof up.rates === 'object') {
                                    const ratePairs = [
                                        ['standard', up.rates.standard],
                                        ['ot1', up.rates.ot1],
                                        ['ot2', up.rates.ot2],
                                        ['overnight', up.rates.overnight ?? up.rates.bank_holiday]
                                    ];
                                    ratePairs.forEach(([rateType, val]) => {
                                        if (val != null && !isNaN(val)) {
                                            rows.push({
                                                id: r.id,
                                                name: r.name,
                                                category: normalizedCategory,
                                                unit: 'hour',
                                                labourRateType: rateType,
                                                cost: Number(val),
                                                createdAt: r.createdAt
                                            });
                                        }
                                    });
                                } else if (up.unit) {
                                    rows.push({ id: r.id, name: r.name, category: normalizedCategory, unit: up.unit, cost: Number(up.cost ?? 0), createdAt: r.createdAt });
                                }
                            }
                        } else {
                            // Legacy fields fallback
                            if (r.costPerUnit != null) rows.push({ id: r.id, name: r.name, category: normalizedCategory, unit: 'each', cost: Number(r.costPerUnit), createdAt: r.createdAt });
                            if (r.costPerHour != null) rows.push({ id: r.id, name: r.name, category: normalizedCategory, unit: 'hour', labourRateType: 'standard', cost: Number(r.costPerHour), createdAt: r.createdAt });
                            if (r.costPerDay != null) rows.push({ id: r.id, name: r.name, category: normalizedCategory, unit: 'day', cost: Number(r.costPerDay), createdAt: r.createdAt });
                        }
                    }

                    // Usage count per resource-unit across price lists
                    const usageCountFor = (resId, unit, labourRateType) => {
                        let count = 0;
                        for (const pl of priceLists) {
                            const items = Array.isArray(pl.items) ? pl.items : [];
                            const match = items.some(it => {
                                const itemUnit = (it.unit || '').toLowerCase();
                                if ((unit || '').toLowerCase() === 'hour' && labourRateType) {
                                    const itemRateType = (it.labourRateType || 'standard').toLowerCase();
                                    return (it.resourceId === resId) && itemUnit === 'hour' && itemRateType === labourRateType.toLowerCase();
                                }
                                return (it.resourceId === resId) && itemUnit === (unit || '').toLowerCase();
                            });
                            if (match) count += 1;
                        }
                        return count;
                    };
                    const enrichedRows = rows.map(r => ({...r, usage: usageCountFor(r.id, r.unit, r.labourRateType)}));
                    // Apply filters
                    const filteredRows = enrichedRows.filter(row =>
                        (!nameFilter || (row.name || '').toLowerCase().includes(nameFilter)) &&
                        (!categoryFilter || (row.category || '').toLowerCase() === categoryFilter) &&
                        (!unitFilter || (row.unit || '').toLowerCase() === unitFilter)
                    );

                    const formatCategory = (c) => {
                        if (!c) return 'N/A';
                        const s = String(c);
                        return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
                    };

                    const formatUnit = (u, rateType) => {
                        if ((u || '').toLowerCase() !== 'hour') return u || '-';
                        const labelMap = { standard: 'Hour Standard', ot1: 'Hour OT1', ot2: 'Hour OT2', overnight: 'Hour Overnight' };
                        return labelMap[(rateType || 'standard').toLowerCase()] || 'Hour';
                    };
                    container.innerHTML = filteredRows.map(row => `
                        <tr>
                            <td><strong>${row.name || 'N/A'}</strong></td>
                            <td>${formatCategory(row.category)}</td>
                            <td>${formatUnit(row.unit, row.labourRateType)}</td>
                            <td>£${(row.cost || 0).toLocaleString()}</td>
                            <td>${this.formatDate(row.createdAt)}</td>
                            <td>${row.usage}</td>
                            <td>
                                <button onclick="window.editResource('${row.id}')" class="button warning small">Edit</button>
                                <button onclick="window.viewResourceDetails('${row.id}')" class="button primary small">View</button>
                                <button onclick="window.deleteResource('${row.id}')" class="button danger small">Delete</button>
                            </td>
                        </tr>
                    `).join('');
                }
            } else {
                logError('Resources container not found: #resources-list');
            }
            
            logDebug(`Loaded ${resources.length} resources`);
        } catch (error) {
            logError('Failed to load resources data:', error);
        }
    }

    async deleteResource(id) {
        try {
            const resource = await db.load('resources', id);
            if (!resource) { uiModals.showToast('Resource not found', 'error'); return; }
            // Prevent deletion if used in price lists
            const priceLists = await db.loadAll('priceLists');
            const inUse = priceLists.some(pl => (Array.isArray(pl.items) ? pl.items : []).some(it => it.resourceId === id));
            if (inUse) { uiModals.showToast('Cannot delete: resource is used in at least one price list', 'error'); return; }
            if (!confirm(`Delete resource "${resource.name}"? This cannot be undone.`)) return;
            await db.delete('resources', id);
            uiModals.showToast('Resource deleted', 'success');
            if (this.currentPage === 'resources') await this.loadResourcesData();
        } catch (e) { logError('deleteResource error:', e); uiModals.showToast('Failed to delete resource', 'error'); }
    }

    /**
     * @description Load Price Lists data
     */
    async loadPriceListsData() {
        try {
            const priceLists = await db.loadAll('priceLists') || [];
            const quotes = await db.loadAll('quotes') || [];
            console.log('loadPriceListsData - All Price Lists:', priceLists);
            priceLists.forEach(pl => console.log(`Price List "${pl.name}" has ${(pl.items || []).length} items:`, pl.items));
            const container = document.getElementById('pricelist-table');
            
            if (container) {
                if (priceLists.length === 0) {
                    container.innerHTML = '<tr><td colspan="8">No price lists found. <button onclick="window.createPriceList()" class="button primary">Create First Price List</button></td></tr>';
                } else {
                    container.innerHTML = priceLists.map(priceList => {
                        const usageCount = quotes.filter(q => (q.priceListId === priceList.id)).length;
                        return `
                        <tr onclick="window.viewPriceListDetails('${priceList.id}')" style="cursor: pointer;" onmouseover="this.style.backgroundColor='#f8fafc'" onmouseout="this.style.backgroundColor=''">
                            <td><strong>${priceList.name || 'N/A'}</strong></td>
                            <td>${priceList.version || '1.0'}</td>
                            <td>${priceList.currency || 'GBP'}</td>
                            <td>${priceList.effectivePeriod || 'N/A'}</td>
                            <td>${usageCount}</td>
                            <td>${priceList.isDefault ? 'Yes' : 'No'}</td>
                            <td><span class="status-badge ${priceList.status || 'active'}">${priceList.status || 'active'}</span></td>
                            <td>${this.formatDate(priceList.lastModifiedAt || priceList.createdAt)}</td>
                            <td onclick="event.stopPropagation()">
                                <button onclick="window.editPriceList('${priceList.id}')" class="button warning small">Edit</button>
                                <button onclick="window.viewPriceListDetails('${priceList.id}')" class="button primary small">View</button>
                                <button onclick="window.deletePriceList('${priceList.id}')" class="button danger small" ${usageCount > 0 ? 'disabled title="Cannot delete: used in quotes"' : ''}>Delete</button>
                            </td>
                        </tr>
                    `}).join('');
                }
            } else {
                logError('Price Lists container not found: #pricelist-table');
            }
            
            logDebug(`Loaded ${priceLists.length} price lists`);
        } catch (error) {
            logError('Failed to load price lists data:', error);
        }
    }

    /**
     * @description Set current user
     */
    setCurrentUser(userId) {
        this.currentUser = userId;
        localStorage.setItem('currentUser', userId);
        
        const userDisplay = document.getElementById('current-user');
        if (userDisplay) {
            const userMap = {
                'slav': '👨‍💼 Slav',
                'rob': '👨‍💻 Rob', 
                'kayleigh': '👩‍💼 Kayleigh',
                'terry': '👨‍🔧 Terry',
                'phil': '👨‍📊 Phil'
            };
            userDisplay.textContent = userMap[userId] || userId;
        }
        
        logInfo(`User logged in: ${userId}`);
    }

    /**
     * @description Show login modal
     */
    showLoginModal() {
        uiModals.openModal('login-modal');
    }

    /**
     * @description Initialize mobile menu
     */
    initializeMobileMenu() {
        const toggleButton = document.getElementById('mobile-menu-toggle');
        const navigation = document.getElementById('main-navigation');
        
        if (toggleButton && navigation) {
            toggleButton.addEventListener('click', () => {
                navigation.classList.toggle('mobile-open');
            });
        }
    }

    /**
     * @description Show loading overlay
     */
    showLoadingOverlay(message = 'Loading...') {
        const overlay = document.getElementById('loading-overlay');
        const text = document.getElementById('progress-text');
        
        if (overlay) {
            overlay.style.display = 'flex';
            overlay.classList.add('active');
        }
        
        if (text) {
            text.textContent = message;
        }
    }
    /**
     * @description Hide loading overlay
     */
    hideLoadingOverlay() {
            const overlay = document.getElementById('loading-overlay');
                
        if (overlay) {
                overlay.style.display = 'none';
            overlay.classList.remove('active');
        }
    }

    /**
     * @description Update progress
     */
    updateProgress(percentage, message = '') {
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');
        
        if (progressBar) {
            progressBar.style.width = `${percentage}%`;
        }
        
        if (progressText && message) {
            progressText.textContent = message;
        }
        
        logDebug(`Progress: ${percentage}% - ${message}`);
    }

    /**
     * @description Open PC Edit Modal
     * @param {string} id - PC Number ID
     */
    async openPcEditModal(id) {
        try {
            logDebug(`Opening PC edit modal for ID: ${id}`);
            
            const pcData = await db.load('pcNumbers', id);
            if (!pcData) {
                logError(`PC Number not found: ${id}`);
                uiModals.showToast('PC Number not found', 'error');
                return;
            }
            
            logDebug('PC data loaded:', pcData);
            
            // Check if modal exists
            const modal = document.getElementById('pc-edit-modal');
            if (!modal) {
                logError('PC Edit modal not found in DOM');
                uiModals.showToast('Edit modal not available', 'error');
                return;
            }
            
            // Populate basic fields - with error checking
            const fields = [
                { id: 'pc-edit-id', value: pcData.id || '' },
                { id: 'pc-edit-number', value: pcData.pcNumber || '' },
                { id: 'pc-edit-status-label', value: pcData.status || 'Draft' },
                { id: 'pc-edit-company', value: pcData.company || '' },
                { id: 'pc-edit-title', value: pcData.projectTitle || '' },
                { id: 'pc-edit-description', value: pcData.projectDescription || '' },
                { id: 'pc-edit-account-manager', value: pcData.accountManager || '' },
                // Classification
                { id: 'pc-edit-industry', value: pcData.industry || '' },
                { id: 'pc-edit-client-category', value: pcData.clientCategory || '' },
                { id: 'pc-edit-client-source', value: pcData.clientSource || '' },
                { id: 'pc-edit-client-source-detail', value: pcData.clientSourceDetail || '' },
                // Contact
                { id: 'pc-edit-contact-first-name', value: pcData.contactFirstName || '' },
                { id: 'pc-edit-contact-last-name', value: pcData.contactLastName || '' },
                { id: 'pc-edit-contact-title', value: pcData.contactTitle || '' },
                { id: 'pc-edit-contact-phone', value: pcData.contactPhone || '' },
                { id: 'pc-edit-contact-email', value: pcData.contactEmail || '' },
                // Address
                { id: 'pc-edit-address-postcode', value: pcData.addressPostcode || '' },
                { id: 'pc-edit-address-1', value: pcData.address1 || '' },
                { id: 'pc-edit-address-2', value: pcData.address2 || '' },
                { id: 'pc-edit-address-3', value: pcData.address3 || '' },
                { id: 'pc-edit-address-4', value: pcData.address4 || '' },
                { id: 'pc-edit-address-country', value: pcData.addressCountry || '' },
                // SIC
                { id: 'pc-edit-sic-code-1', value: pcData.sicCode1 || '70100' },
                { id: 'pc-edit-sic-code-2', value: pcData.sicCode2 || '' },
                { id: 'pc-edit-sic-code-3', value: pcData.sicCode3 || '' }
            ];
            
            fields.forEach(field => {
                const element = document.getElementById(field.id);
                if (element) {
                    element.value = field.value;
                    logDebug(`Set ${field.id} = ${field.value}`);
                } else {
                    logError(`Field not found: ${field.id}`);
                }
            });
            
            // Show modal using uiModals
            await uiModals.openModal('pc-edit-modal');
            uiModals.showToast(`Editing ${pcData.pcNumber}`, 'info');
            
            // Apply field indicators
            setTimeout(() => this.applyPcFieldIndicators(), 100);
            
            logDebug('PC edit modal opened successfully');
            
        } catch (error) {
            logError('Failed to open PC edit modal:', error);
            uiModals.showToast('Failed to load PC Number', 'error');
        }
    }

    /**
     * @description Close PC Edit Modal
     */
    closePcEditModal() {
        uiModals.closeModal('pc-edit-modal');
    }

    // ===== ACTIVITIES FUNCTIONALITY =====
    
    /**
     * @description Open Activity Modal for creating new activity
     */
    async openActivityModal() {
        try {
            logDebug('Opening new activity modal');
            
            // Load Quotes for dropdown (activities are linked to quotes)
            const quotes = await db.loadAll('quotes');
            const quoteSelect = document.getElementById('activity-quote-select');
            
            if (quoteSelect) {
                quoteSelect.innerHTML = '<option value="">Select Quote</option>';
                quotes.forEach(quote => {
                    quoteSelect.innerHTML += `<option value="${quote.id}" data-quote-number="${quote.quoteNumber}">${quote.quoteNumber} - ${quote.clientName}</option>`;
                });
            }
            
            // Clear form
            this.clearActivityForm();
            
            // Set modal title
            const modalTitle = document.getElementById('activity-modal-title');
            if (modalTitle) {
                modalTitle.textContent = 'New Activity';
            }
            
            // Open modal
            await uiModals.openModal('activity-modal');
            logDebug('Activity modal opened successfully');
            
        } catch (error) {
            logError('Failed to open activity modal:', error);
            uiModals.showToast('Failed to open activity modal', 'error');
        }
    }

    /**
     * @description Close Activity Modal
     */
    closeActivityModal() {
        uiModals.closeModal('activity-modal');
    }

    /**
     * @description Save new activity
     */
    async saveActivity() {
        try {
            // Check if this is an edit (has activity-id)
            const existingId = document.getElementById('activity-id')?.value;
            if (existingId) {
                // This is an edit, use updateActivity instead
                await this.updateActivity();
                return;
            }
            
            logDebug('Saving new activity');
            
            const formData = this.getActivityFormData();
            if (!formData) {
                return; // Validation failed
            }
            
            // Generate activity ID
            const activities = await db.loadAll('activities');
            const activityId = `activity-${Date.now()}`;
            
            // Get quote data for PC Number
            let pcId = null;
            let pcNumber = null;
            let inheritedAccountManager = null;
            if (formData.quoteId) {
                const quoteData = await db.load('quotes', formData.quoteId);
                if (quoteData) {
                    pcId = quoteData.pcId;
                    pcNumber = quoteData.pcNumber;
                    inheritedAccountManager = quoteData.accountManager || null;
                }
            }
            
            const activityData = {
                id: activityId,
                title: formData.title,
                type: formData.type,
                quoteId: formData.quoteId || null,
                pcId: pcId,
                pcNumber: pcNumber,
                scheduledDate: formData.scheduledDate,
                duration: formData.duration || 60,
                status: formData.status || 'pending',
                priority: formData.priority || 'medium',
                assignedTo: formData.assignedTo || 'Unassigned',
                accountManager: inheritedAccountManager,
                description: formData.description || '',
                createdAt: new Date().toISOString(),
                lastModifiedAt: new Date().toISOString(),
                createdBy: this.currentUser || 'User',
                editedBy: this.currentUser || 'User'
            };
            
            await db.save('activities', activityData);
            uiModals.showToast(`Activity "${activityData.title}" created successfully!`, 'success');
            
            // Clear cache since activities were modified
            this.clearActivitiesCache();
            
            // Clear form and close modal
            this.clearActivityForm();
            this.closeActivityModal();
            
            // Refresh activities list if we're on activities page
            if (this.currentPage === 'activities') {
                await this.loadActivitiesData();
            }
            
            logDebug('Activity saved successfully:', activityData);
            
        } catch (error) {
            logError('Failed to save activity:', error);
            uiModals.showToast('Failed to save activity', 'error');
        }
    }

    /**
     * @description Get form data from activity form
     */
    getActivityFormData() {
        const title = document.getElementById('activity-title')?.value.trim();
        const type = document.getElementById('activity-type')?.value.trim();
        const quoteSelect = document.getElementById('activity-quote-select');
        
        if (!title || !type) {
            uiModals.showToast('Please fill in required fields (Title, Type)', 'error');
            return null;
        }
        
        const scheduledDateField = document.getElementById('activity-scheduled-date');
        const scheduledTimeField = document.getElementById('activity-scheduled-time');
        
        let scheduledDate = null;
        if (scheduledDateField?.value && scheduledTimeField?.value) {
            scheduledDate = new Date(`${scheduledDateField.value}T${scheduledTimeField.value}`).toISOString();
        }
        
        return {
            title: title,
            type: type,
            quoteId: quoteSelect?.value || null,
            scheduledDate: scheduledDate,
            duration: parseInt(document.getElementById('activity-duration')?.value || 60),
            status: document.getElementById('activity-status')?.value || 'pending',
            priority: document.getElementById('activity-priority')?.value || 'medium',
            assignedTo: document.getElementById('activity-assigned-to-name')?.value.trim() || 'Unassigned',
            description: document.getElementById('activity-description')?.value.trim() || ''
        };
    }

    /**
     * @description Clear activity form
     */
    clearActivityForm() {
        const form = document.getElementById('activity-form');
        if (form) {
            form.reset();
        }
        
        // Clear activity ID to ensure this is treated as a new activity
        const activityIdField = document.getElementById('activity-id');
        if (activityIdField) activityIdField.value = '';
        
        // Reset to default values
        const statusField = document.getElementById('activity-status');
        const priorityField = document.getElementById('activity-priority');
        if (statusField) statusField.value = 'pending';
        if (priorityField) priorityField.value = 'medium';
    }

    /**
     * @description Edit Activity - opens modal with activity data
     */
    async editActivity(id) {
        try {
            logDebug(`Opening activity edit modal for ID: ${id}`);
            
            const activityData = await db.load('activities', id);
            if (!activityData) {
                logError(`Activity not found: ${id}`);
                uiModals.showToast('Activity not found', 'error');
                return;
            }
            
            logDebug('Activity data loaded:', activityData);
            
            // Load Quotes for dropdown first
            const quotes = await db.loadAll('quotes');
            const quoteSelect = document.getElementById('activity-quote-select');
            
            if (quoteSelect) {
                quoteSelect.innerHTML = '<option value="">Select Quote</option>';
                quotes.forEach(quote => {
                    quoteSelect.innerHTML += `<option value="${quote.id}" data-quote-number="${quote.quoteNumber}">${quote.quoteNumber} - ${quote.clientName}</option>`;
                });
            }
            
            // Populate form fields with activity data
            const fields = [
                { id: 'activity-id', value: activityData.id || '' },
                { id: 'activity-title', value: activityData.title || '' },
                { id: 'activity-type', value: activityData.type || '' },
                { id: 'activity-quote-select', value: activityData.quoteId || '' },
                { id: 'activity-status', value: activityData.status || 'pending' },
                { id: 'activity-priority', value: activityData.priority || 'medium' },
                { id: 'activity-assigned-to-name', value: activityData.assignedTo || '' },
                { id: 'activity-description', value: activityData.description || '' },
                { id: 'activity-duration', value: activityData.duration || 60 }
            ];
            
            fields.forEach(field => {
                const element = document.getElementById(field.id);
                if (element) {
                    element.value = field.value;
                    logDebug(`Set ${field.id} = ${field.value}`);
                } else {
                    logError(`Field not found: ${field.id}`);
                }
            });
            
            // Handle scheduled date and time separately
            if (activityData.scheduledDate) {
                const scheduledDate = new Date(activityData.scheduledDate);
                const dateField = document.getElementById('activity-scheduled-date');
                const timeField = document.getElementById('activity-scheduled-time');
                
                if (dateField) {
                    dateField.value = scheduledDate.toISOString().split('T')[0];
                }
                if (timeField) {
                    timeField.value = scheduledDate.toTimeString().slice(0, 5);
                }
            }
            
            // Set modal title for editing
            const modalTitle = document.getElementById('activity-modal-title');
            if (modalTitle) {
                modalTitle.textContent = `Edit Activity: ${activityData.title}`;
            }
            
            // Close details modal if it's open
            const detailsModal = document.getElementById('activity-details-modal');
            if (detailsModal && detailsModal.style.display !== 'none') {
                uiModals.closeModal('activity-details-modal');
            }
            
            // Open modal
            await uiModals.openModal('activity-modal');
            uiModals.showToast(`Editing "${activityData.title}"`, 'info');
            logDebug('Activity edit modal opened successfully');
            
        } catch (error) {
            logError('Failed to open activity edit modal:', error);
            uiModals.showToast('Failed to load activity', 'error');
        }
    }

    /**
     * @description Update Activity - saves changes to existing activity
     */
    async updateActivity() {
        try {
            logDebug('Updating activity');
            
            const id = document.getElementById('activity-id')?.value;
            if (!id) {
                // This is a new activity, use saveActivity instead
                await this.saveActivity();
                return;
            }
            
            // Load existing activity
            const existingActivity = await db.load('activities', id);
            if (!existingActivity) {
                uiModals.showToast('Activity not found', 'error');
                return;
            }
            
            // Get form data
            const formData = this.getActivityFormData();
            if (!formData) {
                return; // Validation failed
            }
            
            // Get PC Number from quote if quote is selected
            let pcId = null;
            let pcNumber = null;
            let inheritedAccountManager = existingActivity.accountManager || null;
            if (formData.quoteId) {
                const quoteData = await db.load('quotes', formData.quoteId);
                if (quoteData) {
                    pcId = quoteData.pcId;
                    pcNumber = quoteData.pcNumber;
                    inheritedAccountManager = quoteData.accountManager || inheritedAccountManager;
                }
            }
            
            // Update activity data
            const updatedActivity = {
                ...existingActivity,
                title: formData.title,
                type: formData.type,
                quoteId: formData.quoteId || null,
                pcId: pcId,
                pcNumber: pcNumber,
                scheduledDate: formData.scheduledDate,
                duration: formData.duration,
                status: formData.status,
                priority: formData.priority,
                assignedTo: formData.assignedTo,
                accountManager: inheritedAccountManager,
                description: formData.description,
                lastModifiedAt: new Date().toISOString(),
                editedBy: this.currentUser || 'User'
            };
            
            await db.save('activities', updatedActivity);
            uiModals.showToast(`Activity "${updatedActivity.title}" updated successfully!`, 'success');
            
            // Clear cache since activities were modified
            this.clearActivitiesCache();
            
            // Clear form and close modal
            this.clearActivityForm();
            this.closeActivityModal();
            
            // Refresh activities list if we're on activities page
            if (this.currentPage === 'activities') {
                await this.loadActivitiesData();
            }
            
            logDebug('Activity updated successfully:', updatedActivity);
            
        } catch (error) {
            logError('Failed to update activity:', error);
            uiModals.showToast('Failed to update activity', 'error');
        }
    }
    /**
     * @description View Activity Details - opens detailed view
     */
    async viewActivityDetails(id) {
        try {
            logDebug(`Opening activity details for ID: ${id}`);
            
            const activity = await db.load('activities', id);
            if (!activity) {
                logError(`Activity not found: ${id}`);
                uiModals.showToast('Activity not found', 'error');
                return;
            }
            
            // Get related data
            const pcNumber = activity.pcNumber ? await db.load('pcNumbers', activity.pcNumber) : null;
            const quote = activity.quoteId ? await db.load('quotes', activity.quoteId) : null;
            
            // Format dates
            const scheduledDate = activity.scheduledDate ? new Date(activity.scheduledDate).toLocaleDateString() : 'Not scheduled';
            const completedDate = activity.completedDate ? new Date(activity.completedDate).toLocaleDateString() : null;
            const createdDate = activity.createdAt ? new Date(activity.createdAt).toLocaleDateString() : 'Unknown';
            
            // Format status with appropriate styling
            const statusColors = {
                'pending': '#d97706',
                'in-progress': '#3b82f6', 
                'completed': '#059669',
                'cancelled': '#dc2626'
            };
            const statusColor = statusColors[activity.status] || '#6b7280';
            
            // Create detailed HTML
            const detailsHtml = `
                <div style="padding: 1rem;">
                    <h3 style="margin: 0 0 1rem 0; color: #374151;">${activity.title}</h3>
                    
                    <!-- Basic Information -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                        <div><strong>Type:</strong> ${activity.type || 'N/A'}</div>
                        <div><strong>Priority:</strong> ${activity.priority || 'Medium'}</div>
                        <div><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: 600;">${activity.status || 'pending'}</span></div>
                        <div><strong>Assigned To:</strong> ${activity.assignedTo || 'Unassigned'}</div>
                    </div>
                    
                    <!-- Scheduling Information -->
                    <div style="margin-bottom: 1rem;">
                        <h4 style="margin: 0 0 0.5rem 0; color: #374151;">Scheduling</h4>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div><strong>Scheduled Date:</strong> ${scheduledDate}</div>
                            <div><strong>Duration:</strong> ${activity.duration || 'Not specified'}</div>
                            ${completedDate ? `<div><strong>Completed:</strong> ${completedDate}</div>` : ''}
                        </div>
                    </div>
                    
                    <!-- Project Links -->
                    <div style="margin-bottom: 1rem;">
                        <h4 style="margin: 0 0 0.5rem 0; color: #374151;">Project Links</h4>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div><strong>PC Number:</strong> ${pcNumber ? `<a href="#" onclick="window.navigateToPage('pc-detail')" style="color: #3b82f6;">${pcNumber.pcNumber}</a>` : 'None'}</div>
                            <div><strong>Quote:</strong> ${quote ? `<a href="#" onclick="window.viewQuoteDetails('${quote.id}')" style="color: #3b82f6;">${quote.id}</a>` : 'None'}</div>
                        </div>
                        ${pcNumber ? `<div style="margin-top: 0.5rem; color: #6b7280; font-size: 0.875rem;">Company: ${pcNumber.companyName}</div>` : ''}
                    </div>
                    
                    <!-- Description -->
                    ${activity.description ? `
                    <div style="margin-bottom: 1rem;">
                        <h4 style="margin: 0 0 0.5rem 0; color: #374151;">Description</h4>
                        <p style="margin: 0; color: #6b7280; background: #f9fafb; padding: 0.75rem; border-radius: 0.375rem;">${activity.description}</p>
                    </div>
                    ` : ''}
                    
                    <!-- Notes -->
                    ${activity.notes ? `
                    <div style="margin-bottom: 1rem;">
                        <h4 style="margin: 0 0 0.5rem 0; color: #374151;">Notes</h4>
                        <p style="margin: 0; color: #6b7280; background: #f9fafb; padding: 0.75rem; border-radius: 0.375rem;">${activity.notes}</p>
                    </div>
                    ` : ''}
                    
                    <!-- Completion Notes (if completed) -->
                    ${activity.completionNotes && activity.status === 'completed' ? `
                    <div style="margin-bottom: 1rem;">
                        <h4 style="margin: 0 0 0.5rem 0; color: #374151;">Completion Notes</h4>
                        <p style="margin: 0; color: #6b7280; background: #f0f9ff; padding: 0.75rem; border-radius: 0.375rem; border-left: 4px solid #3b82f6;">${activity.completionNotes}</p>
                    </div>
                    ` : ''}
                    
                    <!-- Metadata -->
                    <div style="font-size: 0.875rem; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 1rem;">
                        <div>Created: ${createdDate} by ${activity.createdBy || 'Unknown'}</div>
                        ${activity.lastModifiedAt ? `<div>Modified: ${new Date(activity.lastModifiedAt).toLocaleDateString()} by ${activity.editedBy || 'Unknown'}</div>` : ''}
                    </div>
                    
                    <!-- Action Buttons -->
                    <div style="text-align: right; margin-top: 1rem;">
                        <button onclick="window.editActivity('${activity.id}')" style="background: #3b82f6; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.375rem; margin-right: 0.5rem;">Edit Activity</button>
                        <button onclick="window.closeActivityDetailsModal()" style="background: #6b7280; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.375rem;">Close</button>
                    </div>
                </div>
            `;

            // Create or update details modal
            let modal = document.getElementById('activity-details-modal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'activity-details-modal';
                modal.className = 'modal';
                modal.innerHTML = `<div class="modal-content" style="max-width: 700px;">${detailsHtml}</div>`;
                document.body.appendChild(modal);
            } else {
                modal.querySelector('.modal-content').innerHTML = detailsHtml;
            }

            uiModals.openModal('activity-details-modal');
            
            logDebug('Activity details shown for:', id);
            
        } catch (error) {
            logError('Failed to open activity details:', error);
            uiModals.showToast('Failed to load activity details', 'error');
        }
    }

    // ===== QUOTES FUNCTIONALITY =====
    
    /**
     * @description Open Quote Modal for creating new quote
     * @param {string} pcId - Optional PC ID to pre-select and disable PC dropdown
     */
    async openQuoteModal(pcId = null) {
        try {
            logDebug('Opening new quote modal', pcId ? `with PC ID: ${pcId}` : '');
            
            // Load PC Numbers and Companies for dropdowns
            const pcNumbers = await db.loadAll('pcNumbers');
            const uniqueCompanies = Array.from(new Set(pcNumbers.map(pc => pc.company).filter(Boolean))).sort((a,b)=>a.localeCompare(b));
            const companySelect = document.getElementById('quote-modal-company');
            if (companySelect) {
                companySelect.innerHTML = '<option value="">Select Company...</option>';
                uniqueCompanies.forEach(c => { companySelect.innerHTML += `<option value="${c}">${c}</option>`; });
            }
            const pcSelect = document.getElementById('quote-modal-pc');
            
            if (pcSelect) {
                pcSelect.innerHTML = '<option value="">Select PC Number</option>';
                const populatePcOptions = (list) => {
                    pcSelect.innerHTML = '<option value="">Select PC Number</option>';
                    list.forEach(pc => {
                        pcSelect.innerHTML += `<option value="${pc.id}" data-pc-number="${pc.pcNumber}" data-company="${pc.company||''}">${pc.pcNumber} - ${pc.company||''}</option>`;
                    });
                };
                populatePcOptions(pcNumbers);
                if (companySelect) {
                    companySelect.onchange = () => {
                        const val = companySelect.value;
                        const filtered = val ? pcNumbers.filter(p => (p.company||'') === val) : pcNumbers;
                        populatePcOptions(filtered);
                    };
                }
                
                // Attach immediate validation on selection (only when not locked)
                pcSelect.onchange = async () => {
                    try {
                        if (pcSelect.disabled) return;
                        const selectedId = pcSelect.value;
                        if (!selectedId) return;
                        const pcData = await db.load('pcNumbers', selectedId);
                        if (!pcData) return;
                        const validation = this.validatePcForQuoteCreation(pcData);
                        if (!validation.isValid) {
                            uiModals.showToast(
                                `⚠️ This PC Number ("${pcData.pcNumber}") cannot be used to create a Quote.\n\nMissing required fields:\n• ${validation.missingFields.join('\n• ')}\n\nPlease edit the PC Number first.`,
                                'error'
                            );
                            pcSelect.value = '';
                        } else {
                            // Prefill company if available
                            const companyField = document.getElementById('quote-modal-company');
                            if (companyField && pcData.company) {
                                companyField.value = pcData.company;
                            }
                            // Auto-set Account Manager from PC and hide AM section
                            const amSelect = document.getElementById('quote-modal-account-manager');
                            const amSection = document.getElementById('quote-modal-account-manager-section');
                            if (amSelect) {
                                if (pcData.accountManager) {
                                    amSelect.value = pcData.accountManager;
                                    amSelect.required = false;
                                    if (amSection) amSection.style.display = 'none';
                                } else {
                                    amSelect.value = '';
                                    amSelect.required = true;
                                    if (amSection) amSection.style.display = '';
                                }
                            }
                        }
                    } catch (e) {
                        logError('PC selection validation failed:', e);
                    }
                };

                // If pcId provided, pre-select and disable; also prefill company and AM
                if (pcId) {
                    pcSelect.value = pcId;
                    pcSelect.disabled = true;
                    pcSelect.style.backgroundColor = '#f3f4f6'; // Gray background
                    pcSelect.style.cursor = 'not-allowed';
                    logDebug(`PC Number dropdown disabled and set to PC ID: ${pcId}`);

                    // Prefill company select to match chosen PC
                    try {
                        const pcData = pcNumbers.find(p => p.id === pcId) || (await db.load('pcNumbers', pcId));
                        const companyField = document.getElementById('quote-modal-company');
                        if (companyField && pcData?.company) {
                            companyField.value = pcData.company;
                            // Optionally lock the company field visually
                            companyField.style.backgroundColor = '#f3f4f6';
                        }
                        // Auto-set Account Manager from PC and hide AM section if available
                        const amSelectInit = document.getElementById('quote-modal-account-manager');
                        const amSectionInit = document.getElementById('quote-modal-account-manager-section');
                        if (amSelectInit) {
                            if (pcData?.accountManager) {
                                amSelectInit.value = pcData.accountManager;
                                amSelectInit.required = false;
                                if (amSectionInit) amSectionInit.style.display = 'none';
                            } else {
                                amSelectInit.value = '';
                                amSelectInit.required = true;
                                if (amSectionInit) amSectionInit.style.display = '';
                            }
                        }
                    } catch (_) {}

                    // Show locked message
                    const helpText = document.getElementById('pc-select-help');
                    const lockedText = document.getElementById('pc-select-locked');
                    if (helpText) helpText.style.display = 'none';
                    if (lockedText) lockedText.style.display = 'block';
                } else {
                    // Enable dropdown for manual selection
                    pcSelect.disabled = false;
                    pcSelect.style.backgroundColor = '';
                    pcSelect.style.cursor = '';
                    
                    // Show help message
                    const helpText = document.getElementById('pc-select-help');
                    const lockedText = document.getElementById('pc-select-locked');
                    if (helpText) helpText.style.display = 'block';
                    if (lockedText) lockedText.style.display = 'none';
                }
            }
            
            // Load Price Lists for dropdown
            const priceLists = await db.loadAll('priceLists');
            const priceListSelect = document.getElementById('quote-modal-pricelist');
            
            if (priceListSelect) {
                priceListSelect.innerHTML = '<option value="">Select Price List</option>';
                priceLists.forEach(pl => {
                    priceListSelect.innerHTML += `<option value="${pl.id}">${pl.name}</option>`;
                });
            }
            
            // Reset AM UI when not coming from PC
            const amSection = document.getElementById('quote-modal-account-manager-section');
            const amSelect = document.getElementById('quote-modal-account-manager');
            if (amSection && amSelect && !pcId) {
                amSection.style.display = '';
                amSelect.required = true;
                amSelect.value = '';
            }
            
            // Open modal
            await uiModals.openModal('quote-modal');
            logDebug('Quote modal opened successfully');
            
        } catch (error) {
            logError('Failed to open quote modal:', error);
            uiModals.showToast('Failed to open quote modal', 'error');
        }
    }

    /**
     * @description Step 1 submit: validate selections and open full-screen Quote Builder prefilled
     */
    async proceedToQuoteBuilderFromModal() {
        try {
            const formData = await this.getQuoteFormData();
            if (!formData) return;

            // Close modal
            this.closeQuoteModal();

            // Open builder and prefill context
            await this.openQuoteBuilder(formData.pcId);

            // Prefill builder fields: account manager, property type, and price list
            const amEl = document.getElementById('builder-account-manager');
            if (amEl && formData.accountManager) amEl.value = formData.accountManager;
            const ptEl = document.getElementById('builder-property-type');
            if (ptEl) ptEl.value = formData.propertyType || '';

            // Set price list and trigger builder PL load
            const builderPlSelect = document.getElementById('quote-price-list');
            if (builderPlSelect) {
                builderPlSelect.value = formData.priceListId || '';
                await this.handlePriceListChange();
            }

            // Ensure the PC dropdown contains ALL PCs by clearing any builder-side filters
            const clientInput = document.getElementById('builder-client-name');
            if (clientInput) clientInput.value = '';
            const manualPcInput = document.getElementById('builder-pc-number-manual');
            if (manualPcInput) manualPcInput.value = '';
            await this.builderUpdatePcDropdown();

            // Preselect the PC we chose in modal in the builder dropdown and chip
            const sel = document.getElementById('builder-pc-select');
            if (sel) sel.value = formData.pcId;
            await this.builderSelectPcFromDropdown();

            // Hide Step 1 and Step 2 sections once we came from Step 1 modal
            const step1Card = document.getElementById('builder-step-client');
            const plSelector = document.getElementById('price-list-selector');
            if (step1Card) step1Card.style.display = 'none';
            if (plSelector) plSelector.style.display = 'none';

            uiModals.showToast('Proceeding to Quote Builder…', 'success');
        } catch (e) {
            logError('Failed to proceed to builder from modal:', e);
            uiModals.showToast('Failed to open Quote Builder', 'error');
        }
    }

    /**
     * @description Close Quote Modal
     */
    closeQuoteModal() {
        // Re-enable PC Number dropdown in case it was disabled
        const pcSelect = document.getElementById('quote-modal-pc');
        if (pcSelect) {
            pcSelect.disabled = false;
            pcSelect.style.backgroundColor = '';
            pcSelect.style.cursor = '';
        }
        
        // Reset help text
        const helpText = document.getElementById('pc-select-help');
        const lockedText = document.getElementById('pc-select-locked');
        if (helpText) helpText.style.display = 'block';
        if (lockedText) lockedText.style.display = 'none';
        
        uiModals.closeModal('quote-modal');
    }
    /**
     * @description Save new quote
     */
    async saveQuote() {
        try {
            logDebug('Saving new quote');
            
            const formData = await this.getQuoteFormData();
            if (!formData) {
                return; // Validation failed
            }
            
            // Generate quote number
            const quotes = await db.loadAll('quotes');
            const nextNumber = String(quotes.length + 1).padStart(6, '0');
            const quoteNumber = `QT-${nextNumber}`;
            
            // Get PC data for client name
            const pcData = await db.load('pcNumbers', formData.pcId);
            const clientName = pcData ? pcData.company : 'Unknown Client';
            
            const quoteData = {
                id: `quote-${Date.now()}`,
                quoteNumber: quoteNumber,
                pcId: formData.pcId,
                pcNumber: formData.pcNumber,
                clientName: clientName,
                accountManager: formData.accountManager,
                totalAmount: 0, // Will be calculated when items are added
                status: 'draft',
                    propertyType: formData.propertyType || '',
                priceListId: formData.priceListId,
                createdAt: new Date().toISOString(),
                lastModifiedAt: new Date().toISOString(),
                createdBy: this.currentUser || 'User',
                editedBy: this.currentUser || 'User',
                items: []
            };
            
            await db.save('quotes', quoteData);
            uiModals.showToast(`Quote ${quoteNumber} created successfully!`, 'success');
            
            // Clear form and close modal
            this.clearQuoteForm();
            this.closeQuoteModal();
            
            // Refresh quotes list if we're on quotes page
            if (this.currentPage === 'quotes') {
                await this.loadQuotesData();
            }
            
            logDebug('Quote saved successfully:', quoteData);
            
            // Immediately open Quote Edit Modal for further editing
            setTimeout(async () => {
                await this.openQuoteEditModal(quoteData.id);
            }, 500); // Small delay to allow modal transition
            
        } catch (error) {
            logError('Failed to save quote:', error);
            uiModals.showToast('Failed to save quote', 'error');
        }
    }

    /**
     * @description Get form data from quote form
     */
    async getQuoteFormData() {
        const pcSelect = document.getElementById('quote-modal-pc');
        const priceListSelect = document.getElementById('quote-modal-pricelist');
        const accountManagerSelect = document.getElementById('quote-modal-account-manager');
        const propertyTypeSelect = document.getElementById('quote-modal-property-type');
        
        if (!pcSelect?.value) {
            uiModals.showToast('Please select a PC Number', 'error');
            return null;
        }
        
        if (!priceListSelect?.value) {
            uiModals.showToast('Please select a Price List', 'error');
            return null;
        }
        
        // Account Manager can be auto-provided from PC (then AM select may be hidden and empty)
        
        // Validate PC Number has required fields for Quote creation
        const pcData = await db.load('pcNumbers', pcSelect.value);
        if (pcData) {
            const validation = this.validatePcForQuoteCreation(pcData);
            if (!validation.isValid) {
                const missingFieldsList = validation.missingFields.join(', ');
                uiModals.showToast(
                    `⚠️ Cannot create Quote from PC Number ${pcData.pcNumber}!\n\nMissing required fields:\n• ${validation.missingFields.join('\n• ')}\n\nPlease edit the PC Number and fill in these fields first.`, 
                    'error'
                );
            return null;
            }
        }
        
        const selectedOption = pcSelect.options[pcSelect.selectedIndex];
        const pcNumber = selectedOption?.getAttribute('data-pc-number') || '';
        
        return {
            pcId: pcSelect.value,
            pcNumber: pcNumber,
            priceListId: priceListSelect.value,
            accountManager: accountManagerSelect?.value || (pcData?.accountManager || ''),
            propertyType: propertyTypeSelect ? propertyTypeSelect.value : ''
        };
    }

    /**
     * @description Clear quote form
     */
    clearQuoteForm() {
        const form = document.getElementById('new-quote-form');
        if (form) {
            form.reset();
        }
        // Also hide company dropdown
        this.hideCompanyDropdown();
    }

    /**
     * @description Search companies for quote company field
     */
    async searchCompanies(query) {
        try {
            const pcNumbers = await db.loadAll('pcNumbers');
            const resultsContainer = document.getElementById('company-search-results');
            
            if (!resultsContainer) return;
            
            if (!query || query.trim().length === 0) {
                resultsContainer.style.display = 'none';
                // Show all PC Numbers when no company filter
                await this.updatePcNumberDropdown(pcNumbers);
                return;
            }
            
            // Filter companies by query
            const filteredCompanies = pcNumbers.filter(pc => 
                pc.company && pc.company.toLowerCase().includes(query.toLowerCase())
            );
            
            // Get unique companies
            const uniqueCompanies = [...new Set(filteredCompanies.map(pc => pc.company))];
            
            if (uniqueCompanies.length === 0) {
                resultsContainer.innerHTML = '<div style="padding: 0.5rem; color: #6b7280;">No companies found</div>';
                resultsContainer.style.display = 'block';
                // Show all PC Numbers if no match
                await this.updatePcNumberDropdown(pcNumbers);
                return;
            }
            
            // Display company results
            resultsContainer.innerHTML = uniqueCompanies.map(company => `
                <div onclick="window.selectCompany('${company}')" 
                     style="padding: 0.5rem; cursor: pointer; border-bottom: 1px solid #f1f5f9;"
                     onmouseover="this.style.backgroundColor='#f8fafc'"
                     onmouseout="this.style.backgroundColor='white'">
                    ${company}
                </div>
            `).join('');
            
            resultsContainer.style.display = 'block';
            
            // Update PC Numbers dropdown to show only for filtered companies
            await this.updatePcNumberDropdown(filteredCompanies);
            
        } catch (error) {
            logError('Failed to search companies:', error);
        }
    }

    /**
     * @description Show company dropdown
     */
    showCompanyDropdown() {
        const resultsContainer = document.getElementById('company-search-results');
        const input = document.getElementById('quote-modal-company');
        
        if (resultsContainer && input && input.value.trim().length > 0) {
            resultsContainer.style.display = 'block';
        }
    }

    /**
     * @description Hide company dropdown
     */
    hideCompanyDropdown() {
        const resultsContainer = document.getElementById('company-search-results');
        if (resultsContainer) {
            resultsContainer.style.display = 'none';
        }
    }

    /**
     * @description Select company from dropdown
     */
    async selectCompany(companyName) {
        try {
            const input = document.getElementById('quote-modal-company');
            if (input) {
                input.value = companyName;
            }
            
            this.hideCompanyDropdown();
            
            // Filter PC Numbers for this company
            const pcNumbers = await db.loadAll('pcNumbers');
            const filteredPcNumbers = pcNumbers.filter(pc => pc.company === companyName);
            await this.updatePcNumberDropdown(filteredPcNumbers);
            
            logDebug(`Selected company: ${companyName}, found ${filteredPcNumbers.length} PC Numbers`);
            
        } catch (error) {
            logError('Failed to select company:', error);
        }
    }

    /**
     * @description Update PC Number dropdown with filtered results
     */
    async updatePcNumberDropdown(pcNumbers) {
        const pcSelect = document.getElementById('quote-modal-pc');
        if (!pcSelect) return;
        
        pcSelect.innerHTML = '<option value="">Select PC Number...</option>';
        
        pcNumbers.forEach(pc => {
            pcSelect.innerHTML += `<option value="${pc.id}" data-pc-number="${pc.pcNumber}">${pc.pcNumber} - ${pc.company}</option>`;
        });
        
        logDebug(`Updated PC Number dropdown with ${pcNumbers.length} options`);
    }

    /**
     * @description Open Quote Edit Modal
     */
    async openQuoteEditModal(id) {
        try {
            logDebug(`Opening quote edit modal for ID: ${id}`);
            
            const quoteData = await db.load('quotes', id);
            if (!quoteData) {
                logError(`Quote not found: ${id}`);
                uiModals.showToast('Quote not found', 'error');
                return;
            }
            
            logDebug('Quote data loaded:', quoteData);
            
            // Check if modal exists
            const modal = document.getElementById('quote-edit-modal');
            if (!modal) {
                logError('Quote Edit modal not found in DOM');
                uiModals.showToast('Edit modal not available', 'error');
                return;
            }
            
            // Ensure Account Managers dropdown is populated before setting value
            try {
                if (!this.accountManagersCache || this.accountManagersCache.length === 0) {
                    this.accountManagersCache = await db.loadAll('accountManagers');
                    // Fallback: seed from existing data if store is empty
                    if ((this.accountManagersCache?.length || 0) === 0) {
                        const [pcs, quotes, activities] = await Promise.all([
                            db.loadAll('pcNumbers'),
                            db.loadAll('quotes'),
                            db.loadAll('activities')
                        ]);
                        const names = new Set();
                        pcs.forEach(x => { if (x?.accountManager) names.add(String(x.accountManager).trim()); });
                        quotes.forEach(x => { if (x?.accountManager) names.add(String(x.accountManager).trim()); });
                        activities.forEach(x => { if (x?.accountManager) names.add(String(x.accountManager).trim()); });
                        for (const name of Array.from(names).filter(Boolean)) {
                            await db.save('accountManagers', { name, createdAt: new Date().toISOString() });
                        }
                        this.accountManagersCache = await db.loadAll('accountManagers');
                    }
                    this.accountManagersCache.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                }
                this.populateAllAccountManagerSelects();
                const amSelect = document.getElementById('quote-edit-account-manager');
                if (amSelect) amSelect.value = quoteData.accountManager || '';
            } catch (_) {}
            
            // Populate form fields
            const fields = [
                { id: 'quote-edit-id', value: quoteData.id || '' },
                { id: 'quote-edit-number', value: quoteData.quoteNumber || '' },
                { id: 'quote-edit-status', value: quoteData.status || 'pending' },
                { id: 'quote-edit-pc-number', value: quoteData.pcNumber || '' },
                { id: 'quote-edit-value', value: quoteData.totalAmount || 0 },
                { id: 'quote-edit-client-name', value: quoteData.clientName || '' },
                { id: 'quote-edit-project-title', value: quoteData.projectTitle || '' },
                { id: 'quote-edit-account-manager', value: quoteData.accountManager || '' },
                { id: 'quote-edit-version', value: quoteData.version || 1 },
                { id: 'quote-edit-net-total', value: quoteData.netTotal || quoteData.totalAmount || 0 },
                { id: 'quote-edit-vat-rate', value: quoteData.vatRate || 20.00 },
                { id: 'quote-edit-vat-amount', value: quoteData.vatAmount || 0 },
                { id: 'quote-edit-discount', value: quoteData.discount || 0 },
                { id: 'quote-edit-total-cost', value: quoteData.totalCost || quoteData.totalAmount || 0 }
            ];
            
            fields.forEach(field => {
                const element = document.getElementById(field.id);
                if (element) {
                    element.value = field.value;
                    logDebug(`Set ${field.id} = ${field.value}`);
                } else {
                    logError(`Field not found: ${field.id}`);
                }
            });
            
            // Make quote number and PC number non-editable
            const quoteNumberField = document.getElementById('quote-edit-number');
            const pcNumberField = document.getElementById('quote-edit-pc-number');
            if (quoteNumberField) quoteNumberField.readOnly = true;
            if (pcNumberField) pcNumberField.readOnly = true;
            // Lock style hint
            if (quoteNumberField) quoteNumberField.classList.add('readonly');
            if (pcNumberField) pcNumberField.classList.add('readonly');

            // Set property type if exists
            const propertyTypeField = document.getElementById('quote-edit-property-type');
            if (propertyTypeField && typeof quoteData.propertyType === 'string') {
                propertyTypeField.value = quoteData.propertyType;
            }
            
            // Set valid until date if exists
            const validUntilField = document.getElementById('quote-edit-valid-until');
            if (validUntilField && quoteData.validUntil) {
                const date = new Date(quoteData.validUntil);
                validUntilField.value = date.toISOString().split('T')[0];
            }
            
            // Show modal using uiModals
            await uiModals.openModal('quote-edit-modal');
            uiModals.showToast(`Editing ${quoteData.quoteNumber}`, 'info');
            logDebug('Quote edit modal opened successfully');
            
        } catch (error) {
            logError('Failed to open quote edit modal:', error);
            uiModals.showToast('Failed to load quote', 'error');
        }
    }

    /**
     * @description Close Quote Edit Modal
     */
    closeQuoteEditModal() {
        uiModals.closeModal('quote-edit-modal');
    }

    /**
     * @description Update Quote
     */
    async updateQuote() {
        try {
            logDebug('Updating quote');
            
            const id = document.getElementById('quote-edit-id')?.value;
            if (!id) {
                uiModals.showToast('Quote ID not found', 'error');
                return;
            }
            
            // Load existing quote
            const existingQuote = await db.load('quotes', id);
            if (!existingQuote) {
                uiModals.showToast('Quote not found', 'error');
                return;
            }
            
            // Get form data
            const formData = this.getQuoteEditFormData();
            if (!formData) {
                return; // Validation failed
            }
            
            // Update quote data
            const updatedQuote = {
                ...existingQuote,
                ...formData,
                lastModifiedAt: new Date().toISOString(),
                editedBy: this.currentUser || 'User'
            };
            
            await db.save('quotes', updatedQuote);
            uiModals.showToast(`Quote ${updatedQuote.quoteNumber} updated successfully!`, 'success');
            
            // Close modal and refresh list
            this.closeQuoteEditModal();
            
            if (this.currentPage === 'quotes') {
                await this.loadQuotesData();
            }
            
            logDebug('Quote updated successfully:', updatedQuote);
            
        } catch (error) {
            logError('Failed to update quote:', error);
            uiModals.showToast('Failed to update quote', 'error');
        }
    }

    /**
     * @description Get Quote Edit Form Data
     */
    getQuoteEditFormData() {
        const quoteNumber = document.getElementById('quote-edit-number')?.value.trim();
        const status = document.getElementById('quote-edit-status')?.value;
        const clientName = document.getElementById('quote-edit-client-name')?.value.trim();
        const accountManager = document.getElementById('quote-edit-account-manager')?.value;
        const propertyType = document.getElementById('quote-edit-property-type')?.value || '';
        
        if (!quoteNumber || !status || !clientName || !accountManager) {
            uiModals.showToast('Please fill in required fields (Quote Number, Status, Client Name, Account Manager)', 'error');
            return null;
        }
        
        // Calculate financial values
        const netTotal = parseFloat(document.getElementById('quote-edit-net-total')?.value || 0);
        const vatRate = parseFloat(document.getElementById('quote-edit-vat-rate')?.value || 20);
        const discount = parseFloat(document.getElementById('quote-edit-discount')?.value || 0);
        
        const vatAmount = (netTotal * vatRate) / 100;
        const totalCost = netTotal + vatAmount - discount;
        
        // Update calculated fields in the form
        const vatAmountField = document.getElementById('quote-edit-vat-amount');
        const totalCostField = document.getElementById('quote-edit-total-cost');
        if (vatAmountField) vatAmountField.value = vatAmount.toFixed(2);
        if (totalCostField) totalCostField.value = totalCost.toFixed(2);
        
        const validUntilField = document.getElementById('quote-edit-valid-until');
        const validUntil = validUntilField?.value ? new Date(validUntilField.value).toISOString() : null;
        
        return {
            quoteNumber: quoteNumber,
            status: status,
            pcNumber: document.getElementById('quote-edit-pc-number')?.value.trim() || '',
            clientName: clientName,
            accountManager: accountManager,
            projectTitle: document.getElementById('quote-edit-project-title')?.value.trim() || '',
            version: parseInt(document.getElementById('quote-edit-version')?.value || 1),
            netTotal: netTotal,
            vatRate: vatRate,
            vatAmount: vatAmount,
            discount: discount,
            totalCost: totalCost,
            totalAmount: totalCost, // Keep totalAmount for backward compatibility
            propertyType: propertyType,
            validUntil: validUntil
        };
    }

    /**
     * @description Open Quote Details Page
     */
    async openQuoteDetailsPage(id) {
        try {
            logDebug(`Opening quote details for ID: ${id}`);
            
            const quoteData = await db.load('quotes', id);
            if (!quoteData) {
                logError(`Quote not found: ${id}`);
                uiModals.showToast('Quote not found', 'error');
                return;
            }
            
            // Store current quote in global state
            window.currentQuote = quoteData;
            
            // Navigate to quote detail page
            await this.navigateToPage('quote-detail');
            
            logDebug(`Quote details loaded for: ${quoteData.quoteNumber || quoteData.id}`);
            
        } catch (error) {
            logError('Failed to open quote details:', error);
            uiModals.showToast('Failed to load quote details', 'error');
        }
    }
    /**
     * @description Save new PC Number
     */
    async savePcNumber() {
        try {
            const formData = this.getPcFormData();
            if (!formData) return;
            
            // Generate PC Number
            const allPcs = await db.loadAll('pcNumbers');
            const nextNumber = (allPcs.length + 1).toString().padStart(6, '0');
            const pcNumber = `PC-${nextNumber}`;
            
            const pcData = {
                id: `pc-${Date.now()}`,
                pcNumber: pcNumber,
                company: formData.company,
                projectTitle: formData.projectTitle || '',
                projectDescription: formData.projectDescription || '',
                accountManager: formData.accountManager,
                // Classification
                clientCategory: formData.clientCategory || '',
                clientSource: formData.clientSource || '',
                clientSourceDetail: formData.clientSourceDetail || '',
                industry: formData.industry || '',
                sicCode1: formData.sicCode1,
                sicCode2: formData.sicCode2 || '',
                sicCode3: formData.sicCode3 || '',
                // Contact
                contactFirstName: formData.contactFirstName,
                contactLastName: formData.contactLastName,
                clientTitle: formData.clientTitle || '',
                clientJobTitle: formData.clientJobTitle || '',
                contactEmail: formData.contactEmail || '',
                contactPhone: formData.contactPhone || '',
                // Address
                addressPostcode: formData.addressPostcode,
                address1: formData.address1 || '',
                address2: formData.address2 || '',
                address3: formData.address3 || '',
                address4: formData.address4 || '',
                addressCountry: formData.addressCountry || '',
                // Status
                status: this.isPcComplete(formData) ? 'Complete' : 'Draft',
                createdAt: new Date().toISOString(),
                lastModifiedAt: new Date().toISOString(),
                createdBy: this.currentUser || 'User',
                editedBy: this.currentUser || 'User'
            };
            
            await db.save('pcNumbers', pcData);
            uiModals.showToast(`PC Number ${pcNumber} created successfully!`, 'success');
            
            // Clear form and navigate back
            this.clearPcForm();
            await this.navigateToPage('pcnumbers');
            
        } catch (error) {
            logError('Failed to save PC Number:', error);
            uiModals.showToast('Failed to create PC Number', 'error');
        }
    }

    /**
     * @description Update existing PC Number
     */
    async updatePcNumber() {
        try {
            logDebug('Starting PC Number update...');
            
            const id = document.getElementById('pc-edit-id')?.value;
            if (!id) {
                logError('No PC ID found for editing');
                uiModals.showToast('No PC Number selected for editing', 'error');
                return;
            }
            
            logDebug(`Updating PC Number ID: ${id}`);
            
            const existingPc = await db.load('pcNumbers', id);
            if (!existingPc) {
                logError(`PC Number not found in database: ${id}`);
                uiModals.showToast('PC Number not found', 'error');
                return;
            }
            
            // Validate required fields with visual feedback
            if (!this.validatePcEditForm(existingPc)) {
                return; // Stop if validation fails
            }
            
            // New edit model (use existing values if edit fields not present)
            const company = document.getElementById('pc-edit-company')?.value ?? existingPc.company ?? '';
            const projectTitle = document.getElementById('pc-edit-title')?.value ?? existingPc.projectTitle ?? '';
            const projectDescription = document.getElementById('pc-edit-description')?.value ?? existingPc.projectDescription ?? '';
            const accountManager = document.getElementById('pc-edit-account-manager')?.value ?? existingPc.accountManager ?? '';
            const contactFirstName = document.getElementById('pc-edit-contact-first-name')?.value ?? existingPc.contactFirstName ?? '';
            const contactLastName = document.getElementById('pc-edit-contact-last-name')?.value ?? existingPc.contactLastName ?? '';
            const clientTitle = document.getElementById('pc-edit-contact-client-title')?.value ?? existingPc.clientTitle ?? '';
            const clientJobTitle = document.getElementById('pc-edit-contact-job-title')?.value ?? existingPc.clientJobTitle ?? '';
            const contactEmail = document.getElementById('pc-edit-contact-email')?.value ?? existingPc.contactEmail ?? '';
            const contactPhone = document.getElementById('pc-edit-contact-phone')?.value ?? existingPc.contactPhone ?? '';
            const addressPostcode = document.getElementById('pc-edit-address-postcode')?.value ?? existingPc.addressPostcode ?? existingPc.postcode ?? '';
            const address1 = document.getElementById('pc-edit-address-1')?.value ?? existingPc.address1 ?? '';
            const address2 = document.getElementById('pc-edit-address-2')?.value ?? existingPc.address2 ?? '';
            const address3 = document.getElementById('pc-edit-address-3')?.value ?? existingPc.address3 ?? '';
            const address4 = document.getElementById('pc-edit-address-4')?.value ?? existingPc.address4 ?? '';
            const addressCountry = document.getElementById('pc-edit-address-country')?.value ?? existingPc.addressCountry ?? 'United Kingdom';
            const industry = document.getElementById('pc-edit-industry')?.value ?? existingPc.industry ?? existingPc.clientIndustry ?? '';
            const clientCategory = document.getElementById('pc-edit-client-category')?.value ?? existingPc.clientCategory ?? '';
            const clientSource = document.getElementById('pc-edit-client-source')?.value ?? existingPc.clientSource ?? '';
            const clientSourceDetail = document.getElementById('pc-edit-client-source-detail')?.value ?? existingPc.clientSourceDetail ?? '';
            const sicCode1 = document.getElementById('pc-edit-sic-code-1')?.value ?? existingPc.sicCode1 ?? '';
            const sicCode2 = document.getElementById('pc-edit-sic-code-2')?.value ?? existingPc.sicCode2 ?? '';
            const sicCode3 = document.getElementById('pc-edit-sic-code-3')?.value ?? existingPc.sicCode3 ?? '';

            const tempForm = {
                company, accountManager, contactFirstName, contactLastName, addressPostcode
            };
            
            const updatedData = {
                ...existingPc,
                company: (company || '').trim(),
                projectTitle: (projectTitle || '').trim(),
                projectDescription: (projectDescription || '').trim(),
                accountManager: (accountManager || '').trim(),
                industry: industry || '',
                clientCategory: clientCategory || '',
                clientSource: clientSource || '',
                clientSourceDetail: clientSourceDetail || '',
                sicCode1: this.normalizeSic(sicCode1) || '70100',
                sicCode2: this.normalizeSic(sicCode2) || '',
                sicCode3: this.normalizeSic(sicCode3) || '',
                contactFirstName: (contactFirstName || '').trim(),
                contactLastName: (contactLastName || '').trim(),
                clientTitle: (clientTitle || '').trim(),
                clientJobTitle: (clientJobTitle || '').trim(),
                contactEmail: (contactEmail || '').trim(),
                contactPhone: (contactPhone || '').trim(),
                addressPostcode: (addressPostcode || '').trim(),
                address1: (address1 || '').trim(),
                address2: (address2 || '').trim(),
                address3: (address3 || '').trim(),
                address4: (address4 || '').trim(),
                addressCountry: (addressCountry || '').trim(),
                status: this.isPcComplete(tempForm) ? 'Complete' : 'Draft',
                lastModifiedAt: new Date().toISOString(),
                editedBy: this.currentUser || 'User'
            };
            
            logDebug('Saving updated PC data:', updatedData);
            
            await db.save('pcNumbers', updatedData);
            uiModals.showToast(`PC Number ${existingPc.pcNumber} updated successfully!`, 'success');
            
            this.closePcEditModal();
            await this.loadPcNumbersData(); // Refresh the list
            
            logDebug('PC Number update completed successfully');
            
        } catch (error) {
            logError('Failed to update PC Number:', error);
            uiModals.showToast('Failed to update PC Number', 'error');
        }
    }

    /**
     * @description Normalize SIC code to 5 digits or empty string
     */
    normalizeSic(value) {
        const s = (value || '').toString().replace(/\D/g, '');
        return /^\d{5}$/.test(s) ? s : '';
    }

    /**
     * @description Check if PC Number record is complete (has required fields)
     */
    isPcComplete(formData) {
        return Boolean(
            formData.company && 
            formData.accountManager && 
            formData.contactFirstName && 
            formData.contactLastName && 
            formData.addressPostcode
        );
    }

    /**
     * @description Highlight missing required field with red border and background
     */
    highlightMissingField(fieldId) {
        const field = document.getElementById(fieldId);
        if (field) {
            field.style.border = '2px solid #ef4444';
            field.style.backgroundColor = '#fef2f2';
            field.style.transition = 'all 0.3s ease';
            
            // Add focus event to clear highlighting when user starts typing
            const clearHighlighting = () => {
                field.style.border = '';
                field.style.backgroundColor = '';
                field.removeEventListener('focus', clearHighlighting);
                field.removeEventListener('input', clearHighlighting);
            };
            
            field.addEventListener('focus', clearHighlighting);
            field.addEventListener('input', clearHighlighting);
        }
    }

    /**
     * @description Clear all field highlighting
     */
    clearFieldHighlighting() {
        const fieldIds = [
            'pc-company-name', 'pc-account-manager', 'pc-contact-first-name', 
            'pc-contact-last-name', 'pc-address-postcode',
            // Edit form fields
            'pc-edit-company', 'pc-edit-account-manager', 'pc-edit-contact-first-name',
            'pc-edit-contact-last-name', 'pc-edit-address-postcode'
        ];
        
        fieldIds.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.style.border = '';
                field.style.backgroundColor = '';
            }
        });
    }

    /**
     * @description Apply visual indicators to PC Number form fields
     * Only highlights empty fields that are required
     */
    applyPcFieldIndicators() {
        // Required fields for PC Number creation (red border)
        const pcRequiredFields = [
            'pc-company-name', 'pc-account-manager', 'pc-contact-first-name',
            'pc-contact-last-name', 'pc-address-postcode',
            // Edit form
            'pc-edit-company', 'pc-edit-account-manager', 'pc-edit-contact-first-name',
            'pc-edit-contact-last-name', 'pc-edit-address-postcode'
        ];

        // Required fields for Quote creation (orange border)
        const quoteRequiredFields = [
            'pc-industry', 'pc-client-category', 'pc-client-source',
            'pc-client-source-detail', 'pc-sic-code-1', 'pc-contact-email', 'pc-contact-phone',
            // Edit form
            'pc-edit-industry', 'pc-edit-client-category', 'pc-edit-client-source',
            'pc-edit-client-source-detail', 'pc-edit-sic-code-1', 'pc-edit-contact-email', 'pc-edit-contact-phone'
        ];

        // Clear all existing indicators first
        this.clearPcFieldIndicators();

        // Apply red borders to empty PC required fields
        pcRequiredFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field && this.isFieldEmpty(field)) {
                field.classList.add('pc-field-required');
            }
        });

        // Apply orange borders to empty Quote required fields
        quoteRequiredFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field && this.isFieldEmpty(field)) {
                // Special handling for contact email/phone - only highlight if both are empty
                if (fieldId.includes('contact-email') || fieldId.includes('contact-phone')) {
                    const emailFieldId = fieldId.includes('edit') ? 'pc-edit-contact-email' : 'pc-contact-email';
                    const phoneFieldId = fieldId.includes('edit') ? 'pc-edit-contact-phone' : 'pc-contact-phone';
                    
                    const emailField = document.getElementById(emailFieldId);
                    const phoneField = document.getElementById(phoneFieldId);
                    
                    // Only highlight if both email and phone are empty
                    if (this.isFieldEmpty(emailField) && this.isFieldEmpty(phoneField)) {
                        field.classList.add('pc-field-quote-required');
                    }
                } else {
                    field.classList.add('pc-field-quote-required');
                }
            }
        });
    }

    /**
     * @description Check if field is empty (considering both input and select elements)
     */
    isFieldEmpty(field) {
        if (!field) return true;
        
        if (field.tagName === 'SELECT') {
            return !field.value || field.value === '';
        } else {
            return !field.value || field.value.trim() === '';
        }
    }

    /**
     * @description Clear all PC field indicators
     */
    clearPcFieldIndicators() {
        const allFields = document.querySelectorAll('.pc-field-required, .pc-field-quote-required');
        allFields.forEach(field => {
            field.classList.remove('pc-field-required', 'pc-field-quote-required');
        });
    }
    /**
     * @description Validate PC Number for Quote creation - requires additional fields
     * These fields are optional for PC Number creation but required for Quote creation
     */
    validatePcForQuoteCreation(pcData) {
        const missingFields = [];
        
        // Check required fields for Quote creation (optional for PC Number)
        if (!pcData.industry) {
            missingFields.push('Industry (from Classification & Management section)');
        }
        if (!pcData.clientCategory) {
            missingFields.push('Client Category (from Classification & Management section)');
        }
        if (!pcData.clientSource) {
            missingFields.push('Client Source (from Classification & Management section)');
        }
        if (!pcData.clientSourceDetail) {
            missingFields.push('Client Source Detail (from Classification & Management section)');
        }
        if (!pcData.sicCode1) {
            missingFields.push('SIC Code 1 (from Classification & Management section)');
        }
        
        // Check for at least one contact method (email or phone)
        const hasContactEmail = pcData.contactEmail && pcData.contactEmail.trim();
        const hasContactPhone = pcData.contactPhone && pcData.contactPhone.trim();
        
        if (!hasContactEmail && !hasContactPhone) {
            missingFields.push('Contact Email or Phone Number (from Contact & Address section)');
        }
        
        return {
            isValid: missingFields.length === 0,
            missingFields
        };
    }

    /**
     * @description Validate PC edit form data with visual feedback
     */
    validatePcEditForm(existingPc) {
        const missingFields = [];
        
        // Clear any previous highlighting
        this.clearFieldHighlighting();
        
        // Get form values with fallbacks to existing data
        const company = document.getElementById('pc-edit-company')?.value?.trim() || existingPc.company || '';
        const accountManager = document.getElementById('pc-edit-account-manager')?.value?.trim() || existingPc.accountManager || '';
        const contactFirstName = document.getElementById('pc-edit-contact-first-name')?.value?.trim() || existingPc.contactFirstName || '';
        const contactLastName = document.getElementById('pc-edit-contact-last-name')?.value?.trim() || existingPc.contactLastName || '';
        const addressPostcode = document.getElementById('pc-edit-address-postcode')?.value?.trim() || existingPc.addressPostcode || existingPc.postcode || '';
        
        // Check each required field and highlight if missing
        if (!company) {
            this.highlightMissingField('pc-edit-company');
            missingFields.push('Company Name');
        }
        if (!accountManager) {
            this.highlightMissingField('pc-edit-account-manager');
            missingFields.push('Account Manager');
        }
        if (!contactFirstName) {
            this.highlightMissingField('pc-edit-contact-first-name');
            missingFields.push('Contact First Name');
        }
        if (!contactLastName) {
            this.highlightMissingField('pc-edit-contact-last-name');
            missingFields.push('Contact Last Name');
        }
        if (!addressPostcode) {
            this.highlightMissingField('pc-edit-address-postcode');
            missingFields.push('Postcode');
        }
        
        if (missingFields.length > 0) {
            uiModals.showToast(`Please fill in required fields: ${missingFields.join(', ')}`, 'error');
            return false;
        }
        
        return true;
    }

    /**
     * @description Get PC form data
     */
    getPcFormData() {
        const company = document.getElementById('pc-company-name')?.value.trim();
        const projectTitle = document.getElementById('pc-project-name')?.value.trim() || '';
        const accountManager = document.getElementById('pc-account-manager')?.value.trim();
        
        // Contact split
        const contactFirstName = document.getElementById('pc-contact-first-name')?.value.trim();
        const contactLastName = document.getElementById('pc-contact-last-name')?.value.trim();
        const clientTitle = document.getElementById('pc-contact-client-title')?.value.trim() || '';
        const clientJobTitle = document.getElementById('pc-contact-job-title')?.value.trim() || '';
        const contactEmail = document.getElementById('pc-contact-email')?.value.trim() || '';
        const contactPhone = document.getElementById('pc-contact-phone')?.value.trim() || '';

        // Address
        const addressPostcode = document.getElementById('pc-address-postcode')?.value.trim();
        const address1 = document.getElementById('pc-address-1')?.value.trim() || '';
        const address2 = document.getElementById('pc-address-2')?.value.trim() || '';
        const address3 = document.getElementById('pc-address-3')?.value.trim() || '';
        const address4 = document.getElementById('pc-address-4')?.value.trim() || '';
        const addressCountry = document.getElementById('pc-address-country')?.value.trim() || 'United Kingdom';

        // Classification
        const industry = document.getElementById('pc-industry')?.value || '';
        const clientCategory = document.getElementById('pc-client-category')?.value || '';
        const clientSource = document.getElementById('pc-client-source')?.value || '';
        const clientSourceDetail = document.getElementById('pc-client-source-detail')?.value || '';

        // SIC with defaults and validation
        const sic1Raw = document.getElementById('pc-sic-code-1')?.value.trim() || '';
        const sic2Raw = document.getElementById('pc-sic-code-2')?.value.trim() || '';
        const sic3Raw = document.getElementById('pc-sic-code-3')?.value.trim() || '';
        const sicCode1 = this.normalizeSic(sic1Raw) || '70100';
        const sicCode2 = this.normalizeSic(sic2Raw) || '';
        const sicCode3 = this.normalizeSic(sic3Raw) || '';

        // Required minimal validation with visual feedback
        const missingFields = [];
        
        // Clear any previous highlighting
        this.clearFieldHighlighting();
        
        // Check each required field and highlight if missing
        if (!company) {
            this.highlightMissingField('pc-company-name');
            missingFields.push('Company Name');
        }
        if (!accountManager) {
            this.highlightMissingField('pc-account-manager');
            missingFields.push('Account Manager');
        }
        if (!contactFirstName) {
            this.highlightMissingField('pc-contact-first-name');
            missingFields.push('Contact First Name');
        }
        if (!contactLastName) {
            this.highlightMissingField('pc-contact-last-name');
            missingFields.push('Contact Last Name');
        }
        if (!addressPostcode) {
            this.highlightMissingField('pc-address-postcode');
            missingFields.push('Postcode');
        }
        
        if (missingFields.length > 0) {
            uiModals.showToast(`Please fill in required fields: ${missingFields.join(', ')}`, 'error');
            return null;
        }
        
        return {
            company,
            projectTitle,
            projectDescription: document.getElementById('pc-project-description')?.value.trim() || '',
            accountManager,
            // Classification
            industry,
            clientCategory,
            clientSource,
            clientSourceDetail,
            sicCode1,
            sicCode2,
            sicCode3,
            // Contact
            contactFirstName,
            contactLastName,
            clientTitle,
            clientJobTitle,
            contactEmail,
            contactPhone,
            // Address
            addressPostcode,
            address1,
            address2,
            address3,
            address4,
            addressCountry
        };
    }

    /**
     * @description Migrate existing PC Numbers to the new normalized schema
     */
    async migratePcNumbersToNewSchema() {
        try {
            const pcNumbers = await db.loadAll('pcNumbers');
            let updatedCount = 0;

            for (const pc of pcNumbers) {
                let changed = false;

                // Company normalization
                if (!pc.company && pc.clientName) {
                    pc.company = pc.clientName;
                    changed = true;
                }

                // Industry normalization
                if (!pc.industry && pc.clientIndustry) {
                    pc.industry = pc.clientIndustry;
                    changed = true;
                }

                // Client Category mapping (old -> new enum)
                if (!pc.clientCategory && pc.clientCategoryOld) {
                    const mapCat = {
                        'Corporate': 'private',
                        'SME': 'private',
                        'Small/Medium Enterprise': 'private',
                        'Individual': 'private',
                        'Government': 'public',
                        'Non-Profit': 'non-profit',
                        'Non-profit': 'non-profit'
                    };
                    const mapped = mapCat[pc.clientCategoryOld];
                    if (mapped) { pc.clientCategory = mapped; changed = true; }
                }

                // Try alternative legacy fields for category
                if (!pc.clientCategory && pc.clientCategory) {
                    const mapCat2 = {
                        'Corporate': 'private', 'SME': 'private', 'Individual': 'private',
                        'Government': 'public', 'Non-Profit': 'non-profit', 'Non-profit': 'non-profit'
                    };
                    const mapped = mapCat2[pc.clientCategory];
                    if (mapped) { pc.clientCategory = mapped; changed = true; }
                }

                // Client Source mapping to new enum
                if (!pc.clientSource && pc.clientSourceOld) {
                    // Internal vs External - all legacy values mapped to External unless explicitly internal
                    const internalSet = new Set(['Internal Workspace','Internal Crown UK','Internal Crown EMEA','Internal Crown APAC']);
                    pc.clientSource = internalSet.has(pc.clientSourceOld) ? pc.clientSourceOld : 'External';
                    changed = true;
                }
                if (!pc.clientSource && pc.clientSource) {
                    const internalSet = new Set(['Internal Workspace','Internal Crown UK','Internal Crown EMEA','Internal Crown APAC']);
                    if (!internalSet.has(pc.clientSource)) { pc.clientSource = 'External'; changed = true; }
                }

                // Client Source Detail mapping from various legacy wordings
                if (!pc.clientSourceDetail) {
                    const legacyDetail = pc.clientSourceDetailOld || pc.clientSource || pc.howFound || '';
                    const mapDetail = [
                        [/Existing client referral|Repeat business|Repeat Customer/i, 'Existing Client'],
                        [/Personal network/i, 'Networking Event'],
                        [/Website\/?Online|Google|Search|Website Inquiry/i, 'Web Enquiry'],
                        [/Trade directory|Marketplace|Directory/i, 'Online Marketplace/Directory'],
                        [/Cold outreach/i, 'Cold Outreach'],
                        [/Trade show|Event/i, 'Trade Show/Exhibition'],
                        [/Phone Inquiry/i, 'Direct Enquiry'],
                        [/Email|Email Campaign/i, 'Email Campaign'],
                        [/Referral/i, 'Referral Partner'],
                        [/LinkedIn|Social/i, 'Social Media'],
                        [/Marketing Campaign|PPC|Ads/i, 'PPC/Ads']
                    ];
                    for (const [re, val] of mapDetail) {
                        if (legacyDetail && re.test(String(legacyDetail))) {
                            pc.clientSourceDetail = val;
                            changed = true;
                            break;
                        }
                    }
                }

                // Contact split
                if (!pc.contactFirstName && pc.contactName) {
                    pc.contactFirstName = pc.contactName;
                    pc.contactLastName = pc.contactLastName || '';
                    changed = true;
                }
                // Move legacy contactTitle to clientJobTitle
                if (pc.contactTitle && !pc.clientJobTitle) { pc.clientJobTitle = pc.contactTitle; changed = true; }

                // Address migration (prefer existing addressPostcode, then postcode)
                if (!pc.addressPostcode && (pc.postcode || pc.collectionPostcode || pc.deliveryPostcode)) {
                    pc.addressPostcode = pc.postcode || pc.collectionPostcode || pc.deliveryPostcode || '';
                    // Best-effort map known variants if present
                    pc.address1 = pc.address1 || pc.collectionAddress1 || pc.deliveryAddress1 || '';
                    pc.address2 = pc.address2 || pc.collectionAddress2 || pc.deliveryAddress2 || '';
                    pc.address3 = pc.address3 || pc.collectionAddress3 || pc.deliveryAddress3 || '';
                    pc.address4 = pc.address4 || pc.collectionAddress4 || pc.deliveryAddress4 || '';
                    pc.addressCountry = pc.addressCountry || pc.collectionCountry || pc.deliveryCountry || '';
                    changed = true;
                }

                // SIC normalization (5 digits, default 70100)
                const normalize = (v) => {
                    const s = (v || '').toString().replace(/\D/g, '');
                    return /^\d{5}$/.test(s) ? s : '';
                };
                const sic1 = normalize(pc.sicCode1);
                const sic2 = normalize(pc.sicCode2);
                const sic3 = normalize(pc.sicCode3);
                if (pc.sicCode1 !== (sic1 || '70100')) { pc.sicCode1 = sic1 || '70100'; changed = true; }
                if ((pc.sicCode2 || '') !== (sic2 || '')) { pc.sicCode2 = sic2 || ''; changed = true; }
                if ((pc.sicCode3 || '') !== (sic3 || '')) { pc.sicCode3 = sic3 || ''; changed = true; }

                // Status recompute: company, accountManager, contactFirst/Last, addressPostcode
                const isComplete = Boolean(
                    (pc.company && pc.accountManager && pc.contactFirstName && pc.contactLastName && pc.addressPostcode)
                );
                const newStatus = isComplete ? 'Complete' : 'Draft';
                if (pc.status !== newStatus) { pc.status = newStatus; changed = true; }

                // Default country if missing
                if (!pc.addressCountry) { pc.addressCountry = 'United Kingdom'; changed = true; }

                // Remove legacy keys to avoid confusion
                const legacyKeys = [
                    'clientName','clientIndustry','postcode',
                    'collectionAddress1','collectionAddress2','collectionAddress3','collectionAddress4','collectionPostcode','collectionCountry',
                    'deliveryAddress1','deliveryAddress2','deliveryAddress3','deliveryAddress4','deliveryPostcode','deliveryCountry',
                    'referralType','propertyType','budgetRange','quoteLimit','estimatedValue','surveyor','contactName'
                ];
                for (const key of legacyKeys) {
                    if (key in pc) { delete pc[key]; changed = true; }
                }

                if (changed) {
                    pc.lastModifiedAt = new Date().toISOString();
                    pc.editedBy = this.currentUser || 'User';
                    await db.save('pcNumbers', pc);
                    updatedCount++;
                }
            }

            if (updatedCount > 0) {
                logInfo(`PC migration finished: ${updatedCount} records updated`);
            } else {
                logInfo('PC migration finished: no records required updates');
            }

            // Expose a manual trigger for convenience
            window.runPcMigration = async () => {
                await this.migratePcNumbersToNewSchema();
                uiModals.showToast('PC migration executed', 'success');
                if (this.currentPage === 'pcnumbers') {
                    await this.loadPcNumbersData();
                }
            };
        } catch (error) {
            logError('PC migration error:', error);
        }
    }

    /**
     * @description Clear PC form
     */
    clearPcForm() {
        const form = document.getElementById('pc-form');
        if (form) {
            form.reset();
        }
    }

    /**
     * @description Open PC Details Page
     */
    async openPcDetailsPage(id) {
        try {
            const pcData = await db.load('pcNumbers', id);
            if (!pcData) {
                uiModals.showToast('PC Number not found', 'error');
                return;
            }
            
            // Store current PC for detail view
            window.currentPC = pcData;
            await this.navigateToPage('pc-detail');
            
        } catch (error) {
            logError('Failed to open PC details:', error);
            uiModals.showToast('Failed to load PC details', 'error');
        }
    }

    /**
     * @description Export all data as JSON file
     */
    async exportData() {
        try {
            logDebug('Starting data export');
            
            // Show loading toast
            uiModals.showToast('Exporting data...', 'info');
            
            // Get backup data from database
            const backup = await db.exportBackup();
            
            // Create download link
            const dataStr = JSON.stringify(backup, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `mf_gem_backup_${new Date().toISOString().split('T')[0]}.json`;
            
            // Trigger download
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Clean up
            URL.revokeObjectURL(url);
            
            uiModals.showToast('Data exported successfully!', 'success');
            logInfo('Data export completed');
            
        } catch (error) {
            logError('Failed to export data:', error);
            uiModals.showToast('Failed to export data', 'error');
        }
    }

    /**
     * @description Import data from JSON file
     */
    async importData() {
        try {
            const fileInput = document.getElementById('import-file');
            const file = fileInput?.files[0];
            
            if (!file) {
                uiModals.showToast('Please select a file first', 'error');
                return;
            }
            
            logDebug('Starting data import');
            uiModals.showToast('Importing data...', 'info');
            
            // Read file
            const text = await file.text();
            const backup = JSON.parse(text);
            
            // Validate backup structure
            if (!backup.data || typeof backup.data !== 'object') {
                throw new Error('Invalid backup file format');
            }
            
            // Import data using database method
            await db.importBackup(backup);
            
            // Clear file input
            if (fileInput) fileInput.value = '';
            
            // Refresh current page data
            if (this.currentPage) {
                await this.loadPageData(this.currentPage);
            }
            
            uiModals.showToast('Data imported successfully!', 'success');
            logInfo('Data import completed');
            
        } catch (error) {
            logError('Failed to import data:', error);
            
            let errorMessage = 'Failed to import data';
            if (error.message.includes('Invalid backup')) {
                errorMessage = 'Invalid backup file format';
            } else if (error.message.includes('JSON')) {
                errorMessage = 'Invalid JSON file';
            }
            
            uiModals.showToast(errorMessage, 'error');
        }
    }
    /**
     * @description Switch between Activities List and Calendar views
     * @param {string} viewType - Either 'list' or 'calendar'
     */
    switchActivitiesView(viewType) {
        try {
            logDebug('Switching activities view to:', viewType);
            
            // Define views and buttons mapping for cleaner code
            const views = {
                list: document.getElementById('activities-list-view'),
                calendar: document.getElementById('activities-calendar-view')
            };
            
            const buttons = {
                list: document.getElementById('activities-list-view-btn'),
                calendar: document.getElementById('activities-calendar-view-btn')
            };
            
            const calendarNavigation = document.getElementById('calendar-navigation');
            
            // Validate view type
            if (!this.ACTIVITY_VIEWS.includes(viewType)) {
                logError('Unknown view type:', viewType);
                uiModals.showToast('Invalid view type', 'error');
                return;
            }
            
            // Hide all views and reset button styles
            Object.values(views).forEach(view => {
                if (view) view.style.display = this.DISPLAY.none;
            });
            
            Object.values(buttons).forEach(btn => {
                if (btn) {
                    btn.style.background = this.COLORS.transparent;
                    btn.style.color = this.COLORS.neutral;
                }
            });
            
            // Hide calendar navigation by default
            if (calendarNavigation) calendarNavigation.style.display = this.DISPLAY.none;
            
            // Show selected view and activate button
            const selectedView = views[viewType];
            const selectedButton = buttons[viewType];
            
            if (selectedView) selectedView.style.display = this.DISPLAY.block;
            if (selectedButton) {
                selectedButton.style.background = this.COLORS.primary;
                selectedButton.style.color = this.COLORS.white;
            }
            
            // Handle calendar-specific logic
            if (viewType === 'calendar') {
                if (calendarNavigation) calendarNavigation.style.display = this.DISPLAY.flex;
                this.initializeCalendar();
            }
            
            // Store current view
            this.currentActivitiesView = viewType;
            
            logDebug('Activities view switched to:', viewType);
            
        } catch (error) {
            logError('Failed to switch activities view:', error);
            uiModals.showToast('Failed to switch view', 'error');
        }
    }

    /**
     * @description Set calendar view type (month/week)
     */
    setCalendarView(viewType) {
        try {
            logDebug('Setting calendar view to:', viewType);
            
            const monthView = document.getElementById('calendar-month-view');
            const weekView = document.getElementById('calendar-week-view');
            const monthBtn = document.getElementById('calendar-month-btn');
            const weekBtn = document.getElementById('calendar-week-btn');
            
            // Validate calendar view type
            if (!this.CALENDAR_VIEWS.includes(viewType)) {
                logError('Unknown calendar view type:', viewType);
                return;
            }
            
            // Hide all calendar views
            if (monthView) monthView.style.display = this.DISPLAY.none;
            if (weekView) weekView.style.display = this.DISPLAY.none;
            
            // Reset button styles
            [monthBtn, weekBtn].forEach(btn => {
                if (btn) {
                    btn.style.background = this.COLORS.transparent;
                    btn.style.color = this.COLORS.neutral;
                }
            });
            
            // Show selected view and update button
            switch (viewType) {
                case 'month':
                    if (monthView) monthView.style.display = this.DISPLAY.block;
                    if (monthBtn) {
                        monthBtn.style.background = this.COLORS.primary;
                        monthBtn.style.color = this.COLORS.white;
                    }
                    this.generateMonthCalendar();
                    break;
                    
                case 'week':
                    if (weekView) weekView.style.display = this.DISPLAY.block;
                    if (weekBtn) {
                        weekBtn.style.background = this.COLORS.primary;
                        weekBtn.style.color = this.COLORS.white;
                    }
                    uiModals.showToast('Week view coming soon', 'info');
                    break;
                    
                default:
                    logError('Unknown calendar view type:', viewType);
                    return;
            }
            
            // Store current calendar view
            this.currentCalendarView = viewType;
            
        } catch (error) {
            logError('Failed to set calendar view:', error);
            uiModals.showToast('Failed to set calendar view', 'error');
        }
    }

    /**
     * @description Navigate calendar (prev/next/today)
     */
    navigateCalendar(direction) {
        try {
            if (!this.currentCalendarDate) {
                this.currentCalendarDate = new Date();
            }
            
            const currentDate = new Date(this.currentCalendarDate);
            
            switch (direction) {
                case 'prev':
                    if (this.currentCalendarView === 'week') {
                        currentDate.setDate(currentDate.getDate() - 7);
                    } else {
                        currentDate.setMonth(currentDate.getMonth() - 1);
                    }
                    break;
                    
                case 'next':
                    if (this.currentCalendarView === 'week') {
                        currentDate.setDate(currentDate.getDate() + 7);
                    } else {
                        currentDate.setMonth(currentDate.getMonth() + 1);
                    }
                    break;
                    
                case 'today':
                    this.currentCalendarDate = new Date();
                    this.updateCalendarTitle();
                    this.refreshCalendarView();
                    return;
                    
                default:
                    logError('Unknown navigation direction:', direction);
                    return;
            }
            
            this.currentCalendarDate = currentDate;
            this.updateCalendarTitle();
            this.refreshCalendarView();
            
        } catch (error) {
            logError('Failed to navigate calendar:', error);
            uiModals.showToast('Failed to navigate calendar', 'error');
        }
    }

    /**
     * @description Initialize calendar with error handling and validation
     * @returns {boolean} True if initialization successful, false otherwise
     */
    initializeCalendar() {
        try {
            // Set default values if not present
            if (!this.currentCalendarDate) {
                this.currentCalendarDate = new Date();
                logDebug('Set default calendar date to current date');
            }
            
            if (!this.currentCalendarView || !this.CALENDAR_VIEWS.includes(this.currentCalendarView)) {
                this.currentCalendarView = 'month';
                logDebug('Set default calendar view to month');
            }
            
            // Validate date is valid
            if (isNaN(this.currentCalendarDate.getTime())) {
                this.currentCalendarDate = new Date();
                logError('Invalid calendar date detected, reset to current date');
            }
            
            this.updateCalendarTitle();
            this.setCalendarView(this.currentCalendarView);
            
            logDebug('Calendar initialized successfully');
            return true;
            
        } catch (error) {
            logError('Failed to initialize calendar:', error);
            uiModals.showToast('Failed to initialize calendar', 'error');
            return false;
        }
    }

    /**
     * @description Update calendar title with graceful error handling
     * @returns {boolean} True if title updated successfully, false otherwise
     */
    updateCalendarTitle() {
        try {
            const titleElement = document.getElementById('calendar-title');
            
            // Graceful degradation if element not found
            if (!titleElement) {
                logError('Calendar title element not found');
                return false;
            }
            
            // Validate calendar date
            if (!this.currentCalendarDate || isNaN(this.currentCalendarDate.getTime())) {
                logError('Invalid calendar date for title update');
                titleElement.textContent = 'Invalid Date';
                return false;
            }
            
            const date = new Date(this.currentCalendarDate);
            const options = { 
                year: 'numeric', 
                month: 'long' 
            };
            
            try {
                if (this.currentCalendarView === 'week') {
                    const weekStart = new Date(date);
                    weekStart.setDate(date.getDate() - date.getDay());
                    const weekEnd = new Date(weekStart);
                    weekEnd.setDate(weekStart.getDate() + 6);
                    
                    titleElement.textContent = `Week of ${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`;
                } else {
                    titleElement.textContent = date.toLocaleDateString('en-US', options);
                }
                
                return true;
                
            } catch (dateError) {
                logError('Date formatting error:', dateError);
                titleElement.textContent = 'Date Error';
                return false;
            }
            
        } catch (error) {
            logError('Failed to update calendar title:', error);
            return false;
        }
    }

    /**
     * @description Refresh current calendar view
     */
    refreshCalendarView() {
        try {
            if (this.currentCalendarView === 'week') {
                uiModals.showToast('Week view coming soon', 'info');
            } else {
                this.generateMonthCalendar();
            }
        } catch (error) {
            logError('Failed to refresh calendar view:', error);
        }
    }
    /**
     * @description Generate month calendar with caching and performance optimization
     * @returns {boolean} True if calendar generated successfully, false otherwise
     */
    async generateMonthCalendar() {
        try {
            const calendarGrid = document.getElementById('calendar-grid');
            if (!calendarGrid) {
                logError('Calendar grid element not found');
                return false;
            }
            
            const date = new Date(this.currentCalendarDate);
            const year = date.getFullYear();
            const month = date.getMonth();
            const cacheKey = `${year}-${month}`;
            
            // Check cache first
            if (this.calendarCache.has(cacheKey)) {
                const cachedData = this.calendarCache.get(cacheKey);
                if (Date.now() - cachedData.timestamp < this.CACHE_DURATION) {
                    logDebug('Using cached calendar data for:', cacheKey);
                    this.renderCalendarGrid(calendarGrid, cachedData.data);
                    return true;
                }
            }
            
            // Get first day of month and number of days
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            const daysInMonth = lastDay.getDate();
            const startDay = firstDay.getDay(); // 0 = Sunday
            
            // Load activities with filtering and caching
            const activities = await this.getFilteredActivitiesForCalendar();
            const monthActivities = activities.filter(activity => {
                if (!activity.scheduledDate) return false;
                try {
                    const activityDate = new Date(activity.scheduledDate);
                    return activityDate.getFullYear() === year && activityDate.getMonth() === month;
                } catch (error) {
                    logError('Invalid activity date:', activity.scheduledDate);
                    return false;
                }
            });
            
            // Clear calendar
            calendarGrid.innerHTML = '';
            
            // Add day headers
            const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            dayHeaders.forEach(day => {
                const headerDiv = document.createElement('div');
                headerDiv.style.cssText = 'background: #f8fafc; padding: 0.75rem; font-weight: 600; text-align: center; border-bottom: 1px solid #e5e7eb;';
                headerDiv.textContent = day;
                calendarGrid.appendChild(headerDiv);
            });
            
            // Add empty cells for days before month starts
            for (let i = 0; i < startDay; i++) {
                const emptyDiv = document.createElement('div');
                emptyDiv.style.cssText = 'background: #f9fafb; min-height: 100px; border: 1px solid #e5e7eb;';
                calendarGrid.appendChild(emptyDiv);
            }
            
            // Add days of month
            for (let day = 1; day <= daysInMonth; day++) {
                const dayDiv = document.createElement('div');
                dayDiv.style.cssText = 'background: white; min-height: 100px; border: 1px solid #e5e7eb; padding: 0.5rem; position: relative; cursor: pointer;';
                
                // Add day number
                const dayNumber = document.createElement('div');
                dayNumber.style.cssText = 'font-weight: 600; margin-bottom: 0.25rem;';
                dayNumber.textContent = day;
                dayDiv.appendChild(dayNumber);
                
                // Add activities for this day
                const dayActivities = monthActivities.filter(activity => {
                    const activityDate = new Date(activity.scheduledDate);
                    return activityDate.getDate() === day;
                });
                
                dayActivities.forEach(activity => {
                    const activityDiv = document.createElement('div');
                    activityDiv.style.cssText = 'background: #3b82f6; color: white; padding: 0.125rem 0.25rem; margin-bottom: 0.125rem; border-radius: 0.25rem; font-size: 0.75rem; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
                    activityDiv.textContent = activity.title;
                    activityDiv.title = `${activity.title} - ${activity.status}`;
                    activityDiv.onclick = (e) => {
                        e.stopPropagation();
                        this.showActivityDetails(activity.id);
                    };
                    dayDiv.appendChild(activityDiv);
                });
                
                calendarGrid.appendChild(dayDiv);
            }
            
        } catch (error) {
            logError('Failed to generate month calendar:', error);
            uiModals.showToast('Failed to generate calendar', 'error');
        }
    }

    /**
     * @description Show activity details in sidebar
     */
    async showActivityDetails(activityId) {
        try {
            const activity = await db.load('activities', activityId);
            if (!activity) {
                uiModals.showToast('Activity not found', 'error');
                return;
            }
            
            const sidebar = document.getElementById('calendar-activity-sidebar');
            const content = document.getElementById('calendar-activity-content');
            
            if (!sidebar || !content) return;
            
            // Format date
            const scheduledDate = activity.scheduledDate 
                ? new Date(activity.scheduledDate).toLocaleDateString()
                : 'Not scheduled';
            
            content.innerHTML = `
                <div style="margin-bottom: 1rem;">
                    <h4 style="margin: 0 0 0.5rem 0;">${activity.title}</h4>
                    <p style="margin: 0; color: #6b7280; font-size: 0.875rem;">${activity.type}</p>
                </div>
                
                <div style="margin-bottom: 1rem;">
                    <div style="margin-bottom: 0.5rem;"><strong>Status:</strong> ${activity.status}</div>
                    <div style="margin-bottom: 0.5rem;"><strong>Priority:</strong> ${activity.priority}</div>
                    <div style="margin-bottom: 0.5rem;"><strong>Assigned to:</strong> ${activity.assignedTo || 'Unassigned'}</div>
                    <div style="margin-bottom: 0.5rem;"><strong>Scheduled:</strong> ${scheduledDate}</div>
                </div>
                
                ${activity.description ? `
                <div style="margin-bottom: 1rem;">
                    <strong>Description:</strong>
                    <p style="margin: 0.5rem 0 0 0; color: #6b7280; font-size: 0.875rem;">${activity.description}</p>
                </div>
                ` : ''}
                
                <div style="display: flex; gap: 0.5rem;">
                    <button onclick="window.editActivity('${activity.id}')" 
                            style="background: #3b82f6; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.375rem; cursor: pointer; font-size: 0.875rem;">
                        Edit
                    </button>
                    <button onclick="window.closeCalendarSidebar()" 
                            style="background: #6b7280; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.375rem; cursor: pointer; font-size: 0.875rem;">
                        Close
                    </button>
                </div>
            `;
            
            sidebar.style.display = 'block';
            
        } catch (error) {
            logError('Failed to show activity details:', error);
            uiModals.showToast('Failed to load activity details', 'error');
        }
    }

    /**
     * @description Close calendar sidebar
     */
    closeCalendarSidebar() {
        try {
            const sidebar = document.getElementById('calendar-activity-sidebar');
            if (sidebar) {
                sidebar.style.display = 'none';
            }
        } catch (error) {
            logError('Failed to close calendar sidebar:', error);
        }
    }

    // ==================== RESOURCES FUNCTIONALITY ====================

    /**
     * @description Show new resource modal
     */
    showResourceModal() {
        try {
            this.clearResourceForm();
            document.getElementById('resource-modal-title').textContent = 'New Resource';
            uiModals.openModal('resource-modal');
            logDebug('Resource modal opened for new resource');
        } catch (error) {
            logError('Failed to show resource modal:', error);
            uiModals.showToast('Failed to open resource modal', 'error');
        }
    }

    /**
     * @description Close resource modal
     */
    closeResourceModal() {
        try {
            uiModals.closeModal('resource-modal');
            this.clearResourceForm();
            logDebug('Resource modal closed');
        } catch (error) {
            logError('Failed to close resource modal:', error);
        }
    }

    /**
     * @description Clear resource form
     */
    clearResourceForm() {
        try {
            const form = document.getElementById('resource-form');
            if (form) {
                form.reset();
                document.getElementById('resource-id').value = '';
                // Reset other unit rows
                const other = document.getElementById('resource-other-unitprices');
                if (other) {
                    other.innerHTML = '';
                    // Add one empty row by default
                    this.addOtherUnitPriceRow();
                }
            }
        } catch (error) {
            logError('Failed to clear resource form:', error);
        }
    }

    addOtherUnitPriceRow() {
        try {
            const container = document.getElementById('resource-other-unitprices');
            if (!container) return;
            const row = document.createElement('div');
            row.className = 'resource-other-row';
            row.style.display = 'grid';
            row.style.gridTemplateColumns = '2fr 2fr auto';
            row.style.gap = '0.5rem';
            row.style.marginBottom = '0.5rem';
            row.innerHTML = `
                <div>
                    <label>Unit</label>
                    <select class="oru-unit">
                        <option value="">Select...</option>
                        <option value="hour_standard">Hour Standard</option>
                        <option value="hour_ot1">Hour OT1</option>
                        <option value="hour_ot2">Hour OT2</option>
                        <option value="hour_overnight">Hour Overnight</option>
                        <option value="each">Each</option>
                        <option value="day">Day</option>
                        <option value="week">Week</option>
                        <option value="month">Month</option>
                        <option value="pack">Pack</option>
                        <option value="roll">Roll</option>
                        <option value="sheet">Sheet</option>
                        <option value="miles">Miles</option>
                    </select>
                </div>
                <div>
                    <label>Net Price (£)</label>
                    <input type="number" class="oru-cost" step="0.01" min="0" placeholder="0.00">
                </div>
                <div style="align-self:end;">
                    <button type="button" class="secondary" onclick="this.closest('.resource-other-row').remove()">Remove</button>
                </div>
            `;
            container.appendChild(row);
        } catch (e) { logError('addOtherUnitPriceRow error:', e); }
    }

    addUnitPriceRow() {
        try {
            const container = document.getElementById('resource-unitprices');
            if (!container) return;
            const row = document.createElement('div');
            row.className = 'resource-unitprice-row';
            row.style.display = 'grid';
            row.style.gridTemplateColumns = '1fr 1fr auto';
            row.style.gap = '0.75rem';
            row.style.marginBottom = '0.5rem';
            row.innerHTML = `
                <div>
                    <label>Unit *</label>
                    <select class="rup-unit" onchange="window.onRupUnitChange(this)">
                        <option value="">Select...</option>
                        <option value="each">Each</option>
                        <option value="hour">Hour</option>
                        <option value="day">Day</option>
                        <option value="week">Week</option>
                        <option value="month">Month</option>
                        <option value="pack">Pack</option>
                        <option value="roll">Roll</option>
                        <option value="sheet">Sheet</option>
                        <option value="miles">Miles</option>
                    </select>
                    <div class="rup-hour-wrap" style="display:none; margin-top: 0.5rem;">
                        <label>Hour Type *</label>
                        <select class="rup-hour-type" onchange="window.onRupHourTypeChange(this)">
                            <option value="standard" selected>Standard</option>
                            <option value="ot1">Overtime 1 (OT1)</option>
                            <option value="ot2">Overtime 2 (OT2)</option>
                            <option value="bank_holiday">Bank Holiday</option>
                        </select>
                        <button type="button" class="secondary" style="margin-left:0.5rem;" onclick="window.addHourRateRow(this)">+ Add another hour rate</button>
                        <div class="rup-hour-cost-wrap" style="display:none; margin-top:0.5rem;">
                            <label>Net Cost (£) *</label>
                            <input type="number" class="rup-cost-hour" step="0.01" min="0" placeholder="0.00" disabled>
                        </div>
                    </div>
                </div>
                <div class="rup-cost-wrap" style="display:none;">
                    <label>Net Cost (£) *</label>
                    <input type="number" class="rup-cost" step="0.01" min="0" placeholder="0.00" disabled>
                </div>
                <div style="display:flex; align-items:flex-end;">
                    <button type="button" class="secondary" onclick="this.closest('.resource-unitprice-row').remove()">Remove</button>
                </div>
            `;
            container.appendChild(row);
            // Initialize state for default unit (enable cost if not hour)
            const unitSel = row.querySelector('.rup-unit');
            if (unitSel) window.onRupUnitChange(unitSel);
        } catch (e) { logError('addUnitPriceRow error:', e); }
    }

    /**
     * @description Save resource (create or update)
     */
    async saveResource() {
        try {
            const formData = this.getResourceFormData();
            if (!formData) return;

            const existingId = document.getElementById('resource-id')?.value;
            
            if (existingId) {
                // Update existing resource
                await this.updateResource();
            } else {
                // Create new resource
                const resourceId = `RES-${Date.now()}`;
                
                const resourceData = {
                    id: resourceId,
                    name: formData.name,
                    category: formData.category,
                    unit: (formData.unitPrices?.[0]?.unit === 'hour') ? 'hour' : (formData.unitPrices?.[0]?.unit || 'each'),
                    costPerUnit: formData.unitPrices.find(u => u.unit === 'each')?.cost ?? null,
                    costPerHour: (formData.unitPrices.find(u => u.unit === 'hour' && u.rates)?.rates?.standard) ?? null,
                    costPerDay: formData.unitPrices.find(u => u.unit === 'day')?.cost ?? null,
                    unitPrices: formData.unitPrices,
                    createdAt: new Date().toISOString(),
                    lastModifiedAt: new Date().toISOString(),
                    createdBy: this.currentUser || 'User'
                };

                await db.save('resources', resourceData);
                uiModals.showToast(`Resource "${resourceData.name}" created successfully!`, 'success');
                
                this.closeResourceModal();
                
                // Refresh resources list if we're on resources page
                if (this.currentPage === 'resources') {
                    await this.loadResourcesData();
                }
                
                logDebug('Resource created successfully:', resourceData);
            }
        } catch (error) {
            logError('Failed to save resource:', error);
            uiModals.showToast('Failed to save resource', 'error');
        }
    }

    /**
     * @description Get resource form data
     */
    getResourceFormData() {
        try {
            const name = document.getElementById('resource-name')?.value?.trim();
            const category = document.getElementById('resource-category')?.value;

            // Read unified unit rows
            const rows = Array.from(document.querySelectorAll('#resource-other-unitprices .resource-other-row'));
            const entries = rows.map(r => ({
                unit: r.querySelector('.oru-unit')?.value,
                cost: parseFloat(r.querySelector('.oru-cost')?.value || '')
            })).filter(x => x.unit && !isNaN(x.cost) && x.cost >= 0);

            if (!name || !category || entries.length === 0) {
                uiModals.showToast('Please fill in Name, Category, and at least one Unit price', 'error');
                return null;
            }

            // Validate duplicates
            const seenUnits = new Set();
            const dupUnits = new Set();
            for (const e of entries) {
                if (seenUnits.has(e.unit)) dupUnits.add(e.unit); else seenUnits.add(e.unit);
            }
            if (dupUnits.size > 0) {
                const labelFor = (u) => {
                    if (u.startsWith('hour_')) {
                        const t = u.replace('hour_', '');
                        const map = { standard: 'Hour Standard', ot1: 'Hour OT1', ot2: 'Hour OT2', overnight: 'Hour Overnight' };
                        return map[t] || `Hour ${t}`;
                    }
                    return u.charAt(0).toUpperCase() + u.slice(1);
                };
                const list = Array.from(dupUnits).map(labelFor).join(', ');
                uiModals.showToast(`Duplicate units not allowed: ${list}. Please remove duplicates.`, 'error');
                return null;
            }

            // Normalize hour_* units into hour rates
            const hourRates = { standard: null, ot1: null, ot2: null, overnight: null };
            const others = [];
            entries.forEach(e => {
                if (e.unit.startsWith('hour_')) {
                    const t = e.unit.replace('hour_', '');
                    if (t in hourRates) hourRates[t] = e.cost;
                } else {
                    others.push({ unit: e.unit, cost: e.cost });
                }
            });

            const unitPrices = [];
            if (hourRates.standard != null || hourRates.ot1 != null || hourRates.ot2 != null || hourRates.overnight != null) {
                const rates = {};
                if (hourRates.standard != null) rates.standard = hourRates.standard;
                if (hourRates.ot1 != null) rates.ot1 = hourRates.ot1;
                if (hourRates.ot2 != null) rates.ot2 = hourRates.ot2;
                if (hourRates.overnight != null) rates.overnight = hourRates.overnight;
                unitPrices.push({ unit: 'hour', rates });
            }
            unitPrices.push(...others);

            return { name, category, unitPrices };
        } catch (error) {
            logError('Failed to get resource form data:', error);
            return null;
        }
    }

    /**
     * @description Edit resource
     */
    async editResource(id) {
        try {
            const resource = await db.load('resources', id);
            if (!resource) {
                uiModals.showToast('Resource not found', 'error');
                return;
            }

            // Populate form
            document.getElementById('resource-id').value = resource.id;
            document.getElementById('resource-name').value = resource.name || '';
            document.getElementById('resource-category').value = resource.category || '';
            // Populate new pricing UI rows
            const upList = Array.isArray(resource.unitPrices) ? resource.unitPrices : [];
            const other = document.getElementById('resource-other-unitprices');
            if (other) {
                other.innerHTML='';
                const legacy = [];
                if (resource.costPerUnit != null) legacy.push({ unit:'each', cost:resource.costPerUnit});
                if (resource.costPerDay != null) legacy.push({ unit:'day', cost:resource.costPerDay});

                // Map hour rates to separate hour_* rows
                const hour = upList.find(u => u.unit === 'hour');
                const rows = [];
                const rates = hour?.rates || {};
                if (rates.standard != null) rows.push({ unit:'hour_standard', cost:rates.standard });
                if (rates.ot1 != null) rows.push({ unit:'hour_ot1', cost:rates.ot1 });
                if (rates.ot2 != null) rows.push({ unit:'hour_ot2', cost:rates.ot2 });
                const overnightVal = (rates.overnight != null) ? rates.overnight : (rates.bank_holiday != null ? rates.bank_holiday : null);
                if (overnightVal != null) rows.push({ unit:'hour_overnight', cost:overnightVal });

                const flatOthers = upList.filter(u => u.unit !== 'hour');
                const all = [...rows, ...(flatOthers.length ? flatOthers : legacy)];
                if (all.length === 0) { this.addOtherUnitPriceRow(); }
                all.forEach(u => {
                    this.addOtherUnitPriceRow();
                    const row = other.lastElementChild; if (!row) return;
                    const uSel = row.querySelector('.oru-unit'); const cInp = row.querySelector('.oru-cost');
                    if (uSel) uSel.value = u.unit; if (cInp) cInp.value = u.cost;
                });
            }

            document.getElementById('resource-modal-title').textContent = 'Edit Resource';
            uiModals.openModal('resource-modal');
            
            logDebug('Resource edit modal opened for:', id);
        } catch (error) {
            logError('Failed to edit resource:', error);
            uiModals.showToast('Failed to load resource for editing', 'error');
        }
    }
    /**
     * @description Update resource
     */
    async updateResource() {
        try {
            const formData = this.getResourceFormData();
            if (!formData) return;

            const resourceId = document.getElementById('resource-id').value;
            const existingResource = await db.load('resources', resourceId);
            
            if (!existingResource) {
                uiModals.showToast('Resource not found', 'error');
                return;
            }

            const updatedResource = {
                ...existingResource,
                name: formData.name,
                category: formData.category,
                // Normalize unit prices into common fields for backward compatibility
                unit: (formData.unitPrices?.[0]?.unit === 'hour') ? 'hour' : (formData.unitPrices?.[0]?.unit || existingResource.unit || 'each'),
                costPerUnit: (formData.unitPrices.find(u => u.unit === 'each')?.cost) ?? existingResource.costPerUnit ?? null,
                costPerHour: (formData.unitPrices.find(u => u.unit === 'hour' && u.rates)?.rates?.standard) ?? existingResource.costPerHour ?? null,
                costPerDay: (formData.unitPrices.find(u => u.unit === 'day')?.cost) ?? existingResource.costPerDay ?? null,
                unitPrices: formData.unitPrices,
                lastModifiedAt: new Date().toISOString(),
                editedBy: this.currentUser || 'User'
            };

            await db.save('resources', updatedResource);
            uiModals.showToast(`Resource "${updatedResource.name}" updated successfully!`, 'success');
            
            this.closeResourceModal();
            
            // Refresh resources list if we're on resources page
            if (this.currentPage === 'resources') {
                await this.loadResourcesData();
            }
            
            logDebug('Resource updated successfully:', updatedResource);
        } catch (error) {
            logError('Failed to update resource:', error);
            uiModals.showToast('Failed to update resource', 'error');
        }
    }

    /**
     * @description View resource details
     */
    async viewResourceDetails(id) {
        try {
            const resource = await db.load('resources', id);
            if (!resource) {
                uiModals.showToast('Resource not found', 'error');
                return;
            }

            const cost = resource.costPerUnit || resource.costPerHour || resource.costPerDay || 0;
            const unit = resource.unit || 'unit';
            
            const detailsHtml = `
                <div style="padding: 1rem;">
                    <h3 style="margin: 0 0 1rem 0; color: #374151;">${resource.name}</h3>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                        <div><strong>Category:</strong> ${resource.category || 'N/A'}</div>
                        <div><strong>Status:</strong> <span class="status-badge ${resource.status || 'available'}">${resource.status || 'available'}</span></div>
                        <div><strong>Cost:</strong> £${cost.toLocaleString()} per ${unit}</div>
                        <div><strong>Unit:</strong> ${unit}</div>
                    </div>
                    
                    ${resource.description ? `
                    <div style="margin-bottom: 1rem;">
                        <strong>Description:</strong>
                        <p style="margin: 0.5rem 0 0 0; color: #6b7280;">${resource.description}</p>
                    </div>
                    ` : ''}
                    
                    <div style="font-size: 0.875rem; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 1rem;">
                        <div>Created: ${new Date(resource.createdAt).toLocaleDateString()} by ${resource.createdBy || 'Unknown'}</div>
                        ${resource.lastModifiedAt ? `<div>Modified: ${new Date(resource.lastModifiedAt).toLocaleDateString()} by ${resource.editedBy || 'Unknown'}</div>` : ''}
                    </div>
                    
                    <div style="text-align: right; margin-top: 1rem;">
                        <button onclick="window.editResource('${resource.id}')" style="background: #3b82f6; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.375rem; margin-right: 0.5rem;">Edit</button>
                        <button onclick="window.closeResourceDetailsModal()" style="background: #6b7280; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.375rem;">Close</button>
                    </div>
                </div>
            `;

            // Create or update details modal
            let modal = document.getElementById('resource-details-modal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'resource-details-modal';
                modal.className = 'modal';
                modal.innerHTML = `<div class="modal-content" style="max-width: 600px;">${detailsHtml}</div>`;
                document.body.appendChild(modal);
            } else {
                modal.querySelector('.modal-content').innerHTML = detailsHtml;
            }

            uiModals.openModal('resource-details-modal');
            
            logDebug('Resource details shown for:', id);
        } catch (error) {
            logError('Failed to view resource details:', error);
            uiModals.showToast('Failed to load resource details', 'error');
        }
    }

    // ==================== PRICE LISTS FUNCTIONALITY ====================

    /**
     * @description Edit price list
     */
    async editPriceList(id) {
        try {
            const priceList = await db.load('priceLists', id);
            if (!priceList) {
                uiModals.showToast('Price list not found', 'error');
                return;
            }

            // Populate form
            document.getElementById('pricelist-id').value = priceList.id;
            document.getElementById('pricelist-name').value = priceList.name || '';
            document.getElementById('pricelist-category').value = priceList.category || '';
            
            document.getElementById('pricelist-modal-title').textContent = 'Edit Price List';
            uiModals.openModal('pricelist-modal');
            
            logDebug('Price list edit modal opened for:', id);
        } catch (error) {
            logError('Failed to edit price list:', error);
            uiModals.showToast('Failed to load price list for editing', 'error');
        }
    }

    /**
     * @description View price list details
     */
    async viewPriceListDetails(id) {
        try {
            const priceList = await db.load('priceLists', id);
            if (!priceList) {
                uiModals.showToast('Price list not found', 'error');
                return;
            }

            // Navigate to price list detail page
            this.currentPriceList = priceList;
            await this.navigateToPage('pricelist-detail');
            
            // Update page title
            const titleElement = document.getElementById('pricelist-title');
            if (titleElement) {
                titleElement.textContent = `${priceList.name} - Details`;
            }
            
            // Load price list items
            console.log('viewPriceListDetails - Fresh data from DB:', priceList);
            console.log('viewPriceListDetails - this.currentPriceList:', this.currentPriceList);
            await this.loadPriceListItems(id);
            
            logDebug('Price list details shown for:', id);
        } catch (error) {
            logError('Failed to view price list details:', error);
            uiModals.showToast('Failed to load price list details', 'error');
        }
    }

    /**
     * @description Load price list items
     */
    async loadPriceListItems(priceListId) {
        try {
            const container = document.getElementById('pricelist-items');
            if (!container) return;

            // Get current price list with items - ALWAYS fetch fresh data from DB
            const priceList = await db.load('priceLists', priceListId);
            const items = priceList?.items || [];
            
            console.log('loadPriceListItems - Fresh Price List from DB:', priceList);
            console.log('loadPriceListItems - this.currentPriceList was:', this.currentPriceList);
            console.log('loadPriceListItems - Items array:', items);
            console.log('loadPriceListItems - Items length:', items.length);

            if (items.length === 0) {
                container.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align: center; padding: 2rem; color: #6b7280;">
                            No items found in this price list.<br>
                            <button onclick="window.showAddResourceToPriceList()" style="margin-top: 1rem; background: #3b82f6; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.375rem;">Add First Item</button>
                        </td>
                    </tr>
                `;
            } else {
                container.innerHTML = items.map(item => {
                    const profit = item.clientPrice - item.netCost;
                    const marginColor = item.margin >= 20 ? '#059669' : item.margin >= 10 ? '#d97706' : '#dc2626';
                    
                    return `
                        <tr>
                            <td>
                                <strong>${item.resourceName}</strong><br>
                                <small style="color: #6b7280;">${item.resourceCategory} • ${item.unit}</small>
                            </td>
                            <td>£${item.netCost.toLocaleString()}</td>
                            <td>£${item.clientPrice.toLocaleString()}</td>
                            <td>
                                <span style="color: ${marginColor}; font-weight: 600;">
                                    ${item.margin.toFixed(1)}%
                                </span><br>
                                <small style="color: #6b7280;">+£${profit.toFixed(2)}</small>
                            </td>
                            <td>
                                <button onclick="window.editPriceListItem('${item.id}')" class="button warning small">Edit</button>
                                <button onclick="window.removePriceListItem('${item.id}')" class="button danger small">Remove</button>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
            
            logDebug(`Price list items loaded for: ${priceListId} (${items.length} items)`);
        } catch (error) {
            logError('Failed to load price list items:', error);
        }
    }

    /**
     * @description Create new price list
     */
    async createPriceList() {
        try {
            // Navigate to new price list page
            await this.navigateToPage('new-pricelist');
            logDebug('New price list page opened');
        } catch (error) {
            logError('Failed to create new price list:', error);
            uiModals.showToast('Failed to open new price list form', 'error');
        }
    }

    /**
     * @description Save price list (create or update)
     */
    async savePriceList() {
        try {
            const formData = this.getPriceListFormData();
            if (!formData) return;

            const existingId = document.getElementById('pricelist-id')?.value;
            
            if (existingId) {
                // Update existing price list
                await this.updatePriceList();
            } else {
                // Create new price list
                const priceListId = `PL-${Date.now()}`;
                
                const priceListData = {
                    id: priceListId,
                    name: formData.name,
                    category: formData.category,
                    currency: formData.currency || 'GBP',
                    status: formData.status || 'active',
                    markup: typeof formData.markup === 'number' ? formData.markup : 25,
                    discount: typeof formData.discount === 'number' ? formData.discount : 0,
                    effectiveFrom: formData.effectiveFrom || new Date().toISOString(),
                    effectiveTo: formData.effectiveTo || '',
                    isDefault: !!formData.isDefault,
                    items: [],
                    createdAt: new Date().toISOString(),
                    lastModifiedAt: new Date().toISOString(),
                    createdBy: this.currentUser || 'User'
                };

                await db.save('priceLists', priceListData);
                uiModals.showToast(`Price List "${priceListData.name}" created successfully!`, 'success');
                
                // Go straight to the detail page (Step 2) to add resources
                this.currentPriceList = priceListData;
                await this.viewPriceListDetails(priceListId);
                logDebug('Price list created and navigating to details:', priceListData);
            }
        } catch (error) {
            logError('Failed to save price list:', error);
            uiModals.showToast('Failed to save price list', 'error');
        }
    }
    /**
     * @description Get price list form data
     */
    getPriceListFormData() {
        try {
            const name = document.getElementById('pricelist-name')?.value?.trim();
            // Category may not exist on the New Price List page (if removed); default to 'General'
            const categoryEl = document.getElementById('pricelist-category');
            const category = categoryEl ? categoryEl.value : 'General';

            // Currency and Status are present on the page
            const currency = document.getElementById('pricelist-currency')?.value || 'GBP';
            const status = document.getElementById('pricelist-status')?.value || 'active';

            // Dates (use whichever fields exist)
            const effectiveFrom = document.getElementById('pricelist-effective-from')?.value || document.getElementById('pricelist-valid-from')?.value || '';
            const effectiveTo = document.getElementById('pricelist-effective-to')?.value || document.getElementById('pricelist-valid-until')?.value || '';

            // Pricing configuration (may be absent on edit modal)
            const markupStr = document.getElementById('pricelist-markup')?.value || '';
            const discountStr = document.getElementById('pricelist-discount')?.value || '';

            if (!name) {
                uiModals.showToast('Please enter Price List Name', 'error');
                return null;
            }

            return {
                name,
                category,
                currency,
                status,
                effectiveFrom: undefined,
                effectiveTo: undefined,
                markup: markupStr !== '' ? parseFloat(markupStr) : undefined,
                discount: discountStr !== '' ? parseFloat(discountStr) : undefined
            };
        } catch (error) {
            logError('Failed to get price list form data:', error);
            return null;
        }
    }

    /**
     * @description Update price list
     */
    async updatePriceList() {
        try {
            const formData = this.getPriceListFormData();
            if (!formData) return;

            const priceListId = document.getElementById('pricelist-id').value;
            const existingPriceList = await db.load('priceLists', priceListId);
            
            if (!existingPriceList) {
                uiModals.showToast('Price list not found', 'error');
                return;
            }

            const updatedPriceList = {
                ...existingPriceList,
                name: formData.name,
                category: formData.category,
                lastModifiedAt: new Date().toISOString(),
                editedBy: this.currentUser || 'User'
            };

            await db.save('priceLists', updatedPriceList);
            uiModals.showToast(`Price List "${updatedPriceList.name}" updated successfully!`, 'success');
            
            this.closePriceListModal();
            
            // Refresh price lists if we're on pricelists page
            if (this.currentPage === 'pricelists') {
                await this.loadPriceListsData();
            }
            
            logDebug('Price list updated successfully:', updatedPriceList);
        } catch (error) {
            logError('Failed to update price list:', error);
            uiModals.showToast('Failed to update price list', 'error');
        }
    }

    /**
     * @description Close price list modal
     */
    closePriceListModal() {
        try {
            uiModals.closeModal('pricelist-modal');
            this.clearPriceListForm();
            logDebug('Price list modal closed');
        } catch (error) {
            logError('Failed to close price list modal:', error);
        }
    }

    /**
     * @description Clear price list form
     */
    clearPriceListForm() {
        try {
            const form = document.getElementById('pricelist-form');
            if (form) {
                form.reset();
                document.getElementById('pricelist-id').value = '';
            }
        } catch (error) {
            logError('Failed to clear price list form:', error);
        }
    }

    // ==================== PRICE LIST ITEMS FUNCTIONALITY ====================

    /**
     * @description Show add resource to price list modal
     */
    async showAddResourceToPriceList() {
        try {
            if (!this.currentPriceList) {
                uiModals.showToast('No price list selected', 'error');
                return;
            }

            // Load available resources
            await this.loadResourcesForPriceList();
            
            // Clear form
            const clientPriceInput = document.getElementById('modal-client-price');
            const resourceInfo = document.getElementById('resource-info');
            const marginInfo = document.getElementById('margin-info');

            if (clientPriceInput) clientPriceInput.value = '';
            if (resourceInfo) resourceInfo.innerHTML = '';
            if (marginInfo) marginInfo.innerHTML = '';

            uiModals.openModal('add-resource-modal');
            logDebug('Add resource to price list modal opened');
        } catch (error) {
            logError('Failed to show add resource modal:', error);
            uiModals.showToast('Failed to open add resource modal', 'error');
        }
    }

    /**
     * @description Load resources for price list dropdown
     */
    async loadResourcesForPriceList() {
        try {
            const resources = await db.loadAll('resources');
            const select = document.getElementById('modal-resource-item-select');
            const categorySelect = document.getElementById('modal-item-category');
            const freeText = document.getElementById('modal-item-free-text');
            const priceCurrency = document.getElementById('modal-price-currency');
            
            if (!select) return;

            select.innerHTML = '<option value="">Select a resource...</option>';
            resources.forEach(resource => {
                const displayCost = resource.costPerUnit || resource.costPerHour || resource.costPerDay || 0;
                const displayUnit = resource.unit || (resource.costPerHour ? 'hour' : resource.costPerDay ? 'day' : 'each');
                const option = document.createElement('option');
                option.value = resource.id;
                option.textContent = `${resource.name} (${resource.category}) - £${displayCost.toLocaleString()}`;
                option.dataset.cost = displayCost;
                option.dataset.unit = displayUnit;
                select.appendChild(option);
            });

            // Add change event listener
            select.onchange = () => this.updateResourceInfo();

            // Reset category and item inputs
            if (categorySelect) categorySelect.value = '';
            if (freeText) { freeText.style.display = 'none'; freeText.value = ''; }

            // Set currency symbol based on current price list
            if (priceCurrency && this.currentPriceList?.currency) {
                priceCurrency.textContent = this.currentPriceList.currency === 'USD' ? '$' : (this.currentPriceList.currency === 'EUR' ? '€' : '£');
            }
            
            logDebug(`Loaded ${resources.length} resources for price list`);
        } catch (error) {
            logError('Failed to load resources for price list:', error);
        }
    }

    /**
     * @description Update resource info when resource is selected
     */
    async updateResourceInfo() {
        try {
            const select = document.getElementById('modal-resource-item-select');
            const unitSelect = document.getElementById('modal-item-unit');
            const selectedOption = select.options[select.selectedIndex];
            const resourceInfo = document.getElementById('resource-info');
            const categorySelect = document.getElementById('modal-item-category');
            
            if (!selectedOption || !selectedOption.value) {
                resourceInfo.innerHTML = '';
                return;
            }

            const resource = await db.load('resources', selectedOption.value);
            const cost = parseFloat(selectedOption.dataset.cost || 0);
            const unit = selectedOption.dataset.unit || 'each';
            
            resourceInfo.innerHTML = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div><strong>Net Cost:</strong> £${cost.toLocaleString()}</div>
                    <div><strong>Unit:</strong> ${unit}</div>
                </div>
            `;

            // Populate unit dropdown from resource, including hour variants in single field
            if (unitSelect) {
                const options = [];
                const push = (value, label, c) => options.push({ value, label, cost: c });
                if (resource && Array.isArray(resource.unitPrices)) {
                    const up = resource.unitPrices;
                    up.filter(u => u && u.unit && u.unit !== 'hour').forEach(u => push(u.unit, u.unit.charAt(0).toUpperCase()+u.unit.slice(1), Number(u.cost||0)));
                    const hour = up.find(u => u.unit === 'hour' && u.rates);
                    if (hour && hour.rates) {
                        const map = [
                            ['standard','Hour Standard'],
                            ['ot1','Hour OT1'],
                            ['ot2','Hour OT2'],
                            ['overnight','Hour Overnight']
                        ];
                        map.forEach(([key,label]) => {
                            const v = hour.rates[key];
                            if (v != null && !isNaN(v)) push(`hour:${key}`, label, Number(v));
                        });
                    }
                } else if (resource) {
                    if (resource.costPerUnit != null) push('each','Each', Number(resource.costPerUnit));
                    if (resource.costPerHour != null) push('hour:standard','Hour Standard', Number(resource.costPerHour));
                    if (resource.costPerDay != null) push('day','Day', Number(resource.costPerDay));
                } else {
                    ['each','day','week','month','miles'].forEach(u => push(u, u.charAt(0).toUpperCase()+u.slice(1), 0));
                }
                unitSelect.innerHTML = '';
                options.forEach(o => { const el = document.createElement('option'); el.value = o.value; el.textContent = o.label; el.dataset.cost = o.cost; unitSelect.appendChild(el); });
                // Preselect matching resource unit if present
                unitSelect.value = options.find(o => o.value.startsWith(unit))?.value || (options[0]?.value || 'each');
            }

            // Auto-calculate suggested client price (with default 25% markup) based on initial unit selection
            const initialSel = unitSelect?.options?.[unitSelect.selectedIndex];
            const baseCost = parseFloat(initialSel?.dataset?.cost || cost || 0);
            const suggestedPrice = baseCost * 1.25;
            document.getElementById('modal-client-price').value = suggestedPrice.toFixed(2);
            this.calculateMargin();
            
            // If user hasn't chosen category, infer from resource
            if (categorySelect && !categorySelect.value) {
                const inferred = (selectedOption.textContent.match(/\((.*?)\)/)?.[1] || '').toLowerCase();
                const mapping = { labour: 'labour', vehicle: 'vehicle', materials: 'materials', crates: 'crates' };
                categorySelect.value = mapping[inferred] || '';
            }

            // When unit changes, update net cost preview and margin calc
            if (unitSelect) {
                unitSelect.onchange = () => {
                    const sel = unitSelect.options[unitSelect.selectedIndex];
                    const uCost = parseFloat(sel?.dataset?.cost || '0');
                    const info = document.getElementById('resource-info');
                    if (info) {
                        const uLabel = sel?.textContent || unitSelect.value;
                        info.innerHTML = `
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div><strong>Net Cost:</strong> £${uCost.toLocaleString()}</div>
                                <div><strong>Unit:</strong> ${uLabel}</div>
                            </div>
                        `;
                    }
                    const client = document.getElementById('modal-client-price');
                    if (client) client.value = (uCost * 1.25).toFixed(2);
                    this.calculateMargin();
                };
                // Trigger once to ensure info reflects preselected unit
                unitSelect.onchange();
            }

        } catch (error) {
            logError('Failed to update resource info:', error);
        }
    }

    onModalCategoryChange = async () => {
        try {
            const category = document.getElementById('modal-item-category')?.value;
            const resourceSelect = document.getElementById('modal-resource-item-select');
            const freeText = document.getElementById('modal-item-free-text');
            if (!category) return;
            if (category === 'other') {
                if (resourceSelect) resourceSelect.style.display = 'none';
                if (freeText) freeText.style.display = '';
            } else {
                if (resourceSelect) resourceSelect.style.display = '';
                if (freeText) freeText.style.display = 'none';
                // Filter resources by selected category and repopulate item dropdown
                const all = await db.loadAll('resources');
                const normalize = (v) => {
                    const x = String(v || '').toLowerCase();
                    if (x === 'materials') return 'material';
                    if (x === 'vehicle') return 'vehicles';
                    return x;
                };
                const selCat = normalize(category);
                const filtered = all.filter(r => normalize(r.category || r.type || '') === selCat);
                if (resourceSelect) {
                    resourceSelect.innerHTML = '<option value="">Select a resource...</option>';
                    filtered.forEach(resource => {
                        const option = document.createElement('option');
                        option.value = resource.id;
                        option.textContent = `${resource.name} (${resource.category}) - £${(resource.costPerUnit || resource.costPerHour || resource.costPerDay || 0).toLocaleString()}`;
                        option.dataset.cost = resource.costPerUnit || resource.costPerHour || resource.costPerDay || 0;
                        option.dataset.unit = resource.unit || (resource.costPerHour ? 'hour' : resource.costPerDay ? 'day' : 'each');
                        resourceSelect.appendChild(option);
                    });
                }
            }
        } catch (e) { logError('onModalCategoryChange error:', e); }
    }

    onModalUnitChange = () => {
        try {
            const unit = document.getElementById('modal-item-unit')?.value;
            const labourRates = document.getElementById('modal-labour-rates');
            if (labourRates) labourRates.style.display = unit === 'hour' ? '' : 'none';
            // If a resource is selected, clamp unit to the resource's unit
            const sel = document.getElementById('modal-resource-item-select');
            const selected = sel?.options?.[sel.selectedIndex];
            const resUnit = selected?.dataset?.unit;
            if (resUnit && unit !== resUnit) {
                const unitSelect = document.getElementById('modal-item-unit');
                if (unitSelect) unitSelect.value = resUnit;
                if (labourRates) labourRates.style.display = resUnit === 'hour' ? '' : 'none';
                uiModals.showToast(`Unit adjusted to match resource (${resUnit})`, 'info');
            }
        } catch (e) { logError('onModalUnitChange error:', e); }
    }

    /**
     * @description Calculate margin percentage
     */
    calculateMargin() {
        try {
            const select = document.getElementById('modal-resource-item-select');
            const selectedOption = select.options[select.selectedIndex];
            const unitSelect = document.getElementById('modal-item-unit');
            const clientPriceInput = document.getElementById('modal-client-price');
            const marginInfo = document.getElementById('margin-info');
            
            if (!selectedOption || !selectedOption.value || !clientPriceInput.value) {
                marginInfo.innerHTML = '';
                return;
            }

            // Determine netCost from selected unit (supports hour variants)
            let netCost = 0;
            const selUnit = unitSelect?.value || '';
            const selOption = unitSelect?.options?.[unitSelect.selectedIndex];
            if (selOption && selOption.dataset && selOption.dataset.cost) {
                netCost = parseFloat(selOption.dataset.cost);
            } else {
                netCost = parseFloat(selectedOption.dataset.cost || 0);
            }
            const clientPrice = parseFloat(clientPriceInput.value || 0);
            
            if (netCost === 0) {
                marginInfo.innerHTML = '<span style="color: #dc2626;">Invalid net cost</span>';
                return;
            }

            const margin = ((clientPrice - netCost) / netCost) * 100;
            const profit = clientPrice - netCost;
            
            let color = '#059669'; // green
            if (margin < 10) color = '#dc2626'; // red
            else if (margin < 20) color = '#d97706'; // orange
            
            marginInfo.innerHTML = `
                <div style="color: ${color}; font-weight: 600;">
                    Margin: ${margin.toFixed(1)}% | Profit: £${profit.toFixed(2)}
                </div>
            `;

        } catch (error) {
            logError('Failed to calculate margin:', error);
        }
    }

    /**
     * @description Add resource to price list
     */
    async addResourceToPriceList() {
        try {
            if (!this.currentPriceList) {
                uiModals.showToast('No price list selected', 'error');
                return;
            }

            const resourceSelect = document.getElementById('modal-resource-item-select');
            const clientPriceInput = document.getElementById('modal-client-price');
            const category = document.getElementById('modal-item-category')?.value;
            const freeText = document.getElementById('modal-item-free-text')?.value?.trim();
            const unit = document.getElementById('modal-item-unit')?.value || 'each';
            const labourRateType = document.getElementById('modal-labour-rate-type')?.value || 'standard';

            const resourceId = category === 'other' ? '' : (resourceSelect?.value || '');
            const clientPrice = parseFloat(clientPriceInput.value || 0);
            
            if (!category) {
                uiModals.showToast('Please select category', 'error');
                return;
            }

            if (category !== 'other' && !resourceId) {
                uiModals.showToast('Please select a resource', 'error');
                return;
            }
            if (category === 'other' && !freeText) {
                uiModals.showToast('Please enter item name', 'error');
                return;
            }
            
            if (clientPrice <= 0) {
                uiModals.showToast('Please enter a valid client price', 'error');
                return;
            }

            // Get resource details if selected
            const resource = resourceId ? await db.load('resources', resourceId) : null;

            // Create price list item
            const itemId = `PLI-${Date.now()}`;
            // Net cost from resource per unit selection
            let netCost = 0;
            if (resource && Array.isArray(resource.unitPrices)) {
                if (unit === 'hour') {
                    const hour = resource.unitPrices.find(u => u.unit === 'hour' && u.rates);
                    netCost = hour?.rates?.[labourRateType || 'standard'] ?? 0;
                } else {
                    const found = resource.unitPrices.find(u => u.unit === unit);
                    netCost = found?.cost ?? 0;
                }
            } else {
                netCost = resource?.costPerUnit || resource?.costPerHour || resource?.costPerDay || 0;
            }
            const margin = netCost > 0 ? ((clientPrice - netCost) / netCost) * 100 : 0;

            const priceListItem = {
                id: itemId,
                priceListId: this.currentPriceList.id,
                resourceId: resourceId || null,
                resourceName: resource ? resource.name : freeText,
                resourceCategory: category,
                netCost: netCost,
                clientPrice: clientPrice,
                margin: margin,
                unit: unit,
                labourRateType: unit === 'hour' ? labourRateType : undefined,
                createdAt: new Date().toISOString(),
                createdBy: this.currentUser || 'User'
            };

            // Update price list items array
            const updatedPriceList = {
                ...this.currentPriceList,
                items: [...(this.currentPriceList.items || []), priceListItem],
                lastModifiedAt: new Date().toISOString(),
                editedBy: this.currentUser || 'User'
            };

            await db.save('priceLists', updatedPriceList);
            this.currentPriceList = updatedPriceList;

            uiModals.showToast(`"${priceListItem.resourceName}" added to price list successfully!`, 'success');
            
            this.closeAddResourceModal();
            
            // Refresh price list items
            await this.loadPriceListItems(this.currentPriceList.id);
            
            logDebug('Resource added to price list:', priceListItem);
        } catch (error) {
            logError('Failed to add resource to price list:', error);
            uiModals.showToast('Failed to add resource to price list', 'error');
        }
    }

    /**
     * @description Close add resource modal
     */
    closeAddResourceModal() {
        try {
            uiModals.closeModal('add-resource-modal');
            logDebug('Add resource modal closed');
        } catch (error) {
            logError('Failed to close add resource modal:', error);
        }
    }
    /**
     * @description Open Edit Price List Item modal populated with item data
     */
    async editPriceListItem(itemId) {
        try {
            if (!this.currentPriceList) {
                uiModals.showToast('No price list selected', 'error');
                return;
            }
            const priceList = await db.load('priceLists', this.currentPriceList.id);
            const items = priceList?.items || [];
            const idx = items.findIndex(it => it.id === itemId);
            if (idx === -1) {
                uiModals.showToast('Item not found in this price list', 'error');
                return;
            }
            const item = items[idx];

            // Load linked resource to constrain category/unit and set net costs
            let resource = null;
            if (item.resourceId) {
                resource = await db.load('resources', item.resourceId);
            }

            // Populate modal fields
            const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
            setVal('pricelist-item-pricelist-id', priceList.id);
            setVal('pricelist-item-index', item.id);
            setVal('pricelist-item-description', item.resourceName || '');
            setVal('pricelist-item-category', (resource?.category || item.resourceCategory || ''));
            // Category derived from resource should not be changed
            const catEl = document.getElementById('pricelist-item-category');
            if (catEl && resource) { catEl.disabled = true; }

            // Build allowed units from resource
            const unitEl = document.getElementById('pricelist-item-unit');
            const allowedUnits = [];
            const pushUnit = (value, label, cost) => allowedUnits.push({ value, label, cost });
            if (unitEl) {
                unitEl.innerHTML = '';
                if (resource && Array.isArray(resource.unitPrices)) {
                    const up = resource.unitPrices;
                    // Non-hour units
                    up.filter(u => u && u.unit && u.unit !== 'hour').forEach(u => pushUnit(u.unit, u.unit.charAt(0).toUpperCase()+u.unit.slice(1), Number(u.cost||0)));
                    // Hour variants
                    const hour = up.find(u => u.unit === 'hour' && u.rates);
                    if (hour && hour.rates) {
                        const map = [
                            ['standard','Hour Standard'],
                            ['ot1','Hour OT1'],
                            ['ot2','Hour OT2'],
                            ['overnight','Hour Overnight']
                        ];
                        map.forEach(([key,label]) => {
                            const v = hour.rates[key];
                            if (v != null && !isNaN(v)) pushUnit(`hour:${key}`, label, Number(v));
                        });
                    }
                } else if (resource) {
                    // Legacy fields fallback
                    if (resource.costPerUnit != null) pushUnit('each','Each', Number(resource.costPerUnit));
                    if (resource.costPerHour != null) pushUnit('hour:standard','Hour Standard', Number(resource.costPerHour));
                    if (resource.costPerDay != null) pushUnit('day','Day', Number(resource.costPerDay));
                } else {
                    // No linked resource (free-text item). Keep generic options
                    ['each','hour','day','week','month','miles'].forEach(u => pushUnit(u, u.charAt(0).toUpperCase()+u.slice(1), 0));
                }
                // Populate select
                allowedUnits.forEach(opt => {
                    const o = document.createElement('option');
                    o.value = opt.value; o.textContent = opt.label; unitEl.appendChild(o);
                });
            }

            const unitKey = (item.unit === 'hour') ? `hour:${(item.labourRateType||'standard')}` : (item.unit || 'each');
            if (unitEl) unitEl.value = allowedUnits.find(x => x.value === unitKey)?.value || (allowedUnits[0]?.value || 'each');

            // Net cost derived from resource per selected unit and locked
            const priceEl = document.getElementById('pricelist-item-price');
            const unitCostMap = Object.fromEntries(allowedUnits.map(x => [x.value, x.cost]));
            const setNetFromUnit = () => { if (priceEl) { priceEl.value = (unitCostMap[unitEl.value] || 0).toFixed(2); priceEl.disabled = true; } };
            if (unitEl) unitEl.onchange = setNetFromUnit;
            setNetFromUnit();

            // Margin UI: percent vs fixed
            const marginTypePercent = document.getElementById('pricelist-item-margin-type-percent');
            const marginTypeFixed = document.getElementById('pricelist-item-margin-type-fixed');
            const marginPercEl = document.getElementById('pricelist-item-margin');
            const marginFixedEl = document.getElementById('pricelist-item-margin-fixed');
            const clientEl = document.getElementById('pricelist-item-client-price');

            const initComputedMargin = (item.netCost > 0 && item.clientPrice > 0) ? ((item.clientPrice - item.netCost) / item.netCost) * 100 : (item.margin ?? 0);
            if (marginPercEl) marginPercEl.value = Number(initComputedMargin).toFixed(1);
            if (clientEl) clientEl.value = ((parseFloat(priceEl?.value||'0')) * (1 + (parseFloat(marginPercEl?.value||'0')/100))).toFixed(2);

            const syncMarginVisibility = () => {
                const usePercent = !!marginTypePercent?.checked;
                if (marginPercEl) marginPercEl.style.display = usePercent ? '' : 'none';
                if (marginFixedEl) marginFixedEl.style.display = usePercent ? 'none' : '';
                recalcClient();
            };
            const recalcClient = () => {
                const net = parseFloat(priceEl?.value || '0');
                if (!clientEl || isNaN(net)) return;
                if (marginTypeFixed?.checked) {
                    const fixed = parseFloat(marginFixedEl?.value || '0');
                    clientEl.value = (net + (isNaN(fixed) ? 0 : fixed)).toFixed(2);
                } else {
                    const perc = parseFloat(marginPercEl?.value || '0');
                    clientEl.value = (net * (1 + ((isNaN(perc)?0:perc)/100))).toFixed(2);
                }
            };
            if (marginTypePercent) marginTypePercent.onchange = syncMarginVisibility;
            if (marginTypeFixed) marginTypeFixed.onchange = syncMarginVisibility;
            if (marginPercEl) marginPercEl.oninput = recalcClient;
            if (marginFixedEl) marginFixedEl.oninput = recalcClient;

            syncMarginVisibility();
            setVal('pricelist-item-notes', item.notes || '');

            // Hook submit handler
            const form = document.getElementById('pricelist-item-form');
            if (form) {
                form.onsubmit = async (e) => { e.preventDefault(); await this.savePriceListItem(); };
            }

            uiModals.openModal('pricelist-item-modal');
            logDebug('Price list item edit modal opened for:', itemId);
        } catch (error) {
            logError('Failed to open edit price list item:', error);
            uiModals.showToast('Failed to open item for editing', 'error');
        }
    }

    /**
     * @description Save edited Price List Item
     */
    async savePriceListItem() {
        try {
            const priceListId = document.getElementById('pricelist-item-pricelist-id')?.value;
            const itemId = document.getElementById('pricelist-item-index')?.value;
            if (!priceListId || !itemId) { uiModals.showToast('Missing item identifiers', 'error'); return; }

            const priceList = await db.load('priceLists', priceListId);
            if (!priceList) { uiModals.showToast('Price list not found', 'error'); return; }
            const items = priceList.items || [];
            const idx = items.findIndex(it => it.id === itemId);
            if (idx === -1) { uiModals.showToast('Item not found', 'error'); return; }

            const desc = document.getElementById('pricelist-item-description')?.value?.trim();
            // Category field removed from edit modal; keep existing category from item if present
            const category = items[idx]?.resourceCategory || '';
            const unitRaw = document.getElementById('pricelist-item-unit')?.value || 'each';
            const netCost = parseFloat(document.getElementById('pricelist-item-price')?.value || '0');
            const useFixed = !!document.getElementById('pricelist-item-margin-type-fixed')?.checked;
            const marginPercInput = parseFloat(document.getElementById('pricelist-item-margin')?.value || '0');
            const marginFixedInput = parseFloat(document.getElementById('pricelist-item-margin-fixed')?.value || '0');
            const notes = document.getElementById('pricelist-item-notes')?.value?.trim();
            if (!desc) { uiModals.showToast('Please enter description', 'error'); return; }
            // No category validation needed during item edit
            if (isNaN(netCost) || netCost <= 0) { uiModals.showToast('Please enter valid net cost', 'error'); return; }
            if ((!useFixed && (isNaN(marginPercInput) || marginPercInput < 0)) || (useFixed && (isNaN(marginFixedInput) || marginFixedInput < 0))) { uiModals.showToast('Please enter valid margin', 'error'); return; }

            const marginPerc = useFixed ? ((marginFixedInput / netCost) * 100) : marginPercInput;
            const clientPrice = useFixed ? (netCost + marginFixedInput) : (netCost * (1 + (marginPerc/100)));

            // Map unit and labour rate type
            let unit = unitRaw;
            let labourRateType;
            if (unitRaw.startsWith('hour:')) { unit = 'hour'; labourRateType = unitRaw.split(':')[1] || 'standard'; }

            const updatedItem = {
                ...items[idx],
                resourceName: desc,
                resourceCategory: category,
                unit,
                labourRateType,
                netCost,
                margin: marginPerc,
                clientPrice,
                notes,
                lastModifiedAt: new Date().toISOString(),
                editedBy: this.currentUser || 'User'
            };
            items[idx] = updatedItem;

            const updatedPriceList = { ...priceList, items, lastModifiedAt: new Date().toISOString(), editedBy: this.currentUser || 'User' };
            await db.save('priceLists', updatedPriceList);
            this.currentPriceList = updatedPriceList;

            uiModals.showToast('Price list item updated', 'success');
            this.closePriceListItemModal();
            await this.loadPriceListItems(priceListId);
        } catch (error) {
            logError('Failed to save price list item:', error);
            uiModals.showToast('Failed to save item', 'error');
        }
    }

    closePriceListItemModal() {
        try { uiModals.closeModal('pricelist-item-modal'); } catch (e) { /* no-op */ }
    }
    /**
     * @description Remove item from price list
     */
    async removePriceListItem(itemId) {
        try {
            if (!this.currentPriceList) {
                uiModals.showToast('No price list selected', 'error');
                return;
            }

            const confirmRemove = confirm('Are you sure you want to remove this item from the price list?');
            if (!confirmRemove) return;

            // Remove item from price list
            const updatedItems = (this.currentPriceList.items || []).filter(item => item.id !== itemId);
            
            const updatedPriceList = {
                ...this.currentPriceList,
                items: updatedItems,
                lastModifiedAt: new Date().toISOString(),
                editedBy: this.currentUser || 'User'
            };

            await db.save('priceLists', updatedPriceList);
            this.currentPriceList = updatedPriceList;

            uiModals.showToast('Item removed from price list successfully!', 'success');
            
            // Refresh price list items
            await this.loadPriceListItems(this.currentPriceList.id);
            
            logDebug('Item removed from price list:', itemId);
        } catch (error) {
            logError('Failed to remove item from price list:', error);
            uiModals.showToast('Failed to remove item from price list', 'error');
        }
    }

    /**
     * @description Delete a price list if not used in any quotes
     */
    async deletePriceList(id) {
        try {
            const priceList = await db.load('priceLists', id);
            if (!priceList) {
                uiModals.showToast('Price list not found', 'error');
                return;
            }
            const quotes = await db.loadAll('quotes');
            const usageCount = quotes.filter(q => q.priceListId === id).length;
            if (usageCount > 0) {
                uiModals.showToast(`Cannot delete. This price list is used in ${usageCount} quote(s).`, 'error');
                return;
            }
            const confirmDelete = confirm(`Delete price list "${priceList.name}"? This cannot be undone.`);
            if (!confirmDelete) return;
            await db.delete('priceLists', id);
            uiModals.showToast('Price list deleted', 'success');
            if (this.currentPage === 'pricelists') {
                await this.loadPriceListsData();
            }
        } catch (error) {
            logError('Failed to delete price list:', error);
            uiModals.showToast('Failed to delete price list', 'error');
        }
    }

    // ==================== SMART FILTERS FUNCTIONALITY ====================

    /**
     * @description Filter PC Numbers by company name
     */
    async filterPcNumbersByCompany(query) {
        try {
            await this.applySmartFilter('pcNumbers', 'company', query, 'pc-filter-results');
        } catch (error) {
            logError('Failed to filter PC Numbers by company:', error);
        }
    }

    /**
     * @description Filter PC Numbers by account manager
     */
    async filterPcNumbersByAccountManager(query) {
        try {
            await this.applySmartFilter('pcNumbers', 'accountManager', query, 'pc-filter-results');
        } catch (error) {
            logError('Failed to filter PC Numbers by account manager:', error);
        }
    }
    /**
     * @description Filter PC Numbers by PC number
     */
    async filterPcNumbersByPcNumber(query) {
        try {
            await this.applySmartFilter('pcNumbers', 'pcNumber', query, 'pc-filter-results');
        } catch (error) {
            logError('Failed to filter PC Numbers by PC number:', error);
        }
    }

    /**
     * @description Filter Quotes by company name
     */
    async filterQuotesByCompany(query) {
        try {
            await this.applySmartFilter('quotes', 'company', query, 'quote-filter-results');
        } catch (error) {
            logError('Failed to filter Quotes by company:', error);
        }
    }

    /**
     * @description Filter Quotes by account manager
     */
    async filterQuotesByAccountManager(query) {
        try {
            await this.applySmartFilter('quotes', 'accountManager', query, 'quote-filter-results');
        } catch (error) {
            logError('Failed to filter Quotes by account manager:', error);
        }
    }

    /**
     * @description Filter Quotes by PC number
     */
    async filterQuotesByPcNumber(query) {
        try {
            await this.applySmartFilter('quotes', 'pcNumber', query, 'quote-filter-results');
        } catch (error) {
            logError('Failed to filter Quotes by PC number:', error);
        }
    }

    /**
     * @description Filter Activities by company name
     */
    async filterActivitiesByCompany(query) {
        try {
            await this.applySmartFilter('activities', 'company', query, 'activity-filter-results');
        } catch (error) {
            logError('Failed to filter Activities by company:', error);
        }
    }

    /**
     * @description Filter Activities by account manager
     */
    async filterActivitiesByAccountManager(query) {
        try {
            await this.applySmartFilter('activities', 'accountManager', query, 'activity-filter-results');
        } catch (error) {
            logError('Failed to filter Activities by account manager:', error);
        }
    }

    /**
     * @description Filter Activities by PC number
     */
    async filterActivitiesByPcNumber(query) {
        try {
            await this.applySmartFilter('activities', 'pcNumber', query, 'activity-filter-results');
        } catch (error) {
            logError('Failed to filter Activities by PC number:', error);
        }
    }

    /**
     * @description Generic smart filter implementation
     */
    async applySmartFilter(dataType, filterField, query, resultsElementId) {
        try {
            // Store filter state
            if (this.activeFilters[dataType]) {
                this.activeFilters[dataType][filterField] = query || '';
            }
            
            // Clear filter if query is empty
            if (!query || query.trim() === '') {
                await this.clearSmartFilter(dataType, resultsElementId);
                return;
            }

            // Get all data
            let allData = [];
            let containerSelector = '';
            let loadDataMethod = '';

            switch (dataType) {
                case 'pcNumbers':
                    allData = await db.loadAll('pcNumbers');
                    containerSelector = '#pc-list';
                    loadDataMethod = 'loadPcNumbersData';
                    break;
                case 'quotes':
                    allData = await db.loadAll('quotes');
                    containerSelector = '#quotes-list';
                    loadDataMethod = 'loadQuotesData';
                    break;
                case 'activities':
                    allData = await db.loadAll('activities');
                    containerSelector = '#activities-list';
                    loadDataMethod = 'loadActivitiesData';
                    break;
                default:
                    throw new Error(`Unknown data type: ${dataType}`);
            }

            // Filter data based on query
            const filteredData = allData.filter(item => {
                let searchValue = '';
                
                switch (filterField) {
                    case 'company':
                        // Prefer normalized company
                        searchValue = item.companyName || item.company || '';
                        break;
                    case 'accountManager':
                        // For PC Numbers & Quotes: use accountManager
                        // For Activities: now strictly use activity.accountManager (inherited from Quote)
                        if (dataType === 'activities') {
                            searchValue = item.accountManager || '';
                        } else {
                            searchValue = item.accountManager || '';
                        }
                        break;
                    case 'pcNumber':
                        searchValue = item.pcNumber || item.id || '';
                        break;
                    default:
                        searchValue = '';
                }
                
                return searchValue.toLowerCase().includes(query.toLowerCase());
            });

            // Update the display
            await this.updateFilteredDisplay(dataType, filteredData, containerSelector);

            // Update results info
            this.updateFilterResults(resultsElementId, filteredData.length, allData.length, query, filterField);

            // If activities filter and calendar view is active, clear cache and regenerate calendar
            if (dataType === 'activities' && this.currentActivitiesView === 'calendar') {
                this.calendarCache.clear(); // Clear cache to force regeneration with new filters
                await this.generateMonthCalendar();
            }

            logDebug(`Filtered ${dataType} by ${filterField}: ${filteredData.length}/${allData.length} results`);

        } catch (error) {
            logError('Failed to apply smart filter:', error);
            uiModals.showToast('Failed to apply filter', 'error');
        }
    }

    /**
     * @description Update filtered display
     */
    async updateFilteredDisplay(dataType, filteredData, containerSelector) {
        try {
            const container = document.querySelector(containerSelector);
            if (!container) return;

            if (filteredData.length === 0) {
                // Use appropriate colspan based on data type
                let colspan = 9; // default for Activities (includes Account Manager + Actions)
                if (dataType === 'pcNumbers') colspan = 6; // includes Account Manager + Actions
                if (dataType === 'quotes') colspan = 7; // includes Account Manager + Actions
                
                container.innerHTML = `<tr><td colspan="${colspan}" style="text-align: center; padding: 2rem; color: #6b7280;">No results found for current filter.</td></tr>`;
                return;
            }

            // Generate filtered rows based on data type
            switch (dataType) {
                case 'pcNumbers':
                    container.innerHTML = filteredData.map(pc => `
                        <tr onclick="window.viewPcDetails('${pc.id}')" style="cursor: pointer;" onmouseover="this.style.backgroundColor='#f8fafc'" onmouseout="this.style.backgroundColor=''">
                            <td><strong>${pc.pcNumber || 'N/A'}</strong></td>
                            <td>${pc.company || pc.clientName || 'N/A'}</td>
                            <td>${pc.projectTitle || 'N/A'}</td>
                            <td>${pc.contactName || 'N/A'}</td>
                            <td>${pc.accountManager || 'N/A'}</td>
                            <td onclick="event.stopPropagation()">
                                <button onclick="window.editPC('${pc.id}')" class="button warning small">Edit</button>
                                <button onclick="window.viewPcDetails('${pc.id}')" class="button primary small">View</button>
                                <button onclick="window.addQuoteForPc('${pc.id}')" class="button success small">Add Quote</button>
                            </td>
                        </tr>
                    `).join('');
                    break;

                case 'quotes':
                    container.innerHTML = filteredData.map(quote => `
                        <tr onclick="window.viewQuoteDetails('${quote.id}')" style="cursor: pointer;" onmouseover="this.style.backgroundColor='#f8fafc'" onmouseout="this.style.backgroundColor=''">
                            <td><strong>${quote.quoteNumber || 'N/A'}</strong></td>
                            <td>${quote.clientName || quote.companyName || 'N/A'}</td>
                            <td>${quote.pcNumber || 'N/A'}</td>
                            <td>£${(quote.totalAmount || 0).toLocaleString()}</td>
                            <td><span class="status-badge ${quote.status || 'pending'}">${quote.status || 'pending'}</span></td>
                            <td>${quote.accountManager || 'N/A'}</td>
                            <td onclick="event.stopPropagation()">
                                <button onclick="window.editQuote('${quote.id}')" class="button warning small">Edit</button>
                                <button onclick="window.viewQuoteDetails('${quote.id}')" class="button primary small">View</button>
                                <button onclick="window.addActivityForQuote('${quote.id}')" class="button info small">Add Activity</button>
                            </td>
                        </tr>
                    `).join('');
                    break;

                case 'activities':
                    container.innerHTML = filteredData.map(activity => {
                        let scheduledDisplay = 'Not scheduled';
                        if (activity.scheduledDate) {
                            try {
                                scheduledDisplay = new Date(activity.scheduledDate).toLocaleDateString();
                            } catch (e) {
                                scheduledDisplay = 'Invalid date';
                            }
                        }

                        return `
                        <tr onclick="window.viewActivityDetails('${activity.id}')" style="cursor: pointer;" onmouseover="this.style.backgroundColor='#f8fafc'" onmouseout="this.style.backgroundColor=''">
                            <td><strong>${activity.title || 'N/A'}</strong></td>
                            <td>${activity.pcNumber || 'N/A'}</td>
                            <td>${activity.companyName || 'N/A'}</td>
                            <td>${activity.type || 'N/A'}</td>
                            <td>${scheduledDisplay}</td>
                            <td>${activity.priority || 'Medium'}</td>
                            <td><span class="status-badge ${activity.status || 'pending'}">${activity.status || 'pending'}</span></td>
                            <td>${activity.accountManager || 'N/A'}</td>
                            <td onclick="event.stopPropagation()">
                                <button onclick="window.editActivity('${activity.id}')" class="button warning small">Edit</button>
                                <button onclick="window.viewActivityDetails('${activity.id}')" class="button primary small">View</button>
                            </td>
                        </tr>
                        `;
                    }).join('');
                    break;
            }

        } catch (error) {
            logError('Failed to update filtered display:', error);
        }
    }

    /**
     * @description Update filter results info
     */
    updateFilterResults(resultsElementId, filteredCount, totalCount, query, filterField) {
        try {
            const resultsElement = document.getElementById(resultsElementId);
            if (!resultsElement) return;

            const fieldDisplay = {
                'company': 'Company Name',
                'accountManager': 'Account Manager', 
                'pcNumber': 'PC Number'
            };

            resultsElement.innerHTML = `
                Showing ${filteredCount} of ${totalCount} results for "${query}" in ${fieldDisplay[filterField] || filterField}
            `;
        } catch (error) {
            logError('Failed to update filter results:', error);
        }
    }

    /**
     * @description Clear smart filter
     */
    async clearSmartFilter(dataType, resultsElementId) {
        try {
            // Reload original data
            switch (dataType) {
                case 'pcNumbers':
                    await this.loadPcNumbersData();
                    break;
                case 'quotes':
                    await this.loadQuotesData();
                    break;
                case 'activities':
                    await this.loadActivitiesData();
                    break;
            }

            // Clear results info
            const resultsElement = document.getElementById(resultsElementId);
            if (resultsElement) {
                resultsElement.innerHTML = '';
            }

            logDebug(`Cleared ${dataType} filter`);
        } catch (error) {
            logError('Failed to clear smart filter:', error);
        }
    }

    /**
     * @description Clear PC Numbers filter
     */
    async clearPcFilter() {
        try {
            document.getElementById('pc-filter-company').value = '';
            document.getElementById('pc-filter-account-manager').value = '';
            document.getElementById('pc-filter-pc-number').value = '';
            await this.clearSmartFilter('pcNumbers', 'pc-filter-results');
        } catch (error) {
            logError('Failed to clear PC filter:', error);
        }
    }

    /**
     * @description Clear Quotes filter
     */
    async clearQuoteFilter() {
        try {
            document.getElementById('quote-filter-company').value = '';
            document.getElementById('quote-filter-account-manager').value = '';
            document.getElementById('quote-filter-pc-number').value = '';
            await this.clearSmartFilter('quotes', 'quote-filter-results');
        } catch (error) {
            logError('Failed to clear quote filter:', error);
        }
    }

    /**
     * @description Clear Activities filter
     */
    async clearActivityFilter() {
        try {
            document.getElementById('activity-filter-company').value = '';
            document.getElementById('activity-filter-account-manager').value = '';
            document.getElementById('activity-filter-pc-number').value = '';
            
            // Clear filter state
            this.activeFilters.activities = {
                company: '',
                accountManager: '',
                pcNumber: ''
            };
            
            await this.clearSmartFilter('activities', 'activity-filter-results');
            
            // If calendar view is active, clear cache and regenerate calendar with cleared filters
            if (this.currentActivitiesView === 'calendar') {
                this.calendarCache.clear(); // Clear cache to force regeneration without filters
                await this.generateMonthCalendar();
            }
        } catch (error) {
            logError('Failed to clear activity filter:', error);
        }
    }

    /**
     * @description Get cached activities or load fresh from database
     * @returns {Promise<Array>} Array of activities
     */
    async getCachedActivities() {
        try {
            // Check if cache is still valid
            if (this.activitiesCache && this.lastActivitiesLoad && 
                (Date.now() - this.lastActivitiesLoad < this.CACHE_DURATION)) {
                logDebug('Using cached activities data');
                return this.activitiesCache;
            }
            
            // Load fresh data
            logDebug('Loading fresh activities data');
            const activities = await db.loadAll('activities');
            
            // Update cache
            this.activitiesCache = activities;
            this.lastActivitiesLoad = Date.now();
            
            return activities;
            
        } catch (error) {
            logError('Failed to get activities:', error);
            return this.activitiesCache || []; // Fallback to cached data or empty array
        }
    }

    /**
     * @description Get filtered activities for calendar view
     * @returns {Promise<Array>} Array of filtered activities
     */
    async getFilteredActivitiesForCalendar() {
        try {
            // Get all activities
            const allActivities = await this.getCachedActivities();
            
            // Check if any filters are active
            const filters = this.activeFilters.activities;
            const hasActiveFilters = filters.company || filters.accountManager || filters.pcNumber;
            
            if (!hasActiveFilters) {
                logDebug('No active filters, returning all activities for calendar');
                return allActivities;
            }
            
            // Apply filters
            const filteredActivities = allActivities.filter(activity => {
                let matches = true;
                
                // Company filter
                if (filters.company) {
                    const searchValue = activity.companyName || activity.company || '';
                    matches = matches && searchValue.toLowerCase().includes(filters.company.toLowerCase());
                }
                
                // Account Manager filter
                if (filters.accountManager) {
                    const searchValue = activity.assignedTo || activity.accountManager || '';
                    matches = matches && searchValue.toLowerCase().includes(filters.accountManager.toLowerCase());
                }
                
                // PC Number filter
                if (filters.pcNumber) {
                    const searchValue = activity.pcNumber || activity.id || '';
                    matches = matches && searchValue.toLowerCase().includes(filters.pcNumber.toLowerCase());
                }
                
                return matches;
            });
            
            logDebug(`Filtered activities for calendar: ${filteredActivities.length}/${allActivities.length} activities`);
            return filteredActivities;
            
        } catch (error) {
            logError('Failed to get filtered activities for calendar:', error);
            return [];
        }
    }

    /**
     * @description Render calendar grid with provided data
     * @param {HTMLElement} calendarGrid - Calendar grid element
     * @param {Object} calendarData - Calendar data to render
     */
    renderCalendarGrid(calendarGrid, calendarData) {
        try {
            calendarGrid.innerHTML = calendarData.html;
            
            // Re-attach event listeners for activities
            const activityElements = calendarGrid.querySelectorAll('[data-activity-id]');
            activityElements.forEach(element => {
                const activityId = element.dataset.activityId;
                element.onclick = (e) => {
                    e.stopPropagation();
                    this.showActivityDetails(activityId);
                };
            });
            
            logDebug('Calendar grid rendered from cache');
            
        } catch (error) {
            logError('Failed to render calendar grid:', error);
        }
    }

    /**
     * @description Clear cache when activities are modified
     */
    clearActivitiesCache() {
        this.activitiesCache = null;
        this.lastActivitiesLoad = null;
        this.calendarCache.clear();
        logDebug('Activities cache cleared');
    }
}

/**
 * @description Application instance
 */
let app = null;
/**
 * @description Initialize the CRM application
 */
async function initializeApplication() {
    try {
        logInfo('🚀 Starting CRM Application...');
        
        // Create application instance
        app = new CRMApplication();
        
        // Initialize the application
        await app.initialize();
        
        // Make globally accessible for backward compatibility
        window.app = app;
        window.crmApp = app;
        
        // Setup global event handlers for backward compatibility
        setupLegacyCompatibility();

        // One-time migration: seed Account Managers from existing data if store is empty
        try {
            const [existingAms, pcs, quotes, activities] = await Promise.all([
                db.loadAll('accountManagers'),
                db.loadAll('pcNumbers'),
                db.loadAll('quotes'),
                db.loadAll('activities')
            ]);
            if ((existingAms?.length || 0) === 0) {
                const names = new Set();
                pcs.forEach(x => { if (x?.accountManager) names.add(String(x.accountManager).trim()); });
                quotes.forEach(x => { if (x?.accountManager) names.add(String(x.accountManager).trim()); });
                activities.forEach(x => { if (x?.accountManager) names.add(String(x.accountManager).trim()); });
                for (const name of Array.from(names).filter(Boolean)) {
                    await db.save('accountManagers', { name, createdAt: new Date().toISOString() });
                }
                app.accountManagersCache = await db.loadAll('accountManagers');
                app.accountManagersCache.sort((a,b)=> (a.name||'').localeCompare(b.name||''));
                app.populateAllAccountManagerSelects();
                logInfo(`Seeded ${app.accountManagersCache.length} Account Managers from existing data`);
            }
        } catch (e) { logError('AM migration failed:', e); }
        
        logInfo('✅ CRM Application started successfully');
            
        } catch (error) {
        logError('❌ Failed to initialize CRM application:', error);
        
        // Show user-friendly error message
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.innerHTML = `
                <div class="error-container">
                    <h2>⚠️ Application Failed to Start</h2>
                    <p>Please refresh the page to try again.</p>
                    <button onclick="window.location.reload()" class="button primary">
                        🔄 Refresh Page
                    </button>
                </div>
            `;
        }
    }
}
/**
 * @description Setup legacy compatibility functions
 */
function setupLegacyCompatibility() {
    // Navigation functions
    window.navigateToPage = (page) => app.navigateToPage(page);
    window.showPage = (page) => app.navigateToPage(page);
    
    // Quote Builder additional sections functions
    window.addRecyclingItem = () => app.addRecyclingItem();
    window.addRebateItem = () => app.addRebateItem(); 
    window.addOtherCostManual = () => app.addOtherCostManual();
    
    // PC Numbers functionality
    window.showNewPcModal = () => {
        logDebug('Navigating to new PC page');
        app.navigateToPage('new-pc');
    };
    
    window.editPC = async (id) => {
        logDebug('Edit PC requested for ID:', id);
        await app.openPcEditModal(id);
    };
    
    window.viewPcDetails = async (id) => {
        logDebug('View PC details requested for ID:', id);
        await app.openPcDetailsPage(id);
    };
    
    window.addQuoteForPc = async (id) => {
        logDebug('Add Quote for PC requested for ID:', id);
        // Always open Step 1 modal first with PC locked
        await app.openQuoteModal(id);
    };
    
    window.addActivityForQuote = async (id) => {
        logDebug('Add Activity for Quote requested for ID:', id);
        await app.addActivityForQuote(id);
    };
    
    window.savePc = async () => {
        await app.savePcNumber();
    };
    
    window.updatePC = async () => {
        await app.updatePcNumber();
    };
    

    
    window.showNewQuoteModal = async () => {
        await app.openQuoteModal();
    };

    window.closeQuoteModal = () => {
        app.closeQuoteModal();
    };

    window.saveQuote = async () => {
        await app.saveQuote();
    };

    window.editQuote = async (id) => {
        if (app.openQuoteBuilderForEdit) {
            await app.openQuoteBuilderForEdit(id);
        } else {
            await app.openQuoteEditModal(id);
        }
    };

    window.viewQuoteDetails = async (id) => {
        await app.openQuoteDetailsPage(id);
    };

    window.clearQuoteFilter = () => {
        logDebug('Clear quote filter requested');
        uiModals.showToast('Filter functionality will be restored soon', 'info');
    };

    window.closeQuoteEditModal = () => {
        app.closeQuoteEditModal();
    };

    window.updateQuote = async () => {
        await app.updateQuote();
    };

    window.searchCompanies = (query) => {
        app.searchCompanies(query);
    };

    window.showCompanyDropdown = () => {
        app.showCompanyDropdown();
    };

    window.hideCompanyDropdown = () => {
        // Delay to allow click on dropdown items
        setTimeout(() => app.hideCompanyDropdown(), 200);
    };

    window.selectCompany = async (companyName) => {
        await app.selectCompany(companyName);
    };
    
    window.showActivityModal = async () => {
        await app.openActivityModal();
    };

    window.closeActivityModal = () => {
        app.closeActivityModal();
    };

    window.saveActivity = async () => {
        await app.saveActivity();
    };

    window.editActivity = async (id) => {
        await app.editActivity(id);
    };

    window.viewActivityDetails = async (id) => {
        await app.viewActivityDetails(id);
    };
    
    window.closeActivityDetailsModal = () => uiModals.closeModal('activity-details-modal');
    
    window.showPriceListModal = () => {
        logDebug('Price List modal requested');
        uiModals.showToast('Price List functionality will be restored soon', 'info');
    };
    
    // Close modal functions
    window.closeActivityModal = () => app.closeActivityModal();
    window.closeResourceModal = () => app.closeResourceModal();
    window.closePriceListModal = () => app.closePriceListModal();

    // Resources functions
    window.showResourceModal = () => app.showResourceModal();
    window.addOtherUnitPriceRow = () => app.addOtherUnitPriceRow();
    window.editResource = (id) => app.editResource(id);
    window.viewResourceDetails = (id) => app.viewResourceDetails(id);
    window.closeResourceDetailsModal = () => uiModals.closeModal('resource-details-modal');
    window.deleteResource = (id) => app.deleteResource(id);
    window.filterResourcesTable = () => app.loadResourcesData();

    // Price Lists functions
    window.editPriceList = (id) => app.editPriceList(id);
    window.viewPriceListDetails = (id) => app.viewPriceListDetails(id);
    window.createPriceList = () => app.createPriceList();
    window.savePriceList = () => app.savePriceList();
    window.updatePriceList = () => app.updatePriceList();
    window.deletePriceList = (id) => app.deletePriceList(id);
    window.editPriceListItem = (id) => app.editPriceListItem(id);
    window.closePriceListItemModal = () => app.closePriceListItemModal();
    window.addUnitPriceRow = () => app.addUnitPriceRow();
    window.addUnitFromPicker = () => app.addUnitFromPicker();
    window.onRupUnitChange = (selectEl) => {
        try {
            const row = selectEl.closest('.resource-unitprice-row');
            const hourWrap = row?.querySelector('.rup-hour-wrap');
            const costWrap = row?.querySelector('.rup-cost-wrap');
            const costInput = row?.querySelector('.rup-cost');
            const hourCostWrap = row?.querySelector('.rup-hour-cost-wrap');
            const hourCostInput = row?.querySelector('.rup-cost-hour');
            const unitVal = selectEl.value;
            if (hourWrap) hourWrap.style.display = (unitVal === 'hour') ? '' : 'none';
            // Hide everything until a unit is chosen
            if (!unitVal) {
                if (costWrap) costWrap.style.display = 'none';
                if (hourCostWrap) hourCostWrap.style.display = 'none';
                if (costInput) costInput.disabled = true;
                if (hourCostInput) hourCostInput.disabled = true;
                return;
            }
            // Non-hour: show simple cost
            if (unitVal !== 'hour') {
                if (costWrap) costWrap.style.display = '';
                if (costInput) costInput.disabled = false;
                if (hourCostWrap) hourCostWrap.style.display = 'none';
                if (hourCostInput) hourCostInput.disabled = true;
                return;
            }
            // Hour: show hour-cost area but keep disabled until type is picked
            if (costWrap) costWrap.style.display = 'none';
            if (hourCostWrap) hourCostWrap.style.display = '';
            if (hourCostInput) hourCostInput.disabled = true;
        } catch (e) { logError('onRupUnitChange error:', e); }
    };

    window.onRupHourTypeChange = (selectEl) => {
        try {
            const row = selectEl.closest('.resource-unitprice-row');
            const hourCostInput = row?.querySelector('.rup-cost-hour');
            if (hourCostInput) hourCostInput.disabled = false;
        } catch (e) { logError('onRupHourTypeChange error:', e); }
    };

    window.addHourRateRow = (btnEl) => {
        try {
            // Add a new row preset to unit=hour and focus hour type
            app.addUnitPriceRow();
            const container = document.getElementById('resource-unitprices');
            const newRow = container?.lastElementChild;
            if (!newRow) return;
            const unitSel = newRow.querySelector('.rup-unit');
            if (unitSel) {
                unitSel.value = 'hour';
                window.onRupUnitChange(unitSel);
                const ht = newRow.querySelector('.rup-hour-type');
                if (ht) ht.focus();
            }
        } catch (e) { logError('addHourRateRow error:', e); }
    };
    window.onResourceCategoryChange = () => {
        try {
            const val = document.getElementById('resource-category')?.value;
            const warn = document.getElementById('resource-category-warning');
            if (warn) warn.style.display = (val === 'other') ? '' : 'none';
        } catch (e) { logError('onResourceCategoryChange error:', e); }
    };

    // Price List Items functions
    window.showAddResourceToPriceList = () => app.showAddResourceToPriceList();
    window.addResourceToPriceList = () => app.addResourceToPriceList();
    window.closeAddResourceModal = () => app.closeAddResourceModal();
    window.calculateMargin = () => app.calculateMargin();
    window.removePriceListItem = (id) => app.removePriceListItem(id);
    // Add Resource modal interactions
    window.onModalCategoryChange = () => app.onModalCategoryChange();
    window.onModalUnitChange = () => app.onModalUnitChange();

    // Smart Filters functions
    window.filterPcNumbersByCompany = (query) => app.filterPcNumbersByCompany(query);
    window.filterPcNumbersByAccountManager = (query) => app.filterPcNumbersByAccountManager(query);
    window.filterPcNumbersByPcNumber = (query) => app.filterPcNumbersByPcNumber(query);
    window.filterQuotesByCompany = (query) => app.filterQuotesByCompany(query);
    window.filterQuotesByAccountManager = (query) => app.filterQuotesByAccountManager(query);
    window.filterQuotesByPcNumber = (query) => app.filterQuotesByPcNumber(query);
    window.filterActivitiesByCompany = (query) => app.filterActivitiesByCompany(query);
    window.filterActivitiesByAccountManager = (query) => app.filterActivitiesByAccountManager(query);
    window.filterActivitiesByPcNumber = (query) => app.filterActivitiesByPcNumber(query);
    window.clearPcFilter = () => app.clearPcFilter();
    window.clearQuoteFilter = () => app.clearQuoteFilter();
    window.clearActivityFilter = () => app.clearActivityFilter();

    // Account Managers (Settings)
    window.addAccountManager = () => app.addAccountManagerFromInput();
    window.deleteAccountManager = (id) => app.deleteAccountManagerById(id);

    window.closePcModal = () => uiModals.closeModal('pc-modal');
    window.closePcEditModal = () => uiModals.closeModal('pc-edit-modal');
    
    // Additional missing functions
    window.showChangeUserModal = () => {
        logDebug('Change user modal requested');
        uiModals.showToast('User change functionality will be restored soon', 'info');
    };
    
    window.logoutUser = () => {
        logDebug('Logout requested');
        localStorage.removeItem('currentUser');
        window.location.reload();
    };
    

    
    
    // Activity view functions
    window.switchActivitiesView = (viewType) => app.switchActivitiesView(viewType);
    window.setCalendarView = (viewType) => app.setCalendarView(viewType);
    window.navigateCalendar = (direction) => app.navigateCalendar(direction);
    window.closeCalendarSidebar = () => app.closeCalendarSidebar();
    
    // Data export/import functions
    window.exportData = () => app.exportData();
    window.importData = () => app.importData();
    
    // Quote builder functions
    
    window.cancelQuote = () => {
        logDebug('Cancel quote requested');
        uiModals.showToast('Quote cancellation will be restored soon', 'info');
    };
    
    // Bulk operations (commonly used)
    window.bulkUpdateQuantity = () => {
        logDebug('Bulk quantity update requested');
        uiModals.showToast('Bulk operations will be restored soon', 'info');
    };
    
    window.bulkApplyDiscount = () => {
        logDebug('Bulk discount requested');
        uiModals.showToast('Bulk operations will be restored soon', 'info');
    };
    
    window.bulkDeleteItems = () => {
        logDebug('Bulk delete requested');
        uiModals.showToast('Bulk operations will be restored soon', 'info');
    };
    

    
    // Placeholder for any other missing functions
    const createPlaceholderFunction = (name) => {
        return () => {
            logDebug(`Function ${name} requested`);
            uiModals.showToast('This feature will be restored soon', 'info');
        };
    };
    
    // Add common missing functions
    const missingFunctions = [
        'editActivity', 'editQuote', 'editPriceListItem',
        'editCurrentPriceListItem', 'deleteCurrentPriceListItem',
        'backToPriceListDetail', 'addLineItem', 'saveQuoteAsTemplate',
        'duplicateCurrentQuote'
    ];
    
    missingFunctions.forEach(funcName => {
        if (!window[funcName]) {
            window[funcName] = createPlaceholderFunction(funcName);
        }
    });
    
    // Global error handler for missing functions
    window.addEventListener('error', (event) => {
        if (event.message && event.message.includes('is not a function')) {
            logDebug('Missing function called:', event.message);
            uiModals.showToast('This feature will be restored soon', 'info');
            event.preventDefault();
        }
    });
    
    logDebug('Legacy compatibility functions setup completed');
}

/**
 * @description Handle user login
 */
window.handleLogin = (event) => {
    event.preventDefault();
    
    try {
        const userSelect = document.getElementById('user-select');
        const userId = userSelect?.value;
        
        if (!userId) {
            uiModals.showToast('Please select a user', 'error');
                return;
            }
            
        if (app) {
            app.setCurrentUser(userId);
            uiModals.closeModal('login-modal');
        } else {
            logError('Application not initialized');
            uiModals.showToast('Application not ready', 'error');
        }
        } catch (error) {
        logError('Login error:', error);
    }
};

/**
 * @description Handle mobile menu toggle
 */
window.toggleMobileMenu = () => {
    try {
        const navigation = document.getElementById('main-navigation');
        if (navigation) {
            navigation.classList.toggle('mobile-open');
        }
        } catch (error) {
        logError('Mobile menu toggle error:', error);
    }
};

/**
 * @description Initialize when DOM is ready
 */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApplication);
        } else {
    // DOM is already ready
    initializeApplication();
}

// Export for module usage
export { app, initializeApplication };

// Global access for debugging
if (typeof window !== 'undefined') {
    window.initializeApplication = initializeApplication;
}