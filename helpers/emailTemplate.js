const baseTemplate = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Driven Notification</title>
  <style>
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      background-color: #f4f4f4;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      margin-top: 40px;
      margin-bottom: 40px;
    }
    .header {
      background-color: #000000;
      padding: 30px 20px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 28px;
      font-weight: 700;
      letter-spacing: 1px;
    }
    .header span {
      color: #00C853;
    }
    .content {
      padding: 40px 30px;
      background-color: #ffffff;
      color: #333333;
      line-height: 1.6;
    }
    .otp-box {
      background-color: #f8f9fa;
      border: 2px dashed #00C853;
      border-radius: 8px;
      text-align: center;
      padding: 20px;
      margin: 30px 0;
    }
    .otp-code {
      font-size: 36px;
      font-weight: 800;
      color: #000000;
      letter-spacing: 8px;
      margin: 0;
    }
    .footer {
      background-color: #f8f9fa;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #888888;
      border-top: 1px solid #eeeeee;
    }
    .footer a {
      color: #00C853;
      text-decoration: none;
    }
    @media only screen and (max-width: 600px) {
      .container {
        width: 100% !important;
        margin-top: 0;
        border-radius: 0;
      }
      .content {
        padding: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Driven<span>.</span></h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Driven App. All rights reserved.</p>
      <p>Need help? <a href="mailto:support@drivenapp.com">Contact Support</a></p>
    </div>
  </div>
</body>
</html>
`;

exports.signUpTemplate = (otp, name) => {
  const content = `
        <h2 style="margin-top: 0; color: #1a1a1a;">Welcome to Driven! 🚗</h2>
        <p style="font-size: 16px;">Hi ${name || 'there'},</p>
        <p style="font-size: 16px; color: #555;">
            Thank you for joining us. To complete your registration and verify your account, please use the code below:
        </p>
        
        <div class="otp-box">
            <p class="otp-code">${otp}</p>
        </div>
        
        <p style="font-size: 14px; color: #777;">
            This code will expire in 10 minutes. If you didn't create an account with us, you can safely ignore this email.
        </p>
        <p style="font-size: 16px; font-weight: 600; margin-top: 30px;">
            Safe travels,<br>The Driven Team
        </p>
    `;
  return baseTemplate(content);
};

exports.forgotPasswordTemplate = (otp, name) => {
  const content = `
        <h2 style="margin-top: 0; color: #1a1a1a;">Reset Your Password 🔒</h2>
        <p style="font-size: 16px;">Hi ${name || 'there'},</p>
        <p style="font-size: 16px; color: #555;">
            We received a request to reset your password. Use the code below to proceed:
        </p>
        
        <div class="otp-box">
            <p class="otp-code">${otp}</p>
        </div>
        
        <p style="font-size: 14px; color: #777;">
            This code expires in 10 minutes. If you didn't request a password reset, please contact support immediately.
        </p>
        <p style="font-size: 16px; font-weight: 600; margin-top: 30px;">
            The Driven Team
        </p>
    `;
  return baseTemplate(content);
};

// Generic OTP template for other uses
exports.otpTemplate = (otp, title = "Verification Code") => {
  const content = `
      <h2 style="margin-top: 0; color: #1a1a1a;">${title}</h2>
      <p style="font-size: 16px; color: #555;">
          Please use the following verification code to complete your action:
      </p>
      
      <div class="otp-box">
          <p class="otp-code">${otp}</p>
      </div>
      
      <p style="font-size: 14px; color: #777;">
          This code will expire in 10 minutes.
      </p>
  `;
  return baseTemplate(content);
};

exports.driverWelcomeTemplate = (otp, name, email) => {
  const content = `
        <h2 style="margin-top: 0; color: #10b981;">Welcome to Driven, ${name}! 🚖</h2>
        <p style="font-size: 16px;">Your driver account has been created.</p>
        <p style="font-size: 16px; color: #555;">
            Please use the following OTP to set your password and access your account:
        </p>
        
        <div class="otp-box">
            <p class="otp-code">${otp}</p>
        </div>
        
        <p style="font-size: 14px; color: #555;">
            <strong>Your Login Email:</strong> ${email}
        </p>
        
        <p style="font-size: 14px; color: #777;">
            This OTP will expire in 10 minutes. After setting your password, you can login to the Driven app.
        </p>
        <p style="font-size: 16px; font-weight: 600; margin-top: 30px;">
            Best regards,<br>The Driven Team
        </p>
    `;
  return baseTemplate(content);
};
