/**
 * @fileoverview PC Numbers Controller
 * @description Handles PC Numbers UI interactions and form management
 */

import { logDebug, logError } from '../../utils.js';
import { uiModals } from '../../ui-modals.js';
import { formValidator, FORM_CONFIGS } from '../../shared/form-validator.js';
import { stateManager } from '../../shared/state-manager.js';
import { handleError, wrapFormOperation } from '../../shared/error-handler.js';
import { SUCCESS_MESSAGES, ERROR_MESSAGES, ELEMENT_IDS, MODAL_IDS } from '../../shared/constants.js';

/**
 * @description PC Numbers controller for UI interactions
 */
export class PCNumberController {
    constructor(pcService) {
        this.pcService = pcService;
        this.setupEventListeners();
        this.registerFormValidation();
    }

    /**
     * @description Setup event listeners
     */
    setupEventListeners() {
        // Register form submission handlers
        this.handlePcNumberSubmit = wrapFormOperation(
            this.handlePcNumberSubmit.bind(this), 
            'PC Number Creation'
        );
        
        this.handlePcNumberUpdate = wrapFormOperation(
            this.handlePcNumberUpdate.bind(this), 
            'PC Number Update'
        );
    }

    /**
     * @description Register form validation
     */
    registerFormValidation() {
        formValidator.registerForm('new-pc', FORM_CONFIGS.PC_NUMBER);
        formValidator.registerForm('pc-edit-form', FORM_CONFIGS.PC_NUMBER);
    }

    /**
     * @description Show new PC Number modal
     */
    showNewPcModal() {
        try {
            // Clear form
            const form = document.getElementById('new-pc');
            if (form) {
                form.reset();
                formValidator.clearAllFieldErrors('new-pc');
            }

            // Set modal title
            const titleElement = document.getElementById('pc-modal-title');
            if (titleElement) {
                titleElement.textContent = 'New PC Number';
            }

            // Open modal
            uiModals.openModal('pc-modal');
            
            logDebug('New PC Number modal opened');
        } catch (error) {
            handleError(error, 'Show PC Number Modal');
        }
    }

    /**
     * @description Show edit PC Number modal
     * @param {string} id - PC Number ID
     */
    async showEditPcModal(id) {
        try {
            const pcData = await this.pcService.getById(id);
            if (!pcData) {
                uiModals.showToast(ERROR_MESSAGES.LOAD_FAILED, 'error');
                return;
            }

            // Set current PC Number
            this.pcService.setCurrentPcNumber(pcData);
            stateManager.setState('current.pc', pcData); // For backward compatibility

            // Set modal title
            const titleElement = document.getElementById('pc-edit-modal-title');
            if (titleElement) {
                titleElement.textContent = `Edit PC Number: ${pcData.pcNumber}`;
            }

            // Populate form fields
            this.populateEditForm(pcData);

            // Clear any existing validation errors
            formValidator.clearAllFieldErrors('pc-edit-form');

            // Open modal
            uiModals.openModal(MODAL_IDS.PC_EDIT);
            
            logDebug('Edit PC Number modal opened for:', pcData.pcNumber);
        } catch (error) {
            handleError(error, 'Show Edit PC Number Modal');
        }
    }

