import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from app.core.config import settings

def send_otp_email(to_email: str, otp: str, user_name: str = "User"):
    """Send an OTP email using SMTP. Falls back to console log if credentials are missing."""
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        print(f"⚠️ [MOCK EMAIL] To: {to_email} | OTP: {otp}")
        print("⚠️ SMTP credentials not configured. Please add SMTP_USER and SMTP_PASSWORD to .env")
        return True

    try:
        msg = MIMEMultipart()
        # Set a professional sender name
        sender_name = "Spark Innovation Cell"
        msg["From"] = f"{sender_name} <{settings.SMTP_USER}>"
        msg["To"] = to_email
        msg["Subject"] = "Spark Innovation Cell - Your Verification Code"

        html_body = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Your Verification Code</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6; color: #1f2937;">
            <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
                
                <!-- Header -->
                <div style="background-color: #0ea5e9; padding: 30px 20px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: 0.5px;">Spark Innovation Cell</h1>
                </div>

                <!-- Body -->
                <div style="padding: 40px 30px;">
                    <p style="margin-top: 0; font-size: 16px; line-height: 24px;">Hi {user_name},</p>
                    <p style="font-size: 16px; line-height: 24px; color: #4b5563;">
                        We received a request to verify your account. Please use the following code to complete the process:
                    </p>
                    
                    <div style="margin: 35px 0; padding: 20px; background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; text-align: center;">
                        <span style="display: block; font-size: 32px; font-weight: 700; color: #0284c7; letter-spacing: 8px;">{otp}</span>
                    </div>
                    
                    <p style="font-size: 14px; line-height: 20px; color: #6b7280; text-align: center;">
                        This code will expire in <strong>10 minutes</strong>.
                    </p>
                    
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                    
                    <p style="margin: 0; font-size: 13px; line-height: 18px; color: #9ca3af; text-align: center;">
                        If you did not request this code, you can safely ignore this email. Your account remains secure.
                    </p>
                </div>

                <!-- Footer -->
                <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #f3f4f6;">
                    <p style="margin: 0 0 5px 0; font-size: 12px; color: #6b7280; font-weight: 500;">Spark Innovation Cell</p>
                    <p style="margin: 0 0 10px 0; font-size: 12px; color: #9ca3af;">
                        <a href="mailto:support@sparkinnovation.com" style="color: #0ea5e9; text-decoration: none;">Support</a> • 
                        <a href="https://sparkinnovation.com" style="color: #0ea5e9; text-decoration: none;">Official Website</a>
                    </p>
                    <p style="margin: 0; font-size: 11px; color: #d1d5db;">&copy; {datetime.now().year} Spark Innovation Cell. All rights reserved.</p>
                </div>
                
            </div>
        </body>
        </html>
        """
        msg.attach(MIMEText(html_body, "html"))

        server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)
        server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        return True
    except Exception as e:
        print(f"Failed to send email: {e}")
        return False
