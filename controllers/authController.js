const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendOTP } = require('../services/emailService');
const otpGenerator = require('otp-generator');
const { signUpTemplate, forgotPasswordTemplate } = require('../helpers/emailTemplate');
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
// Native fetch is available in Node 18+. If older, we'd need node-fetch, but let's assume 18+.

// Helper to generate OTP
const generateOTP = () => otpGenerator.generate(4, {
    upperCaseAlphabets: false,
    specialChars: false,
    lowerCaseAlphabets: false
});

exports.signup = async (req, res) => {
    try {
        const { name, email, password, phone, role } = req.body;

        const userExists = await User.findOne({ email });
        if (userExists) return res.status(400).json({ message: 'Email already exists' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const otp = generateOTP();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000);
        console.log(otp);
        const newUser = new User({
            name, email, password: hashedPassword, phone, role, otp, otpExpires
        });

        const savedUser = await newUser.save();

        // Send email using template
        const emailContent = signUpTemplate(otp, name);
        await sendOTP(email, otp, emailContent, 'Verify your account - Driven');

        res.status(201).json({ message: 'User created. Please verify OTP.', userId: savedUser._id, email: savedUser.email });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const user = await User.findOne({ email });

        if (!user) return res.status(400).json({ message: 'User not found' });
        if (user.otp !== otp) return res.status(400).json({ message: 'Invalid OTP' });
        if (user.otpExpires < Date.now()) return res.status(400).json({ message: 'OTP Expired' });

        user.verificationStatus = true;
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        const token = jwt.sign({ _id: user._id, role: user.role }, process.env.JWT_SECRET);
        res.json({ token, user: { id: user._id, name: user.name, role: user.role, avatar: user.avatar } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'User not found' });

        const validPass = await bcrypt.compare(password, user.password);
        if (!validPass) return res.status(400).json({ message: 'Invalid password' });

        const token = jwt.sign({ _id: user._id, role: user.role }, process.env.JWT_SECRET);
        res.json({ token, user: { id: user._id, name: user.name, role: user.role, avatar: user.avatar } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.googleLogin = async (req, res) => {
    try {
        const { token } = req.body;
        let googleUser = {};

        // 1. Try modifying as ID Token (Standard for Mobile)
        try {
            const ticket = await client.verifyIdToken({
                idToken: token,
                audience: process.env.GOOGLE_CLIENT_ID,
            });
            const payload = ticket.getPayload();
            googleUser = {
                email: payload.email,
                name: payload.name,
                picture: payload.picture
            };
        } catch (idTokenError) {
            console.log('ID Token verification failed, trying Access Token...', idTokenError.message);

            // 2. Try verifying as Access Token (Standard for Web/Expo Go)
            try {
                const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch user info with access token');
                }

                const payload = await response.json();
                googleUser = {
                    email: payload.email,
                    name: payload.name,
                    picture: payload.picture
                };
            } catch (accessTokenError) {
                console.error('Access Token verification failed:', accessTokenError.message);
                return res.status(401).json({ message: 'Invalid Google Token' });
            }
        }

        const { name, email, picture } = googleUser;
        console.log('Google Auth Success for:', email);

        let user = await User.findOne({ email });

        if (!user) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(email + process.env.JWT_SECRET, salt); // Random password

            user = new User({
                name,
                email,
                avatar: picture,
                password: hashedPassword,
                phone: '', // Google doesn't provide phone by default, user might need to add later
                role: 'rider',
                verificationStatus: true
            });
            await user.save();
        }

        const jwtToken = jwt.sign({ _id: user._id, role: user.role }, process.env.JWT_SECRET);
        res.json({ token: jwtToken, user: { id: user._id, name: user.name, role: user.role, avatar: user.avatar } });

    } catch (err) {
        console.error('Google Login Helper Error:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'User not found' });

        const otp = generateOTP();
        user.otp = otp;
        user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
        await user.save();

        const emailContent = forgotPasswordTemplate(otp, user.name);
        await sendOTP(email, otp, emailContent, 'Password Reset OTP - Driven');

        res.json({ message: 'OTP sent to email', email });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Verify OTP for password reset and return a temporary token
exports.verifyResetOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const user = await User.findOne({ email });

        if (!user) return res.status(400).json({ message: 'User not found' });
        if (user.otp !== otp) return res.status(400).json({ message: 'Invalid OTP' });
        if (user.otpExpires < Date.now()) return res.status(400).json({ message: 'OTP Expired' });

        // Generate a short-lived token specifically for password reset
        const resetToken = jwt.sign(
            { _id: user._id, email: user.email, scope: 'reset_password' },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        );

        // Clear OTP after successful verification to prevent reuse
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        res.json({
            message: 'OTP verified successfully.',
            verified: true,
            resetToken // Send this to the frontend
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.resendOTP = async (req, res) => {
    try {
        const { email, type } = req.body; // type can be 'signup' or 'forgot-password'
        const user = await User.findOne({ email });

        if (!user) return res.status(400).json({ message: 'User not found' });

        // Generate new OTP
        const otp = generateOTP();
        user.otp = otp;
        user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
        await user.save();

        console.log('Resend OTP:', otp);

        // Send appropriate email based on type
        let emailContent, subject;
        if (type === 'signup') {
            emailContent = signUpTemplate(otp, user.name);
            subject = 'Verify your account - Driven (Resent)';
        } else {
            emailContent = forgotPasswordTemplate(otp, user.name);
            subject = 'Password Reset OTP - Driven (Resent)';
        }

        await sendOTP(email, otp, emailContent, subject);

        res.json({ message: 'OTP resent successfully', email });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        // Accept resetToken instead of OTP
        const { email, resetToken, newPassword, confirmPassword } = req.body;

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ message: 'Passwords do not match' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters long' });
        }

        // Verify the token
        try {
            const decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
            if (decoded.scope !== 'reset_password' || decoded.email !== email) {
                return res.status(401).json({ message: 'Invalid or expired reset token' });
            }
        } catch (error) {
            return res.status(401).json({ message: 'Invalid or expired reset token' });
        }

        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'User not found' });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);

        // Ensure no leftover OTP data
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        res.json({ message: 'Password reset successful. Please login.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.updatePushToken = async (req, res) => {
    try {
        const { token } = req.body;
        const userId = req.user._id;

        await User.findByIdAndUpdate(userId, { expoPushToken: token });
        res.status(200).json({ message: 'Push token updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
