# AI Usage & Developer Corrections Log

This log lists the AI tooling, main system prompts, and three specific corrections implemented to debug or optimize the code.

---

## 1. AI Tools & Prompt Context

- **AI Tools Used:** Claude 3.5 Sonnet, GitHub Copilot.
- **Primary Prompt:** "Build me a complete full-stack shared expenses web application. Follow every instruction exactly. Do not skip anything. Do not ask questions — make decisions and leave comments explaining them."

---

## 2. Cases Where AI Was Wrong & Fixed

### Case 1: CSV Sync Import Subpath Crash
- **What the AI generated:** The AI suggested importing `csv-parse` using:
  ```javascript
  const parse = require('csv-parse');
  ```
  or calling a non-existent sync helper on the default import.
- **Why it was wrong:** In `csv-parse` version 5, CommonJS subpath exports require importing sync parser explicitly from the `/sync` subpath. Using the default import in CommonJS causes undefined errors.
- **What was fixed:** The import statement in `importerService.js` was modified to:
  ```javascript
  const { parse } = require('csv-parse/sync');
  ```

### Case 2: Financial Mismatches in Shares Splitting
- **What the AI generated:** The AI calculated percentage and shares split amounts without checking if the sum of all members' calculated shares matches the target amount exactly, allowing float divisions to accumulate rounding errors.
- **Why it was wrong:** A split amount of ₹10 split by shares (e.g. 1 share each for 3 people) resulted in ₹3.33 + ₹3.33 + ₹3.33 = ₹9.99, leaving a leak of ₹0.01 that fails db constraint matches.
- **What was fixed:** A correction layer was introduced to track a running sum and allocate any leftover cent/rupee rounding remainder to the final member in `splitService.js`.

### Case 3: Timezone Shifts in Active Member Date Comparisons
- **What the AI generated:** The AI compared date bounds using raw Date object comparisons:
  ```javascript
  const isActive = joinedAt <= date && (!leftAt || date <= leftAt);
  ```
- **Why it was wrong:** Prisma maps `@db.Date` fields to UTC JavaScript Date objects (e.g. `2024-02-01T00:00:00.000Z`). Selecting dates on the client side translates dates in local timezone. Comparing raw Date objects near boundaries shifts active bounds by one day due to timezone offsets.
- **What was fixed:** Created a helper function in `balanceService.js` and `importerService.js` to normalize all dates to timezone-neutral `YYYY-MM-DD` strings before conducting string comparisons.
