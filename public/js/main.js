/**
 * @fileoverview Main application module
 * @description Entry point for the CRM application, handles initialization and coordination
 */

import { db } from './database.js';
import { activities, ACTIVITY_STATUS, ACTIVITY_PRIORITY, ACTIVITY_TYPES } from './activities.js';
import { resources, RESOURCE_TYPES, RESOURCE_STATUS } from './resources.js';
import { uiModals, MODAL_TYPES } from './ui-modals.js';
import { 
    logDebug, 
    logError, 
    logInfo, 
    sanitizeHTML, 
    validateFormData, 
    formatCurrency, 
    formatDate,
    generateId,
    debounce
} from './utils.js';

/**
 * @description Main application class
 */
class CRMApplication {
    constructor() {
        this.currentPage = 'dashboard';
        this.isInitialized = false;
        this.loadingOverlay = null;
        this.config = {
            DB_NAME: 'CRM_Database',
            VERSION: '1.0.0',
            MAX_DESCRIPTION_LENGTH: 1000,
            DEFAULT_ACTIVITY_DURATION: 60
        };
        
        // Store original data for filtering
        this.originalPcNumbers = [];
        this.originalActivities = [];
        this.originalQuotes = [];
    }

    /**
     * @description Initialize the application
     */
    async initialize() {
        // Add timeout protection
        const initTimeout = setTimeout(() => {
            logError('Initialize timeout after 30 seconds!');
            this.showError('Application initialization timed out. Please refresh the page.');
            this.hideLoadingOverlay();
        }, 30000);

        try {
            logInfo('Initializing CRM Application...');
            console.log('🚀 INIT: Starting CRM Application initialization...');
            this.showLoadingOverlay('Initializing application...');
            logDebug('Loading overlay shown, updating progress to 20%');
            console.log('🚀 INIT: Loading overlay shown, progress updating to 20%');
            
            // Force show loading overlay if showLoadingOverlay failed
            const overlay = document.getElementById('loading-overlay');
            if (overlay) {
                overlay.style.display = 'flex';
                overlay.classList.add('active');
                logDebug('Force-enabled loading overlay');
            }

            // Initialize core systems
            this.updateProgress(20, 'Connecting to database...');
            console.log('🚀 INIT: Progress updated to 20%, starting database init...');
            logDebug('Starting database initialization...');
            await this.initializeDatabase();
            logDebug('Database initialization completed');
            
            this.updateProgress(50, 'Setting up user interface...');
            logDebug('Starting UI initialization...');
            await this.initializeUI();
            logDebug('UI initialization completed');
            
            this.updateProgress(75, 'Loading data...');
            logDebug('Setting up event listeners...');
            await this.setupEventListeners();
            logDebug('Event listeners setup completed');

            this.updateProgress(90, 'Almost ready...');
            logDebug('Navigating to page:', this.currentPage);
            // Set initial page
            this.navigateToPage(this.currentPage);
            logDebug('Page navigation completed');

            this.updateProgress(100, 'Complete!');
            logDebug('Initialize completed successfully');
            
            // Clear timeout since we completed successfully
            clearTimeout(initTimeout);
            
            // Try immediate hiding first
            logDebug('Attempting immediate overlay hiding...');
            this.hideLoadingOverlay();
            
            // Also set timeout as backup
            logDebug('Setting timeout to hide loading overlay in 500ms as backup...');
            setTimeout(() => {
                logDebug('Timeout triggered, hiding loading overlay again');
                this.hideLoadingOverlay();
            }, 500);
            
            // Force hide with direct DOM manipulation as final backup
            setTimeout(() => {
                logDebug('Final backup: forcing overlay hide with DOM manipulation');
                const overlay = document.getElementById('loading-overlay');
                if (overlay) {
                    overlay.remove(); // Completely remove the element
                    logDebug('Loading overlay completely removed from DOM');
                }
            }, 1000);
            
            this.isInitialized = true;
            logInfo('CRM Application initialized successfully');

        } catch (error) {
            clearTimeout(initTimeout);
            logError('Failed to initialize application:', error);
            this.showError('Failed to initialize application. Please refresh the page.');
            this.hideLoadingOverlay();
        }
    }

    /**
     * @description Initialize database connection
     */
    async initializeDatabase() {
        try {
            logDebug('Calling db.initialize()...');
            console.log('🔵 DB: Starting db.initialize()...');
            await db.initialize();
            console.log('🔵 DB: db.initialize() completed');
            logDebug('db.initialize() completed');
            
            // Load sample data if database is empty
            logDebug('Getting database stats...');
            console.log('🔵 DB: Getting database stats...');
            const stats = await db.getStats();
            console.log('🔵 DB: Database stats:', stats);
            logDebug('Database stats:', stats);
            if (Object.values(stats).every(count => count === 0)) {
                logDebug('Database is empty, loading sample data...');
                console.log('🔵 DB: Database is empty, loading sample data...');
                await this.loadSampleData();
                console.log('🔵 DB: Sample data loaded');
                logDebug('Sample data loaded');
            } else {
                logDebug('Database has data, skipping sample data load');
                console.log('🔵 DB: Database has data, skipping sample data load');
            }
            
            // Assign random users to existing records that don't have user audit fields
            logDebug('Assigning random users to existing data...');
            console.log('🔵 DB: Assigning random users to existing data...');
            await db.assignRandomUsersToExistingData();
            console.log('🔵 DB: Random user assignment completed');
            logDebug('Random user assignment completed');
            
            // Migrate PC Numbers to new format PC-000001
            logDebug('Starting PC Numbers migration...');
            console.log('🔵 DB: Starting PC Numbers migration...');
            await this.migratePcNumbersToNewFormat();
            console.log('🔵 DB: PC Numbers migration completed');
            logDebug('PC Numbers migration completed');
        } catch (error) {
            console.error('🔵 DB ERROR:', error);
            logError('Database initialization failed:', error);
            throw error;
        }
    }

    /**
     * @description Initialize UI components
     */
    async initializeUI() {
        try {
            // Initialize modal system
            uiModals.initialize();

            // Setup mobile menu
            this.setupMobileMenu();

            // Initialize page-specific components
            this.initializePageComponents();

        } catch (error) {
            logError('UI initialization failed:', error);
            throw error;
        }
    }

    /**
     * @description Set up global event listeners
     */
    async setupEventListeners() {
        try {
            // Navigation buttons
            document.querySelectorAll('[data-show-page]').forEach(button => {
                button.addEventListener('click', (event) => {
                    event.preventDefault();
                    const page = button.getAttribute('data-show-page');
                    this.navigateToPage(page);
                });
            });

            // Modal open buttons
            document.querySelectorAll('[data-modal-open]').forEach(button => {
                button.addEventListener('click', (event) => {
                    event.preventDefault();
                    const modalId = button.getAttribute('data-modal-open');
                    const data = button.dataset.modalData ? JSON.parse(button.dataset.modalData) : {};
                    uiModals.openModal(modalId, { data });
                });
            });

            // Form submissions
            this.setupFormHandlers();

            // Global keyboard shortcuts
            this.setupKeyboardShortcuts();

            // Window events
            window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
            window.addEventListener('resize', debounce(this.handleWindowResize.bind(this), 250));

        } catch (error) {
            logError('Event listener setup failed:', error);
            throw error;
        }
    }

    /**
     * @description Navigate to a specific page
     * @param {string} pageName - Page to navigate to
     */
    navigateToPage(pageName) {
        try {
            // Hide all pages
            document.querySelectorAll('.page').forEach(page => {
                page.classList.remove('active');
            });

            // Show target page
            const targetPage = document.getElementById(pageName);
            if (targetPage) {
                targetPage.classList.add('active');
                this.currentPage = pageName;

                // Update navigation state
                this.updateNavigationState(pageName);

                // Load page data
                this.loadPageData(pageName);

                // Update URL (if history API is available)
                if (window.history && window.history.pushState) {
                    window.history.pushState({ page: pageName }, '', `#${pageName}`);
                }

                logDebug('Navigated to page:', pageName);
            } else {
                logError('Page not found:', pageName);
            }
        } catch (error) {
            logError('Navigation failed:', error);
        }
    }

    /**
     * @description Update navigation button states
     * @param {string} activePage - Currently active page
     */
    updateNavigationState(activePage) {
        try {
            document.querySelectorAll('.nav-btn').forEach(button => {
                button.classList.remove('active');
                button.setAttribute('aria-pressed', 'false');
            });

            const activeButton = document.querySelector(`[data-show-page="${activePage}"]`);
            if (activeButton) {
                activeButton.classList.add('active');
                activeButton.setAttribute('aria-pressed', 'true');
            }
        } catch (error) {
            logError('Failed to update navigation state:', error);
        }
    }

    /**
     * @description Load data for the current page
     * @param {string} pageName - Page name
     */
    async loadPageData(pageName) {
        try {
            logInfo(`Loading data for page: ${pageName}`);
            switch (pageName) {
                case 'dashboard':
                    await this.loadDashboardData();
                    break;
                case 'activities':
                    await this.loadActivitiesData();
                    break;
                case 'activity-detail':
                    // Detail pages are loaded via specific functions, not automatically
                    break;
                case 'resources':
                    await this.loadResourcesData();
                    break;
                case 'pcnumbers':
                    await this.loadPcNumbersData();
                    break;
                case 'pc-detail':
                    // Detail pages are loaded via specific functions, not automatically
                    break;
                case 'quotes':
                    await this.loadQuotesData();
                    break;
                case 'quote-detail':
                    // Detail pages are loaded via specific functions, not automatically
                    break;
                case 'pricelists':
                    await this.loadPriceListsData();
                    break;
                case 'quote-builder':
                    await this.loadQuoteBuilderData();
                    break;
                case 'pricelist-item-detail':
                    // Detail pages are loaded via specific functions, not automatically
                    break;
                case 'settings':
                    await this.loadSettingsData();
                    break;

                default:
                    logDebug('No specific loader for page:', pageName);
            }
            logInfo(`Data loaded successfully for page: ${pageName}`);
        } catch (error) {
            logError(`Failed to load data for page ${pageName}:`, error);
        }
    }

    /**
     * @description Load dashboard data
     */
    async loadDashboardData() {
        try {
            const [activityStats, resourceStats, dbStats] = await Promise.all([
                activities.getActivityStats(),
                resources.getResourceStats(),
                db.getStats()
            ]);

            await this.updateDashboardStats({
                activities: activityStats,
                resources: resourceStats,
                database: dbStats
            });

        } catch (error) {
            logError('Failed to load dashboard data:', error);
        }
    }

    /**
     * @description Update dashboard statistics display
     * @param {Object} stats - Statistics data
     */
    async updateDashboardStats(stats) {
        try {
            // Update stat cards with correct HTML IDs
            const statCards = {
                'stat-pc': stats.database.pcNumbers || 0,
                'stat-activities': stats.activities.total || 0,
                'stat-quotes': stats.database.quotes || 0
            };

            Object.entries(statCards).forEach(([id, value]) => {
                const element = document.getElementById(id);
                if (element) {
                    element.textContent = value.toLocaleString();
                }
            });

            // Calculate and update quote value
            await this.updateQuoteValue();

            // Load recent data tables
            await this.loadRecentPCNumbers();
            await this.loadRecentQuotes();
            await this.loadRecentActivities();

            logDebug('Dashboard stats updated');
        } catch (error) {
            logError('Failed to update dashboard stats:', error);
        }
    }

    /**
     * @description Update quote value on dashboard
     */
    async updateQuoteValue() {
        try {
            const quotes = await db.loadAll('quotes');
            const totalValue = quotes.reduce((sum, quote) => {
                return sum + (parseFloat(quote.value) || 0);
            }, 0);

            const statValue = document.getElementById('stat-value');
            if (statValue) {
                statValue.textContent = `£${totalValue.toLocaleString()}`;
            }
        } catch (error) {
            logError('Failed to update quote value:', error);
        }
    }

    /**
     * @description Load recent PC numbers for dashboard table
     */
    async loadRecentPCNumbers() {
        try {
            const pcNumbers = await db.loadAll('pcNumbers');
            // Sort by creation date and take last 5
            const recentPCs = pcNumbers
                .sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0))
                .slice(0, 5);

            const container = document.getElementById('recent-pc');
            if (!container) return;

            if (recentPCs.length === 0) {
                container.innerHTML = '<tr><td colspan="4">No PC Numbers found</td></tr>';
                return;
            }

            const rows = recentPCs.map(pc => `
                <tr class="clickable-row" onclick="window.viewPcDetail('${pc.id}')" style="cursor: pointer;">
                    <td>${pc.pcNumber || ''}</td>
                    <td>${pc.company || ''}</td>
                    <td>${pc.reference || ''}</td>
                    <td>${formatDate(pc.createdAt || pc.date)}</td>
                </tr>
            `).join('');

