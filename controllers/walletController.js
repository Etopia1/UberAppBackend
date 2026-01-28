const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Get wallet balance
exports.getBalance = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;

        let wallet = await Wallet.findOne({ user: userId });

        // Create wallet if doesn't exist
        if (!wallet) {
            wallet = new Wallet({ user: userId });
            await wallet.save();
        }

        res.json({
            balance: wallet.balance,
            currency: wallet.currency
        });
    } catch (error) {
        console.error('Get balance error:', error);
        res.status(500).json({ message: 'Failed to fetch wallet balance' });
    }
};

// Fund wallet
exports.fundWallet = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { amount } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ message: 'Invalid amount' });
        }

        // Get or create wallet
        let wallet = await Wallet.findOne({ user: userId });
        if (!wallet) {
            wallet = new Wallet({ user: userId });
            await wallet.save();
        }

        // Create Stripe payment intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Convert to cents
            currency: 'usd',
            metadata: {
                userId: userId,
                walletId: wallet._id.toString(),
                type: 'wallet_funding'
            }
        });

        res.json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id
        });
    } catch (error) {
        console.error('Fund wallet error:', error);
        res.status(500).json({ message: 'Failed to create payment intent' });
    }
};

// Confirm wallet funding (called after Stripe payment succeeds)
exports.confirmFunding = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { paymentIntentId, amount } = req.body;

        // Verify payment intent
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (paymentIntent.status !== 'succeeded') {
            return res.status(400).json({ message: 'Payment not completed' });
        }

        // Get wallet
        let wallet = await Wallet.findOne({ user: userId });
        if (!wallet) {
            wallet = new Wallet({ user: userId });
            await wallet.save();
        }

        const balanceBefore = wallet.balance;

        // Credit wallet
        await wallet.credit(amount);

        // Create transaction record
        const transaction = new Transaction({
            user: userId,
            wallet: wallet._id,
            type: 'credit',
            amount: amount,
            description: 'Wallet funded via Stripe',
            reference: paymentIntentId,
            status: 'completed',
            metadata: {
                paymentIntentId: paymentIntentId
            },
            balanceBefore: balanceBefore,
            balanceAfter: wallet.balance
        });

        await transaction.save();

        res.json({
            message: 'Wallet funded successfully',
            balance: wallet.balance,
            transaction: transaction
        });
    } catch (error) {
        console.error('Confirm funding error:', error);
        res.status(500).json({ message: 'Failed to confirm wallet funding' });
    }
};

// Debit wallet (internal use)
exports.debitWallet = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { amount, description, metadata } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ message: 'Invalid amount' });
        }

        // Get wallet
        const wallet = await Wallet.findOne({ user: userId });
        if (!wallet) {
            return res.status(404).json({ message: 'Wallet not found' });
        }

        // Check sufficient balance
        if (!wallet.hasSufficientBalance(amount)) {
            return res.status(400).json({ message: 'Insufficient funds' });
        }

        const balanceBefore = wallet.balance;

        // Debit wallet
        await wallet.debit(amount);

        // Create transaction record
        const transaction = new Transaction({
            user: userId,
            wallet: wallet._id,
            type: 'debit',
            amount: amount,
            description: description || 'Wallet debit',
            status: 'completed',
            metadata: metadata || {},
            balanceBefore: balanceBefore,
            balanceAfter: wallet.balance
        });

        await transaction.save();

        res.json({
            message: 'Wallet debited successfully',
            balance: wallet.balance,
            transaction: transaction
        });
    } catch (error) {
        console.error('Debit wallet error:', error);
        res.status(500).json({ message: error.message || 'Failed to debit wallet' });
    }
};

// Get transaction history
exports.getTransactions = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { page = 1, limit = 20, type } = req.query;

        const query = { user: userId };
        if (type) {
            query.type = type;
        }

        const transactions = await Transaction.find(query)
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Transaction.countDocuments(query);

        res.json({
            transactions,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });
    } catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({ message: 'Failed to fetch transactions' });
    }
};

// Check if user has sufficient balance
exports.checkBalance = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { amount } = req.query;

        const wallet = await Wallet.findOne({ user: userId });

        if (!wallet) {
            return res.json({ sufficient: false, balance: 0 });
        }

        res.json({
            sufficient: wallet.hasSufficientBalance(parseFloat(amount)),
            balance: wallet.balance
        });
    } catch (error) {
        console.error('Check balance error:', error);
        res.status(500).json({ message: 'Failed to check balance' });
    }
};
