import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

class EmailService:
    """
    Service for sending emails using SMTP.
    Handles password reset emails and admin invitation emails.
    """
    
    def __init__(self):
        self.smtp_host = settings.SMTP_HOST
        self.smtp_port = settings.SMTP_PORT
        self.smtp_user = settings.SMTP_USER
        self.smtp_password = settings.SMTP_PASSWORD
        self.from_email = settings.SMTP_FROM_EMAIL
        self.from_name = settings.SMTP_FROM_NAME
        self.frontend_url = settings.FRONTEND_URL

    def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> bool:
        """
        Send an email using SMTP.
        Returns True if successful, False otherwise.
        """
        if not all([self.smtp_host, self.smtp_user, self.smtp_password, self.from_email]):
            logger.warning("Email configuration incomplete. Skipping email send.")
            return False

        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['From'] = f"{self.from_name} <{self.from_email}>"
            msg['To'] = to_email
            msg['Subject'] = subject

            # Add text and HTML parts
            if text_content:
                text_part = MIMEText(text_content, 'plain')
                msg.attach(text_part)
            
            html_part = MIMEText(html_content, 'html')
            msg.attach(html_part)

            # Send email
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(msg)
            
            logger.info(f"Email sent successfully to {to_email}")
            return True

        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            return False

    def send_password_reset_email(self, to_email: str, reset_token: str, user_name: str) -> bool:
        """
        Send password reset email with reset link.
        """
        reset_link = f"{self.frontend_url}/reset-password?token={reset_token}"
        
        subject = "Reset Your Password"
        
        text_content = f"""
Hello {user_name},

You requested a password reset for your Voting Platform admin account.

Click the link below to reset your password:
{reset_link}

This link will expire in 1 hour.

If you did not request this password reset, please ignore this email.

Best regards,
The Voting Platform Team
"""

        html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password</title>
    <style>
        body {{
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }}
        .container {{
            background-color: #f9f9f9;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        .button {{
            display: inline-block;
            background-color: #4CAF50;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 4px;
            margin: 20px 0;
        }}
        .footer {{
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            font-size: 12px;
            color: #666;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h2>Reset Your Password</h2>
        <p>Hello {user_name},</p>
        <p>You requested a password reset for your Voting Platform admin account.</p>
        <p>Click the button below to reset your password:</p>
        <a href="{reset_link}" class="button">Reset Password</a>
        <p>Or copy and paste this link into your browser:</p>
        <p>{reset_link}</p>
        <p>This link will expire in 1 hour.</p>
        <p>If you did not request this password reset, please ignore this email.</p>
        <div class="footer">
            <p>Best regards,<br>The Voting Platform Team</p>
        </div>
    </div>
</body>
</html>
"""

        return self.send_email(to_email, subject, html_content, text_content)

    def send_admin_invitation_email(self, to_email: str, invitation_token: str, inviter_name: str) -> bool:
        """
        Send admin invitation email with signup link.
        """
        invitation_link = f"{self.frontend_url}/signup?token={invitation_token}"
        
        subject = "Admin Account Invitation"
        
        text_content = f"""
Hello,

You have been invited to join the Voting Platform as an administrator by {inviter_name}.

Click the link below to create your account:
{invitation_link}

This invitation link will expire in 7 days.

If you do not want to join, please ignore this email.

Best regards,
The Voting Platform Team
"""

        html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Account Invitation</title>
    <style>
        body {{
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }}
        .container {{
            background-color: #f9f9f9;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        .button {{
            display: inline-block;
            background-color: #4CAF50;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 4px;
            margin: 20px 0;
        }}
        .footer {{
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            font-size: 12px;
            color: #666;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h2>Admin Account Invitation</h2>
        <p>Hello,</p>
        <p>You have been invited to join the Voting Platform as an administrator by <strong>{inviter_name}</strong>.</p>
        <p>Click the button below to create your account:</p>
        <a href="{invitation_link}" class="button">Create Account</a>
        <p>Or copy and paste this link into your browser:</p>
        <p>{invitation_link}</p>
        <p>This invitation link will expire in 7 days.</p>
        <p>If you do not want to join, please ignore this email.</p>
        <div class="footer">
            <p>Best regards,<br>The Voting Platform Team</p>
        </div>
    </div>
</body>
</html>
"""

        return self.send_email(to_email, subject, html_content, text_content)

# Global email service instance
email_service = EmailService()