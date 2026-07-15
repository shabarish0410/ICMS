import os
import requests
from app.core.config import settings

def send_email(to_email: str, subject: str, html: str):
    """
    Send an email using the Brevo (Sendinblue) HTTP API.
    This completely bypasses any outbound SMTP firewalls on Render.
    """
    # Prefer explicitly loaded environment variable or fallback to settings
    api_key = os.getenv("BREVO_API_KEY", getattr(settings, "BREVO_API_KEY", "")).strip()
    from_email = os.getenv("FROM_EMAIL", getattr(settings, "FROM_EMAIL", "sparkinnovationsbit@gmail.com")).strip()
    
    if not api_key:
        print("Warning: BREVO_API_KEY is not set. Email will fail.")
        
    url = "https://api.brevo.com/v3/smtp/email"
    headers = {
        "accept": "application/json",
        "api-key": api_key,
        "content-type": "application/json"
    }
    payload = {
        "sender": {
            "name": "Spark Innovation Center",
            "email": from_email
        },
        "to": [
            {
                "email": to_email
            }
        ],
        "subject": subject,
        "htmlContent": html
    }

    try:
        print(f"Attempting to send Brevo HTTP email to {to_email}")
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        
        if response.status_code in [200, 201, 202]:
            print(f"Email sent successfully to {to_email} via Brevo!")
            return True
        else:
            key_len = len(api_key) if api_key else 0
            error_msg = f"Brevo API Error (Key length: {key_len}) ({response.status_code}): {response.text}"
            print(error_msg)
            # Do NOT re-raise — a Brevo outage must never cause a 500 on login
            return False
            
    except Exception as e:
        print("BREVO ERROR:", str(e))
        # Do NOT re-raise — callers should degrade gracefully
        return False

