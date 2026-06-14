const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  getExpense,
  updateExpense,
  deleteExpense
} = require('../controllers/expenseController');

const router = express.Router();

router.use(protect);

router.get('/:id', getExpense);
router.put('/:id', updateExpense);
router.delete('/:id', deleteExpense);

module.exports = router;
