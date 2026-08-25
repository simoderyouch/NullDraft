"""AI provider abstraction for NullDraft.

Supports Mistral, OpenAI, Anthropic Claude, and Google Gemini. Each provider
uses its own API key and supports both text and screenshot analysis.
"""

from __future__ import annotations

import base64
import json
import os
import re
from typing import Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

def get_provider() -> str:
    return os.getenv("AI_PROVIDER", "mistral").lower()


MISTRAL_TEXT_MODEL = os.getenv("MISTRAL_TEXT_MODEL", "mistral-large-latest")
MISTRAL_VISION_MODEL = os.getenv("MISTRAL_VISION_MODEL", "pixtral-12b-2409")
OPENAI_TEXT_MODEL = os.getenv("OPENAI_TEXT_MODEL", "gpt-4o-mini")
OPENAI_VISION_MODEL = os.getenv("OPENAI_VISION_MODEL", "gpt-4o-mini")
ANTHROPIC_TEXT_MODEL = os.getenv("ANTHROPIC_TEXT_MODEL", "claude-sonnet-4-5")
ANTHROPIC_VISION_MODEL = os.getenv("ANTHROPIC_VISION_MODEL", ANTHROPIC_TEXT_MODEL)
GEMINI_TEXT_MODEL = os.getenv("GEMINI_TEXT_MODEL", "gemini-3.7-flash")
GEMINI_VISION_MODEL = os.getenv("GEMINI_VISION_MODEL", GEMINI_TEXT_MODEL)

PROVIDER_KEY_NAMES = {
    "mistral": "MISTRAL_API_KEY",
    "openai": "OPENAI_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
    "gemini": "GEMINI_API_KEY",
}


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


def _provider_key(provider: str) -> str:
    key_name = PROVIDER_KEY_NAMES.get(provider)
    if not key_name:
        raise AIError(f"Unsupported AI provider: {provider}")
    return os.getenv(key_name, "")


def _post_json(url: str, payload: dict, headers: dict[str, str]) -> dict:
    request = Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", **headers},
        method="POST",
    )
    try:
        with urlopen(request, timeout=90) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:500]
        raise AIError(f"Provider request failed ({error.code}): {detail}") from error
    except URLError as error:
        raise AIError(f"Could not reach AI provider: {error.reason}") from error


def _anthropic_response_text(payload: dict) -> str:
    return "".join(
        str(block.get("text", ""))
        for block in payload.get("content", [])
        if block.get("type") == "text"
    ).strip()


def _gemini_response_text(payload: dict) -> str:
    candidates = payload.get("candidates", [])
    if not candidates:
        raise AIError("Gemini returned no response candidates")
    parts = candidates[0].get("content", {}).get("parts", [])
    return "".join(str(part.get("text", "")) for part in parts if "text" in part).strip()


def is_configured() -> bool:
    provider = get_provider()
    return bool(_provider_key(provider))


# ---------------------------------------------------------------------------
# Low-level calls
# ---------------------------------------------------------------------------

def _data_uri(image_bytes: bytes, mime: str = "image/png") -> str:
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    return f"data:{mime};base64,{b64}"


def chat_text(prompt: str, json_mode: bool = False, max_tokens: Optional[int] = None) -> str:
    provider = get_provider()
    if provider == "openai":
        client = _openai_client()
        kwargs = {}
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        if max_tokens is not None:
            kwargs["max_tokens"] = max_tokens
        resp = client.chat.completions.create(
            model=OPENAI_TEXT_MODEL,
            messages=[{"role": "user", "content": prompt}],
            **kwargs,
        )
        return resp.choices[0].message.content or ""

    if provider == "anthropic":
        key = _provider_key(provider)
        payload = _post_json(
            "https://api.anthropic.com/v1/messages",
            {
                "model": ANTHROPIC_TEXT_MODEL,
                "max_tokens": max_tokens or 4096,
                "messages": [{"role": "user", "content": prompt}],
            },
            {"x-api-key": key, "anthropic-version": "2023-06-01"},
        )
        return _anthropic_response_text(payload)

    if provider == "gemini":
        key = _provider_key(provider)
        generation_config = {"maxOutputTokens": max_tokens} if max_tokens else {}
        if json_mode:
            generation_config["responseMimeType"] = "application/json"
        payload = _post_json(
            f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_TEXT_MODEL}:generateContent",
            {"contents": [{"role": "user", "parts": [{"text": prompt}]}], "generationConfig": generation_config},
            {"x-goog-api-key": key},
        )
        return _gemini_response_text(payload)

    if provider != "mistral":
        raise AIError(f"Unsupported AI provider: {provider}")
    client = _mistral_client()
    kwargs = {}
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    if max_tokens is not None:
        kwargs["max_tokens"] = max_tokens
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

    if provider == "anthropic":
        key = _provider_key(provider)
        payload = _post_json(
            "https://api.anthropic.com/v1/messages",
            {
                "model": ANTHROPIC_VISION_MODEL,
                "max_tokens": 2048,
                "messages": [{
                    "role": "user",
                    "content": [
                        {"type": "image", "source": {"type": "base64", "media_type": mime, "data": base64.b64encode(image_bytes).decode("utf-8")}},
                        {"type": "text", "text": prompt},
                    ],
                }],
            },
            {"x-api-key": key, "anthropic-version": "2023-06-01"},
        )
        return _anthropic_response_text(payload)

    if provider == "gemini":
        key = _provider_key(provider)
        payload = _post_json(
            f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_VISION_MODEL}:generateContent",
            {"contents": [{"role": "user", "parts": [
                {"inline_data": {"mime_type": mime, "data": base64.b64encode(image_bytes).decode("utf-8")}},
                {"text": prompt},
            ]}]},
            {"x-goog-api-key": key},
        )
        return _gemini_response_text(payload)

    if provider != "mistral":
        raise AIError(f"Unsupported AI provider: {provider}")
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

