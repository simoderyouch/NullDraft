"""AI provider abstraction for NullDraft.

Primary provider is Mistral. OpenAI is supported as an optional alternative
when the `openai` package is installed and an OpenAI key is configured.
All functions degrade gracefully and raise informative errors.
"""

from __future__ import annotations

import base64
import json
import os
import re
from typing import Optional


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

def get_provider() -> str:
    return os.getenv("AI_PROVIDER", "mistral").lower()


MISTRAL_TEXT_MODEL = os.getenv("MISTRAL_TEXT_MODEL", "mistral-large-latest")
MISTRAL_VISION_MODEL = os.getenv("MISTRAL_VISION_MODEL", "pixtral-12b-2409")
OPENAI_TEXT_MODEL = os.getenv("OPENAI_TEXT_MODEL", "gpt-4o-mini")
OPENAI_VISION_MODEL = os.getenv("OPENAI_VISION_MODEL", "gpt-4o-mini")


class AIError(RuntimeError):
    pass


# ---------------------------------------------------------------------------
# Client construction
# ---------------------------------------------------------------------------

def _mistral_client():
    key = os.getenv("MISTRAL_API_KEY", "")
    if not key:
        raise AIError("MISTRAL_API_KEY not configured")
    from mistralai.client import Mistral
    return Mistral(api_key=key)


def _openai_client():
    key = os.getenv("OPENAI_API_KEY", "")
    if not key:
        raise AIError("OPENAI_API_KEY not configured")
    try:
        from openai import OpenAI
    except ImportError as e:
        raise AIError("openai package not installed") from e
    return OpenAI(api_key=key)


def is_configured() -> bool:
    provider = get_provider()
    if provider == "openai":
        return bool(os.getenv("OPENAI_API_KEY"))
    return bool(os.getenv("MISTRAL_API_KEY"))


# ---------------------------------------------------------------------------
# Low-level calls
# ---------------------------------------------------------------------------

def _data_uri(image_bytes: bytes, mime: str = "image/png") -> str:
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    return f"data:{mime};base64,{b64}"


def chat_text(prompt: str, json_mode: bool = False) -> str:
    provider = get_provider()
    if provider == "openai":
        client = _openai_client()
        kwargs = {}
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        resp = client.chat.completions.create(
            model=OPENAI_TEXT_MODEL,
            messages=[{"role": "user", "content": prompt}],
            **kwargs,
        )
        return resp.choices[0].message.content or ""

    client = _mistral_client()
    kwargs = {}
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    resp = client.chat.complete(
        model=MISTRAL_TEXT_MODEL,
        messages=[{"role": "user", "content": prompt}],
        **kwargs,
    )
    return resp.choices[0].message.content or ""


def chat_vision(prompt: str, image_bytes: bytes, mime: str = "image/png") -> str:
    uri = _data_uri(image_bytes, mime)
    provider = get_provider()

    if provider == "openai":
        client = _openai_client()
        resp = client.chat.completions.create(
            model=OPENAI_VISION_MODEL,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": uri}},
                ],
            }],
        )
        return resp.choices[0].message.content or ""

    client = _mistral_client()
    resp = client.chat.complete(
        model=MISTRAL_VISION_MODEL,
        messages=[{
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": uri},
            ],
        }],
    )
    return resp.choices[0].message.content or ""


# ---------------------------------------------------------------------------
# JSON helpers
# ---------------------------------------------------------------------------

