/**
 * @fileoverview Utility functions and centralized logging system
 * @description Provides debugging, validation, and helper functions
 */

const DEBUG = true; // Toggle for production

/**
 * @description Debug logging - only displays in debug mode
 * @param {...any} args - Arguments to log
 */
export function logDebug(...args) {
    if (DEBUG) console.debug('[DEBUG]', ...args);
}

/**
 * @description Information logging
 * @param {...any} args - Arguments to log
 */
export function logInfo(...args) {
    console.info('[INFO]', ...args);
}

/**
 * @description Error logging
 * @param {...any} args - Arguments to log
 */
export function logError(...args) {
    console.error('[ERROR]', ...args);
}

/**
 * @description Warning logging
 * @param {...any} args - Arguments to log
 */
export function logWarning(...args) {
    console.warn('[WARNING]', ...args);
}

/**
 * @description Generate a UUID v4 using crypto.randomUUID() or fallback method
 * @returns {string} UUID v4 string
 */
export function generateId() {
    try {
        if (crypto && crypto.randomUUID) {
            return crypto.randomUUID();
        }
    } catch (err) {
        logWarning('crypto.randomUUID not available, using fallback');
    }
    
    // Fallback method
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * @description Escape HTML characters to prevent XSS attacks
 * @param {string} unsafe - Unsafe HTML string
 * @returns {string} Escaped HTML string
 * @example
 * sanitizeHTML('<script>alert("xss")</script>') // Returns: '&lt;script&gt;alert("xss")&lt;/script&gt;'
 */
export function sanitizeHTML(unsafe) {
    if (typeof unsafe !== 'string') return '';
    
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * @description Safe wrapper for setting innerHTML with HTML escaping
 * @param {HTMLElement} element - DOM element
 * @param {string} content - Content to set
 */
export function safeSetHTML(element, content) {
    if (!element) {
        logError('safeSetHTML: Element not found');
        return;
    }
    element.innerHTML = sanitizeHTML(content);
}

/**
 * @description Validate form data against rules
 * @param {Object} data - Form data to validate
 * @param {Object} rules - Validation rules
 * @returns {Object} Validation result with errors array
 */
export function validateFormData(data, rules) {
    const errors = [];
    
    for (const [field, rule] of Object.entries(rules)) {
        const value = data[field];
        
        if (rule.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
            errors.push(`${field} is required`);
            continue;
        }
        
        if (value && rule.minLength && value.length < rule.minLength) {
            errors.push(`${field} must be at least ${rule.minLength} characters`);
        }
        
        if (value && rule.maxLength && value.length > rule.maxLength) {
            errors.push(`${field} must be no more than ${rule.maxLength} characters`);
        }
        
        if (value && rule.pattern && !rule.pattern.test(value)) {
            errors.push(`${field} format is invalid`);
        }
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * @description Format currency value
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (default: GBP)
 * @returns {string} Formatted currency string
 */
export function formatCurrency(amount, currency = 'GBP') {
    if (typeof amount !== 'number' || isNaN(amount)) return '£0.00';
    
    try {
        return new Intl.NumberFormat('en-GB', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2
        }).format(amount);
    } catch (err) {
        logError('Currency formatting failed:', err);
        return `£${amount.toFixed(2)}`;
    }
}

/**
 * @description Format date string
 * @param {Date|string} date - Date to format
 * @param {string} format - Format type: 'short', 'long', 'datetime'
 * @returns {string} Formatted date string
 */
export function formatDate(date, format = 'short') {
    if (!date) return '';
    
    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) return '';
    
    try {
        switch (format) {
            case 'long':
                return dateObj.toLocaleDateString('en-GB', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
            case 'datetime':
                return dateObj.toLocaleDateString('en-GB', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            default:
                return dateObj.toLocaleDateString('en-GB');
        }
    } catch (err) {
        logError('Date formatting failed:', err);
        return dateObj.toString();
    }
}

/**
 * @description Debounce function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * @description Deep clone an object
 * @param {any} obj - Object to clone
 * @returns {any} Cloned object
 */
export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => deepClone(item));
    if (typeof obj === 'object') {
        const clonedObj = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                clonedObj[key] = deepClone(obj[key]);
            }
        }
        return clonedObj;
    }
}

/**
 * @description Convert camelCase to kebab-case
 * @param {string} str - String to convert
 * @returns {string} Kebab-case string
 */
export function camelToKebab(str) {
    return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * @description Convert kebab-case to camelCase
 * @param {string} str - String to convert
 * @returns {string} CamelCase string
 */
export function kebabToCamel(str) {
    return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
}