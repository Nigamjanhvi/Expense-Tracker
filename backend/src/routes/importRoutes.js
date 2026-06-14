const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  upload,
  importCSV,
  getSession,
  getAnomalies,
  resolveAnomaly
} = require('../controllers/importController');

const router = express.Router();

router.use(protect);

router.post('/', upload.single('file'), importCSV);
router.get('/:sessionId', getSession);
router.get('/:sessionId/anomalies', getAnomalies);
router.patch('/anomalies/:id', resolveAnomaly);

module.exports = router;