def _extract_json(text: str):
    """Best-effort extraction of a JSON object/array from a model response."""
    text = (text or "").strip()
    # Strip code fences
    text = re.sub(r"^```(?:json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    try:
        return json.loads(text)
    except Exception:
        pass
    # Find the first {...} or [...] block
    for open_c, close_c in (("{", "}"), ("[", "]")):
        start = text.find(open_c)
        end = text.rfind(close_c)
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(text[start:end + 1])
            except Exception:
                continue
    return None


# ---------------------------------------------------------------------------
# Feature functions
# ---------------------------------------------------------------------------

def analyze_instructions(text: str) -> list[dict]:
    prompt = f"""You are a technical documentation assistant helping a user perform a
technical assessment, lab (TP), or task. Extract the key steps from the following
text and return them as JSON.

Return a JSON object with a "steps" array. Each item must have:
- "id": a unique string identifier
- "title": a short title for the step
- "description": a detailed instruction for what the user should do

Text:
{text}

Return ONLY valid JSON."""
    raw = chat_text(prompt, json_mode=True)
    data = _extract_json(raw)
    if isinstance(data, dict):
        return data.get("steps", [])
    if isinstance(data, list):
        return data
    return []


def describe_screenshot(step_title: str, image_bytes: bytes, mime: str = "image/png") -> str:
    prompt = f"""This is a screenshot taken by a user during the step: '{step_title}'.
Describe what is happening in the screenshot and write a short, clear explanation
of the action performed, suitable for a technical report. Use 2-4 sentences."""
    return chat_vision(prompt, image_bytes, mime).strip()


def generate_captions(steps: list[dict]) -> list[dict]:
    """steps: [{id, title, description, generated_description}] -> [{id, caption}]"""
    payload = json.dumps(steps, indent=2)
    prompt = f"""You are writing figure captions for a technical report. For each step
below, write a concise, formal figure caption (one short sentence, no "Figure N"
prefix — numbering is added automatically).

Steps:
{payload}

Return ONLY a JSON object with a "captions" array of objects, each with "id" and "caption"."""
    raw = chat_text(prompt, json_mode=True)
    data = _extract_json(raw)
    if isinstance(data, dict):
        return data.get("captions", [])
    if isinstance(data, list):
        return data
    return []


def validate_step(step_title: str, step_description: str, image_bytes: bytes,
                  mime: str = "image/png") -> dict:
    prompt = f"""You are validating a screenshot for a documentation step.
Step title: '{step_title}'
Expected: '{step_description}'

Look at the screenshot and decide if it matches what the step expects.
Return ONLY a JSON object: {{"pass": true/false, "confidence": 0-1, "message": "short explanation"}}."""
    raw = chat_vision(prompt, image_bytes, mime)
    data = _extract_json(raw)
    if isinstance(data, dict):
        return {
            "pass": bool(data.get("pass", False)),
            "confidence": float(data.get("confidence", 0) or 0),
            "message": str(data.get("message", "")),
        }
    return {"pass": False, "confidence": 0.0, "message": raw.strip()[:300]}


def analyze_document(text: str) -> dict:
    prompt = f"""You are analyzing an existing technical document to find where
screenshots/figures are needed. Identify placeholders (e.g. [FIGURE], {{{{FIGURE_x}}}},
"insert screenshot here", "TODO image") and sections that clearly need a figure.

Document text:
{text}

Return ONLY a JSON object with:
- "placeholders": array of {{"location": "short quote of surrounding text", "suggested_title": "...", "suggested_description": "..."}}
- "summary": a one-sentence summary of how many figures are needed."""
    raw = chat_text(prompt, json_mode=True)
    data = _extract_json(raw)
    if isinstance(data, dict):
        return data
    return {"placeholders": [], "summary": ""}


def detect_sensitive(image_bytes: bytes, mime: str = "image/png") -> list[dict]:
    """Returns list of regions: {x, y, width, height, type} as fractions [0-1]."""
    prompt = """Examine this screenshot for sensitive information such as passwords,
API keys, tokens, email addresses, phone numbers, credit card numbers, or other
personal data that should be blurred before sharing.

Return ONLY a JSON object with a "regions" array. Each region:
{"x": <left fraction 0-1>, "y": <top fraction 0-1>, "width": <fraction 0-1>, "height": <fraction 0-1>, "type": "password|email|key|other"}
Use fractions of the image dimensions. If nothing sensitive is found, return an empty array."""
    raw = chat_vision(prompt, image_bytes, mime)
    data = _extract_json(raw)
    regions = []
    if isinstance(data, dict):
        regions = data.get("regions", [])
    elif isinstance(data, list):
        regions = data
    cleaned = []
    for r in regions:
        try:
            cleaned.append({
                "x": float(r.get("x", 0)),
                "y": float(r.get("y", 0)),
                "width": float(r.get("width", 0)),
                "height": float(r.get("height", 0)),
                "type": str(r.get("type", "other")),
            })
        except Exception:
            continue
    return cleaned


def ocr_image(image_bytes: bytes, mime: str = "image/png") -> str:
    prompt = """Extract ALL visible text from this screenshot. Return the text exactly
as it appears, preserving line breaks where reasonable. Return ONLY the extracted text,
no commentary."""
    return chat_vision(prompt, image_bytes, mime).strip()


def suggest_next_step(steps: list[dict], current_index: int = -1,
                      document_text: str = "") -> dict:
    """Suggest the next logical step based on the defined manual steps and the
    source document — NOT on screenshot content."""
    payload = json.dumps(steps, indent=2)
    doc_section = f"\nSource document / instructions:\n{document_text}\n" if document_text else ""
    position = (
        f"The user is currently on step index {current_index} (0-based)."
        if current_index is not None and current_index >= 0
        else "Suggest the step that should come after the last one."
    )
    prompt = f"""You are helping a user document a procedure. Based ONLY on the
already-defined steps (the manual) and the source document below, suggest the
most logical NEXT step to add to the procedure. Do not assume anything from
screenshots — reason from the written steps and document.

{position}

Defined steps:
{payload}
{doc_section}
Return ONLY a JSON object: {{"title": "...", "description": "..."}}."""
    raw = chat_text(prompt, json_mode=True)
    data = _extract_json(raw)
    if isinstance(data, dict):
        return {"title": str(data.get("title", "")), "description": str(data.get("description", ""))}
    return {"title": "", "description": ""}


def smart_crop_region(step_title: str, image_bytes: bytes, mime: str = "image/png") -> dict:
    """Return the crop region (fractions 0-1) focusing on the relevant UI for the step."""
    prompt = f"""This screenshot was captured for the step: '{step_title}'.
Identify the single most relevant UI region for this step (the form, button, dialog,
or area a reader should focus on) and return a tight bounding box around it.

Return ONLY a JSON object with fractions of the image dimensions:
{{"x": <left 0-1>, "y": <top 0-1>, "width": <0-1>, "height": <0-1>}}
If the whole screen is relevant, return {{"x":0,"y":0,"width":1,"height":1}}."""
    raw = chat_vision(prompt, image_bytes, mime)
    data = _extract_json(raw)
    if isinstance(data, dict):
        try:
            return {
                "x": max(0.0, min(1.0, float(data.get("x", 0)))),
                "y": max(0.0, min(1.0, float(data.get("y", 0)))),
                "width": max(0.0, min(1.0, float(data.get("width", 1)))),
                "height": max(0.0, min(1.0, float(data.get("height", 1)))),
            }
        except Exception:
            pass
    return {"x": 0.0, "y": 0.0, "width": 1.0, "height": 1.0}


def suggest_branches(steps: list[dict], current_index: int = -1,
                     document_text: str = "") -> list[dict]:
    """Suggest conditional branches (e.g. success vs error path) from the defined
    steps and document — NOT from screenshots."""
    payload = json.dumps(steps, indent=2)
    doc_section = f"\nSource document / instructions:\n{document_text}\n" if document_text else ""
    position = (
        f"The user is currently on step index {current_index} (0-based)."
        if current_index is not None and current_index >= 0
        else "Consider the procedure as a whole."
    )
    prompt = f"""You are designing conditional branches for a documented procedure.
Based ONLY on the defined steps (the manual) and the source document below, propose
alternate paths that could follow — for example a success path and an error/failure
path. {position}

Defined steps:
{payload}
{doc_section}
Return ONLY a JSON object with a "branches" array. Each branch:
{{"condition": "e.g. 'On success' or 'If an error appears'", "title": "...", "description": "..."}}"""
    raw = chat_text(prompt, json_mode=True)
    data = _extract_json(raw)
    branches = []
    if isinstance(data, dict):
        branches = data.get("branches", [])
    elif isinstance(data, list):
        branches = data
    cleaned = []
    for b in branches:
        if isinstance(b, dict):
            cleaned.append({
                "condition": str(b.get("condition", "")),
                "title": str(b.get("title", "")),
                "description": str(b.get("description", "")),
            })
    return cleaned


def generate_narrative(title: str, steps: list[dict]) -> dict:
    payload = json.dumps(steps, indent=2)
    prompt = f"""Write connecting prose for a technical report titled '{title}'.
Given these steps, write a short introduction, and a short conclusion.

Steps:
{payload}

Return ONLY a JSON object: {{"introduction": "...", "conclusion": "..."}}."""
    raw = chat_text(prompt, json_mode=True)
    data = _extract_json(raw)
    if isinstance(data, dict):
        return {
            "introduction": str(data.get("introduction", "")),
            "conclusion": str(data.get("conclusion", "")),
        }
    return {"introduction": "", "conclusion": ""}
