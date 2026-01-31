const { Resend } = require('resend');
const { otpTemplate } = require('../helpers/emailTemplate');

const resend = new Resend(process.env.RESEND_API_KEY);

const sendOTP = async (email, otp, htmlContent = null, customSubject = null) => {
    try {
        const subject = customSubject || 'Your Verification Code - Driven';
        const text = `Your verification code is: ${otp}. It expires in 10 minutes.`;
        const html = htmlContent || otpTemplate(otp);

        if (process.env.RESEND_API_KEY) {
            // Resend Free Tier Limitation: Can only send to verified email.
            // For testing, we redirect EVERYTHING to jolaetopia81@gmail.com
            const SAFE_EMAIL = 'jolaetopia81@gmail.com';

            console.log(`[Resend Safe Mode] Redirecting email for ${email} to ${SAFE_EMAIL}`);

            const { data, error } = await resend.emails.send({
                from: 'Driven App <onboarding@resend.dev>',
                to: [SAFE_EMAIL],
                subject: `[TEST: For ${email}] ` + subject, // Add original recipient to subject
                html: `<p><strong>Original Recipient: ${email}</strong></p><hr/>` + html,
            });

            if (error) {
                console.error('Resend error:', error);
                return false;
            }

            console.log(`Email sent to ${email} (ID: ${data.id})`);
            return true;
        } else {
            console.log(`[Mock Email Service] To: ${email}, OTP: ${otp}`);
            console.log('Configure RESEND_API_KEY in .env to send real emails.');
            return true; // Return true to allow flow to continue in dev
        }
    } catch (error) {
        console.error('Email send error:', error);
        return false;
    }
};

module.exports = { sendOTP };
