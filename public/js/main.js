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
        this.searchInstance = null;
        this.config = {
            DB_NAME: 'CRM_Database',
            VERSION: '1.0.0',
            MAX_DESCRIPTION_LENGTH: 1000,
            DEFAULT_ACTIVITY_DURATION: 60,
            SEARCH_DEBOUNCE_MS: 300
        };
    }

    /**
     * @description Initialize the application
     */
    async initialize() {
        try {
            logInfo('Initializing CRM Application...');
            this.showLoadingOverlay('Initializing application...');

            // Initialize core systems
            this.updateProgress(20, 'Connecting to database...');
            await this.initializeDatabase();
            
            this.updateProgress(50, 'Setting up user interface...');
            await this.initializeUI();
            
            this.updateProgress(75, 'Loading data...');
            await this.setupEventListeners();

            this.updateProgress(90, 'Almost ready...');
            // Set initial page
            this.navigateToPage(this.currentPage);

            this.updateProgress(100, 'Complete!');
            
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
            await db.initialize();
            
            // Load sample data if database is empty
            const stats = await db.getStats();
            if (Object.values(stats).every(count => count === 0)) {
                await this.loadSampleData();
            }
        } catch (error) {
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

            // Setup search functionality
            this.setupGlobalSearch();

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
                case 'resources':
                    await this.loadResourcesData();
                    break;
                case 'pcnumbers':
                    await this.loadPcNumbersData();
                    break;
                case 'quotes':
                    await this.loadQuotesData();
                    break;
                case 'pricelists':
                    await this.loadPriceListsData();
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

            // Load recent PC numbers table
            await this.loadRecentPCNumbers();

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
                container.innerHTML = '<tr><td colspan="3">No PC Numbers found</td></tr>';
                return;
            }

            const rows = recentPCs.map(pc => `
                <tr>
                    <td>${pc.pcNumber || ''}</td>
                    <td>${pc.company || ''}</td>
                    <td>${pc.reference || ''}</td>
                </tr>
            `).join('');

            container.innerHTML = rows;
            logDebug(`Loaded ${recentPCs.length} recent PC numbers`);
        } catch (error) {
            logError('Failed to load recent PC numbers:', error);
        }
    }

    /**
     * @description Load activities data
     */
    async loadActivitiesData() {
        try {
            const allActivities = await activities.getAllActivities();
            this.renderActivitiesList(allActivities);
            this.renderActivitiesCalendar(allActivities);
        } catch (error) {
            logError('Failed to load activities data:', error);
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
                <tr>
                    <td>${sanitizeHTML(activity.title)}</td>
                    <td>${this.formatActivityType(activity.type)}</td>
                    <td>${formatDate(activity.startDate || activity.scheduledDate)}</td>
                    <td><span class="activity-status ${activity.status}">${this.formatStatus(activity.status)}</span></td>
                    <td><span class="priority-${activity.priority}">${this.formatPriority(activity.priority)}</span></td>
                    <td>
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

        } catch (error) {
            logError('Failed to setup form handlers:', error);
        }
    }

    /**
     * @description Handle PC Number form submission
     * @param {Event} event - Form submit event
     */
    async handlePcNumberSubmit(event) {
        event.preventDefault();
        
        try {
            const formData = new FormData(event.target);
            const data = Object.fromEntries(formData);

            // Validation rules
            const rules = {
                pcNumber: { required: true, minLength: 3 },
                projectTitle: { required: true, minLength: 5 },
                projectDescription: { required: true, minLength: 10 }
            };

            const validation = validateFormData(data, rules);
            if (!validation.isValid) {
                this.showValidationErrors(event.target, validation.errors);
                return;
            }

            // Save PC Number
            const pcNumberData = {
                pcNumber: data.pcNumber,
                projectTitle: data.projectTitle,
                projectDescription: data.projectDescription,
                clientName: data.clientName || '',
                clientEmail: data.clientEmail || '',
                clientPhone: data.clientPhone || '',
                address: data.address || '',
                estimatedValue: parseFloat(data.estimatedValue) || 0,
                status: 'draft',
                createdAt: new Date()
            };

            const id = await db.save('pcNumbers', pcNumberData);
            
            uiModals.closeModal(MODAL_TYPES.PC_NUMBER);
            uiModals.showToast('PC Number created successfully', 'success');
            
            // Refresh page data
            if (this.currentPage === 'pcnumbers') {
                await this.loadPcNumbersData();
            }

        } catch (error) {
            logError('Failed to save PC Number:', error);
            uiModals.showToast('Failed to save PC Number', 'error');
        }
    }

    /**
     * @description Handle activity form submission
     * @param {Event} event - Form submit event
     */
    async handleActivitySubmit(event) {
        event.preventDefault();
        
        try {
            const formData = new FormData(event.target);
            const data = Object.fromEntries(formData);

            const activityData = {
                title: data.title,
                description: data.description,
                type: data.type,
                pcId: data.pcId,
                scheduledDate: data.scheduledDate,
                scheduledTime: data.scheduledTime,
                duration: parseInt(data.duration),
                priority: data.priority,
                assignedTo: data.assignedTo,
                resourcesRequired: data.resourcesRequired ? data.resourcesRequired.split(',') : []
            };

            const id = await activities.createActivity(activityData);
            
            uiModals.closeModal(MODAL_TYPES.ACTIVITY);
            uiModals.showToast('Activity created successfully', 'success');
            
            // Refresh page data
            if (this.currentPage === 'activities') {
                await this.loadActivitiesData();
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
            const progressBar = document.getElementById('progress-bar');
            const progressText = document.getElementById('progress-text');
            
            if (progressBar) {
                progressBar.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
            }
            
            if (progressText) {
                progressText.textContent = text || `${Math.round(percentage)}%`;
            }
        } catch (error) {
            logError('Failed to update progress:', error);
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
     * @description Setup global search functionality
     */
    setupGlobalSearch() {
        try {
            const searchInput = document.getElementById('global-search-input');
            if (searchInput) {
                const debouncedSearch = debounce(this.performGlobalSearch.bind(this), this.config.SEARCH_DEBOUNCE_MS);
                searchInput.addEventListener('input', debouncedSearch);
            }
        } catch (error) {
            logError('Failed to setup global search:', error);
        }
    }

    /**
     * @description Perform global search
     * @param {Event} event - Input event
     */
    async performGlobalSearch(event) {
        try {
            const query = event.target.value.trim();
            if (query.length < 2) return;

            const [activitiesResults, resourcesResults] = await Promise.all([
                activities.searchActivities(query),
                resources.searchResources(query)
            ]);

            this.displaySearchResults({
                activities: activitiesResults,
                resources: resourcesResults
            });

        } catch (error) {
            logError('Global search failed:', error);
        }
    }

    /**
     * @description Load sample data for demo purposes
     */
    async loadSampleData() {
        try {
            logInfo('Loading sample data...');
            
            // Sample PC Numbers
            const samplePCNumbers = [
                {
                    pcNumber: 'PC-2024-001',
                    company: 'Acme Corporation',
                    reference: 'Office LED Upgrade',
                    projectTitle: 'Office LED Lighting Upgrade',
                    projectDescription: 'Complete LED lighting upgrade for main office building',
                    clientName: 'Acme Corporation',
                    contactName: 'John Smith',
                    estimatedValue: 15000,
                    status: 'active',
                    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
                },
                {
                    pcNumber: 'PC-2024-002', 
                    company: 'Warehouse Solutions Ltd',
                    reference: 'Warehouse Lighting',
                    projectTitle: 'Warehouse Lighting Installation',
                    projectDescription: 'New LED lighting installation for warehouse facility',
                    clientName: 'Warehouse Solutions Ltd',
                    contactName: 'Sarah Johnson',
                    estimatedValue: 25000,
                    status: 'active',
                    date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago
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
                    notes: 'Client provided detailed blueprints.'
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
                    notes: 'Requires scissor lift access.'
                },
                {
                    title: 'Electrical Inspection',
                    description: 'Regular electrical testing and inspection as per BS 7671 requirements',
                    type: 'Inspection',
                    startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // In a week
                    duration: 60,
                    status: 'pending',
                    priority: 'low',
                    assigneeId: 'EMP001',
                    notes: 'Follow-up required for fire alarm system.'
                }
            ];

            for (const activityData of sampleActivities) {
                const savedActivity = await db.save('activities', { ...activityData, id: generateId(), createdAt: new Date() });
                logInfo('Saved Activity:', savedActivity.title);
            }

            // Sample Resources
            const sampleResources = [
                {
                    name: 'Scissor Lift JLG 1930ES',
                    type: 'Equipment',
                    sku: 'EQP-001',
                    status: 'available',
                    costPerHour: 35.00,
                    description: 'Compact electric scissor lift for indoor use.'
                },
                {
                    name: 'Ford Transit Van',
                    type: 'Vehicle',
                    sku: 'VEH-005',
                    status: 'in-use',
                    costPerHour: 0.50,
                    description: 'Standard long-wheelbase transit van for crew and tools.'
                },
                {
                    name: 'CAT 320 Excavator',
                    type: 'Equipment',
                    sku: 'EQP-010',
                    status: 'maintenance',
                    costPerHour: 85.00,
                    description: 'Heavy excavator for trenching and groundworks.'
                },
                {
                    name: 'Safety Harness Kit',
                    type: 'Tool',
                    sku: 'TOOL-015',
                    status: 'available',
                    costPerHour: 0,
                    description: 'Full body safety harness with lanyard and anchor.'
                }
            ];

            for (const resourceData of sampleResources) {
                const savedResource = await db.save('resources', { ...resourceData, id: generateId(), createdAt: new Date() });
                logInfo('Saved Resource:', savedResource.name);
            }

            // Sample Quotes
            const sampleQuotes = [
                {
                    quoteNumber: 'QT-2024-001',
                    pcNumber: 'PC-2024-001',
                    clientName: 'Acme Corporation',
                    projectTitle: 'Office LED Lighting Upgrade',
                    value: 15500.00,
                    status: 'pending',
                    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
                    description: 'Complete LED lighting upgrade including materials and labor',
                    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
                },
                {
                    quoteNumber: 'QT-2024-002',
                    pcNumber: 'PC-2024-002',
                    clientName: 'Warehouse Solutions Ltd',
                    projectTitle: 'Warehouse Lighting Installation',
                    value: 28750.00,
                    status: 'approved',
                    validUntil: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(), // 45 days from now
                    description: 'New LED lighting installation for warehouse facility including control systems',
                    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
                },
                {
                    quoteNumber: 'QT-2024-003',
                    pcNumber: 'PC-2024-001',
                    clientName: 'Tech Startup Hub',
                    projectTitle: 'Smart Office Lighting System',
                    value: 42300.00,
                    status: 'draft',
                    validUntil: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(), // 21 days from now
                    description: 'Advanced smart lighting system with IoT integration and automated controls',
                    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago
                }
            ];

            for (const quoteData of sampleQuotes) {
                const savedQuote = await db.save('quotes', { ...quoteData, id: generateId() });
                logInfo('Saved Quote:', savedQuote.quoteNumber);
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
     * @description Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => {
            // Ctrl+K for global search
            if (event.ctrlKey && event.key === 'k') {
                event.preventDefault();
                const searchInput = document.getElementById('global-search-input');
                if (searchInput) searchInput.focus();
            }
            
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
    
    async loadPcNumbersData() { 
        try {
            logDebug('Loading PC numbers data...');
            const allPcNumbers = await db.loadAll('pcNumbers');
            this.renderPcNumbersList(allPcNumbers);
        } catch (error) {
            logError('Failed to load PC numbers data:', error);
        }
    }
    
    async loadQuotesData() { 
        try {
            logDebug('Loading quotes data...');
            const allQuotes = await db.loadAll('quotes');
            this.renderQuotesList(allQuotes);
        } catch (error) {
            logError('Failed to load quotes data:', error);
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
                <tr>
                    <td><strong>${sanitizeHTML(pc.pcNumber)}</strong></td>
                    <td>${sanitizeHTML(pc.clientName || 'N/A')}</td>
                    <td>${sanitizeHTML(pc.projectTitle || 'N/A')}</td>
                    <td>${sanitizeHTML(pc.contactName || 'N/A')}</td>
                    <td>
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
                <tr>
                    <td><strong>${sanitizeHTML(quote.quoteNumber || quote.id)}</strong></td>
                    <td>${sanitizeHTML(quote.clientName || 'N/A')}</td>
                    <td>${formatCurrency(quote.total || 0)}</td>
                    <td><span class="quote-status ${quote.status}">${sanitizeHTML(quote.status || 'draft')}</span></td>
                    <td>${formatDate(quote.createdAt)}</td>
                    <td>
                        <button class="button secondary" onclick="window.editQuote('${quote.id}')">Edit</button>
                        <button class="button primary" onclick="window.viewQuote('${quote.id}')">View</button>
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
                <tr>
                    <td>${sanitizeHTML(priceList.name)}</td>
                    <td>${sanitizeHTML(priceList.version || '1.0')}</td>
                    <td>${sanitizeHTML(priceList.currency || 'GBP')}</td>
                    <td>${formatDate(priceList.date || priceList.createdAt)}</td>
                    <td>${priceList.isDefault ? 'Yes' : 'No'}</td>
                    <td><span class="pricelist-status ${priceList.status || 'active'}">${sanitizeHTML(priceList.status || 'active')}</span></td>
                    <td>
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
    displaySearchResults(results) { logDebug('Displaying search results...'); }
    showValidationErrors(form, errors) { 
        logDebug('Showing validation errors:', errors);
        uiModals.showToast(`Validation failed: ${errors.join(', ')}`, 'error');
    }
    
    async handleResourceSubmit(event) { 
        event.preventDefault();
        logDebug('Resource form submitted'); 
    }
    
    async handleQuoteSubmit(event) { 
        event.preventDefault();
        logDebug('Quote form submitted'); 
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    const app = new CRMApplication();
    
    // Make app globally available for debugging
    window.crmApp = app;
    
    // Expose navigation function globally for HTML onclick handlers
    window.showPage = (pageId) => app.navigateToPage(pageId);
    
    // Expose other essential functions for HTML onclick handlers
    window.showActivityModal = () => uiModals.openModal('activity-modal');
    window.showResourceModal = () => uiModals.openModal('resource-modal');
    window.showNewQuoteModal = () => uiModals.openModal('quote-modal');
    window.closeActivityModal = () => uiModals.closeModal('activity-modal');
    window.closeResourceModal = () => uiModals.closeModal('resource-modal');
    window.closeQuoteModal = () => uiModals.closeModal('quote-modal');
    
    // Add placeholder functions for other missing onclick handlers
    window.resetData = async () => {
        if (confirm('This will clear all data and reload sample data. Are you sure?')) {
            try {
                await db.clearAllStores();
                await app.loadSampleData();
                window.location.reload();
            } catch (error) {
                logError('Failed to reset data:', error);
                alert('Failed to reset data');
            }
        }
    };
    window.performGlobalSearch = () => console.log('Global search function placeholder');
    window.clearGlobalSearch = () => console.log('Clear search function placeholder');
    window.loadSampleData = async () => {
        try {
            await app.loadSampleData();
            window.location.reload();
        } catch (error) {
            logError('Failed to load sample data:', error);
            alert('Failed to load sample data');
        }
    };
    
    // Additional placeholder functions for missing onclick handlers
    window.editResource = (id) => console.log('Edit resource:', id);
    window.deleteResource = (id) => console.log('Delete resource:', id);
    window.editPC = (id) => console.log('Edit PC:', id);
    window.createQuote = (id) => console.log('Create quote for PC:', id);
    window.editQuote = (id) => console.log('Edit quote:', id);
    window.viewQuote = (id) => console.log('View quote:', id);
    window.createPriceList = () => console.log('Create price list');
    window.editPriceList = (id) => console.log('Edit price list:', id);
    window.viewPriceList = (id) => console.log('View price list:', id);
    window.editActivity = (id) => console.log('Edit activity:', id);
    window.deleteActivity = (id) => console.log('Delete activity:', id);
    
    // Start the application
    await app.initialize();
});

// Export for use in other modules
export { CRMApplication };