## Quote Builder – Implementation Plan (Reference)

### Goals
- Full-screen Quote Builder (wizard) instead of modal.
- Price-List-driven items: Labour/HR, Vehicles, Materials, Other (from PL).
- Recycling Charges: General, POPS, WEEE, Other.
- Rebates: Furniture Resale (description + manual amount), IT Resale (by weight/manual), Metal (by weight/manual), Other (manual).
- Other Costs (manual): arbitrary items not in PL (discount does not apply).
- Client and Account Manager editable (not inherited from PC).
- Discount applies only to PL-based items; not to Recycling, Rebates, manual Other Costs.
- VAT default 20%, editable per Quote.
- Bulk (Provisional) Value allowed only when no PL items; ignored once any PL item exists.
- Addresses in Quote: Collection and Delivery (prefill Collection from PC if available), editable; both postcodes required except in Draft.

### Wizard Steps
1) Client & Project
   - PC Number (select with immediate validation), Client Name (editable), Project Title, Account Manager (editable), Property Type, Quote Name/Reference (internal, optional), Quote Description (optional).
   - Collection Address: address1..4, postcode (required on send), country.
   - Delivery Address: address1..4, postcode (required on send), country.
   - Prefill: if PC has address, use it for Collection (editable).

2) Pricing
   - Price List (required), Currency (from PL; persisted in QUOTE), VAT% (default 20, editable).

3) Build Quote (PL-driven)
   - Labour/Vehicles/Materials/Other (PL): add items from PL with qty/unit/unit price/line discount.
   - Bulk (Provisional) Value: visible only when no PL items; disabled/ignored once any PL item is added.

4) Recycling Charges
   - General, POPS, WEEE, Other; byWeight (kg × £/tonne) or manual amount.

5) Rebates
   - Furniture Resale (description + manual amount), IT (byWeight/manual), Metal (byWeight/manual), Other (manual).

6) Summary & Terms (no PDF yet)
   - SubtotalPL – Discount + RecyclingTotal + OtherCostsManualTotal + RebatesTotal = NetTotal
   - VAT% → VATAmount; Total = NetTotal + VATAmount
   - Valid Until, Standard Liability, Declared Value
   - Actions: Save Draft (Draft: all optional), Send to Customer (Pending: requires postcodes + meaningful total)

### QUOTE Model (IndexedDB) Extensions
- quoteName: string
- quoteDescription: string
- currency: string
- vatRate: number
- priceListId: string
- bulkProvisionalValue: number | null
- itemsPriceList: Array<{ id, category: 'labour'|'vehicle'|'material'|'otherPl', resourceId, name, unit, quantity, unitPrice, lineDiscount?, lineTotal }>
- recyclingItems: Array<{ id, type: 'general'|'pops'|'weee'|'other', mode: 'byWeight'|'manual', weightKg?, ratePerTonne?, amount?, lineTotal }>
- rebateItems: Array<{ id, type: 'furniture'|'it'|'metal'|'other', mode: 'byWeight'|'manual', description?, weightKg?, ratePerTonne?, amount?, lineTotal }>
- otherCostsManual: Array<{ id, description, amount, taxable?: boolean }>
- discount: { type: 'percent'|'amount', value: number }
- collectionAddress: { address1, address2, address3, address4, postcode, country }
- deliveryAddress: { address1, address2, address3, address4, postcode, country }
- clientName: string
- accountManager: string
- propertyType: string
- validUntil: ISO string
- status: 'draft'|'pending'|'approved'|'declined'|'completed'
- createdAt, lastModifiedAt, createdBy, editedBy

Indexes: status, createdAt, lastModifiedAt, priceListId, accountManager, collectionPostcode, deliveryPostcode

### Calculations
- SubtotalPL = Σ lineTotal(itemsPriceList)
- Discount: percent (cap ≤100%) or amount (cap ≤SubtotalPL); applies only to SubtotalPL
- RecyclingTotal = Σ recyclingItems.lineTotal
- RebatesTotal = Σ rebateItems.lineTotal (negative)
- OtherCostsManualTotal = Σ otherCostsManual.amount
- BulkProvisional used only if itemsPriceList.length === 0
- NetTotal = (SubtotalPL – Discount) + RecyclingTotal + OtherCostsManualTotal + RebatesTotal
- VATAmount = NetTotal × vatRate/100
- Total = NetTotal + VATAmount

### Validation
- Draft: all optional
- Pending (Send to Customer): require PC, Price List, Client, AM, both postcodes, and Total > 0
- Immediate validation on PC selection
- VAT editable (0–100), discount sane, non-negative totals

### Implementation Phases
1) Builder foundation: route New/Add Quote → #quote-builder; Step 1 (Client & Project + addresses) + Step 2 (Pricing) + minimal Step 3 (Bulk only); Save Draft; live summary for bulk.
2) PL items: resource picker from Price List, line items and recalculation.
3) Recycling & Rebates (with byWeight/manual), Other Costs (manual), refined summary.
4) Send to Customer validation + status pending; list/detail integration (currency, propertyType).
5) Migrations, indices polish; detail view enhancements.
6) Attachments/Terms/PDF (separate phase).

### Notes
- Backward compatible: show legacy fees/rebates only if new lists empty.
- Keep modal creation code temporarily; route buttons to builder.


