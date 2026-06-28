import google.generativeai as genai
from app.core.config import settings
import httpx
from PIL import Image
import io

def verify_dress_code(image_url: str) -> bool:
    """
    Downloads the image from the given URL and uses Google Gemini Vision
    to verify if the student is wearing the correct uniform.
    
    Rule: Boys must wear striped shirt and dark pants. 
          Girls must wear striped top (with or without dark checkered coat).
    Returns True if valid, False if rejected.
    """
    if not settings.GEMINI_API_KEY:
        print("⚠️ GEMINI_API_KEY not found. Skipping AI dress code verification. Assuming valid.")
        return True
        
    try:
        # Download the image
        # If it's a local url starting with /uploads, we need to construct the full local url
        if image_url.startswith("/uploads/"):
            # Try to read directly from disk to avoid HTTP loopback issues
            import os
            filepath = os.path.join(settings.UPLOAD_DIR, os.path.basename(image_url))
            if os.path.exists(filepath):
                image = Image.open(filepath)
            else:
                return True
        else:
            response = httpx.get(image_url, timeout=15.0)
            response.raise_for_status()
            image = Image.open(io.BytesIO(response.content))
            
        genai.configure(api_key=settings.GEMINI_API_KEY)
        
        prompt = (
            "You are a strict automated dress code verifier for a college. "
            "Examine this photo. The acceptable uniform is: "
            "For boys: A light-colored striped shirt and dark pants. "
            "For girls: A light-colored striped top, optionally with a dark checkered overcoat. "
            "An ID card is NOT mandatory. "
            "Does the clothing worn by the person in the image reasonably match this uniform description? "
            "Respond exactly with the word 'YES' if it matches, or 'NO' if it does not match or if you cannot tell."
        )
        
        models_to_try = ['gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-pro-vision']
        response = None
        
        for model_name in models_to_try:
            try:
                model = genai.GenerativeModel(model_name)
                response = model.generate_content([prompt, image])
                break # Success!
            except Exception as e:
                print(f"⚠️ Model {model_name} failed: {e}")
                
        if not response:
            raise Exception("All attempted Gemini models failed or threw 404.")
            
        result = response.text.strip().upper()
        
        print(f"🧠 AI Dress Code Result: {result}")
        if "YES" in result:
            return True
        return False

    except Exception as e:
        print(f"⚠️ AI Verification Error: {e}")
        # Fail open or fail closed? The pseudo code implies we strictly reject if we know it's a mismatch. 
        # If the API fails, we could assume True so we don't accidentally block students due to server issues.
        return True
