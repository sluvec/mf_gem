/**
 * @fileoverview Quotes Service
 * @description Business logic for Quotes management
 */

import { logInfo, logError, logDebug, generateId } from '../../utils.js';
import { QUOTE_NUMBER, STATUS_VALUES, FIELD_LIMITS } from '../../shared/constants.js';
import { stateManager } from '../../shared/state-manager.js';
import { handleError } from '../../shared/error-handler.js';

/**
 * @description Quotes service for business logic
 */
export class QuoteService {
    constructor(database, migrationManager) {
        this.db = database;
        this.migrations = migrationManager;
    }

    /**
     * @description Generate next Quote Number in sequence
     * @returns {Promise<string>} Next Quote Number
     */
    async generateNextNumber() {
        try {
            return await this.migrations.getNextQuoteNumber();
        } catch (error) {
            handleError(error, 'Quote Number Generation');
            return QUOTE_NUMBER.DEFAULT_START;
        }
    }

    /**
     * @description Create a new Quote
     * @param {object} quoteData - Quote data
     * @returns {Promise<object>} Created Quote
     */
    async create(quoteData) {
        try {
            // Generate Quote Number
            const quoteNumber = await this.generateNextNumber();
            
            // Create Quote object
            const newQuote = {
                id: generateId(),
                quoteNumber,
                createdAt: new Date().toISOString(),
                lastModifiedAt: new Date().toISOString(),
                status: STATUS_VALUES.DRAFT,
                items: [],
                totalAmount: 0,
                ...quoteData
            };

            // Validate required fields
            this.validateQuote(newQuote);

            // Save to database
            const saved = await this.db.save('quotes', newQuote);
            
            logInfo(`Created Quote: ${quoteNumber}`);
            
            // Update state
            await this.refreshQuotesList();
            
            return saved;
        } catch (error) {
            handleError(error, 'Quote Creation');
            throw error;
        }
    }

    /**
     * @description Update an existing Quote
     * @param {string} id - Quote ID
     * @param {object} updates - Updates to apply
     * @returns {Promise<object>} Updated Quote
     */
    async update(id, updates) {
        try {
            const existing = await this.db.load('quotes', id);
            if (!existing) {
                throw new Error(`Quote not found: ${id}`);
            }

            const updated = {
                ...existing,
                ...updates,
                lastModifiedAt: new Date().toISOString(),
                editedBy: stateManager.getState('app.currentUser') || 'unknown'
            };

            // Validate updated data
            this.validateQuote(updated);

            // Save to database
            const saved = await this.db.save('quotes', updated);
            
            logInfo(`Updated Quote: ${existing.quoteNumber}`);
            
            // Update state
            await this.refreshQuotesList();
            
            return saved;
        } catch (error) {
            handleError(error, 'Quote Update');
            throw error;
        }
    }

    /**
     * @description Get Quote by ID
     * @param {string} id - Quote ID
     * @returns {Promise<object>} Quote data
     */
    async getById(id) {
        try {
            const quote = await this.db.load('quotes', id);
            if (!quote) {
                throw new Error(`Quote not found: ${id}`);
            }
            return quote;
        } catch (error) {
            handleError(error, 'Quote Retrieval');
            return null;
        }
    }

    /**
     * @description Get all Quotes
     * @returns {Promise<array>} List of Quotes
     */
    async getAll() {
        try {
            return await this.db.loadAll('quotes');
        } catch (error) {
            handleError(error, 'Quotes List Retrieval');
            return [];
        }
    }

    /**
     * @description Delete Quote
     * @param {string} id - Quote ID
     * @returns {Promise<boolean>} Success status
     */
    async delete(id) {
        try {
            const existing = await this.db.load('quotes', id);
            if (!existing) {
                throw new Error(`Quote not found: ${id}`);
            }

            await this.db.delete('quotes', id);
            
            logInfo(`Deleted Quote: ${existing.quoteNumber}`);
            
            // Update state
            await this.refreshQuotesList();
            
            return true;
        } catch (error) {
            handleError(error, 'Quote Deletion');
            return false;
        }
    }

    /**
     * @description Search Quotes
     * @param {string} query - Search query
     * @param {string} field - Field to search in
     * @returns {Promise<array>} Filtered Quotes
     */
    async search(query, field = 'all') {
        try {
            const allQuotes = await this.getAll();
            
            if (!query || query.trim() === '') {
                return allQuotes;
            }

            const searchTerm = query.toLowerCase().trim();
            
            return allQuotes.filter(quote => {
                switch (field) {
                    case 'quoteNumber':
                        return quote.quoteNumber?.toLowerCase().includes(searchTerm);
                    case 'client':
                        return quote.clientName?.toLowerCase().includes(searchTerm);
                    case 'pcNumber':
                        return quote.pcNumber?.toLowerCase().includes(searchTerm);
                    case 'all':
                    default:
                        return Object.values(quote).some(value => 
                            value && value.toString().toLowerCase().includes(searchTerm)
                        );
                }
            });
        } catch (error) {
            handleError(error, 'Quotes Search');
            return [];
        }
    }

