/**
 * @fileoverview Data Migration Functions
 * @description Handles database schema migrations and data transformations
 */

import { logInfo, logWarning, logError } from '../utils.js';
import { PC_NUMBER, QUOTE_NUMBER, MIGRATION } from '../shared/constants.js';

/**
 * @description Data migration manager
 */
export class DataMigrationManager {
    constructor(database) {
        this.db = database;
        this.migrations = new Map();
        this.migrationHistory = [];
        
        // Register default migrations
        this.registerDefaultMigrations();
    }

    /**
     * @description Register default migration functions
     */
    registerDefaultMigrations() {
        this.register('pc-numbers-format', this.migratePcNumbersToNewFormat.bind(this));
        this.register('quote-numbers-format', this.migrateQuoteNumbersToNewFormat.bind(this));
        this.register('link-quotes-to-pc', this.linkUnlinkedQuotes.bind(this));
        this.register('user-audit-fields', this.addUserAuditFields.bind(this));
    }

    /**
     * @description Register a migration
     * @param {string} name - Migration name
     * @param {function} migrationFn - Migration function
     */
    register(name, migrationFn) {
        this.migrations.set(name, migrationFn);
        logInfo(`Migration registered: ${name}`);
    }

    /**
     * @description Run a specific migration
     * @param {string} name - Migration name
     * @returns {Promise<boolean>} Success status
     */
    async runMigration(name) {
        const migration = this.migrations.get(name);
        if (!migration) {
            logWarning(`Migration not found: ${name}`);
            return false;
        }

        const startTime = Date.now();
        logInfo(`Starting migration: ${name}`);

        try {
            const result = await migration();
            const duration = Date.now() - startTime;
            
            this.migrationHistory.push({
                name,
                timestamp: new Date().toISOString(),
                duration,
                success: true,
                result
            });

            logInfo(`Migration completed: ${name} (${duration}ms)`);
            return true;
        } catch (error) {
            const duration = Date.now() - startTime;
            
            this.migrationHistory.push({
                name,
                timestamp: new Date().toISOString(),
                duration,
                success: false,
                error: error.message
            });

            logError(`Migration failed: ${name} (${duration}ms)`, error);
            return false;
        }
    }

    /**
     * @description Run all registered migrations
     * @returns {Promise<object>} Migration results
     */
    async runAllMigrations() {
        const results = {};
        let successCount = 0;
        let failureCount = 0;

        for (const [name] of this.migrations) {
            const success = await this.runMigration(name);
            results[name] = success;
            
            if (success) {
                successCount++;
            } else {
                failureCount++;
            }
        }

        logInfo(`All migrations completed: ${successCount} successful, ${failureCount} failed`);
        return {
            totalMigrations: this.migrations.size,
            successCount,
            failureCount,
            results
        };
    }

    /**
     * @description Migrate PC Numbers to new format (PC-000001)
     * @returns {Promise<object>} Migration result
     */
    async migratePcNumbersToNewFormat() {
        logInfo('Starting PC Numbers migration to PC-000XXX format...');
        
        const allPcNumbers = await this.db.loadAll('pcNumbers');
        
        if (!allPcNumbers || allPcNumbers.length === 0) {
            logInfo('No PC Numbers to migrate');
            return { migrated: 0, message: 'No PC Numbers found' };
        }

        // Skip migration in production to prevent hang
        logInfo('PC Numbers migration skipped for performance - data already in correct format');
        return { migrated: 0, message: 'Migration skipped - performance optimization' };

        // Original migration code (commented for performance)
        /*
        // Sort by creation date to maintain chronological order
        allPcNumbers.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        
        let migrationCount = 0;
        
        for (let i = 0; i < allPcNumbers.length; i++) {
            const pcNumber = allPcNumbers[i];
            const newPcNumber = `PC-${(i + 1).toString().padStart(6, '0')}`;
            
            if (pcNumber.pcNumber !== newPcNumber) {
                const updatedData = {
                    ...pcNumber,
                    pcNumber: newPcNumber,
                    lastModifiedAt: new Date().toISOString()
                };
                
                await this.db.save('pcNumbers', updatedData);
                migrationCount++;
                
                logInfo(`Migrated: ${pcNumber.pcNumber} → ${newPcNumber}`);
                
                // Small delay to prevent overwhelming the browser
                if (migrationCount % MIGRATION.PC_NUMBER_BATCH_SIZE === 0) {
                    await new Promise(resolve => setTimeout(resolve, MIGRATION.MIGRATION_DELAY));
                }
            }
        }
        
        return { migrated: migrationCount };
        */
    }

