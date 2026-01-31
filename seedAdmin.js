const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const dotenv = require('dotenv');

dotenv.config();

const seedAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URL);
        console.log('MongoDB Connected');

        const email = 'driven@gmail.com';
        const password = 'Driven2026@';

        const userExists = await User.findOne({ email });

        if (userExists) {
            console.log('Admin user already exists');
        } else {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            const admin = new User({
                name: 'Super Admin',
                email,
                password: hashedPassword,
                role: 'admin',
                verificationStatus: true,
                isDriverVerified: true, // Auto-verified
                phone: '+1234567890'
            });

            await admin.save();
            console.log('Super Admin Created Successfully');
            console.log(`Email: ${email}`);
            console.log(`Password: ${password}`);
        }

        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

seedAdmin();
