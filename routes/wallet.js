const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Wallet routes
router.get('/balance', walletController.getBalance);
router.post('/fund', walletController.fundWallet);
router.post('/confirm-funding', walletController.confirmFunding);
router.post('/debit', walletController.debitWallet);
router.get('/transactions', walletController.getTransactions);
router.get('/check-balance', walletController.checkBalance);

module.exports = router;
