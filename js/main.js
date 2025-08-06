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
        } catch (error) {
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
            if (stats.pcNumbers === 0) {
                logInfo('🔵 Database is empty, loading sample data...');
                await this.loadSampleData();
            } else {
                logDebug('Database contains data, skipping sample data load');
            }
        } catch (error) {
            logError('Failed to check/load sample data:', error);
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
                case 'quotes':
                    await this.loadQuotesData();
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

            logDebug('Dashboard data loaded');
        } catch (error) {
            logError('Failed to load dashboard data:', error);
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
                        <tr>
                            <td><strong>${pc.pcNumber || 'N/A'}</strong></td>
                            <td>${pc.company || pc.clientName || 'N/A'}</td>
                            <td>${pc.projectTitle || 'N/A'}</td>
                            <td>£${(pc.estimatedValue || 0).toLocaleString()}</td>
                            <td><span class="status-badge ${pc.status || 'pending'}">${pc.status || 'pending'}</span></td>
                            <td>
                                <button onclick="window.editPC('${pc.id}')" class="button warning small">Edit</button>
                                <button onclick="window.viewPcDetails('${pc.id}')" class="button primary small">View</button>
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
                    container.innerHTML = '<tr><td colspan="6">No quotes found. <button onclick="window.showNewQuoteModal()" class="button primary">Create First Quote</button></td></tr>';
                } else {
                    container.innerHTML = quotes.map(quote => `
                        <tr>
                            <td><strong>${quote.quoteNumber || 'N/A'}</strong></td>
                            <td>${quote.clientName || 'N/A'}</td>
                            <td>${quote.pcNumber || 'N/A'}</td>
                            <td>£${(quote.totalAmount || 0).toLocaleString()}</td>
                            <td><span class="status-badge ${quote.status || 'pending'}">${quote.status || 'pending'}</span></td>
                            <td>
                                <button onclick="window.editQuote('${quote.id}')" class="button warning small">Edit</button>
                                <button onclick="window.viewQuoteDetails('${quote.id}')" class="button primary small">View</button>
                            </td>
                        </tr>
                    `).join('');
                }
            } else {
                logError('Quotes container not found: #quotes-list');
            }
            
            logDebug(`Loaded ${quotes.length} quotes`);
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
                    container.innerHTML = '<tr><td colspan="6">No activities found. <button onclick="window.showActivityModal()" class="button primary">Create First Activity</button></td></tr>';
                } else {
                    container.innerHTML = activities.map(activity => `
                        <tr>
                            <td><strong>${activity.title || 'N/A'}</strong></td>
                            <td>${activity.type || 'N/A'}</td>
                            <td>${activity.pcNumber || 'N/A'}</td>
                            <td>${new Date(activity.scheduledDate).toLocaleDateString() || 'N/A'}</td>
                            <td><span class="status-badge ${activity.status || 'pending'}">${activity.status || 'pending'}</span></td>
                            <td>
                                <button onclick="window.editActivity('${activity.id}')" class="button warning small">Edit</button>
                                <button onclick="window.viewActivityDetails('${activity.id}')" class="button primary small">View</button>
                            </td>
                        </tr>
                    `).join('');
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
            const container = document.getElementById('pricelist-table');
            
            if (container) {
                if (priceLists.length === 0) {
                    container.innerHTML = '<tr><td colspan="4">No price lists found. <button onclick="window.createPriceList()" class="button primary">Create First Price List</button></td></tr>';
                } else {
                    container.innerHTML = priceLists.map(priceList => `
                        <tr>
                            <td><strong>${priceList.name || 'N/A'}</strong></td>
                            <td>${priceList.description || 'N/A'}</td>
                            <td>${(priceList.items || []).length} items</td>
                            <td>
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
                { id: 'pc-edit-company', value: pcData.company || pcData.clientName || '' },
                { id: 'pc-edit-title', value: pcData.projectTitle || '' },
                { id: 'pc-edit-description', value: pcData.projectDescription || '' },
                { id: 'pc-edit-status', value: pcData.status || 'active' },
                { id: 'pc-edit-contact-name', value: pcData.contactName || '' },
                { id: 'pc-edit-contact-phone', value: pcData.contactPhone || '' },
                { id: 'pc-edit-contact-email', value: pcData.contactEmail || '' }
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
            if (formData.quoteId) {
                const quoteData = await db.load('quotes', formData.quoteId);
                if (quoteData) {
                    pcId = quoteData.pcId;
                    pcNumber = quoteData.pcNumber;
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
                description: formData.description || '',
                createdAt: new Date().toISOString(),
                lastModifiedAt: new Date().toISOString(),
                createdBy: this.currentUser || 'User',
                editedBy: this.currentUser || 'User'
            };
            
            await db.save('activities', activityData);
            uiModals.showToast(`Activity "${activityData.title}" created successfully!`, 'success');
            
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
            if (formData.quoteId) {
                const quoteData = await db.load('quotes', formData.quoteId);
                if (quoteData) {
                    pcId = quoteData.pcId;
                    pcNumber = quoteData.pcNumber;
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
                description: formData.description,
                lastModifiedAt: new Date().toISOString(),
                editedBy: this.currentUser || 'User'
            };
            
            await db.save('activities', updatedActivity);
            uiModals.showToast(`Activity "${updatedActivity.title}" updated successfully!`, 'success');
            
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
            
            const activityData = await db.load('activities', id);
            if (!activityData) {
                logError(`Activity not found: ${id}`);
                uiModals.showToast('Activity not found', 'error');
                return;
            }
            
            // Store current activity in global state
            window.currentActivity = activityData;
            
            logDebug('Activity details functionality will be restored soon');
            uiModals.showToast('Activity details functionality will be restored soon', 'info');
            
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
        
        if (!pcSelect?.value) {
            uiModals.showToast('Please select a PC Number', 'error');
            return null;
        }
        
        if (!priceListSelect?.value) {
            uiModals.showToast('Please select a Price List', 'error');
            return null;
        }
        
        const selectedOption = pcSelect.options[pcSelect.selectedIndex];
        const pcNumber = selectedOption?.getAttribute('data-pc-number') || '';
        
        return {
            pcId: pcSelect.value,
            pcNumber: pcNumber,
            priceListId: priceListSelect.value
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
        
        if (!quoteNumber || !status || !clientName) {
            uiModals.showToast('Please fill in required fields (Quote Number, Status, Client Name)', 'error');
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
            
            logDebug('Quote details functionality will be restored soon');
            uiModals.showToast('Quote details functionality will be restored soon', 'info');
            
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
                projectTitle: formData.projectTitle,
                projectDescription: formData.projectDescription,
                clientName: formData.company,
                contactName: formData.contactName,
                contactEmail: formData.contactEmail,
                contactPhone: formData.contactPhone,
                postcode: formData.postcode,
                estimatedValue: 0, // Default value
                status: 'active',
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
            
            // Get updated data with error checking
            const company = document.getElementById('pc-edit-company')?.value || '';
            const projectTitle = document.getElementById('pc-edit-title')?.value || '';
            const projectDescription = document.getElementById('pc-edit-description')?.value || '';
            const status = document.getElementById('pc-edit-status')?.value || 'active';
            const contactName = document.getElementById('pc-edit-contact-name')?.value || '';
            const contactEmail = document.getElementById('pc-edit-contact-email')?.value || '';
            const contactPhone = document.getElementById('pc-edit-contact-phone')?.value || '';
            
            // Validation
            if (!company.trim() || !projectTitle.trim() || !contactName.trim()) {
                uiModals.showToast('Please fill in required fields (Company, Project Title, Contact Name)', 'error');
                return;
            }
            
            const updatedData = {
                ...existingPc,
                company: company.trim(),
                clientName: company.trim(), // Keep both for compatibility
                projectTitle: projectTitle.trim(),
                projectDescription: projectDescription.trim(),
                status: status,
                contactName: contactName.trim(),
                contactEmail: contactEmail.trim(),
                contactPhone: contactPhone.trim(),
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
     * @description Get PC form data
     */
    getPcFormData() {
        const company = document.getElementById('pc-company-name')?.value.trim();
        const projectTitle = document.getElementById('pc-project-name')?.value.trim();
        const contactName = document.getElementById('pc-contact-name')?.value.trim();
        
        if (!company || !projectTitle || !contactName) {
            uiModals.showToast('Please fill in required fields (Company Name, Project Name, Contact Name)', 'error');
            return null;
        }
        
        return {
            company: company,
            projectTitle: projectTitle,
            projectDescription: document.getElementById('pc-project-description')?.value.trim() || '',
            contactName: contactName,
            contactEmail: document.getElementById('pc-contact-email')?.value.trim() || '',
            contactPhone: document.getElementById('pc-contact-phone')?.value.trim() || '',
            postcode: document.getElementById('pc-postcode')?.value.trim() || ''
        };
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
     * @description Switch activities view between list, calendar, and workflow
     */
    switchActivitiesView(viewType) {
        try {
            logDebug('Switching activities view to:', viewType);
            
            // Hide all views
            const listView = document.getElementById('activities-list-view');
            const calendarView = document.getElementById('activities-calendar-view');
            const calendarNavigation = document.getElementById('calendar-navigation');
            
            if (listView) listView.style.display = 'none';
            if (calendarView) calendarView.style.display = 'none';
            if (calendarNavigation) calendarNavigation.style.display = 'none';
            
            // Update button styles
            const listBtn = document.getElementById('activities-list-view-btn');
            const calendarBtn = document.getElementById('activities-calendar-view-btn');
            
            // Reset button styles
            [listBtn, calendarBtn].forEach(btn => {
                if (btn) {
                    btn.style.background = 'transparent';
                    btn.style.color = '#374151';
                }
            });
            
            // Show selected view and update button
            switch (viewType) {
                case 'list':
                    if (listView) listView.style.display = 'block';
                    if (listBtn) {
                        listBtn.style.background = '#3b82f6';
                        listBtn.style.color = 'white';
                    }
                    break;
                    
                case 'calendar':
                    if (calendarView) calendarView.style.display = 'block';
                    if (calendarNavigation) calendarNavigation.style.display = 'flex';
                    if (calendarBtn) {
                        calendarBtn.style.background = '#3b82f6';
                        calendarBtn.style.color = 'white';
                    }
                    // Initialize calendar
                    this.initializeCalendar();
                    break;
                    

                    
                default:
                    logError('Unknown view type:', viewType);
                    return;
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
            
            // Hide all calendar views
            if (monthView) monthView.style.display = 'none';
            if (weekView) weekView.style.display = 'none';
            
            // Reset button styles
            [monthBtn, weekBtn].forEach(btn => {
                if (btn) {
                    btn.style.background = 'transparent';
                    btn.style.color = '#374151';
                }
            });
            
            // Show selected view and update button
            switch (viewType) {
                case 'month':
                    if (monthView) monthView.style.display = 'block';
                    if (monthBtn) {
                        monthBtn.style.background = '#3b82f6';
                        monthBtn.style.color = 'white';
                    }
                    this.generateMonthCalendar();
                    break;
                    
                case 'week':
                    if (weekView) weekView.style.display = 'block';
                    if (weekBtn) {
                        weekBtn.style.background = '#3b82f6';
                        weekBtn.style.color = 'white';
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
     * @description Initialize calendar
     */
    initializeCalendar() {
        try {
            if (!this.currentCalendarDate) {
                this.currentCalendarDate = new Date();
            }
            
            if (!this.currentCalendarView) {
                this.currentCalendarView = 'month';
            }
            
            this.updateCalendarTitle();
            this.setCalendarView(this.currentCalendarView);
            
        } catch (error) {
            logError('Failed to initialize calendar:', error);
        }
    }

    /**
     * @description Update calendar title
     */
    updateCalendarTitle() {
        try {
            const titleElement = document.getElementById('calendar-title');
            if (!titleElement || !this.currentCalendarDate) return;
            
            const date = new Date(this.currentCalendarDate);
            const options = { 
                year: 'numeric', 
                month: 'long' 
            };
            
            if (this.currentCalendarView === 'week') {
                const weekStart = new Date(date);
                weekStart.setDate(date.getDate() - date.getDay());
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 6);
                
                titleElement.textContent = `Week of ${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`;
            } else {
                titleElement.textContent = date.toLocaleDateString('en-US', options);
            }
            
        } catch (error) {
            logError('Failed to update calendar title:', error);
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
     * @description Generate month calendar
     */
    async generateMonthCalendar() {
        try {
            const calendarGrid = document.getElementById('calendar-grid');
            if (!calendarGrid) return;
            
            const date = new Date(this.currentCalendarDate);
            const year = date.getFullYear();
            const month = date.getMonth();
            
            // Get first day of month and number of days
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            const daysInMonth = lastDay.getDate();
            const startDay = firstDay.getDay(); // 0 = Sunday
            
            // Load activities for this month
            const activities = await db.loadAll('activities');
            const monthActivities = activities.filter(activity => {
                if (!activity.scheduledDate) return false;
                const activityDate = new Date(activity.scheduledDate);
                return activityDate.getFullYear() === year && activityDate.getMonth() === month;
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
    
    window.showResourceModal = () => {
        logDebug('Resource modal requested');
        uiModals.showToast('Resource functionality will be restored soon', 'info');
    };
    
    window.showPriceListModal = () => {
        logDebug('Price List modal requested');
        uiModals.showToast('Price List functionality will be restored soon', 'info');
    };
    
    // Close modal functions
    window.closeActivityModal = () => uiModals.closeModal('activity-modal');
    window.closeResourceModal = () => uiModals.closeModal('resource-modal');
    window.closePriceListModal = () => uiModals.closeModal('pricelist-modal');

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
    

    
    window.clearPcFilter = () => {
        logDebug('Clear PC filter requested');
        uiModals.showToast('Filter functionality will be restored soon', 'info');
    };
    
    window.clearActivityFilter = () => {
        logDebug('Clear activity filter requested');
        uiModals.showToast('Filter functionality will be restored soon', 'info');
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
    
    // Price list functions
    window.createPriceList = () => {
        logDebug('Create price list requested');
        uiModals.showToast('Price list creation will be restored soon', 'info');
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
        'editActivity', 'editQuote', 'showAddResourceToPriceList',
        'editCurrentPriceListItem', 'deleteCurrentPriceListItem',
        'backToPriceListDetail', 'addLineItem', 'saveQuoteAsTemplate',
        'duplicateCurrentQuote', 'toggleWorkloadPanel', 'showTeamManagement'
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