const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  listGroups,
  createGroup,
  getGroup,
  updateGroup,
  listMembers,
  addMember,
  updateMembership,
  getBalances,
  getBreakdown
} = require('../controllers/groupController');

const {
  listExpenses,
  createExpense,
  listSettlements,
  createSettlement
} = require('../controllers/expenseController');

const router = express.Router();

// Apply protect middleware to all group routes
router.use(protect);

router.get('/', listGroups);
router.post('/', createGroup);
router.get('/:id', getGroup);
router.put('/:id', updateGroup);

// Member routes
router.get('/:id/members', listMembers);
router.post('/:id/members', addMember);
router.patch('/:id/members/:mid', updateMembership);

// Balance routes
router.get('/:id/balances', getBalances);
router.get('/:id/balances/:uid/breakdown', getBreakdown);

// Expense nested routes
router.get('/:id/expenses', listExpenses);
router.post('/:id/expenses', createExpense);

// Settlement nested routes
router.get('/:id/settlements', listSettlements);
router.post('/:id/settlements', createSettlement);

module.exports = router;