    /**
     * @description Get Quotes by PC Number
     * @param {string} pcId - PC Number ID
     * @returns {Promise<array>} Quotes for PC Number
     */
    async getByPcNumber(pcId) {
        try {
            const allQuotes = await this.getAll();
            return allQuotes.filter(quote => quote.pcId === pcId);
        } catch (error) {
            handleError(error, 'Quotes by PC Number');
            return [];
        }
    }

    /**
     * @description Get Quotes by status
     * @param {string} status - Status to filter by
     * @returns {Promise<array>} Filtered Quotes
     */
    async getByStatus(status) {
        try {
            const allQuotes = await this.getAll();
            return allQuotes.filter(quote => quote.status === status);
        } catch (error) {
            handleError(error, 'Quotes Status Filter');
            return [];
        }
    }

    /**
     * @description Get recent Quotes
     * @param {number} limit - Number of records to return
     * @returns {Promise<array>} Recent Quotes
     */
    async getRecent(limit = 10) {
        try {
            const allQuotes = await this.getAll();
            return allQuotes
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, limit);
        } catch (error) {
            handleError(error, 'Recent Quotes Retrieval');
            return [];
        }
    }

    /**
     * @description Get Quotes statistics
     * @returns {Promise<object>} Statistics
     */
    async getStatistics() {
        try {
            const allQuotes = await this.getAll();
            
            const stats = {
                total: allQuotes.length,
                draft: 0,
                approved: 0,
                declined: 0,
                pending: 0,
                totalValue: 0,
                averageValue: 0
            };

            allQuotes.forEach(quote => {
                // Count by status
                if (quote.status === STATUS_VALUES.DRAFT) stats.draft++;
                else if (quote.status === STATUS_VALUES.APPROVED) stats.approved++;
                else if (quote.status === STATUS_VALUES.DECLINED) stats.declined++;
                else if (quote.status === STATUS_VALUES.PENDING) stats.pending++;

                // Calculate value statistics
                const value = parseFloat(quote.totalAmount) || 0;
                stats.totalValue += value;
            });

            stats.averageValue = stats.total > 0 ? stats.totalValue / stats.total : 0;

            return stats;
        } catch (error) {
            handleError(error, 'Quotes Statistics');
            return { total: 0, draft: 0, approved: 0, declined: 0, pending: 0, totalValue: 0, averageValue: 0 };
        }
    }

    /**
     * @description Load companies for quote modal
     * @returns {Promise<array>} List of unique companies
     */
    async loadCompanies() {
        try {
            const pcNumbers = await this.db.loadAll('pcNumbers');
            
            // Extract unique companies from PC Numbers
            const companies = [...new Set(pcNumbers.map(pc => pc.company || pc.clientName).filter(Boolean))].sort();
            
            // Update state
            stateManager.setState('data.allCompanies', companies);
            
            logDebug(`Loaded ${companies.length} unique companies`);
            return companies;
        } catch (error) {
            handleError(error, 'Load Companies');
            return [];
        }
    }

    /**
     * @description Search companies
     * @param {string} searchTerm - Search term
     * @returns {array} Filtered companies
     */
    searchCompanies(searchTerm) {
        try {
            const allCompanies = stateManager.getState('data.allCompanies', []);
            
            if (!searchTerm || searchTerm.trim().length === 0) {
                return allCompanies;
            }

            const term = searchTerm.toLowerCase();
            return allCompanies.filter(company => 
                company.toLowerCase().includes(term)
            );
        } catch (error) {
            handleError(error, 'Search Companies');
            return [];
        }
    }

    /**
     * @description Filter PC Numbers by company
     * @param {string} companyName - Company name to filter by
     * @returns {Promise<array>} Filtered PC Numbers
     */
    async filterPcNumbersByCompany(companyName = null) {
        try {
            const allPcNumbers = stateManager.getState('data.allPcNumbers', []);
            
            if (!companyName || companyName.trim() === '') {
                return allPcNumbers;
            }

            const filtered = allPcNumbers.filter(pc => 
                (pc.company === companyName) || (pc.clientName === companyName)
            );

            logDebug(`Filtered PC Numbers: ${filtered.length} of ${allPcNumbers.length} for company: "${companyName}"`);
            return filtered;
        } catch (error) {
            handleError(error, 'Filter PC Numbers by Company');
            return [];
        }
    }

    /**
     * @description Add item to quote
     * @param {string} quoteId - Quote ID
     * @param {object} item - Quote item
     * @returns {Promise<object>} Updated quote
     */
    async addItem(quoteId, item) {
        try {
            const quote = await this.getById(quoteId);
            if (!quote) {
                throw new Error(`Quote not found: ${quoteId}`);
            }

            const newItem = {
                id: generateId(),
                ...item,
                addedAt: new Date().toISOString()
            };

            const updatedItems = [...(quote.items || []), newItem];
            const totalAmount = this.calculateTotal(updatedItems);

            return await this.update(quoteId, {
                items: updatedItems,
                totalAmount
            });
        } catch (error) {
            handleError(error, 'Add Quote Item');
            throw error;
        }
    }

    /**
     * @description Remove item from quote
     * @param {string} quoteId - Quote ID
     * @param {string} itemId - Item ID
     * @returns {Promise<object>} Updated quote
     */
    async removeItem(quoteId, itemId) {
        try {
            const quote = await this.getById(quoteId);
            if (!quote) {
                throw new Error(`Quote not found: ${quoteId}`);
            }

            const updatedItems = (quote.items || []).filter(item => item.id !== itemId);
            const totalAmount = this.calculateTotal(updatedItems);

            return await this.update(quoteId, {
                items: updatedItems,
                totalAmount
            });
        } catch (error) {
            handleError(error, 'Remove Quote Item');
            throw error;
        }
    }

    /**
     * @description Calculate quote total
     * @param {array} items - Quote items
     * @returns {number} Total amount
     */
    calculateTotal(items) {
        if (!Array.isArray(items)) return 0;
        
        return items.reduce((total, item) => {
            const quantity = parseFloat(item.quantity) || 0;
            const unitPrice = parseFloat(item.unitPrice) || 0;
            return total + (quantity * unitPrice);
        }, 0);
    }

    /**
     * @description Validate Quote data
     * @param {object} quoteData - Quote data to validate
     */
    validateQuote(quoteData) {
        const errors = [];

        // Required fields
        if (!quoteData.pcId || quoteData.pcId.trim() === '') {
            errors.push('PC Number is required');
        }

        if (!quoteData.priceListId || quoteData.priceListId.trim() === '') {
            errors.push('Price List is required');
        }

        // Value validation
        if (quoteData.totalAmount && isNaN(parseFloat(quoteData.totalAmount))) {
            errors.push('Total amount must be a valid number');
        }

        if (errors.length > 0) {
            throw new Error(`Validation failed: ${errors.join(', ')}`);
        }
    }

    /**
     * @description Refresh Quotes list in state
     */
    async refreshQuotesList() {
        try {
            const quotes = await this.getAll();
            stateManager.setState('data.allQuotes', quotes);
            stateManager.setState('original.quotes', [...quotes]);
            logDebug(`Refreshed Quotes list: ${quotes.length} items`);
        } catch (error) {
            logError('Failed to refresh Quotes list:', error);
        }
    }

    /**
     * @description Set current Quote in state
     * @param {object} quote - Quote to set as current
     */
    setCurrentQuote(quote) {
        stateManager.setState('current.quote', quote);
        logDebug('Current Quote set:', quote?.quoteNumber);
    }

    /**
     * @description Get current Quote from state
     * @returns {object|null} Current Quote
     */
    getCurrentQuote() {
        return stateManager.getState('current.quote');
    }

    /**
     * @description Clear current Quote from state
     */
    clearCurrentQuote() {
        stateManager.setState('current.quote', null);
        logDebug('Current Quote cleared');
    }

    /**
     * @description Set selected quote data for building
     * @param {object} quoteData - Quote selection data
     */
    setSelectedQuoteData(quoteData) {
        stateManager.setState('ui.selectedQuoteData', quoteData);
        logDebug('Selected quote data set:', quoteData);
    }

    /**
     * @description Get selected quote data
     * @returns {object|null} Selected quote data
     */
    getSelectedQuoteData() {
        return stateManager.getState('ui.selectedQuoteData');
    }

    /**
     * @description Clear selected quote data
     */
    clearSelectedQuoteData() {
        stateManager.setState('ui.selectedQuoteData', null);
        logDebug('Selected quote data cleared');
    }
}

// Export factory function
export const createQuoteService = (database, migrationManager) => {
    return new QuoteService(database, migrationManager);
};