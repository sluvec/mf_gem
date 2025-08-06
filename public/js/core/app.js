/**
 * @fileoverview Core Application Class
 * @description Main application orchestrator with modular architecture
 */

import { logInfo, logError, logDebug } from '../utils.js';
import { db } from '../database.js';
import { uiModals } from '../ui-modals.js';
import { stateManager } from '../shared/state-manager.js';
import { errorHandler } from '../shared/error-handler.js';
import { formValidator } from '../shared/form-validator.js';
import { createMigrationManager } from '../migrations/data-migrations.js';
import { createPCNumberService } from '../domains/pc-numbers/pc-service.js';
import { createPCNumberController } from '../domains/pc-numbers/pc-controller.js';
import { createQuoteService } from '../domains/quotes/quote-service.js';
import { createQuoteController } from '../domains/quotes/quote-controller.js';
import { 
    APP_CONFIG, 
    UI_CONSTANTS, 
    PAGE_IDS, 
    ELEMENT_IDS,
    DEFAULT_USERS 
} from '../shared/constants.js';

/**
 * @description Main CRM Application Class
 */
export class CRMApplication {
    constructor() {
        this.initialized = false;
        this.currentPage = PAGE_IDS.DASHBOARD;
        this.currentUser = null;
        
        // Services
        this.migrationManager = null;
        this.pcService = null;
        this.quoteService = null;
        
        // Controllers
        this.pcController = null;
        this.quoteController = null;
        
        // Initialize state
        this.initializeState();
    }

    /**
     * @description Initialize application state
     */
    initializeState() {
        stateManager.setState('app.instance', this);
        stateManager.setState('app.initialized', false);
        stateManager.setState('app.currentPage', this.currentPage);
        stateManager.setState('app.currentUser', this.currentUser);
    }

    /**
     * @description Initialize the application
     */
    async initialize() {
        // Setup initialization timeout
        const initTimeout = setTimeout(() => {
            logError('Application initialization timed out');
            this.hideLoadingOverlay();
        }, APP_CONFIG.INIT_TIMEOUT);

        try {
            logInfo('🚀 Initializing CRM Application...');
            this.showLoadingOverlay('Initializing application...');
            
            // Initialize core systems
            this.updateProgress(20, 'Connecting to database...');
            await this.initializeDatabase();
            
            this.updateProgress(30, 'Setting up services...');
            await this.initializeServices();
            
            this.updateProgress(50, 'Setting up user interface...');
            await this.initializeUI();
            
            this.updateProgress(75, 'Setting up event listeners...');
            this.setupEventListeners();
            
            this.updateProgress(90, 'Finalizing setup...');
            await this.finalizeInitialization();
            
            this.updateProgress(100, 'Ready!');
            
            // Mark as initialized
            this.initialized = true;
            stateManager.setState('app.initialized', true);
            
            // Clear timeout and hide loading
            clearTimeout(initTimeout);
            setTimeout(() => this.hideLoadingOverlay(), 1000);
            
            logInfo('✅ CRM Application initialized successfully');
            
        } catch (error) {
            clearTimeout(initTimeout);
            errorHandler.handleError(error, 'Application Initialization');
            this.hideLoadingOverlay();
            throw error;
        }
    }

    /**
     * @description Initialize database and migrations
     */
    async initializeDatabase() {
        try {
            logDebug('🔵 Starting database initialization...');
            await db.initialize();
            
            // Initialize migration manager
            this.migrationManager = createMigrationManager(db);
            
            // Run any pending migrations
            logDebug('🔵 Running data migrations...');
            await this.migrationManager.runAllMigrations();
            
            // Load or create sample data
            await this.loadSampleDataIfNeeded();
            
            logDebug('🔵 Database initialization completed');
        } catch (error) {
            logError('Database initialization failed:', error);
            throw error;
        }
    }

    /**
     * @description Initialize services
     */
    async initializeServices() {
        try {
            // Initialize PC Numbers service
            this.pcService = createPCNumberService(db, this.migrationManager);
            
            // Initialize Quote service
            this.quoteService = createQuoteService(db, this.migrationManager);
            
            // Load initial data into state
            await this.loadInitialData();
            
            logDebug('Services initialized successfully');
        } catch (error) {
            logError('Services initialization failed:', error);
            throw error;
        }
    }

    /**
     * @description Initialize controllers
     */
    initializeControllers() {
        try {
            // Initialize PC Numbers controller
            this.pcController = createPCNumberController(this.pcService);
            
            // Initialize Quote controller  
            this.quoteController = createQuoteController(this.quoteService, this.pcService);
            
            // Make controllers globally accessible for backward compatibility
            window.pcController = this.pcController;
            window.quoteController = this.quoteController;
            
            logDebug('Controllers initialized successfully');
        } catch (error) {
            logError('Controllers initialization failed:', error);
            throw error;
        }
    }

