/**
 * @fileoverview UI Modals management module
 * @description Handles modal windows, form interactions, and UI state management
 */

import { logDebug, logError, logInfo, sanitizeHTML, validateFormData } from './utils.js';

/**
 * @description Modal types constants
 */
export const MODAL_TYPES = {
    PC_NUMBER: 'pc-number-modal',
    ACTIVITY: 'activity-modal',
    QUOTE: 'quote-modal',
    RESOURCE: 'resource-modal',
    TEMPLATE: 'template-modal',
    QUICK_CREATE: 'quick-create-overlay'
};

/**
 * @description UI Modals class for managing modal operations
 */
export class UIModals {
    constructor() {
        this.activeModal = null;
        this.modalStack = [];
        this.isInitialized = false;
        this.escapeKeyHandler = this.handleEscapeKey.bind(this);
    }

    /**
     * @description Initialize modal system and event listeners
     */
    initialize() {
        if (this.isInitialized) return;

        this.setupEventListeners();
        this.isInitialized = true;
        logInfo('UI Modals system initialized');
    }

    /**
     * @description Set up global modal event listeners
     */
    setupEventListeners() {
        // Global escape key handler
        document.addEventListener('keydown', this.escapeKeyHandler);

        // Global click outside handler
        document.addEventListener('click', (event) => {
            if (this.activeModal && event.target.classList.contains('modal')) {
                this.closeModal(this.activeModal);
            }
        });

        // Close button handlers
        document.querySelectorAll('[data-modal-close]').forEach(button => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                const modalId = button.getAttribute('data-modal-close') || this.activeModal;
                this.closeModal(modalId);
            });
        });
    }

    /**
     * @description Handle escape key press
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleEscapeKey(event) {
        if (event.key === 'Escape' && this.activeModal) {
            event.preventDefault();
            this.closeModal(this.activeModal);
        }
    }

    /**
     * @description Open a modal
     * @param {string} modalId - Modal element ID
     * @param {Object} options - Modal options
     * @returns {Promise<void>}
     */
    async openModal(modalId, options = {}) {
        try {
            const modal = document.getElementById(modalId);
            if (!modal) {
                throw new Error(`Modal with ID ${modalId} not found`);
            }

            // Close existing modal if specified
            if (options.closeOthers && this.activeModal) {
                this.closeModal(this.activeModal);
            }

            // Add to modal stack
            this.modalStack.push(modalId);
            this.activeModal = modalId;

            // Apply modal-specific setup
            if (options.data) {
                this.populateModalData(modalId, options.data);
            }

            // Show modal
            modal.classList.add('active');
            document.body.style.overflow = 'hidden'; // Prevent background scroll

            // Focus management
            this.manageFocus(modal, true);

            // Trigger custom event
            this.triggerModalEvent('modal:opened', { modalId, options });

            logDebug('Modal opened:', modalId);
        } catch (error) {
            logError('Failed to open modal:', error);
            throw error;
        }
    }

    /**
     * @description Close a modal
     * @param {string} modalId - Modal element ID
     * @returns {Promise<void>}
     */
    async closeModal(modalId) {
        try {
            const modal = document.getElementById(modalId);
            if (!modal) {
                logWarning(`Modal with ID ${modalId} not found`);
                return;
            }

            // Remove from modal stack
            const index = this.modalStack.indexOf(modalId);
            if (index > -1) {
                this.modalStack.splice(index, 1);
            }

            // Update active modal
            this.activeModal = this.modalStack.length > 0 ? this.modalStack[this.modalStack.length - 1] : null;

            // Hide modal
            modal.classList.remove('active');
            
            // Restore background scroll if no modals are open
            if (!this.activeModal) {
                document.body.style.overflow = '';
            }

            // Focus management
            this.manageFocus(modal, false);

            // Clear form data if specified
            this.clearModalForm(modalId);

            // Trigger custom event
            this.triggerModalEvent('modal:closed', { modalId });

            logDebug('Modal closed:', modalId);
        } catch (error) {
            logError('Failed to close modal:', error);
            throw error;
        }
    }

    /**
     * @description Close all open modals
     */
    closeAllModals() {
        const modalsToClose = [...this.modalStack];
        modalsToClose.forEach(modalId => this.closeModal(modalId));
    }

    /**
     * @description Populate modal with data
     * @param {string} modalId - Modal element ID
     * @param {Object} data - Data to populate
     */
    populateModalData(modalId, data) {
        try {
            const modal = document.getElementById(modalId);
            if (!modal) return;

            // Populate form fields
            Object.entries(data).forEach(([key, value]) => {
                const field = modal.querySelector(`[name="${key}"], #${key}`);
                if (field) {
                    if (field.type === 'checkbox') {
                        field.checked = !!value;
                    } else if (field.type === 'radio') {
                        const radioButton = modal.querySelector(`[name="${key}"][value="${value}"]`);
                        if (radioButton) radioButton.checked = true;
                    } else if (field.tagName === 'SELECT') {
                        field.value = value;
                    } else {
                        field.value = value || '';
                    }
                }

                // Populate display elements
                const displayElement = modal.querySelector(`[data-field="${key}"]`);
                if (displayElement) {
                    displayElement.textContent = sanitizeHTML(String(value || ''));
                }
            });

            logDebug('Modal data populated:', modalId);
        } catch (error) {
            logError('Failed to populate modal data:', error);
        }
    }

    /**
     * @description Clear modal form data
     * @param {string} modalId - Modal element ID
     */
    clearModalForm(modalId) {
        try {
            const modal = document.getElementById(modalId);
            if (!modal) return;

            const form = modal.querySelector('form');
            if (form) {
                form.reset();
                
                // Clear validation errors
                modal.querySelectorAll('.input-error').forEach(input => {
                    input.classList.remove('input-error');
                });
                modal.querySelectorAll('.field-error').forEach(error => {
                    error.remove();
                });
            }

            logDebug('Modal form cleared:', modalId);
        } catch (error) {
            logError('Failed to clear modal form:', error);
        }
    }

    /**
     * @description Manage focus for accessibility
     * @param {HTMLElement} modal - Modal element
     * @param {boolean} isOpening - Whether modal is opening or closing
     */
    manageFocus(modal, isOpening) {
        try {
            if (isOpening) {
                // Store the currently focused element
                modal.dataset.previousFocus = document.activeElement?.id || '';
                
                // Focus first focusable element in modal
                const focusableElements = modal.querySelectorAll(
                    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
                );
                
                if (focusableElements.length > 0) {
                    focusableElements[0].focus();
                }
            } else {
                // Restore focus to previous element
                const previousFocusId = modal.dataset.previousFocus;
                if (previousFocusId) {
                    const previousElement = document.getElementById(previousFocusId);
                    if (previousElement) {
                        previousElement.focus();
                    }
                }
            }
        } catch (error) {
            logError('Failed to manage focus:', error);
        }
    }

    /**
     * @description Validate modal form
     * @param {string} modalId - Modal element ID
     * @param {Object} validationRules - Validation rules
     * @returns {Object} Validation result
     */
    validateModalForm(modalId, validationRules) {
        try {
            const modal = document.getElementById(modalId);
            if (!modal) {
                throw new Error(`Modal with ID ${modalId} not found`);
            }

            const form = modal.querySelector('form');
            if (!form) {
                throw new Error('No form found in modal');
            }

            // Collect form data
            const formData = new FormData(form);
            const data = Object.fromEntries(formData);

            // Validate data
            const validation = validateFormData(data, validationRules);

            // Display validation errors
            this.displayValidationErrors(modal, validation.errors);

            return validation;
        } catch (error) {
            logError('Failed to validate modal form:', error);
            return { isValid: false, errors: [error.message] };
        }
    }

    /**
     * @description Display validation errors in modal
     * @param {HTMLElement} modal - Modal element
     * @param {Array} errors - Array of error messages
     */
    displayValidationErrors(modal, errors) {
        try {
            // Clear existing errors
            modal.querySelectorAll('.input-error').forEach(input => {
                input.classList.remove('input-error');
            });
            modal.querySelectorAll('.field-error').forEach(error => {
                error.remove();
            });

            // Display new errors
            errors.forEach(error => {
                const [fieldName] = error.split(' ');
                const field = modal.querySelector(`[name="${fieldName}"]`);
                
                if (field) {
                    field.classList.add('input-error');
                    
                    // Add error message
                    const errorElement = document.createElement('div');
                    errorElement.className = 'field-error';
                    errorElement.textContent = error;
                    errorElement.style.color = 'var(--error-600)';
                    errorElement.style.fontSize = '0.75rem';
                    errorElement.style.marginTop = '0.25rem';
                    
                    field.parentNode.appendChild(errorElement);
                }
            });

            // Focus first error field
            const firstErrorField = modal.querySelector('.input-error');
            if (firstErrorField) {
                firstErrorField.focus();
            }
        } catch (error) {
            logError('Failed to display validation errors:', error);
        }
    }

    /**
     * @description Get form data from modal
     * @param {string} modalId - Modal element ID
     * @returns {Object} Form data object
     */
    getModalFormData(modalId) {
        try {
            const modal = document.getElementById(modalId);
            if (!modal) {
                throw new Error(`Modal with ID ${modalId} not found`);
            }

            const form = modal.querySelector('form');
            if (!form) {
                throw new Error('No form found in modal');
            }

            const formData = new FormData(form);
            const data = {};

            // Convert FormData to regular object
            for (const [key, value] of formData.entries()) {
                if (data[key]) {
                    // Handle multiple values (checkboxes, etc.)
                    if (Array.isArray(data[key])) {
                        data[key].push(value);
                    } else {
                        data[key] = [data[key], value];
                    }
                } else {
                    data[key] = value;
                }
            }

            // Handle unchecked checkboxes
            form.querySelectorAll('input[type="checkbox"]:not(:checked)').forEach(checkbox => {
                if (!data.hasOwnProperty(checkbox.name)) {
                    data[checkbox.name] = false;
                }
            });

            return data;
        } catch (error) {
            logError('Failed to get modal form data:', error);
            return {};
        }
    }

    /**
     * @description Set loading state for modal
     * @param {string} modalId - Modal element ID
     * @param {boolean} isLoading - Loading state
     * @param {string} message - Loading message
     */
    setModalLoading(modalId, isLoading, message = 'Loading...') {
        try {
            const modal = document.getElementById(modalId);
            if (!modal) return;

            const buttons = modal.querySelectorAll('button[type="submit"], .btn-primary');
            const form = modal.querySelector('form');

            if (isLoading) {
                // Disable form and buttons
                if (form) form.style.pointerEvents = 'none';
                buttons.forEach(button => {
                    button.disabled = true;
                    button.classList.add('btn-loading');
                    if (button.querySelector('.btn-text')) {
                        button.querySelector('.btn-text').textContent = message;
                    }
                });
            } else {
                // Re-enable form and buttons
                if (form) form.style.pointerEvents = '';
                buttons.forEach(button => {
                    button.disabled = false;
                    button.classList.remove('btn-loading');
                });
            }
        } catch (error) {
            logError('Failed to set modal loading state:', error);
        }
    }

    /**
     * @description Trigger custom modal event
     * @param {string} eventName - Event name
     * @param {Object} detail - Event detail data
     */
    triggerModalEvent(eventName, detail) {
        try {
            const event = new CustomEvent(eventName, { detail });
            document.dispatchEvent(event);
        } catch (error) {
            logError('Failed to trigger modal event:', error);
        }
    }

    /**
     * @description Show confirmation dialog
     * @param {string} message - Confirmation message
     * @param {string} title - Dialog title
     * @returns {Promise<boolean>} User confirmation result
     */
    async showConfirmation(message, title = 'Confirm Action') {
        return new Promise((resolve) => {
            const confirmationHTML = `
                <div class="modal active" id="confirmation-modal">
                    <div class="modal-content" style="max-width: 400px;">
                        <h3>${sanitizeHTML(title)}</h3>
                        <p style="margin: 1rem 0;">${sanitizeHTML(message)}</p>
                        <div class="form-actions">
                            <button type="button" class="secondary" data-action="cancel">Cancel</button>
                            <button type="button" class="danger" data-action="confirm">Confirm</button>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', confirmationHTML);
            const modal = document.getElementById('confirmation-modal');

            const cleanup = () => {
                modal.remove();
                document.body.style.overflow = '';
            };

            modal.querySelector('[data-action="confirm"]').addEventListener('click', () => {
                cleanup();
                resolve(true);
            });

            modal.querySelector('[data-action="cancel"]').addEventListener('click', () => {
                cleanup();
                resolve(false);
            });

            modal.addEventListener('click', (event) => {
                if (event.target === modal) {
                    cleanup();
                    resolve(false);
                }
            });

            document.body.style.overflow = 'hidden';
            modal.querySelector('[data-action="confirm"]').focus();
        });
    }

    /**
     * @description Show toast notification
     * @param {string} message - Toast message
     * @param {string} type - Toast type (success, error, warning, info)
     * @param {number} duration - Toast duration in milliseconds
     */
    showToast(message, type = 'info', duration = 3000) {
        try {
            let container = document.getElementById('toast-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'toast-container';
                container.className = 'toast-container';
                document.body.appendChild(container);
            }

            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.innerHTML = `
                <div class="toast-header">
                    <div class="toast-content">
                        <div class="toast-message">${sanitizeHTML(message)}</div>
                    </div>
                    <button class="toast-close" aria-label="Close notification">×</button>
                </div>
            `;

            container.appendChild(toast);

            // Auto-remove after duration
            const timeout = setTimeout(() => {
                this.removeToast(toast);
            }, duration);

            // Manual close
            toast.querySelector('.toast-close').addEventListener('click', () => {
                clearTimeout(timeout);
                this.removeToast(toast);
            });

            logDebug('Toast shown:', message, type);
        } catch (error) {
            logError('Failed to show toast:', error);
        }
    }

    /**
     * @description Remove toast notification
     * @param {HTMLElement} toast - Toast element
     */
    removeToast(toast) {
        try {
            toast.style.animation = 'toast-slide-out 0.3s ease-out forwards';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        } catch (error) {
            logError('Failed to remove toast:', error);
        }
    }
}

// Create global UI modals instance
export const uiModals = new UIModals();