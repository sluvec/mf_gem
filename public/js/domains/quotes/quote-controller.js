/**
 * @fileoverview Quotes Controller
 * @description Handles Quotes UI interactions and form management
 */

import { logDebug, logError } from '../../utils.js';
import { uiModals } from '../../ui-modals.js';
import { formValidator, FORM_CONFIGS } from '../../shared/form-validator.js';
import { stateManager } from '../../shared/state-manager.js';
import { handleError, wrapFormOperation } from '../../shared/error-handler.js';
import { SUCCESS_MESSAGES, ERROR_MESSAGES, MODAL_IDS } from '../../shared/constants.js';

/**
 * @description Quotes controller for UI interactions
 */
export class QuoteController {
    constructor(quoteService, pcService) {
        this.quoteService = quoteService;
        this.pcService = pcService;
        this.setupEventListeners();
        this.registerFormValidation();
    }

    /**
     * @description Setup event listeners
     */
    setupEventListeners() {
        // Register form submission handlers
        this.handleNewQuoteSubmit = wrapFormOperation(
            this.handleNewQuoteSubmit.bind(this), 
            'Quote Creation'
        );
    }

    /**
     * @description Register form validation
     */
    registerFormValidation() {
        formValidator.registerForm('new-quote-form', FORM_CONFIGS.QUOTE);
    }

    /**
     * @description Show new Quote modal
     */
    async showNewQuoteModal() {
        try {
            // Load all data for the quote modal
            await Promise.all([
                this.loadCompaniesForQuoteModal(),
                this.loadPcNumbersForQuoteModal(),
                this.loadPriceListsForQuoteModal()
            ]);
            
            // If we're in a PC detail view, pre-select the current PC
            const currentPC = this.pcService.getCurrentPcNumber();
            if (currentPC && currentPC.id) {
                const pcSelect = document.getElementById('quote-modal-pc');
                if (pcSelect) {
                    pcSelect.value = currentPC.id;
                }
            }
            
            // Set up form submission handler
            const form = document.getElementById('new-quote-form');
            if (form) {
                form.onsubmit = this.handleNewQuoteSubmit.bind(this);
                formValidator.clearAllFieldErrors('new-quote-form');
            }
            
            uiModals.openModal(MODAL_IDS.QUOTE);
            logDebug('New Quote modal opened');
        } catch (error) {
            handleError(error, 'Show New Quote Modal');
            uiModals.showToast(ERROR_MESSAGES.LOAD_FAILED, 'error');
        }
    }

    /**
     * @description Load companies for quote modal
     */
    async loadCompaniesForQuoteModal() {
        try {
            await this.quoteService.loadCompanies();
            logDebug('Companies loaded for quote modal');
        } catch (error) {
            handleError(error, 'Load Companies for Quote Modal');
        }
    }

    /**
     * @description Load PC Numbers for quote modal
     */
    async loadPcNumbersForQuoteModal() {
        try {
            const pcNumbers = await this.pcService.getAll();
            stateManager.setState('data.allPcNumbers', pcNumbers);
            
            // Populate PC Numbers dropdown
            this.populatePcNumbersDropdown(pcNumbers);
            
            logDebug(`Loaded ${pcNumbers.length} PC Numbers for quote modal`);
        } catch (error) {
            handleError(error, 'Load PC Numbers for Quote Modal');
        }
    }

    /**
     * @description Load Price Lists for quote modal
     */
    async loadPriceListsForQuoteModal() {
        try {
            const priceLists = await this.db.loadAll('priceLists');
            
            const priceListSelect = document.getElementById('quote-modal-pricelist');
            if (priceListSelect) {
                priceListSelect.innerHTML = '<option value="">Select Price List...</option>';
                
                priceLists.forEach(priceList => {
                    const option = document.createElement('option');
                    option.value = priceList.id;
                    option.textContent = `${priceList.name} (${priceList.items?.length || 0} items)`;
                    priceListSelect.appendChild(option);
                });
            }
            
            logDebug(`Loaded ${priceLists.length} price lists for quote modal`);
        } catch (error) {
            handleError(error, 'Load Price Lists for Quote Modal');
        }
    }

    /**
     * @description Populate PC Numbers dropdown
     * @param {array} pcNumbers - PC Numbers to populate
     */
    populatePcNumbersDropdown(pcNumbers) {
        const pcSelect = document.getElementById('quote-modal-pc');
        if (!pcSelect) return;

        pcSelect.innerHTML = '<option value="">Select PC Number...</option>';
        
        pcNumbers.forEach(pc => {
            const option = document.createElement('option');
            option.value = pc.id;
            option.textContent = `${pc.pcNumber} - ${pc.company || pc.clientName || 'No Company'} - ${pc.projectTitle || 'No Title'}`;
            pcSelect.appendChild(option);
        });
    }