    /**
     * @description Initialize UI components
     */
    async initializeUI() {
        try {
            // Initialize controllers
            this.initializeControllers();
            
            // Setup login system
            this.setupLoginSystem();
            
            // Setup navigation
            this.setupNavigation();
            
            // Initialize mobile menu
            this.initializeMobileMenu();
            
            logDebug('UI initialization completed');
        } catch (error) {
            logError('UI initialization failed:', error);
            throw error;
        }
    }

    /**
     * @description Load initial data into state
     */
    async loadInitialData() {
        try {
            // Load all PC Numbers
            await this.pcService.refreshPcNumbersList();
            
            // Load all Quotes
            await this.quoteService.refreshQuotesList();
            
            // Load companies for quote modal
            await this.quoteService.loadCompanies();
            
            logDebug('Initial data loaded');
        } catch (error) {
            logError('Failed to load initial data:', error);
        }
    }

    /**
     * @description Load sample data if database is empty
     */
    async loadSampleDataIfNeeded() {
        try {
            const stats = await db.getStats();
            const isEmpty = Object.values(stats).every(count => count === 0);
            
            if (isEmpty) {
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
     * @description Load sample data (simplified version)
     */
    async loadSampleData() {
        // This would contain a simplified version of the current loadSampleData function
        // For now, we'll delegate to the existing implementation
        logInfo('Loading sample data...');
        // TODO: Implement streamlined sample data loading
    }

    /**
     * @description Setup login system
     */
    setupLoginSystem() {
        try {
            // Setup default users
            const userSelect = document.getElementById('user-select');
            if (userSelect) {
                userSelect.innerHTML = '<option value="">Select User...</option>';
                
                DEFAULT_USERS.forEach(user => {
                    const option = document.createElement('option');
                    option.value = user.id;
                    option.textContent = `${user.emoji} ${user.name} (${user.role})`;
                    userSelect.appendChild(option);
                });
            }

            // Check for saved user
            const savedUser = localStorage.getItem('currentUser');
            if (savedUser && userSelect) {
                userSelect.value = savedUser;
                this.setCurrentUser(savedUser);
            } else {
                this.showLoginModal();
            }
        } catch (error) {
            logError('Failed to setup login system:', error);
        }
    }

    /**
     * @description Setup navigation system
     */
    setupNavigation() {
        try {
            // Setup page navigation
            const navItems = document.querySelectorAll('[data-page]');
            navItems.forEach(item => {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    const page = item.getAttribute('data-page');
                    this.navigateToPage(page);
                });
            });

            // Set initial page
            this.navigateToPage(this.currentPage);
        } catch (error) {
            logError('Failed to setup navigation:', error);
        }
    }

    /**
     * @description Setup event listeners
     */
    setupEventListeners() {
        try {
            // Global event listeners can be added here
            logDebug('Event listeners setup completed');
        } catch (error) {
            logError('Failed to setup event listeners:', error);
        }
    }

    /**
     * @description Finalize initialization
     */
    async finalizeInitialization() {
        try {
            // Any final setup tasks
            logDebug('Finalization completed');
        } catch (error) {
            logError('Failed to finalize initialization:', error);
        }
    }

    /**
     * @description Navigate to a page
     * @param {string} pageId - Page ID to navigate to
     */
    navigateToPage(pageId) {
        try {
            // Hide all pages
            const pages = document.querySelectorAll('.page');
            pages.forEach(page => page.style.display = 'none');

            // Show target page
            const targetPage = document.getElementById(pageId);
            if (targetPage) {
                targetPage.style.display = 'block';
                this.currentPage = pageId;
                stateManager.setState('app.currentPage', pageId);

                // Update navigation
                this.updateNavigationState(pageId);

                // Load page data
                this.loadPageData(pageId);

                logDebug(`Navigated to page: ${pageId}`);
            }
        } catch (error) {
            errorHandler.handleError(error, 'Page Navigation');
        }
    }

    /**
     * @description Update navigation state
     * @param {string} activePageId - Active page ID
     */
    updateNavigationState(activePageId) {
        const navItems = document.querySelectorAll('[data-page]');
        navItems.forEach(item => {
            const pageId = item.getAttribute('data-page');
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
                case PAGE_IDS.PC_NUMBERS:
                    await this.loadPcNumbersData();
                    break;
                case PAGE_IDS.QUOTES:
                    await this.loadQuotesData();
                    break;
                case PAGE_IDS.ACTIVITIES:
                    await this.loadActivitiesData();
                    break;
                case PAGE_IDS.RESOURCES:
                    await this.loadResourcesData();
                    break;
                case PAGE_IDS.PRICE_LISTS:
                    await this.loadPriceListsData();
                    break;
                case PAGE_IDS.DASHBOARD:
                default:
                    await this.loadDashboardData();
                    break;
            }
        } catch (error) {
            errorHandler.handleError(error, `Load ${pageId} Data`);
        }
    }

    /**
     * @description Load dashboard data
     */
    async loadDashboardData() {
        // TODO: Implement dashboard data loading
        logDebug('Loading dashboard data');
    }

    /**
     * @description Load PC Numbers data
     */
    async loadPcNumbersData() {
        // TODO: Implement PC Numbers page data loading
        logDebug('Loading PC Numbers data');
    }

    /**
     * @description Load Quotes data
     */
    async loadQuotesData() {
        // TODO: Implement Quotes page data loading
        logDebug('Loading Quotes data');
    }

    /**
     * @description Load Activities data
     */
    async loadActivitiesData() {
        // TODO: Implement Activities page data loading
        logDebug('Loading Activities data');
    }

    /**
     * @description Load Resources data
     */
    async loadResourcesData() {
        // TODO: Implement Resources page data loading
        logDebug('Loading Resources data');
    }

    /**
     * @description Load Price Lists data
     */
    async loadPriceListsData() {
        // TODO: Implement Price Lists page data loading
        logDebug('Loading Price Lists data');
    }

    /**
     * @description Set current user
     * @param {string} userId - User ID
     */
    setCurrentUser(userId) {
        const user = DEFAULT_USERS.find(u => u.id === userId);
        if (user) {
            this.currentUser = user;
            stateManager.setState('app.currentUser', user);
            localStorage.setItem('currentUser', userId);
            
            // Update UI
            const userDisplay = document.getElementById('current-user');
            if (userDisplay) {
                userDisplay.textContent = `${user.emoji} ${user.name}`;
            }
            
            logInfo(`User logged in: ${user.name}`);
        }
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
        const toggleButton = document.getElementById(ELEMENT_IDS.MOBILE_MENU_TOGGLE);
        const navigation = document.getElementById(ELEMENT_IDS.MAIN_NAVIGATION);
        
        if (toggleButton && navigation) {
            toggleButton.addEventListener('click', () => {
                const isOpen = stateManager.getState('ui.mobileMenuOpen', false);
                stateManager.setState('ui.mobileMenuOpen', !isOpen);
                
                if (!isOpen) {
                    navigation.classList.add('mobile-open');
                } else {
                    navigation.classList.remove('mobile-open');
                }
            });
        }
    }

    /**
     * @description Show loading overlay
     * @param {string} message - Loading message
     */
    showLoadingOverlay(message = 'Loading...') {
        const overlay = document.getElementById(ELEMENT_IDS.LOADING_OVERLAY);
        const text = document.getElementById(ELEMENT_IDS.PROGRESS_TEXT);
        
        if (overlay) {
            overlay.style.display = 'flex';
            overlay.classList.add('active');
            stateManager.setState('ui.loadingOverlay', true);
        }
        
        if (text) {
            text.textContent = message;
        }
    }

    /**
     * @description Hide loading overlay
     */
    hideLoadingOverlay() {
        const overlay = document.getElementById(ELEMENT_IDS.LOADING_OVERLAY);
        
        if (overlay) {
            overlay.style.display = 'none';
            overlay.classList.remove('active');
            stateManager.setState('ui.loadingOverlay', false);
        }
    }

    /**
     * @description Update progress bar
     * @param {number} percentage - Progress percentage (0-100)
     * @param {string} message - Progress message
     */
    updateProgress(percentage, message = '') {
        const progressBar = document.getElementById(ELEMENT_IDS.PROGRESS_BAR);
        const progressText = document.getElementById(ELEMENT_IDS.PROGRESS_TEXT);
        
        if (progressBar) {
            progressBar.style.width = `${percentage}%`;
        }
        
        if (progressText && message) {
            progressText.textContent = message;
        }
        
        logDebug(`Progress: ${percentage}% - ${message}`);
    }

    /**
     * @description Get application statistics
     * @returns {object} Application statistics
     */
    getStats() {
        return {
            initialized: this.initialized,
            currentPage: this.currentPage,
            currentUser: this.currentUser?.name || 'None',
            state: stateManager.getStats(),
            errors: errorHandler.getStats()
        };
    }
}

// Export the class
export default CRMApplication;