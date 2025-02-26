const express = require('express');
const router = express.Router();

// Ensure that the callback function is defined or imported correctly
const postCallback = require('../controllers/postController'); // Example import

router.post('/your-route', postCallback); // Ensure postCallback is defined

module.exports = router; 