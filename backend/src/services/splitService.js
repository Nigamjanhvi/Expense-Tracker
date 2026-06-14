class SplitCalculator {
  static calculate(amountInr, memberIds, splitType, splitDetails) {
    const amount = Number(Number(amountInr).toFixed(2));
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Invalid amount for split calculation');
    }
    if (!memberIds || memberIds.length === 0) {
      throw new Error('At least one member is required to split');
    }

    const type = splitType.toLowerCase();

    if (type === 'equal') {
      const n = memberIds.length;
      const base = Math.floor((amount / n) * 100) / 100;
      const remainder = Number((amount - (base * n)).toFixed(2));
      const extraCents = Math.round(remainder * 100);

      return memberIds.map((userId, index) => {
        const amountOwed = index < extraCents ? Number((base + 0.01).toFixed(2)) : Number(base.toFixed(2));
        return { userId: Number(userId), amountOwed };
      });
    }

    if (type === 'exact') {
      const details = splitDetails || {};
      const sum = Object.values(details).reduce((acc, val) => acc + Number(val), 0);
      
      if (Math.abs(sum - amount) > 1.00) {
        throw new Error('Exact amounts do not sum to total');
      }

      return memberIds.map(userId => {
        const val = details[userId] ?? details[String(userId)] ?? 0;
        return { userId: Number(userId), amountOwed: Number(Number(val).toFixed(2)) };
      });
    }

    if (type === 'percentage') {
      const details = splitDetails || {};
      const sumPct = Object.values(details).reduce((acc, val) => acc + Number(val), 0);

      if (Math.abs(sumPct - 100) > 0.5) {
        throw new Error('Percentages do not sum to 100');
      }

      let runningSum = 0;
      const result = memberIds.map((userId) => {
        const pct = Number(details[userId] ?? details[String(userId)] ?? 0);
        const owed = Number(((pct / 100) * amount).toFixed(2));
        runningSum = Number((runningSum + owed).toFixed(2));
        return { userId: Number(userId), amountOwed: owed };
      });

      // Adjust last person for rounding error
      const diff = Number((amount - runningSum).toFixed(2));
      if (result.length > 0 && Math.abs(diff) > 0.001) {
        result[result.length - 1].amountOwed = Number((result[result.length - 1].amountOwed + diff).toFixed(2));
      }

      return result;
    }

    if (type === 'shares') {
      const details = splitDetails || {};
      const totalShares = Object.values(details).reduce((acc, val) => acc + Number(val), 0);

      if (totalShares <= 0) {
        throw new Error('Total shares must be greater than 0');
      }

      let runningSum = 0;
      const result = memberIds.map((userId) => {
        const shares = Number(details[userId] ?? details[String(userId)] ?? 0);
        const owed = Number(((shares / totalShares) * amount).toFixed(2));
        runningSum = Number((runningSum + owed).toFixed(2));
        return { userId: Number(userId), amountOwed: owed };
      });

      // Adjust last person for rounding error
      const diff = Number((amount - runningSum).toFixed(2));
      if (result.length > 0 && Math.abs(diff) > 0.001) {
        result[result.length - 1].amountOwed = Number((result[result.length - 1].amountOwed + diff).toFixed(2));
      }

      return result;
    }

    throw new Error(`Unsupported split type: ${splitType}`);
  }
}

module.exports = SplitCalculator;
