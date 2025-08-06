/**
 * @fileoverview CRM Application Entry Point
 * @description Streamlined main entry point using modular architecture
 */

import { logInfo, logError, logDebug } from './utils.js';
import CRMApplication from './core/app.js';
import { uiModals } from './ui-modals.js';
import { stateManager } from './shared/state-manager.js';
import { errorHandler } from './shared/error-handler.js';

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
 * @description These functions maintain backward compatibility with existing HTML
 */
function setupLegacyCompatibility() {
    // PC Numbers functions
    window.showNewPcModal = () => app.pcController?.showNewPcModal();
    window.editPC = (id) => app.pcController?.showEditPcModal(id);
    window.viewPcDetails = (id) => app.pcController?.viewPcDetails(id);
    window.deletePcNumber = (id) => app.pcController?.deletePcNumber(id);
    
    // Quote functions
    window.showNewQuoteModal = () => app.quoteController?.showNewQuoteModal();
    window.searchCompanies = (term) => app.quoteController?.searchCompanies(term);
    window.selectCompany = (name) => app.quoteController?.selectCompany(name);
    window.showCompanyDropdown = () => app.quoteController?.showCompanyDropdown();
    window.hideCompanyDropdown = () => app.quoteController?.hideCompanyDropdown();
    window.filterPcNumbersByCompany = (company) => app.quoteController?.filterPcNumbersByCompany(company);
    
    // Modal functions
    window.closeActivityModal = () => uiModals.closeModal('activity-modal');
    window.closeResourceModal = () => uiModals.closeModal('resource-modal');
    window.closePriceListModal = () => uiModals.closeModal('pricelist-modal');
    window.closeQuoteModal = () => app.quoteController?.closeQuoteModal();
    window.closePcModal = () => app.pcController?.closePcModal();
    window.closePcEditModal = () => app.pcController?.closePcEditModal();
    
    // Navigation functions
    window.navigateToPage = (page) => app.navigateToPage(page);
    window.showPage = (page) => app.navigateToPage(page); // Alternative name
    
    // Login functions
    window.handleLogin = (event) => {
        event.preventDefault();
        const userSelect = document.getElementById('user-select');
        const userId = userSelect?.value;
        
        if (userId) {
            app.setCurrentUser(userId);
            uiModals.closeModal('login-modal');
        } else {
            uiModals.showToast('Please select a user', 'error');
        }
    };
    
    // State access functions for debugging
    window.getAppState = () => stateManager.getSnapshot();
    window.getAppStats = () => app.getStats();
    window.getErrorStats = () => errorHandler.getStats();
    
    // Legacy data access (for backward compatibility)
    window.getCurrentPC = () => app.pcService?.getCurrentPcNumber();
    window.getAllPcNumbers = () => stateManager.getState('data.allPcNumbers', []);
    window.getAllQuotes = () => stateManager.getState('data.allQuotes', []);
    window.getAllCompanies = () => stateManager.getState('data.allCompanies', []);
    
    // Activity functions (placeholder for future implementation)
    window.showActivityModal = () => {
        // TODO: Implement activity modal
        logDebug('Activity modal requested - not yet implemented in new architecture');
        uiModals.openModal('activity-modal');
    };
    
    // Resource functions (placeholder for future implementation)  
    window.showResourceModal = () => {
        // TODO: Implement resource modal
        logDebug('Resource modal requested - not yet implemented in new architecture');
        uiModals.openModal('resource-modal');
    };
    
    // Price list functions (placeholder for future implementation)
    window.showPriceListModal = () => {
        // TODO: Implement price list modal
        logDebug('Price list modal requested - not yet implemented in new architecture');
        uiModals.openModal('pricelist-modal');
    };
    
    logDebug('Legacy compatibility functions setup completed');
}

/**
 * @description Handle user login
 * @param {Event} event - Form submit event
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
        errorHandler.handleError(error, 'User Login');
    }
};

/**
 * @description Handle mobile menu toggle
 */
window.toggleMobileMenu = () => {
    try {
        const navigation = document.getElementById('main-navigation');
        const isOpen = stateManager.getState('ui.mobileMenuOpen', false);
        
        stateManager.setState('ui.mobileMenuOpen', !isOpen);
        
        if (navigation) {
            if (!isOpen) {
                navigation.classList.add('mobile-open');
            } else {
                navigation.classList.remove('mobile-open');
            }
        }
    } catch (error) {
        errorHandler.handleError(error, 'Mobile Menu Toggle');
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