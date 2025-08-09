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

        // Quote form
        const quoteForm = document.getElementById('new-quote-form');
        if (quoteForm) {
            quoteForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.saveQuote();
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

        logDebug('Form listeners setup completed');
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
                default:
                    logDebug(`No data loading required for page: ${pageId}`);
                    break;
            }
        } catch (error) {
            logError(`Failed to load data for page ${pageId}:`, error);
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
                            <td><span class="status-badge ${quote.status || 'pending'}">${quote.status || 'pending'}</span></td>
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

            // Handle quote items display
            const itemsContainer = document.getElementById('quote-detail-items');
            if (itemsContainer) {
                if (quoteData.items && quoteData.items.length > 0) {
                    itemsContainer.innerHTML = quoteData.items.map(item => `
                        <div style="padding: 0.5rem 0; border-bottom: 1px solid #e5e7eb;">
                            <strong>${item.name || 'Item'}</strong> - ${item.description || 'No description'}<br>
                            <small>Quantity: ${item.quantity || 1} | Unit Price: £${(item.unitPrice || 0).toFixed(2)} | Total: £${((item.quantity || 1) * (item.unitPrice || 0)).toFixed(2)}</small>
                        </div>
                    `).join('');
                } else {
                    itemsContainer.innerHTML = '<p style="margin: 0; color: #6b7280;">No items added to this quote yet.</p>';
                }
            }

            // Handle other costs section
            const otherCostsSection = document.getElementById('quote-detail-other-costs-section');
            const otherCostsContainer = document.getElementById('quote-detail-other-costs');
            if (quoteData.otherCosts && quoteData.otherCosts.length > 0) {
                if (otherCostsSection) otherCostsSection.style.display = 'block';
                if (otherCostsContainer) {
                    otherCostsContainer.innerHTML = quoteData.otherCosts.map(cost => `
                        <div style="padding: 0.25rem 0;">
                            ${cost.description}: £${cost.amount.toFixed(2)}
                        </div>
                    `).join('');
                }
            } else {
                if (otherCostsSection) otherCostsSection.style.display = 'none';
            }

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
            
            // Open quote modal
            await this.openQuoteModal();
            
            // Pre-fill the PC Number dropdown
            const pcSelect = document.getElementById('quote-modal-pc');
            if (pcSelect) {
                pcSelect.value = pcData.pcNumber;
                logDebug(`Pre-selected PC Number: ${pcData.pcNumber}`);
            }
            
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
            const pcNumbers = await db.loadAll('pcNumbers');
            const container = document.getElementById('pc-list');
            
            if (container) {
                if (pcNumbers.length === 0) {
                    container.innerHTML = '<tr><td colspan="6">No PC Numbers found. <button onclick="window.showNewPcModal()" class="button primary">Create First PC Number</button></td></tr>';
                } else {
                    container.innerHTML = pcNumbers.map(pc => `
                        <tr onclick="window.viewPcDetails('${pc.id}')" style="cursor: pointer;" onmouseover="this.style.backgroundColor='#f8fafc'" onmouseout="this.style.backgroundColor=''">
                            <td><strong>${pc.pcNumber || 'N/A'}</strong></td>
                            <td>${pc.company || 'N/A'}</td>
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
                    container.innerHTML = '<tr><td colspan="7">No quotes found. <button onclick="window.showNewQuoteModal()" class="button primary">Create First Quote</button></td></tr>';
                } else {
                    container.innerHTML = quotes.map(quote => `
                        <tr onclick="window.viewQuoteDetails('${quote.id}')" style="cursor: pointer;" onmouseover="this.style.backgroundColor='#f8fafc'" onmouseout="this.style.backgroundColor=''">
                            <td><strong>${quote.quoteNumber || 'N/A'}</strong></td>
                            <td>${quote.clientName || 'N/A'}</td>
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
                    container.innerHTML = '<tr><td colspan="9">No activities found. <button onclick="window.showActivityModal()" class="button primary">Create First Activity</button></td></tr>';
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
            const container = document.getElementById('resources-list');
            
            if (container) {
                if (resources.length === 0) {
                    container.innerHTML = '<tr><td colspan="5">No resources found. <button onclick="window.showResourceModal()" class="button primary">Create First Resource</button></td></tr>';
                } else {
                    container.innerHTML = resources.map(resource => `
                        <tr>
                            <td><strong>${resource.name || 'N/A'}</strong></td>
                            <td>${resource.category || resource.type || 'N/A'}</td>
                            <td>£${(resource.costPerHour || resource.costPerDay || resource.costPerUnit || 0).toLocaleString()}</td>
                            <td><span class="status-badge ${resource.status || 'available'}">${resource.status || 'available'}</span></td>
                            <td>
                                <button onclick="window.editResource('${resource.id}')" class="button warning small">Edit</button>
                                <button onclick="window.viewResourceDetails('${resource.id}')" class="button primary small">View</button>
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

    /**
     * @description Load Price Lists data
     */
    async loadPriceListsData() {
        try {
            const priceLists = await db.loadAll('priceLists') || [];
            console.log('loadPriceListsData - All Price Lists:', priceLists);
            priceLists.forEach(pl => console.log(`Price List "${pl.name}" has ${(pl.items || []).length} items:`, pl.items));
            const container = document.getElementById('pricelist-table');
            
            if (container) {
                if (priceLists.length === 0) {
                    container.innerHTML = '<tr><td colspan="4">No price lists found. <button onclick="window.createPriceList()" class="button primary">Create First Price List</button></td></tr>';
                } else {
                    container.innerHTML = priceLists.map(priceList => `
                        <tr onclick="window.viewPriceListDetails('${priceList.id}')" style="cursor: pointer;" onmouseover="this.style.backgroundColor='#f8fafc'" onmouseout="this.style.backgroundColor=''">
                            <td><strong>${priceList.name || 'N/A'}</strong></td>
                            <td>${priceList.description || 'N/A'}</td>
                            <td>${(priceList.items || []).length} items</td>
                            <td onclick="event.stopPropagation()">
                                <button onclick="window.editPriceList('${priceList.id}')" class="button warning small">Edit</button>
                                <button onclick="window.viewPriceListDetails('${priceList.id}')" class="button primary small">View</button>
                            </td>
                        </tr>
                    `).join('');
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
     */
    async openQuoteModal() {
        try {
            logDebug('Opening new quote modal');
            
            // Load PC Numbers for dropdown
            const pcNumbers = await db.loadAll('pcNumbers');
            const pcSelect = document.getElementById('quote-modal-pc');
            
            if (pcSelect) {
                pcSelect.innerHTML = '<option value="">Select PC Number</option>';
                pcNumbers.forEach(pc => {
                    pcSelect.innerHTML += `<option value="${pc.id}" data-pc-number="${pc.pcNumber}">${pc.pcNumber} - ${pc.company}</option>`;
                });
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
            
            // Clear company field
            const companyField = document.getElementById('quote-modal-company');
            if (companyField) {
                companyField.value = '';
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
     * @description Close Quote Modal
     */
    closeQuoteModal() {
        uiModals.closeModal('quote-modal');
    }

    /**
     * @description Save new quote
     */
    async saveQuote() {
        try {
            logDebug('Saving new quote');
            
            const formData = this.getQuoteFormData();
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
                status: 'pending',
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
    getQuoteFormData() {
        const pcSelect = document.getElementById('quote-modal-pc');
        const priceListSelect = document.getElementById('quote-modal-pricelist');
        const accountManagerSelect = document.getElementById('quote-modal-account-manager');
        
        if (!pcSelect?.value) {
            uiModals.showToast('Please select a PC Number', 'error');
            return null;
        }
        
        if (!priceListSelect?.value) {
            uiModals.showToast('Please select a Price List', 'error');
            return null;
        }
        
        if (!accountManagerSelect?.value) {
            uiModals.showToast('Please select an Account Manager', 'error');
            return null;
        }
        
        const selectedOption = pcSelect.options[pcSelect.selectedIndex];
        const pcNumber = selectedOption?.getAttribute('data-pc-number') || '';
        
        return {
            pcId: pcSelect.value,
            pcNumber: pcNumber,
            priceListId: priceListSelect.value,
            accountManager: accountManagerSelect.value
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
        console.log('Attempting to highlight field:', fieldId);
        const field = document.getElementById(fieldId);
        if (field) {
            console.log('Field found, applying highlighting:', field);
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
        } else {
            console.error('Field not found with ID:', fieldId);
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
        
        console.log('Form validation - values:', { company, accountManager, contactFirstName, contactLastName, addressPostcode });
        
        // Clear any previous highlighting
        this.clearFieldHighlighting();
        
        // Check each required field and highlight if missing
        if (!company) {
            console.log('Company missing, highlighting pc-company-name');
            this.highlightMissingField('pc-company-name');
            missingFields.push('Company Name');
        }
        if (!accountManager) {
            console.log('Account Manager missing, highlighting pc-account-manager');
            this.highlightMissingField('pc-account-manager');
            missingFields.push('Account Manager');
        }
        if (!contactFirstName) {
            console.log('Contact First Name missing, highlighting pc-contact-first-name');
            this.highlightMissingField('pc-contact-first-name');
            missingFields.push('Contact First Name');
        }
        if (!contactLastName) {
            console.log('Contact Last Name missing, highlighting pc-contact-last-name');
            this.highlightMissingField('pc-contact-last-name');
            missingFields.push('Contact Last Name');
        }
        if (!addressPostcode) {
            console.log('Postcode missing, highlighting pc-address-postcode');
            this.highlightMissingField('pc-address-postcode');
            missingFields.push('Postcode');
        }
        
        if (missingFields.length > 0) {
            console.log('Validation failed, missing fields:', missingFields);
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
            }
        } catch (error) {
            logError('Failed to clear resource form:', error);
        }
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
                    costPerUnit: parseFloat(formData.cost),
                    unit: formData.unit,
                    status: formData.status,
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
            const cost = document.getElementById('resource-cost')?.value;
            const unit = document.getElementById('resource-unit')?.value;
            const status = document.getElementById('resource-status')?.value;

            if (!name || !category || !cost || !unit || !status) {
                uiModals.showToast('Please fill in all required fields', 'error');
                return null;
            }

            if (isNaN(cost) || parseFloat(cost) < 0) {
                uiModals.showToast('Please enter a valid cost', 'error');
                return null;
            }

            return { name, category, cost, unit, status };
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
            document.getElementById('resource-cost').value = resource.costPerUnit || resource.costPerHour || resource.costPerDay || '';
            document.getElementById('resource-unit').value = resource.unit || '';
            document.getElementById('resource-status').value = resource.status || 'available';

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
                costPerUnit: parseFloat(formData.cost),
                unit: formData.unit,
                status: formData.status,
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
                    description: formData.description || '',
                    currency: 'GBP',
                    status: 'active',
                    markup: 25,
                    discount: 0,
                    effectiveFrom: new Date().toISOString(),
                    isDefault: false,
                    items: [],
                    createdAt: new Date().toISOString(),
                    lastModifiedAt: new Date().toISOString(),
                    createdBy: this.currentUser || 'User'
                };

                await db.save('priceLists', priceListData);
                uiModals.showToast(`Price List "${priceListData.name}" created successfully!`, 'success');
                
                this.closePriceListModal();
                
                // Refresh price lists if we're on pricelists page
                if (this.currentPage === 'pricelists') {
                    await this.loadPriceListsData();
                }
                
                logDebug('Price list created successfully:', priceListData);
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
            const category = document.getElementById('pricelist-category')?.value;
            const description = document.getElementById('pricelist-description')?.value?.trim();

            if (!name || !category) {
                uiModals.showToast('Please fill in all required fields', 'error');
                return null;
            }

            return { name, category, description };
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
                description: formData.description,
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
            document.getElementById('modal-client-price').value = '';
            document.getElementById('resource-info').innerHTML = '';
            document.getElementById('margin-info').innerHTML = '';

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
            
            if (!select) return;

            select.innerHTML = '<option value="">Select a resource...</option>';
            
            resources.forEach(resource => {
                const option = document.createElement('option');
                option.value = resource.id;
                option.textContent = `${resource.name} (${resource.category}) - £${(resource.costPerUnit || 0).toLocaleString()}`;
                option.dataset.cost = resource.costPerUnit || 0;
                option.dataset.unit = resource.unit || 'each';
                select.appendChild(option);
            });

            // Add change event listener
            select.onchange = () => this.updateResourceInfo();
            
            logDebug(`Loaded ${resources.length} resources for price list`);
        } catch (error) {
            logError('Failed to load resources for price list:', error);
        }
    }

    /**
     * @description Update resource info when resource is selected
     */
    updateResourceInfo() {
        try {
            const select = document.getElementById('modal-resource-item-select');
            const selectedOption = select.options[select.selectedIndex];
            const resourceInfo = document.getElementById('resource-info');
            
            if (!selectedOption || !selectedOption.value) {
                resourceInfo.innerHTML = '';
                return;
            }

            const cost = parseFloat(selectedOption.dataset.cost || 0);
            const unit = selectedOption.dataset.unit || 'each';
            
            resourceInfo.innerHTML = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div><strong>Net Cost:</strong> £${cost.toLocaleString()}</div>
                    <div><strong>Unit:</strong> ${unit}</div>
                </div>
            `;

            // Auto-calculate suggested client price (with default 25% markup)
            const suggestedPrice = cost * 1.25;
            document.getElementById('modal-client-price').value = suggestedPrice.toFixed(2);
            this.calculateMargin();

        } catch (error) {
            logError('Failed to update resource info:', error);
        }
    }

    /**
     * @description Calculate margin percentage
     */
    calculateMargin() {
        try {
            const select = document.getElementById('modal-resource-item-select');
            const selectedOption = select.options[select.selectedIndex];
            const clientPriceInput = document.getElementById('modal-client-price');
            const marginInfo = document.getElementById('margin-info');
            
            if (!selectedOption || !selectedOption.value || !clientPriceInput.value) {
                marginInfo.innerHTML = '';
                return;
            }

            const netCost = parseFloat(selectedOption.dataset.cost || 0);
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
            
            const resourceId = resourceSelect.value;
            const clientPrice = parseFloat(clientPriceInput.value || 0);
            
            if (!resourceId) {
                uiModals.showToast('Please select a resource', 'error');
                return;
            }
            
            if (clientPrice <= 0) {
                uiModals.showToast('Please enter a valid client price', 'error');
                return;
            }

            // Get resource details
            const resource = await db.load('resources', resourceId);
            if (!resource) {
                uiModals.showToast('Resource not found', 'error');
                return;
            }

            // Create price list item
            const itemId = `PLI-${Date.now()}`;
            const netCost = resource.costPerUnit || 0;
            const margin = netCost > 0 ? ((clientPrice - netCost) / netCost) * 100 : 0;

            const priceListItem = {
                id: itemId,
                priceListId: this.currentPriceList.id,
                resourceId: resourceId,
                resourceName: resource.name,
                resourceCategory: resource.category,
                netCost: netCost,
                clientPrice: clientPrice,
                margin: margin,
                unit: resource.unit || 'each',
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

            uiModals.showToast(`"${resource.name}" added to price list successfully!`, 'success');
            
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
        await app.addQuoteForPc(id);
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
        await app.openQuoteEditModal(id);
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
    window.editResource = (id) => app.editResource(id);
    window.viewResourceDetails = (id) => app.viewResourceDetails(id);
    window.closeResourceDetailsModal = () => uiModals.closeModal('resource-details-modal');

    // Price Lists functions
    window.editPriceList = (id) => app.editPriceList(id);
    window.viewPriceListDetails = (id) => app.viewPriceListDetails(id);
    window.createPriceList = () => app.createPriceList();

    // Price List Items functions
    window.showAddResourceToPriceList = () => app.showAddResourceToPriceList();
    window.addResourceToPriceList = () => app.addResourceToPriceList();
    window.closeAddResourceModal = () => app.closeAddResourceModal();
    window.calculateMargin = () => app.calculateMargin();
    window.removePriceListItem = (id) => app.removePriceListItem(id);

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