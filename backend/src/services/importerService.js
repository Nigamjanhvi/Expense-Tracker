const { parse } = require('csv-parse/sync');
const prisma = require('../prisma');
const SplitCalculator = require('./splitService');

const USD_TO_INR_RATE = 83.5;
const CANONICAL_NAMES = ['Aisha', 'Rohan', 'Priya', 'Meera', 'Sam', 'Dev', 'Kabir'];

function normalizeName(nameStr) {
  if (!nameStr) return '';
  const name = nameStr.trim().toLowerCase();
  
  if (name.startsWith('aisha')) return 'Aisha';
  if (name.startsWith('rohan')) return 'Rohan';
  if (name.startsWith('priya')) return 'Priya';
  if (name.startsWith('meera')) return 'Meera';
  if (name.startsWith('sam')) return 'Sam';
  if (name.startsWith('dev')) return 'Dev';
  if (name.startsWith('kabir')) return 'Kabir';
  
  // Title case fallback
  return nameStr.trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function parseSplitDetails(splitDetailsStr, validMembers) {
  const splitDetails = {};
  if (!splitDetailsStr) return splitDetails;

  try {
    const obj = JSON.parse(splitDetailsStr);
    for (const k of Object.keys(obj)) {
      const normKey = normalizeName(k);
      const u = validMembers.find(m => m.fullName === normKey || m.id === Number(k));
      if (u) {
        splitDetails[u.id] = Number(obj[k]);
      }
    }
  } catch (e) {
    const pairs = splitDetailsStr.split(/[,;|]/);
    for (const pair of pairs) {
      const parts = pair.split(/[:=]/);
      if (parts.length === 2) {
        const name = parts[0].trim();
        const normName = normalizeName(name);
        const val = Number(parts[1].trim());
        const u = validMembers.find(m => m.fullName === normName || m.id === Number(name));
        if (u) {
          splitDetails[u.id] = val;
        }
      }
    }
  }
  return splitDetails;
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  const dStr = dateStr.trim();
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) {
    const d = new Date(dStr);
    if (!isNaN(d.getTime())) return d;
  }

  const parts = dStr.split(/[\/\-]/);
  if (parts.length === 3) {
    const p0 = parseInt(parts[0], 10);
    const p1 = parseInt(parts[1], 10);
    const p2 = parseInt(parts[2], 10);
    
    if (p2 > 1000) {
      const date1 = new Date(p2, p1 - 1, p0);
      if (p1 <= 12 && p0 <= 31 && !isNaN(date1.getTime())) {
        return date1;
      }
      const date2 = new Date(p2, p0 - 1, p1);
      if (p0 <= 12 && p1 <= 31 && !isNaN(date2.getTime())) {
        return date2;
      }
    }
  }

  const standardDate = new Date(dStr);
  if (!isNaN(standardDate.getTime())) {
    return standardDate;
  }

  return null;
}

function checkDuplicates(rows) {
  const counts = {};
  const dupIndices = new Set();
  rows.forEach((row) => {
    const d = row.date ? row.date.trim() : '';
    const desc = row.description ? row.description.toLowerCase().trim() : '';
    const amt = row.amount ? row.amount.trim() : '';
    const hash = `${d}|${desc}|${amt}`;
    counts[hash] = (counts[hash] || 0) + 1;
  });
  rows.forEach((row, i) => {
    const d = row.date ? row.date.trim() : '';
    const desc = row.description ? row.description.toLowerCase().trim() : '';
    const amt = row.amount ? row.amount.trim() : '';
    const hash = `${d}|${desc}|${amt}`;
    if (counts[hash] > 1) {
      dupIndices.add(i);
    }
  });
  return dupIndices;
}

function checkSettlement(row) {
  const desc = (row.description || '').toLowerCase();
  const keywords = ['settlement', 'settle', 'paid back', 'returned', 'reimburs', 'refund', 'clearing'];
  return keywords.some(k => desc.includes(k));
}

async function getOrAddGroupMember(normName, groupId) {
  const email = `${normName.toLowerCase()}@gmail.com`;
  let user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    const dummyPasswordHash = 'AUTO_GENERATED_IMPORT_USER';
    user = await prisma.user.create({
      data: {
        email,
        fullName: normName,
        passwordHash: dummyPasswordHash
      }
    });
  }

  const membership = await prisma.groupMembership.findFirst({
    where: { groupId, userId: user.id }
  });

  if (!membership) {
    let joinedAt = new Date('2026-02-01');
    let leftAt = null;
    if (normName === 'Sam') joinedAt = new Date('2026-04-15');
    if (normName === 'Meera') {
      joinedAt = new Date('2026-02-01');
      leftAt = new Date('2026-03-31');
    }
    await prisma.groupMembership.create({
      data: {
        groupId,
        userId: user.id,
        joinedAt,
        leftAt
      }
    });
  }

  return user;
}

