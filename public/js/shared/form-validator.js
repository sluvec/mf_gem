/**
 * @fileoverview Form Validation System
 * @description Centralized form validation with error highlighting and messaging
 */

import { logDebug, logWarning } from '../utils.js';
import { VALIDATION_MESSAGES, CSS_CLASSES } from './constants.js';

/**
 * @description Centralized form validation system
 */
export class FormValidator {
    constructor() {
        this.validationConfigs = new Map();
        this.customValidators = new Map();
        this.activeValidations = new Set();
        
        // Register default validators
        this.registerDefaultValidators();
    }

    /**
     * @description Register default validation functions
     */
    registerDefaultValidators() {
        this.customValidators.set('required', (value) => {
            return value && value.toString().trim().length > 0;
        });

        this.customValidators.set('email', (value) => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return !value || emailRegex.test(value);
        });

        this.customValidators.set('phone', (value) => {
            const phoneRegex = /^[\d\s\-\+\(\)]{10,}$/;
            return !value || phoneRegex.test(value);
        });

        this.customValidators.set('number', (value) => {
            return !value || !isNaN(parseFloat(value));
        });

        this.customValidators.set('date', (value) => {
            return !value || !isNaN(Date.parse(value));
        });

        this.customValidators.set('minLength', (value, minLength) => {
            return !value || value.toString().length >= minLength;
        });

