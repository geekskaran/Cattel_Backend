const express = require('express');
const router = express.Router();

// Placeholder - routes will be added
router.get('/test', (req, res) => {
  res.json({ message: 'Report routes working' });
});

module.exports = router;