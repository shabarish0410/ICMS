import resend
from app.core.config import settings

# Initialize resend API key from settings and strip any accidental whitespace
resend.api_key = settings.RESEND_API_KEY.strip() if settings.RESEND_API_KEY else ""
# Keep FROM_EMAIL from settings or default
FROM_EMAIL = getattr(settings, "FROM_EMAIL", "onboarding@resend.dev")

def send_email(to_email: str, subject: str, html: str):
    if not resend.api_key:
        print("Warning: RESEND_API_KEY is not set or is empty.")
    try:
        print(f"Attempting to send email to {to_email} via Resend. Key length: {len(resend.api_key)}")
        response = resend.Emails.send({
            "from": FROM_EMAIL,
            "to": [to_email],
            "subject": subject,
            "html": html
        })
        print("Email sent successfully:", response)
        return response
    except Exception as e:
        print("RESEND API ERROR:", str(e))
        raise RuntimeError(f"Email delivery failed: {str(e)}")