            container.innerHTML = rows;
            logDebug(`Loaded ${recentPCs.length} recent PC numbers`);
        } catch (error) {
            logError('Failed to load recent PC numbers:', error);
        }
    }

    /**
     * @description Load recent quotes for dashboard table
     */
    async loadRecentQuotes() {
        try {
            const quotes = await db.loadAll('quotes');
            // Sort by creation date and take last 5
            const recentQuotes = quotes
                .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
                .slice(0, 5);

            const container = document.getElementById('recent-quotes');
            if (!container) return;

            if (recentQuotes.length === 0) {
                container.innerHTML = '<tr><td colspan="6">No Quotes found</td></tr>';
                return;
            }

            const rows = recentQuotes.map(quote => `
                <tr class="clickable-row" onclick="window.viewQuoteDetail('${quote.id}')" style="cursor: pointer;">
                    <td>${quote.quoteNumber || quote.id}</td>
                    <td>${quote.pcNumber || 'N/A'}</td>
                    <td>${quote.clientName || 'N/A'}</td>
                    <td>${formatCurrency(quote.value || quote.total || 0)}</td>
                    <td><span class="quote-status ${quote.status || 'draft'}">${quote.status || 'draft'}</span></td>
                    <td>${formatDate(quote.createdAt)}</td>
                </tr>
            `).join('');

            container.innerHTML = rows;
            logDebug(`Loaded ${recentQuotes.length} recent quotes`);
        } catch (error) {
            logError('Failed to load recent quotes:', error);
        }
    }

    /**
     * @description Load recent activities for dashboard table
     */
    async loadRecentActivities() {
        try {
            const activities = await db.loadAll('activities');
            // Sort by creation date and take last 5
            const recentActivities = activities
                .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
                .slice(0, 5);

            const container = document.getElementById('recent-activities');
            if (!container) return;

            if (recentActivities.length === 0) {
                container.innerHTML = '<tr><td colspan="6">No Activities found</td></tr>';
                return;
            }

            const rows = recentActivities.map(activity => `
                <tr class="clickable-row" onclick="window.viewActivityDetail('${activity.id}')" style="cursor: pointer;">
                    <td>${activity.title || 'N/A'}</td>
                    <td>${activity.type || 'N/A'}</td>
                    <td>${activity.quoteId ? 'Quote: ' + activity.quoteId : (activity.pcNumber || 'N/A')}</td>
                    <td><span class="activity-status ${activity.status || 'pending'}">${this.formatStatus(activity.status || 'pending')}</span></td>
                    <td>${formatDate(activity.scheduledDate || activity.startDate)}</td>
                    <td>${formatDate(activity.createdAt)}</td>
                </tr>
            `).join('');

            container.innerHTML = rows;
            logDebug(`Loaded ${recentActivities.length} recent activities`);
        } catch (error) {
            logError('Failed to load recent activities:', error);
        }
    }

    /**
     * @description Load activities data
     */
    async loadActivitiesData() {
        try {
            const allActivities = await activities.getAllActivities();
            this.originalActivities = allActivities; // Store for filtering
            this.renderActivitiesList(allActivities);
            this.renderActivitiesCalendar(allActivities);
            
            // Populate quote dropdown for activity forms
            await this.populateActivityQuoteDropdown();
        } catch (error) {
            logError('Failed to load activities data:', error);
        }
    }

    /**
     * @description Populate quote dropdown in activity forms
     */
    async populateActivityQuoteDropdown() {
        try {
            const quoteSelect = document.getElementById('activity-quote-select');
            if (!quoteSelect) return;

            const allQuotes = await db.loadAll('quotes');
            const allPCs = await db.loadAll('pcNumbers');
            
            // Create a map of PC Numbers for quick lookup
            const pcMap = new Map();
            allPCs.forEach(pc => {
                pcMap.set(pc.id, pc);
                if (pc.pcNumber) pcMap.set(pc.pcNumber, pc);
            });

            // Clear existing options
            quoteSelect.innerHTML = '<option value="">Select Quote...</option>';

            // Add quotes with PC Number context
            allQuotes
                .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
                .forEach(quote => {
                    const option = document.createElement('option');
                    option.value = quote.id;
                    
                    // Get related PC info
                    let pcInfo = '';
                    const relatedPC = pcMap.get(quote.pcId) || pcMap.get(quote.pcNumber);
                    if (relatedPC) {
                        pcInfo = ` (${relatedPC.pcNumber || relatedPC.id} - ${relatedPC.company || 'Unknown Company'})`;
                    }
                    
                    option.textContent = `${quote.quoteNumber || quote.id}${pcInfo}`;
                    quoteSelect.appendChild(option);
                });

        } catch (error) {
            logError('Failed to populate activity quote dropdown:', error);
        }
    }

    /**
     * @description Load Settings page data and statistics
     */
    async loadSettingsData() {
        try {
            logInfo('Loading Settings page data...');
            
            // Update current user
            const currentUser = this.getCurrentUser();
            document.getElementById('settings-current-user').textContent = currentUser || 'Not logged in';
            
            // Get database statistics
            const stats = await db.getStats();
            
            // Update statistics display
            document.getElementById('settings-pc-count').textContent = stats.pcNumbers || '0';
            document.getElementById('settings-quotes-count').textContent = stats.quotes || '0';
            document.getElementById('settings-activities-count').textContent = stats.activities || '0';
            document.getElementById('settings-pricelists-count').textContent = stats.priceLists || '0';
            document.getElementById('settings-resources-count').textContent = stats.resources || '0';
            
            // Setup file input listener
            const fileInput = document.getElementById('import-file');
            const importButton = document.getElementById('import-button');
            
            if (fileInput && importButton) {
                fileInput.addEventListener('change', (event) => {
                    const file = event.target.files[0];
                    importButton.disabled = !file;
                });
            }
            
            logInfo('Settings page data loaded successfully');
        } catch (error) {
            logError('Failed to load Settings data:', error);
        }
    }

    /**
     * @description Render activities list
     * @param {Array} activitiesList - Array of activities
     */
    renderActivitiesList(activitiesList) {
        try {
            const container = document.getElementById('activities-list');
            if (!container) return;

            if (activitiesList.length === 0) {
                container.innerHTML = '<p>No activities found.</p>';
                return;
            }

            const rowsHTML = activitiesList.map(activity => `
                <tr class="clickable-row" onclick="window.viewActivityDetail('${activity.id}')" style="cursor: pointer;">
                    <td>${sanitizeHTML(activity.title)}</td>
                    <td>${sanitizeHTML(activity.pcNumber || 'N/A')}</td>
                    <td>${sanitizeHTML(activity.clientName || 'N/A')}</td>
                    <td>${this.formatActivityType(activity.type)}</td>
                    <td>${formatDate(activity.startDate || activity.scheduledDate)}</td>
                    <td><span class="priority-${activity.priority}">${this.formatPriority(activity.priority)}</span></td>
                    <td><span class="activity-status ${activity.status}">${this.formatStatus(activity.status)}</span></td>
                    <td onclick="event.stopPropagation()">
                        <button onclick="window.editActivity('${activity.id}')" class="secondary">Edit</button>
                        <button onclick="window.deleteActivity('${activity.id}')" class="danger">Delete</button>
                    </td>
                </tr>
            `).join('');

            container.innerHTML = rowsHTML;
        } catch (error) {
            logError('Failed to render activities list:', error);
        }
    }

    /**
     * @description Set up form handlers
     */
    setupFormHandlers() {
        try {
            // PC Number form
            const pcForm = document.getElementById('pc-form');
            if (pcForm) {
                pcForm.addEventListener('submit', this.handlePcNumberSubmit.bind(this));
            }

            // PC Number edit form
            const pcEditForm = document.getElementById('pc-edit-form');
            if (pcEditForm) {
                pcEditForm.addEventListener('submit', this.handlePcNumberUpdate.bind(this));
            }

            // Quote edit form
            const quoteEditForm = document.getElementById('quote-edit-form');
            if (quoteEditForm) {
                quoteEditForm.addEventListener('submit', this.handleQuoteEditSubmit.bind(this));
            }

            // Activity form
            const activityForm = document.getElementById('activity-form');
            if (activityForm) {
                activityForm.addEventListener('submit', this.handleActivitySubmit.bind(this));
            }

            // Resource form
            const resourceForm = document.getElementById('resource-form');
            if (resourceForm) {
                resourceForm.addEventListener('submit', this.handleResourceSubmit.bind(this));
            }

            // Quote form
            const quoteForm = document.getElementById('quote-form');
            if (quoteForm) {
                quoteForm.addEventListener('submit', this.handleQuoteSubmit.bind(this));
            }

            // Price List form
            const priceListForm = document.getElementById('pricelist-form');
            if (priceListForm) {
                priceListForm.addEventListener('submit', this.handlePriceListSubmit.bind(this));
            }

            // Price List Item form
            const priceListItemForm = document.getElementById('pricelist-item-form');
            if (priceListItemForm) {
                priceListItemForm.addEventListener('submit', this.handlePriceListItemSubmit.bind(this));
            }

            // Price List Item margin calculation listener
            const priceInput = document.getElementById('pricelist-item-price');
            const marginInput = document.getElementById('pricelist-item-margin');
            const clientPriceInput = document.getElementById('pricelist-item-client-price');
            
            const calculateClientPrice = () => {
                const price = parseFloat(priceInput.value) || 0;
                const margin = parseFloat(marginInput.value) || 0;
                const clientPrice = price * (1 + margin / 100);
                clientPriceInput.value = clientPrice.toFixed(2);
            };
            
            if (priceInput && marginInput && clientPriceInput) {
                priceInput.addEventListener('input', calculateClientPrice);
                marginInput.addEventListener('input', calculateClientPrice);
            }

            // Activity status change listener (show/hide completion section)
            const activityStatus = document.getElementById('activity-status');
            if (activityStatus) {
                activityStatus.addEventListener('change', (event) => {
                    const completionSection = document.getElementById('activity-completion-section');
                    if (completionSection) {
                        completionSection.style.display = event.target.value === 'completed' ? 'block' : 'none';
                    }
                });
            }

            // Smart Features: Auto-fill Activity from Quote selection
            const activityQuoteSelect = document.getElementById('activity-quote-select');
            if (activityQuoteSelect) {
                activityQuoteSelect.addEventListener('change', (event) => {
                    if (event.target.value) {
                        this.autoFillActivityFromQuote(event.target.value);
                    }
                });
            }

            // Smart Features: Auto-fill Quote from PC Number selection
            const quoteModalPc = document.getElementById('quote-modal-pc');
            if (quoteModalPc) {
                quoteModalPc.addEventListener('change', (event) => {
                    if (event.target.value) {
                        this.autoFillQuoteFromPC(event.target.value);
                    }
                });
            }



        } catch (error) {
            logError('Failed to setup form handlers:', error);
        }
    }

    /**
     * @description Generate next PC Number in format PC-000001
     */
    async getNextPcNumber() {
        try {
            const allPcNumbers = await db.loadAll('pcNumbers');
            
            if (!allPcNumbers || allPcNumbers.length === 0) {
                return 'PC-000001';
            }
            
            // Extract numeric parts and find the highest number
            const numbers = allPcNumbers
                .map(pc => {
                    const match = pc.pcNumber.match(/PC-(\d{6})/);
                    return match ? parseInt(match[1], 10) : 0;
                })
                .filter(num => !isNaN(num));
            
            const maxNumber = Math.max(...numbers, 0);
            const nextNumber = maxNumber + 1;
            
            // Format with leading zeros (6 digits)
            return `PC-${nextNumber.toString().padStart(6, '0')}`;
        } catch (error) {
            logError('Error generating next PC Number:', error);
            return 'PC-000001'; // Fallback
        }
    }

    /**
     * @description Migrate existing PC Numbers to new format
     */
    async migratePcNumbersToNewFormat() {
        try {
            console.log('🔵 MIGRATE: Starting PC Numbers migration...');
            const allPcNumbers = await db.loadAll('pcNumbers');
            console.log('🔵 MIGRATE: Loaded PC Numbers:', allPcNumbers?.length || 0);
            
            if (!allPcNumbers || allPcNumbers.length === 0) {
                logInfo('No PC Numbers to migrate');
                console.log('🔵 MIGRATE: No PC Numbers to migrate');
                return;
            }
            
            // Skip migration to prevent hang - user can migrate manually later
            console.log('🔵 MIGRATE: Skipping migration to prevent initialization hang');
            logInfo('PC Numbers migration skipped for faster initialization');
            return;
            
            // Sort by creation date to maintain chronological order
            allPcNumbers.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            
            let migrationCount = 0;
            
            for (let i = 0; i < allPcNumbers.length; i++) {
                const pcNumber = allPcNumbers[i];
                const newPcNumber = `PC-${(i + 1).toString().padStart(6, '0')}`;
                
                if (pcNumber.pcNumber !== newPcNumber) {
                    logInfo(`Migrating ${pcNumber.pcNumber} → ${newPcNumber}`);
                    
                    // Update PC Number
                    pcNumber.pcNumber = newPcNumber;
                    pcNumber.lastModifiedAt = new Date().toISOString();
                    
                    // Save updated PC Number
                    await db.save('pcNumbers', pcNumber);
                    
                    // Update related quotes
                    const relatedQuotes = await db.loadAll('quotes');
                    for (const quote of relatedQuotes) {
                        if (quote.pcNumber === pcNumber.pcNumber || quote.pcId === pcNumber.id) {
                            quote.pcNumber = newPcNumber;
                            await db.save('quotes', quote);
                        }
                    }
                    
                    // Update related activities (legacy support)
                    const relatedActivities = await db.loadAll('activities');
                    for (const activity of relatedActivities) {
                        if (activity.pcNumber === pcNumber.pcNumber) {
                            activity.pcNumber = newPcNumber;
                            await db.save('activities', activity);
                        }
                    }
                    
                    migrationCount++;
                }
            }
            
            if (migrationCount > 0) {
                logInfo(`Successfully migrated ${migrationCount} PC Numbers to new format`);
                uiModals.showToast(`Migrated ${migrationCount} PC Numbers to new format PC-000001`, 'success');
            } else {
                logInfo('All PC Numbers already in correct format');
            }
            
        } catch (error) {
            logError('Error migrating PC Numbers:', error);
            uiModals.showToast('Error migrating PC Numbers format', 'error');
        }
    }

    /**
     * @description Handle PC Number form submission
     * @param {Event} event - Form submit event
     */
    async handlePcNumberSubmit(event) {
        event.preventDefault();
        
        try {
            // Auto-generate PC Number
            const nextPcNumber = await this.getNextPcNumber();
            
            // Collect data directly from form elements using IDs
            const pcNumberData = {
                // Basic fields - PC Number is auto-generated
                pcNumber: nextPcNumber,
                projectTitle: document.getElementById('pc-project-name').value,
                projectDescription: document.getElementById('pc-project-description').value,
                clientName: document.getElementById('pc-company-name').value,
                contactName: document.getElementById('pc-contact-name').value,
                contactEmail: document.getElementById('pc-contact-email').value,
                contactPhone: document.getElementById('pc-contact-phone').value,
                accountManager: document.getElementById('pc-account-manager').value,
                industry: document.getElementById('pc-client-industry').value,
                source: document.getElementById('pc-client-source').value,
                budgetRange: document.getElementById('pc-quote-limit').value,
                postcode: document.getElementById('pc-postcode').value,
                status: 'active', // Automatically set to active when PC Number is created
                
                // Classification & Management fields
                clientCategory: document.getElementById('pc-client-category').value,
                clientSource: document.getElementById('pc-client-source').value, // Note: This duplicates 'source' for compatibility
                referralType: document.getElementById('pc-referral-type').value,

                propertyType: document.getElementById('pc-property-type').value,
                sicCode1: document.getElementById('pc-sic-code-1').value,
                sicCode2: document.getElementById('pc-sic-code-2').value,
                sicCode3: document.getElementById('pc-sic-code-3').value,
                
                // Collection Address fields
                collectionFirstName: document.getElementById('pc-collection-first-name').value,
                collectionSurname: document.getElementById('pc-collection-surname').value,
                collectionTitle: document.getElementById('pc-collection-title').value,
                collectionPosition: document.getElementById('pc-collection-position').value,
                collectionEmail: document.getElementById('pc-collection-email').value,
                collectionPhone: document.getElementById('pc-collection-phone').value,
                collectionMobile: document.getElementById('pc-collection-mobile').value,
                collectionCountry: document.getElementById('pc-collection-country').value,
                collectionPostcode: document.getElementById('pc-collection-postcode').value,
                collectionAddress1: document.getElementById('pc-collection-address-1').value,
                collectionAddress2: document.getElementById('pc-collection-address-2').value,
                collectionAddress3: document.getElementById('pc-collection-address-3').value,
                collectionAddress4: document.getElementById('pc-collection-address-4').value,
                collectionDate: document.getElementById('pc-collection-date').value,
                
                // Delivery Address fields
                deliveryFirstName: document.getElementById('pc-delivery-first-name').value,
                deliverySurname: document.getElementById('pc-delivery-surname').value,
                deliveryTitle: document.getElementById('pc-delivery-title').value,
                deliveryPosition: document.getElementById('pc-delivery-position').value,
                deliveryEmail: document.getElementById('pc-delivery-email').value,
                deliveryPhone: document.getElementById('pc-delivery-phone').value,
                deliveryMobile: document.getElementById('pc-delivery-mobile').value,
                deliveryCountry: document.getElementById('pc-delivery-country').value,
                deliveryPostcode: document.getElementById('pc-delivery-postcode').value,
                deliveryAddress1: document.getElementById('pc-delivery-address-1').value,
                deliveryAddress2: document.getElementById('pc-delivery-address-2').value,
                deliveryAddress3: document.getElementById('pc-delivery-address-3').value,
                deliveryAddress4: document.getElementById('pc-delivery-address-4').value,
                deliveryDate: document.getElementById('pc-delivery-date').value,
                
                // Timestamps
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Basic validation (PC Number is auto-generated)
            if (!pcNumberData.projectTitle || !pcNumberData.clientName || !pcNumberData.contactName || !pcNumberData.accountManager) {
                uiModals.showToast('Please fill in all required fields', 'error');
                return;
            }

            // PC Number is auto-generated, so no format validation needed
            logDebug(`Auto-generated PC Number: ${pcNumberData.pcNumber}`);

            // Validate contact information (at least phone or email)
            if (!pcNumberData.contactPhone && !pcNumberData.contactEmail) {
                uiModals.showToast('Please provide at least phone or email for contact', 'error');
                return;
            }

            // Validate collection date before delivery date
            if (pcNumberData.collectionDate && pcNumberData.deliveryDate) {
                const collectionDate = new Date(pcNumberData.collectionDate);
                const deliveryDate = new Date(pcNumberData.deliveryDate);
                if (collectionDate >= deliveryDate) {
                    uiModals.showToast('Collection date must be before delivery date', 'error');
                    return;
                }
            }

            const savedPcNumber = await db.save('pcNumbers', { ...pcNumberData, id: generateId() });
            
            uiModals.showToast('PC Number created successfully', 'success');
            
            // Navigate back to PC Numbers list
            this.navigateToPage('pc-numbers');
            
            // Refresh page data
            await this.loadPcNumbersData();
            
            // Also refresh dashboard if needed
            if (this.currentPage === 'dashboard') {
                await this.loadDashboardData();
            }

        } catch (error) {
            logError('Failed to save PC Number:', error);
            uiModals.showToast('Failed to save PC Number', 'error');
        }
    }

    /**
     * @description Handle PC Number update form submission
     * @param {Event} event - Form submit event
     */
    async handlePcNumberUpdate(event) {
        event.preventDefault();
        
        try {
            const formData = new FormData(event.target);
            const pcId = document.getElementById('pc-edit-id').value;
            
            if (!pcId) {
                uiModals.showToast('PC Number ID not found', 'error');
                return;
            }

            // Collect data from form
            const updatedData = {
                id: pcId,
                // Basic Information
                pcNumber: document.getElementById('pc-edit-number').value,
                projectTitle: document.getElementById('pc-edit-title').value,
                projectDescription: document.getElementById('pc-edit-description').value,
                company: document.getElementById('pc-edit-company').value,
                clientName: document.getElementById('pc-edit-company').value, // Keep both for compatibility
                status: document.getElementById('pc-edit-status').value,
                
                // Client Details
                accountManager: document.getElementById('pc-edit-account-manager').value,
                industry: document.getElementById('pc-edit-client-industry').value,
                source: document.getElementById('pc-edit-client-source').value,
                budgetRange: document.getElementById('pc-edit-quote-limit').value,
                
                // Classification & Management
                clientCategory: document.getElementById('pc-edit-client-category').value,
                clientSource: document.getElementById('pc-edit-client-source-new').value,
                referralType: document.getElementById('pc-edit-referral-type').value,
                propertyType: document.getElementById('pc-edit-property-type').value,
                sicCode1: document.getElementById('pc-edit-sic-code-1').value,
                sicCode2: document.getElementById('pc-edit-sic-code-2').value,
                sicCode3: document.getElementById('pc-edit-sic-code-3').value,
                
                // Contact Information
                contactName: document.getElementById('pc-edit-contact-name').value,
                contactPhone: document.getElementById('pc-edit-contact-phone').value,
                contactEmail: document.getElementById('pc-edit-contact-email').value,
                postcode: document.getElementById('pc-edit-postcode').value,
                
                // Collection Address
                collectionFirstName: document.getElementById('pc-edit-collection-first-name').value,
                collectionSurname: document.getElementById('pc-edit-collection-surname').value,
                collectionTitle: document.getElementById('pc-edit-collection-title').value,
                collectionPosition: document.getElementById('pc-edit-collection-position').value,
                collectionDate: document.getElementById('pc-edit-collection-date').value,
                collectionEmail: document.getElementById('pc-edit-collection-email').value,
                collectionPhone: document.getElementById('pc-edit-collection-phone').value,
                collectionMobile: document.getElementById('pc-edit-collection-mobile').value,
                collectionAddress1: document.getElementById('pc-edit-collection-address-1').value,
                collectionAddress2: document.getElementById('pc-edit-collection-address-2').value,
                collectionAddress3: document.getElementById('pc-edit-collection-address-3').value,
                collectionAddress4: document.getElementById('pc-edit-collection-address-4').value,
                collectionPostcode: document.getElementById('pc-edit-collection-postcode').value,
                collectionCountry: document.getElementById('pc-edit-collection-country').value,
                
                // Delivery Address
                deliveryFirstName: document.getElementById('pc-edit-delivery-first-name').value,
                deliverySurname: document.getElementById('pc-edit-delivery-surname').value,
                deliveryTitle: document.getElementById('pc-edit-delivery-title').value,
                deliveryPosition: document.getElementById('pc-edit-delivery-position').value,
                deliveryDate: document.getElementById('pc-edit-delivery-date').value,
                deliveryEmail: document.getElementById('pc-edit-delivery-email').value,
                deliveryPhone: document.getElementById('pc-edit-delivery-phone').value,
                deliveryMobile: document.getElementById('pc-edit-delivery-mobile').value,
                deliveryAddress1: document.getElementById('pc-edit-delivery-address-1').value,
                deliveryAddress2: document.getElementById('pc-edit-delivery-address-2').value,
                deliveryAddress3: document.getElementById('pc-edit-delivery-address-3').value,
                deliveryAddress4: document.getElementById('pc-edit-delivery-address-4').value,
                deliveryPostcode: document.getElementById('pc-edit-delivery-postcode').value,
                deliveryCountry: document.getElementById('pc-edit-delivery-country').value,
                
                updatedAt: new Date()
            };

            // Validation
            if (!updatedData.pcNumber || !updatedData.company || !updatedData.projectTitle) {
                uiModals.showToast('Please fill in all required fields (PC Number, Company Name, Project Title)', 'error');
                return;
            }

            // Update in database
            await db.save('pcNumbers', updatedData);
            
            // Close modal and show success
            uiModals.closeModal('pc-edit-modal');
            uiModals.showToast('PC Number updated successfully', 'success');
            
            // Refresh page data
            if (this.currentPage === 'pcnumbers') {
                await this.loadPcNumbersData();
            }
            
            // Also refresh dashboard if that's current page
            if (this.currentPage === 'dashboard') {
                await this.loadDashboardData();
            }

        } catch (error) {
            logError('Failed to update PC Number:', error);
            uiModals.showToast('Failed to update PC Number', 'error');
        }
    }

    /**
     * @description Handle activity form submission (create or edit)
     * @param {Event} event - Form submit event
     */
    async handleActivitySubmit(event) {
        event.preventDefault();
        
        try {
            // Check if we're editing (activity-id has value) or creating new
            const activityId = document.getElementById('activity-id').value;
            const isEdit = Boolean(activityId);
            
            // Collect data from form fields directly
            const activityData = {
                title: document.getElementById('activity-title').value,
                description: document.getElementById('activity-description').value,
                type: document.getElementById('activity-type').value,
                quoteId: document.getElementById('activity-quote-select').value,
                scheduledDate: document.getElementById('activity-scheduled-date').value,
                scheduledTime: document.getElementById('activity-scheduled-time').value,
                duration: parseInt(document.getElementById('activity-duration').value) || 60,
                priority: document.getElementById('activity-priority').value,
                status: document.getElementById('activity-status').value,
                assignedTo: document.getElementById('activity-assigned-to-name').value,
                location: document.getElementById('activity-location').value,
                contactName: document.getElementById('activity-contact-name').value,
                contactPhone: document.getElementById('activity-contact-phone').value,
                
                // Management & Timing fields
                department: document.getElementById('activity-department').value,
                paymentType: document.getElementById('activity-payment-type').value,
                activityNumber: document.getElementById('activity-number').value,
                timeDepotStart: document.getElementById('activity-time-depot-start').value,
                timeSiteStart: document.getElementById('activity-time-site-start').value,
                timeSiteFinish: document.getElementById('activity-time-site-finish').value,
                timeDepotFinish: document.getElementById('activity-time-depot-finish').value,
                hours: parseFloat(document.getElementById('activity-hours').value) || null,
                movemanJob: document.getElementById('activity-moveman-job').value,
                crmId: document.getElementById('activity-crm-id').value,
                
                // Professional Details
                instructions: document.getElementById('activity-instructions').value,
                
                // Logistics & Requirements (boolean flags)
                parkingRequired: document.getElementById('activity-parking-required').checked,
                confirmed: document.getElementById('activity-confirmed').checked,
                riskAssessmentNeeded: document.getElementById('activity-risk-assessment-needed').checked,
                
                // JSONB structures for addresses
                collectionAddress: {
                    address1: document.getElementById('activity-collection-address-1').value,
                    address2: document.getElementById('activity-collection-address-2').value,
                    city: document.getElementById('activity-collection-city').value,
                    postcode: document.getElementById('activity-collection-postcode').value,
                    country: document.getElementById('activity-collection-country').value,
                    contact: document.getElementById('activity-collection-contact').value,
                    phone: document.getElementById('activity-collection-phone').value
                },
                deliveryAddress: {
                    address1: document.getElementById('activity-delivery-address-1').value,
                    address2: document.getElementById('activity-delivery-address-2').value,
                    city: document.getElementById('activity-delivery-city').value,
                    postcode: document.getElementById('activity-delivery-postcode').value,
                    country: document.getElementById('activity-delivery-country').value,
                    contact: document.getElementById('activity-delivery-contact').value,
                    phone: document.getElementById('activity-delivery-phone').value
                },
                
                // Initialize empty arrays for resources and notes if not already present
                resources: [],
                notesList: []
            };

            // Add completion notes if activity is completed
            if (activityData.status === 'completed') {
                activityData.completionNotes = document.getElementById('activity-completion-notes').value;
            }

            let id;
            if (isEdit) {
                // Update existing activity
                activityData.id = activityId;
                activityData.updatedAt = new Date();
                await db.save('activities', activityData);
                id = activityId;
                
                uiModals.showToast('Activity updated successfully', 'success');
            } else {
                // Create new activity
                id = await activities.createActivity(activityData);
                uiModals.showToast('Activity created successfully', 'success');
            }
            
            // Reset modal title back to "New Activity" for next use
            document.getElementById('activity-modal-title').textContent = 'New Activity';
            
            uiModals.closeModal('activity-modal');
            
            // Refresh page data
            if (this.currentPage === 'activities') {
                await this.loadActivitiesData();
            }
            
            // Also refresh dashboard if that's current page
            if (this.currentPage === 'dashboard') {
                await this.loadDashboardData();
            }

        } catch (error) {
            logError('Failed to save activity:', error);
            uiModals.showToast('Failed to save activity', 'error');
        }
    }

    /**
     * @description Show loading overlay
     * @param {string} message - Loading message
     */
    showLoadingOverlay(message = 'Loading...') {
        try {
            this.loadingOverlay = document.getElementById('loading-overlay');
            if (this.loadingOverlay) {
                const messageElement = document.getElementById('loading-message');
                if (messageElement) {
                    messageElement.textContent = message;
                }
                // Reset any inline styles and show overlay
                this.loadingOverlay.style.display = '';
                this.loadingOverlay.classList.add('active');
                this.updateProgress(0);
            }
        } catch (error) {
            logError('Failed to show loading overlay:', error);
        }
    }

    /**
     * @description Update progress bar
     * @param {number} percentage - Progress percentage (0-100)
     * @param {string} text - Optional progress text
     */
    updateProgress(percentage, text = null) {
        try {
            console.log(`📊 PROGRESS: ${percentage}% - ${text || 'No text'}`);
            const progressBar = document.getElementById('progress-bar');
            const progressText = document.getElementById('progress-text');
            
            if (progressBar) {
                progressBar.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
                console.log(`📊 PROGRESS: Bar width set to ${progressBar.style.width}`);
            } else {
                console.log('📊 PROGRESS: Progress bar element not found!');
            }
            
            if (progressText) {
                progressText.textContent = text || `${Math.round(percentage)}%`;
                console.log(`📊 PROGRESS: Text set to "${progressText.textContent}"`);
            } else {
                console.log('📊 PROGRESS: Progress text element not found!');
            }
        } catch (error) {
            logError('Failed to update progress:', error);
            console.error('📊 PROGRESS ERROR:', error);
        }
    }

    /**
     * @description Hide loading overlay
     */
    hideLoadingOverlay() {
        try {
            logDebug('Attempting to hide loading overlay...');
            const overlay = document.getElementById('loading-overlay');
            if (overlay) {
                logDebug('Loading overlay found, using multiple hiding methods');
                
                // Method 1: Remove active class
                overlay.classList.remove('active');
                
                // Method 2: Force display none with inline style (highest priority)
                overlay.style.display = 'none';
                
                // Method 3: Hide with visibility
                overlay.style.visibility = 'hidden';
                
                // Method 4: Move off screen
                overlay.style.left = '-9999px';
                
                logDebug('Loading overlay hidden using multiple methods');
            } else {
                logError('Loading overlay element not found');
            }
        } catch (error) {
            logError('Failed to hide loading overlay:', error);
        }
    }

    /**
     * @description Show error message
     * @param {string} message - Error message
     */
    showError(message) {
        uiModals.showToast(message, 'error', 5000);
    }

    /**
     * @description Setup mobile menu functionality
     */
    setupMobileMenu() {
        try {
            const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
            const mainNavigation = document.getElementById('main-navigation');

            if (mobileMenuToggle && mainNavigation) {
                mobileMenuToggle.addEventListener('click', () => {
                    const isExpanded = mobileMenuToggle.getAttribute('aria-expanded') === 'true';
                    mobileMenuToggle.setAttribute('aria-expanded', !isExpanded);
                    mainNavigation.classList.toggle('active');
                });
            }
        } catch (error) {
            logError('Failed to setup mobile menu:', error);
        }
    }



    /**
     * @description Load sample data for demo purposes
     */
    async loadSampleData() {
        try {
            logInfo('Loading sample data...');
            console.log('🔵 SAMPLE: Starting sample data load...');
            
            // Skip sample data loading to avoid hang - user can add data manually
            console.log('🔵 SAMPLE: Skipping sample data to prevent initialization hang');
            logInfo('Sample data loading skipped for faster initialization');
            return;
            
            // Sample PC Numbers - UK Office Relocations (New Format PC-000001)
            const samplePCNumbers = [
                {
                    pcNumber: 'PC-000001',
                    company: 'Fintech Innovations Ltd',
                    reference: 'City to Canary Wharf Move',
                    projectTitle: 'Complete Office Relocation - City to Canary Wharf',
                    projectDescription: 'Full office relocation for 85 staff from City of London to new Canary Wharf headquarters including IT infrastructure and secure document handling',
                    clientName: 'Fintech Innovations Ltd',
                    contactName: 'James Morrison',
                    estimatedValue: 45000,
                    status: 'active',
                    date: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000), // 12 days ago
                    
                    // New comprehensive fields
                    clientCategory: 'Corporate',
                    clientSource: 'Website Inquiry',
                    referralType: 'Direct',
                    surveyor: 'Marcus Thompson',
                    propertyType: 'Office Building',
                    sicCode1: '64191',
                    sicCode2: '64999',
                    sicCode3: '',
                    
                    // Collection Address (Current Office)
                    collectionFirstName: 'James',
                    collectionSurname: 'Morrison',
                    collectionTitle: 'Mr',
                    collectionPosition: 'Facilities Manager',
                    collectionEmail: 'j.morrison@fintechinnovations.co.uk',
                    collectionPhone: '020 7946 0958',
                    collectionMobile: '07789 123456',
                    collectionCountry: 'United Kingdom',
                    collectionPostcode: 'EC2V 6DB',
                    collectionAddress1: '15 Bishopsgate',
                    collectionAddress2: '12th Floor',
                    collectionAddress3: 'City of London',
                    collectionAddress4: 'London',
                    collectionDate: '2024-02-15',
                    
                    // Delivery Address (New Office)
                    deliveryFirstName: 'Sarah',
                    deliverySurname: 'Chen',
                    deliveryTitle: 'Ms',
                    deliveryPosition: 'Office Manager',
                    deliveryEmail: 's.chen@fintechinnovations.co.uk',
                    deliveryPhone: '020 7418 2000',
                    deliveryMobile: '07789 654321',
                    deliveryCountry: 'United Kingdom',
                    deliveryPostcode: 'E14 5LQ',
                    deliveryAddress1: '25 Canada Square',
                    deliveryAddress2: '40th Floor',
                    deliveryAddress3: 'Canary Wharf',
                    deliveryAddress4: 'London',
                    deliveryDate: '2024-02-16',
                    
                    // User Audit Fields
                    createdBy: 'Slav',
                    editedBy: 'Slav',
                    lastModifiedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString()
                },
                {
                    pcNumber: 'PC-000002', 
                    company: 'Chambers & Associates',
                    reference: 'Law Firm Expansion Move',
                    projectTitle: 'Barrister Chambers Relocation',
                    projectDescription: 'Prestigious law chambers moving from Lincoln\'s Inn to larger premises in Temple with specialist library and archive handling',
                    clientName: 'Chambers & Associates',
                    contactName: 'Patricia Whitfield QC',
                    estimatedValue: 32000,
                    status: 'active',
                    date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
                    
                    // User Audit Fields
                    createdBy: 'Rob',
                    editedBy: 'Rob',
                    lastModifiedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
                },
                {
                    pcNumber: 'PC-000003',
                    company: 'TechStart Solutions',
                    reference: 'Emergency Relocation',
                    projectTitle: 'Emergency Office Move - Lease Termination',
                    projectDescription: 'Urgent relocation of startup office due to unexpected lease termination, 25 staff, minimal downtime required',
                    clientName: 'TechStart Solutions',
                    contactName: 'David Chen',
                    estimatedValue: 18500,
                    status: 'urgent',
                    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
                    
                    // User Audit Fields
                    createdBy: 'Kayleigh',
                    editedBy: 'Kayleigh',
                    lastModifiedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
                },
                {
                    pcNumber: 'PC-000004',
                    company: 'Industrial Manufacturing UK',
                    reference: 'Head Office Consolidation',
                    projectTitle: 'Manufacturing HQ Office Consolidation',
                    projectDescription: 'Consolidating three satellite offices into new Birmingham headquarters, heavy equipment and machinery documentation',
                    clientName: 'Industrial Manufacturing UK',
                    contactName: 'Robert Stevens',
                    estimatedValue: 67500,
                    status: 'active',
                    date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
                    
                    // User Audit Fields
                    createdBy: 'Terry',
                    editedBy: 'Terry',
                    lastModifiedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString()
                },
                {
                    pcNumber: 'PC-000005',
                    company: 'Creative Media Agency',
                    reference: 'Studio Relocation',
                    projectTitle: 'Creative Studio & Office Move',
                    projectDescription: 'Moving creative agency with production studios, expensive AV equipment, and client presentation suites from Shoreditch to King\'s Cross',
                    clientName: 'Creative Media Agency',
                    contactName: 'Sophie Martinez',
                    estimatedValue: 28750,
                    status: 'completed',
                    date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
                    
                    // User Audit Fields
                    createdBy: 'Phil',
                    editedBy: 'Phil',
                    lastModifiedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString()
                },
                {
                    pcNumber: 'PC-000006',
                    company: 'Global Consulting Partners',
                    reference: 'Multi-Floor Corporate Move',
                    projectTitle: 'Large Corporate Office Relocation',
                    projectDescription: 'Major consulting firm relocating 200+ staff across 4 floors, executive suites, multiple conference rooms, and data centre',
                    clientName: 'Global Consulting Partners',
                    contactName: 'Michael Thompson',
                    estimatedValue: 125000,
                    status: 'active',
                    date: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000), // 35 days ago
                    
                    // User Audit Fields
                    createdBy: 'Slav',
                    editedBy: 'Rob',
                    lastModifiedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
                },
                {
                    pcNumber: 'PC-000007',
                    company: 'Boutique Investments Ltd',
                    reference: 'Mayfair Office Setup',
                    projectTitle: 'Premium Investment Office Fitout',
                    projectDescription: 'High-end investment firm establishing prestigious Mayfair office, white-glove service required for antique furniture and artwork',
                    clientName: 'Boutique Investments Ltd',
                    contactName: 'Lady Catherine Worthington',
                    estimatedValue: 85000,
                    status: 'draft',
                    date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
                    
                    // User Audit Fields
                    createdBy: 'Kayleigh',
                    editedBy: 'Terry',
                    lastModifiedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
                },
                {
                    pcNumber: 'PC-000008',
                    company: 'NHS Trust Admin',
                    reference: 'Healthcare Admin Relocation',
                    projectTitle: 'NHS Administrative Office Move',
                    projectDescription: 'NHS Trust relocating administrative offices with strict security requirements for patient data and medical records',
                    clientName: 'NHS Trust Admin',
                    contactName: 'Dr. Sarah Williams',
                    estimatedValue: 22500,
                    status: 'active',
                    date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
                    
                    // User Audit Fields
                    createdBy: 'Phil',
                    editedBy: 'Kayleigh',
                    lastModifiedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
                }
            ];

            for (const pcData of samplePCNumbers) {
                const savedPc = await db.save('pcNumbers', { ...pcData, id: generateId(), createdAt: new Date() });
                logInfo('Saved PC Number:', savedPc.pcNumber);
            }

            // Sample Activities
            const sampleActivities = [
                {
                    title: 'Site Survey - Office Upgrade',
                    description: 'Comprehensive site survey to assess electrical requirements and plan installation work',
                    type: 'Survey',
                    startDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
                    duration: 120,
                    status: 'scheduled',
                    priority: 'high',
                    assigneeId: 'EMP001',
                    notes: 'Client provided detailed blueprints.',
                    
                    // User Audit Fields
                    createdBy: 'Terry',
                    editedBy: 'Terry',
                    lastModifiedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
                },
                {
                    title: 'LED Installation - Warehouse',
                    description: 'Standard LED lighting installation for warehouse spaces',
                    type: 'Installation',
                    startDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // In 3 days
                    duration: 240,
                    status: 'scheduled',
                    priority: 'medium',
                    assigneeId: 'EMP002',
                    notes: 'Requires scissor lift access.',
                    
                    // User Audit Fields
                    createdBy: 'Phil',
                    editedBy: 'Slav',
                    lastModifiedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
                },
                // PC-000001 - Fintech Move (Enhanced with new fields)
                {
                    title: 'Site Survey - Canary Wharf Office',
                    description: 'Comprehensive site assessment of new Canary Wharf headquarters, measuring rooms, elevator access, and IT infrastructure requirements',
                    type: 'Survey',
                    pcNumber: 'PC-000001',
                    scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // Day after tomorrow
                    scheduledTime: '09:00',
                    duration: 180,
                    status: 'pending',
                    priority: 'high',
                    assignedTo: 'Marcus Thompson',
                    location: '25 Canada Square, Canary Wharf, London E14 5LQ',
                    contactName: 'James Morrison',
                    contactPhone: '020 7946 0958',
                    
                    // New comprehensive fields
                    department: 'Survey Team',
                    paymentType: 'Standard Rate',
                    instructions: 'Contact building management for access. Security clearance required for financial services area.',
                    timeDepotStart: '08:00',
                    timeSiteStart: '09:00',
                    timeSiteFinish: '12:00',
                    timeDepotFinish: '13:00',
                    hours: 5.0,
                    activityNumber: 'ACT-2024-001',
                    movemanJob: 'MJ-001',
                    crmId: 'CRM-SF-12345',
                    
                    // Boolean flags
                    parkingRequired: true,
                    confirmed: false,
                    riskAssessmentNeeded: true,
                    
                    // JSONB structures
                    collectionAddress: {
                        address1: '15 Bishopsgate',
                        address2: '12th Floor',
                        city: 'London',
                        postcode: 'EC2V 6DB',
                        country: 'United Kingdom',
                        contact: 'James Morrison',
                        phone: '020 7946 0958'
                    },
                    deliveryAddress: {
                        address1: '25 Canada Square',
                        address2: '40th Floor',
                        city: 'London',
                        postcode: 'E14 5LQ',
                        country: 'United Kingdom',
                        contact: 'Sarah Chen',
                        phone: '020 7418 2000'
                    },
                    resources: [
                        { type: 'Vehicle', name: 'Survey Van', quantity: 1 },
                        { type: 'Equipment', name: 'Measuring Tools', quantity: 1 },
                        { type: 'Personnel', name: 'Senior Surveyor', quantity: 1 }
                    ],
                    notesList: [
                        { timestamp: new Date().toISOString(), author: 'Marcus Thompson', note: 'Initial survey scheduled' },
                        { timestamp: new Date().toISOString(), author: 'Sarah Chen', note: 'Building access arranged' }
                    ],
                    
                    // User Audit Fields
                    createdBy: 'Rob',
                    editedBy: 'Kayleigh',
                    lastModifiedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
                },
                {
                    title: 'IT Infrastructure Disconnection',
                    description: 'Safely disconnect and pack server equipment, workstations, and telecom systems at City office',
                    type: 'IT Services',
                    pcNumber: 'PC-000001',
                    scheduledDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
                    scheduledTime: '07:00',
                    duration: 360,
                    status: 'pending',
                    priority: 'high',
                    assignedTo: 'IT Specialist Team',
                    location: '14 Old Broad Street, City of London, EC2N 1DL',
                    
                    // User Audit Fields
                    createdBy: 'Terry',
                    editedBy: 'Terry',
                    lastModifiedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
                },
                
                // PC-000002 - Law Chambers
                {
                    title: 'Legal Archive Boxing',
                    description: 'Specialist packing of confidential legal documents, case files, and law library books with chain of custody documentation',
                    type: 'Packing',
                    pcNumber: 'PC-000002',
                    scheduledDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
                    scheduledTime: '08:30',
                    duration: 480,
                    status: 'pending',
                    priority: 'high',
                    assignedTo: 'Secure Packing Team',
                    location: 'Lincoln\'s Inn, London WC2A 3TL',
                    contactName: 'Patricia Whitfield QC',
                    contactPhone: '020 7405 1234'
                },
                
                // PC-000003 - Emergency Move
                {
                    title: 'Emergency Packing Service',
                    description: 'Rapid response packing of startup office, priority on IT equipment and essential documents',
                    type: 'Emergency',
                    pcNumber: 'PC-000003',
                    scheduledDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // Tomorrow
                    scheduledTime: '06:00',
                    duration: 240,
                    status: 'in_progress',
                    priority: 'urgent',
                    assignedTo: 'Emergency Response Team',
                    location: 'Tech Hub, 42 Shoreditch High Street, London E1 6JJ',
                    contactName: 'David Chen',
                    contactPhone: '07789 123456'
                },
                
                // PC-000005 - Creative Agency (Completed)
                {
                    title: 'AV Equipment Setup - Completed',
                    description: 'Successfully installed expensive audio-visual equipment and production studio setup at new King\'s Cross location',
                    type: 'Installation',
                    pcNumber: 'PC-000005',
                    scheduledDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
                    scheduledTime: '09:00',
                    duration: 420,
                    status: 'completed',
                    priority: 'high',
                    assignedTo: 'AV Specialists',
                    location: 'King\'s Cross Creative Quarter, London N1C 4QP',
                    contactName: 'Sophie Martinez',
                    contactPhone: '020 3987 6543',
                    completionNotes: 'All AV equipment successfully installed and tested. Client signed off on setup. Some minor cable management adjustments made post-installation.'
                },
                
                // PC-000006 - Large Corporate
                {
                    title: 'Executive Floor Planning',
                    description: 'Detailed planning for executive suite relocation including boardrooms, private offices, and secure areas',
                    type: 'Planning',
                    pcNumber: 'PC-000006',
                    scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                    scheduledTime: '14:00',
                    duration: 240,
                    status: 'pending',
                    priority: 'high',
                    assignedTo: 'Senior Project Manager',
                    location: '1 Canary Wharf, London E14 5AB',
                    contactName: 'Michael Thompson',
                    contactPhone: '020 7715 8888'
                },
                
                // PC-000008 - NHS Trust
                {
                    title: 'Secure Data Transport Planning',
                    description: 'Security compliance planning for NHS patient data and medical records transport with GDPR requirements',
                    type: 'Compliance',
                    pcNumber: 'PC-000008',
                    scheduledDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
                    scheduledTime: '13:30',
                    duration: 120,
                    status: 'pending',
                    priority: 'high',
                    assignedTo: 'Security Compliance Officer',
                    location: 'NHS Administrative Centre, London SE1 7EH',
                    contactName: 'Dr. Sarah Williams',
                    contactPhone: '020 3317 8000'
                }
            ];

            for (const activityData of sampleActivities) {
                const savedActivity = await db.save('activities', { ...activityData, id: generateId(), createdAt: new Date() });
                logInfo('Saved Activity:', savedActivity.title);
            }

            // Sample Resources - Office Relocation Equipment & Materials
            const sampleResources = [
                // Vehicles
                {
                    name: 'Mercedes Luton Van with Tail Lift',
                    type: 'Vehicle',
                    sku: 'VEH-001',
                    status: 'available',
                    costPerUnit: 220.00,
                    unit: 'day',
                    supplier: 'Commercial Vehicle Hire Ltd',
                    description: 'Long-wheelbase Luton van with hydraulic tail lift, perfect for office furniture and equipment.'
                },
                {
                    name: 'Articulated Lorry 18t',
                    type: 'Vehicle', 
                    sku: 'VEH-002',
                    status: 'available',
                    costPerUnit: 650.00,
                    unit: 'day',
                    supplier: 'Heavy Transport Solutions',
                    description: 'Large articulated lorry for major corporate relocations and long-distance moves.'
                },
                {
                    name: 'Ford Transit Van LWB',
                    type: 'Vehicle',
                    sku: 'VEH-003',
                    status: 'in-use',
                    costPerUnit: 180.00,
                    unit: 'day',
                    supplier: 'Transit Hire Network',
                    description: 'Standard long-wheelbase transit van for crew, tools and smaller office items.'
                },
                
                // Specialist Equipment
                {
                    name: 'Piano Moving Dolly & Straps',
                    type: 'Equipment',
                    sku: 'EQP-001',
                    status: 'available',
                    costPerUnit: 45.00,
                    unit: 'day',
                    supplier: 'Specialist Moving Equipment Ltd',
                    description: 'Heavy-duty dolly system for moving safes, servers, and heavy office equipment.'
                },
                {
                    name: 'Stair Climbing Hand Truck',
                    type: 'Equipment',
                    sku: 'EQP-002',
                    status: 'available',
                    costPerUnit: 35.00,
                    unit: 'day',
                    supplier: 'Mobility Solutions UK',
                    description: 'Electric stair-climbing trolley for heavy items in buildings without lift access.'
                },
                {
                    name: 'Furniture Protection Blankets (Set of 50)',
                    type: 'Materials',
                    sku: 'MAT-001',
                    status: 'available',
                    costPerUnit: 75.00,
                    unit: 'set',
                    supplier: 'Protection Supplies Direct',
                    description: 'Professional quilted moving blankets for furniture protection during transport.'
                },
                
                // IT & Electronics
                {
                    name: 'Anti-Static Bubble Wrap (Industrial)',
                    type: 'Materials',
                    sku: 'MAT-002',
                    status: 'available',
                    costPerUnit: 28.00,
                    unit: 'roll',
                    supplier: 'Electronic Packaging Solutions',
                    description: 'Anti-static bubble wrap roll (750mm x 100m) for IT equipment protection.'
                },
                {
                    name: 'Server Rack Moving Kit',
                    type: 'Equipment',
                    sku: 'EQP-003',
                    status: 'available',
                    costPerUnit: 95.00,
                    unit: 'day',
                    supplier: 'IT Infrastructure Movers',
                    description: 'Specialized equipment for safely moving server racks and data centre equipment.'
                },
                
                // Storage & Containers
                {
                    name: 'Archive Boxes (Heavy Duty)',
                    type: 'Materials',
                    sku: 'MAT-003',
                    status: 'available',
                    costPerUnit: 8.50,
                    unit: 'each',
                    supplier: 'Document Storage Solutions',
                    description: 'Heavy-duty archive boxes suitable for legal documents and confidential files.'
                },
                {
                    name: 'Climate-Controlled Storage Unit',
                    type: 'Storage',
                    sku: 'STO-001',
                    status: 'available',
                    costPerUnit: 25.00,
                    unit: 'week/m³',
                    supplier: 'Secure Storage London',
                    description: 'Temperature and humidity controlled storage for sensitive documents and artwork.'
                },
                
                // Specialized Services
                {
                    name: 'IT Technician (Certified)',
                    type: 'Labour',
                    sku: 'LAB-001',
                    status: 'available',
                    costPerUnit: 65.00,
                    unit: 'hour',
                    supplier: 'IT Support Specialists',
                    description: 'Certified IT technician for server disconnection, transport setup and configuration.'
                },
                {
                    name: 'Security Guard (CRB Checked)',
                    type: 'Labour',
                    sku: 'LAB-002',
                    status: 'available',
                    costPerUnit: 25.00,
                    unit: 'hour',
                    supplier: 'Professional Security Services',
                    description: 'CRB checked security personnel for sensitive document and equipment transport.'
                },
                
                // Tools & Accessories
                {
                    name: 'Floor Protection Sheets',
                    type: 'Materials',
                    sku: 'MAT-004',
                    status: 'available',
                    costPerUnit: 3.50,
                    unit: 'm²',
                    supplier: 'Site Protection Supplies',
                    description: 'Heavy-duty floor protection sheets for carpets and flooring during moves.'
                },
                {
                    name: 'Vacuum Lifting System',
                    type: 'Equipment',
                    sku: 'EQP-004',
                    status: 'maintenance',
                    costPerUnit: 125.00,
                    unit: 'day',
                    supplier: 'Advanced Lifting Solutions',
                    description: 'Vacuum lifting system for glass panels, mirrors and delicate artwork.'
                },
                {
                    name: 'Professional Packing Team (4 people)',
                    type: 'Labour',
                    sku: 'LAB-003',
                    status: 'available',
                    costPerUnit: 160.00,
                    unit: 'hour',
                    supplier: 'Expert Packing Services',
                    description: 'Experienced 4-person packing team for efficient office content preparation.'
                }
            ];

            for (const resourceData of sampleResources) {
                const savedResource = await db.save('resources', { ...resourceData, id: generateId(), createdAt: new Date() });
                logInfo('Saved Resource:', savedResource.name);
            }

            // Sample Quotes - Connected to Office Relocation PC Numbers
            const sampleQuotes = [
                {
                    quoteNumber: 'QT-2024-001',
                    pcNumber: 'PC-000001',
                    clientName: 'Fintech Innovations Ltd',
                    projectTitle: 'Complete Office Relocation - City to Canary Wharf',
                    value: 47500.00,
                    status: 'pending',
                    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                    description: 'Full office relocation for 85 staff including IT infrastructure, secure document handling, and executive furniture',
                    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
                    
                    // New comprehensive financial fields
                    name: 'Fintech Complete Relocation Package',
                    version: 1,
                    netTotal: 39583.33,
                    vatAmount: 7916.67,
                    vatRate: 20.0,
                    discount: 2500.00,
                    standardLiability: 100000.00,
                    declaredValue: 2500000.00,
                    priceListId: 'PL-2024-OFFICE',
                    
                    // JSONB structures for detailed quote breakdown
                    quoteItems: {
                        survey: [
                            { description: 'Site Survey - Current Office', quantity: 1, unitPrice: 750.00, total: 750.00 },
                            { description: 'Site Survey - New Office', quantity: 1, unitPrice: 750.00, total: 750.00 }
                        ],
                        packing: [
                            { description: 'Professional Packing - Workstations', quantity: 85, unitPrice: 45.00, total: 3825.00 },
                            { description: 'Executive Furniture Packing', quantity: 25, unitPrice: 125.00, total: 3125.00 },
                            { description: 'IT Equipment Packing', quantity: 150, unitPrice: 35.00, total: 5250.00 }
                        ],
                        transport: [
                            { description: 'Large Removal Vehicles', quantity: 3, unitPrice: 850.00, total: 2550.00 },
                            { description: 'Specialized IT Transport', quantity: 2, unitPrice: 650.00, total: 1300.00 }
                        ],
                        installation: [
                            { description: 'Workstation Setup', quantity: 85, unitPrice: 65.00, total: 5525.00 },
                            { description: 'Executive Office Setup', quantity: 12, unitPrice: 185.00, total: 2220.00 },
                            { description: 'IT Infrastructure Setup', quantity: 1, unitPrice: 8500.00, total: 8500.00 }
                        ]
                    },
                    otherCosts: [
                        { description: 'Insurance Premium', amount: 1250.00 },
                        { description: 'Security Clearance Fees', amount: 750.00 },
                        { description: 'Weekend Work Premium', amount: 2500.00 }
                    ],
                    recyclingCharges: {
                        cardboard: 125.00,
                        plastic: 75.00,
                        electronic: 250.00,
                        total: 450.00
                    },
                    rebates: {
                        volumeDiscount: 1500.00,
                        loyaltyDiscount: 500.00,
                        earlyPayment: 500.00,
                        total: 2500.00
                    },
                    
                    // User Audit Fields
                    createdBy: 'Slav',
                    editedBy: 'Rob',
                    lastModifiedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
                },
                {
                    quoteNumber: 'QT-2024-002',
                    pcNumber: 'PC-000002',
                    clientName: 'Chambers & Associates',
                    projectTitle: 'Barrister Chambers Relocation',
                    value: 34200.00,
                    status: 'approved',
                    validUntil: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
                    description: 'Prestigious law chambers with specialist library and archive handling, white-glove service for antique furniture',
                    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
                },
                {
                    quoteNumber: 'QT-2024-003',
                    pcNumber: 'PC-000003',
                    clientName: 'TechStart Solutions',
                    projectTitle: 'Emergency Office Move - Lease Termination',
                    value: 19750.00,
                    status: 'approved',
                    validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                    description: 'Urgent relocation with emergency premiums, 25 staff, minimal downtime weekend service',
                    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
                },
                {
                    quoteNumber: 'QT-2024-004',
                    pcNumber: 'PC-000004',
                    clientName: 'Industrial Manufacturing UK',
                    projectTitle: 'Manufacturing HQ Office Consolidation',
                    value: 72800.00,
                    status: 'pending',
                    validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
                    description: 'Consolidating three satellite offices with heavy machinery documentation and compliance records',
                    createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
                },
                {
                    quoteNumber: 'QT-2024-005',
                    pcNumber: 'PC-000005',
                    clientName: 'Creative Media Agency',
                    projectTitle: 'Creative Studio & Office Move',
                    value: 31250.00,
                    status: 'completed',
                    validUntil: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
                    description: 'Successfully completed: Creative agency with production studios and expensive AV equipment',
                    createdAt: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000)
                },
                {
                    quoteNumber: 'QT-2024-006',
                    pcNumber: 'PC-000006',
                    clientName: 'Global Consulting Partners',
                    projectTitle: 'Large Corporate Office Relocation',
                    value: 132500.00,
                    status: 'draft',
                    validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
                    description: 'Major consulting firm 200+ staff across 4 floors with executive suites and data centre',
                    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
                },
                {
                    quoteNumber: 'QT-2024-007',
                    pcNumber: 'PC-000007',
                    clientName: 'Boutique Investments Ltd',
                    projectTitle: 'Premium Investment Office Fitout',
                    value: 92700.00,
                    status: 'pending',
                    validUntil: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
                    description: 'High-end Mayfair office with white-glove service for antique furniture and artwork collection',
                    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
                },
                {
                    quoteNumber: 'QT-2024-008',
                    pcNumber: 'PC-000008',
                    clientName: 'NHS Trust Admin',
                    projectTitle: 'NHS Administrative Office Move',
                    value: 24800.00,
                    status: 'pending',
                    validUntil: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
                    description: 'NHS Trust with strict security requirements for patient data and medical records compliance',
                    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                },
                // Additional quotes for some projects (multiple quotes per project)
                {
                    quoteNumber: 'QT-2024-009',
                    pcNumber: 'PC-000001',
                    clientName: 'Fintech Innovations Ltd',
                    projectTitle: 'Canary Wharf Move - IT Only Package',
                    value: 15750.00,
                    status: 'declined',
                    validUntil: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
                    description: 'Alternative quote for IT infrastructure only (client chose full service)',
                    createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000)
                }
            ];

            for (const quoteData of sampleQuotes) {
                const savedQuote = await db.save('quotes', { ...quoteData, id: generateId() });
                logInfo('Saved Quote:', savedQuote.quoteNumber);
            }

            // Sample Price Lists for Office Relocations UK
            const samplePriceLists = [
                {
                    name: 'Office Relocation - Small (1-20 employees)',
                    description: 'Complete office relocation package for small businesses up to 20 employees',
                    category: 'Office Relocation',
                    region: 'London & M25',
                    currency: 'GBP',
                    validFrom: new Date(),
                    validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
                    status: 'active',
                    items: [
                        { description: 'Pre-move consultation & planning', unit: 'per consultation', price: 150.00, category: 'Consultation' },
                        { description: 'Professional packing service', unit: 'per hour/person', price: 35.00, category: 'Labour' },
                        { description: 'Office furniture disassembly', unit: 'per hour/person', price: 40.00, category: 'Labour' },
                        { description: 'IT equipment disconnection & packing', unit: 'per workstation', price: 75.00, category: 'IT Services' },
                        { description: 'Document archive boxing', unit: 'per archive box', price: 8.50, category: 'Materials' },
                        { description: 'Standard moving van (3.5t)', unit: 'per day', price: 180.00, category: 'Vehicle' },
                        { description: 'Moving crew (2 people)', unit: 'per hour', price: 80.00, category: 'Labour' },
                        { description: 'Office furniture reassembly', unit: 'per hour/person', price: 45.00, category: 'Labour' },
                        { description: 'IT equipment reconnection & setup', unit: 'per workstation', price: 85.00, category: 'IT Services' }
                    ],
                    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
                    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
                },
                {
                    name: 'Office Relocation - Medium (21-100 employees)',
                    description: 'Comprehensive office relocation for medium-sized businesses with specialist equipment handling',
                    category: 'Office Relocation',
                    region: 'UK National',
                    currency: 'GBP',
                    validFrom: new Date(),
                    validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                    status: 'active',
                    items: [
                        { description: 'Detailed site survey & project planning', unit: 'per project', price: 450.00, category: 'Consultation' },
                        { description: 'Professional packing team', unit: 'per hour/person', price: 38.00, category: 'Labour' },
                        { description: 'Specialist furniture handling', unit: 'per hour/person', price: 50.00, category: 'Labour' },
                        { description: 'Server room relocation', unit: 'per server rack', price: 350.00, category: 'IT Services' },
                        { description: 'Heavy duty moving boxes', unit: 'per box', price: 12.00, category: 'Materials' },
                        { description: 'Luton van with tail lift', unit: 'per day', price: 220.00, category: 'Vehicle' },
                        { description: '7.5t truck with hydraulic lift', unit: 'per day', price: 380.00, category: 'Vehicle' },
                        { description: 'Moving crew (4 people)', unit: 'per hour', price: 160.00, category: 'Labour' },
                        { description: 'Specialist IT technician', unit: 'per hour', price: 65.00, category: 'IT Services' },
                        { description: 'Weekend/evening premium', unit: 'percentage', price: 25.00, category: 'Premium' }
                    ],
                    createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
                    updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
                },
                {
                    name: 'Office Relocation - Large Enterprise (100+ employees)',
                    description: 'Full-scale enterprise office relocation with project management and phased moves',
                    category: 'Office Relocation',
                    region: 'UK & Europe',
                    currency: 'GBP',
                    validFrom: new Date(),
                    validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                    status: 'active',
                    items: [
                        { description: 'Dedicated project manager', unit: 'per week', price: 1200.00, category: 'Management' },
                        { description: 'Comprehensive site survey', unit: 'per site', price: 850.00, category: 'Consultation' },
                        { description: 'Executive furniture white-glove service', unit: 'per hour/person', price: 65.00, category: 'Labour' },
                        { description: 'Data centre migration', unit: 'per rack unit', price: 450.00, category: 'IT Services' },
                        { description: 'Climate-controlled storage', unit: 'per week/m³', price: 25.00, category: 'Storage' },
                        { description: 'Articulated lorry (18t+)', unit: 'per day', price: 650.00, category: 'Vehicle' },
                        { description: 'Specialist moving crew (6 people)', unit: 'per hour', price: 280.00, category: 'Labour' },
                        { description: 'Out-of-hours security escort', unit: 'per hour', price: 95.00, category: 'Security' },
                        { description: 'International shipping', unit: 'per m³', price: 180.00, category: 'Shipping' },
                        { description: 'Insurance (comprehensive cover)', unit: 'percentage of value', price: 0.5, category: 'Insurance' }
                    ],
                    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
                    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
                },
                {
                    name: 'Specialist Equipment & Materials',
                    description: 'Additional equipment and materials for complex office relocations',
                    category: 'Equipment & Materials',
                    region: 'UK National',
                    currency: 'GBP',
                    validFrom: new Date(),
                    validUntil: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 6 months
                    status: 'active',
                    items: [
                        { description: 'Piano/safe moving equipment', unit: 'per day', price: 150.00, category: 'Equipment' },
                        { description: 'Stair climbing trolley', unit: 'per day', price: 45.00, category: 'Equipment' },
                        { description: 'Furniture protection covers', unit: 'per item', price: 15.00, category: 'Materials' },
                        { description: 'Bubble wrap (industrial)', unit: 'per roll (750mm x 100m)', price: 28.00, category: 'Materials' },
                        { description: 'Wooden crates (custom)', unit: 'per m³', price: 120.00, category: 'Materials' },
                        { description: 'Floor protection sheets', unit: 'per m²', price: 3.50, category: 'Materials' },
                        { description: 'Hydraulic platform trolley', unit: 'per day', price: 65.00, category: 'Equipment' },
                        { description: 'Vacuum lifting equipment', unit: 'per day', price: 95.00, category: 'Equipment' }
                    ],
                    createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
                    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
                },
                {
                    name: 'Emergency & Rush Services',
                    description: 'Premium emergency relocation services with same-day response',
                    category: 'Emergency Services', 
                    region: 'London & Home Counties',
                    currency: 'GBP',
                    validFrom: new Date(),
                    validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 3 months
                    status: 'active',
                    items: [
                        { description: 'Emergency call-out (same day)', unit: 'per call-out', price: 250.00, category: 'Emergency' },
                        { description: 'Weekend emergency service', unit: 'percentage premium', price: 50.00, category: 'Premium' },
                        { description: 'Bank holiday service', unit: 'percentage premium', price: 100.00, category: 'Premium' },
                        { description: 'Express packing service', unit: 'per hour/person', price: 55.00, category: 'Labour' },
                        { description: '24-hour security storage', unit: 'per day/m³', price: 15.00, category: 'Storage' },
                        { description: 'Emergency vehicle hire', unit: 'per hour', price: 85.00, category: 'Vehicle' },
                        { description: 'Temporary office setup', unit: 'per workstation', price: 125.00, category: 'Setup' }
                    ],
                    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
                    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
                }
            ];

            for (const priceListData of samplePriceLists) {
                const savedPriceList = await db.save('priceLists', { ...priceListData, id: generateId() });
                logInfo('Saved Price List:', savedPriceList.name);
            }

            logInfo('Sample data loaded successfully');
        } catch (error) {
            logError('Failed to load sample data:', error);
        }
    }

    /**
     * @description Format activity type for display
     * @param {string} type - Activity type
     * @returns {string} Formatted type
     */
    formatActivityType(type) {
        return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    /**
     * @description Format status for display
     * @param {string} status - Status value
     * @returns {string} Formatted status
     */
    formatStatus(status) {
        return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    /**
     * @description Format priority for display
     * @param {string} priority - Priority value
     * @returns {string} Formatted priority
     */
    formatPriority(priority) {
        return priority.charAt(0).toUpperCase() + priority.slice(1);
    }

    /**
     * @description Parse quote items from summary display
     * @returns {object} Quote items structure
     */
    parseQuoteItemsFromSummary() {
        try {
            // This is a placeholder - in a real implementation, this would parse
            // the quote items from the quote builder or a stored structure
            return { 
                items: [], 
                categories: [],
                totalItems: 0,
                lastUpdated: new Date().toISOString()
            };
        } catch (error) {
            logError('Failed to parse quote items:', error);
            return { items: [], categories: [] };
        }
    }

    /**
     * @description Parse JSON field with fallback
     * @param {string} jsonString - JSON string to parse
     * @param {any} fallback - Fallback value if parsing fails
     * @returns {any} Parsed JSON or fallback
     */
    parseJsonField(jsonString, fallback = null) {
        try {
            if (!jsonString || jsonString.trim() === '') {
                return fallback;
            }
            return JSON.parse(jsonString);
        } catch (error) {
            logError('Failed to parse JSON field:', error);
            return fallback;
        }
    }

    /**
     * @description Auto-fill Activity form from related Quote data (and its PC Number)
     * @param {string} quoteId - Quote ID to pull data from
     */
    async autoFillActivityFromQuote(quoteId) {
        try {
            if (!quoteId) return;
            
            // First get quote data
            const quoteData = await db.load('quotes', quoteId);
            if (!quoteData) return;
            
            // Then get related PC Number data
            let pcData = null;
            if (quoteData.pcId || quoteData.pcNumber) {
                // Try to find PC by ID first, then by PC Number
                if (quoteData.pcId) {
                    pcData = await db.load('pcNumbers', quoteData.pcId);
                } else if (quoteData.pcNumber) {
                    const allPCs = await db.loadAll('pcNumbers');
                    pcData = allPCs.find(pc => pc.pcNumber === quoteData.pcNumber);
                }
            }
            
            if (!pcData) {
                uiModals.showToast('No PC Number data found for this quote', 'warning');
                return;
            }
            
            // Auto-fill contact information
            if (pcData.contactName) {
                document.getElementById('activity-contact-name').value = pcData.contactName;
            }
            if (pcData.phone) {
                document.getElementById('activity-contact-phone').value = pcData.phone;
            }
            
            // Auto-fill collection address from PC delivery address
            if (pcData.deliveryAddress1) {
                document.getElementById('activity-collection-address-1').value = pcData.deliveryAddress1 || '';
                document.getElementById('activity-collection-address-2').value = pcData.deliveryAddress2 || '';
                document.getElementById('activity-collection-city').value = pcData.deliveryCity || '';
                document.getElementById('activity-collection-postcode').value = pcData.deliveryPostcode || '';
                document.getElementById('activity-collection-country').value = pcData.deliveryCountry || 'United Kingdom';
                document.getElementById('activity-collection-contact').value = pcData.deliveryFirstName && pcData.deliverySurname 
                    ? `${pcData.deliveryFirstName} ${pcData.deliverySurname}` 
                    : pcData.contactName || '';
                document.getElementById('activity-collection-phone').value = pcData.deliveryPhone || pcData.phone || '';
            }
            
            // Smart defaults for activity type based on PC project type
            const activityTypeField = document.getElementById('activity-type');
            if (pcData.propertyType && !activityTypeField.value) {
                if (pcData.propertyType.toLowerCase().includes('office')) {
                    activityTypeField.value = 'Office Survey';
                } else if (pcData.propertyType.toLowerCase().includes('warehouse')) {
                    activityTypeField.value = 'Warehouse Survey';
                } else if (pcData.propertyType.toLowerCase().includes('retail')) {
                    activityTypeField.value = 'Retail Survey';
                } else {
                    activityTypeField.value = 'Property Survey';
                }
            }
            
            // Auto-fill department based on PC client category
            const departmentField = document.getElementById('activity-department');
            if (pcData.clientCategory && !departmentField.value) {
                if (pcData.clientCategory.toLowerCase().includes('corporate')) {
                    departmentField.value = 'Operations';
                } else if (pcData.clientCategory.toLowerCase().includes('government')) {
                    departmentField.value = 'Administration';
                } else {
                    departmentField.value = 'Survey Team';
                }
            }
            
            uiModals.showToast('Activity form auto-filled from Quote and PC Number data', 'success');
            
        } catch (error) {
            logError('Failed to auto-fill activity from Quote:', error);
        }
    }

    /**
     * @description Auto-fill Quote form from related PC Number data
     * @param {string} pcId - PC Number ID to pull data from
     */
    async autoFillQuoteFromPC(pcId) {
        try {
            if (!pcId) return;
            
            const pcData = await db.load('pcNumbers', pcId);
            if (!pcData) return;
            
            // Auto-fill basic information
            document.getElementById('quote-edit-client-name').value = pcData.company || '';
            document.getElementById('quote-edit-project-title').value = pcData.title || '';
            
            // Smart defaults for standard liability based on declared value or project value
            const standardLiabilityField = document.getElementById('quote-edit-standard-liability');
            if (pcData.value && !standardLiabilityField.value) {
                const projectValue = parseFloat(pcData.value);
                if (projectValue > 500000) {
                    standardLiabilityField.value = '250000.00';
                } else if (projectValue > 100000) {
                    standardLiabilityField.value = '150000.00';
                } else {
                    standardLiabilityField.value = '100000.00';
                }
            }
            
            // Auto-suggest VAT rate based on client category
            const vatRateField = document.getElementById('quote-edit-vat-rate');
            if (pcData.clientCategory && !vatRateField.value) {
                if (pcData.clientCategory.toLowerCase().includes('charity') || 
                    pcData.clientCategory.toLowerCase().includes('education')) {
                    vatRateField.value = '0.00'; // VAT exempt
                } else {
                    vatRateField.value = '20.00'; // Standard UK VAT
                }
            }
            
            uiModals.showToast('Quote form auto-filled from PC Number data', 'success');
            
        } catch (error) {
            logError('Failed to auto-fill quote from PC:', error);
        }
    }



    /**
     * @description Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => {
            // Escape to close modals
            if (event.key === 'Escape') {
                uiModals.closeAllModals();
            }
        });
    }

    /**
     * @description Handle before unload
     * @param {Event} event - Before unload event
     */
    handleBeforeUnload(event) {
        // Add any cleanup logic here
        logDebug('Application unloading...');
    }

    /**
     * @description Handle window resize
     */
    handleWindowResize() {
        // Add responsive layout adjustments here
        logDebug('Window resized');
    }

    /**
     * @description Initialize page-specific components
     */
    initializePageComponents() {
        // Calendar components
        this.initializeCalendar();
        
        // Chart components
        this.initializeCharts();
    }

    /**
     * @description Initialize calendar component
     */
    initializeCalendar() {
        // Calendar initialization logic
        logDebug('Calendar initialized');
    }

    /**
     * @description Initialize chart components
     */
    initializeCharts() {
        // Chart initialization logic
        logDebug('Charts initialized');
    }

    // Data loading methods for specific pages
    async loadResourcesData() { 
        try {
            logDebug('Loading resources data...');
            const allResources = await resources.getAllResources();
            this.renderResourcesList(allResources);
        } catch (error) {
            logError('Failed to load resources data:', error);
        }
    }
    
    /**
     * @description Load PC Numbers into a select dropdown
     * @param {string} selectId - ID of the select element
     * @param {string} selectedId - ID of PC Number to pre-select
     */
    async loadPcNumbersForSelect(selectId, selectedId = null) {
        try {
            const select = document.getElementById(selectId);
            if (!select) return;
            
            const allPcNumbers = await db.loadAll('pcNumbers');
            
            // Clear existing options
            select.innerHTML = '<option value="">Select PC Number...</option>';
            
            // Add PC Numbers as options
            allPcNumbers.forEach(pc => {
                const option = document.createElement('option');
                option.value = pc.id;
                option.textContent = `${pc.pcNumber} - ${pc.company || pc.clientName || 'Unknown Company'}`;
                if (selectedId && pc.id === selectedId) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
            
            logDebug('PC Numbers loaded for select:', selectId);
        } catch (error) {
            logError('Failed to load PC Numbers for select:', error);
        }
    }
    
    async loadPcNumbersData() { 
        try {
            logDebug('Loading PC numbers data...');
            const allPcNumbers = await db.loadAll('pcNumbers');
            this.originalPcNumbers = allPcNumbers; // Store for filtering
            this.renderPcNumbersList(allPcNumbers);
        } catch (error) {
            logError('Failed to load PC numbers data:', error);
        }
    }
    
    async loadQuotesData() { 
        try {
            logDebug('Loading quotes data...');
            const allQuotes = await db.loadAll('quotes');
            this.originalQuotes = allQuotes; // Store for filtering
            this.renderQuotesList(allQuotes);
        } catch (error) {
            logError('Failed to load quotes data:', error);
        }
    }
    /**
     * @description Load Quote Builder data
     */
    async loadQuoteBuilderData() {
        try {
            logDebug('Loading Quote Builder data...');
            await this.populateQuotePriceListDropdown();
        } catch (error) {
            logError('Failed to load Quote Builder data:', error);
        }
    }

    /**
     * @description Populate price list dropdown in Quote Builder
     */
    async populateQuotePriceListDropdown() {
        try {
            const priceListSelect = document.getElementById('quote-price-list');
            if (!priceListSelect) return;

            const allPriceLists = await db.loadAll('priceLists');
            
            // Clear existing options
            priceListSelect.innerHTML = '<option value="">Select Price List...</option>';

            if (allPriceLists.length === 0) {
                priceListSelect.innerHTML = '<option value="">No Price Lists available</option>';
                logDebug('No price lists found in database');
                return;
            }

            // Add price lists sorted by name
            allPriceLists
                .filter(priceList => priceList.status === 'active' || !priceList.status) // Only show active price lists
                .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                .forEach(priceList => {
                    const option = document.createElement('option');
                    option.value = priceList.id;
                    option.textContent = `${priceList.name} (${priceList.currency || 'GBP'}) - ${priceList.region || 'General'}`;
                    priceListSelect.appendChild(option);
                });

            logDebug(`Populated Quote Builder with ${allPriceLists.length} price lists`);

        } catch (error) {
            logError('Failed to populate quote price list dropdown:', error);
        }
    }
    
    async loadPriceListsData() { 
        try {
            logDebug('Loading price lists data...');
            const allPriceLists = await db.loadAll('priceLists');
            this.renderPriceListsList(allPriceLists);
        } catch (error) {
            logError('Failed to load price lists data:', error);
        }
    }
    

    
    /**
     * @description Render resources list
     * @param {Array} resourcesList - Array of resources
     */
    renderResourcesList(resourcesList) {
        try {
            const container = document.getElementById('resources-list');
            if (!container) return;

            if (resourcesList.length === 0) {
                container.innerHTML = '<p>No resources found.</p>';
                return;
            }

            const rowsHTML = resourcesList.map(resource => `
                <tr>
                    <td>${sanitizeHTML(resource.name)}</td>
                    <td><span class="resource-type ${resource.type.toLowerCase()}">${sanitizeHTML(resource.type)}</span></td>
                    <td>${resource.sku ? sanitizeHTML(resource.sku) : '-'}</td>
                    <td><span class="resource-status ${resource.status.toLowerCase()}">${sanitizeHTML(resource.status)}</span></td>
                    <td>${resource.costPerHour ? formatCurrency(resource.costPerHour) + '/hr' : '-'}</td>
                    <td>
                        <button class="button secondary" onclick="window.editResource('${resource.id}')">Edit</button>
                        <button class="button danger" onclick="window.deleteResource('${resource.id}')">Delete</button>
                    </td>
                </tr>
            `).join('');

            container.innerHTML = rowsHTML;
        } catch (error) {
            logError('Failed to render resources list:', error);
        }
    }

    /**
     * @description Render PC numbers list
     * @param {Array} pcNumbersList - Array of PC numbers
     */
    renderPcNumbersList(pcNumbersList) {
        try {
            const container = document.getElementById('pc-list');
            if (!container) return;

            if (pcNumbersList.length === 0) {
                container.innerHTML = '<p>No PC numbers found.</p>';
                return;
            }

            const rowsHTML = pcNumbersList.map(pc => `
                <tr class="clickable-row" onclick="window.viewPcDetail('${pc.id}')" style="cursor: pointer;">
                    <td><strong>${sanitizeHTML(pc.pcNumber)}</strong></td>
                    <td>${sanitizeHTML(pc.company || pc.clientName || 'N/A')}</td>
                    <td>${sanitizeHTML(pc.reference || 'N/A')}</td>
                    <td>${sanitizeHTML(pc.contactName || 'N/A')}</td>
                    <td onclick="event.stopPropagation()">
                        <button class="button secondary" onclick="window.editPC('${pc.id}')">Edit</button>
                        <button class="button primary" onclick="window.createQuote('${pc.id}')">Quote</button>
                    </td>
                </tr>
            `).join('');

            container.innerHTML = rowsHTML;
        } catch (error) {
            logError('Failed to render PC numbers list:', error);
        }
    }

    /**
     * @description Render quotes list
     * @param {Array} quotesList - Array of quotes
     */
    renderQuotesList(quotesList) {
        try {
            const container = document.getElementById('quotes-list');
            if (!container) return;

            if (quotesList.length === 0) {
                container.innerHTML = '<p>No quotes found. <button onclick="window.showNewQuoteModal()" class="button primary">Create First Quote</button></p>';
                return;
            }

            const rowsHTML = quotesList.map(quote => `
                <tr class="clickable-row" onclick="window.viewQuoteDetail('${quote.id}')" style="cursor: pointer;">
                    <td><strong>${sanitizeHTML(quote.quoteNumber || quote.id)}</strong></td>
                    <td>${sanitizeHTML(quote.pcNumber || 'N/A')}</td>
                    <td>${sanitizeHTML(quote.clientName || 'N/A')}</td>
                    <td>${formatCurrency(quote.value || quote.total || 0)}</td>
                    <td><span class="quote-status ${quote.status}">${sanitizeHTML(quote.status || 'draft')}</span></td>
                    <td onclick="event.stopPropagation()">
                        <button class="button secondary" onclick="window.editQuote('${quote.id}')">Edit</button>
                        <button class="button primary" onclick="window.viewQuoteDetail('${quote.id}')">View</button>
                    </td>
                </tr>
            `).join('');

            container.innerHTML = rowsHTML;
        } catch (error) {
            logError('Failed to render quotes list:', error);
        }
    }

    /**
     * @description Render price lists
     * @param {Array} priceListsList - Array of price lists
     */
    renderPriceListsList(priceListsList) {
        try {
            const container = document.getElementById('pricelist-table');
            if (!container) return;

            if (priceListsList.length === 0) {
                container.innerHTML = '<p>No price lists found. <button onclick="window.createPriceList()" class="button primary">Create First Price List</button></p>';
                return;
            }

            const rowsHTML = priceListsList.map(priceList => `
                <tr class="clickable-row" onclick="window.viewPriceList('${priceList.id}')" style="cursor: pointer;">
                    <td>${sanitizeHTML(priceList.name)}</td>
                    <td>${sanitizeHTML(priceList.version || '1.0')}</td>
                    <td>${sanitizeHTML(priceList.currency || 'GBP')}</td>
                    <td>${formatDate(priceList.date || priceList.createdAt)}</td>
                    <td>${priceList.isDefault ? 'Yes' : 'No'}</td>
                    <td><span class="pricelist-status ${priceList.status || 'active'}">${sanitizeHTML(priceList.status || 'active')}</span></td>
                    <td onclick="event.stopPropagation()">
                        <button class="button secondary" onclick="window.editPriceList('${priceList.id}')">Edit</button>
                        <button class="button primary" onclick="window.viewPriceList('${priceList.id}')">View Items</button>
                    </td>
                </tr>
            `).join('');

            container.innerHTML = rowsHTML;
        } catch (error) {
            logError('Failed to render price lists:', error);
        }
    }

    renderActivitiesCalendar(activitiesList) { logDebug('Rendering activities calendar...'); }
    showValidationErrors(form, errors) { 
        logDebug('Showing validation errors:', errors);
        uiModals.showToast(`Validation failed: ${errors.join(', ')}`, 'error');
    }
    
    async handleResourceSubmit(event) { 
        event.preventDefault();
        
        try {
            // Check if we're editing (resource-id has value) or creating new
            const resourceId = document.getElementById('resource-id').value;
            const isEdit = Boolean(resourceId);
            
            // Collect data from form fields directly
            const resourceData = {
                name: document.getElementById('resource-name').value,
                sku: document.getElementById('resource-sku').value,
                category: document.getElementById('resource-category').value,
                subcategory: document.getElementById('resource-subcategory').value,
                description: document.getElementById('resource-description').value,
                cost: parseFloat(document.getElementById('resource-cost').value) || 0,
                unit: document.getElementById('resource-unit').value,
                minQuantity: parseInt(document.getElementById('resource-min-quantity').value) || 1,
                leadTime: parseInt(document.getElementById('resource-lead-time').value) || 0,
                supplier: document.getElementById('resource-supplier').value,
                supplierCode: document.getElementById('resource-supplier-code').value,
                warranty: parseInt(document.getElementById('resource-warranty').value) || 0,
                status: document.getElementById('resource-status').value === 'true' ? 'available' : 'inactive',
                weight: parseFloat(document.getElementById('resource-weight').value) || 0,
                dimensions: document.getElementById('resource-dimensions').value
            };

            let id;
            if (isEdit) {
                // Update existing resource
                resourceData.id = resourceId;
                resourceData.updatedAt = new Date();
                await db.save('resources', resourceData);
                id = resourceId;
                
                uiModals.showToast('Resource updated successfully', 'success');
            } else {
                // Create new resource - map to Resources class format
                const newResourceData = {
                    name: resourceData.name,
                    description: resourceData.description,
                    type: resourceData.category, // map category to type
                    sku: resourceData.sku,
                    costPerUnit: resourceData.cost,
                    unit: resourceData.unit,
                    supplier: resourceData.supplier,
                    status: resourceData.status,
                    quantity: resourceData.minQuantity,
                    availableQuantity: resourceData.minQuantity
                };
                
                id = await resources.createResource(newResourceData);
                uiModals.showToast('Resource created successfully', 'success');
            }
            
            // Reset modal title back to "New Resource" for next use
            document.getElementById('resource-modal-title').textContent = 'New Resource';
            
            uiModals.closeModal('resource-modal');
            
            // Refresh page data
            if (this.currentPage === 'resources') {
                await this.loadResourcesData();
            }
            
            // Also refresh dashboard if that's current page
            if (this.currentPage === 'dashboard') {
                await this.loadDashboardData();
            }

        } catch (error) {
            logError('Failed to save resource:', error);
            uiModals.showToast('Failed to save resource', 'error');
        }
    }
    
    async handleQuoteSubmit(event) { 
        event.preventDefault();
        logDebug('Quote form submitted'); 
    }
    
    /**
     * @description Handle price list form submission (edit only)
     * @param {Event} event - Form submit event
     */
    async handlePriceListSubmit(event) {
        event.preventDefault();
        
        try {
            const priceListId = document.getElementById('pricelist-id').value;
            if (!priceListId) {
                uiModals.showToast('No price list ID found', 'error');
                return;
            }
            
            // Get existing data first
            const existingData = await db.load('priceLists', priceListId);
            if (!existingData) {
                uiModals.showToast('Price list not found', 'error');
                return;
            }
            
            // Collect updated data from form fields
            const updatedData = {
                ...existingData, // Keep existing data including items
                id: priceListId,
                name: document.getElementById('pricelist-name').value,
                category: document.getElementById('pricelist-category').value,
                region: document.getElementById('pricelist-region').value,
                currency: document.getElementById('pricelist-currency').value,
                description: document.getElementById('pricelist-description').value,
                status: document.getElementById('pricelist-status').value,
                updatedAt: new Date()
            };
            
            // Handle date fields
            const validFromInput = document.getElementById('pricelist-valid-from').value;
            const validUntilInput = document.getElementById('pricelist-valid-until').value;
            
            if (validFromInput) {
                updatedData.validFrom = new Date(validFromInput);
            }
            if (validUntilInput) {
                updatedData.validUntil = new Date(validUntilInput);
            }
            
            // Save to database
            await db.save('priceLists', updatedData);
            
            uiModals.showToast('Price list updated successfully', 'success');
            uiModals.closeModal('pricelist-modal');
            
            // Refresh page data
            if (this.currentPage === 'pricelists') {
                await this.loadPriceListsData();
            }
            
            // Also refresh dashboard if that's current page
            if (this.currentPage === 'dashboard') {
                await this.loadDashboardData();
            }

        } catch (error) {
            logError('Failed to update price list:', error);
            uiModals.showToast('Failed to update price list', 'error');
        }
    }

    /**
     * @description Handle price list item form submission
     * @param {Event} event - Form submit event
     */
    async handlePriceListItemSubmit(event) {
        event.preventDefault();
        
        try {
            const priceListId = document.getElementById('pricelist-item-pricelist-id').value;
            const itemIndex = parseInt(document.getElementById('pricelist-item-index').value);
            
            if (!priceListId) {
                uiModals.showToast('Price List ID not found', 'error');
                return;
            }
            
            // Get existing price list data
            const priceListData = await db.load('priceLists', priceListId);
            if (!priceListData) {
                uiModals.showToast('Price List not found', 'error');
                return;
            }
            
            // Collect updated item data from form fields
            const updatedItemData = {
                description: document.getElementById('pricelist-item-description').value,
                category: document.getElementById('pricelist-item-category').value,
                unit: document.getElementById('pricelist-item-unit').value,
                price: parseFloat(document.getElementById('pricelist-item-price').value) || 0,
                margin: parseFloat(document.getElementById('pricelist-item-margin').value) || 20,
                notes: document.getElementById('pricelist-item-notes').value,
                updatedAt: new Date()
            };
            
            // Calculate client price
            updatedItemData.clientPrice = updatedItemData.price * (1 + updatedItemData.margin / 100);
            
            // Basic validation
            if (!updatedItemData.description || updatedItemData.price <= 0) {
                uiModals.showToast('Please provide description and valid price', 'error');
                return;
            }
            
            // Initialize items array if not exists
            if (!priceListData.items) {
                priceListData.items = [];
            }
            
            // Update or add item
            if (itemIndex >= 0 && itemIndex < priceListData.items.length) {
                // Update existing item
                priceListData.items[itemIndex] = updatedItemData;
                uiModals.showToast('Price List Item updated successfully', 'success');
            } else {
                // Add new item
                priceListData.items.push(updatedItemData);
                uiModals.showToast('Price List Item added successfully', 'success');
            }
            
            // Update price list in database
            priceListData.updatedAt = new Date();
            await db.save('priceLists', priceListData);
            
            uiModals.closeModal('pricelist-item-modal');
            
            // Refresh price list detail page if that's current page
            if (this.currentPage === 'pricelist-detail') {
                await this.loadPriceListItems(priceListData);
            }
            
            // Also refresh price lists page if that's current page
            if (this.currentPage === 'pricelists') {
                await this.loadPriceListsData();
            }

        } catch (error) {
            logError('Failed to save price list item:', error);
            uiModals.showToast('Failed to save price list item', 'error');
        }
    }

    /**
     * @description Handle quote edit form submission
     * @param {Event} event - Form submit event
     */
    async handleQuoteEditSubmit(event) {
        event.preventDefault();
        
        try {
            const quoteId = document.getElementById('quote-edit-id').value;
            if (!quoteId) {
                uiModals.showToast('Quote ID not found', 'error');
                return;
            }
            
            // Collect updated data from form fields
            const updatedData = {
                id: quoteId,
                quoteNumber: document.getElementById('quote-edit-number').value,
                pcNumber: document.getElementById('quote-edit-pc-number').value,
                clientName: document.getElementById('quote-edit-client-name').value,
                projectTitle: document.getElementById('quote-edit-project-title').value,
                value: parseFloat(document.getElementById('quote-edit-value').value) || 0,
                status: document.getElementById('quote-edit-status').value,
                description: document.getElementById('quote-edit-description').value,
                
                // Financial Details
                version: parseInt(document.getElementById('quote-edit-version').value) || 1,
                netTotal: parseFloat(document.getElementById('quote-edit-net-total').value) || 0,
                vatRate: parseFloat(document.getElementById('quote-edit-vat-rate').value) || 20,
                vatAmount: parseFloat(document.getElementById('quote-edit-vat-amount').value) || 0,
                discount: parseFloat(document.getElementById('quote-edit-discount').value) || 0,
                totalCost: parseFloat(document.getElementById('quote-edit-total-cost').value) || 0,
                
                // Professional Details
                standardLiability: parseFloat(document.getElementById('quote-edit-standard-liability').value) || 100000,
                declaredValue: parseFloat(document.getElementById('quote-edit-declared-value').value) || 0,
                priceListId: document.getElementById('quote-edit-price-list-id').value,
                
                // JSONB structures for pricing breakdown
                quoteItems: this.parseQuoteItemsFromSummary() || { items: [], categories: [] },
                otherCosts: this.parseJsonField(document.getElementById('quote-edit-other-costs').value, []),
                recyclingCharges: {
                    recyclingFee: parseFloat(document.getElementById('quote-edit-recycling-fee').value) || 0,
                    environmentalFee: parseFloat(document.getElementById('quote-edit-environmental-fee').value) || 0
                },
                rebates: {
                    volumeRebate: parseFloat(document.getElementById('quote-edit-volume-rebate').value) || 0,
                    loyaltyRebate: parseFloat(document.getElementById('quote-edit-loyalty-rebate').value) || 0
                },
                
                updatedAt: new Date()
            };

            // Handle valid until date
            const validUntilInput = document.getElementById('quote-edit-valid-until').value;
            if (validUntilInput) {
                updatedData.validUntil = new Date(validUntilInput).toISOString();
            }
            
            // Basic validation
            if (!updatedData.quoteNumber || !updatedData.pcNumber || !updatedData.clientName || !updatedData.projectTitle) {
                uiModals.showToast('Please fill in all required fields', 'error');
                return;
            }
            
            // Save to database
            await db.save('quotes', updatedData);
            
            uiModals.showToast('Quote updated successfully', 'success');
            uiModals.closeModal('quote-edit-modal');
            
            // Refresh page data
            if (this.currentPage === 'quotes') {
                await this.loadQuotesData();
            } else if (this.currentPage === 'quote-detail') {
                // Refresh the detail page with updated data
                await this.showQuoteDetail(quoteId);
            }
            
            // Also refresh dashboard if that's current page
            if (this.currentPage === 'dashboard') {
                await this.loadDashboardData();
            }

        } catch (error) {
            logError('Failed to update quote:', error);
            uiModals.showToast('Failed to update quote', 'error');
        }
    }

    /**
     * @description Show activity detail page
     * @param {string} activityId - Activity ID
     */
    async showActivityDetail(activityId) {
        try {
            const activityData = await db.load('activities', activityId);
            if (!activityData) {
                uiModals.showToast('Activity not found', 'error');
                return;
            }

            // Store current activity globally for button actions
            window.currentActivity = activityData;

            // Populate detail fields
            document.getElementById('activity-detail-title').textContent = `Activity: ${activityData.title}`;
            document.getElementById('activity-detail-title-text').textContent = activityData.title || '';
            document.getElementById('activity-detail-type').textContent = activityData.type || '';
            document.getElementById('activity-detail-pc-number').textContent = activityData.pcNumber || 'N/A';
            document.getElementById('activity-detail-status').textContent = this.formatStatus(activityData.status);
            document.getElementById('activity-detail-priority').textContent = this.formatPriority(activityData.priority);
            document.getElementById('activity-detail-assigned-to').textContent = activityData.assignedTo || 'Unassigned';
            
            // Format and display date/time
            if (activityData.scheduledDate) {
                const date = new Date(activityData.scheduledDate);
                document.getElementById('activity-detail-scheduled-date').textContent = formatDate(date);
            } else {
                document.getElementById('activity-detail-scheduled-date').textContent = 'Not scheduled';
            }
            
            document.getElementById('activity-detail-scheduled-time').textContent = activityData.scheduledTime || 'Not specified';
            document.getElementById('activity-detail-duration').textContent = activityData.duration ? `${activityData.duration} minutes` : 'Not specified';
            document.getElementById('activity-detail-description').textContent = activityData.description || 'No description provided';
            
            // Location & Contact
            document.getElementById('activity-detail-location').textContent = activityData.location || 'Not specified';
            document.getElementById('activity-detail-contact-name').textContent = activityData.contactName || 'Not specified';
            document.getElementById('activity-detail-contact-phone').textContent = activityData.contactPhone || 'Not specified';
            
            // Management & Timing fields
            document.getElementById('activity-detail-department').textContent = activityData.department || 'Not specified';
            document.getElementById('activity-detail-payment-type').textContent = activityData.paymentType || 'Not specified';
            document.getElementById('activity-detail-activity-number').textContent = activityData.activityNumber || 'N/A';
            document.getElementById('activity-detail-time-depot-start').textContent = activityData.timeDepotStart || 'N/A';
            document.getElementById('activity-detail-time-site-start').textContent = activityData.timeSiteStart || 'N/A';
            document.getElementById('activity-detail-time-site-finish').textContent = activityData.timeSiteFinish || 'N/A';
            document.getElementById('activity-detail-time-depot-finish').textContent = activityData.timeDepotFinish || 'N/A';
            document.getElementById('activity-detail-hours').textContent = activityData.hours ? `${activityData.hours} hours` : 'N/A';
            document.getElementById('activity-detail-moveman-job').textContent = activityData.movemanJob || 'N/A';
            document.getElementById('activity-detail-crm-id').textContent = activityData.crmId || 'N/A';
            
            // Professional Details - Instructions
            const instructionsCard = document.getElementById('activity-detail-instructions-card');
            if (activityData.instructions && activityData.instructions.trim()) {
                document.getElementById('activity-detail-instructions').textContent = activityData.instructions;
                instructionsCard.style.display = 'block';
            } else {
                instructionsCard.style.display = 'none';
            }
            
            // Logistics & Requirements (boolean flags)
            document.getElementById('activity-detail-parking-required').textContent = activityData.parkingRequired ? 'Yes' : 'No';
            document.getElementById('activity-detail-confirmed').textContent = activityData.confirmed ? 'Yes' : 'No';
            document.getElementById('activity-detail-risk-assessment-needed').textContent = activityData.riskAssessmentNeeded ? 'Yes' : 'No';
            
            // Collection Address
            const collectionCard = document.getElementById('activity-detail-collection-card');
            if (activityData.collectionAddress && (activityData.collectionAddress.address1 || activityData.collectionAddress.contact)) {
                const addr = activityData.collectionAddress;
                document.getElementById('activity-detail-collection-contact').textContent = addr.contact || 'N/A';
                document.getElementById('activity-detail-collection-phone').textContent = addr.phone || 'N/A';
                
                // Format address
                const addressParts = [addr.address1, addr.address2, addr.city, addr.postcode, addr.country].filter(part => part && part.trim());
                document.getElementById('activity-detail-collection-address').textContent = addressParts.length > 0 ? addressParts.join(', ') : 'Not specified';
                
                collectionCard.style.display = 'block';
            } else {
                collectionCard.style.display = 'none';
            }
            
            // Delivery Address
            const deliveryCard = document.getElementById('activity-detail-delivery-card');
            if (activityData.deliveryAddress && (activityData.deliveryAddress.address1 || activityData.deliveryAddress.contact)) {
                const addr = activityData.deliveryAddress;
                document.getElementById('activity-detail-delivery-contact').textContent = addr.contact || 'N/A';
                document.getElementById('activity-detail-delivery-phone').textContent = addr.phone || 'N/A';
                
                // Format address
                const addressParts = [addr.address1, addr.address2, addr.city, addr.postcode, addr.country].filter(part => part && part.trim());
                document.getElementById('activity-detail-delivery-address').textContent = addressParts.length > 0 ? addressParts.join(', ') : 'Not specified';
                
                deliveryCard.style.display = 'block';
            } else {
                deliveryCard.style.display = 'none';
            }
            
            // Show completion details if completed
            const completionCard = document.getElementById('activity-detail-completion-card');
            if (activityData.status === 'completed' && activityData.completionNotes) {
                document.getElementById('activity-detail-completion-notes').textContent = activityData.completionNotes;
                completionCard.style.display = 'block';
            } else {
                completionCard.style.display = 'none';
            }

            // Navigate to detail page
            this.navigateToPage('activity-detail');

        } catch (error) {
            logError('Failed to show activity detail:', error);
            uiModals.showToast('Failed to load activity details', 'error');
        }
    }

    /**
     * @description Show quote detail page
     * @param {string} quoteId - Quote ID
     */
    async showQuoteDetail(quoteId) {
        try {
            const quoteData = await db.load('quotes', quoteId);
            if (!quoteData) {
                uiModals.showToast('Quote not found', 'error');
                return;
            }

            // Store current quote globally for button actions
            window.currentQuote = quoteData;

            // Populate detail fields
            document.getElementById('quote-detail-title').textContent = `Quote: ${quoteData.quoteNumber || quoteData.id}`;
            document.getElementById('quote-detail-number').textContent = quoteData.quoteNumber || quoteData.id;
            document.getElementById('quote-detail-pc-number').textContent = quoteData.pcNumber || 'N/A';
            document.getElementById('quote-detail-client-name').textContent = quoteData.clientName || 'N/A';
            document.getElementById('quote-detail-project-title').textContent = quoteData.projectTitle || 'N/A';
            document.getElementById('quote-detail-value').textContent = formatCurrency(quoteData.value || quoteData.total || 0);
            document.getElementById('quote-detail-status').textContent = this.formatStatus(quoteData.status || 'draft');
            
            // Format and display dates
            if (quoteData.validUntil) {
                const validUntilDate = new Date(quoteData.validUntil);
                document.getElementById('quote-detail-valid-until').textContent = formatDate(validUntilDate);
            } else {
                document.getElementById('quote-detail-valid-until').textContent = 'Not specified';
            }
            
            if (quoteData.createdAt) {
                const createdAtDate = new Date(quoteData.createdAt);
                document.getElementById('quote-detail-created-at').textContent = formatDate(createdAtDate);
            } else {
                document.getElementById('quote-detail-created-at').textContent = 'Unknown';
            }
            
            document.getElementById('quote-detail-description').textContent = quoteData.description || 'No description provided';

            // Financial Details
            document.getElementById('quote-detail-version').textContent = quoteData.version || '1';
            document.getElementById('quote-detail-net-total').textContent = formatCurrency(quoteData.netTotal || 0);
            document.getElementById('quote-detail-vat-rate').textContent = `${quoteData.vatRate || 20}%`;
            document.getElementById('quote-detail-vat-amount').textContent = formatCurrency(quoteData.vatAmount || 0);
            document.getElementById('quote-detail-discount').textContent = formatCurrency(quoteData.discount || 0);
            document.getElementById('quote-detail-total-cost').textContent = formatCurrency(quoteData.totalCost || quoteData.value || 0);

            // Professional Details
            document.getElementById('quote-detail-standard-liability').textContent = formatCurrency(quoteData.standardLiability || 100000);
            document.getElementById('quote-detail-declared-value').textContent = formatCurrency(quoteData.declaredValue || 0);
            document.getElementById('quote-detail-price-list').textContent = quoteData.priceListId || 'Not specified';

            // Pricing Breakdown - Quote Items
            const quoteItemsElement = document.getElementById('quote-detail-items');
            if (quoteData.quoteItems && quoteData.quoteItems.items && quoteData.quoteItems.items.length > 0) {
                const itemsHtml = quoteData.quoteItems.items.map(item => 
                    `<div style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between;">
                        <span><strong>${item.description || item.name}</strong> - ${item.quantity || 1} ${item.unit || 'units'}</span>
                        <span>${formatCurrency(item.total || item.price || 0)}</span>
                    </div>`
                ).join('');
                quoteItemsElement.innerHTML = `
                    <div style="font-weight: 600; margin-bottom: 0.5rem;">
                        ${quoteData.quoteItems.items.length} items (Total: ${formatCurrency(quoteData.quoteItems.totalValue || 0)})
                    </div>
                    ${itemsHtml}
                `;
            } else {
                quoteItemsElement.innerHTML = '<div style="text-align: center; color: #6b7280; font-size: 0.875rem;">No items in this quote</div>';
            }

            // Recycling Charges
            const recyclingCharges = quoteData.recyclingCharges || {};
            document.getElementById('quote-detail-recycling-fee').textContent = formatCurrency(recyclingCharges.recyclingFee || 0);
            document.getElementById('quote-detail-environmental-fee').textContent = formatCurrency(recyclingCharges.environmentalFee || 0);

            // Rebates
            const rebates = quoteData.rebates || {};
            document.getElementById('quote-detail-volume-rebate').textContent = formatCurrency(rebates.volumeRebate || 0);
            document.getElementById('quote-detail-loyalty-rebate').textContent = formatCurrency(rebates.loyaltyRebate || 0);

            // Other Costs (conditional display)
            const otherCostsSection = document.getElementById('quote-detail-other-costs-section');
            const otherCostsElement = document.getElementById('quote-detail-other-costs');
            if (quoteData.otherCosts && Array.isArray(quoteData.otherCosts) && quoteData.otherCosts.length > 0) {
                const otherCostsHtml = quoteData.otherCosts.map(cost => 
                    `<div style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between;">
                        <span>${cost.description || 'Other cost'}</span>
                        <span>${formatCurrency(cost.amount || 0)}</span>
                    </div>`
                ).join('');
                otherCostsElement.innerHTML = otherCostsHtml;
                otherCostsSection.style.display = 'block';
            } else {
                otherCostsSection.style.display = 'none';
            }

            // Navigate to detail page
            this.navigateToPage('quote-detail');

        } catch (error) {
            logError('Failed to show quote detail:', error);
            uiModals.showToast('Failed to load quote details', 'error');
        }
    }

    /**
     * @description Show PC Number detail page
     * @param {string} pcId - PC Number ID
     */
    async showPcDetail(pcId) {
        try {
            const pcData = await db.load('pcNumbers', pcId);
            if (!pcData) {
                uiModals.showToast('PC Number not found', 'error');
                return;
            }

            // Store current PC globally for button actions
            window.currentPC = pcData;

            // Populate detail fields (using existing PC detail page structure)
            document.getElementById('pc-detail-title').textContent = `PC Number: ${pcData.pcNumber}`;
            document.getElementById('pc-detail-number').textContent = pcData.pcNumber || '';
            document.getElementById('pc-detail-company-name').textContent = pcData.company || pcData.clientName || '';
            document.getElementById('pc-detail-project-name').textContent = pcData.projectTitle || '';
            document.getElementById('pc-detail-account-manager').textContent = pcData.accountManager || '';
            document.getElementById('pc-detail-client-industry').textContent = pcData.industry || 'Not specified';
            document.getElementById('pc-detail-client-source').textContent = pcData.source || 'Not specified';
            document.getElementById('pc-detail-quote-limit').textContent = pcData.budgetRange || 'Not specified';
            document.getElementById('pc-detail-status').textContent = this.formatStatus(pcData.status || 'draft');
            document.getElementById('pc-detail-project-description').textContent = pcData.projectDescription || 'No description provided';
            
            // Classification & Management fields
            document.getElementById('pc-detail-client-category').textContent = pcData.clientCategory || 'Not specified';
            document.getElementById('pc-detail-client-source-new').textContent = pcData.clientSource || 'Not specified';
            document.getElementById('pc-detail-referral-type').textContent = pcData.referralType || 'Not specified';

            document.getElementById('pc-detail-property-type').textContent = pcData.propertyType || 'Not specified';
            document.getElementById('pc-detail-sic-code-1').textContent = pcData.sicCode1 || 'N/A';
            document.getElementById('pc-detail-sic-code-2').textContent = pcData.sicCode2 || 'N/A';
            document.getElementById('pc-detail-sic-code-3').textContent = pcData.sicCode3 || 'N/A';

            // Collection Address fields
            document.getElementById('pc-detail-collection-title').textContent = pcData.collectionTitle || '';
            document.getElementById('pc-detail-collection-first-name').textContent = pcData.collectionFirstName || '';
            document.getElementById('pc-detail-collection-surname').textContent = pcData.collectionSurname || '';
            document.getElementById('pc-detail-collection-position').textContent = pcData.collectionPosition || '';
            document.getElementById('pc-detail-collection-date').textContent = pcData.collectionDate ? formatDate(new Date(pcData.collectionDate)) : '';
            document.getElementById('pc-detail-collection-email').textContent = pcData.collectionEmail || '';
            document.getElementById('pc-detail-collection-phone').textContent = pcData.collectionPhone || '';
            document.getElementById('pc-detail-collection-mobile').textContent = pcData.collectionMobile || '';
            document.getElementById('pc-detail-collection-address-1').textContent = pcData.collectionAddress1 || '';
            document.getElementById('pc-detail-collection-address-2').textContent = pcData.collectionAddress2 || '';
            document.getElementById('pc-detail-collection-address-3').textContent = pcData.collectionAddress3 || '';
            document.getElementById('pc-detail-collection-address-4').textContent = pcData.collectionAddress4 || '';
            document.getElementById('pc-detail-collection-postcode').textContent = pcData.collectionPostcode || '';
            document.getElementById('pc-detail-collection-country').textContent = pcData.collectionCountry || '';

            // Delivery Address fields
            document.getElementById('pc-detail-delivery-title').textContent = pcData.deliveryTitle || '';
            document.getElementById('pc-detail-delivery-first-name').textContent = pcData.deliveryFirstName || '';
            document.getElementById('pc-detail-delivery-surname').textContent = pcData.deliverySurname || '';
            document.getElementById('pc-detail-delivery-position').textContent = pcData.deliveryPosition || '';
            document.getElementById('pc-detail-delivery-date').textContent = pcData.deliveryDate ? formatDate(new Date(pcData.deliveryDate)) : '';
            document.getElementById('pc-detail-delivery-email').textContent = pcData.deliveryEmail || '';
            document.getElementById('pc-detail-delivery-phone').textContent = pcData.deliveryPhone || '';
            document.getElementById('pc-detail-delivery-mobile').textContent = pcData.deliveryMobile || '';
            document.getElementById('pc-detail-delivery-address-1').textContent = pcData.deliveryAddress1 || '';
            document.getElementById('pc-detail-delivery-address-2').textContent = pcData.deliveryAddress2 || '';
            document.getElementById('pc-detail-delivery-address-3').textContent = pcData.deliveryAddress3 || '';
            document.getElementById('pc-detail-delivery-address-4').textContent = pcData.deliveryAddress4 || '';
            document.getElementById('pc-detail-delivery-postcode').textContent = pcData.deliveryPostcode || '';
            document.getElementById('pc-detail-delivery-country').textContent = pcData.deliveryCountry || '';

            // Contact information
            document.getElementById('pc-detail-contact-name').textContent = pcData.contactName || '';
            document.getElementById('pc-detail-contact-phone').textContent = pcData.contactPhone || '';
            document.getElementById('pc-detail-contact-email').textContent = pcData.contactEmail || '';
            document.getElementById('pc-detail-postcode').textContent = pcData.postcode || '';

            // Load related quotes and activities
            await this.loadRelatedQuotes(pcId);
            await this.loadRelatedActivities(pcId);

            // Navigate to detail page
            this.navigateToPage('pc-detail');

        } catch (error) {
            logError('Failed to show PC detail:', error);
            uiModals.showToast('Failed to load PC Number details', 'error');
        }
    }

    /**
     * @description Load related quotes for PC detail page
     * @param {string} pcId - PC Number ID
     */
    async loadRelatedQuotes(pcId) {
        try {
            const allQuotes = await db.loadAll('quotes');
            const pcData = await db.load('pcNumbers', pcId);
            const pcNumber = pcData.pcNumber;
            
            // Filter quotes by PC Number
            const relatedQuotes = allQuotes.filter(quote => 
                quote.pcId === pcId || quote.pcNumber === pcNumber
            );

            const container = document.getElementById('pc-quotes');
            if (!container) return;

            if (relatedQuotes.length === 0) {
                container.innerHTML = '<tr><td colspan="5">No quotes found for this PC Number</td></tr>';
                return;
            }

            const rowsHTML = relatedQuotes.map(quote => `
                <tr class="clickable-row" onclick="window.viewQuoteDetail('${quote.id}')" style="cursor: pointer;">
                    <td>${sanitizeHTML(quote.quoteNumber || quote.id)}</td>
                    <td>${sanitizeHTML(quote.projectTitle || 'N/A')}</td>
                    <td>${formatCurrency(quote.value || quote.total || 0)}</td>
                    <td><span class="quote-status ${quote.status}">${sanitizeHTML(quote.status || 'draft')}</span></td>
                    <td onclick="event.stopPropagation()">
                        <button onclick="window.editQuote('${quote.id}')" class="secondary">Edit</button>
                    </td>
                </tr>
            `).join('');

            container.innerHTML = rowsHTML;
        } catch (error) {
            logError('Failed to load related quotes:', error);
        }
    }

    /**
     * @description Load related activities for PC detail page
     * @param {string} pcId - PC Number ID
     */
    async loadRelatedActivities(pcId) {
        try {
            const allActivities = await db.loadAll('activities');
            const pcData = await db.load('pcNumbers', pcId);
            const pcNumber = pcData.pcNumber;
            
            // Filter activities by PC Number
            const relatedActivities = allActivities.filter(activity => 
                activity.pcId === pcId || activity.pcNumber === pcNumber
            );

            const container = document.getElementById('pc-activities');
            if (!container) return;

            if (relatedActivities.length === 0) {
                container.innerHTML = '<tr><td colspan="5">No activities found for this PC Number</td></tr>';
                return;
            }

            const rowsHTML = relatedActivities.map(activity => `
                <tr class="clickable-row" onclick="window.viewActivityDetail('${activity.id}')" style="cursor: pointer;">
                    <td>${sanitizeHTML(activity.title || activity.id)}</td>
                    <td>${sanitizeHTML(activity.type || 'N/A')}</td>
                    <td>${formatDate(activity.scheduledDate || activity.startDate)}</td>
                    <td><span class="activity-status ${activity.status}">${this.formatStatus(activity.status)}</span></td>
                    <td onclick="event.stopPropagation()">
                        <button onclick="window.editActivity('${activity.id}')" class="secondary">Edit</button>
                    </td>
                </tr>
            `).join('');

            container.innerHTML = rowsHTML;
        } catch (error) {
            logError('Failed to load related activities:', error);
        }
    }

    /**
     * @description Show price list detail page
     * @param {string} priceListId - Price List ID
     */
    async showPriceListDetail(priceListId) {
        try {
            const priceListData = await db.load('priceLists', priceListId);
            if (!priceListData) {
                uiModals.showToast('Price List not found', 'error');
                return;
            }

            // Store current price list globally for button actions
            window.currentPriceList = priceListData;

            // Populate detail fields
            document.getElementById('pricelist-title').textContent = `Price List: ${priceListData.name}`;

            // Load price list items
            await this.loadPriceListItems(priceListData);

            // Navigate to detail page
            this.navigateToPage('pricelist-detail');

        } catch (error) {
            logError('Failed to show price list detail:', error);
            uiModals.showToast('Failed to load Price List details', 'error');
        }
    }

    /**
     * @description Load price list items for detail page
     * @param {Object} priceListData - Price List data
     */
    async loadPriceListItems(priceListData) {
        try {
            const container = document.getElementById('pricelist-items');
            if (!container) return;

            if (!priceListData.items || priceListData.items.length === 0) {
                container.innerHTML = '<tr><td colspan="5">No items found in this price list</td></tr>';
                return;
            }

            const rowsHTML = priceListData.items.map((item, index) => `
                <tr class="clickable-row" onclick="window.viewPriceListItem('${priceListData.id}', ${index})" style="cursor: pointer;">
                    <td>${sanitizeHTML(item.description || 'N/A')}</td>
                    <td>${formatCurrency(item.price || 0)}</td>
                    <td>${formatCurrency((item.price || 0) * 1.2)}</td>
                    <td>20%</td>
                    <td onclick="event.stopPropagation()">
                        <button onclick="window.editPriceListItem('${priceListData.id}', ${index})" class="secondary">Edit</button>
                        <button onclick="window.deletePriceListItem('${priceListData.id}', ${index})" class="danger">Delete</button>
                    </td>
                </tr>
            `).join('');

            container.innerHTML = rowsHTML;
            logDebug(`Loaded ${priceListData.items.length} price list items`);
        } catch (error) {
            logError('Failed to load price list items:', error);
        }
    }

    /**
     * @description Show price list item detail page
     * @param {string} priceListId - Price List ID
     * @param {number} itemIndex - Item index in price list
     */
    async showPriceListItemDetail(priceListId, itemIndex) {
        try {
            const priceListData = await db.load('priceLists', priceListId);
            if (!priceListData) {
                uiModals.showToast('Price List not found', 'error');
                return;
            }

            if (!priceListData.items || itemIndex < 0 || itemIndex >= priceListData.items.length) {
                uiModals.showToast('Price List Item not found', 'error');
                return;
            }

            const item = priceListData.items[itemIndex];

            // Store current item globally for button actions
            window.currentPriceListItem = { priceListId, itemIndex, item, priceListData };

            // Populate detail fields
            document.getElementById('pricelist-item-title').textContent = `Item: ${item.description || 'Unnamed Item'}`;
            
            // Item Information
            document.getElementById('pricelist-item-detail-description').textContent = item.description || 'N/A';
            document.getElementById('pricelist-item-detail-category').textContent = item.category || 'N/A';
            document.getElementById('pricelist-item-detail-unit').textContent = item.unit || 'each';

            // Pricing Details
            const price = item.price || 0;
            const margin = item.margin || 20;
            const clientPrice = item.clientPrice || (price * (1 + margin / 100));
            const profit = clientPrice - price;

            document.getElementById('pricelist-item-detail-price').textContent = formatCurrency(price);
            document.getElementById('pricelist-item-detail-margin').textContent = `${margin}%`;
            document.getElementById('pricelist-item-detail-client-price').textContent = formatCurrency(clientPrice);
            document.getElementById('pricelist-item-detail-profit').textContent = formatCurrency(profit);

            // Notes (conditional display)
            const notesCard = document.getElementById('pricelist-item-notes-card');
            if (item.notes && item.notes.trim()) {
                document.getElementById('pricelist-item-detail-notes').textContent = item.notes;
                notesCard.style.display = 'block';
            } else {
                notesCard.style.display = 'none';
            }

            // Price List Context
            document.getElementById('pricelist-item-detail-pricelist-name').textContent = priceListData.name || 'N/A';
            document.getElementById('pricelist-item-detail-pricelist-region').textContent = priceListData.region || 'N/A';
            document.getElementById('pricelist-item-detail-pricelist-currency').textContent = priceListData.currency || 'GBP';
            document.getElementById('pricelist-item-detail-pricelist-status').textContent = priceListData.status || 'active';

            // Navigate to detail page
            this.navigateToPage('pricelist-item-detail');

        } catch (error) {
            logError('Failed to show price list item detail:', error);
            uiModals.showToast('Failed to load Price List Item details', 'error');
        }
    }

    /**
     * @description Filter PC Numbers by company name
     * @param {string} query - Search query
     */
    filterPcNumbersByCompany(query) {
        try {
            const filtered = this.originalPcNumbers.filter(pc => {
                const companyName = (pc.company || pc.clientName || '').toLowerCase();
                return companyName.includes(query.toLowerCase());
            });
            
            this.renderPcNumbersList(filtered);
            this.updateFilterResults('pc-filter-results', filtered.length, this.originalPcNumbers.length, 'PC Numbers');
        } catch (error) {
            logError('Failed to filter PC numbers:', error);
        }
    }

    /**
     * @description Filter Activities by company name
     * @param {string} query - Search query
     */
    filterActivitiesByCompany(query) {
        try {
            const filtered = this.originalActivities.filter(activity => {
                // First check if activity has direct company name
                let companyName = (activity.clientName || activity.company || '').toLowerCase();
                
                // If no direct company name, look it up via Quote → PC Number hierarchy
                if (!companyName && activity.quoteId) {
                    // Find related quote
                    const relatedQuote = this.originalQuotes.find(quote => quote.id === activity.quoteId);
                    if (relatedQuote) {
                        // Get company name from quote
                        companyName = (relatedQuote.clientName || relatedQuote.company || '').toLowerCase();
                        
                        // If quote doesn't have company name, get it from PC Number
                        if (!companyName && (relatedQuote.pcId || relatedQuote.pcNumber)) {
                            const relatedPc = this.originalPcNumbers.find(pc => 
                                pc.id === relatedQuote.pcId || pc.pcNumber === relatedQuote.pcNumber
                            );
                            if (relatedPc) {
                                companyName = (relatedPc.company || relatedPc.clientName || '').toLowerCase();
                            }
                        }
                    }
                }
                
                // Fallback: If still no company name and activity has pcNumber (legacy support)
                if (!companyName && activity.pcNumber) {
                    const relatedPc = this.originalPcNumbers.find(pc => pc.pcNumber === activity.pcNumber);
                    if (relatedPc) {
                        companyName = (relatedPc.company || relatedPc.clientName || '').toLowerCase();
                    }
                }
                
                return companyName.includes(query.toLowerCase());
            });
            
            this.renderActivitiesList(filtered);
            this.updateFilterResults('activity-filter-results', filtered.length, this.originalActivities.length, 'Activities');
        } catch (error) {
            logError('Failed to filter activities:', error);
        }
    }

    /**
     * @description Filter Quotes by company name
     * @param {string} query - Search query
     */
    filterQuotesByCompany(query) {
        try {
            const filtered = this.originalQuotes.filter(quote => {
                // First check if quote has direct company name
                let companyName = (quote.clientName || quote.company || '').toLowerCase();
                
                // If no direct company name, look it up via PC Number
                if (!companyName && quote.pcNumber) {
                    const relatedPc = this.originalPcNumbers.find(pc => pc.pcNumber === quote.pcNumber);
                    if (relatedPc) {
                        companyName = (relatedPc.company || relatedPc.clientName || '').toLowerCase();
                    }
                }
                
                return companyName.includes(query.toLowerCase());
            });
            
            this.renderQuotesList(filtered);
            this.updateFilterResults('quote-filter-results', filtered.length, this.originalQuotes.length, 'Quotes');
        } catch (error) {
            logError('Failed to filter quotes:', error);
        }
    }

    /**
     * @description Update filter results display
     * @param {string} elementId - Results element ID
     * @param {number} filteredCount - Number of filtered results
     * @param {number} totalCount - Total number of items
     * @param {string} itemType - Type of items (PC Numbers, Activities, Quotes)
     */
    updateFilterResults(elementId, filteredCount, totalCount, itemType) {
        const element = document.getElementById(elementId);
        if (element) {
            if (filteredCount === totalCount) {
                element.textContent = `Showing all ${totalCount} ${itemType}`;
            } else {
                element.textContent = `Showing ${filteredCount} of ${totalCount} ${itemType}`;
            }
        }
    }

    /**
     * @description Clear PC Numbers filter
     */
    clearPcFilter() {
        document.getElementById('pc-filter-company').value = '';
        document.getElementById('pc-filter-account-manager').value = '';
        document.getElementById('pc-filter-pc-number').value = '';
        this.renderPcNumbersList(this.originalPcNumbers);
        this.updateFilterResults('pc-filter-results', this.originalPcNumbers.length, this.originalPcNumbers.length, 'PC Numbers');
    }

    /**
     * @description Clear Activities filter
     */
    clearActivityFilter() {
        document.getElementById('activity-filter-company').value = '';
        document.getElementById('activity-filter-account-manager').value = '';
        document.getElementById('activity-filter-pc-number').value = '';
        this.renderActivitiesList(this.originalActivities);
        this.updateFilterResults('activity-filter-results', this.originalActivities.length, this.originalActivities.length, 'Activities');
    }

    /**
     * @description Clear Quotes filter
     */
    clearQuoteFilter() {
        document.getElementById('quote-filter-company').value = '';
        document.getElementById('quote-filter-account-manager').value = '';
        document.getElementById('quote-filter-pc-number').value = '';
        this.renderQuotesList(this.originalQuotes);
        this.updateFilterResults('quote-filter-results', this.originalQuotes.length, this.originalQuotes.length, 'Quotes');
    }

    /**
     * @description Filter PC Numbers by account manager
     * @param {string} query - Search query
     */
    filterPcNumbersByAccountManager(query) {
        try {
            const filtered = this.originalPcNumbers.filter(pc => {
                const accountManager = (pc.accountManager || '').toLowerCase();
                return accountManager.includes(query.toLowerCase());
            });
            
            this.renderPcNumbersList(filtered);
            this.updateFilterResults('pc-filter-results', filtered.length, this.originalPcNumbers.length, 'PC Numbers');
        } catch (error) {
            logError('Failed to filter PC numbers by account manager:', error);
        }
    }

    /**
     * @description Filter Activities by account manager
     * @param {string} query - Search query
     */
    filterActivitiesByAccountManager(query) {
        try {
            const filtered = this.originalActivities.filter(activity => {
                // First check if activity has direct account manager
                let accountManager = (activity.accountManager || '').toLowerCase();
                
                // If no direct account manager, look it up via Quote → PC Number hierarchy
                if (!accountManager && activity.quoteId) {
                    // Find related quote
                    const relatedQuote = this.originalQuotes.find(quote => quote.id === activity.quoteId);
                    if (relatedQuote) {
                        // Get account manager from quote
                        accountManager = (relatedQuote.accountManager || '').toLowerCase();
                        
                        // If quote doesn't have account manager, get it from PC Number
                        if (!accountManager && (relatedQuote.pcId || relatedQuote.pcNumber)) {
                            const relatedPc = this.originalPcNumbers.find(pc => 
                                pc.id === relatedQuote.pcId || pc.pcNumber === relatedQuote.pcNumber
                            );
                            if (relatedPc) {
                                accountManager = (relatedPc.accountManager || '').toLowerCase();
                            }
                        }
                    }
                }
                
                // Fallback: If still no account manager and activity has pcNumber (legacy support)
                if (!accountManager && activity.pcNumber) {
                    const relatedPc = this.originalPcNumbers.find(pc => pc.pcNumber === activity.pcNumber);
                    if (relatedPc) {
                        accountManager = (relatedPc.accountManager || '').toLowerCase();
                    }
                }
                
                return accountManager.includes(query.toLowerCase());
            });
            
            this.renderActivitiesList(filtered);
            this.updateFilterResults('activity-filter-results', filtered.length, this.originalActivities.length, 'Activities');
        } catch (error) {
            logError('Failed to filter activities by account manager:', error);
        }
    }

    /**
     * @description Filter Quotes by account manager
     * @param {string} query - Search query
     */
    filterQuotesByAccountManager(query) {
        try {
            const filtered = this.originalQuotes.filter(quote => {
                // First check if quote has direct account manager
                let accountManager = (quote.accountManager || '').toLowerCase();
                
                // If no direct account manager, look it up via PC Number
                if (!accountManager && (quote.pcId || quote.pcNumber)) {
                    const relatedPc = this.originalPcNumbers.find(pc => 
                        pc.id === quote.pcId || pc.pcNumber === quote.pcNumber
                    );
                    if (relatedPc) {
                        accountManager = (relatedPc.accountManager || '').toLowerCase();
                    }
                }
                
                return accountManager.includes(query.toLowerCase());
            });
            
            this.renderQuotesList(filtered);
            this.updateFilterResults('quote-filter-results', filtered.length, this.originalQuotes.length, 'Quotes');
        } catch (error) {
            logError('Failed to filter quotes by account manager:', error);
        }
    }

    /**
     * @description Filter PC Numbers by PC Number
     * @param {string} query - Search query
     */
    filterPcNumbersByPcNumber(query) {
        try {
            const filtered = this.originalPcNumbers.filter(pc => {
                const pcNumber = (pc.pcNumber || '').toLowerCase();
                return pcNumber.includes(query.toLowerCase());
            });
            
            this.renderPcNumbersList(filtered);
            this.updateFilterResults('pc-filter-results', filtered.length, this.originalPcNumbers.length, 'PC Numbers');
        } catch (error) {
            logError('Failed to filter PC numbers by PC number:', error);
        }
    }

    /**
     * @description Filter Quotes by PC Number
     * @param {string} query - Search query
     */
    filterQuotesByPcNumber(query) {
        try {
            const filtered = this.originalQuotes.filter(quote => {
                const pcNumber = (quote.pcNumber || '').toLowerCase();
                return pcNumber.includes(query.toLowerCase());
            });
            
            this.renderQuotesList(filtered);
            this.updateFilterResults('quote-filter-results', filtered.length, this.originalQuotes.length, 'Quotes');
        } catch (error) {
            logError('Failed to filter quotes by PC number:', error);
        }
    }

    /**
     * @description Filter Activities by PC Number
     * @param {string} query - Search query
     */
    filterActivitiesByPcNumber(query) {
        try {
            const filtered = this.originalActivities.filter(activity => {
                // First check if activity has direct PC number (legacy support)
                let pcNumber = (activity.pcNumber || '').toLowerCase();
                
                // If no direct PC number, look it up via Quote → PC Number hierarchy
                if (!pcNumber && activity.quoteId) {
                    // Find related quote
                    const relatedQuote = this.originalQuotes.find(quote => quote.id === activity.quoteId);
                    if (relatedQuote) {
                        // Get PC number from quote
                        pcNumber = (relatedQuote.pcNumber || '').toLowerCase();
                        
                        // If quote doesn't have PC number, get it from PC Number via pcId
                        if (!pcNumber && relatedQuote.pcId) {
                            const relatedPc = this.originalPcNumbers.find(pc => pc.id === relatedQuote.pcId);
                            if (relatedPc) {
                                pcNumber = (relatedPc.pcNumber || '').toLowerCase();
                            }
                        }
                    }
                }
                
                return pcNumber.includes(query.toLowerCase());
            });
            
            this.renderActivitiesList(filtered);
            this.updateFilterResults('activity-filter-results', filtered.length, this.originalActivities.length, 'Activities');
        } catch (error) {
            logError('Failed to filter activities by PC number:', error);
        }
    }

    // ============================================
    // USER MANAGEMENT SYSTEM
    // ============================================

    /**
     * @description Get current logged-in user from local storage (persistent)
     * @returns {string|null} Current user name or null if not logged in
     */
    getCurrentUser() {
        return localStorage.getItem('currentUser');
    }

    /**
     * @description Set current user in local storage (persistent)
     * @param {string} userName - User name to set
     */
    setCurrentUser(userName) {
        localStorage.setItem('currentUser', userName);
        this.updateUserDisplay();
    }

    /**
     * @description Update user display in navigation header
     */
    updateUserDisplay() {
        const currentUser = this.getCurrentUser();
        const userInfo = document.getElementById('user-info');
        const userNameElement = document.getElementById('current-user-name');
        
        if (currentUser && userInfo && userNameElement) {
            userNameElement.textContent = currentUser;
            userInfo.style.display = 'flex';
        } else if (userInfo) {
            userInfo.style.display = 'none';
        }
    }

    /**
     * @description Check if user is logged in and handle login modal
     */
    checkUserLogin() {
        const currentUser = this.getCurrentUser();
        const loginModal = document.getElementById('login-modal');
        
        if (currentUser) {
            // User is logged in, hide login modal and show main app
            if (loginModal) loginModal.style.display = 'none';
            this.updateUserDisplay();
            logDebug(`User ${currentUser} logged in`);
        } else {
            // User not logged in, show login modal and hide loading immediately
            if (loginModal) {
                loginModal.style.display = 'block';
                loginModal.style.visibility = 'visible';
            }
            this.hideLoadingOverlay();
            logDebug('No user logged in, showing login modal');
        }
    }

    /**
     * @description Handle login form submission
     * @param {Event} event - Form submission event
     */
    async handleLogin(event) {
        event.preventDefault();
        logDebug('handleLogin called');
        
        const userSelect = document.getElementById('user-select');
        const selectedUser = userSelect.value;
        logDebug(`Selected user: ${selectedUser}`);
        
        if (!selectedUser) {
            uiModals.showToast('Please select a user', 'error');
            return;
        }
        
        // Set current user and hide login modal
        this.setCurrentUser(selectedUser);
        const loginModal = document.getElementById('login-modal');
        if (loginModal) {
            loginModal.style.display = 'none';
            loginModal.style.visibility = 'hidden';
            loginModal.style.opacity = '0';
        }
        
        // Show success message and continue with app initialization
        uiModals.showToast(`Welcome ${selectedUser}! 🎉`, 'success');
        
        // Continue with normal app initialization
        await this.initialize();
        
        logDebug(`User ${selectedUser} successfully logged in`);
    }

    /**
     * @description Show change user modal (reuses login modal)
     */
    showChangeUserModal() {
        const loginModal = document.getElementById('login-modal');
        const modalTitle = loginModal.querySelector('h2');
        const modalDescription = loginModal.querySelector('p');
        const submitButton = loginModal.querySelector('button[type="submit"]');
        
        // Update modal content for "change user" context
        modalTitle.textContent = '🔄 Change User';
        modalDescription.textContent = 'Select a different user account';
        submitButton.textContent = '✅ Switch User';
        
        // Pre-select current user
        const userSelect = document.getElementById('user-select');
        const currentUser = this.getCurrentUser();
        if (currentUser && userSelect) {
            userSelect.value = currentUser;
        }
        
        // Show modal
        if (loginModal) loginModal.style.display = 'block';
        
        logDebug('Change user modal displayed');
    }

    /**
     * @description Logout current user
     */
    logoutUser() {
        const currentUser = this.getCurrentUser();
        
        // Clear local storage
        localStorage.removeItem('currentUser');
        
        // Update UI
        this.updateUserDisplay();
        
        // Reset login modal to original state
        const loginModal = document.getElementById('login-modal');
        const modalTitle = loginModal.querySelector('h2');
        const modalDescription = loginModal.querySelector('p');
        const submitButton = loginModal.querySelector('button[type="submit"]');
        const userSelect = document.getElementById('user-select');
        
        modalTitle.textContent = '🔐 Login to CRM Demo';
        modalDescription.textContent = 'Please select your user account to continue';
        submitButton.textContent = '🚀 Login to System';
        if (userSelect) userSelect.value = '';
        
        // Show login modal
        if (loginModal) loginModal.style.display = 'block';
        
        uiModals.showToast(`${currentUser} logged out successfully`, 'info');
        logDebug(`User ${currentUser} logged out`);
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    const app = new CRMApplication();
    
    // Make app globally available for debugging
    window.crmApp = app;
    
    // Setup login system first
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            try {
                await app.handleLogin(event);
            } catch (error) {
                console.error('Login failed:', error);
                uiModals.showToast('Login failed. Please try again.', 'error');
            }
        });
    }
    
    // Check if user is already logged in
    app.checkUserLogin();
    
    // Only initialize main app if user is logged in
    if (app.getCurrentUser()) {
        await app.initialize();
    }
    
    // Expose navigation function globally for HTML onclick handlers
    window.showPage = (pageId) => app.navigateToPage(pageId);
    
    // Expose other essential functions for HTML onclick handlers
    window.showActivityModal = async () => {
        // Reset form for new activity
        document.getElementById('activity-modal-title').textContent = 'New Activity';
        document.getElementById('activity-id').value = '';
        
        // Clear all form fields
        document.getElementById('activity-title').value = '';
        document.getElementById('activity-description').value = '';
        document.getElementById('activity-type').value = '';
        document.getElementById('activity-priority').value = 'medium';
        document.getElementById('activity-status').value = 'pending';
        document.getElementById('activity-scheduled-date').value = '';
        document.getElementById('activity-scheduled-time').value = '';
        document.getElementById('activity-duration').value = '';
        document.getElementById('activity-assigned-to-name').value = '';
        document.getElementById('activity-location').value = '';
        document.getElementById('activity-contact-name').value = '';
        document.getElementById('activity-contact-phone').value = '';
        
        // Hide completion section
        document.getElementById('activity-completion-section').style.display = 'none';
        document.getElementById('activity-completion-notes').value = '';
        
        // Load PC Numbers dropdown
        await window.crmApp.loadPcNumbersForSelect('activity-pc-select');
        
        // If we're in a PC detail view, pre-select the current PC
        if (window.currentPC && window.currentPC.id) {
            const pcSelect = document.getElementById('activity-pc-select');
            if (pcSelect) {
                pcSelect.value = window.currentPC.id;
            }
        }
        
        uiModals.openModal('activity-modal');
    };
    window.showResourceModal = () => {
        // Reset form for new resource
        document.getElementById('resource-modal-title').textContent = 'New Resource';
        document.getElementById('resource-id').value = '';
        
        // Clear all form fields
        document.getElementById('resource-name').value = '';
        document.getElementById('resource-sku').value = '';
        document.getElementById('resource-category').value = '';
        document.getElementById('resource-subcategory').value = '';
        document.getElementById('resource-description').value = '';
        document.getElementById('resource-cost').value = '';
        document.getElementById('resource-unit').value = '';
        document.getElementById('resource-min-quantity').value = '';
        document.getElementById('resource-lead-time').value = '';
        document.getElementById('resource-supplier').value = '';
        document.getElementById('resource-supplier-code').value = '';
        document.getElementById('resource-warranty').value = '';
        document.getElementById('resource-status').value = 'true'; // default to active
        document.getElementById('resource-weight').value = '';
        document.getElementById('resource-dimensions').value = '';
        
        uiModals.openModal('resource-modal');
    };
    window.showNewQuoteModal = async () => {
        // Load PC Numbers dropdown for quote selection
        await window.crmApp.loadPcNumbersForSelect('quote-modal-pc');
        
        // If we're in a PC detail view, pre-select the current PC
        if (window.currentPC && window.currentPC.id) {
            const pcSelect = document.getElementById('quote-modal-pc');
            if (pcSelect) {
                pcSelect.value = window.currentPC.id;
            }
        }
        
        uiModals.openModal('quote-modal');
    };
    window.closeActivityModal = () => uiModals.closeModal('activity-modal');
    window.closeResourceModal = () => uiModals.closeModal('resource-modal');
    window.closePriceListModal = () => uiModals.closeModal('pricelist-modal');
    window.closeQuoteModal = () => uiModals.closeModal('quote-modal');
    
    window.proceedToQuoteBuilder = () => {
        // Get selected PC Number
        const selectedPcId = document.getElementById('quote-modal-pc').value;
        if (!selectedPcId) {
            uiModals.showToast('Please select a PC Number first', 'error');
            return;
        }
        
        // Close modal
        uiModals.closeModal('quote-modal');
        
        // Navigate to quote builder page
        window.crmApp.navigateToPage('quote-builder');
        
        // Set the title and prepare quote builder for selected PC
        const titleElement = document.getElementById('quote-builder-title');
        if (titleElement) {
            titleElement.textContent = 'New Quote - Loading PC Details...';
        }
        
        logDebug('Proceeding to quote builder for PC ID:', selectedPcId);
        uiModals.showToast('Quote builder opened for selected PC Number', 'success');
    };


    // Settings Functions
    window.exportData = async () => {
        try {
            logInfo('Starting data export...');
            
            // Get all data from database
            const allData = {
                pcNumbers: await db.loadAll('pcNumbers'),
                quotes: await db.loadAll('quotes'),
                activities: await db.loadAll('activities'),
                resources: await db.loadAll('resources'),
                priceLists: await db.loadAll('priceLists'),
                exportDate: new Date().toISOString(),
                version: '1.0'
            };
            
            // Create download link
            const dataStr = JSON.stringify(allData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            
            // Create temporary download link
            const downloadLink = document.createElement('a');
            downloadLink.href = url;
            downloadLink.download = `crm-data-export-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            
            // Clean up
            URL.revokeObjectURL(url);
            
            uiModals.showToast('Data exported successfully!', 'success');
            logInfo('Data export completed successfully');
            
        } catch (error) {
            logError('Failed to export data:', error);
            uiModals.showToast('Failed to export data', 'error');
        }
    };
    
    window.importData = async () => {
        try {
            const fileInput = document.getElementById('import-file');
            const file = fileInput.files[0];
            
            if (!file) {
                uiModals.showToast('Please select a JSON file to import', 'error');
                return;
            }
            
            // Confirm the operation
            const confirmed = confirm(
                'WARNING: This will permanently replace ALL existing data with the imported data.\\n\\n' +
                'Are you sure you want to continue? This action cannot be undone.\\n\\n' +
                'Click OK to proceed or Cancel to abort.'
            );
            
            if (!confirmed) {
                return;
            }
            
            logInfo('Starting data import...');
            
            // Read file content
            const fileContent = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsText(file);
            });
            
            // Parse JSON
            let importData;
            try {
                importData = JSON.parse(fileContent);
            } catch (parseError) {
                throw new Error('Invalid JSON file format');
            }
            
            // Validate data structure
            const requiredKeys = ['pcNumbers', 'quotes', 'activities', 'resources', 'priceLists'];
            const missingKeys = requiredKeys.filter(key => !importData.hasOwnProperty(key));
            
            if (missingKeys.length > 0) {
                throw new Error(`Missing required data: ${missingKeys.join(', ')}`);
            }
            
            // Clear existing data
            await db.clearAllStores();
            
            // Import data
            const stores = ['pcNumbers', 'quotes', 'activities', 'resources', 'priceLists'];
            let totalImported = 0;
            
            for (const store of stores) {
                const data = importData[store];
                if (Array.isArray(data)) {
                    for (const item of data) {
                        await db.save(store, item);
                        totalImported++;
                    }
                }
            }
            
            uiModals.showToast(`Import successful! ${totalImported} records imported.`, 'success');
            logInfo(`Data import completed: ${totalImported} records imported`);
            
            // Reset file input
            fileInput.value = '';
            document.getElementById('import-button').disabled = true;
            
            // Refresh current page data
            if (app.currentPage === 'settings') {
                await app.loadSettingsData();
            }
            
        } catch (error) {
            logError('Failed to import data:', error);
            uiModals.showToast(`Import failed: ${error.message}`, 'error');
        }
    };
    
    // Additional placeholder functions for missing onclick handlers
    window.editResource = async (id) => {
        try {
            logDebug('Opening Resource edit modal for ID:', id);
            const resourceData = await db.load('resources', id);
            if (!resourceData) {
                uiModals.showToast('Resource not found', 'error');
                return;
            }
            
            // Change modal title to Edit mode
            document.getElementById('resource-modal-title').textContent = 'Edit Resource';
            
            // Populate modal fields
            document.getElementById('resource-id').value = resourceData.id;
            document.getElementById('resource-name').value = resourceData.name || '';
            document.getElementById('resource-sku').value = resourceData.sku || '';
            document.getElementById('resource-category').value = resourceData.category || resourceData.type || '';
            document.getElementById('resource-subcategory').value = resourceData.subcategory || '';
            document.getElementById('resource-description').value = resourceData.description || '';
            
            // Pricing & Units
            document.getElementById('resource-cost').value = resourceData.costPerUnit || resourceData.cost || '';
            document.getElementById('resource-unit').value = resourceData.unit || '';
            document.getElementById('resource-min-quantity').value = resourceData.minQuantity || '';
            document.getElementById('resource-lead-time').value = resourceData.leadTime || '';
            
            // Supplier Information
            document.getElementById('resource-supplier').value = resourceData.supplier || '';
            document.getElementById('resource-supplier-code').value = resourceData.supplierCode || '';
            document.getElementById('resource-warranty').value = resourceData.warranty || '';
            document.getElementById('resource-status').value = resourceData.status === 'available' ? 'true' : 'false';
            
            // Physical Properties
            document.getElementById('resource-weight').value = resourceData.weight || '';
            document.getElementById('resource-dimensions').value = resourceData.dimensions || '';
            
            // Open modal
            uiModals.openModal('resource-modal');
            
        } catch (error) {
            logError('Failed to open Resource edit modal:', error);
            uiModals.showToast('Failed to load Resource data', 'error');
        }
    };
    window.deleteResource = (id) => console.log('Delete resource:', id);
    window.editPC = async (id) => {
        try {
            logDebug('Opening PC edit modal for ID:', id);
            const pcData = await db.load('pcNumbers', id);
            if (!pcData) {
                uiModals.showToast('PC Number not found', 'error');
                return;
            }
            
            // Populate basic fields
            document.getElementById('pc-edit-id').value = pcData.id;
            document.getElementById('pc-edit-number').value = pcData.pcNumber || '';
            document.getElementById('pc-edit-company').value = pcData.company || pcData.clientName || '';
            document.getElementById('pc-edit-title').value = pcData.projectTitle || '';
            document.getElementById('pc-edit-description').value = pcData.projectDescription || '';
            document.getElementById('pc-edit-status').value = pcData.status || 'active';
            
            // Client Details
            document.getElementById('pc-edit-account-manager').value = pcData.accountManager || '';
            document.getElementById('pc-edit-client-industry').value = pcData.industry || '';
            document.getElementById('pc-edit-client-source').value = pcData.source || '';
            document.getElementById('pc-edit-quote-limit').value = pcData.budgetRange || '';
            
            // Classification & Management
            document.getElementById('pc-edit-client-category').value = pcData.clientCategory || '';
            document.getElementById('pc-edit-client-source-new').value = pcData.clientSource || '';
            document.getElementById('pc-edit-referral-type').value = pcData.referralType || '';
            document.getElementById('pc-edit-property-type').value = pcData.propertyType || '';
            document.getElementById('pc-edit-sic-code-1').value = pcData.sicCode1 || '';
            document.getElementById('pc-edit-sic-code-2').value = pcData.sicCode2 || '';
            document.getElementById('pc-edit-sic-code-3').value = pcData.sicCode3 || '';
            
            // Contact Information
            document.getElementById('pc-edit-contact-name').value = pcData.contactName || '';
            document.getElementById('pc-edit-contact-phone').value = pcData.contactPhone || '';
            document.getElementById('pc-edit-contact-email').value = pcData.contactEmail || '';
            document.getElementById('pc-edit-postcode').value = pcData.postcode || '';
            
            // Collection Address
            document.getElementById('pc-edit-collection-first-name').value = pcData.collectionFirstName || '';
            document.getElementById('pc-edit-collection-surname').value = pcData.collectionSurname || '';
            document.getElementById('pc-edit-collection-title').value = pcData.collectionTitle || '';
            document.getElementById('pc-edit-collection-position').value = pcData.collectionPosition || '';
            document.getElementById('pc-edit-collection-date').value = pcData.collectionDate ? pcData.collectionDate.split('T')[0] : '';
            document.getElementById('pc-edit-collection-email').value = pcData.collectionEmail || '';
            document.getElementById('pc-edit-collection-phone').value = pcData.collectionPhone || '';
            document.getElementById('pc-edit-collection-mobile').value = pcData.collectionMobile || '';
            document.getElementById('pc-edit-collection-address-1').value = pcData.collectionAddress1 || '';
            document.getElementById('pc-edit-collection-address-2').value = pcData.collectionAddress2 || '';
            document.getElementById('pc-edit-collection-address-3').value = pcData.collectionAddress3 || '';
            document.getElementById('pc-edit-collection-address-4').value = pcData.collectionAddress4 || '';
            document.getElementById('pc-edit-collection-postcode').value = pcData.collectionPostcode || '';
            document.getElementById('pc-edit-collection-country').value = pcData.collectionCountry || '';
            
            // Delivery Address
            document.getElementById('pc-edit-delivery-first-name').value = pcData.deliveryFirstName || '';
            document.getElementById('pc-edit-delivery-surname').value = pcData.deliverySurname || '';
            document.getElementById('pc-edit-delivery-title').value = pcData.deliveryTitle || '';
            document.getElementById('pc-edit-delivery-position').value = pcData.deliveryPosition || '';
            document.getElementById('pc-edit-delivery-date').value = pcData.deliveryDate ? pcData.deliveryDate.split('T')[0] : '';
            document.getElementById('pc-edit-delivery-email').value = pcData.deliveryEmail || '';
            document.getElementById('pc-edit-delivery-phone').value = pcData.deliveryPhone || '';
            document.getElementById('pc-edit-delivery-mobile').value = pcData.deliveryMobile || '';
            document.getElementById('pc-edit-delivery-address-1').value = pcData.deliveryAddress1 || '';
            document.getElementById('pc-edit-delivery-address-2').value = pcData.deliveryAddress2 || '';
            document.getElementById('pc-edit-delivery-address-3').value = pcData.deliveryAddress3 || '';
            document.getElementById('pc-edit-delivery-address-4').value = pcData.deliveryAddress4 || '';
            document.getElementById('pc-edit-delivery-postcode').value = pcData.deliveryPostcode || '';
            document.getElementById('pc-edit-delivery-country').value = pcData.deliveryCountry || '';
            
            // Update modal title to show PC Number
            document.getElementById('pc-edit-modal-title').textContent = `Edit PC Number: ${pcData.pcNumber || 'Unknown'}`;
            
            // Open modal
            uiModals.openModal('pc-edit-modal');
            
        } catch (error) {
            logError('Failed to open PC edit modal:', error);
            uiModals.showToast('Failed to load PC Number data', 'error');
        }
    };
    
    window.closePcEditModal = () => {
        uiModals.closeModal('pc-edit-modal');
    };
    window.closeQuoteEditModal = () => {
        uiModals.closeModal('quote-edit-modal');
    };
    window.createQuote = (id) => console.log('Create quote for PC:', id);
    window.editQuote = async (id) => {
        try {
            logDebug('Opening Quote edit modal for ID:', id);
            const quoteData = await db.load('quotes', id);
            if (!quoteData) {
                uiModals.showToast('Quote not found', 'error');
                return;
            }
            
            // Change modal title to Edit mode
            document.getElementById('quote-edit-modal-title').textContent = 'Edit Quote';
            
            // Populate modal fields
            document.getElementById('quote-edit-id').value = quoteData.id;
            document.getElementById('quote-edit-number').value = quoteData.quoteNumber || '';
            document.getElementById('quote-edit-pc-number').value = quoteData.pcNumber || '';
            document.getElementById('quote-edit-client-name').value = quoteData.clientName || '';
            document.getElementById('quote-edit-project-title').value = quoteData.projectTitle || '';
            document.getElementById('quote-edit-value').value = quoteData.value || '';
            document.getElementById('quote-edit-status').value = quoteData.status || 'draft';
            document.getElementById('quote-edit-description').value = quoteData.description || '';
            
            // Format date for input field
            if (quoteData.validUntil) {
                const validUntilDate = new Date(quoteData.validUntil);
                document.getElementById('quote-edit-valid-until').value = validUntilDate.toISOString().split('T')[0];
            } else {
                document.getElementById('quote-edit-valid-until').value = '';
            }
            
            // Open modal
            uiModals.openModal('quote-edit-modal');
            
        } catch (error) {
            logError('Failed to open Quote edit modal:', error);
            uiModals.showToast('Failed to load Quote data', 'error');
        }
    };

    window.createPriceList = () => console.log('Create price list');
    window.editPriceList = async (id) => {
        try {
            logDebug('Opening Price List edit modal for ID:', id);
            const priceListData = await db.load('priceLists', id);
            if (!priceListData) {
                uiModals.showToast('Price List not found', 'error');
                return;
            }
            
            // Change modal title to Edit mode
            document.getElementById('pricelist-modal-title').textContent = 'Edit Price List';
            
            // Populate modal fields
            document.getElementById('pricelist-id').value = priceListData.id;
            document.getElementById('pricelist-name').value = priceListData.name || '';
            document.getElementById('pricelist-category').value = priceListData.category || '';
            document.getElementById('pricelist-region').value = priceListData.region || '';
            document.getElementById('pricelist-currency').value = priceListData.currency || 'GBP';
            document.getElementById('pricelist-description').value = priceListData.description || '';
            document.getElementById('pricelist-status').value = priceListData.status || 'active';
            
            // Format dates for input fields
            if (priceListData.validFrom) {
                const validFromDate = new Date(priceListData.validFrom);
                document.getElementById('pricelist-valid-from').value = validFromDate.toISOString().split('T')[0];
            }
            if (priceListData.validUntil) {
                const validUntilDate = new Date(priceListData.validUntil);
                document.getElementById('pricelist-valid-until').value = validUntilDate.toISOString().split('T')[0];
            }
            
            // Display items preview
            const itemsPreview = document.getElementById('pricelist-items-preview');
            if (priceListData.items && priceListData.items.length > 0) {
                itemsPreview.innerHTML = `
                    <strong>${priceListData.items.length} items in this price list:</strong>
                    <ul style="margin: 0.5rem 0; padding-left: 1.5rem; max-height: 150px; overflow-y: auto;">
                        ${priceListData.items.map(item => 
                            `<li style="margin: 0.25rem 0;">
                                <strong>${item.description}</strong> - £${item.price} ${item.unit}
                                <span style="color: #6b7280;">(${item.category})</span>
                            </li>`
                        ).join('')}
                    </ul>
                `;
            } else {
                itemsPreview.innerHTML = '<em style="color: #6b7280;">No items in this price list</em>';
            }
            
            // Open modal
            uiModals.openModal('pricelist-modal');
            
        } catch (error) {
            logError('Failed to open Price List edit modal:', error);
            uiModals.showToast('Failed to load Price List data', 'error');
        }
    };
    window.viewPriceList = async (id) => {
        await app.showPriceListDetail(id);
    };
    
    // Detail view functions
    window.viewActivityDetail = async (id) => {
        await app.showActivityDetail(id);
    };
    window.viewQuoteDetail = async (id) => {
        await app.showQuoteDetail(id);
    };
    window.viewPcDetail = async (id) => {
        await app.showPcDetail(id);
    };
    
    window.editActivity = async (id) => {
        try {
            logDebug('Opening Activity edit modal for ID:', id);
            const activityData = await db.load('activities', id);
            if (!activityData) {
                uiModals.showToast('Activity not found', 'error');
                return;
            }
            
            // Change modal title to Edit mode
            document.getElementById('activity-modal-title').textContent = 'Edit Activity';
            
            // Populate modal fields
            document.getElementById('activity-id').value = activityData.id;
            document.getElementById('activity-title').value = activityData.title || '';
            document.getElementById('activity-description').value = activityData.description || '';
            document.getElementById('activity-type').value = activityData.type || '';
            document.getElementById('activity-priority').value = activityData.priority || 'medium';
            document.getElementById('activity-status').value = activityData.status || 'pending';
            
            // Scheduling fields
            if (activityData.scheduledDate) {
                const date = new Date(activityData.scheduledDate);
                document.getElementById('activity-scheduled-date').value = date.toISOString().split('T')[0];
            }
            document.getElementById('activity-scheduled-time').value = activityData.scheduledTime || '';
            document.getElementById('activity-duration').value = activityData.duration || '';
            document.getElementById('activity-assigned-to-name').value = activityData.assignedTo || '';
            
            // Location & Contact fields
            document.getElementById('activity-location').value = activityData.location || '';
            document.getElementById('activity-contact-name').value = activityData.contactName || '';
            document.getElementById('activity-contact-phone').value = activityData.contactPhone || '';
            
            // Completion notes if completed
            if (activityData.status === 'completed') {
                document.getElementById('activity-completion-section').style.display = 'block';
                document.getElementById('activity-completion-notes').value = activityData.completionNotes || '';
            }
            
            // Load PC Number dropdown
            await window.crmApp.loadPcNumbersForSelect('activity-pc-select', activityData.pcId);
            
            // Open modal
            uiModals.openModal('activity-modal');
            
        } catch (error) {
            logError('Failed to open Activity edit modal:', error);
            uiModals.showToast('Failed to load Activity data', 'error');
        }
    };
    window.deleteActivity = async (id) => {
        try {
            // Find activity for confirmation dialog
            const activityData = await db.load('activities', id);
            if (!activityData) {
                uiModals.showToast('Activity not found', 'error');
                return;
            }
            
            // Show confirmation dialog
            const confirmed = confirm(`Are you sure you want to delete activity "${activityData.title}"?\n\nThis action cannot be undone.`);
            if (!confirmed) {
                return;
            }
            
            // Delete activity using activities module
            await activities.deleteActivity(id);
            
            // Show success message
            uiModals.showToast('Activity deleted successfully', 'success');
            
            // Refresh current page data
            if (app.currentPage === 'activities') {
                await app.loadActivitiesData();
            } else if (app.currentPage === 'dashboard') {
                await app.loadDashboardData();
            } else if (app.currentPage === 'pc-detail') {
                // Refresh related activities if we're on PC detail page
                const pcId = window.currentPC?.id;
                if (pcId) {
                    await app.loadRelatedActivities(pcId);
                }
            }
            
        } catch (error) {
            logError('Failed to delete activity:', error);
            uiModals.showToast('Failed to delete activity', 'error');
        }
    };
    
    // Price List Items operations
    window.viewPriceListItem = async (priceListId, index) => {
        await app.showPriceListItemDetail(priceListId, index);
    };
    
    window.editPriceListItem = async (priceListId, index) => {
        try {
            const priceListData = await db.load('priceLists', priceListId);
            if (!priceListData || !priceListData.items || index < 0 || index >= priceListData.items.length) {
                uiModals.showToast('Price List Item not found', 'error');
                return;
            }

            const item = priceListData.items[index];

            // Change modal title to Edit mode
            document.getElementById('pricelist-item-modal-title').textContent = 'Edit Price List Item';

            // Populate modal fields
            document.getElementById('pricelist-item-pricelist-id').value = priceListId;
            document.getElementById('pricelist-item-index').value = index;
            document.getElementById('pricelist-item-description').value = item.description || '';
            document.getElementById('pricelist-item-category').value = item.category || '';
            document.getElementById('pricelist-item-unit').value = item.unit || 'each';
            document.getElementById('pricelist-item-price').value = item.price || '';
            document.getElementById('pricelist-item-margin').value = item.margin || 20;
            document.getElementById('pricelist-item-notes').value = item.notes || '';

            // Calculate client price
            const price = parseFloat(item.price) || 0;
            const margin = parseFloat(item.margin) || 20;
            const clientPrice = price * (1 + margin / 100);
            document.getElementById('pricelist-item-client-price').value = clientPrice.toFixed(2);

            // Open modal
            uiModals.openModal('pricelist-item-modal');

        } catch (error) {
            logError('Failed to open Price List Item edit modal:', error);
            uiModals.showToast('Failed to load Price List Item data', 'error');
        }
    };
    
    window.deletePriceListItem = async (priceListId, index) => {
        try {
            const priceListData = await db.load('priceLists', priceListId);
            if (!priceListData || !priceListData.items || index < 0 || index >= priceListData.items.length) {
                uiModals.showToast('Price List Item not found', 'error');
                return;
            }

            const item = priceListData.items[index];

            // Show confirmation dialog
            const confirmed = confirm(`Are you sure you want to delete this item?\n\n"${item.description}"\n\nThis action cannot be undone.`);
            if (!confirmed) {
                return;
            }

            // Remove item from array
            priceListData.items.splice(index, 1);
            priceListData.updatedAt = new Date();

            // Save updated price list
            await db.save('priceLists', priceListData);

            // Show success message
            uiModals.showToast('Price List Item deleted successfully', 'success');

            // Refresh price list detail page if that's current page
            if (app.currentPage === 'pricelist-detail') {
                await app.loadPriceListItems(priceListData);
            }

            // Also refresh price lists page if that's current page
            if (app.currentPage === 'pricelists') {
                await app.loadPriceListsData();
            }

        } catch (error) {
            logError('Failed to delete price list item:', error);
            uiModals.showToast('Failed to delete price list item', 'error');
        }
    };
    
    // Price List Item Detail page operations
    window.editCurrentPriceListItem = () => {
        if (window.currentPriceListItem) {
            window.editPriceListItem(window.currentPriceListItem.priceListId, window.currentPriceListItem.itemIndex);
        }
    };
    
    window.deleteCurrentPriceListItem = () => {
        if (window.currentPriceListItem) {
            window.deletePriceListItem(window.currentPriceListItem.priceListId, window.currentPriceListItem.itemIndex);
        }
    };
    
    window.backToPriceListDetail = () => {
        if (window.currentPriceListItem) {
            window.viewPriceList(window.currentPriceListItem.priceListId);
        } else {
            app.navigateToPage('pricelists');
        }
    };
    
    window.closePriceListItemModal = () => {
        uiModals.closeModal('pricelist-item-modal');
    };
    window.showAddResourceToPriceList = () => console.log('Add resource to price list');

    // Quote Builder functions
    window.handlePriceListChange = () => {
        const priceListSelect = document.getElementById('quote-price-list');
        const quoteItemsSection = document.getElementById('quote-items-section');
        
        if (priceListSelect && quoteItemsSection) {
            const selectedPriceListId = priceListSelect.value;
            
            if (selectedPriceListId) {
                // Show Step 2: Build Quote section
                quoteItemsSection.style.display = 'block';
                
                // Scroll to the quote items section
                quoteItemsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                
                logDebug('Price List selected:', selectedPriceListId);
                uiModals.showToast('Price List selected. You can now build your quote.', 'success');
            } else {
                // Hide Step 2 if no price list selected
                quoteItemsSection.style.display = 'none';
            }
        }
    };
    
    // Smart Filtering functions
    window.filterPcNumbersByCompany = (query) => app.filterPcNumbersByCompany(query);
    window.filterPcNumbersByAccountManager = (query) => app.filterPcNumbersByAccountManager(query);
    window.filterPcNumbersByPcNumber = (query) => app.filterPcNumbersByPcNumber(query);
    window.filterActivitiesByCompany = (query) => app.filterActivitiesByCompany(query);
    window.filterActivitiesByAccountManager = (query) => app.filterActivitiesByAccountManager(query);
    window.filterActivitiesByPcNumber = (query) => app.filterActivitiesByPcNumber(query);
    window.filterQuotesByCompany = (query) => app.filterQuotesByCompany(query);
    window.filterQuotesByAccountManager = (query) => app.filterQuotesByAccountManager(query);
    window.filterQuotesByPcNumber = (query) => app.filterQuotesByPcNumber(query);
    window.clearPcFilter = () => app.clearPcFilter();
    window.clearActivityFilter = () => app.clearActivityFilter();
    window.clearQuoteFilter = () => app.clearQuoteFilter();
    
    // User Management functions
    window.showChangeUserModal = () => app.showChangeUserModal();
    window.logoutUser = () => app.logoutUser();
    
    // PHASE 2: Search-related placeholder functions (for modal compatibility)
    window.filterResources = () => logDebug('filterResources: Search functionality removed');
    window.filterActivityResourceSelector = () => logDebug('filterActivityResourceSelector: Search functionality removed');
    window.filterDependencySelector = () => logDebug('filterDependencySelector: Search functionality removed');
});

// Export for use in other modules
export { CRMApplication };