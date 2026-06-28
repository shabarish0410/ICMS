import resend
import os

resend.api_key = os.getenv("RESEND_API_KEY")
FROM_EMAIL = os.getenv("FROM_EMAIL", "onboarding@resend.dev")

def send_email(to_email: str, subject: str, html: str):
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
