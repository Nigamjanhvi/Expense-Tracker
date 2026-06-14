const prisma = require('../prisma');

async function main() {
  console.log('Running database cleanup script...');

  try {
    // 1. Find all users whose name contains delimiters: ; , |
    const users = await prisma.user.findMany();
    const fakeUsers = users.filter(u => 
      u.fullName.includes(';') || 
      u.fullName.includes(',') || 
      u.fullName.includes('|') || 
      u.email.includes(';') || 
      u.email.includes(',') || 
      u.email.includes('|')
    );

    console.log(`Found ${fakeUsers.length} fake user records to delete.`);

    for (const user of fakeUsers) {
      console.log(`Cleaning up fake user: "${user.fullName}" (ID: ${user.id}, Email: ${user.email})...`);

      // Delete associated expense splits
      const splitDeletes = await prisma.expenseSplit.deleteMany({
        where: { userId: user.id }
      });
      console.log(`- Deleted ${splitDeletes.count} expense split records.`);

      // Delete group memberships
      const memberDeletes = await prisma.groupMembership.deleteMany({
        where: { userId: user.id }
      });
      console.log(`- Deleted ${memberDeletes.count} group membership records.`);

      // Delete settlements paid by or to this user
      const settlementDeletes = await prisma.settlement.deleteMany({
        where: {
          OR: [
            { paidById: user.id },
            { paidToId: user.id }
          ]
        }
      });
      console.log(`- Deleted ${settlementDeletes.count} settlement records.`);

      // Delete import sessions
      const importSessions = await prisma.importSession.findMany({
        where: { importedById: user.id }
      });
      for (const sess of importSessions) {
        await prisma.importAnomaly.deleteMany({ where: { sessionId: sess.id } });
        await prisma.importSession.delete({ where: { id: sess.id } });
      }
      console.log(`- Cleaned up ${importSessions.length} import sessions and their anomalies.`);

      // Delete expenses paid by or created by this user
      // Note: Delete splits for those expenses first to satisfy constraints
      const expenses = await prisma.expense.findMany({
        where: {
          OR: [
            { paidById: user.id },
            { createdById: user.id }
          ]
        }
      });

      for (const exp of expenses) {
        await prisma.expenseSplit.deleteMany({ where: { expenseId: exp.id } });
        await prisma.expense.delete({ where: { id: exp.id } });
      }
      console.log(`- Deleted ${expenses.length} associated expenses paid/created by the fake user.`);

      // Finally delete the user record
      await prisma.user.delete({
        where: { id: user.id }
      });
      console.log(`- Deleted User record successfully.`);
    }

    console.log('Database cleanup completed successfully!');
  } catch (err) {
    console.error('Error executing cleanup:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
