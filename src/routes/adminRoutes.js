const express = require('express');
const router = express.Router();

// Placeholder - routes will be added
router.get('/test', (req, res) => {
  res.json({ message: 'Admin routes working' });
});

module.exports = router;