    /**
     * @description Populate edit form with PC Number data
     * @param {object} pcData - PC Number data
     */
    populateEditForm(pcData) {
        const fieldMappings = {
            'pc-edit-number': 'pcNumber',
            'pc-edit-project-name': 'projectTitle',
            'pc-edit-project-description': 'projectDescription',
            'pc-edit-company-name': 'clientName',
            'pc-edit-contact-name': 'contactName',
            'pc-edit-contact-email': 'contactEmail',
            'pc-edit-contact-phone': 'contactPhone',
            'pc-edit-account-manager': 'accountManager',
            'pc-edit-client-industry': 'industry',
            'pc-edit-client-source': 'source',
            'pc-edit-quote-limit': 'budgetRange',
            'pc-edit-postcode': 'postcode',
            'pc-edit-status': 'status'
        };

        Object.entries(fieldMappings).forEach(([fieldId, dataKey]) => {
            const field = document.getElementById(fieldId);
            if (field && pcData[dataKey] !== undefined) {
                field.value = pcData[dataKey] || '';
            }
        });

        // Handle additional fields that might be present
        const additionalFields = [
            'clientCategory', 'clientSource', 'referralType', 'surveyor', 'propertyType',
            'sicCode1', 'sicCode2', 'sicCode3',
            'collectionFirstName', 'collectionSurname', 'collectionTitle', 'collectionPosition',
            'collectionEmail', 'collectionPhone', 'collectionMobile', 'collectionCountry',
            'collectionPostcode', 'collectionAddress1', 'collectionAddress2', 'collectionAddress3',
            'collectionAddress4', 'collectionDate',
            'deliveryFirstName', 'deliverySurname', 'deliveryTitle', 'deliveryPosition',
            'deliveryEmail', 'deliveryPhone', 'deliveryMobile', 'deliveryCountry',
            'deliveryPostcode', 'deliveryAddress1', 'deliveryAddress2', 'deliveryAddress3',
            'deliveryAddress4', 'deliveryDate'
        ];

        additionalFields.forEach(fieldKey => {
            const field = document.getElementById(`pc-edit-${fieldKey.toLowerCase()}`);
            if (field && pcData[fieldKey] !== undefined) {
                field.value = pcData[fieldKey] || '';
            }
        });
    }

    /**
     * @description Handle PC Number form submission
     * @param {Event} event - Form submit event
     */
    async handlePcNumberSubmit(event) {
        event.preventDefault();
        
        try {
            // Validate form
            const validation = formValidator.validateForm('new-pc');
            if (!validation.isValid) {
                logDebug('PC Number form validation failed');
                return false;
            }

            // Collect form data
            const formData = this.collectFormData('new-pc');
            
            // Create PC Number
            const savedPc = await this.pcService.create(formData);
            
            // Show success message
            uiModals.showToast(SUCCESS_MESSAGES.SAVED, 'success');
            
            // Close modal
            uiModals.closeModal('pc-modal');
            
            // Refresh page if on PC Numbers view
            await this.refreshPageIfNeeded();
            
            logDebug(`PC Number created successfully: ${savedPc.pcNumber}`);
            return true;
        } catch (error) {
            handleError(error, 'PC Number Creation');
            return false;
        }
    }

    /**
     * @description Handle PC Number update form submission
     * @param {Event} event - Form submit event
     */
    async handlePcNumberUpdate(event) {
        event.preventDefault();
        
        try {
            // Validate form
            const validation = formValidator.validateForm('pc-edit-form');
            if (!validation.isValid) {
                logDebug('PC Number edit form validation failed');
                return false;
            }

            const currentPc = this.pcService.getCurrentPcNumber();
            if (!currentPc) {
                throw new Error('No PC Number selected for editing');
            }

            // Collect form data
            const formData = this.collectFormData('pc-edit-form', 'pc-edit-');
            
            // Update PC Number
            const updatedPc = await this.pcService.update(currentPc.id, formData);
            
            // Show success message
            uiModals.showToast(SUCCESS_MESSAGES.UPDATED, 'success');
            
            // Close modal
            uiModals.closeModal(MODAL_IDS.PC_EDIT);
            
            // Clear current PC
            this.pcService.clearCurrentPcNumber();
            
            // Refresh page if needed
            await this.refreshPageIfNeeded();
            
            logDebug(`PC Number updated successfully: ${updatedPc.pcNumber}`);
            return true;
        } catch (error) {
            handleError(error, 'PC Number Update');
            return false;
        }
    }

    /**
     * @description Collect form data from form
     * @param {string} formId - Form element ID
     * @param {string} prefix - Field ID prefix (for edit forms)
     * @returns {object} Collected form data
     */
    collectFormData(formId, prefix = 'pc-') {
        const form = document.getElementById(formId);
        if (!form) return {};

        const formData = {};
        const inputs = form.querySelectorAll('input, select, textarea');

        inputs.forEach(input => {
            if (input.id && input.id.startsWith(prefix)) {
                const fieldName = input.id.replace(prefix, '').replace(/-([a-z])/g, (g) => g[1].toUpperCase());
                
                if (input.type === 'checkbox') {
                    formData[fieldName] = input.checked;
                } else if (input.type === 'number') {
                    formData[fieldName] = input.value ? parseFloat(input.value) : null;
                } else {
                    formData[fieldName] = input.value || null;
                }
            }
        });

        return formData;
    }

