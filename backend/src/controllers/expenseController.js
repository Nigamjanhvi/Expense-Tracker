const prisma = require('../prisma');
const SplitCalculator = require('../services/splitService');

async function getActiveMembers(groupId, date) {
  const memberships = await prisma.groupMembership.findMany({
    where: { groupId },
    include: { user: true }
  });
  const expenseDateStr = date instanceof Date ? date.toISOString().split('T')[0] : new Date(date).toISOString().split('T')[0];

  return memberships
    .filter(m => {
      const joinedAtStr = m.joinedAt.toISOString().split('T')[0];
      if (!m.leftAt) {
        return joinedAtStr <= expenseDateStr;
      }
      const leftAtStr = m.leftAt.toISOString().split('T')[0];
      return joinedAtStr <= expenseDateStr && expenseDateStr <= leftAtStr;
    })
    .map(m => m.user.id);
}

async function createExpense(req, res, next) {
  try {
    const groupId = Number(req.params.id);
    const { description, amount, currency, paidById, date, splitType, splitDetails, participantIds, notes } = req.body;
    const createdById = req.user.id;

    if (!description || !amount || !paidById || !date || !splitType) {
      return res.status(400).json({ message: 'Missing required expense fields' });
    }

    const numericAmount = Number(amount);
    let amountInr = numericAmount;
    let finalNotes = notes || '';

    if (currency === 'USD') {
      amountInr = Number((numericAmount * 83.5).toFixed(2));
      finalNotes = `Converted from USD ${numericAmount} at rate 83.5. ${finalNotes}`.trim();
    }

    const activeMemberIds = await getActiveMembers(groupId, date);
    
    // Validate payer is active
    if (!activeMemberIds.includes(Number(paidById))) {
      return res.status(400).json({ message: 'The paying member is not active on the transaction date' });
    }

    let targetParticipantIds = participantIds;
    if (targetParticipantIds && Array.isArray(targetParticipantIds)) {
      if (targetParticipantIds.length === 0) {
        return res.status(400).json({ message: 'At least one participant must be selected' });
      }
      const allActive = targetParticipantIds.every(pId => activeMemberIds.includes(Number(pId)));
      if (!allActive) {
        return res.status(400).json({ message: 'One or more selected participants are not active on the transaction date' });
      }
      targetParticipantIds = targetParticipantIds.map(Number);
    } else {
      if (activeMemberIds.length === 0) {
        return res.status(400).json({ message: 'No active members in the group on this date' });
      }
      targetParticipantIds = activeMemberIds;
    }

    // Calculate splits
    const splits = SplitCalculator.calculate(amountInr, targetParticipantIds, splitType, splitDetails);

    // Write to DB in a transaction
    const expense = await prisma.$transaction(async (tx) => {
      const exp = await tx.expense.create({
        data: {
          groupId,
          description,
          amount: numericAmount,
          currency: currency || 'INR',
          amountInr,
          paidById: Number(paidById),
          date: new Date(date),
          splitType,
          notes: finalNotes,
          createdById
        }
      });

      await tx.expenseSplit.createMany({
        data: splits.map(s => ({
          expenseId: exp.id,
          userId: s.userId,
          amountOwed: s.amountOwed
        }))
      });

      return tx.expense.findUnique({
        where: { id: exp.id },
        include: { splits: true }
      });
    });

    return res.status(201).json(expense);
  } catch (err) {
    next(err);
  }
}

async function listExpenses(req, res, next) {
  try {
    const groupId = Number(req.params.id);

    const expenses = await prisma.expense.findMany({
      where: {
        groupId,
        isDeleted: false,
        isSettlement: false
      },
      include: {
        paidBy: {
          select: { id: true, fullName: true, email: true }
        },
        splits: {
          include: {
            user: {
              select: { id: true, fullName: true }
            }
          }
        }
      },
      orderBy: {
        date: 'desc'
      }
    });

    return res.json(expenses);
  } catch (err) {
    next(err);
  }
}

async function getExpense(req, res, next) {
  try {
    const expenseId = Number(req.params.id);

    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: {
        paidBy: {
          select: { id: true, fullName: true, email: true }
        },
        splits: {
          include: {
            user: {
              select: { id: true, fullName: true }
            }
          }
        }
      }
    });

    if (!expense || expense.isDeleted) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    return res.json(expense);
  } catch (err) {
    next(err);
  }
}

