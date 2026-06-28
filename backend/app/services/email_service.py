import smtplib
from email.message import EmailMessage
from app.core.config import settings

def send_email(to_email: str, subject: str, html: str):
    """
    Send an email using standard SMTP.
    Uses settings.SMTP_USER, settings.SMTP_PASSWORD, settings.SMTP_HOST, and settings.SMTP_PORT.
    """
    smtp_host = getattr(settings, "SMTP_HOST", "smtp.gmail.com")
    smtp_port = getattr(settings, "SMTP_PORT", 587)
    smtp_user = getattr(settings, "SMTP_USER", "").strip()
    smtp_password = getattr(settings, "SMTP_PASSWORD", "").strip()
    
    if not smtp_user or not smtp_password:
        print("Warning: SMTP_USER or SMTP_PASSWORD is not set. Email will fail.")
        
    try:
        msg = EmailMessage()
        msg['Subject'] = subject
        msg['From'] = smtp_user
        msg['To'] = to_email
        msg.set_content(html, subtype='html')

        print(f"Attempting to send SMTP email to {to_email} via {smtp_host}:{smtp_port}")
        
        # Connect to the SMTP server (using STARTTLS)
        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
            server.set_debuglevel(1)  # Enable debug output for testing
            server.starttls()         # Secure the connection
            server.login(smtp_user, smtp_password)
            server.send_message(msg)
            
        print(f"Email sent successfully to {to_email}")
        return True
    except smtplib.SMTPAuthenticationError:
        error_msg = "SMTP Authentication failed. Did you use an App Password (not your main password)?"
        print("SMTP ERROR:", error_msg)
        raise RuntimeError(f"Email delivery failed: {error_msg}")
    except Exception as e:
        print("SMTP ERROR:", str(e))
        raise RuntimeError(f"Email delivery failed: {str(e)}")