        this.customValidators.set('maxLength', (value, maxLength) => {
            return !value || value.toString().length <= maxLength;
        });
    }

    /**
     * @description Register a form with validation configuration
     * @param {string} formId - Form element ID
     * @param {object} config - Validation configuration
     */
    registerForm(formId, config) {
        this.validationConfigs.set(formId, config);
        this.setupRealTimeValidation(formId, config);
        logDebug(`Form registered for validation: ${formId}`);
    }

    /**
     * @description Setup real-time validation for form fields
     * @param {string} formId - Form element ID
     * @param {object} config - Validation configuration
     */
    setupRealTimeValidation(formId, config) {
        const form = document.getElementById(formId);
        if (!form) return;

        Object.keys(config).forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                // Clear errors when user starts typing
                field.addEventListener('input', () => {
                    this.clearFieldError(fieldId);
                });

                field.addEventListener('blur', () => {
                    this.validateField(fieldId, config[fieldId]);
                });
            }
        });
    }

    /**
     * @description Validate a single field
     * @param {string} fieldId - Field element ID
     * @param {object} rules - Validation rules for the field
     * @returns {boolean} True if valid
     */
    validateField(fieldId, rules) {
        const field = document.getElementById(fieldId);
        if (!field) return true;

        const value = field.value;
        const errors = [];

        // Check each validation rule
        for (const [rule, param] of Object.entries(rules)) {
            if (rule === 'message') continue; // Skip custom message

            const validator = this.customValidators.get(rule);
            if (validator) {
                const isValid = typeof param === 'boolean' 
                    ? (param ? validator(value) : true)
                    : validator(value, param);

                if (!isValid) {
                    const message = rules.message || this.getDefaultMessage(rule, param);
                    errors.push(message);
                    break; // Stop at first error
                }
            }
        }

        if (errors.length > 0) {
            this.showFieldError(fieldId, errors[0]);
            return false;
        } else {
            this.clearFieldError(fieldId);
            return true;
        }
    }

    /**
     * @description Validate entire form
     * @param {string} formId - Form element ID
     * @param {object} customConfig - Optional custom validation config
     * @returns {object} Validation result with isValid and errors
     */
    validateForm(formId, customConfig = null) {
        const config = customConfig || this.validationConfigs.get(formId) || this.detectRequiredFields(formId);
        const errors = [];
        let isValid = true;

        // Clear any existing validation summary
        this.clearFormValidationSummary(formId);

        // Validate each field
        Object.keys(config).forEach(fieldId => {
            const fieldValid = this.validateField(fieldId, config[fieldId]);
            if (!fieldValid) {
                isValid = false;
                const field = document.getElementById(fieldId);
                const label = this.getFieldLabel(field);
                errors.push({
                    fieldId,
                    label,
                    message: this.getFieldErrorMessage(fieldId)
                });
            }
        });

        // Show validation summary if there are errors
        if (!isValid) {
            this.showFormValidationSummary(formId, errors);
        }

        logDebug(`Form validation ${formId}:`, { isValid, errorCount: errors.length });

        return {
            isValid,
            errors,
            errorCount: errors.length
        };
    }

    /**
     * @description Auto-detect required fields in a form
     * @param {string} formId - Form element ID
     * @returns {object} Detected validation configuration
     */
    detectRequiredFields(formId) {
        const form = document.getElementById(formId);
        if (!form) return {};

        const config = {};
        const fields = form.querySelectorAll('input, select, textarea');

        fields.forEach(field => {
            const fieldId = field.id;
            if (!fieldId) return;

            const rules = {};

            // Check for required attribute
            if (field.hasAttribute('required')) {
                rules.required = true;
            }

            // Check for asterisk in label
            const label = this.getFieldLabel(field);
            if (label && label.includes('*')) {
                rules.required = true;
            }

            // Add type-specific validation
            if (field.type === 'email') {
                rules.email = true;
            } else if (field.type === 'tel') {
                rules.phone = true;
            } else if (field.type === 'number') {
                rules.number = true;
            } else if (field.type === 'date') {
                rules.date = true;
            }

            // Add length validation if maxlength is set
            if (field.maxLength && field.maxLength > 0) {
                rules.maxLength = field.maxLength;
            }

            if (Object.keys(rules).length > 0) {
                config[fieldId] = rules;
            }
        });

        logDebug(`Auto-detected validation config for ${formId}:`, config);
        return config;
    }

    /**
     * @description Get field label text
     * @param {HTMLElement} element - Form field element
     * @returns {string} Label text
     */
    getFieldLabel(element) {
        if (!element) return '';

        // Try to find associated label
        let label = null;
        
        if (element.id) {
            label = document.querySelector(`label[for="${element.id}"]`);
        }
        
        if (!label) {
            label = element.closest('label');
        }
        
        if (!label) {
            const wrapper = element.closest('.form-group, .field-group, .input-group');
            if (wrapper) {
                label = wrapper.querySelector('label');
            }
        }

        if (label) {
            return label.textContent.replace('*', '').trim();
        }

        return element.placeholder || element.name || 'Field';
    }

    /**
     * @description Show field validation error
     * @param {string} fieldId - Field element ID
     * @param {string} message - Error message
     */
    showFieldError(fieldId, message) {
        const field = document.getElementById(fieldId);
        if (!field) return;

        // Add error class to field
        field.classList.add(CSS_CLASSES.FIELD_ERROR);

        // Remove existing error message
        this.clearFieldError(fieldId);

        // Create error message element
        const errorElement = document.createElement('div');
        errorElement.className = CSS_CLASSES.FIELD_ERROR_MESSAGE;
        errorElement.textContent = message;
        errorElement.id = `${fieldId}-error`;

        // Insert error message after field
        field.parentNode.insertBefore(errorElement, field.nextSibling);

        logDebug(`Field error shown: ${fieldId}`, message);
    }

    /**
     * @description Clear field validation error
     * @param {string} fieldId - Field element ID
     */
    clearFieldError(fieldId) {
        const field = document.getElementById(fieldId);
        if (field) {
            field.classList.remove(CSS_CLASSES.FIELD_ERROR);
        }

        const errorElement = document.getElementById(`${fieldId}-error`);
        if (errorElement) {
            errorElement.remove();
        }
    }

    /**
     * @description Clear all field errors in a form
     * @param {string} formId - Form element ID
     */
    clearAllFieldErrors(formId) {
        const form = document.getElementById(formId);
        if (!form) return;

        // Remove error classes from fields
        const errorFields = form.querySelectorAll(`.${CSS_CLASSES.FIELD_ERROR}`);
        errorFields.forEach(field => {
            field.classList.remove(CSS_CLASSES.FIELD_ERROR);
        });

        // Remove error messages
        const errorMessages = form.querySelectorAll(`.${CSS_CLASSES.FIELD_ERROR_MESSAGE}`);
        errorMessages.forEach(message => {
            message.remove();
        });

        logDebug(`All field errors cleared for form: ${formId}`);
    }

    /**
     * @description Show form validation summary
     * @param {string} formId - Form element ID
     * @param {array} errors - Array of error objects
     */
    showFormValidationSummary(formId, errors) {
        if (!errors.length) return;

        const form = document.getElementById(formId);
        if (!form) return;

        // Create summary container
        const summaryId = `${formId}-validation-summary`;
        let summary = document.getElementById(summaryId);
        
        if (!summary) {
            summary = document.createElement('div');
            summary.id = summaryId;
            summary.className = CSS_CLASSES.FORM_VALIDATION_SUMMARY;
            form.insertBefore(summary, form.firstChild);
        }

        // Create summary content
        const title = document.createElement('h4');
        title.textContent = 'Please correct the following errors:';
        
        const list = document.createElement('ul');
        errors.forEach(error => {
            const item = document.createElement('li');
            item.innerHTML = `<strong>${error.label}:</strong> ${error.message}`;
            
            // Make error clickable to focus field
            item.style.cursor = 'pointer';
            item.addEventListener('click', () => {
                const field = document.getElementById(error.fieldId);
                if (field) {
                    field.focus();
                    field.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
            
            list.appendChild(item);
        });

        summary.innerHTML = '';
        summary.appendChild(title);
        summary.appendChild(list);

        // Scroll to summary
        summary.scrollIntoView({ behavior: 'smooth', block: 'center' });

        logDebug(`Validation summary shown for ${formId} with ${errors.length} errors`);
    }

    /**
     * @description Clear form validation summary
     * @param {string} formId - Form element ID
     */
    clearFormValidationSummary(formId) {
        const summaryId = `${formId}-validation-summary`;
        const summary = document.getElementById(summaryId);
        if (summary) {
            summary.remove();
        }
    }

    /**
     * @description Get field error message
     * @param {string} fieldId - Field element ID
     * @returns {string} Error message
     */
    getFieldErrorMessage(fieldId) {
        const errorElement = document.getElementById(`${fieldId}-error`);
        return errorElement ? errorElement.textContent : '';
    }

    /**
     * @description Get default validation message
     * @param {string} rule - Validation rule name
     * @param {any} param - Rule parameter
     * @returns {string} Default message
     */
    getDefaultMessage(rule, param) {
        switch (rule) {
            case 'required':
                return VALIDATION_MESSAGES.REQUIRED;
            case 'email':
                return VALIDATION_MESSAGES.EMAIL_INVALID;
            case 'phone':
                return VALIDATION_MESSAGES.PHONE_INVALID;
            case 'number':
                return VALIDATION_MESSAGES.NUMBER_INVALID;
            case 'date':
                return VALIDATION_MESSAGES.DATE_INVALID;
            case 'minLength':
                return `Minimum length is ${param} characters`;
            case 'maxLength':
                return VALIDATION_MESSAGES.TOO_LONG;
            default:
                return 'Invalid value';
        }
    }

    /**
     * @description Register custom validator
     * @param {string} name - Validator name
     * @param {function} validatorFn - Validator function
     */
    registerValidator(name, validatorFn) {
        this.customValidators.set(name, validatorFn);
        logDebug(`Custom validator registered: ${name}`);
    }

    /**
     * @description Get validation statistics
     * @returns {object} Validation statistics
     */
    getStats() {
        return {
            registeredForms: this.validationConfigs.size,
            customValidators: this.customValidators.size,
            activeValidations: this.activeValidations.size
        };
    }
}

// Create singleton instance
export const formValidator = new FormValidator();

// Export convenience functions for backward compatibility
export const validateForm = (formId, config) => formValidator.validateForm(formId, config);
export const validateField = (fieldId, rules) => formValidator.validateField(fieldId, rules);
export const showFieldError = (fieldId, message) => formValidator.showFieldError(fieldId, message);
export const clearFieldError = (fieldId) => formValidator.clearFieldError(fieldId);
export const clearAllFieldErrors = (formId) => formValidator.clearAllFieldErrors(formId);
export const registerForm = (formId, config) => formValidator.registerForm(formId, config);

// Predefined form configurations
export const FORM_CONFIGS = {
    PC_NUMBER: {
        'pc-project-name': { required: true, maxLength: 200 },
        'pc-company-name': { required: true, maxLength: 100 },
        'pc-contact-name': { required: true, maxLength: 100 },
        'pc-contact-email': { email: true },
        'pc-contact-phone': { phone: true }
    },
    
    QUOTE: {
        'quote-modal-pc': { required: true },
        'quote-modal-pricelist': { required: true }
    },
    
    ACTIVITY: {
        'activity-title': { required: true, maxLength: 200 },
        'activity-type': { required: true },
        'activity-scheduled-date': { required: true, date: true },
        'activity-duration': { required: true, number: true }
    },
    
    RESOURCE: {
        'resource-name': { required: true, maxLength: 100 },
        'resource-category': { required: true },
        'resource-cost': { required: true, number: true },
        'resource-unit': { required: true }
    }
};

// For debugging in development
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    window.formValidator = formValidator;
}