const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { sendOTP } = require('../services/emailService');
const otpGenerator = require('otp-generator');
const { signUpTemplate, forgotPasswordTemplate } = require('../helpers/emailTemplate');

// Helper to generate OTP
const generateOTP = () => otpGenerator.generate(4, {
    upperCaseAlphabets: false,
    specialChars: false,
    lowerCaseAlphabets: false
});

// Admin: Create driver account (without password)
exports.createDriver = async (req, res) => {
    try {
        const { name, email, phone } = req.body;

        // Check if email already exists
        const userExists = await User.findOne({ email });
        if (userExists) return res.status(400).json({ message: 'Email already exists' });

        // Generate temporary password
        const tempPassword = Math.random().toString(36).slice(-8);
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(tempPassword, salt);

        // Generate OTP for first-time password setup
        const otp = generateOTP();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

        console.log('Driver OTP:', otp);

        const newDriver = new User({
            name,
            email,
            password: hashedPassword,
            phone,
            role: 'driver',
            verificationStatus: true, // Drivers are pre-verified by admin
            isPasswordSet: false, // Driver needs to set password
            otp,
            otpExpires
        });

        const savedDriver = await newDriver.save();

        // Send welcome email with OTP
        const emailContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #10b981;">Welcome to Driven, ${name}!</h2>
                <p>Your driver account has been created. Please use the following OTP to set your password:</p>
                <div style="background-color: #f3f4f6; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
                    ${otp}
                </div>
                <p>This OTP will expire in 10 minutes.</p>
                <p><strong>Your Login Email:</strong> ${email}</p>
                <p>After setting your password, you can login to the Driven app.</p>
                <p>Best regards,<br/>The Driven Team</p>
            </div>
        `;

        await sendOTP(email, otp, emailContent, 'Welcome to Driven - Set Your Password');

        res.status(201).json({
            message: 'Driver created successfully. OTP sent to email.',
            driver: {
                id: savedDriver._id,
                name: savedDriver.name,
                email: savedDriver.email,
                phone: savedDriver.phone
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Check if user needs to set password (first-time login)
exports.checkPasswordStatus = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) return res.status(400).json({ message: 'User not found' });

        res.json({
            needsPasswordSetup: !user.isPasswordSet,
            email: user.email,
            name: user.name,
            role: user.role
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Verify OTP and set first-time password
exports.setInitialPassword = async (req, res) => {
    try {
        const { email, otp, newPassword, confirmPassword } = req.body;

        // Validate passwords match
        if (newPassword !== confirmPassword) {
            return res.status(400).json({ message: 'Passwords do not match' });
        }

        // Validate password strength
        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters long' });
        }

        const user = await User.findOne({ email });

        if (!user) return res.status(400).json({ message: 'User not found' });
        if (user.otp !== otp) return res.status(400).json({ message: 'Invalid OTP' });
        if (user.otpExpires < Date.now()) return res.status(400).json({ message: 'OTP Expired' });

        // Set new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        user.isPasswordSet = true;
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        res.json({ message: 'Password set successfully. You can now login.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get all drivers (for admin dashboard)
exports.getAllDrivers = async (req, res) => {
    try {
        const drivers = await User.find({ role: 'driver' })
            .select('-password -otp -otpExpires')
            .sort({ createdAt: -1 });

        res.json({
            count: drivers.length,
            drivers
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = exports;