async function updateExpense(req, res, next) {
  try {
    const expenseId = Number(req.params.id);
    const { description, amount, currency, paidById, date, splitType, splitDetails, participantIds, notes } = req.body;

    const existingExpense = await prisma.expense.findUnique({
      where: { id: expenseId }
    });

    if (!existingExpense || existingExpense.isDeleted) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    const numericAmount = Number(amount || existingExpense.amount);
    let amountInr = numericAmount;
    let finalNotes = notes ?? existingExpense.notes ?? '';

    const finalCurrency = currency || existingExpense.currency;
    if (finalCurrency === 'USD') {
      amountInr = Number((numericAmount * 83.5).toFixed(2));
      finalNotes = `Converted from USD ${numericAmount} at rate 83.5. ${finalNotes}`.trim();
    }

    const finalDate = date ? new Date(date) : existingExpense.date;
    const finalPaidById = paidById ? Number(paidById) : existingExpense.paidById;
    const finalSplitType = splitType || existingExpense.splitType;

    const activeMemberIds = await getActiveMembers(existingExpense.groupId, finalDate);
    
    // Validate payer is active
    if (!activeMemberIds.includes(Number(finalPaidById))) {
      return res.status(400).json({ message: 'The paying member is not active on the transaction date' });
    }

    let targetParticipantIds = participantIds;
    if (targetParticipantIds && Array.isArray(targetParticipantIds)) {
      if (targetParticipantIds.length === 0) {
        return res.status(400).json({ message: 'At least one participant must be selected' });
      }
      const allActive = targetParticipantIds.every(pId => activeMemberIds.includes(Number(pId)));
      if (!allActive) {
        return res.status(400).json({ message: 'One or more selected participants are not active on the transaction date' });
      }
      targetParticipantIds = targetParticipantIds.map(Number);
    } else {
      if (activeMemberIds.length === 0) {
        return res.status(400).json({ message: 'No active members on this date' });
      }
      targetParticipantIds = activeMemberIds;
    }

    const splits = SplitCalculator.calculate(amountInr, targetParticipantIds, finalSplitType, splitDetails);

    const updatedExpense = await prisma.$transaction(async (tx) => {
      // Delete old splits
      await tx.expenseSplit.deleteMany({
        where: { expenseId }
      });

      // Create new splits
      await tx.expenseSplit.createMany({
        data: splits.map(s => ({
          expenseId,
          userId: s.userId,
          amountOwed: s.amountOwed
        }))
      });

      // Update expense
      return tx.expense.update({
        where: { id: expenseId },
        data: {
          description: description || existingExpense.description,
          amount: numericAmount,
          currency: finalCurrency,
          amountInr,
          paidById: finalPaidById,
          date: finalDate,
          splitType: finalSplitType,
          notes: finalNotes
        },
        include: { splits: true }
      });
    });

    return res.json(updatedExpense);
  } catch (err) {
    next(err);
  }
}

async function deleteExpense(req, res, next) {
  try {
    const expenseId = Number(req.params.id);

    await prisma.expense.update({
      where: { id: expenseId },
      data: { isDeleted: true }
    });

    return res.json({ message: 'Expense deleted' });
  } catch (err) {
    next(err);
  }
}

async function createSettlement(req, res, next) {
  try {
    const groupId = Number(req.params.id);
    const { paidById, paidToId, amount, date, notes } = req.body;

    if (!paidById || !paidToId || !amount || !date) {
      return res.status(400).json({ message: 'Missing required settlement fields' });
    }

    const settlement = await prisma.settlement.create({
      data: {
        groupId,
        paidById: Number(paidById),
        paidToId: Number(paidToId),
        amount: Number(amount),
        date: new Date(date),
        notes: notes || ''
      },
      include: {
        paidBy: { select: { fullName: true } },
        paidTo: { select: { fullName: true } }
      }
    });

    return res.status(201).json(settlement);
  } catch (err) {
    next(err);
  }
}

async function listSettlements(req, res, next) {
  try {
    const groupId = Number(req.params.id);

    const settlements = await prisma.settlement.findMany({
      where: { groupId },
      include: {
        paidBy: { select: { id: true, fullName: true } },
        paidTo: { select: { id: true, fullName: true } }
      },
      orderBy: {
        date: 'desc'
      }
    });

    return res.json(settlements);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createExpense,
  listExpenses,
  getExpense,
  updateExpense,
  deleteExpense,
  createSettlement,
  listSettlements
};
