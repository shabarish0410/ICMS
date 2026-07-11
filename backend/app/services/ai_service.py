"""
AI Service — Institutional Uniform Detection
Uses Google Gemini Vision to compare a live image against registered uniform reference images.
Falls back to permissive mode if no uniforms are registered or Gemini is unavailable.
"""

import io
import base64
import logging
from typing import Optional, Dict, Any

import google.genai as genai
from google.genai import types as genai_types
from app.core.config import settings

logger = logging.getLogger("icms.ai")


# ─── Internal Helpers ─────────────────────────────────────────────────────────

def _bytes_to_pil(image_bytes: bytes):
    """Convert raw bytes to PIL Image."""
    from PIL import Image
    return Image.open(io.BytesIO(image_bytes)).convert("RGB")


def _url_to_pil(url: str):
    """Download an image URL and return PIL Image. Returns None on failure."""
    try:
        import httpx
        response = httpx.get(url, timeout=15.0)
        response.raise_for_status()
        from PIL import Image
        return Image.open(io.BytesIO(response.content)).convert("RGB")
    except Exception as e:
        logger.warning(f"Could not download uniform reference image from {url}: {e}")
        return None


def _get_active_uniforms(department: Optional[str] = None) -> list:
    """Fetch active uniform entries from Supabase, optionally filtered by department."""
    try:
        from app.core.supabase import get_supabase
        supabase = get_supabase()
        query = supabase.table("uniforms").select("*").eq("is_active", True)
        if department and department.lower() not in ("", "all"):
            # Match department-specific OR 'all' uniforms
            res_dept = supabase.table("uniforms").select("*").eq("is_active", True).eq("department", department).execute()
            res_all = supabase.table("uniforms").select("*").eq("is_active", True).eq("department", "all").execute()
            return (res_dept.data or []) + (res_all.data or [])
        res = query.execute()
        return res.data or []
    except Exception as e:
        logger.warning(f"Could not fetch uniforms from DB: {e}")
        return []


def _build_gemini_prompt(has_references: bool) -> str:
    """Build the Gemini analysis prompt based on whether we have reference images."""
    if has_references:
        return (
            "You are a strict automated uniform compliance checker for a college institution.\n\n"
            "The FIRST image(s) are the OFFICIAL REGISTERED UNIFORM reference photos.\n"
            "The LAST image is the LIVE IMAGE of the student taken right now.\n\n"
            "Compare the student's clothing in the live image against the official uniform references.\n"
            "Check ALL of the following in detail:\n"
            "  1. Shirt/top color — does it match? (yes/no/partial)\n"
            "  2. Shirt collar style — does it match? (yes/no/partial)\n"
            "  3. Sleeve type — does it match? (yes/no/partial)\n"
            "  4. Uniform pattern or stripes — does it match? (yes/no/partial)\n"
            "  5. Visible logo or badge — detected? (yes/no/unclear)\n"
            "  6. ID card worn — visible? (yes/no/unclear)\n"
            "  7. Overall match confidence — as a percentage (0-100)\n\n"
            "IMPORTANT RULES:\n"
            "- Allow for minor lighting or angle differences.\n"
            "- Reject if the student is wearing casual clothes, a plain shirt, or a jacket hiding the uniform.\n"
            "- Reject if wearing the wrong color or wrong collar type.\n\n"
            "Respond ONLY in this exact JSON format (no extra text):\n"
            "{\n"
            '  "verdict": "PASS" or "FAIL",\n'
            '  "confidence": <number 0-100>,\n'
            '  "color": "match" or "mismatch" or "partial",\n'
            '  "collar": "match" or "mismatch" or "partial",\n'
            '  "sleeve": "match" or "mismatch" or "partial",\n'
            '  "pattern": "match" or "mismatch" or "partial",\n'
            '  "logo": "detected" or "not_detected" or "unclear",\n'
            '  "id_card": "detected" or "not_detected" or "unclear",\n'
            '  "reason": "<one sentence explanation>"\n'
            "}"
        )
    else:
        # No reference images registered — do a general uniform check
        return (
            "You are a strict automated uniform compliance checker for a college institution.\n\n"
            "Look at this image of a student.\n"
            "Determine if the student is wearing a formal institutional uniform (not casual clothes).\n\n"
            "A proper uniform typically has:\n"
            "  - A formal shirt (collared, striped or solid, tucked in) — NOT a t-shirt or hoodie\n"
            "  - Dark formal trousers or formal skirt\n"
            "  - Possibly a tie, blazer, or ID card\n\n"
            "REJECT if the student is wearing:\n"
            "  - T-shirts, hoodies, casual tops\n"
            "  - Shorts or jeans\n"
            "  - Jackets/sweaters covering the shirt completely\n\n"
            "Respond ONLY in this exact JSON format (no extra text):\n"
            "{\n"
            '  "verdict": "PASS" or "FAIL",\n'
            '  "confidence": <number 0-100>,\n'
            '  "color": "match" or "mismatch" or "unclear",\n'
            '  "collar": "match" or "mismatch" or "unclear",\n'
            '  "sleeve": "match" or "mismatch" or "unclear",\n'
            '  "pattern": "unclear",\n'
            '  "logo": "unclear",\n'
            '  "id_card": "unclear",\n'
            '  "reason": "<one sentence explanation>"\n'
            "}"
        )


