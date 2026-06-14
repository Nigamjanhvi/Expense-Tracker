# Architectural Decisions Log

This document lists the 8 key engineering and architectural decisions made during the design of the Spreetail Shared Expenses application.

---

## Decision 1: Relational Database Choice (PostgreSQL via Prisma ORM)
*   **Options Considered:** MongoDB, SQLite, PostgreSQL
*   **Rationale Chosen:** Relational databases are optimized for strongly normalized financial schemas (e.g. users, memberships, expenses, splits). Referential constraints ensure that a split cannot belong to a non-existent user or expense. PostgreSQL was chosen over SQLite to handle concurrent writes in production environments. Prisma is used to provide auto-generated client models and migration management.

## Decision 2: Fixed USD-INR Exchange Rate (1 USD = 83.5 INR)
*   **Options Considered:** Dynamically fetching exchange rates via currency APIs, setting a fixed rate.
*   **Rationale Chosen:** Dynamic API calls introduce runtime latency, network failure points, and inconsistent historical calculations (an expense converted last week would compute to a different INR amount if calculated today). Using a fixed, documented rate of `83.5` ensures deterministic conversions and high availability.

## Decision 3: Soft-Deletion of Expense Records (`isDeleted` flag)
*   **Options Considered:** Hard delete (removing rows from database tables), Soft-delete (updating `isDeleted = true`).
*   **Rationale Chosen:** Deleting financial records directly breaks audit logs and compromises data reconciliation. Soft-deletion keeps the transaction history intact in the database while filtering it out of active balance and breakdown calculations.

## Decision 4: Row-by-Row Fault Tolerance during CSV Import
*   **Options Considered:** Single transaction abort (one bad row fails the entire import), Row-by-row error wrapping (successful rows are saved, bad rows generate anomaly records).
*   **Rationale Chosen:** CSV logs uploaded by users frequently contain minor formatting, date boundary, or duplicate issues. Aborting the entire import forces users to manually inspect files and fix them, which is a poor user experience. Catching errors row-by-row permits valid expenses to go through instantly while capturing problem lines in the Flagged/Rejected panel.

## Decision 5: Membership Date-Bounded Expense Calculation
*   **Options Considered:** Global group splits (splitting expenses among all members), Date-bounded splits (filtering splitting users to only those who were active on the expense date).
*   **Rationale Chosen:** In real-world flat shares, roommates join and leave at different times. A member who joined in April should not owe money for a electricity bill paid in February. Checking `joinedAt` and `leftAt` bounds prevents historical debt leaks.

## Decision 6: Token Auth Storage (JWT in localStorage)
*   **Options Considered:** HTTP-Only secure cookies, LocalStorage.
*   **Rationale Chosen:** In standard single-page app development with cross-origin deployments (Railway and Vercel), setting cross-domain cookies introduces complex CORS and security policy issues. Storing the JWT token in LocalStorage simplifies auth persistence and fits mobile/web cross-compatibility requirements.

## Decision 7: Atomic Expense and Splits Writes (Prisma `$transaction`)
*   **Options Considered:** Separate writes (create expense, then create splits in subsequent queries), Database transactions.
*   **Rationale Chosen:** If the server crashes or encounters a validation error after saving the expense but before saving its splits, the database is left in a corrupted state where a bill exists but nobody owes anything. Wrapping both steps in a Prisma transaction makes the operation atomic (both succeed or both fail).

## Decision 8: Consolidating Debt transfers (Greedy Min-Transfers Algorithm)
*   **Options Considered:** Pairwise payments (everyone pays their exact creditor directly), Simplified transfers (greedy balance matching).
*   **Rationale Chosen:** If User A owes User B ₹500, and User B owes User C ₹500, pairwise payments require two transfers. Min-transfers simplifies this so that User A pays User C ₹500 directly, minimizing cash transfers and reducing group friction.