class CSVImporter {
  async run(fileBuffer, session, group, importedBy) {
    const csvContent = fileBuffer.toString('utf-8');
    const rows = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    let totalRows = rows.length;
    let cleanRows = 0;
    let flaggedRows = 0;
    let rejectedRows = 0;
    let reclassifiedRows = 0;

    const dupIndices = checkDuplicates(rows);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // header is row 1

      try {
        // 1. Missing Payer Anomaly
        if (!row.paid_by) {
          await prisma.importAnomaly.create({
            data: {
              sessionId: session.id,
              rowNumber: rowNum,
              rawData: row,
              anomalyType: 'MISSING_PAYER',
              description: 'Transaction record is missing the payer field.',
              actionTaken: 'rejected'
            }
          });
          rejectedRows++;
          continue;
        }

        // 2. Missing Currency Anomaly
        if (!row.currency) {
          await prisma.importAnomaly.create({
            data: {
              sessionId: session.id,
              rowNumber: rowNum,
              rawData: row,
              anomalyType: 'MISSING_CURRENCY',
              description: 'Transaction record is missing the currency field.',
              actionTaken: 'imported_with_warning' // Warning only, default to INR
            }
          });
        }

        // 3. Ambiguous/Invalid Date
        const parsedDate = parseDate(row.date);
        if (!parsedDate) {
          await prisma.importAnomaly.create({
            data: {
              sessionId: session.id,
              rowNumber: rowNum,
              rawData: row,
              anomalyType: 'AMBIGUOUS_DATE',
              description: `Date field "${row.date || 'Empty'}" is missing or unparseable.`,
              actionTaken: 'rejected'
            }
          });
          rejectedRows++;
          continue;
        }

        // 4. Zero / Empty Amount Anomaly
        const rawAmt = parseFloat(row.amount || '0');
        if (isNaN(rawAmt) || rawAmt === 0) {
          await prisma.importAnomaly.create({
            data: {
              sessionId: session.id,
              rowNumber: rowNum,
              rawData: row,
              anomalyType: 'ZERO_AMOUNT',
              description: 'Transaction amount is zero or empty.',
              actionTaken: 'rejected'
            }
          });
          rejectedRows++;
          continue;
        }

        // 5. Negative Amount (Refund)
        const isNegative = rawAmt < 0;
        const finalAmount = Math.abs(rawAmt);

        if (isNegative && !checkSettlement(row)) {
          await prisma.importAnomaly.create({
            data: {
              sessionId: session.id,
              rowNumber: rowNum,
              rawData: row,
              anomalyType: 'NEGATIVE_AMOUNT',
              description: `Negative amount ${rawAmt} converted to absolute value refund.`,
              actionTaken: 'imported_with_warning'
            }
          });
        }

        // 6. Duplicate Detection
        if (dupIndices.has(i)) {
          await prisma.importAnomaly.create({
            data: {
              sessionId: session.id,
              rowNumber: rowNum,
              rawData: row,
              anomalyType: 'DUPLICATE_EXPENSE',
              description: `Duplicate expense row detected.`,
              actionTaken: 'flagged_for_review'
            }
          });
          flaggedRows++;
          continue;
        }

        // 7. Resolve Payer Name and checking Unknown User
        const payerNorm = normalizeName(row.paid_by);
        if (!CANONICAL_NAMES.includes(payerNorm)) {
          await prisma.importAnomaly.create({
            data: {
              sessionId: session.id,
              rowNumber: rowNum,
              rawData: row,
              anomalyType: 'UNKNOWN_MEMBER',
              description: `Payer "${row.paid_by}" is not a recognized member of the group.`,
              actionTaken: 'flagged_for_review'
            }
          });
          flaggedRows++;
          continue;
        }

        const payerUser = await getOrAddGroupMember(payerNorm, group.id);

        // Check if Payer was active on expense date
        const payerMembership = await prisma.groupMembership.findFirst({
          where: { groupId: group.id, userId: payerUser.id }
        });

        const expenseDateStr = parsedDate.toISOString().split('T')[0];
        const payerJoinedStr = payerMembership.joinedAt.toISOString().split('T')[0];
        const payerLeftStr = payerMembership.leftAt ? payerMembership.leftAt.toISOString().split('T')[0] : null;

        if (expenseDateStr < payerJoinedStr) {
          await prisma.importAnomaly.create({
            data: {
              sessionId: session.id,
              rowNumber: rowNum,
              rawData: row,
              anomalyType: 'MEMBER_NOT_YET_JOINED',
              description: `Payer "${payerUser.fullName}" paid before their join date.`,
              actionTaken: 'flagged_for_review'
            }
          });
          flaggedRows++;
          continue;
        }

        if (payerLeftStr && expenseDateStr > payerLeftStr) {
          await prisma.importAnomaly.create({
            data: {
              sessionId: session.id,
              rowNumber: rowNum,
              rawData: row,
              anomalyType: 'MEMBER_LEFT_BEFORE_EXPENSE',
              description: `Payer "${payerUser.fullName}" paid after leaving the group.`,
              actionTaken: 'flagged_for_review'
            }
          });
          flaggedRows++;
          continue;
        }

        const isSettlement = checkSettlement(row);
        const originalCurrency = (row.currency || 'INR').trim().toUpperCase();
        const amountInr = originalCurrency === 'USD' ? finalAmount * USD_TO_INR_RATE : finalAmount;
        const currencyNote = originalCurrency === 'USD' ? `Converted from USD ${finalAmount} at rate 83.5` : '';

        // 8. USD Currency conversion warning
        if (originalCurrency === 'USD') {
          await prisma.importAnomaly.create({
            data: {
              sessionId: session.id,
              rowNumber: rowNum,
              rawData: row,
              anomalyType: 'USD_EXPENSE',
              description: `Currency converted from USD to INR at rate 83.5.`,
              actionTaken: 'imported_with_conversion'
            }
          });
        }

        // 9. Settlement Reclassification
        if (isSettlement) {
          let payToUser = null;
          if (row.split_with) {
            const list = row.split_with.split(/[,;|]/).map(n => normalizeName(n.trim())).filter(Boolean);
            if (list.length > 0 && CANONICAL_NAMES.includes(list[0])) {
              payToUser = await getOrAddGroupMember(list[0], group.id);
            }
          }
          if (!payToUser) {
            payToUser = importedBy;
          }

          await prisma.settlement.create({
            data: {
              groupId: group.id,
              paidById: payerUser.id,
              paidToId: payToUser.id,
              amount: amountInr,
              date: parsedDate,
              notes: `Auto-reclassified settlement. ${currencyNote}`
            }
          });

          await prisma.importAnomaly.create({
            data: {
              sessionId: session.id,
              rowNumber: rowNum,
              rawData: row,
              anomalyType: 'SETTLEMENT_AS_EXPENSE',
              description: `Row reclassified as settlement between ${payerUser.fullName} and ${payToUser.fullName}.`,
              actionTaken: 'reclassified_as_settlement'
            }
          });

          reclassifiedRows++;
          continue;
        }

        // 10. Split Type validations
        const splitType = (row.split_type || 'equal').toLowerCase();
        if (!['equal', 'exact', 'percentage', 'shares'].includes(splitType)) {
          await prisma.importAnomaly.create({
            data: {
              sessionId: session.id,
              rowNumber: rowNum,
              rawData: row,
              anomalyType: 'SPLIT_TYPE_CONFLICT',
              description: `Unsupported split type "${row.split_type}".`,
              actionTaken: 'rejected'
            }
          });
          rejectedRows++;
          continue;
        }

        // 11. Parse split participants list
        let rawSplitNames = [];
        if (row.split_with) {
          rawSplitNames = row.split_with.split(/[,;|]/).map(n => n.trim()).filter(Boolean);
        } else {
          // Default to all canonical users
          rawSplitNames = CANONICAL_NAMES;
        }

        const validMembers = [];
        let hasUnknownInSplit = false;

        for (const name of rawSplitNames) {
          const norm = normalizeName(name);
          if (!CANONICAL_NAMES.includes(norm)) {
            await prisma.importAnomaly.create({
              data: {
                sessionId: session.id,
                rowNumber: rowNum,
                rawData: row,
                anomalyType: 'UNKNOWN_MEMBER',
                description: `Unknown member "${name}" listed in splits.`,
                actionTaken: 'flagged_for_review'
              }
            });
            hasUnknownInSplit = true;
            break;
          }

          const user = await getOrAddGroupMember(norm, group.id);
          const membership = await prisma.groupMembership.findFirst({
            where: { groupId: group.id, userId: user.id }
          });

          const jStr = membership.joinedAt.toISOString().split('T')[0];
          const lStr = membership.leftAt ? membership.leftAt.toISOString().split('T')[0] : null;

          if (expenseDateStr < jStr) {
            await prisma.importAnomaly.create({
              data: {
                sessionId: session.id,
                rowNumber: rowNum,
                rawData: row,
                anomalyType: 'MEMBER_NOT_YET_JOINED',
                description: `Excluded "${user.fullName}" - transaction date is before they joined.`,
                actionTaken: 'member_excluded_from_split'
              }
            });
          } else if (lStr && expenseDateStr > lStr) {
            await prisma.importAnomaly.create({
              data: {
                sessionId: session.id,
                rowNumber: rowNum,
                rawData: row,
                anomalyType: 'MEMBER_LEFT_BEFORE_EXPENSE',
                description: `Excluded "${user.fullName}" - transaction date is after they left.`,
                actionTaken: 'member_excluded_from_split'
              }
            });
          } else {
            validMembers.push(user);
          }
        }

        if (hasUnknownInSplit) {
          flaggedRows++;
          continue;
        }

        if (validMembers.length === 0) {
          await prisma.importAnomaly.create({
            data: {
              sessionId: session.id,
              rowNumber: rowNum,
              rawData: row,
              anomalyType: 'SPLIT_TYPE_CONFLICT',
              description: `No active members available to split this expense.`,
              actionTaken: 'rejected'
            }
          });
          rejectedRows++;
          continue;
        }

        // 12. Split details validations for custom split modes
        if (['exact', 'percentage', 'shares'].includes(splitType) && !row.split_details) {
          await prisma.importAnomaly.create({
            data: {
              sessionId: session.id,
              rowNumber: rowNum,
              rawData: row,
              anomalyType: 'SPLIT_TYPE_CONFLICT',
              description: `Missing split details for split mode "${splitType}".`,
              actionTaken: 'rejected'
            }
          });
          rejectedRows++;
          continue;
        }

        // Percentage sums validation
        if (splitType === 'percentage') {
          let sum = 0;
          const detailsStr = row.split_details || '';
          try {
            const obj = JSON.parse(detailsStr);
            sum = Object.values(obj).reduce((acc, val) => acc + Number(val), 0);
          } catch (e) {
            const pairs = detailsStr.split(/[,;]/);
            for (const pair of pairs) {
              const parts = pair.split(/[:=]/);
              if (parts.length === 2) sum += Number(parts[1].trim());
            }
          }

          if (Math.abs(sum - 100) > 0.5) {
            await prisma.importAnomaly.create({
              data: {
                sessionId: session.id,
                rowNumber: rowNum,
                rawData: row,
                anomalyType: 'PERCENTAGE_SUM',
                description: `Percentage splits sum to ${sum}% instead of 100%.`,
                actionTaken: 'flagged_for_review'
              }
            });
            flaggedRows++;
            continue;
          }
        }

        // Payer not in split warning
        const isPayerInSplit = validMembers.some(m => m.id === payerUser.id);
        if (!isPayerInSplit) {
          await prisma.importAnomaly.create({
            data: {
              sessionId: session.id,
              rowNumber: rowNum,
              rawData: row,
              anomalyType: 'PAYER_NOT_IN_SPLIT',
              description: `Payer "${payerUser.fullName}" is excluded from the split participants list.`,
              actionTaken: 'imported_with_warning'
            }
          });
        }

        // Parse Split Details
        const parsedSplitDetails = parseSplitDetails(row.split_details, validMembers);

        // Calculate and create splits
        const memberIds = validMembers.map(u => u.id);
        const splits = SplitCalculator.calculate(amountInr, memberIds, splitType, parsedSplitDetails);

        await prisma.$transaction(async (tx) => {
          const expense = await tx.expense.create({
            data: {
              groupId: group.id,
              description: row.description || 'Imported Expense',
              amount: finalAmount,
              currency: originalCurrency,
              amountInr,
              paidById: payerUser.id,
              date: parsedDate,
              splitType,
              notes: `Auto-imported. ${currencyNote}`,
              createdById: importedBy.id
            }
          });

          await tx.expenseSplit.createMany({
            data: splits.map(s => ({
              expenseId: expense.id,
              userId: s.userId,
              amountOwed: s.amountOwed
            }))
          });
        });

        cleanRows++;
      } catch (err) {
        console.error(`Error importing row ${rowNum}:`, err);
        await prisma.importAnomaly.create({
          data: {
            sessionId: session.id,
            rowNumber: rowNum,
            rawData: row,
            anomalyType: 'SPLIT_TYPE_CONFLICT',
            description: `Fatal processing error: ${err.message}`,
            actionTaken: 'rejected'
          }
        });
        rejectedRows++;
      }
    }

    // Save report tallies
    const updatedSession = await prisma.importSession.update({
      where: { id: session.id },
      data: {
        totalRows,
        cleanRows,
        flaggedRows,
        rejectedRows,
        reclassifiedRows
      }
    });

    return {
      session: updatedSession,
      imported: cleanRows,
      flagged: flaggedRows,
      rejected: rejectedRows,
      reclassified: reclassifiedRows
    };
  }
}

module.exports = CSVImporter;
