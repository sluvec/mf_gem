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
    window.editPriceList = (id) => console.log('Edit price list:', id);
    window.viewPriceList = (id) => console.log('View price list:', id);
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