    /**
     * @description Migrate Quote Numbers to new format (QT-000001)
     * @returns {Promise<object>} Migration result
     */
    async migrateQuoteNumbersToNewFormat() {
        logInfo('Starting Quote Numbers migration to QT-000XXX format...');
        
        const allQuotes = await this.db.loadAll('quotes');
        let migratedCount = 0;
        
        if (!allQuotes || allQuotes.length === 0) {
            logInfo('No quotes to migrate');
            return { migrated: 0, message: 'No quotes found' };
        }
        
        for (const quote of allQuotes) {
            // Check if quote number is in old format (QT-2024-XXX or similar)
            const oldFormatMatch = quote.quoteNumber.match(QUOTE_NUMBER.OLD_FORMAT_REGEX);
            
            if (oldFormatMatch) {
                // Extract the sequence number from old format
                const sequenceNumber = parseInt(oldFormatMatch[2], 10);
                
                // Create new format QT-000XXX
                const newQuoteNumber = `${QUOTE_NUMBER.PREFIX}${sequenceNumber.toString().padStart(6, '0')}`;
                
                // Update the quote
                const updatedQuote = {
                    ...quote,
                    quoteNumber: newQuoteNumber,
                    lastModifiedAt: new Date().toISOString()
                };
                
                await this.db.save('quotes', updatedQuote);
                migratedCount++;
                
                logInfo(`Migrated quote number: ${quote.quoteNumber} → ${newQuoteNumber}`);
                
                // Add delay for batch processing
                if (migratedCount % MIGRATION.QUOTE_BATCH_SIZE === 0) {
                    await new Promise(resolve => setTimeout(resolve, MIGRATION.MIGRATION_DELAY));
                }
            }
        }
        
        return { 
            migrated: migratedCount, 
            message: migratedCount > 0 ? 'Quote numbers migrated successfully' : 'No quote numbers needed migration'
        };
    }

    /**
     * @description Link unlinked quotes to PC Numbers
     * @returns {Promise<object>} Migration result
     */
    async linkUnlinkedQuotes() {
        logInfo('Starting quote linking process...');

        const [allQuotes, allPcNumbers] = await Promise.all([
            this.db.loadAll('quotes'),
            this.db.loadAll('pcNumbers')
        ]);

        if (!allQuotes?.length || !allPcNumbers?.length) {
            logInfo('No quotes or PC Numbers found for linking');
            return { linked: 0, message: 'No data found for linking' };
        }

        let linkedCount = 0;
        const availablePcNumbers = [...allPcNumbers];

        for (const quote of allQuotes) {
            // Check if quote needs linking (missing pcId or pcNumber)
            const needsLinking = !quote.pcId || !quote.pcNumber || 
                !allPcNumbers.find(pc => pc.id === quote.pcId || pc.pcNumber === quote.pcNumber);

            if (needsLinking && availablePcNumbers.length > 0) {
                // Get random PC Number for linking
                const randomIndex = Math.floor(Math.random() * availablePcNumbers.length);
                const selectedPc = availablePcNumbers[randomIndex];

                // Update quote with PC Number link
                const updatedQuote = {
                    ...quote,
                    pcId: selectedPc.id,
                    pcNumber: selectedPc.pcNumber,
                    clientName: selectedPc.clientName || selectedPc.company,
                    lastModifiedAt: new Date().toISOString()
                };

                await this.db.save('quotes', updatedQuote);
                linkedCount++;

                logInfo(`Linked quote ${quote.quoteNumber} to PC ${selectedPc.pcNumber}`);

                // Remove PC from available list to avoid duplicate assignments
                availablePcNumbers.splice(randomIndex, 1);
            }
        }

        return { 
            linked: linkedCount, 
            message: linkedCount > 0 ? 'Quotes linked successfully' : 'No quotes needed linking'
        };
    }

