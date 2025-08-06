/**
 * @fileoverview PC Numbers Service
 * @description Business logic for PC Numbers management
 */

import { logInfo, logError, logDebug, generateId } from '../../utils.js';
import { PC_NUMBER, STATUS_VALUES, FIELD_LIMITS } from '../../shared/constants.js';
import { stateManager } from '../../shared/state-manager.js';
import { handleError } from '../../shared/error-handler.js';

/**
 * @description PC Numbers service for business logic
 */
export class PCNumberService {
    constructor(database, migrationManager) {
        this.db = database;
        this.migrations = migrationManager;
    }

    /**
     * @description Generate next PC Number in sequence
     * @returns {Promise<string>} Next PC Number
     */
    async generateNextNumber() {
        try {
            return await this.migrations.getNextPcNumber();
        } catch (error) {
            handleError(error, 'PC Number Generation');
            return PC_NUMBER.DEFAULT_START;
        }
    }

    /**
     * @description Create a new PC Number
     * @param {object} pcData - PC Number data
     * @returns {Promise<object>} Created PC Number
     */
    async create(pcData) {
        try {
            // Generate PC Number
            const pcNumber = await this.generateNextNumber();
            
            // Create PC Number object
            const newPcNumber = {
                id: generateId(),
                pcNumber,
                createdAt: new Date(),
                lastModifiedAt: new Date().toISOString(),
                status: STATUS_VALUES.ACTIVE,
                ...pcData
            };

            // Validate required fields
            this.validatePcNumber(newPcNumber);

            // Save to database
            const saved = await this.db.save('pcNumbers', newPcNumber);
            
            logInfo(`Created PC Number: ${pcNumber}`);
            
            // Update state
            await this.refreshPcNumbersList();
            
            return saved;
        } catch (error) {
            handleError(error, 'PC Number Creation');
            throw error;
        }
    }

    /**
     * @description Update an existing PC Number
     * @param {string} id - PC Number ID
     * @param {object} updates - Updates to apply
     * @returns {Promise<object>} Updated PC Number
     */
    async update(id, updates) {
        try {
            const existing = await this.db.load('pcNumbers', id);
            if (!existing) {
                throw new Error(`PC Number not found: ${id}`);
            }

            const updated = {
                ...existing,
                ...updates,
                lastModifiedAt: new Date().toISOString(),
                editedBy: stateManager.getState('app.currentUser') || 'unknown'
            };

            // Validate updated data
            this.validatePcNumber(updated);

            // Save to database
            const saved = await this.db.save('pcNumbers', updated);
            
            logInfo(`Updated PC Number: ${existing.pcNumber}`);
            
            // Update state
            await this.refreshPcNumbersList();
            
            return saved;
        } catch (error) {
            handleError(error, 'PC Number Update');
            throw error;
        }
    }

    /**
     * @description Get PC Number by ID
     * @param {string} id - PC Number ID
     * @returns {Promise<object>} PC Number data
     */
    async getById(id) {
        try {
            const pcNumber = await this.db.load('pcNumbers', id);
            if (!pcNumber) {
                throw new Error(`PC Number not found: ${id}`);
            }
            return pcNumber;
        } catch (error) {
            handleError(error, 'PC Number Retrieval');
            return null;
        }
    }

    /**
     * @description Get all PC Numbers
     * @returns {Promise<array>} List of PC Numbers
     */
    async getAll() {
        try {
            return await this.db.loadAll('pcNumbers');
        } catch (error) {
            handleError(error, 'PC Numbers List Retrieval');
            return [];
        }
    }

    /**
     * @description Delete PC Number
     * @param {string} id - PC Number ID
     * @returns {Promise<boolean>} Success status
     */
    async delete(id) {
        try {
            const existing = await this.db.load('pcNumbers', id);
            if (!existing) {
                throw new Error(`PC Number not found: ${id}`);
            }

            await this.db.delete('pcNumbers', id);
            
            logInfo(`Deleted PC Number: ${existing.pcNumber}`);
            
            // Update state
            await this.refreshPcNumbersList();
            
            return true;
        } catch (error) {
            handleError(error, 'PC Number Deletion');
            return false;
        }
    }

    /**
     * @description Search PC Numbers
     * @param {string} query - Search query
     * @param {string} field - Field to search in
     * @returns {Promise<array>} Filtered PC Numbers
     */
    async search(query, field = 'all') {
        try {
            const allPcNumbers = await this.getAll();
            
            if (!query || query.trim() === '') {
                return allPcNumbers;
            }

            const searchTerm = query.toLowerCase().trim();
            
            return allPcNumbers.filter(pc => {
                switch (field) {
                    case 'pcNumber':
                        return pc.pcNumber?.toLowerCase().includes(searchTerm);
                    case 'company':
                        return pc.company?.toLowerCase().includes(searchTerm) || 
                               pc.clientName?.toLowerCase().includes(searchTerm);
                    case 'accountManager':
                        return pc.accountManager?.toLowerCase().includes(searchTerm);
                    case 'all':
                    default:
                        return Object.values(pc).some(value => 
                            value && value.toString().toLowerCase().includes(searchTerm)
                        );
                }
            });
        } catch (error) {
            handleError(error, 'PC Numbers Search');
            return [];
        }
    }

