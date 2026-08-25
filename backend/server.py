"""NullDraft backend API.

FastAPI server providing AI features (instruction parsing, screenshot
descriptions, captions, validation, document analysis, sensitive-data
detection, OCR) and multi-format document export (Markdown, LaTeX, DOCX,
PDF, JSON).
"""

from __future__ import annotations

import io
import os
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, HTTPException, Body, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import pypdf

import ai
import images
import report_gen
import doc_enhance
from language import detect_language, language_info_for_code
from report_gen import Branding, ReportOptions, ReportStep

load_dotenv()

app = FastAPI(title="NullDraft Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class StepModel(BaseModel):
    id: Optional[str] = None
    number: int = 0
    title: str = ""
    caption: str = ""
    description: str = ""
    generated_description: str = ""
    generated_caption: str = ""
    notes: str = ""
    ocr_text: str = ""
    image_path: Optional[str] = None
    skipped: bool = False


class LanguageModel(BaseModel):
    code: str = "en"
    name: str = "English"


class BrandingModel(BaseModel):
    title: str = "Technical Report"
    author: str = ""
    subtitle: str = ""
    logo_path: Optional[str] = None
    header: str = ""
    watermark: str = ""


class ReportRequest(BaseModel):
    format: str = "md"
    title: str = "Technical Report"
    output_path: str                       # absolute path (without forcing extension)
    steps: List[StepModel] = []
    template: str = "default"
    include_toc: bool = True
    include_lof: bool = True
    include_descriptions: bool = True
    include_notes: bool = True
    include_narrative: bool = False        # generate AI intro/conclusion
    introduction: str = ""                 # explicit narrative (overrides AI)
    conclusion: str = ""
    branding: Optional[BrandingModel] = None
    # Back-compat: map of step_id -> absolute image path
    image_paths: dict = {}
    language: LanguageModel = LanguageModel()


class CaptionRequest(BaseModel):
    steps: List[StepModel] = []
    language: LanguageModel = LanguageModel()


class NarrativeRequest(BaseModel):
    title: str = "Technical Report"
    steps: List[StepModel] = []
    language: LanguageModel = LanguageModel()


class SuggestNextRequest(BaseModel):
    steps: List[StepModel] = []
    current_index: int = -1
    document_text: str = ""
    language: LanguageModel = LanguageModel()


class SmartCropRequest(BaseModel):
    input_path: str
    step_title: str = ""
    output_path: Optional[str] = None
    apply: bool = False


class BlurRequest(BaseModel):
    input_path: str
    regions: List[dict] = []
    output_path: Optional[str] = None


class OptimizeRequest(BaseModel):
    input_path: str
    output_path: Optional[str] = None
    max_width: int = 1920
    quality: int = 85
    format: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _extract_text_from_upload(filename: str, content: bytes) -> str:
    name = (filename or "").lower()
    if name.endswith(".pdf"):
        try:
            reader = pypdf.PdfReader(io.BytesIO(content))
            return "\n".join((p.extract_text() or "") for p in reader.pages)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse PDF: {e}")
    if name.endswith(".docx"):
        try:
            from docx import Document
            doc = Document(io.BytesIO(content))
            return "\n".join(p.text for p in doc.paragraphs)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse DOCX: {e}")
    # txt, md, tex, and anything else: decode as text
    try:
        return content.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File must be UTF-8 text, PDF or DOCX")


def _to_report_steps(steps: List[StepModel], image_paths: dict | None = None) -> list[ReportStep]:
    image_paths = image_paths or {}
    result = []
    for s in steps:
        img = s.image_path or (image_paths.get(s.id) if s.id else None)
        result.append(ReportStep(
            number=s.number,
            title=s.title,
            description=s.description,
            image_path=img,
            generated_description=s.generated_description,
            generated_caption=s.generated_caption or s.caption,
            notes=s.notes,
            ocr_text=s.ocr_text,
            skipped=s.skipped,
        ))
    return result


def _options_from_request(req: ReportRequest) -> ReportOptions:
    b = req.branding or BrandingModel(title=req.title)
    return ReportOptions(
        template=req.template,
        include_toc=req.include_toc,
        include_lof=req.include_lof,
        include_descriptions=req.include_descriptions,
        include_notes=req.include_notes,
        introduction=req.introduction,
        conclusion=req.conclusion,
        branding=Branding(
            title=b.title or req.title,
            author=b.author,
            subtitle=b.subtitle,
            logo_path=b.logo_path,
            header=b.header,
            watermark=b.watermark,
        ),
        language_code=req.language.code,
        language_name=req.language.name,
    )


# ---------------------------------------------------------------------------
# Health / config
# ---------------------------------------------------------------------------

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "provider": ai.get_provider(),
        "ai_configured": ai.is_configured(),
        "mistral_configured": bool(os.getenv("MISTRAL_API_KEY")),
        "openai_configured": bool(os.getenv("OPENAI_API_KEY")),
        "anthropic_configured": bool(os.getenv("ANTHROPIC_API_KEY")),
        "gemini_configured": bool(os.getenv("GEMINI_API_KEY")),
        "pdf_engine": bool(report_gen._find_soffice()),
        "formats": ["md", "tex", "docx", "pdf", "json"],
    }


