const bcrypt = require('bcryptjs');
const prisma = require('../prisma');

async function main() {
  const dummyPasswordHash = await bcrypt.hash('password123', 10);

  const baselineUsers = [
    { email: 'aisha@gmail.com', fullName: 'Aisha', joinedAt: '2026-02-01', leftAt: null },
    { email: 'rohan@gmail.com', fullName: 'Rohan', joinedAt: '2026-02-01', leftAt: null },
    { email: 'priya@gmail.com', fullName: 'Priya', joinedAt: '2026-02-01', leftAt: null },
    { email: 'meera@gmail.com', fullName: 'Meera', joinedAt: '2026-02-01', leftAt: '2026-03-31' },
    { email: 'sam@gmail.com', fullName: 'Sam', joinedAt: '2026-04-15', leftAt: null },
    { email: 'dev@gmail.com', fullName: 'Dev', joinedAt: '2026-02-01', leftAt: null },
    { email: 'kabir@gmail.com', fullName: 'Kabir', joinedAt: '2026-02-01', leftAt: null }
  ];

  console.log('Seeding baseline users and groups...');

  try {
    // 1. Create or Find the Group "Flat Expenses"
    let group = await prisma.expenseGroup.findFirst({
      where: { name: 'Flat Expenses' }
    });

    if (!group) {
      group = await prisma.expenseGroup.create({
        data: {
          name: 'Flat Expenses',
          description: 'Original Flat Expenses for AI Reconciliation'
        }
      });
      console.log(`Created group: ${group.name}`);
    } else {
      console.log(`Using existing group: ${group.name}`);
    }

    // 2. Insert Users and build memberships
    for (const u of baselineUsers) {
      let dbUser = await prisma.user.findUnique({
        where: { email: u.email }
      });

      if (!dbUser) {
        dbUser = await prisma.user.create({
          data: {
            email: u.email,
            fullName: u.fullName,
            passwordHash: dummyPasswordHash
          }
        });
        console.log(`Created user: ${u.fullName} (${u.email})`);
      } else {
        console.log(`User already exists: ${u.fullName}`);
      }

      // Check if membership already exists
      const existingMembership = await prisma.groupMembership.findFirst({
        where: {
          groupId: group.id,
          userId: dbUser.id
        }
      });

      if (!existingMembership) {
        await prisma.groupMembership.create({
          data: {
            groupId: group.id,
            userId: dbUser.id,
            joinedAt: new Date(u.joinedAt),
            leftAt: u.leftAt ? new Date(u.leftAt) : null
          }
        });
        console.log(`Added ${u.fullName} to group ${group.name} (Joined: ${u.joinedAt}, Left: ${u.leftAt || 'Active'})`);
      } else {
        // Update the membership dates to match historical timeline
        await prisma.groupMembership.update({
          where: { id: existingMembership.id },
          data: {
            joinedAt: new Date(u.joinedAt),
            leftAt: u.leftAt ? new Date(u.leftAt) : null
          }
        });
        console.log(`Updated membership dates for ${u.fullName}`);
      }
    }

    console.log('Seeding completed successfully!');
  } catch (err) {
    console.error('Error seeding database:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
