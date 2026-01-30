require('dotenv').config();
const { sendOTP } = require('./services/emailService');

const testEmail = async () => {
    console.log('Testing email sending...');
    // Try sending to the mocked user or a clearer test address if known, 
    // but for now we'll use a placeholder that the user can observe logs for.
    // If the user has a verified domain, this can go to any email. 
    // If not, it can only go to the email they signed up with.
    // I'll use a generic one and the user can check their logs/dashboard.
    // Ideally I'd ask the user which email to test with, but I'll try to use a safe default or ask.
    // Actually, I'll use a dummy one and expect the Resend error if not verified, 
    // OR if they used their own email for signup, I should try to find it.
    // For now, let's just use 'delivered@resend.dev' which is a test sink, or similar?
    // Resend docs say: "onboarding@resend.dev" is the FROM.
    // The TO must be the user's email if no domain is verified.

    // I'll try to read the EMAIL_USER from .env if it was there (it was jolaetopia81@gmail.com)
    const targetEmail = process.env.EMAIL_USER || 'jolaetopia81@gmail.com';

    console.log(`Sending test email to ${targetEmail}...`);
    const success = await sendOTP(targetEmail, '123456');

    if (success) {
        console.log('✅ Email sent successfully!');
    } else {
        console.error('❌ Email failed to send.');
    }
};

testEmail();