# ---------------------------------------------------------------------------
# AI: instruction parsing
# ---------------------------------------------------------------------------

@app.post("/analyze-instructions")
async def analyze_instructions(
    file: UploadFile = File(...),
    language_code: str = Form("auto"),
    language_name: str = Form(""),
):
    if not ai.is_configured():
        raise HTTPException(status_code=500, detail="AI provider not configured")
    content = await file.read()
    text = _extract_text_from_upload(file.filename or "", content)
    if not text.strip():
        raise HTTPException(status_code=400, detail="No text found in file")
    try:
        lang = language_info_for_code(language_code, language_name or None) if language_code != "auto" else detect_language(text)
        steps = ai.analyze_instructions(text, lang.name, lang.code)
        if not steps:
            raise HTTPException(
                status_code=422,
                detail="The AI could not extract actionable steps from this document. Please try again or add steps manually.",
            )
        return {"steps": steps, "language": {"code": lang.code, "name": lang.name}}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze-document")
async def analyze_document(
    file: UploadFile = File(...),
    language_code: str = Form("auto"),
    language_name: str = Form(""),
):
    if not ai.is_configured():
        raise HTTPException(status_code=500, detail="AI provider not configured")
    content = await file.read()
    text = _extract_text_from_upload(file.filename or "", content)
    try:
        lang = language_info_for_code(language_code, language_name or None) if language_code != "auto" else detect_language(text)
        result = ai.analyze_document(text, lang.name, lang.code)
        result["language"] = {"code": lang.code, "name": lang.name}
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/enhance-document")
async def enhance_document(
    file: UploadFile = File(...),
    mappings: str = Form("[]"),
    output_path: str = Form(...),
    start_figure: int = Form(1),
):
    """Insert captured figures into an existing .docx/.tex at placeholder locations.

    `mappings` is a JSON string: [{"placeholder": "...", "image_path": "...", "caption": "..."}]
    """
    import json as _json
    content = await file.read()
    name = (file.filename or "").lower()
    try:
        maps = _json.loads(mappings)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid mappings JSON")

    try:
        if name.endswith(".docx"):
            base, _ = os.path.splitext(output_path)
            out = f"{base}.docx"
            doc_enhance.enhance_docx(content, maps, out, start_figure)
        elif name.endswith(".tex"):
            base, _ = os.path.splitext(output_path)
            out = f"{base}.tex"
            text = content.decode("utf-8")
            doc_enhance.enhance_tex(text, maps, out, start_figure)
        else:
            raise HTTPException(status_code=400, detail="Only .docx and .tex are supported")
        return {"success": True, "output_path": out}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# AI: vision
# ---------------------------------------------------------------------------