    /**
     * @description Handle company search
     * @param {string} searchTerm - Search term
     */
    searchCompanies(searchTerm) {
        try {
            const resultsContainer = document.getElementById('company-search-results');
            if (!resultsContainer) return;

            if (!searchTerm || searchTerm.trim().length === 0) {
                resultsContainer.style.display = 'none';
                // Show all PC Numbers when no company is searched
                this.filterPcNumbersByCompany('');
                return;
            }

            const filteredCompanies = this.quoteService.searchCompanies(searchTerm);

            if (filteredCompanies.length === 0) {
                resultsContainer.innerHTML = '<div class="company-result">No companies found</div>';
                resultsContainer.style.display = 'block';
                return;
            }

            // Create company results HTML
            const resultsHTML = filteredCompanies.map(company => 
                `<div class="company-result" 
                     onmousedown="event.preventDefault(); window.quoteController.selectCompany('${company.replace(/'/g, "\\\'")}')"
                     onclick="window.quoteController.selectCompany('${company.replace(/'/g, "\\\'")}')">${company}</div>`
            ).join('');

            resultsContainer.innerHTML = resultsHTML;
            resultsContainer.style.display = 'block';

            logDebug(`Found ${filteredCompanies.length} companies matching: "${searchTerm}"`);
        } catch (error) {
            handleError(error, 'Search Companies');
        }
    }

    /**
     * @description Select a company
     * @param {string} companyName - Selected company name
     */
    selectCompany(companyName) {
        try {
            const companyInput = document.getElementById('quote-modal-company');
            const resultsContainer = document.getElementById('company-search-results');
            
            if (companyInput) {
                companyInput.value = companyName;
            }
            
            if (resultsContainer) {
                resultsContainer.style.display = 'none';
            }

            // Filter PC Numbers by selected company
            this.filterPcNumbersByCompany(companyName);
            
            logDebug(`Selected company: ${companyName}`);
        } catch (error) {
            handleError(error, 'Select Company');
        }
    }

    /**
     * @description Show company dropdown
     */
    showCompanyDropdown() {
        try {
            const companyInput = document.getElementById('quote-modal-company');
            if (companyInput) {
                this.searchCompanies(companyInput.value);
            }
        } catch (error) {
            handleError(error, 'Show Company Dropdown');
        }
    }

    /**
     * @description Hide company dropdown
     */
    hideCompanyDropdown() {
        try {
            // Small delay to allow click events to process
            setTimeout(() => {
                const resultsContainer = document.getElementById('company-search-results');
                if (resultsContainer) {
                    resultsContainer.style.display = 'none';
                }
            }, 200);
        } catch (error) {
            handleError(error, 'Hide Company Dropdown');
        }
    }

    /**
     * @description Filter PC Numbers by company
     * @param {string} companyName - Company name to filter by
     */
    async filterPcNumbersByCompany(companyName = null) {
        try {
            // Get company name from parameter or input field
            const selectedCompany = companyName !== null ? companyName : 
                document.getElementById('quote-modal-company')?.value || '';
            
            const filteredPcNumbers = await this.quoteService.filterPcNumbersByCompany(selectedCompany);
            
            // Update PC Numbers dropdown
            const pcSelect = document.getElementById('quote-modal-pc');
            if (!pcSelect) return;

            pcSelect.innerHTML = '<option value="">Select PC Number...</option>';
            
            // Add filtered PC Number options
            filteredPcNumbers.forEach(pc => {
                const option = document.createElement('option');
                option.value = pc.id;
                option.textContent = `${pc.pcNumber} - ${pc.company || pc.clientName || 'No Company'} - ${pc.projectTitle || 'No Title'}`;
                pcSelect.appendChild(option);
            });

            // Show feedback about filtering
            if (selectedCompany && selectedCompany.trim() !== '' && filteredPcNumbers.length === 0) {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = `No PC Numbers found for "${selectedCompany}"`;
                option.disabled = true;
                pcSelect.appendChild(option);
            }

            logDebug(`Filtered PC Numbers: ${filteredPcNumbers.length} for company: "${selectedCompany}"`);
        } catch (error) {
            handleError(error, 'Filter PC Numbers by Company');
        }
    }

    /**
     * @description Handle new quote form submission
     * @param {Event} event - Form submit event
     */
    async handleNewQuoteSubmit(event) {
        event.preventDefault();
        
        try {
            // Validate form
            const validation = formValidator.validateForm('new-quote-form');
            if (!validation.isValid) {
                logDebug('Quote form validation failed');
                return false;
            }
            
            const pcId = document.getElementById('quote-modal-pc').value;
            const priceListId = document.getElementById('quote-modal-pricelist').value;
            
            if (!pcId) {
                uiModals.showToast('Please select a PC Number', 'error');
                return false;
            }
            
            if (!priceListId) {
                uiModals.showToast('Please select a Price List', 'error');
                return false;
            }
            
            // Store selections for quote builder
            this.quoteService.setSelectedQuoteData({
                pcId: pcId,
                priceListId: priceListId
            });
            
            // Close modal and proceed to quote builder
            uiModals.closeModal(MODAL_IDS.QUOTE);
            this.proceedToQuoteBuilder();
            
            logDebug('Quote form submitted successfully');
            return true;
        } catch (error) {
            handleError(error, 'Quote Form Submission');
            uiModals.showToast(ERROR_MESSAGES.SAVE_FAILED, 'error');
            return false;
        }
    }

