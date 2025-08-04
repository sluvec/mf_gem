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
            // Collect data directly from form elements using IDs
            const pcNumberData = {
                pcNumber: document.getElementById('pc-number').value,
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
                status: document.getElementById('pc-status').value || 'draft',
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Basic validation
            if (!pcNumberData.pcNumber || !pcNumberData.projectTitle || !pcNumberData.clientName || !pcNumberData.contactName || !pcNumberData.accountManager) {
                uiModals.showToast('Please fill in all required fields', 'error');
                return;
            }

            // Validate PC Number format
            const pcNumberPattern = /^PC-\d{6}$/;
            if (!pcNumberPattern.test(pcNumberData.pcNumber)) {
                uiModals.showToast('PC Number must be in format PC-000001', 'error');
                return;
            }

            // Validate contact information (at least phone or email)
            if (!pcNumberData.contactPhone && !pcNumberData.contactEmail) {
                uiModals.showToast('Please provide at least phone or email for contact', 'error');
                return;
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
                pcNumber: document.getElementById('pc-edit-number').value,
                company: document.getElementById('pc-edit-company').value,
                clientName: document.getElementById('pc-edit-company').value, // Keep both for compatibility
                projectTitle: document.getElementById('pc-edit-title').value,
                projectDescription: document.getElementById('pc-edit-description').value,
                reference: document.getElementById('pc-edit-reference').value,
                contactName: document.getElementById('pc-edit-contact').value,
                estimatedValue: parseFloat(document.getElementById('pc-edit-value').value) || 0,
                status: document.getElementById('pc-edit-status').value,
                updatedAt: new Date()
            };

            // Validation
            if (!updatedData.pcNumber || !updatedData.company || !updatedData.projectTitle || !updatedData.projectDescription) {
                uiModals.showToast('Please fill in all required fields', 'error');
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
                pcId: document.getElementById('activity-pc-select').value,
                scheduledDate: document.getElementById('activity-scheduled-date').value,
                scheduledTime: document.getElementById('activity-scheduled-time').value,
                duration: parseInt(document.getElementById('activity-duration').value) || 60,
                priority: document.getElementById('activity-priority').value,
                status: document.getElementById('activity-status').value,
                assignedTo: document.getElementById('activity-assigned-to-name').value,
                location: document.getElementById('activity-location').value,
                contactName: document.getElementById('activity-contact-name').value,
                contactPhone: document.getElementById('activity-contact-phone').value
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
     * @description Load sample data for demo purposes
     */
    async loadSampleData() {
        try {
            logInfo('Loading sample data...');
            
            // Sample PC Numbers - UK Office Relocations
            const samplePCNumbers = [
                {
                    pcNumber: 'PC-2024-001',
                    company: 'Fintech Innovations Ltd',
                    reference: 'City to Canary Wharf Move',
                    projectTitle: 'Complete Office Relocation - City to Canary Wharf',
                    projectDescription: 'Full office relocation for 85 staff from City of London to new Canary Wharf headquarters including IT infrastructure and secure document handling',
                    clientName: 'Fintech Innovations Ltd',
                    contactName: 'James Morrison',
                    estimatedValue: 45000,
                    status: 'active',
                    date: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000) // 12 days ago
                },
                {
                    pcNumber: 'PC-2024-002', 
                    company: 'Chambers & Associates',
                    reference: 'Law Firm Expansion Move',
                    projectTitle: 'Barrister Chambers Relocation',
                    projectDescription: 'Prestigious law chambers moving from Lincoln\'s Inn to larger premises in Temple with specialist library and archive handling',
                    clientName: 'Chambers & Associates',
                    contactName: 'Patricia Whitfield QC',
                    estimatedValue: 32000,
                    status: 'active',
                    date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) // 8 days ago
                },
                {
                    pcNumber: 'PC-2024-003',
                    company: 'TechStart Solutions',
                    reference: 'Emergency Relocation',
                    projectTitle: 'Emergency Office Move - Lease Termination',
                    projectDescription: 'Urgent relocation of startup office due to unexpected lease termination, 25 staff, minimal downtime required',
                    clientName: 'TechStart Solutions',
                    contactName: 'David Chen',
                    estimatedValue: 18500,
                    status: 'urgent',
                    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
                },
                {
                    pcNumber: 'PC-2024-004',
                    company: 'Industrial Manufacturing UK',
                    reference: 'Head Office Consolidation',
                    projectTitle: 'Manufacturing HQ Office Consolidation',
                    projectDescription: 'Consolidating three satellite offices into new Birmingham headquarters, heavy equipment and machinery documentation',
                    clientName: 'Industrial Manufacturing UK',
                    contactName: 'Robert Stevens',
                    estimatedValue: 67500,
                    status: 'active',
                    date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000) // 20 days ago
                },
                {
                    pcNumber: 'PC-2024-005',
                    company: 'Creative Media Agency',
                    reference: 'Studio Relocation',
                    projectTitle: 'Creative Studio & Office Move',
                    projectDescription: 'Moving creative agency with production studios, expensive AV equipment, and client presentation suites from Shoreditch to King\'s Cross',
                    clientName: 'Creative Media Agency',
                    contactName: 'Sophie Martinez',
                    estimatedValue: 28750,
                    status: 'completed',
                    date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000) // 45 days ago
                },
                {
                    pcNumber: 'PC-2024-006',
                    company: 'Global Consulting Partners',
                    reference: 'Multi-Floor Corporate Move',
                    projectTitle: 'Large Corporate Office Relocation',
                    projectDescription: 'Major consulting firm relocating 200+ staff across 4 floors, executive suites, multiple conference rooms, and data centre',
                    clientName: 'Global Consulting Partners',
                    contactName: 'Michael Thompson',
                    estimatedValue: 125000,
                    status: 'active',
                    date: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000) // 35 days ago
                },
                {
                    pcNumber: 'PC-2024-007',
                    company: 'Boutique Investments Ltd',
                    reference: 'Mayfair Office Setup',
                    projectTitle: 'Premium Investment Office Fitout',
                    projectDescription: 'High-end investment firm establishing prestigious Mayfair office, white-glove service required for antique furniture and artwork',
                    clientName: 'Boutique Investments Ltd',
                    contactName: 'Lady Catherine Worthington',
                    estimatedValue: 85000,
                    status: 'draft',
                    date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
                },
                {
                    pcNumber: 'PC-2024-008',
                    company: 'NHS Trust Admin',
                    reference: 'Healthcare Admin Relocation',
                    projectTitle: 'NHS Administrative Office Move',
                    projectDescription: 'NHS Trust relocating administrative offices with strict security requirements for patient data and medical records',
                    clientName: 'NHS Trust Admin',
                    contactName: 'Dr. Sarah Williams',
                    estimatedValue: 22500,
                    status: 'active',
                    date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) // 15 days ago
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
                // PC-2024-001 - Fintech Move
                {
                    title: 'Site Survey - Canary Wharf Office',
                    description: 'Comprehensive site assessment of new Canary Wharf headquarters, measuring rooms, elevator access, and IT infrastructure requirements',
                    type: 'Survey',
                    pcNumber: 'PC-2024-001',
                    scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // Day after tomorrow
                    scheduledTime: '09:00',
                    duration: 180,
                    status: 'pending',
                    priority: 'high',
                    assignedTo: 'Marcus Thompson',
                    location: '25 Canada Square, Canary Wharf, London E14 5LQ',
                    contactName: 'James Morrison',
                    contactPhone: '020 7946 0958'
                },
                {
                    title: 'IT Infrastructure Disconnection',
                    description: 'Safely disconnect and pack server equipment, workstations, and telecom systems at City office',
                    type: 'IT Services',
                    pcNumber: 'PC-2024-001',
                    scheduledDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
                    scheduledTime: '07:00',
                    duration: 360,
                    status: 'pending',
                    priority: 'high',
                    assignedTo: 'IT Specialist Team',
                    location: '14 Old Broad Street, City of London, EC2N 1DL'
                },
                
                // PC-2024-002 - Law Chambers
                {
                    title: 'Legal Archive Boxing',
                    description: 'Specialist packing of confidential legal documents, case files, and law library books with chain of custody documentation',
                    type: 'Packing',
                    pcNumber: 'PC-2024-002',
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
                
                // PC-2024-003 - Emergency Move
                {
                    title: 'Emergency Packing Service',
                    description: 'Rapid response packing of startup office, priority on IT equipment and essential documents',
                    type: 'Emergency',
                    pcNumber: 'PC-2024-003',
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
                
                // PC-2024-005 - Creative Agency (Completed)
                {
                    title: 'AV Equipment Setup - Completed',
                    description: 'Successfully installed expensive audio-visual equipment and production studio setup at new King\'s Cross location',
                    type: 'Installation',
                    pcNumber: 'PC-2024-005',
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
                
                // PC-2024-006 - Large Corporate
                {
                    title: 'Executive Floor Planning',
                    description: 'Detailed planning for executive suite relocation including boardrooms, private offices, and secure areas',
                    type: 'Planning',
                    pcNumber: 'PC-2024-006',
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
                
                // PC-2024-008 - NHS Trust
                {
                    title: 'Secure Data Transport Planning',
                    description: 'Security compliance planning for NHS patient data and medical records transport with GDPR requirements',
                    type: 'Compliance',
                    pcNumber: 'PC-2024-008',
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
                    pcNumber: 'PC-2024-001',
                    clientName: 'Fintech Innovations Ltd',
                    projectTitle: 'Complete Office Relocation - City to Canary Wharf',
                    value: 47500.00,
                    status: 'pending',
                    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                    description: 'Full office relocation for 85 staff including IT infrastructure, secure document handling, and executive furniture',
                    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
                },
                {
                    quoteNumber: 'QT-2024-002',
                    pcNumber: 'PC-2024-002',
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
                    pcNumber: 'PC-2024-003',
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
                    pcNumber: 'PC-2024-004',
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
                    pcNumber: 'PC-2024-005',
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
                    pcNumber: 'PC-2024-006',
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
                    pcNumber: 'PC-2024-007',
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
                    pcNumber: 'PC-2024-008',
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
                    pcNumber: 'PC-2024-001',
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
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    const app = new CRMApplication();
    
    // Make app globally available for debugging
    window.crmApp = app;
    
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
            
            // Populate modal fields
            document.getElementById('pc-edit-id').value = pcData.id;
            document.getElementById('pc-edit-number').value = pcData.pcNumber || '';
            document.getElementById('pc-edit-company').value = pcData.company || pcData.clientName || '';
            document.getElementById('pc-edit-title').value = pcData.projectTitle || '';
            document.getElementById('pc-edit-description').value = pcData.projectDescription || '';
            document.getElementById('pc-edit-reference').value = pcData.reference || '';
            document.getElementById('pc-edit-contact').value = pcData.contactName || '';
            document.getElementById('pc-edit-value').value = pcData.estimatedValue || '';
            document.getElementById('pc-edit-status').value = pcData.status || 'active';
            
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
    window.createQuote = (id) => console.log('Create quote for PC:', id);
    window.editQuote = (id) => console.log('Edit quote:', id);
    window.viewQuote = (id) => console.log('View quote:', id);
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
    window.viewPriceList = (id) => console.log('View price list:', id);
    
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
    window.deleteActivity = (id) => console.log('Delete activity:', id);
    
    // PHASE 2: Search-related placeholder functions (for modal compatibility)
    window.filterResources = () => logDebug('filterResources: Search functionality removed');
    window.filterActivityResourceSelector = () => logDebug('filterActivityResourceSelector: Search functionality removed');
    window.filterDependencySelector = () => logDebug('filterDependencySelector: Search functionality removed');
    
    // Start the application
    await app.initialize();
});

// Export for use in other modules
export { CRMApplication };