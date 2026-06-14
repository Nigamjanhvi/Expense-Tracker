# Project Scope, Database Schema & Anomaly Log

This document defines the relational database schema tables and describes the 12 import anomalies identified by the automated CSV reconciliation system.

---

## 1. Database Schema

We use PostgreSQL via Prisma ORM. Below is the list of all schema tables, columns, data types, and relational constraints.

### `User` Table
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | Int | PRIMARY KEY, AUTOINCREMENT | Unique identifier for users |
| `email` | String | UNIQUE, NOT NULL | User email address used for login |
| `fullName` | String | NOT NULL | Full name of the user |
| `passwordHash` | String | NOT NULL | Hashed representation of the password |
| `createdAt` | DateTime | DEFAULT `now()` | User creation timestamp |

### `ExpenseGroup` Table
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | Int | PRIMARY KEY, AUTOINCREMENT | Unique identifier for groups |
| `name` | String | NOT NULL | Name of the group |
| `description`| String | OPTIONAL | Brief description of the group's purpose |
| `createdAt` | DateTime | DEFAULT `now()` | Group creation timestamp |

### `GroupMembership` Table
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | Int | PRIMARY KEY, AUTOINCREMENT | Unique identifier for memberships |
| `groupId` | Int | FOREIGN KEY -> `ExpenseGroup(id)` | Associated group |
| `userId` | Int | FOREIGN KEY -> `User(id)` | Associated member user |
| `joinedAt` | Date | NOT NULL | Date when user joined the group |
| `leftAt` | Date | OPTIONAL | Date when user left the group (active until date if set) |
| *Composite* | UNIQUE | `(groupId, userId, joinedAt)` | Prevents duplicate overlapping joins |

### `Expense` Table
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | Int | PRIMARY KEY, AUTOINCREMENT | Unique identifier for expenses |
| `groupId` | Int | FOREIGN KEY -> `ExpenseGroup(id)` | Group in which expense occurred |
| `description`| String | NOT NULL | Description of item/service |
| `amount` | Decimal(10,2)| NOT NULL | Bill amount in raw currency |
| `currency` | String | DEFAULT `'INR'` | Original currency ('INR' or 'USD') |
| `amountInr` | Decimal(10,2)| NOT NULL | Converted amount in INR |
| `paidById` | Int | FOREIGN KEY -> `User(id)` | User who paid the bill |
| `date` | Date | NOT NULL | Transaction calendar date |
| `splitType` | String | NOT NULL | Splitting rule ('equal', 'exact', 'percentage', 'shares') |
| `isDeleted` | Boolean | DEFAULT `false` | soft-deletion marker |
| `isSettlement`| Boolean | DEFAULT `false` | Settlement marker |
| `notes` | String | OPTIONAL | Additional notes / conversion comments |
| `createdAt` | DateTime | DEFAULT `now()` | Creation timestamp |
| `createdById`| Int | FOREIGN KEY -> `User(id)` | User who recorded the expense |

### `ExpenseSplit` Table
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | Int | PRIMARY KEY, AUTOINCREMENT | Unique identifier for splits |
| `expenseId` | Int | FOREIGN KEY -> `Expense(id)` | Associated expense transaction |
| `userId` | Int | FOREIGN KEY -> `User(id)` | Debtor member owing money |
| `amountOwed` | Decimal(10,2)| NOT NULL | Consolidated amount owed by this user |
| *Composite* | UNIQUE | `(expenseId, userId)` | One split representation per user per expense |

### `Settlement` Table
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | Int | PRIMARY KEY, AUTOINCREMENT | Unique identifier for settlements |
| `groupId` | Int | FOREIGN KEY -> `ExpenseGroup(id)` | Associated group |
| `paidById` | Int | FOREIGN KEY -> `User(id)` | Debtor who paid back money |
| `paidToId` | Int | FOREIGN KEY -> `User(id)` | Creditor receiving money |
| `amount` | Decimal(10,2)| NOT NULL | Settlement transfer amount in INR |
| `date` | Date | NOT NULL | Calendar date of settlement |
| `notes` | String | OPTIONAL | Custom notes |
| `createdAt` | DateTime | DEFAULT `now()` | Recording timestamp |

