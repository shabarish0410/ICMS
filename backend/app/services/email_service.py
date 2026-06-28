import resend
from app.core.config import settings

# Initialize resend API key from settings which correctly loads .env variables
resend.api_key = settings.RESEND_API_KEY
# Keep FROM_EMAIL from settings or default
FROM_EMAIL = getattr(settings, "FROM_EMAIL", "onboarding@resend.dev")

def send_email(to_email: str, subject: str, html: str):
    if not resend.api_key:
        print("Warning: RESEND_API_KEY is not set.")
    try:
        return resend.Emails.send({
            "from": FROM_EMAIL,
            "to": [to_email],
            "subject": subject,
            "html": html
        })
    except Exception as e:
        print("EMAIL ERROR:", e)
        raise e