def _language_instruction(language_name: str = "", language_code: str = "") -> str:
    if not language_name:
        return (
            "Use the same language as the source document. Do not switch languages "
            "inside user-facing prose."
        )
    code = f" ({language_code})" if language_code else ""
    return (
        f"Write ALL user-facing prose only in {language_name}{code}. "
        "Do not switch to English unless the requested language is English. "
        "If commands, file names, product names, UI labels, or error text are in another language, "
        "quote them as-is but explain them in the requested language."
    )


def _clean_step_description(value: str) -> str:
    """Keep the model's action and capture guidance while normalizing whitespace."""
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _normalize_generated_steps(steps: list[dict]) -> list[dict]:
    normalized = []
    for idx, raw in enumerate(steps, 1):
        if not isinstance(raw, dict):
            continue
        title = str(raw.get("title", "") or "").strip()
        caption = str(raw.get("caption", "") or "").strip()
        description = _clean_step_description(raw.get("description", ""))
        normalized.append({
            "id": str(raw.get("id", "") or f"step-{idx}"),
            "title": title,
            "caption": caption or title,
            "description": description,
        })
    return normalized


def _steps_from_model_response(raw: str) -> list[dict]:
    data = _extract_json(raw)
    if isinstance(data, dict):
        return _normalize_generated_steps(data.get("steps", []))
    if isinstance(data, list):
        return _normalize_generated_steps(data)
    return []


def _fallback_numbered_steps(text: str, language_code: str = "") -> list[dict]:
    """Create useful steps from numbered assignment instructions if the AI fails.

    Many TP PDFs already contain an ordered list of commands. Returning those
    instructions is far more useful than returning an empty workflow.
    """
    matches = list(re.finditer(r"(?m)^\s*\d{1,2}\s*[.)]\s+(?=\S)", text or ""))
    if not matches:
        return []

    is_french = language_code.lower().startswith("fr")
    capture_sentence = (
        "Exécutez cette consigne, puis prenez une capture d’écran montrant la commande, "
        "la configuration ou le résultat demandé."
        if is_french
        else "Complete this task, then take a screenshot showing the command, configuration, or requested result."
    )

    steps: list[dict] = []
    for index, match in enumerate(matches, 1):
        end = matches[index].start() if index < len(matches) else len(text)
        raw_instruction = text[match.end():end]
        cleaned_lines: list[str] = []
        for line in raw_instruction.splitlines():
            line = line.strip()
            if not line:
                continue
            if re.match(r"^(Ressources\s*:|https?://)", line, flags=re.IGNORECASE):
                break
            if re.match(
                r"^(UH2C/ENSET|Travaux pratiques|Pr\.\s|GLSID|II\s+(?:BDCC|CCN)|PARTIE\s+\d|\d+$)",
                line,
                flags=re.IGNORECASE,
            ):
                continue
            cleaned_lines.append(line)
        instruction = re.sub(r"\s+", " ", " ".join(cleaned_lines)).strip(" -:\n\t")
        if len(instruction) < 12:
            continue

        # A concise title keeps the editor and HUD readable while the full
        # instruction, including any command, remains in the description.
        title = re.split(r"(?<=[.!?])\s+", instruction, maxsplit=1)[0].strip()
        if len(title) > 100:
            title = f"{title[:97].rstrip()}…"

        steps.append({
            "id": f"step-{len(steps) + 1}",
            "title": title or f"Step {len(steps) + 1}",
            "caption": title or f"Step {len(steps) + 1}",
            "description": f"{instruction} {capture_sentence}",
        })

    return steps


