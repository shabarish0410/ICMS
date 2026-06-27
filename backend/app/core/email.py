import smtplib
import socket
import logging
from abc import ABC, abstractmethod
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

import httpx

from app.core.config import settings

logger = logging.getLogger("icms.email")

# ─── Email Provider Interface ────────────────────────────────────────────────

class BaseEmailProvider(ABC):
    @abstractmethod
    def send_email(self, to_email: str, subject: str, html_body: str) -> bool:
        """Sends an email and returns True on success, raises exception on failure."""
        pass


# ─── Mock Email Provider ──────────────────────────────────────────────────────

class MockEmailProvider(BaseEmailProvider):
    def send_email(self, to_email: str, subject: str, html_body: str) -> bool:
        logger.info(f"⚠️ [MOCK EMAIL] To: {to_email} | Subject: {subject}")
        return True


# ─── Resend HTTP Provider (Bypasses SMTP port blocking) ─────────────────────

class ResendEmailProvider(BaseEmailProvider):
    """
    Sends email via the Resend REST API over standard HTTPS (port 443).
    This bypasses Render's outbound SMTP port blocking (ports 25, 465, 587).
    """
    API_URL = "https://api.resend.com/emails"

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type(httpx.RequestError),
        reraise=True
    )
    def send_email(self, to_email: str, subject: str, html_body: str) -> bool:
        if not settings.RESEND_API_KEY:
            raise ValueError("RESEND_API_KEY is not configured.")

        # If SMTP_FROM_EMAIL isn't configured, fallback to a verified Resend domain or testing domain
        from_email = settings.SMTP_USER if "@" in settings.SMTP_USER else "onboarding@resend.dev"
        sender_name = "Spark Innovation Cell"
        
        payload = {
            "from": f"{sender_name} <{from_email}>",
            "to": [to_email],
            "subject": subject,
            "html": html_body
        }

        headers = {
            "Authorization": f"Bearer {settings.RESEND_API_KEY}",
            "Content-Type": "application/json"
        }

        try:
            logger.info(f"Sending HTTP email via Resend to {to_email}...")
            with httpx.Client(timeout=15.0) as client:
                response = client.post(self.API_URL, json=payload, headers=headers)
                
            if response.status_code >= 400:
                logger.error(f"Resend API Error: {response.text}")
                raise ValueError(f"Resend API returned {response.status_code}: {response.text}")
                
            logger.info(f"Successfully sent HTTP email to {to_email}.")
            return True
            
        except httpx.RequestError as e:
            logger.warning(f"Network error sending via Resend: {e}. Retrying...")
            raise


# ─── Standard SMTP Provider ───────────────────────────────────────────────────

class SMTPEmailProvider(BaseEmailProvider):
    """
    Sends email via standard SMTP.
    Includes robust retries and network logging for debugging.
    """
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((OSError, smtplib.SMTPException)),
        reraise=True
    )
    def send_email(self, to_email: str, subject: str, html_body: str) -> bool:
        if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
            raise ValueError("SMTP_USER and SMTP_PASSWORD must be configured.")

        msg = MIMEMultipart()
        sender_name = "Spark Innovation Cell"
        msg["From"] = f"{sender_name} <{settings.SMTP_USER}>"
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(html_body, "html"))

        host = settings.SMTP_PORT
        
        try:
            logger.info(f"Resolving DNS for {settings.SMTP_HOST}...")
            ip_address = socket.gethostbyname(settings.SMTP_HOST)
            logger.info(f"Resolved {settings.SMTP_HOST} to {ip_address}.")
            
            logger.info(f"Connecting to SMTP {settings.SMTP_HOST}:{settings.SMTP_PORT}...")
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15)
            
            # Start TLS for ports 587 or 25
            if settings.SMTP_PORT in (587, 25):
                logger.info("Initiating STARTTLS handshake...")
                server.starttls()
            
            logger.info("Authenticating with SMTP server...")
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            
            logger.info("Sending message payload...")
            server.send_message(msg)
            server.quit()
            
            logger.info(f"Successfully sent SMTP email to {to_email}.")
            return True
            
        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"SMTP Authentication Error: {e}")
            raise ValueError("SMTP Authentication Error: Please check SMTP credentials (app password if using Gmail).")
        except smtplib.SMTPException as e:
            logger.error(f"SMTP Protocol Error: {e}")
            raise ValueError(f"SMTP error: {e}")
        except socket.gaierror as e:
            logger.error(f"DNS Resolution Failed: {e}")
            raise ValueError(f"SMTP DNS Resolution Failed: {e}")
        except OSError as e:
            logger.warning(f"SMTP Network error (timeout/unreachable): {e}. Retrying...")
            raise ValueError(f"SMTP Network error (timeout/unreachable): {e}")


# ─── Factory ──────────────────────────────────────────────────────────────────

def get_email_provider() -> BaseEmailProvider:
    provider_name = settings.EMAIL_PROVIDER.lower().strip()
    if provider_name == "mock":
        return MockEmailProvider()
    elif provider_name == "resend":
        return ResendEmailProvider()
    else:
        return SMTPEmailProvider()


# ─── Legacy Wrapper for Backwards Compatibility ───────────────────────────────

def send_otp_email(to_email: str, otp: str, user_name: str = "User") -> bool:
    """Send an OTP email using the configured provider."""
    
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
    
    provider = get_email_provider()
    return provider.send_email(
        to_email=to_email,
        subject="Spark Innovation Cell - Your Verification Code",
        html_body=html_body
    )
