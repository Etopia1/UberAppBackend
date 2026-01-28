exports.signUpTemplate = (otp, name) => {
    return `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #00C853;">Welcome to Driven!</h2>
        <p>Hi ${name || 'User'},</p>
        <p>Thank you for signing up. Please verify your email address to get started.</p>
        <p>Your verification code is:</p>
        <h1 style="font-size: 32px; letter-spacing: 5px; color: #333;">${otp}</h1>
        <p>This code expires in 10 minutes.</p>
        <p>If you didn't request this, please ignore.</p>
        <br/>
        <p>Safe Rides,</p>
        <p>The Driven Team</p>
      </div>
    `;
};

exports.forgotPasswordTemplate = (otp, name) => {
    return `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #e53935;">Reset Password</h2>
        <p>Hi ${name || 'User'},</p>
        <p>We received a request to reset your password.</p>
        <p>Your OTP code is:</p>
        <h1 style="font-size: 32px; letter-spacing: 5px; color: #333;">${otp}</h1>
        <p>This code expires in 10 minutes.</p>
        <p>If you didn't request this, you can safely ignore this email.</p>
        <br/>
        <p>The Driven Team</p>
      </div>
    `;
};