def analyze_instructions(text: str, language_name: str = "", language_code: str = "") -> list[dict]:
    numbered_steps = _fallback_numbered_steps(text, language_code)
    if len(numbered_steps) >= 2:
        return numbered_steps

    prompt = f"""You are a practical task planner for technical TP/lab reports.
Convert the source document into an ordered, executable workflow. Each step must
tell the user what they need to actually do, then state the exact proof of that
work they should capture in a screenshot.

{_language_instruction(language_name, language_code)}

Generation rules:
- Preserve the order and intent of the source document.
- Each step must combine an action with its screenshot checkpoint. Do not create
  empty steps that only say "take a screenshot" or "show the result".
- Begin the description with the concrete action: what to open, create, edit,
  configure, run, calculate, or verify. Include commands, file paths, UI labels,
  parameters, and values when the source gives them.
- End the description with a clear capture instruction stating what the screenshot
  must prove after the action is complete. Use natural wording in the requested
  language, for example: "Then take a screenshot showing the successful output
  and the command that produced it."
- Treat each generated step as one action-and-evidence pair, or one closely
  related group that can reasonably fit in a single screenshot. Split tasks when
  they require distinct visible states or independent evidence.
- Focus each title on the work being done, such as "Configure the database
  connection" or "Run the migration", rather than only the final screen.
- Include concrete details from the source: commands to run, files to open,
  parameters, configuration values, expected output, page/section names, and
  validation checks that should be visible.
- Do not invent a solution, tools, commands, outputs, credentials, or values that
  are not in the document. If the document omits a detail, give the user an
  action based on the stated requirement and name the visible evidence to capture.
- Do not replace the action with theory or a generic instruction such as "answer
  the question". Explain the concrete work required to produce the answer.
- Avoid vague steps like "show the result". Be specific about both the action
  and the final terminal, file, app page, dialog, diagram, or UI element that
  must be visible in the screenshot.

Return a JSON object with a "steps" array. Each item must have:
- "id": a stable unique string identifier such as "step-1"
- "title": a short internal step title, in the requested language
- "caption": a short report-ready figure caption, in the requested language.
  It must be concise and must not include a "Figure N" prefix.
- "description": a concise action-and-capture instruction in the requested
  language. Use 1-2 clear sentences: explain the work to perform, then
  explicitly say what to capture as evidence.

Source document:
{text}

Return ONLY valid JSON."""
    steps = _steps_from_model_response(chat_text(prompt, json_mode=True, max_tokens=6000))
    if steps:
        return steps

    recovery_prompt = f"""Extract a non-empty JSON workflow from the source document below.
Return ONLY {{"steps": [...]}}. Create one concise step for every numbered task or
distinct required action. Every description must state: (1) the action to do and
(2) the result to capture in a screenshot. Do not add an empty screenshot-only
step and do not invent information.

{_language_instruction(language_name, language_code)}

Each item must contain "id", "title", "caption", and "description".

Source document:
{text}"""
    steps = _steps_from_model_response(chat_text(recovery_prompt, json_mode=True, max_tokens=6000))
    return steps or _fallback_numbered_steps(text, language_code)


def describe_screenshot(step_title: str, image_bytes: bytes, mime: str = "image/png",
                        language_name: str = "", language_code: str = "") -> str:
    prompt = f"""This is a screenshot taken by a user during the step: '{step_title}'.
Describe what is happening in the screenshot and write a short, clear explanation
of the action performed, suitable for a technical report. Use 2-4 sentences.

{_language_instruction(language_name, language_code)}
If the screenshot does not match the expected step, explain that mismatch in the requested language only."""
    return chat_vision(prompt, image_bytes, mime).strip()


def generate_captions(steps: list[dict], language_name: str = "", language_code: str = "") -> list[dict]:
    """steps: [{id, title, description, generated_description}] -> [{id, caption}]"""
    payload = json.dumps(steps, indent=2)
    prompt = f"""You are writing figure captions for a technical report. For each step
below, write a concise, formal figure caption (one short sentence, no "Figure N"
prefix — numbering is added automatically).

{_language_instruction(language_name, language_code)}

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
                  mime: str = "image/png", language_name: str = "",
                  language_code: str = "") -> dict:
    prompt = f"""You are validating a screenshot for a documentation step.
Step title: '{step_title}'
Expected: '{step_description}'

Look at the screenshot and decide if it matches what the step expects.
{_language_instruction(language_name, language_code)}
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


def analyze_document(text: str, language_name: str = "", language_code: str = "") -> dict:
    prompt = f"""You are analyzing an existing technical document to find where
screenshots/figures are needed. Identify placeholders (e.g. [FIGURE], {{{{FIGURE_x}}}},
"insert screenshot here", "TODO image") and sections that clearly need a figure.

{_language_instruction(language_name, language_code)}

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


def ocr_image(image_bytes: bytes, mime: str = "image/png") -> str:
    prompt = """Extract ALL visible text from this screenshot. Return the text exactly
as it appears, preserving line breaks where reasonable. Return ONLY the extracted text,
no commentary."""
    return chat_vision(prompt, image_bytes, mime).strip()


def suggest_next_step(steps: list[dict], current_index: int = -1,
                      document_text: str = "", language_name: str = "",
                      language_code: str = "") -> dict:
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

{_language_instruction(language_name, language_code)}

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
                     document_text: str = "", language_name: str = "",
                     language_code: str = "") -> list[dict]:
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

{_language_instruction(language_name, language_code)}

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


def generate_narrative(title: str, steps: list[dict], language_name: str = "", language_code: str = "") -> dict:
    payload = json.dumps(steps, indent=2)
    prompt = f"""Write connecting prose for a technical report titled '{title}'.
Given these steps, write a short introduction, and a short conclusion.

{_language_instruction(language_name, language_code)}

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
