const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // Set these in .env
        pass: process.env.EMAIL_PASS
    }
});

const sendOTP = async (email, otp, htmlContent = null, customSubject = null) => {
    try {
        const subject = customSubject || 'Your Verification Code - Driven';
        const text = `Your verification code is: ${otp}. It expires in 10 minutes.`;
        const html = htmlContent || `<div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
               <h2 style="color: #00C853;">Driven</h2>
               <p>Your verification code is:</p>
               <h1 style="font-size: 32px; letter-spacing: 5px;">${otp}</h1>
               <p>This code expires in 10 minutes.</p>
               <p>If you didn't request this, please ignore.</p>
             </div>`;

        const mailOptions = {
            from: '"Driven App" <no-reply@drivenapp.com>',
            to: email,
            subject: subject,
            text: text,
            html: html
        };

        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            await transporter.sendMail(mailOptions);
            console.log(`Email sent to ${email}`);
        } else {
            console.log(`[Mock Email Service] To: ${email}, OTP: ${otp}`);
            console.log('Configure EMAIL_USER and EMAIL_PASS in .env to send real emails.');
        }
        return true;
    } catch (error) {
        console.error('Email send error:', error);
        return false;
    }
};

module.exports = { sendOTP };