### `ImportSession` Table
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | Int | PRIMARY KEY, AUTOINCREMENT | Unique identifier for import sessions |
| `fileName` | String | NOT NULL | Original uploaded filename |
| `importedAt` | DateTime | DEFAULT `now()` | Timestamp of import |
| `importedById`| Int | FOREIGN KEY -> `User(id)` | User who imported the CSV file |
| `groupId` | Int | FOREIGN KEY -> `ExpenseGroup(id)` | Group mapped for imports |
| `totalRows` | Int | DEFAULT `0` | Total CSV rows processed |
| `cleanRows` | Int | DEFAULT `0` | Count of successfully imported clean rows |
| `flaggedRows` | Int | DEFAULT `0` | Count of rows flagged for review |
| `rejectedRows`| Int | DEFAULT `0` | Count of rows rejected |
| `reclassifiedRows`| Int | DEFAULT `0` | Count of rows reclassified as settlements |

### `ImportAnomaly` Table
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | Int | PRIMARY KEY, AUTOINCREMENT | Unique identifier for anomalies |
| `sessionId` | Int | FOREIGN KEY -> `ImportSession(id)`| Associated import session |
| `rowNumber` | Int | NOT NULL | Line number of the row in the CSV |
| `rawData` | Json | NOT NULL | Original CSV row key-value data |
| `anomalyType`| String | NOT NULL | Type identifier from the codebook below |
| `description`| String | NOT NULL | Detailed warning explanation |
| `actionTaken`| String | NOT NULL | System resolution path |
| `resolution` | String | OPTIONAL | Notes left during manual resolution |
| `resolvedByUser`| Boolean| DEFAULT `false` | Marker indicating manual resolution status |
| `createdAt` | DateTime | DEFAULT `now()` | Timestamp of logging |

---

## 2. Complete Anomaly Log Table (All 12 Anomalies)

| # | Anomaly Code | Severity | Description | Default Action Taken |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `ANOMALY_DUPLICATE` | High | Duplicate expense row detected in import list (same date, description, and amount). | **Flagged for Review** (Row skipped until manual confirmation). |
| 2 | `ANOMALY_SETTLEMENT` | Medium | Row description contains settlement keywords (e.g., "paid back", "refund", "settle"). | **Reclassified as Settlement** (Recorded as Settlement instead of Expense). |
| 3 | `ANOMALY_CURRENCY_USD` | Low | Currency of transaction is marked as USD. | **Imported with Conversion** (Amount converted to INR at 83.5, recorded with conversion notes). |
| 4 | `ANOMALY_MEMBER_LEFT` | High | Member listed in split had already left the group on transaction date. | **Member Excluded from Split** (Calculates split among remaining active members). |
| 5 | `ANOMALY_MEMBER_NOT_YET_JOINED`| High | Member listed in split had not yet joined the group on transaction date. | **Member Excluded from Split** (Calculates split among remaining active members). |
| 6 | `ANOMALY_MISSING_FIELDS` | Critical | Row is missing mandatory fields (`amount`, `paid_by`, or `date`). | **Rejected** (Row skipped entirely). |
| 7 | `ANOMALY_MISSING_SPLIT_DETAILS`| High | Split type is exact, percentage, or shares, but details field is empty. | **Rejected** (Row skipped entirely). |
| 8 | `ANOMALY_PERCENTAGE_SUM` | High | Split type is percentage, but percentages do not sum to 100% (within 0.5% tolerance). | **Flagged for Review** (Row skipped until manual validation). |
| 9 | `ANOMALY_PAYER_NOT_IN_SPLIT` | Medium | The payer of the expense is not included in the list of people splitting it. | **Imported with Warning** (Proceeds with split creation, logs anomaly). |
| 10| `ANOMALY_INVALID_DATE_FORMAT` | Critical | Transaction date is invalid or does not match supported formats. | **Rejected** (Row skipped entirely). |
| 11| `ANOMALY_NEGATIVE_AMOUNT_REFUND`| Medium | Transaction amount is negative. | **Imported with Refund Warning** (Amount converted to absolute value, warning logged). |
| 12| `ANOMALY_AUTO_MEMBER_CREATED` | Medium | Payer name is not found in group; profile was automatically created and joined. | **Auto-created and Joined** (New profile created with `@import.local` email, warning logged). |
