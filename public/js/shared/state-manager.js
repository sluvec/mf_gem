/**
 * @fileoverview Global State Management
 * @description Centralized state management to replace global window variables
 */

import { logDebug, logWarning } from '../utils.js';

/**
 * @description Centralized state manager to replace window.* globals
 */
export class StateManager {
    constructor() {
        this.state = new Map();
        this.subscribers = new Map();
        this.history = [];
        this.maxHistorySize = 50;
        
        // Initialize with empty state
        this.initializeState();
    }

    /**
     * @description Initialize default state structure
     */
    initializeState() {
        // Application state
        this.setState('app.initialized', false);
        this.setState('app.currentPage', 'dashboard');
        this.setState('app.currentUser', null);
        
        // Current active records
        this.setState('current.pc', null);
        this.setState('current.quote', null);
        this.setState('current.activity', null);
        this.setState('current.priceList', null);
        this.setState('current.priceListItem', null);
        
        // Data collections
        this.setState('data.allPcNumbers', []);
        this.setState('data.allQuotes', []);
        this.setState('data.allActivities', []);
        this.setState('data.allResources', []);
        this.setState('data.allCompanies', []);
        this.setState('data.allPriceLists', []);
        
        // Original data for filtering
        this.setState('original.pcNumbers', []);
        this.setState('original.activities', []);
        this.setState('original.quotes', []);
        
        // UI state
        this.setState('ui.selectedQuoteData', null);
        this.setState('ui.loadingOverlay', false);
        this.setState('ui.mobileMenuOpen', false);
        
        // Calendar state
        this.setState('calendar.currentDate', new Date());
        this.setState('calendar.currentView', 'month');
        
        logDebug('StateManager initialized with default state');
    }

    /**
     * @description Set a state value
     * @param {string} key - Dot-notation key (e.g., 'current.pc')
     * @param {any} value - Value to set
     * @param {boolean} notify - Whether to notify subscribers (default: true)
     */
    setState(key, value, notify = true) {
        const oldValue = this.state.get(key);
        
        // Add to history if value changed
        if (oldValue !== value) {
            this.addToHistory(key, oldValue, value);
        }
        
        this.state.set(key, value);
        
        if (notify) {
            this.notifySubscribers(key, value, oldValue);
        }
        
        logDebug(`State updated: ${key}`, value);
    }

    /**
     * @description Get a state value
     * @param {string} key - Dot-notation key
     * @param {any} defaultValue - Default value if key doesn't exist
     * @returns {any} State value
     */
    getState(key, defaultValue = null) {
        return this.state.has(key) ? this.state.get(key) : defaultValue;
    }

    /**
     * @description Update nested object properties
     * @param {string} key - State key
     * @param {object} updates - Properties to update
     */
    updateState(key, updates) {
        const currentValue = this.getState(key, {});
        const newValue = { ...currentValue, ...updates };
        this.setState(key, newValue);
    }

    /**
     * @description Subscribe to state changes
     * @param {string} key - State key to watch
     * @param {function} callback - Callback function (value, oldValue) => void
     * @returns {function} Unsubscribe function
     */
    subscribe(key, callback) {
        if (!this.subscribers.has(key)) {
            this.subscribers.set(key, new Set());
        }
        
        this.subscribers.get(key).add(callback);
        
        logDebug(`Subscribed to state: ${key}`);
        
        // Return unsubscribe function
        return () => {
            const keySubscribers = this.subscribers.get(key);
            if (keySubscribers) {
                keySubscribers.delete(callback);
                if (keySubscribers.size === 0) {
                    this.subscribers.delete(key);
                }
            }
            logDebug(`Unsubscribed from state: ${key}`);
        };
    }

    /**
     * @description Subscribe to multiple keys with wildcards
     * @param {string} pattern - Pattern to match (e.g., 'current.*')
     * @param {function} callback - Callback function
     * @returns {function} Unsubscribe function
     */
    subscribePattern(pattern, callback) {
        const regex = new RegExp(pattern.replace('*', '.*'));
        const unsubscribeFunctions = [];
        
        // Subscribe to existing keys that match
        for (const key of this.state.keys()) {
            if (regex.test(key)) {
                unsubscribeFunctions.push(this.subscribe(key, callback));
            }
        }
        
        // Return combined unsubscribe function
        return () => {
            unsubscribeFunctions.forEach(fn => fn());
        };
    }

    /**
     * @description Notify subscribers of state changes
     * @param {string} key - State key that changed
     * @param {any} newValue - New value
     * @param {any} oldValue - Previous value
     */
    notifySubscribers(key, newValue, oldValue) {
        const keySubscribers = this.subscribers.get(key);
        if (keySubscribers) {
            keySubscribers.forEach(callback => {
                try {
                    callback(newValue, oldValue, key);
                } catch (error) {
                    logWarning(`Error in state subscriber for ${key}:`, error);
                }
            });
        }
    }

    /**
     * @description Add state change to history
     * @param {string} key - State key
     * @param {any} oldValue - Previous value
     * @param {any} newValue - New value
     */
    addToHistory(key, oldValue, newValue) {
        this.history.push({
            timestamp: Date.now(),
            key,
            oldValue,
            newValue
        });
        
        // Limit history size
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        }
    }

    /**
     * @description Get state change history
     * @param {string} key - Optional key to filter by
     * @returns {array} History entries
     */
    getHistory(key = null) {
        if (key) {
            return this.history.filter(entry => entry.key === key);
        }
        return [...this.history];
    }

    /**
     * @description Clear all state
     */
    clear() {
        this.state.clear();
        this.subscribers.clear();
        this.history = [];
        this.initializeState();
        logDebug('StateManager cleared and reinitialized');
    }

    /**
     * @description Get all state keys
     * @returns {array} Array of state keys
     */
    getKeys() {
        return Array.from(this.state.keys());
    }

    /**
     * @description Check if state key exists
     * @param {string} key - State key to check
     * @returns {boolean} True if key exists
     */
    hasState(key) {
        return this.state.has(key);
    }

    /**
     * @description Remove state key
     * @param {string} key - State key to remove
     */
    removeState(key) {
        const oldValue = this.state.get(key);
        this.state.delete(key);
        this.notifySubscribers(key, undefined, oldValue);
        logDebug(`State removed: ${key}`);
    }

    /**
     * @description Get state snapshot for debugging
     * @returns {object} Current state as plain object
     */
    getSnapshot() {
        const snapshot = {};
        for (const [key, value] of this.state.entries()) {
            snapshot[key] = value;
        }
        return snapshot;
    }

    /**
     * @description Export state to JSON
     * @returns {string} JSON representation of state
     */
    export() {
        return JSON.stringify(this.getSnapshot(), null, 2);
    }

    /**
     * @description Import state from JSON
     * @param {string} jsonState - JSON state to import
     */
    import(jsonState) {
        try {
            const state = JSON.parse(jsonState);
            for (const [key, value] of Object.entries(state)) {
                this.setState(key, value, false); // Don't notify during import
            }
            logDebug('State imported successfully');
        } catch (error) {
            logWarning('Failed to import state:', error);
        }
    }
}

// Create singleton instance
export const stateManager = new StateManager();

// For debugging in development
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    window.stateManager = stateManager;
}