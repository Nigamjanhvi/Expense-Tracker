const multer = require('multer');
const prisma = require('../prisma');
const CSVImporter = require('../services/importerService');
const SplitCalculator = require('../services/splitService');

// Multer Setup: memory storage, max 5MB, CSV only
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  }
});

async function importCSV(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const groupId = Number(req.body.groupId);
    if (!groupId) {
      return res.status(400).json({ message: 'groupId is required' });
    }

    const group = await prisma.expenseGroup.findUnique({
      where: { id: groupId }
    });

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // 1. Create Import Session
    const session = await prisma.importSession.create({
      data: {
        fileName: req.file.originalname,
        importedById: req.user.id,
        groupId
      }
    });

    // 2. Run importer
    const importer = new CSVImporter();
    const result = await importer.run(req.file.buffer, session, group, req.user);

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function getSession(req, res, next) {
  try {
    const sessionId = Number(req.params.sessionId);

    const session = await prisma.importSession.findUnique({
      where: { id: sessionId },
      include: {
        anomalies: true
      }
    });

    if (!session) {
      return res.status(404).json({ message: 'Import session not found' });
    }

    return res.json(session);
  } catch (err) {
    next(err);
  }
}

async function getAnomalies(req, res, next) {
  try {
    const sessionId = Number(req.params.sessionId);

    const anomalies = await prisma.importAnomaly.findMany({
      where: { sessionId },
      orderBy: { rowNumber: 'asc' }
    });

    return res.json(anomalies);
  } catch (err) {
    next(err);
  }
}

async function resolveAnomaly(req, res, next) {
  try {
    const anomalyId = Number(req.params.id);
    const { action, resolutionNote } = req.body; // 'approve' | 'reject'

    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: "Action must be either 'approve' or 'reject'" });
    }

    const anomaly = await prisma.importAnomaly.findUnique({
      where: { id: anomalyId }
    });

    if (!anomaly) {
      return res.status(404).json({ message: 'Anomaly not found' });
    }

    if (anomaly.resolvedByUser) {
      return res.status(400).json({ message: 'Anomaly has already been resolved' });
    }

    // Retrieve import session details
    const session = await prisma.importSession.findUnique({
      where: { id: anomaly.sessionId }
    });

    if (action === 'approve' && anomaly.actionTaken === 'flagged_for_review') {
      const rawData = anomaly.rawData;

      // Extract and format fields
      const parsedDate = new Date(rawData.date || new Date());
      const amount = parseFloat(rawData.amount || '0');
      const cur = (rawData.currency || 'INR').toUpperCase();
      const amountInr = cur === 'USD' ? amount * 83.5 : amount;
      
      const payerName = rawData.paid_by;
      let payerUser = await prisma.user.findFirst({
        where: { fullName: { equals: payerName, mode: 'insensitive' } }
      });

      if (!payerUser) {
        const email = `${payerName.toLowerCase().replace(/[^a-z0-9]/g, '.')}@import.local`;
        payerUser = await prisma.user.findUnique({ where: { email } });
        if (!payerUser) {
          payerUser = await prisma.user.create({
            data: {
              email,
              fullName: payerName,
              passwordHash: 'AUTO_GENERATED_IMPORT_USER'
            }
          });

          await prisma.groupMembership.create({
            data: {
              groupId: session.groupId,
              userId: payerUser.id,
              joinedAt: new Date()
            }
          });
        }
      }

      // Fetch memberships
      const memberships = await prisma.groupMembership.findMany({
        where: { groupId: session.groupId },
        include: { user: true }
      });

      const expenseDateStr = parsedDate.toISOString().split('T')[0];
      const activeMembers = memberships
        .filter(m => {
          const joinedAtStr = m.joinedAt.toISOString().split('T')[0];
          if (!m.leftAt) return joinedAtStr <= expenseDateStr;
          const leftAtStr = m.leftAt.toISOString().split('T')[0];
          return joinedAtStr <= expenseDateStr && expenseDateStr <= leftAtStr;
        })
        .map(m => m.user);

      let splitMembers = [];
      if (rawData.split_with) {
        const splitNames = rawData.split_with.split(/[,;|]/).map(n => n.trim().toLowerCase()).filter(Boolean);
        const seenIds = new Set();
        for (const name of splitNames) {
          const u = activeMembers.find(m => m.fullName.toLowerCase() === name);
          if (u && !seenIds.has(u.id)) {
            seenIds.add(u.id);
            splitMembers.push(u);
          }
        }
      } else {
        splitMembers = activeMembers;
      }

      if (splitMembers.length === 0) {
        splitMembers = activeMembers;
      }

      const memberIds = splitMembers.map(u => u.id);
      const splitDetails = {};
      if (rawData.split_details) {
        try {
          const obj = JSON.parse(rawData.split_details);
          for (const k of Object.keys(obj)) {
            const u = splitMembers.find(m => m.fullName.toLowerCase() === k.toLowerCase() || m.id === Number(k));
            if (u) splitDetails[u.id] = Number(obj[k]);
          }
        } catch (e) {
          const pairs = rawData.split_details.split(/[,;]/);
          for (const pair of pairs) {
            const parts = pair.split(/[:=]/);
            if (parts.length === 2) {
              const name = parts[0].trim().toLowerCase();
              const val = Number(parts[1].trim());
              const u = splitMembers.find(m => m.fullName.toLowerCase() === name);
              if (u) splitDetails[u.id] = val;
            }
          }
        }
      }

      // Calculate and save
      const splits = SplitCalculator.calculate(amountInr, memberIds, rawData.split_type || 'equal', splitDetails);

      await prisma.$transaction(async (tx) => {
        const exp = await tx.expense.create({
          data: {
            groupId: session.groupId,
            description: rawData.description || 'Imported Expense (Approved Duplicate)',
            amount: amount,
            currency: cur,
            amountInr,
            paidById: payerUser.id,
            date: parsedDate,
            splitType: rawData.split_type || 'equal',
            notes: `Imported via anomaly approval resolution.`,
            createdById: session.importedById
          }
        });

        await tx.expenseSplit.createMany({
          data: splits.map(s => ({
            expenseId: exp.id,
            userId: s.userId,
            amountOwed: s.amountOwed
          }))
        });
      });

      // Update session counts
      await prisma.importSession.update({
        where: { id: session.id },
        data: {
          cleanRows: { increment: 1 },
          flaggedRows: { decrement: 1 }
        }
      });
    }

    const updatedAnomaly = await prisma.importAnomaly.update({
      where: { id: anomalyId },
      data: {
        resolvedByUser: true,
        resolution: resolutionNote || `Anomaly ${action}d manually.`,
        actionTaken: action === 'approve' ? 'approved_and_imported' : 'rejected_manually'
      }
    });

    return res.json(updatedAnomaly);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  upload,
  importCSV,
  getSession,
  getAnomalies,
  resolveAnomaly
};
