# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Start local development server
npm run dev
# OR
python3 -m http.server 8000

# Access the application
open http://localhost:8000/index.html
```

## Architecture Overview

This is a **vanilla JavaScript** CRM application with **zero external dependencies**. The entire application uses:
- **ES6 modules** with native browser support
- **IndexedDB** for client-side persistence
- **Single-page architecture** with hash-based routing
- **No build process** - all code runs directly in the browser

### Core Module Structure

```
js/
├── main.js         # CRMApplication class - application coordinator (~8,685 lines)
├── database.js     # Database class - IndexedDB operations and schema (~646 lines)
├── ui-modals.js    # UIModals class - modal management (~570 lines)
└── utils.js        # Utility functions - logging, formatting, validation (~239 lines)
```

**Entry point**: `index.html` loads `js/main.js` as a module, which imports the other modules.

### Module Dependencies

```
main.js
  ├── imports: utils.js (logging, formatting)
  ├── imports: database.js (db singleton)
  └── imports: ui-modals.js (uiModals singleton)

database.js
  └── imports: utils.js (logging, ID generation)

ui-modals.js
  └── imports: utils.js (logging, sanitization, validation)
```

### Key Architectural Patterns

1. **Singleton Pattern**: `database.js` and `ui-modals.js` export singleton instances (`db`, `uiModals`)
2. **Global Application Instance**: `CRMApplication` instance is exposed as `window.app` for inline event handlers
3. **Page-based Navigation**: `navigateToPage(pageName)` shows/hides page sections and manages state
4. **IndexedDB Schema**: Version 9 with stores: `pcNumbers`, `activities`, `quotes`, `resources`, `priceLists`

### Navigation & Pages

The application uses client-side routing via `navigateToPage(pageName)`. Key pages include:

- `dashboard` - Home/overview
- `pcnumbers` - PC Numbers list (Projects/Clients)
- `pc-detail` - Individual PC Number details
- `new-pc` - Create new PC Number
- `quotes` - Quotes list
- `quote-detail` - Individual quote details
- `quote-builder` - Full-screen quote creation wizard
- `quote-preview` - Quote preview/print view
- `activities` - Activities list
- `resources` - Resources management
- `pricelists` - Price lists management
- `pricelist-detail` - Individual price list details
- `new-pricelist` - Create new price list

All page content is in `index.html` as `<div id="page-{name}">` elements that are shown/hidden.

### IndexedDB Schema (v9)

**Object Stores:**

1. **pcNumbers** - Projects/Clients
   - keyPath: `id`
   - Indexes: `pcNumber` (unique), `createdAt`, `clientCategory`, `clientSource`, `referralType`, `surveyor`, `createdBy`, `editedBy`, `lastModifiedAt`

2. **activities** - Scheduled activities/jobs
   - keyPath: `id`
   - Indexes: `pcId`, `scheduledDate`, `status`, `department`, `paymentType`, `quoteId`, `createdBy`, `editedBy`, `lastModifiedAt`

3. **quotes** - Customer quotes
   - keyPath: `id`
   - Indexes: `pcId`, `status`, `createdAt`, `version`, `priceListId`, `createdBy`, `editedBy`, `lastModifiedAt`

4. **resources** - Equipment/vehicles/materials
   - keyPath: `id`
   - Indexes: `type`, `name`

5. **priceLists** - Pricing data
   - keyPath: `id`
   - Indexes: `name`

### Quote Builder System

The Quote Builder is a **full-screen wizard** (not a modal) with multiple steps:

1. **Client & Project** - PC Number selection, client details, collection/delivery addresses
2. **Pricing** - Price list selection, currency, VAT rate
3. **Build Quote** - Add price list items (labour, vehicles, materials, other)
4. **Recycling Charges** - General, POPS, WEEE, Other (by weight or manual)
5. **Rebates** - Furniture resale, IT resale, metal, other (by weight or manual)
6. **Summary & Terms** - Final calculations, terms, save/send actions

**Important Quote Builder Rules:**
- Discount applies **only** to price list items
- Bulk (Provisional) Value is **only available** when no price list items exist
- Collection/Delivery postcodes are **required** when sending to customer (status: pending)
- Draft status allows all fields to be optional
- Quote currency is persisted from the selected price list

**Quote Model Extensions** (see QUOTE_BUILDER_PLAN.md for full schema):
- `quoteName`, `quoteDescription`
- `currency`, `vatRate`, `priceListId`
- `bulkProvisionalValue`
- `itemsPriceList[]`, `recyclingItems[]`, `rebateItems[]`, `otherCostsManual[]`
- `discount: { type, value }`
- `collectionAddress`, `deliveryAddress`
- `clientName`, `accountManager`, `propertyType`
- `validUntil`, `status`, audit fields

### Database Operations

All database operations are async via the `Database` class:

```javascript
await db.initialize()           // Must be called on app startup
await db.save(storeName, data)  // Insert or update
await db.load(storeName, id)    // Load by ID
await db.loadAll(storeName)     // Load all records
await db.delete(storeName, id)  // Delete by ID
await db.query(storeName, indexName, value) // Query by index
```

Schema upgrades are handled in `database.js` `onupgradeneeded` event handler. Current version is 9.

### State Management

The `CRMApplication` class maintains application state:

```javascript
{
  initialized: boolean,
  currentPage: string,
  currentUser: string,
  builderContext: { pcId, editingQuoteId },
  builderState: { priceListId, currency, vatRate, plItems, recyclingItems, rebateItems, otherCosts, categoryOptions },
  previewState: { showDetailedPricing, currentQuoteId },
  priceListSort: { column, direction },
  activeFilters: { activities: { company, accountManager, pcNumber } },
  calendarCache: Map,
  activitiesCache: any,
  accountManagersCache: []
}
```

## Important Implementation Details

### Inline Event Handlers

Many buttons use inline `onclick="window.app.methodName()"` or `onclick="window.functionName()"`. Global functions are exposed at the bottom of `main.js`:

```javascript
window.navigateToPage = (page) => app.navigateToPage(page);
window.showPage = (page) => app.navigateToPage(page);
window.editPC = (id) => app.editPC(id);
// ... etc
```

When adding new UI interactions, either:
1. Use inline handlers with globally-exposed functions, OR
2. Add event listeners in the page initialization code

### Date Handling

UK date format (DD/MM/YYYY) is used throughout. The app includes special parsing logic for chronological sorting of UK dates. See utility functions in `utils.js` for date formatting.

### Logging System

Centralized logging via `utils.js`:
```javascript
logDebug(...)   // Development/debugging
logInfo(...)    // General information
logWarning(...) // Warnings
logError(...)   // Errors
```

All logs are prefixed with timestamps and styled with colors.

### Modal System

The `UIModals` class provides reusable modal dialogs. Use `uiModals.showModal(type, options)` for common dialogs. Modal types are defined in `MODAL_TYPES` constant.

### Sanitization & Security

- All user input is sanitized via `sanitizeHTML()` before display
- Form validation via `validateFormData(data, rules)`
- CSP headers configured in `vercel.json`
- XSS protection via input sanitization

## Deployment

The app is configured for **Vercel** with automatic deployment on push to `main`:

- All routes rewrite to `index.html` (SPA routing)
- Static files served with correct MIME types
- Security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection)
- See `vercel.json` for full configuration

**No build process required** - just push to deploy.

## Testing During Development

Since this is vanilla JS with no test framework:

1. Test in browser console: `window.app.someMethod()`
2. Use `logDebug()` extensively
3. Test IndexedDB operations via browser DevTools → Application → IndexedDB
4. Use `python3 -m http.server` locally to avoid CORS issues

## Common Development Patterns

### Adding a New Page

1. Add `<div id="page-yourname" class="page-section">` to `index.html`
2. Add navigation case in `navigateToPage()` in `main.js`
3. Implement page rendering method (e.g., `renderYournamePage()`)
4. Add navigation button/link in UI

### Adding a Database Field

1. Update schema version in `database.js` constructor
2. Add migration logic in `onupgradeneeded` event handler
3. Update any indexes if needed
4. Update save/load operations to handle new field

### Adding a Quote Builder Feature

Refer to **QUOTE_BUILDER_PLAN.md** for the complete implementation plan. The quote builder is implemented in phases, with all core logic in `main.js`.

## File References

- **Planning docs**: `QUOTE_BUILDER_PLAN.md` - detailed quote builder specification
- **Changelog**: `CHANGELOG-2025-08-27.md` - historical changes
- **Styles**: `css/styles.css` - all application CSS (~54KB)
- **Main HTML**: `index.html` - application shell with all page sections