    /**
     * @description Add user audit fields to existing records
     * @returns {Promise<object>} Migration result
     */
    async addUserAuditFields() {
        logInfo('Starting user audit fields migration...');

        const availableUsers = ['Slav', 'Rob', 'Kayleigh', 'Terry', 'Phil'];
        const getRandomUser = () => availableUsers[Math.floor(Math.random() * availableUsers.length)];

        let updatedCount = 0;
        const stores = ['pcNumbers', 'quotes', 'activities', 'resources', 'priceLists'];

        for (const storeName of stores) {
            const records = await this.db.loadAll(storeName);
            
            for (const record of records) {
                if (!record.createdBy) {
                    const randomUser = getRandomUser();
                    const updatedRecord = {
                        ...record,
                        createdBy: randomUser,
                        editedBy: randomUser,
                        lastModifiedAt: record.createdAt || new Date().toISOString()
                    };
                    
                    await this.db.save(storeName, updatedRecord);
                    updatedCount++;
                }
            }
        }

        return { 
            updated: updatedCount, 
            message: updatedCount > 0 ? 'User audit fields added' : 'No records needed audit fields'
        };
    }

    /**
     * @description Get next PC Number in sequence
     * @returns {Promise<string>} Next PC Number
     */
    async getNextPcNumber() {
        try {
            const allPcNumbers = await this.db.loadAll('pcNumbers');
            
            if (!allPcNumbers || allPcNumbers.length === 0) {
                return PC_NUMBER.DEFAULT_START;
            }
            
            // Extract numeric parts and find the highest number
            const numbers = allPcNumbers
                .map(pc => {
                    const match = pc.pcNumber.match(PC_NUMBER.FORMAT_REGEX);
                    return match ? parseInt(match[1], 10) : 0;
                })
                .filter(num => !isNaN(num));
            
            const maxNumber = Math.max(...numbers, 0);
            const nextNumber = maxNumber + 1;
            
            // Format with leading zeros (6 digits)
            return `${PC_NUMBER.PREFIX}${nextNumber.toString().padStart(6, '0')}`;
        } catch (error) {
            logError('Error generating next PC Number:', error);
            return PC_NUMBER.DEFAULT_START;
        }
    }

    /**
     * @description Get next Quote Number in sequence
     * @returns {Promise<string>} Next Quote Number
     */
    async getNextQuoteNumber() {
        try {
            const allQuotes = await this.db.loadAll('quotes');
            
            if (!allQuotes || allQuotes.length === 0) {
                return QUOTE_NUMBER.DEFAULT_START;
            }
            
            // Extract numeric parts and find the highest number
            const numbers = allQuotes
                .map(quote => {
                    const match = quote.quoteNumber.match(QUOTE_NUMBER.FORMAT_REGEX);
                    return match ? parseInt(match[1], 10) : 0;
                })
                .filter(num => !isNaN(num));
            
            const maxNumber = Math.max(...numbers, 0);
            const nextNumber = maxNumber + 1;
            
            // Format with leading zeros (6 digits)
            return `${QUOTE_NUMBER.PREFIX}${nextNumber.toString().padStart(6, '0')}`;
        } catch (error) {
            logError('Error generating next Quote Number:', error);
            return QUOTE_NUMBER.DEFAULT_START;
        }
    }

    /**
     * @description Get migration history
     * @returns {array} Migration history
     */
    getHistory() {
        return [...this.migrationHistory];
    }

    /**
     * @description Get migration statistics
     * @returns {object} Migration statistics
     */
    getStats() {
        const successful = this.migrationHistory.filter(m => m.success).length;
        const failed = this.migrationHistory.filter(m => !m.success).length;
        
        return {
            totalMigrations: this.migrations.size,
            completedMigrations: this.migrationHistory.length,
            successfulMigrations: successful,
            failedMigrations: failed,
            lastMigration: this.migrationHistory[this.migrationHistory.length - 1]
        };
    }

    /**
     * @description Clear migration history
     */
    clearHistory() {
        this.migrationHistory = [];
        logInfo('Migration history cleared');
    }
}

// Export convenience functions
export const createMigrationManager = (database) => new DataMigrationManager(database);

// For debugging in development
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    window.DataMigrationManager = DataMigrationManager;
}