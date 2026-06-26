import logging
import os
from app.core.config import settings

# Setup audit logger for SMS
os.makedirs("logs", exist_ok=True)
audit_logger = logging.getLogger("sms_audit")
audit_logger.setLevel(logging.INFO)
if not audit_logger.handlers:
    handler = logging.FileHandler("logs/sms_audit.log")
    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    audit_logger.addHandler(handler)

def send_otp_sms(mobile: str, otp: str) -> bool:
    """
    Sends a 6-digit OTP to the registered mobile number.
    Supports mock, twilio, msg91, fast2sms, and aws_sns.
    """
    masked_mobile = f"{mobile[:3]}****{mobile[-3:]}" if len(mobile) >= 6 else mobile
    # Log audit entry without plain text OTP
    audit_logger.info(f"Initiated OTP delivery for mobile: {masked_mobile}")
    
    provider = settings.SMS_PROVIDER.lower()
    message = f"Your Spark Innovation Center Registration OTP is: {otp}. Valid for 5 minutes."
    
    if provider == "twilio":
        try:
            # We import twilio inline so it isn't a hard startup dependency if not used
            from twilio.rest import Client
            client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
            client.messages.create(
                body=message,
                from_=settings.TWILIO_FROM_NUMBER,
                to=mobile
            )
            audit_logger.info(f"OTP successfully sent via Twilio to {masked_mobile}")
            return True
        except Exception as e:
            audit_logger.error(f"Twilio SMS failed for {masked_mobile}: {str(e)}")
            return False
            
    elif provider == "msg91":
        try:
            import requests
            # Send using MSG91 API
            url = "https://api.msg91.com/api/v5/otp"
            params = {
                "template_id": settings.MSG91_TEMPLATE_ID,
                "mobile": mobile,
                "authkey": settings.MSG91_AUTH_KEY,
                "otp": otp
            }
            res = requests.post(url, json=params, timeout=10)
            if res.status_code == 200:
                audit_logger.info(f"OTP successfully sent via MSG91 to {masked_mobile}")
                return True
            else:
                audit_logger.error(f"MSG91 SMS failed for {masked_mobile}: {res.text}")
                return False
        except Exception as e:
            audit_logger.error(f"MSG91 SMS error for {masked_mobile}: {str(e)}")
            return False
            
    elif provider == "fast2sms":
        try:
            import requests
            # Send using Fast2SMS Quick SMS API
            url = "https://www.fast2sms.com/dev/bulkV2"
            headers = {
                "authorization": settings.FAST2SMS_API_KEY,
                "Content-Type": "application/json"
            }
            payload = {
                "route": "otp",
                "variables_values": otp,
                "numbers": mobile
            }
            res = requests.post(url, json=payload, headers=headers, timeout=10)
            if res.status_code == 200 and res.json().get("return"):
                audit_logger.info(f"OTP successfully sent via Fast2SMS to {masked_mobile}")
                return True
            else:
                audit_logger.error(f"Fast2SMS SMS failed for {masked_mobile}: {res.text}")
                return False
        except Exception as e:
            audit_logger.error(f"Fast2SMS SMS error for {masked_mobile}: {str(e)}")
            return False
            
    elif provider == "aws_sns":
        try:
            import boto3
            client = boto3.client(
                "sns",
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_REGION
            )
            client.publish(
                PhoneNumber=mobile,
                Message=message
            )
            audit_logger.info(f"OTP successfully sent via AWS SNS to {masked_mobile}")
            return True
        except Exception as e:
            audit_logger.error(f"AWS SNS SMS failed for {masked_mobile}: {str(e)}")
            return False
            
    else:  # mock mode
        print(f"\n[MOCK SMS] To: {mobile} | Message: {message}\n")
        audit_logger.info(f"OTP successfully logged via Mock SMS to {masked_mobile}")
        return True
