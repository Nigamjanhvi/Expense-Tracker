const prisma = require('../prisma');
const BalanceService = require('../services/balanceService');

const balanceService = new BalanceService();

async function listGroups(req, res, next) {
  try {
    const userId = req.user.id;

    // Find all groups where the user has a membership
    const memberships = await prisma.groupMembership.findMany({
      where: { userId },
      include: {
        group: {
          include: {
            memberships: true
          }
        }
      }
    });

    const groups = await Promise.all(
      memberships.map(async (membership) => {
        const group = membership.group;
        const memberCount = group.memberships.length;

        // Calculate net balances for this group
        const balances = await balanceService.getBalances(group.id);
        const userBalanceRecord = balances.members.find(m => m.userId === userId);
        const netBalance = userBalanceRecord ? userBalanceRecord.netBalance : 0;

        return {
          id: group.id,
          name: group.name,
          description: group.description,
          createdAt: group.createdAt,
          memberCount,
          netBalance
        };
      })
    );

    return res.json(groups);
  } catch (err) {
    next(err);
  }
}


async function createGroup(req, res, next) {
  try {
    const { name, description } = req.body;
    const creatorId = req.user.id;

    if (!name) {
      return res.status(400).json({ message: 'Group name is required' });
    }

    const group = await prisma.expenseGroup.create({
      data: {
        name,
        description
      }
    });

    // Create group membership for creator
    await prisma.groupMembership.create({
      data: {
        groupId: group.id,
        userId: creatorId,
        joinedAt: new Date()
      }
    });

    return res.status(201).json(group);
  } catch (err) {
    next(err);
  }
}

async function getGroup(req, res, next) {
  try {
    const groupId = Number(req.params.id);

    const group = await prisma.expenseGroup.findUnique({
      where: { id: groupId },
      include: {
        memberships: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true
              }
            }
          }
        }
      }
    });

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    return res.json(group);
  } catch (err) {
    next(err);
  }
}

async function addMember(req, res, next) {
  try {
    const groupId = Number(req.params.id);
    const { email, joinedAt } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Member email is required' });
    }

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found with this email' });
    }

    // Check if membership already exists for this joinedAt date
    const parsedJoinedAt = joinedAt ? new Date(joinedAt) : new Date();
    
    // Check if user is already a member with a pending/active membership (where leftAt is null)
    const existingActive = await prisma.groupMembership.findFirst({
      where: {
        groupId,
        userId: user.id,
        leftAt: null
      }
    });

    if (existingActive) {
      return res.status(400).json({ message: 'User is already an active member of this group' });
    }

    const membership = await prisma.groupMembership.create({
      data: {
        groupId,
        userId: user.id,
        joinedAt: parsedJoinedAt
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      }
    });

    return res.status(201).json(membership);
  } catch (err) {
    next(err);
  }
}

async function updateMembership(req, res, next) {
  try {
    const membershipId = Number(req.params.mid);
    const { leftAt } = req.body;

    if (!leftAt) {
      return res.status(400).json({ message: 'leftAt date is required' });
    }

    const updated = await prisma.groupMembership.update({
      where: { id: membershipId },
      data: {
        leftAt: new Date(leftAt)
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      }
    });

    return res.json(updated);
  } catch (err) {
    next(err);
  }
}

async function getBalances(req, res, next) {
  try {
    const groupId = Number(req.params.id);
    const result = await balanceService.getBalances(groupId);
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getBreakdown(req, res, next) {
  try {
    const groupId = Number(req.params.id);
    const userId = Number(req.params.uid);
    const result = await balanceService.getExpenseBreakdown(groupId, userId);
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

async function updateGroup(req, res, next) {
  try {
    const groupId = Number(req.params.id);
    const { name, description } = req.body;
    const group = await prisma.expenseGroup.update({
      where: { id: groupId },
      data: { name, description }
    });
    return res.json(group);
  } catch (err) {
    next(err);
  }
}

async function listMembers(req, res, next) {
  try {
    const groupId = Number(req.params.id);
    const memberships = await prisma.groupMembership.findMany({
      where: { groupId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      }
    });
    return res.json(memberships);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listGroups,
  createGroup,
  getGroup,
  updateGroup,
  listMembers,
  addMember,
  updateMembership,
  getBalances,
  getBreakdown
};

