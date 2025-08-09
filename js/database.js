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
        this.version = 7; // Schema v7: indexes for normalized PC fields
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

                // Version 5 upgrades: Add indexes for new fields
                if (event.oldVersion < 5) {
                    logInfo('Upgrading to version 5: Adding indexes for new fields');
                    
                    // Add new indexes to PC Numbers
                    if (db.objectStoreNames.contains('pcNumbers')) {
                        const pcStore = event.target.transaction.objectStore('pcNumbers');
                        if (!pcStore.indexNames.contains('clientCategory')) {
                            pcStore.createIndex('clientCategory', 'clientCategory', { unique: false });
                        }
                        if (!pcStore.indexNames.contains('clientSource')) {
                            pcStore.createIndex('clientSource', 'clientSource', { unique: false });
                        }
                        if (!pcStore.indexNames.contains('referralType')) {
                            pcStore.createIndex('referralType', 'referralType', { unique: false });
                        }
                        if (!pcStore.indexNames.contains('surveyor')) {
                            pcStore.createIndex('surveyor', 'surveyor', { unique: false });
                        }
                    }

                    // Add new indexes to Activities
                    if (db.objectStoreNames.contains('activities')) {
                        const activitiesStore = event.target.transaction.objectStore('activities');
                        if (!activitiesStore.indexNames.contains('department')) {
                            activitiesStore.createIndex('department', 'department', { unique: false });
                        }
                        if (!activitiesStore.indexNames.contains('paymentType')) {
                            activitiesStore.createIndex('paymentType', 'paymentType', { unique: false });
                        }
                        if (!activitiesStore.indexNames.contains('quoteId')) {
                            activitiesStore.createIndex('quoteId', 'quoteId', { unique: false });
                        }
                    }

                    // Add new indexes to Quotes
                    if (db.objectStoreNames.contains('quotes')) {
                        const quotesStore = event.target.transaction.objectStore('quotes');
                        if (!quotesStore.indexNames.contains('version')) {
                            quotesStore.createIndex('version', 'version', { unique: false });
                        }
                        if (!quotesStore.indexNames.contains('priceListId')) {
                            quotesStore.createIndex('priceListId', 'priceListId', { unique: false });
                        }
                    }
                }

                // Version 6 upgrades: Add indexes for user audit fields
                if (event.oldVersion < 6) {
                    logInfo('Upgrading to version 6: Adding user audit field indexes');
                    
                    // Add user audit indexes to PC Numbers
                    if (db.objectStoreNames.contains('pcNumbers')) {
                        const pcStore = event.target.transaction.objectStore('pcNumbers');
                        if (!pcStore.indexNames.contains('createdBy')) {
                            pcStore.createIndex('createdBy', 'createdBy', { unique: false });
                        }
                        if (!pcStore.indexNames.contains('editedBy')) {
                            pcStore.createIndex('editedBy', 'editedBy', { unique: false });
                        }
                        if (!pcStore.indexNames.contains('lastModifiedAt')) {
                            pcStore.createIndex('lastModifiedAt', 'lastModifiedAt', { unique: false });
                        }
                    }

                    // Add user audit indexes to Activities
                    if (db.objectStoreNames.contains('activities')) {
                        const activitiesStore = event.target.transaction.objectStore('activities');
                        if (!activitiesStore.indexNames.contains('createdBy')) {
                            activitiesStore.createIndex('createdBy', 'createdBy', { unique: false });
                        }
                        if (!activitiesStore.indexNames.contains('editedBy')) {
                            activitiesStore.createIndex('editedBy', 'editedBy', { unique: false });
                        }
                        if (!activitiesStore.indexNames.contains('lastModifiedAt')) {
                            activitiesStore.createIndex('lastModifiedAt', 'lastModifiedAt', { unique: false });
                        }
                    }

                    // Add user audit indexes to Quotes
                    if (db.objectStoreNames.contains('quotes')) {
                        const quotesStore = event.target.transaction.objectStore('quotes');
                        if (!quotesStore.indexNames.contains('createdBy')) {
                            quotesStore.createIndex('createdBy', 'createdBy', { unique: false });
                        }
                        if (!quotesStore.indexNames.contains('editedBy')) {
                            quotesStore.createIndex('editedBy', 'editedBy', { unique: false });
                        }
                        if (!quotesStore.indexNames.contains('lastModifiedAt')) {
                            quotesStore.createIndex('lastModifiedAt', 'lastModifiedAt', { unique: false });
                        }
                    }

                    // Add user audit indexes to Resources and Price Lists too
                    if (db.objectStoreNames.contains('resources')) {
                        const resourcesStore = event.target.transaction.objectStore('resources');
                        if (!resourcesStore.indexNames.contains('createdBy')) {
                            resourcesStore.createIndex('createdBy', 'createdBy', { unique: false });
                        }
                        if (!resourcesStore.indexNames.contains('editedBy')) {
                            resourcesStore.createIndex('editedBy', 'editedBy', { unique: false });
                        }
                        if (!resourcesStore.indexNames.contains('lastModifiedAt')) {
                            resourcesStore.createIndex('lastModifiedAt', 'lastModifiedAt', { unique: false });
                        }
                    }

                    if (db.objectStoreNames.contains('priceLists')) {
                        const priceListsStore = event.target.transaction.objectStore('priceLists');
                        if (!priceListsStore.indexNames.contains('createdBy')) {
                            priceListsStore.createIndex('createdBy', 'createdBy', { unique: false });
                        }
                        if (!priceListsStore.indexNames.contains('editedBy')) {
                            priceListsStore.createIndex('editedBy', 'editedBy', { unique: false });
                        }
                        if (!priceListsStore.indexNames.contains('lastModifiedAt')) {
                            priceListsStore.createIndex('lastModifiedAt', 'lastModifiedAt', { unique: false });
                        }
                    }
                }

                // Version 7 upgrades: Add indexes for normalized PC fields
                if (event.oldVersion < 7) {
                    logInfo('Upgrading to version 7: Adding indexes for normalized PC fields');
                    if (db.objectStoreNames.contains('pcNumbers')) {
                        const pcStore = event.target.transaction.objectStore('pcNumbers');
                        const ensureIndex = (name, keyPath) => {
                            if (!pcStore.indexNames.contains(name)) pcStore.createIndex(name, keyPath, { unique: false });
                        };
                        ensureIndex('company', 'company');
                        ensureIndex('accountManager', 'accountManager');
                        ensureIndex('clientCategory', 'clientCategory');
                        ensureIndex('clientSource', 'clientSource');
                        ensureIndex('industry', 'industry');
                        ensureIndex('addressPostcode', 'addressPostcode');
                    }
                }

                // Notify on blocked upgrades
                request.onblocked = () => {
                    try {
                        // Lazy import to avoid circular deps
                        const warn = 'Database upgrade is blocked. Please close other open tabs of this app and reload.';
                        console.warn('[WARNING]', warn);
                        if (window?.uiModals?.showToast) {
                            window.uiModals.showToast('Another tab is open. Please close other tabs and reload.', 'warning', 10000);
                        } else if (window?.app?.uiModals?.showToast) {
                            window.app.uiModals.showToast('Another tab is open. Please close other tabs and reload.', 'warning', 10000);
                        }
                    } catch (e) {
                        console.warn('onblocked handler failed to notify user');
                    }
                };
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
        const storeNames = ['pcNumbers', 'activities', 'quotes', 'resources', 'priceLists'];

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
            const storeNames = ['pcNumbers', 'activities', 'resources', 'quotes', 'priceLists'];
            for (const storeName of storeNames) {
                await this.clearStore(storeName);
            }
            logInfo('All stores cleared successfully');
        } catch (error) {
            logError('Failed to clear all stores:', error);
            throw error;
        }
    }

    /**
     * @description Export all data for backup purposes
     * @returns {Promise<Object>} Complete database backup
     */
    async exportBackup() {
        try {
            if (!this.isInitialized) {
                throw new Error('Database not initialized');
            }

            const backup = {
                timestamp: new Date().toISOString(),
                version: this.version,
                data: {}
            };

            const storeNames = ['pcNumbers', 'activities', 'quotes', 'resources', 'priceLists'];
            
            for (const storeName of storeNames) {
                backup.data[storeName] = await this.loadAll(storeName);
            }

            logInfo('Database backup created with', Object.keys(backup.data).length, 'stores');
            return backup;

        } catch (error) {
            logError('Failed to create backup:', error);
            throw error;
        }
    }

    /**
     * @description Import data from backup
     * @param {Object} backup - Backup data object
     * @returns {Promise<void>}
     */
    async importBackup(backup) {
        try {
            if (!this.isInitialized) {
                throw new Error('Database not initialized');
            }

            if (!backup || !backup.data) {
                throw new Error('Invalid backup format');
            }

            logInfo('Importing backup from', backup.timestamp);

            for (const [storeName, items] of Object.entries(backup.data)) {
                if (Array.isArray(items)) {
                    for (const item of items) {
                        await this.save(storeName, item);
                    }
                    logInfo(`Imported ${items.length} items to ${storeName}`);
                }
            }

            logInfo('Backup import completed successfully');

        } catch (error) {
            logError('Failed to import backup:', error);
            throw error;
        }
    }

    /**
     * @description Download backup as JSON file
     */
    async downloadBackup() {
        try {
            const backup = await this.exportBackup();
            const dataStr = JSON.stringify(backup, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `crm-backup-${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            
            logInfo('Backup download initiated');

        } catch (error) {
            logError('Failed to download backup:', error);
            throw error;
        }
    }

    /**
     * @description Assign random users to existing records that don't have user audit fields
     * @returns {Promise<void>}
     */
    async assignRandomUsersToExistingData() {
        const availableUsers = ['Slav', 'Rob', 'Kayleigh', 'Terry', 'Phil'];
        
        try {
            if (!this.isInitialized) {
                throw new Error('Database not initialized');
            }

            console.log('🔵 USERS: Starting user assignment...');
            
            // Skip user assignment to prevent hang - user assignments can be done later
            console.log('🔵 USERS: Skipping user assignment to prevent initialization hang');
            logInfo('User assignment skipped for faster initialization');
            return;

            logInfo('Starting user assignment to existing records');
            let updatedCount = 0;

            // Helper function to get random user
            const getRandomUser = () => availableUsers[Math.floor(Math.random() * availableUsers.length)];

            // Update PC Numbers
            const pcNumbers = await this.loadAll('pcNumbers');
            for (const pc of pcNumbers) {
                if (!pc.createdBy) {
                    const randomUser = getRandomUser();
                    pc.createdBy = randomUser;
                    pc.editedBy = randomUser;
                    pc.lastModifiedAt = pc.createdAt || new Date().toISOString();
                    await this.save('pcNumbers', pc);
                    updatedCount++;
                }
            }

            // Update Activities
            const activities = await this.loadAll('activities');
            for (const activity of activities) {
                if (!activity.createdBy) {
                    const randomUser = getRandomUser();
                    activity.createdBy = randomUser;
                    activity.editedBy = randomUser;
                    activity.lastModifiedAt = activity.createdAt || new Date().toISOString();
                    await this.save('activities', activity);
                    updatedCount++;
                }
            }

            // Update Quotes
            const quotes = await this.loadAll('quotes');
            for (const quote of quotes) {
                if (!quote.createdBy) {
                    const randomUser = getRandomUser();
                    quote.createdBy = randomUser;
                    quote.editedBy = randomUser;
                    quote.lastModifiedAt = quote.createdAt || new Date().toISOString();
                    await this.save('quotes', quote);
                    updatedCount++;
                }
            }

            // Update Resources
            const resources = await this.loadAll('resources');
            for (const resource of resources) {
                if (!resource.createdBy) {
                    const randomUser = getRandomUser();
                    resource.createdBy = randomUser;
                    resource.editedBy = randomUser;
                    resource.lastModifiedAt = resource.createdAt || new Date().toISOString();
                    await this.save('resources', resource);
                    updatedCount++;
                }
            }

            // Update Price Lists
            const priceLists = await this.loadAll('priceLists');
            for (const priceList of priceLists) {
                if (!priceList.createdBy) {
                    const randomUser = getRandomUser();
                    priceList.createdBy = randomUser;
                    priceList.editedBy = randomUser;
                    priceList.lastModifiedAt = priceList.createdAt || new Date().toISOString();
                    await this.save('priceLists', priceList);
                    updatedCount++;
                }
            }

            logInfo(`User assignment completed: ${updatedCount} records updated`);
        } catch (error) {
            logError('Failed to assign users to existing data:', error);
            throw error;
        }
    }
}

// Create global database instance
export const db = new Database();