    /**
     * @description Proceed to quote builder
     */
    proceedToQuoteBuilder() {
        try {
            // Use stored quote data or fallback to form values
            const quoteData = this.quoteService.getSelectedQuoteData() || {
                pcId: document.getElementById('quote-modal-pc')?.value,
                priceListId: document.getElementById('quote-modal-pricelist')?.value
            };
            
            if (!quoteData.pcId) {
                uiModals.showToast('Please select a PC Number first', 'error');
                return;
            }
            
            if (!quoteData.priceListId) {
                uiModals.showToast('Please select a Price List first', 'error');
                return;
            }
            
            // Navigate to quote builder page
            const app = stateManager.getState('app.instance');
            if (app && app.navigateToPage) {
                app.navigateToPage('quote-builder');
            }
            
            // Set the title and prepare quote builder
            const titleElement = document.getElementById('quote-builder-title');
            if (titleElement) {
                titleElement.textContent = 'New Quote - Setting up...';
            }
            
            logDebug('Proceeding to quote builder with data:', quoteData);
        } catch (error) {
            handleError(error, 'Proceed to Quote Builder');
        }
    }

    /**
     * @description View Quote details
     * @param {string} id - Quote ID
     */
    async viewQuoteDetails(id) {
        try {
            const quoteData = await this.quoteService.getById(id);
            if (!quoteData) {
                uiModals.showToast(ERROR_MESSAGES.LOAD_FAILED, 'error');
                return;
            }

            // Set current Quote
            this.quoteService.setCurrentQuote(quoteData);

            // Navigate to Quote detail page (assuming this exists)
            const app = stateManager.getState('app.instance');
            if (app && app.showQuoteDetail) {
                app.showQuoteDetail(id);
            }
            
            logDebug('Viewing Quote details:', quoteData.quoteNumber);
        } catch (error) {
            handleError(error, 'View Quote Details');
        }
    }

    /**
     * @description Delete Quote
     * @param {string} id - Quote ID
     */
    async deleteQuote(id) {
        try {
            const quoteData = await this.quoteService.getById(id);
            if (!quoteData) {
                uiModals.showToast(ERROR_MESSAGES.LOAD_FAILED, 'error');
                return;
            }

            const confirmed = confirm(`Are you sure you want to delete Quote ${quoteData.quoteNumber}?`);
            if (!confirmed) return;

            const success = await this.quoteService.delete(id);
            if (success) {
                uiModals.showToast(SUCCESS_MESSAGES.DELETED, 'success');
                await this.refreshPageIfNeeded();
                logDebug('Quote deleted:', quoteData.quoteNumber);
            }
        } catch (error) {
            handleError(error, 'Delete Quote');
        }
    }

    /**
     * @description Refresh page if currently viewing Quotes
     */
    async refreshPageIfNeeded() {
        const currentPage = stateManager.getState('app.currentPage');
        if (currentPage === 'quotes') {
            const app = stateManager.getState('app.instance');
            if (app && app.loadQuotesData) {
                await app.loadQuotesData();
            }
        }
    }

    /**
     * @description Close quote modal
     */
    closeQuoteModal() {
        uiModals.closeModal(MODAL_IDS.QUOTE);
        this.quoteService.clearSelectedQuoteData();
    }

    /**
     * @description Update Quotes list display
     * @param {array} quotes - Quotes to display
     */
    updateQuotesList(quotes) {
        stateManager.setState('data.allQuotes', quotes);
        // Trigger UI update if needed
        const app = stateManager.getState('app.instance');
        if (app && app.renderQuotesList) {
            app.renderQuotesList(quotes);
        }
    }

    /**
     * @description Search quotes
     * @param {string} query - Search query
     * @param {string} field - Field to search in
     */
    async searchQuotes(query, field = 'all') {
        try {
            const results = await this.quoteService.search(query, field);
            this.updateQuotesList(results);
        } catch (error) {
            handleError(error, 'Search Quotes');
        }
    }

    /**
     * @description Filter quotes by status
     * @param {string} status - Status to filter by
     */
    async filterByStatus(status) {
        try {
            const results = await this.quoteService.getByStatus(status);
            this.updateQuotesList(results);
        } catch (error) {
            handleError(error, 'Filter Quotes by Status');
        }
    }

    /**
     * @description Clear all filters
     */
    async clearFilters() {
        try {
            const allQuotes = stateManager.getState('original.quotes', []);
            this.updateQuotesList(allQuotes);
        } catch (error) {
            handleError(error, 'Clear Quote Filters');
        }
    }
}

// Export factory function
export const createQuoteController = (quoteService, pcService) => {
    return new QuoteController(quoteService, pcService);
};