    /**
     * @description Get PC Numbers by status
     * @param {string} status - Status to filter by
     * @returns {Promise<array>} Filtered PC Numbers
     */
    async getByStatus(status) {
        try {
            const allPcNumbers = await this.getAll();
            return allPcNumbers.filter(pc => pc.status === status);
        } catch (error) {
            handleError(error, 'PC Numbers Status Filter');
            return [];
        }
    }

    /**
     * @description Get recent PC Numbers
     * @param {number} limit - Number of records to return
     * @returns {Promise<array>} Recent PC Numbers
     */
    async getRecent(limit = 10) {
        try {
            const allPcNumbers = await this.getAll();
            return allPcNumbers
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, limit);
        } catch (error) {
            handleError(error, 'Recent PC Numbers Retrieval');
            return [];
        }
    }

    /**
     * @description Get PC Numbers statistics
     * @returns {Promise<object>} Statistics
     */
    async getStatistics() {
        try {
            const allPcNumbers = await this.getAll();
            
            const stats = {
                total: allPcNumbers.length,
                active: 0,
                completed: 0,
                draft: 0,
                urgent: 0,
                totalValue: 0,
                averageValue: 0
            };

            allPcNumbers.forEach(pc => {
                // Count by status
                if (pc.status === STATUS_VALUES.ACTIVE) stats.active++;
                else if (pc.status === STATUS_VALUES.COMPLETED) stats.completed++;
                else if (pc.status === STATUS_VALUES.DRAFT) stats.draft++;
                else if (pc.status === STATUS_VALUES.URGENT) stats.urgent++;

                // Calculate value statistics
                const value = parseFloat(pc.estimatedValue) || 0;
                stats.totalValue += value;
            });

            stats.averageValue = stats.total > 0 ? stats.totalValue / stats.total : 0;

            return stats;
        } catch (error) {
            handleError(error, 'PC Numbers Statistics');
            return { total: 0, active: 0, completed: 0, draft: 0, urgent: 0, totalValue: 0, averageValue: 0 };
        }
    }

    /**
     * @description Validate PC Number data
     * @param {object} pcData - PC Number data to validate
     */
    validatePcNumber(pcData) {
        const errors = [];

        // Required fields
        if (!pcData.projectTitle || pcData.projectTitle.trim() === '') {
            errors.push('Project title is required');
        }

        if (!pcData.clientName || pcData.clientName.trim() === '') {
            errors.push('Client name is required');
        }

        if (!pcData.contactName || pcData.contactName.trim() === '') {
            errors.push('Contact name is required');
        }

        // Field length validation
        if (pcData.projectTitle && pcData.projectTitle.length > FIELD_LIMITS.TITLE_MAX) {
            errors.push(`Project title must be less than ${FIELD_LIMITS.TITLE_MAX} characters`);
        }

        if (pcData.clientName && pcData.clientName.length > FIELD_LIMITS.NAME_MAX) {
            errors.push(`Client name must be less than ${FIELD_LIMITS.NAME_MAX} characters`);
        }

        // Email validation
        if (pcData.contactEmail && pcData.contactEmail.trim() !== '') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(pcData.contactEmail)) {
                errors.push('Contact email must be a valid email address');
            }
        }

        // Value validation
        if (pcData.estimatedValue && isNaN(parseFloat(pcData.estimatedValue))) {
            errors.push('Estimated value must be a valid number');
        }

        if (errors.length > 0) {
            throw new Error(`Validation failed: ${errors.join(', ')}`);
        }
    }

    /**
     * @description Refresh PC Numbers list in state
     */
    async refreshPcNumbersList() {
        try {
            const pcNumbers = await this.getAll();
            stateManager.setState('data.allPcNumbers', pcNumbers);
            stateManager.setState('original.pcNumbers', [...pcNumbers]);
            logDebug(`Refreshed PC Numbers list: ${pcNumbers.length} items`);
        } catch (error) {
            logError('Failed to refresh PC Numbers list:', error);
        }
    }

    /**
     * @description Set current PC Number in state
     * @param {object} pcNumber - PC Number to set as current
     */
    setCurrentPcNumber(pcNumber) {
        stateManager.setState('current.pc', pcNumber);
        logDebug('Current PC Number set:', pcNumber?.pcNumber);
    }

    /**
     * @description Get current PC Number from state
     * @returns {object|null} Current PC Number
     */
    getCurrentPcNumber() {
        return stateManager.getState('current.pc');
    }

    /**
     * @description Clear current PC Number from state
     */
    clearCurrentPcNumber() {
        stateManager.setState('current.pc', null);
        logDebug('Current PC Number cleared');
    }
}

// Export factory function
export const createPCNumberService = (database, migrationManager) => {
    return new PCNumberService(database, migrationManager);
};