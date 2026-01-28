const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    balance: {
        type: Number,
        default: 0,
        min: 0
    },
    currency: {
        type: String,
        default: 'USD'
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Index for faster queries
walletSchema.index({ user: 1 });

// Method to credit wallet
walletSchema.methods.credit = async function (amount) {
    this.balance += amount;
    return await this.save();
};

// Method to debit wallet
walletSchema.methods.debit = async function (amount) {
    if (this.balance < amount) {
        throw new Error('Insufficient funds');
    }
    this.balance -= amount;
    return await this.save();
};

// Method to check if sufficient balance
walletSchema.methods.hasSufficientBalance = function (amount) {
    return this.balance >= amount;
};

module.exports = mongoose.model('Wallet', walletSchema);
