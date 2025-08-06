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
        
        // Additional event listeners can be added here
        logDebug('Event listeners setup completed');
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
            
            // Show modal
            modal.style.display = 'block';
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
        const modal = document.getElementById('pc-edit-modal');
        if (modal) {
            modal.style.display = 'none';
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
    
    window.closePcEditModal = () => {
        app.closePcEditModal();
    };
    
    window.showNewQuoteModal = () => {
        logDebug('Quote modal requested');
        uiModals.showToast('Quote functionality will be restored soon', 'info');
    };
    
    window.showActivityModal = () => {
        logDebug('Activity modal requested');
        uiModals.showToast('Activity functionality will be restored soon', 'info');
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
    window.closeQuoteModal = () => uiModals.closeModal('quote-modal');
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
    
    window.clearQuoteFilter = () => {
        logDebug('Clear quote filter requested');
        uiModals.showToast('Filter functionality will be restored soon', 'info');
    };
    
    window.clearActivityFilter = () => {
        logDebug('Clear activity filter requested');
        uiModals.showToast('Filter functionality will be restored soon', 'info');
    };
    
    // Activity view functions
    window.switchActivitiesView = (viewType) => {
        logDebug('Switch activities view requested:', viewType);
        uiModals.showToast('Activities view switching will be restored soon', 'info');
    };
    
    window.setCalendarView = (viewType) => {
        logDebug('Set calendar view requested:', viewType);
        uiModals.showToast('Calendar view functionality will be restored soon', 'info');
    };
    
    window.navigateCalendar = (direction) => {
        logDebug('Navigate calendar requested:', direction);
        uiModals.showToast('Calendar navigation will be restored soon', 'info');
    };
    
    // Data export/import functions
    window.exportData = () => {
        logDebug('Export data requested');
        uiModals.showToast('Data export will be restored soon', 'info');
    };
    
    window.importData = () => {
        logDebug('Import data requested');
        uiModals.showToast('Data import will be restored soon', 'info');
    };
    
    // Quote builder functions
    window.saveQuote = () => {
        logDebug('Save quote requested');
        uiModals.showToast('Quote saving will be restored soon', 'info');
    };
    
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
        'duplicateCurrentQuote', 'toggleWorkloadPanel', 'showTeamManagement',
        'autoLayoutWorkflow', 'calculateCriticalPath', 'optimizeWorkflow'
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