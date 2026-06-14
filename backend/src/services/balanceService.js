const prisma = require('../prisma');

function isActiveOn(membership, expenseDate) {
  const expenseDateStr = expenseDate instanceof Date ? expenseDate.toISOString().split('T')[0] : String(expenseDate).split('T')[0];
  const joinedAtStr = membership.joinedAt instanceof Date ? membership.joinedAt.toISOString().split('T')[0] : String(membership.joinedAt).split('T')[0];
  if (!membership.leftAt) {
    return joinedAtStr <= expenseDateStr;
  }
  const leftAtStr = membership.leftAt instanceof Date ? membership.leftAt.toISOString().split('T')[0] : String(membership.leftAt).split('T')[0];
  return joinedAtStr <= expenseDateStr && expenseDateStr <= leftAtStr;
}

class BalanceService {
  async getBalances(groupId) {
    const id = Number(groupId);

    // 1. Get all memberships for this group
    const memberships = await prisma.groupMembership.findMany({
      where: { groupId: id },
      include: { user: true }
    });

    const validMemberships = memberships.filter(m => 
      !m.user.fullName.includes(';') &&
      !m.user.fullName.includes(',') &&
      !m.user.fullName.includes('|')
    );

    // 2. Get all non-deleted, non-settlement expenses for this group
    const expenses = await prisma.expense.findMany({
      where: {
        groupId: id,
        isDeleted: false,
        isSettlement: false
      },
      include: {
        splits: true,
        paidBy: true
      }
    });

    // 2b. Get all settlements for this group
    const settlements = await prisma.settlement.findMany({
      where: {
        groupId: id
      }
    });

    // 3. For each unique user in memberships
    const uniqueUsersMap = new Map();
    for (const membership of validMemberships) {
      const userId = membership.userId;
      if (!uniqueUsersMap.has(userId)) {
        uniqueUsersMap.set(userId, {
          userId,
          fullName: membership.user.fullName,
          email: membership.user.email,
          memberships: []
        });
      }
      uniqueUsersMap.get(userId).memberships.push(membership);
    }

    const balances = [];
    for (const userRecord of uniqueUsersMap.values()) {
      const { userId, fullName, email, memberships: userMemberships } = userRecord;

      let totalPaid = 0;
      let totalOwed = 0;

      for (const expense of expenses) {
        // Filter expenses where expense.date falls within ANY membership period
        const isActive = userMemberships.some(m => isActiveOn(m, expense.date));
        if (!isActive) {
          continue;
        }

        if (expense.paidById === userId) {
          totalPaid = Number((totalPaid + Number(expense.amountInr)).toFixed(2));
        }

        const split = expense.splits.find(s => s.userId === userId);
        if (split) {
          totalOwed = Number((totalOwed + Number(split.amountOwed)).toFixed(2));
        }
      }

      for (const settlement of settlements) {
        // Filter settlements where settlement.date falls within ANY membership period
        const isActive = userMemberships.some(m => isActiveOn(m, settlement.date));
        if (!isActive) {
          continue;
        }

        if (settlement.paidById === userId) {
          totalPaid = Number((totalPaid + Number(settlement.amount)).toFixed(2));
        }

        if (settlement.paidToId === userId) {
          totalOwed = Number((totalOwed + Number(settlement.amount)).toFixed(2));
        }
      }

      const netBalance = Number((totalPaid - totalOwed).toFixed(2));
      balances.push({
        userId,
        fullName,
        email,
        totalPaid,
        totalOwed,
        netBalance
      });
    }

    // 4. Call getMinTransfers
    const settlementsNeeded = this.getMinTransfers(balances);

    return {
      members: balances,
      settlementsNeeded
    };
  }

  getMinTransfers(balances) {
    // Create copy for modification
    const localBalances = balances.map(b => ({
      userId: b.userId,
      fullName: b.fullName,
      netBalance: b.netBalance
    }));

    const creditors = localBalances
      .filter(b => b.netBalance > 0.005)
      .sort((a, b) => b.netBalance - a.netBalance);

    const debtors = localBalances
      .filter(b => b.netBalance < -0.005)
      .sort((a, b) => a.netBalance - b.netBalance); // Most negative debt first

    const result = [];

    while (creditors.length > 0 && debtors.length > 0) {
      const c = creditors[0];
      const d = debtors[0];

      const cBalance = c.netBalance;
      const dAbsBalance = Math.abs(d.netBalance);

      const transfer = Number(Math.min(cBalance, dAbsBalance).toFixed(2));

      if (transfer > 0) {
        result.push({
          fromUserId: d.userId,
          fromName: d.fullName,
          toUserId: c.userId,
          toName: c.fullName,
          amount: transfer
        });
      }

      c.netBalance = Number((c.netBalance - transfer).toFixed(2));
      d.netBalance = Number((d.netBalance + transfer).toFixed(2));

      if (c.netBalance < 0.005) {
        creditors.shift();
      }
      if (Math.abs(d.netBalance) < 0.005) {
        debtors.shift();
      }
    }

    return result;
  }

  async getExpenseBreakdown(groupId, userId) {
    const gId = Number(groupId);
    const uId = Number(userId);

    // Find memberships
    const memberships = await prisma.groupMembership.findMany({
      where: { groupId: gId, userId: uId }
    });

    if (memberships.length === 0) {
      return [];
    }

    const splits = await prisma.expenseSplit.findMany({
      where: {
        userId: uId,
        expense: {
          groupId: gId,
          isDeleted: false,
          isSettlement: false
        }
      },
      include: {
        expense: {
          include: {
            paidBy: true
          }
        }
      }
    });

    const breakdown = [];
    for (const split of splits) {
      const expense = split.expense;

      const isActive = memberships.some(m => isActiveOn(m, expense.date));
      if (!isActive) {
        continue;
      }

      breakdown.push({
        expenseId: expense.id,
        description: expense.description,
        date: expense.date,
        totalAmountInr: Number(Number(expense.amountInr).toFixed(2)),
        yourShare: Number(Number(split.amountOwed).toFixed(2)),
        paidByName: expense.paidBy.fullName,
        currency: expense.currency
      });
    }

    // Sort descending by date
    breakdown.sort((a, b) => new Date(b.date) - new Date(a.date));

    return breakdown;
  }
}

module.exports = BalanceService;