# ─── Main Public Function ─────────────────────────────────────────────────────

def verify_uniform_with_reference(
    image_bytes: bytes,
    department: Optional[str] = None
) -> Dict[str, Any]:
    """
    Verify student uniform against registered institutional uniform reference images.

    Args:
        image_bytes: Raw bytes of the student's live image
        department: Student's department (e.g. 'CSE') — used to filter relevant uniforms

    Returns:
        {
            valid: bool,
            confidence: float (0-100),
            reason: str,
            details: {color, collar, sleeve, pattern, logo, id_card}
        }
    """
    if not settings.GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY not set. Skipping uniform verification (permissive fallback).")
        return {
            "valid": True,
            "confidence": 100.0,
            "reason": "Uniform check skipped (AI not configured).",
            "details": {}
        }

    try:
        from PIL import Image
        live_image = _bytes_to_pil(image_bytes)

        # ── Fetch registered uniform reference images ──────────────────────────
        uniforms = _get_active_uniforms(department=department)
        reference_images = []
        for uniform in uniforms[:3]:  # Use at most 3 reference uniforms (Gemini limit)
            for url_field in ["front_image_url", "logo_image_url", "back_image_url"]:
                url = uniform.get(url_field)
                if url:
                    ref_img = _url_to_pil(url)
                    if ref_img:
                        reference_images.append(ref_img)
                        break  # One image per uniform entry to stay within Gemini limits

        has_references = len(reference_images) > 0
        prompt = _build_gemini_prompt(has_references)

        # ── Call Gemini Vision ─────────────────────────────────────────────────
        client = genai.Client(api_key=settings.GEMINI_API_KEY)

        # Build parts list: reference images first, then live image
        parts = [prompt]
        for ref_img in reference_images:
            import io as _io
            buf = _io.BytesIO()
            ref_img.save(buf, format="JPEG", quality=85)
            parts.append(genai_types.Part.from_bytes(data=buf.getvalue(), mime_type="image/jpeg"))
        # Add live image last
        live_buf = _io.BytesIO()
        live_image.save(live_buf, format="JPEG", quality=85)
        parts.append(genai_types.Part.from_bytes(data=live_buf.getvalue(), mime_type="image/jpeg"))

        models_to_try = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-latest']
        response = None
        for model_name in models_to_try:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=parts
                )
                break
            except Exception as e:
                logger.warning(f"Gemini model {model_name} failed: {e}")

        if not response:
            logger.error("All Gemini models failed for uniform detection. Allowing attendance.")
            return {
                "valid": True,
                "confidence": 50.0,
                "reason": "Uniform check could not complete (AI error). Attendance allowed.",
                "details": {}
            }

        # ── Parse Gemini JSON response ─────────────────────────────────────────
        raw = response.text.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        import json
        try:
            result = json.loads(raw)
        except json.JSONDecodeError:
            # Try to extract JSON from the text
            import re
            json_match = re.search(r'\{.*\}', raw, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
            else:
                logger.error(f"Could not parse Gemini response: {raw}")
                return {
                    "valid": True,
                    "confidence": 50.0,
                    "reason": "Uniform check response unreadable. Attendance allowed.",
                    "details": {}
                }

        verdict = result.get("verdict", "PASS").upper()
        confidence = float(result.get("confidence", 50))
        reason = result.get("reason", "")
        details = {
            "color": result.get("color", "unclear"),
            "collar": result.get("collar", "unclear"),
            "sleeve": result.get("sleeve", "unclear"),
            "pattern": result.get("pattern", "unclear"),
            "logo": result.get("logo", "unclear"),
            "id_card": result.get("id_card", "unclear"),
        }

        is_valid = verdict == "PASS"

        logger.info(
            f"Uniform detection: verdict={verdict} confidence={confidence}% "
            f"department={department} refs_used={len(reference_images)}"
        )

        return {
            "valid": is_valid,
            "confidence": round(confidence, 1),
            "reason": reason,
            "details": details
        }

    except Exception as e:
        logger.error(f"verify_uniform_with_reference error: {e}")
        # Fail open — don't block student if AI system errors
        return {
            "valid": True,
            "confidence": 50.0,
            "reason": f"Uniform check error: {e}. Attendance allowed.",
            "details": {}
        }


# ─── Legacy wrapper (kept for backward compatibility) ─────────────────────────

def verify_dress_code(image_url: str) -> bool:
    """
    Legacy function — downloads image from URL and runs uniform check.
    Use verify_uniform_with_reference(image_bytes) for new code.
    """
    try:
        import httpx
        from PIL import Image

        if image_url.startswith("/uploads/"):
            import os
            filepath = os.path.join(settings.UPLOAD_DIR, os.path.basename(image_url))
            if os.path.exists(filepath):
                with open(filepath, "rb") as f:
                    img_bytes = f.read()
            else:
                logger.warning(f"Local upload not found: {filepath}. Allowing dress code.")
                return True
        else:
            response = httpx.get(image_url, timeout=15.0)
            response.raise_for_status()
            img_bytes = response.content

        result = verify_uniform_with_reference(img_bytes)
        return result["valid"]

    except Exception as e:
        logger.warning(f"Legacy verify_dress_code error: {e}. Allowing.")
        return True