@app.post("/generate-description")
async def generate_description(
    step_title: str,
    language_code: str = "en",
    language_name: str = "English",
    file: UploadFile = File(...),
):
    if not ai.is_configured():
        raise HTTPException(status_code=500, detail="AI provider not configured")
    content = await file.read()
    mime = file.content_type or "image/png"
    try:
        return {"description": ai.describe_screenshot(step_title, content, mime, language_name, language_code)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/validate-step")
async def validate_step(
    step_title: str,
    step_description: str = "",
    language_code: str = "en",
    language_name: str = "English",
    file: UploadFile = File(...),
):
    if not ai.is_configured():
        raise HTTPException(status_code=500, detail="AI provider not configured")
    content = await file.read()
    mime = file.content_type or "image/png"
    try:
        return ai.validate_step(step_title, step_description, content, mime, language_name, language_code)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ocr")
async def ocr(file: UploadFile = File(...)):
    if not ai.is_configured():
        raise HTTPException(status_code=500, detail="AI provider not configured")
    content = await file.read()
    mime = file.content_type or "image/png"
    try:
        return {"text": ai.ocr_image(content, mime)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/suggest-next")
async def suggest_next(req: SuggestNextRequest):
    if not ai.is_configured():
        raise HTTPException(status_code=500, detail="AI provider not configured")
    payload = [
        {"number": s.number, "title": s.title, "description": s.description}
        for s in req.steps
    ]
    try:
        return ai.suggest_next_step(payload, req.current_index, req.document_text, req.language.name, req.language.code)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/suggest-branches")
async def suggest_branches(req: SuggestNextRequest):
    if not ai.is_configured():
        raise HTTPException(status_code=500, detail="AI provider not configured")
    payload = [
        {"number": s.number, "title": s.title, "description": s.description}
        for s in req.steps
    ]
    try:
        return {"branches": ai.suggest_branches(payload, req.current_index, req.document_text, req.language.name, req.language.code)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/smart-crop")
async def smart_crop(req: SmartCropRequest):
    if not ai.is_configured():
        raise HTTPException(status_code=500, detail="AI provider not configured")
    if not os.path.exists(req.input_path):
        raise HTTPException(status_code=400, detail="Input image not found")
    try:
        with open(req.input_path, "rb") as f:
            content = f.read()
        region = ai.smart_crop_region(req.step_title, content)
        result = {"region": region}
        if req.apply:
            out = images.crop_region(req.input_path, region, req.output_path)
            result["output_path"] = out
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# AI: text generation
# ---------------------------------------------------------------------------

@app.post("/generate-captions")
async def generate_captions(req: CaptionRequest):
    if not ai.is_configured():
        raise HTTPException(status_code=500, detail="AI provider not configured")
    payload = [
        {
            "id": s.id,
            "title": s.title,
            "caption": s.caption,
            "description": s.description,
            "generated_description": s.generated_description,
        }
        for s in req.steps
    ]
    try:
        return {"captions": ai.generate_captions(payload, req.language.name, req.language.code)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate-narrative")
async def generate_narrative(req: NarrativeRequest):
    if not ai.is_configured():
        raise HTTPException(status_code=500, detail="AI provider not configured")
    payload = [{"title": s.title, "description": s.description} for s in req.steps]
    try:
        return ai.generate_narrative(req.title, payload, req.language.name, req.language.code)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Images
# ---------------------------------------------------------------------------

@app.post("/blur-regions")
async def blur_regions(req: BlurRequest):
    if not os.path.exists(req.input_path):
        raise HTTPException(status_code=400, detail="Input image not found")
    try:
        out = images.blur_regions(req.input_path, req.regions, req.output_path)
        return {"output_path": out}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/optimize-image")
async def optimize_image(req: OptimizeRequest):
    if not os.path.exists(req.input_path):
        raise HTTPException(status_code=400, detail="Input image not found")
    try:
        out = images.optimize_image(
            req.input_path, req.output_path, req.max_width, req.quality, req.format
        )
        return {"output_path": out}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Document export
# ---------------------------------------------------------------------------

@app.post("/generate-report")
async def generate_report(req: ReportRequest):
    steps = _to_report_steps(req.steps, req.image_paths)
    options = _options_from_request(req)

    # Generate AI narrative if requested and not explicitly provided.
    if req.include_narrative and not (req.introduction or req.conclusion) and ai.is_configured():
        try:
            payload = [{"title": s.title, "description": s.description} for s in req.steps]
            narrative = ai.generate_narrative(req.title, payload, req.language.name, req.language.code)
            options.introduction = narrative.get("introduction", "")
            options.conclusion = narrative.get("conclusion", "")
        except Exception:
            pass

    fmt = (req.format or "md").lower()
    ext = report_gen.EXTENSIONS.get(fmt)
    if not ext:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {fmt}")

    # Normalize output path to the right extension
    base, _ = os.path.splitext(req.output_path)
    output_path = f"{base}.{ext}"

    try:
        path = report_gen.generate_report(fmt, steps, options, output_path)
        return {"success": True, "output_path": path, "format": fmt}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate-latex-report")
async def generate_latex_report(payload: dict = Body(...)):
    """Back-compat endpoint used by the original frontend."""
    title = payload.get("title", "Technical Report")
    steps_in = payload.get("steps", [])
    image_paths = payload.get("image_paths", {})
    output_dir = payload.get("output_path") or os.path.join(
        os.path.expanduser("~"), "nulldraft-export"
    )

    steps = [
        ReportStep(
            number=i + 1,
            title=s.get("title", ""),
            description=s.get("description", ""),
            generated_description=s.get("generated_description", ""),
            generated_caption=s.get("generated_caption", ""),
            image_path=image_paths.get(s.get("id")),
        )
        for i, s in enumerate(steps_in)
    ]
    options = ReportOptions(branding=Branding(title=title))
    os.makedirs(output_dir, exist_ok=True)
    tex_path = os.path.join(output_dir, "report.tex")
    try:
        report_gen.generate_latex(steps, options, tex_path)
        result = {"tex_path": tex_path}
        # Try PDF if engine available
        if report_gen._find_soffice():
            try:
                pdf_path = os.path.join(output_dir, "report.pdf")
                report_gen.generate_pdf(steps, options, pdf_path)
                result["pdf_path"] = pdf_path
            except Exception:
                pass
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("NULLDRAFT_PORT", "8011"))
    uvicorn.run(app, host="127.0.0.1", port=port)
