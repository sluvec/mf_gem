/**
 * @fileoverview Database module for IndexedDB operations and state management
 * @description Handles data persistence, retrieval, and global state management
 */

import { logDebug, logError, logInfo, generateId } from './utils.js';

/**
 * @description Global database connection and state management
 */
export class Database {
    constructor() {
        this.db = null;
        this.dbName = 'CRM_Database';
        this.version = 3; // Increased to force database upgrade
        this.isInitialized = false;
        this.retryAttempts = 3;
        this.retryDelay = 1000;
    }

    /**
     * @description Initialize IndexedDB connection and create object stores with indexes
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.isInitialized) return;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                logError('Failed to open IndexedDB:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                this.isInitialized = true;
                logInfo('IndexedDB initialized successfully');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                logInfo('Upgrading database schema');

                // PC Numbers store
                if (!db.objectStoreNames.contains('pcNumbers')) {
                    const pcStore = db.createObjectStore('pcNumbers', { keyPath: 'id' });
                    pcStore.createIndex('pcNumber', 'pcNumber', { unique: true });
                    pcStore.createIndex('createdAt', 'createdAt', { unique: false });
                }

                // Activities store
                if (!db.objectStoreNames.contains('activities')) {
                    const activitiesStore = db.createObjectStore('activities', { keyPath: 'id' });
                    activitiesStore.createIndex('pcId', 'pcId', { unique: false });
                    activitiesStore.createIndex('scheduledDate', 'scheduledDate', { unique: false });
                    activitiesStore.createIndex('status', 'status', { unique: false });
                }

                // Quotes store
                if (!db.objectStoreNames.contains('quotes')) {
                    const quotesStore = db.createObjectStore('quotes', { keyPath: 'id' });
                    quotesStore.createIndex('pcId', 'pcId', { unique: false });
                    quotesStore.createIndex('status', 'status', { unique: false });
                    quotesStore.createIndex('createdAt', 'createdAt', { unique: false });
                }

                // Resources store
                if (!db.objectStoreNames.contains('resources')) {
                    const resourcesStore = db.createObjectStore('resources', { keyPath: 'id' });
                    resourcesStore.createIndex('type', 'type', { unique: false });
                    resourcesStore.createIndex('name', 'name', { unique: false });
                }

                // Price lists store
                if (!db.objectStoreNames.contains('priceLists')) {
                    const priceListsStore = db.createObjectStore('priceLists', { keyPath: 'id' });
                    priceListsStore.createIndex('name', 'name', { unique: false });
                }

                // Templates store
                if (!db.objectStoreNames.contains('templates')) {
                    const templatesStore = db.createObjectStore('templates', { keyPath: 'id' });
                    templatesStore.createIndex('type', 'type', { unique: false });
                }
            };
        });
    }

    /**
     * @description Enhanced error handling with retry logic
     * @param {Function} operation - Database operation to retry
     * @param {number} attempts - Number of retry attempts
     * @returns {Promise<any>}
     */
    async withRetry(operation, attempts = this.retryAttempts) {
        try {
            return await operation();
        } catch (error) {
            if (attempts > 1) {
                logDebug(`Retrying operation, ${attempts - 1} attempts remaining`);
                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                return this.withRetry(operation, attempts - 1);
            }
            throw error;
        }
    }

    /**
     * @description Save data to specified IndexedDB store
     * @param {string} storeName - Name of the store
     * @param {Object} data - Data to save
     * @returns {Promise<string>} ID of saved record
     */
    async save(storeName, data) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        return this.withRetry(async () => {
            if (!data.id) {
                data.id = generateId();
            }

            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            
            await new Promise((resolve, reject) => {
                const request = store.put(data);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });

            logDebug(`Saved data to ${storeName}:`, data.id);
            return data.id;
        });
    }

    /**
     * @description Load a single record from IndexedDB store by ID
     * @param {string} storeName - Name of the store
     * @param {string} id - ID of the record
     * @returns {Promise<Object|null>} Retrieved record or null
     */
    async load(storeName, id) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        return this.withRetry(async () => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            
            return new Promise((resolve, reject) => {
                const request = store.get(id);
                request.onsuccess = () => {
                    logDebug(`Loaded data from ${storeName}:`, id);
                    resolve(request.result || null);
                };
                request.onerror = () => reject(request.error);
            });
        });
    }

    /**
     * @description Load all records from an IndexedDB store
     * @param {string} storeName - Name of the store
     * @returns {Promise<Array>} Array of all records
     */
    async loadAll(storeName) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        return this.withRetry(async () => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            
            return new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => {
                    logDebug(`Loaded all data from ${storeName}:`, request.result.length, 'records');
                    resolve(request.result || []);
                };
                request.onerror = () => reject(request.error);
            });
        });
    }

    /**
     * @description Delete a record from IndexedDB store
     * @param {string} storeName - Name of the store
     * @param {string} id - ID of the record to delete
     * @returns {Promise<void>}
     */
    async delete(storeName, id) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        return this.withRetry(async () => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            
            await new Promise((resolve, reject) => {
                const request = store.delete(id);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });

            logDebug(`Deleted data from ${storeName}:`, id);
        });
    }

    /**
     * @description Query records using an index
     * @param {string} storeName - Name of the store
     * @param {string} indexName - Name of the index
     * @param {any} value - Value to search for
     * @returns {Promise<Array>} Array of matching records
     */
    async queryByIndex(storeName, indexName, value) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        return this.withRetry(async () => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);
            
            return new Promise((resolve, reject) => {
                const request = index.getAll(value);
                request.onsuccess = () => {
                    logDebug(`Queried ${storeName} by ${indexName}:`, request.result.length, 'results');
                    resolve(request.result || []);
                };
                request.onerror = () => reject(request.error);
            });
        });
    }

    /**
     * @description Clear all data from a store
     * @param {string} storeName - Name of the store to clear
     * @returns {Promise<void>}
     */
    async clearStore(storeName) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        return this.withRetry(async () => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            
            await new Promise((resolve, reject) => {
                const request = store.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });

            logInfo(`Cleared all data from ${storeName}`);
        });
    }

    /**
     * @description Get database statistics
     * @returns {Promise<Object>} Database statistics
     */
    async getStats() {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const stats = {};
        const storeNames = ['pcNumbers', 'activities', 'quotes', 'resources', 'priceLists', 'templates'];

        for (const storeName of storeNames) {
            try {
                const records = await this.loadAll(storeName);
                stats[storeName] = records.length;
            } catch (error) {
                logError(`Failed to get stats for ${storeName}:`, error);
                stats[storeName] = 0;
            }
        }

        return stats;
    }

    /**
     * @description Clear all stores in the database
     * @returns {Promise<void>}
     */
    async clearAllStores() {
        try {
            const storeNames = ['pcNumbers', 'activities', 'resources', 'quotes', 'priceLists', 'templates'];
            for (const storeName of storeNames) {
                await this.clearStore(storeName);
            }
            logInfo('All stores cleared successfully');
        } catch (error) {
            logError('Failed to clear all stores:', error);
            throw error;
        }
    }
}

// Create global database instance
export const db = new Database();