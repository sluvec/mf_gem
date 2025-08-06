/**
 * @fileoverview Error Handling and Boundary Functions
 * @description Centralized error handling with user-friendly messaging
 */

import { logError, logWarning } from '../utils.js';
import { uiModals } from '../ui-modals.js';
import { ERROR_MESSAGES } from './constants.js';

/**
 * @description Central error handler for the application
 */
export class ErrorHandler {
    constructor() {
        this.errorCount = 0;
        this.errorHistory = [];
        this.maxHistorySize = 100;
        
        // Set up global error handlers
        this.setupGlobalHandlers();
    }

    /**
     * @description Setup global error handlers
     */
    setupGlobalHandlers() {
        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError(event.reason, 'Unhandled Promise Rejection');
            event.preventDefault(); // Prevent console error
        });

        // Handle JavaScript errors
        window.addEventListener('error', (event) => {
            this.handleError(event.error, 'JavaScript Error', {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
        });
    }

    /**
     * @description Main error handling function
     * @param {Error|string} error - Error object or message
     * @param {string} context - Context where error occurred
     * @param {object} metadata - Additional error metadata
     * @param {boolean} showToUser - Whether to show error to user
     */
    handleError(error, context = 'Unknown', metadata = {}, showToUser = true) {
        this.errorCount++;
        
        // Create error info object
        const errorInfo = {
            id: this.generateErrorId(),
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error : new Error(String(error)),
            context,
            metadata,
            userAgent: navigator.userAgent,
            url: window.location.href,
            userId: this.getCurrentUserId()
        };

        // Add to history
        this.addToHistory(errorInfo);

        // Log error
        logError(`[${context}] Error ${errorInfo.id}:`, errorInfo.error, metadata);

        // Show user-friendly message
        if (showToUser) {
            this.showUserError(errorInfo);
        }

        // Send to monitoring service (future implementation)
        this.sendToMonitoring(errorInfo);

        return errorInfo.id;
    }

    /**
     * @description Handle async function errors with try/catch wrapper
     * @param {function} asyncFn - Async function to wrap
     * @param {string} context - Context description
     * @param {object} options - Error handling options
     * @returns {function} Wrapped function
     */
    wrapAsync(asyncFn, context, options = {}) {
        return async (...args) => {
            try {
                return await asyncFn(...args);
            } catch (error) {
                const errorId = this.handleError(error, context, {
                    functionName: asyncFn.name,
                    arguments: args.length
                }, options.showToUser !== false);

                if (options.fallback) {
                    return options.fallback(error, errorId);
                }
                
                throw error;
            }
        };
    }

    /**
     * @description Handle sync function errors with try/catch wrapper
     * @param {function} fn - Function to wrap
     * @param {string} context - Context description
     * @param {object} options - Error handling options
     * @returns {function} Wrapped function
     */
    wrapSync(fn, context, options = {}) {
        return (...args) => {
            try {
                return fn(...args);
            } catch (error) {
                const errorId = this.handleError(error, context, {
                    functionName: fn.name,
                    arguments: args.length
                }, options.showToUser !== false);

                if (options.fallback) {
                    return options.fallback(error, errorId);
                }
                
                throw error;
            }
        };
    }

    /**
     * @description Create error boundary for database operations
     * @param {function} dbOperation - Database operation function
     * @param {string} operationName - Name of the operation
     * @returns {function} Wrapped database operation
     */
    wrapDatabaseOperation(dbOperation, operationName) {
        return this.wrapAsync(dbOperation, `Database: ${operationName}`, {
            showToUser: true,
            fallback: (error, errorId) => {
                logWarning(`Database operation ${operationName} failed with error ${errorId}`);
                return null; // Safe fallback for database operations
            }
        });
    }

    /**
     * @description Create error boundary for UI operations
     * @param {function} uiOperation - UI operation function
     * @param {string} operationName - Name of the operation
     * @returns {function} Wrapped UI operation
     */
    wrapUIOperation(uiOperation, operationName) {
        return this.wrapSync(uiOperation, `UI: ${operationName}`, {
            showToUser: false, // UI errors usually don't need user notification
            fallback: (error, errorId) => {
                logWarning(`UI operation ${operationName} failed with error ${errorId}`);
            }
        });
    }

    /**
     * @description Create error boundary for form operations
     * @param {function} formOperation - Form operation function
     * @param {string} formName - Name of the form
     * @returns {function} Wrapped form operation
     */
    wrapFormOperation(formOperation, formName) {
        return this.wrapAsync(formOperation, `Form: ${formName}`, {
            showToUser: true,
            fallback: (error, errorId) => {
                uiModals.showToast(ERROR_MESSAGES.VALIDATION_FAILED, 'error');
                logWarning(`Form operation ${formName} failed with error ${errorId}`);
                return false;
            }
        });
    }

    /**
     * @description Show user-friendly error message
     * @param {object} errorInfo - Error information
     */
    showUserError(errorInfo) {
        let userMessage = ERROR_MESSAGES.UNKNOWN_ERROR;

        // Determine appropriate user message based on error type
        if (errorInfo.context.includes('Database')) {
            userMessage = ERROR_MESSAGES.SAVE_FAILED;
        } else if (errorInfo.context.includes('Network')) {
            userMessage = ERROR_MESSAGES.NETWORK_ERROR;
        } else if (errorInfo.context.includes('Form')) {
            userMessage = ERROR_MESSAGES.VALIDATION_FAILED;
        } else if (errorInfo.context.includes('Login')) {
            userMessage = ERROR_MESSAGES.LOGIN_FAILED;
        }

        // Show toast with error ID for support purposes
        uiModals.showToast(`${userMessage} (Error: ${errorInfo.id})`, 'error');
    }

    /**
     * @description Generate unique error ID
     * @returns {string} Error ID
     */
    generateErrorId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 5);
        return `ERR-${timestamp}-${random}`.toUpperCase();
    }

    /**
     * @description Add error to history
     * @param {object} errorInfo - Error information
     */
    addToHistory(errorInfo) {
        this.errorHistory.push(errorInfo);
        
        // Limit history size
        if (this.errorHistory.length > this.maxHistorySize) {
            this.errorHistory.shift();
        }
    }

    /**
     * @description Get current user ID for error tracking
     * @returns {string|null} User ID
     */
    getCurrentUserId() {
        try {
            return localStorage.getItem('currentUser') || 'anonymous';
        } catch {
            return 'anonymous';
        }
    }

    /**
     * @description Send error to monitoring service (placeholder)
     * @param {object} errorInfo - Error information
     */
    sendToMonitoring(errorInfo) {
        // Placeholder for future monitoring service integration
        // Could send to services like Sentry, LogRocket, etc.
        logWarning('Monitoring service not configured, error logged locally:', errorInfo.id);
    }

    /**
     * @description Get error statistics
     * @returns {object} Error statistics
     */
    getStats() {
        const last24Hours = Date.now() - (24 * 60 * 60 * 1000);
        const recent = this.errorHistory.filter(e => new Date(e.timestamp).getTime() > last24Hours);
        
        return {
            totalErrors: this.errorCount,
            errorsLast24Hours: recent.length,
            mostRecentError: this.errorHistory[this.errorHistory.length - 1],
            commonContexts: this.getCommonContexts()
        };
    }

    /**
     * @description Get most common error contexts
     * @returns {object} Context frequency map
     */
    getCommonContexts() {
        const contexts = {};
        this.errorHistory.forEach(error => {
            contexts[error.context] = (contexts[error.context] || 0) + 1;
        });
        return contexts;
    }

    /**
     * @description Export error history for debugging
     * @returns {string} JSON string of error history
     */
    exportHistory() {
        return JSON.stringify(this.errorHistory, null, 2);
    }

    /**
     * @description Clear error history
     */
    clearHistory() {
        this.errorHistory = [];
        this.errorCount = 0;
        logWarning('Error history cleared');
    }
}

// Create singleton instance
export const errorHandler = new ErrorHandler();

// Export convenience functions
export const handleError = (error, context, metadata, showToUser) => 
    errorHandler.handleError(error, context, metadata, showToUser);

export const wrapAsync = (fn, context, options) => 
    errorHandler.wrapAsync(fn, context, options);

export const wrapSync = (fn, context, options) => 
    errorHandler.wrapSync(fn, context, options);

export const wrapDatabaseOperation = (fn, operationName) => 
    errorHandler.wrapDatabaseOperation(fn, operationName);

export const wrapUIOperation = (fn, operationName) => 
    errorHandler.wrapUIOperation(fn, operationName);

export const wrapFormOperation = (fn, formName) => 
    errorHandler.wrapFormOperation(fn, formName);

// For debugging in development
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    window.errorHandler = errorHandler;
}