    /**
     * @description View PC Number details
     * @param {string} id - PC Number ID
     */
    async viewPcDetails(id) {
        try {
            const pcData = await this.pcService.getById(id);
            if (!pcData) {
                uiModals.showToast(ERROR_MESSAGES.LOAD_FAILED, 'error');
                return;
            }

            // Set current PC Number
            this.pcService.setCurrentPcNumber(pcData);
            stateManager.setState('current.pc', pcData); // For backward compatibility

            // Navigate to PC detail page (assuming this exists)
            const app = stateManager.getState('app.instance');
            if (app && app.showPcDetail) {
                app.showPcDetail(id);
            }
            
            logDebug('Viewing PC Number details:', pcData.pcNumber);
        } catch (error) {
            handleError(error, 'View PC Number Details');
        }
    }

    /**
     * @description Delete PC Number
     * @param {string} id - PC Number ID
     */
    async deletePcNumber(id) {
        try {
            const pcData = await this.pcService.getById(id);
            if (!pcData) {
                uiModals.showToast(ERROR_MESSAGES.LOAD_FAILED, 'error');
                return;
            }

            const confirmed = confirm(`Are you sure you want to delete PC Number ${pcData.pcNumber}?`);
            if (!confirmed) return;

            const success = await this.pcService.delete(id);
            if (success) {
                uiModals.showToast(SUCCESS_MESSAGES.DELETED, 'success');
                await this.refreshPageIfNeeded();
                logDebug('PC Number deleted:', pcData.pcNumber);
            }
        } catch (error) {
            handleError(error, 'Delete PC Number');
        }
    }

    /**
     * @description Refresh page if currently viewing PC Numbers
     */
    async refreshPageIfNeeded() {
        const currentPage = stateManager.getState('app.currentPage');
        if (currentPage === 'pc-numbers') {
            const app = stateManager.getState('app.instance');
            if (app && app.loadPcNumbersData) {
                await app.loadPcNumbersData();
            }
        }
    }

    /**
     * @description Filter PC Numbers by company
     * @param {string} query - Search query
     */
    async filterByCompany(query) {
        try {
            const results = await this.pcService.search(query, 'company');
            this.updatePcNumbersList(results);
        } catch (error) {
            handleError(error, 'Filter PC Numbers by Company');
        }
    }

    /**
     * @description Filter PC Numbers by account manager
     * @param {string} query - Search query
     */
    async filterByAccountManager(query) {
        try {
            const results = await this.pcService.search(query, 'accountManager');
            this.updatePcNumbersList(results);
        } catch (error) {
            handleError(error, 'Filter PC Numbers by Account Manager');
        }
    }

    /**
     * @description Filter PC Numbers by PC Number
     * @param {string} query - Search query
     */
    async filterByPcNumber(query) {
        try {
            const results = await this.pcService.search(query, 'pcNumber');
            this.updatePcNumbersList(results);
        } catch (error) {
            handleError(error, 'Filter PC Numbers by PC Number');
        }
    }

    /**
     * @description Clear all filters
     */
    async clearFilters() {
        try {
            const allPcNumbers = stateManager.getState('original.pcNumbers', []);
            this.updatePcNumbersList(allPcNumbers);
        } catch (error) {
            handleError(error, 'Clear PC Numbers Filters');
        }
    }

    /**
     * @description Update PC Numbers list display
     * @param {array} pcNumbers - PC Numbers to display
     */
    updatePcNumbersList(pcNumbers) {
        stateManager.setState('data.allPcNumbers', pcNumbers);
        // Trigger UI update if needed
        const app = stateManager.getState('app.instance');
        if (app && app.renderPcNumbersList) {
            app.renderPcNumbersList(pcNumbers);
        }
    }

    /**
     * @description Close modals
     */
    closePcModal() {
        uiModals.closeModal('pc-modal');
    }

    closePcEditModal() {
        uiModals.closeModal(MODAL_IDS.PC_EDIT);
        this.pcService.clearCurrentPcNumber();
    }
}

// Export factory function
export const createPCNumberController = (pcService) => {
    return new PCNumberController(pcService);
};