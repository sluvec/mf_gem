## Changes - 2025-08-27

- Fix: Ensure builder state initializes `recyclingItems`, `rebateItems`, and `otherCosts` so “Add” buttons in Recycling/Rebates/Other work.
- Fix: Price List “Add Item” success toast uses `priceListItem.resourceName` (handles free-text items).
- Fix: Add resource modal open reliability with null checks for inputs before clearing.
- Fix: Quote Edit modal — populate Account Manager dropdown; seed from existing data if empty; preselect current value.
- Feat: Creating a Quote from a PC pre-fills Company and Account Manager, locks the PC dropdown, and shows locked hint.
- Fix: Unified builder category tabs now track active state to refresh totals correctly (affects Vehicles and others).
- Fix: Initialization no longer clears user Quotes. Soft-migrate missing `totalAmount` instead of deleting; seed sample data only when DB is truly empty.
- Feat: “Other” category unit dropdown shows default units (each, hour, day, week, month, miles) when none defined.
- Feat: In "Other", Price is editable as price-per-unit; totals auto-recalculate; added handling to treat it as manual price.
- Fix: PC Number modal scrolling issue resolved with enhanced CSS for proper form navigation and bottom access.
- Fix: Microsoft Edge browser compatibility ensured for modal scrolling with Edge-specific CSS fixes and cross-browser support.
- Fix: Removed "App is open in another tab" checking functionality to allow multiple browser tabs to work independently.
- Fix: Updated IndexedDB version to 9 to resolve VersionError conflict and prevent database initialization failures.
- Feat: Added 'Date Created' column to PC Numbers list with sortable functionality for better project tracking.

I will keep appending any further changes made today to this file.

