# Comprehensive List of System Improvements

*(Grouped by system area; each group includes data model, UI/UX, and process logic changes)*

---

## 1. **PC Number Section**

- **Remove or hide unnecessary fields**  
  - **Crown Branch**, **Surveyor**, and **Referral Type** are not needed.
- **Split “Client Category” into two separate attributes**  
  1. **Industry / Sector** (Media, Education, etc.) – single‑select.  
  2. **Job Type** (Relocation, Clearance, Disposal, Storage, Office Renew, Office Resale, Move Management, Heavy Move) – **multi‑select** check‑boxes instead of a dropdown.  
     - Ultimately move this second attribute into the *Quote* section.
- **Client Source**  
  - Merge *Client Source* and *Client Referral* into a single field:  
    - Web Enquiry, Business Development, Existing Customer, Cross Referral, Internal (CWS/Crown), etc.
- **Required contact**  
  - Minimum requirement: **phone _or_ e‑mail**; contact name is enough – remove *position* / *email* fields from collection/delivery addresses.
- **Addresses in PC Number**  
  - **Completely remove** address fields (collection/delivery) from this section; if an address is entered, only the postcode should be mandatory.
- **Quote limit per PC Number**  
  - Add a control: when the defined quote limit is exceeded, require approval (or block further quotes).
- **UX enhancements**  
  - After creating a PC Number, keep the user on the record screen instead of returning to the list.  
  - Add quick filters on the PC Number list: “My Records”, search by PC Number and Reference.

---

## 2. **Quote Section**

- **New initial field structure**  
  - **Type of Move** (museum, lab, office …) – dropdown.  
  - **Quoted Activities** – check‑boxes (Clearance, Move, Office Resale …).
- **Addresses and contacts**  
  - Move collection/delivery here; enable “Same as Collection” (check‑box) and allow later edits.
- **Rate card summary & rate editing**  
  - After selecting a rate card, display a summary of rates; allow adjustments **only** in the Quote (not in the Price List).
- **Human Resources**  
  - Introduce three hourly rates (Standard, OT1, OT2) + optional *number of days* to auto‑calculate hours.
- **Vehicles & Crates**  
  - Separate the sections; Crates become an independent block (partially moved from Price List).
- **Recycling & Rebates**  
  - Add “Other Recycling Charges” and “Other Rebate” (description field).  
  - Detail Rebates: Furniture (per audit), IT Resale (separate), Metal (weight + metal type).
- **Declared Value / Liability**  
  - Field appears **after** quote acceptance; default is GBP 100 k, editable.
- **Quote statuses**  
  - Establish workflow: **DRAFT → ISSUED / AWAITING DECISION → WON \| LOST \| RENEGOTIATION**.
- **PDF generation**  
  - Fix the bug that swaps the client name to “Relocation Services Ltd”.  
  - PDF must show both addresses, the quote title, and a choice: total value *or* itemised.
- **Editing / versioning**  
  - Allow quote updates until status **Won**; changing status to **Renegotiation** unlocks editing.  
  - Ability to create a new quote under the same PC Number for **additional scope**.
- **Attachments**  
  - Enable file uploads (Web Orders, Furniture Audits).

---

## 3. **Activity Section**

- **Automatic pre‑population**  
  - Client, addresses, resources, and vehicles from the quote are loaded by default (check‑box “Import from Quote”).
- **Duplication / recurring jobs**  
  - “Duplicate Activity” button for quick cloning of multi‑day or daily tasks.
- **Field validation**  
  - Reduce the number of mandatory fields; an activity should save even if optional data is missing.
- **Job statuses**  
  - **Confirmed / Non‑Confirmed** (check‑box) and **Active / Cancelled** (check‑box).
- **Special instructions & multi‑day jobs**  
  - *Special Instructions* inherit from the quote; when cloning an activity, instructions are preserved.
- **Job‑sheet printing**  
  - Add “Print Job Sheet” button with a parameterised PDF template (resources, address, instructions).
- **Working hours**  
  - Automatic hour calculator (Depot Start → Depot Finish) + OT summary.
- **“Team Name” column**  
  - Visible in the activity list and on the job‑sheet.
- **Bug‑fixes**  
  - The activity should re‑open after saving.

---

## 4. **General / Technical Features**

- **Fix save and search errors**  
  - Quotes sometimes fail to save or “disappear” from search results.
- **Central “Rate Card” module**  
  - View for quick preview/edit of rate cards from within a quote (link “Manage Price List”).
- **Resource / Activity calendar** *(nice‑to‑have)*  
  - Calendar view with filters (departments, teams, statuses).
- **Support multiple Crown divisions**  
  - Ability to create linked job‑sheets for Move Managers, IT Relocations, Interiors – separate “sub‑activities” or separate PC Numbers.
- **Version control & continuous improvement**  
  - After production deployment, leave a “feature flags” / configuration mechanism to roll out iterative changes without downtime.

---

## 5. **Implementation Priorities (recommended order)**

1. **Critical bug‑fixes** (saving quotes, PDF, re‑opening activities).  
2. **Field and workflow refactor in PC Number & Quote** (addresses, categories, statuses).  
3. **Automation and activity duplication**.  
4. **Functional extensions** (Crates, Recycling, Rebates, Declared Value).  
5. **Nice‑to‑have** (calendar, central Rate Card, feature flags).

---

> With this backlog we can move on to detailed sprint planning – let me know if I missed anything before we start coding! 😉

