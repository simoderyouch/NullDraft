"""Document generation for NullDraft.

Generates reports in Markdown, LaTeX, DOCX, PDF (via LibreOffice) and JSON
from a list of steps with screenshots. Supports figure auto-numbering,
table of contents, list of figures, templates and branding.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
from dataclasses import dataclass, field
from typing import Optional


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

@dataclass
class ReportStep:
    number: int
    title: str
    description: str = ""
    image_path: Optional[str] = None        # absolute path to the screenshot
    generated_description: str = ""
    generated_caption: str = ""
    notes: str = ""
    ocr_text: str = ""
    skipped: bool = False

    @property
    def body_text(self) -> str:
        """Prefer the AI description, fall back to the user description."""
        return (self.generated_description or self.description or "").strip()

    def caption(self, figure_number: int) -> str:
        base = self.generated_caption or self.title or f"Step {self.number}"
        # Avoid double "Figure N" if the AI already produced one.
        if base.lower().startswith("figure"):
            return base
        return f"Figure {figure_number} — {base}"


@dataclass
class Branding:
    title: str = "Technical Report"
    author: str = ""
    subtitle: str = ""
    logo_path: Optional[str] = None
    header: str = ""
    watermark: str = ""


@dataclass
class ReportOptions:
    template: str = "default"          # default | minimal | detailed | academic | business | runbook
    include_toc: bool = True
    include_lof: bool = True
    include_descriptions: bool = True
    include_notes: bool = True
    introduction: str = ""             # AI/user narrative inserted before the steps
    conclusion: str = ""               # AI/user narrative inserted after the steps
    branding: Branding = field(default_factory=Branding)


# Template tuning: which sections to show by default.
TEMPLATE_PRESETS = {
    "minimal": {"include_toc": False, "include_lof": False, "include_notes": False},
    "default": {"include_toc": True, "include_lof": True, "include_notes": True},
    "detailed": {"include_toc": True, "include_lof": True, "include_notes": True},
    "academic": {"include_toc": True, "include_lof": True, "include_notes": True},
    "business": {"include_toc": True, "include_lof": False, "include_notes": True},
    "runbook": {"include_toc": True, "include_lof": False, "include_notes": True},
}


def apply_template_preset(options: ReportOptions) -> ReportOptions:
    preset = TEMPLATE_PRESETS.get(options.template)
    if preset:
        # Presets only set defaults; explicit caller values already applied upstream.
        for key, value in preset.items():
            setattr(options, key, value)
    return options


def _visible_steps(steps: list[ReportStep]) -> list[ReportStep]:
    return [s for s in steps if not s.skipped]


def _rel_image(image_path: Optional[str], output_dir: str) -> Optional[str]:
    """Return a path usable from the output document directory."""
    if not image_path:
        return None
    if not os.path.isabs(image_path):
        # Already a bare filename; assume it lives next to the output.
        return image_path
    try:
        return os.path.relpath(image_path, output_dir)
    except ValueError:
        return image_path


def _resolve_image(image_path: Optional[str], output_dir: str) -> Optional[str]:
    """Return the absolute on-disk path of an image (for existence checks)."""
    if not image_path:
        return None
    if os.path.isabs(image_path):
        return image_path
    return os.path.join(output_dir, image_path)


def _image_status(image_path: Optional[str], output_dir: str) -> str:
    """'ok' if the file exists, 'missing' if a path was given but not found,
    'none' if no image is set for the step."""
    if not image_path:
        return "none"
    resolved = _resolve_image(image_path, output_dir)
    return "ok" if resolved and os.path.exists(resolved) else "missing"


# ---------------------------------------------------------------------------
# Markdown
# ---------------------------------------------------------------------------

def generate_markdown(steps: list[ReportStep], options: ReportOptions, output_path: str) -> str:
    output_dir = os.path.dirname(os.path.abspath(output_path))
    b = options.branding
    visible = _visible_steps(steps)

    lines: list[str] = []
    if b.header:
        lines.append(f"<!-- {b.header} -->\n")
    if b.logo_path:
        logo_rel = _rel_image(b.logo_path, output_dir)
        lines.append(f"![logo]({logo_rel})\n")

    lines.append(f"# {b.title}\n")
    if b.subtitle:
        lines.append(f"### {b.subtitle}\n")
    if b.author:
        lines.append(f"*Author: {b.author}*\n")
    lines.append("")

    fig_no = 0
    # Table of contents
    if options.include_toc:
        lines.append("## Table of Contents\n")
        for i, s in enumerate(visible, 1):
            anchor = f"step-{i}-" + "".join(
                c if c.isalnum() else "-" for c in (s.title or "").lower()
            ).strip("-")
            lines.append(f"{i}. [{s.title or f'Step {i}'}](#{anchor})")
        lines.append("")

    # Introduction
    if options.introduction:
        lines.append("## Introduction\n")
        lines.append(options.introduction + "\n")

    # Steps
    for i, s in enumerate(visible, 1):
        lines.append(f"## Step {i}: {s.title or 'Untitled'}\n")
        if options.include_descriptions and s.body_text:
            lines.append(s.body_text + "\n")
        status = _image_status(s.image_path, output_dir)
        if status == "ok":
            img = _rel_image(s.image_path, output_dir)
            fig_no += 1
            lines.append(f"![{s.caption(fig_no)}]({img})\n")
            lines.append(f"*{s.caption(fig_no)}*\n")
        elif status == "missing":
            lines.append(f"> ⚠️ **Screenshot missing:** `{s.image_path}`\n")
        if options.include_notes and s.notes:
            lines.append(f"> **Note:** {s.notes}\n")
        lines.append("")

    # Conclusion
    if options.conclusion:
        lines.append("## Conclusion\n")
        lines.append(options.conclusion + "\n")

    # List of figures
    if options.include_lof and fig_no > 0:
        lines.append("## List of Figures\n")
        fno = 0
        for s in visible:
            if s.image_path:
                fno += 1
                lines.append(f"- {s.caption(fno)}")
        lines.append("")

    content = "\n".join(lines)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(content)
    return output_path


# ---------------------------------------------------------------------------
# LaTeX
# ---------------------------------------------------------------------------

def _latex_escape(text: str) -> str:
    if not text:
        return ""
    replacements = {
        "\\": r"\textbackslash{}",
        "&": r"\&", "%": r"\%", "$": r"\$", "#": r"\#",
        "_": r"\_", "{": r"\{", "}": r"\}", "~": r"\textasciitilde{}",
        "^": r"\textasciicircum{}",
    }
    out = []
    for ch in text:
        out.append(replacements.get(ch, ch))
    return "".join(out)


def generate_latex(steps: list[ReportStep], options: ReportOptions, output_path: str) -> str:
    output_dir = os.path.dirname(os.path.abspath(output_path))
    b = options.branding
    visible = _visible_steps(steps)

    docclass = "article"
    fontsize = "12pt"
    if options.template == "academic":
        fontsize = "11pt"

    parts: list[str] = []
    parts.append(f"\\documentclass[{fontsize},a4paper]{{{docclass}}}")
    parts.append("\\usepackage{graphicx}")
    parts.append("\\usepackage{float}")
    parts.append("\\usepackage{caption}")
    parts.append("\\usepackage[hidelinks]{hyperref}")
    parts.append("\\usepackage{geometry}")
    parts.append("\\geometry{margin=2.5cm}")
    if b.watermark:
        parts.append("\\usepackage{draftwatermark}")
        parts.append(f"\\SetWatermarkText{{{_latex_escape(b.watermark)}}}")
        parts.append("\\SetWatermarkScale{0.5}")

    parts.append(f"\\title{{{_latex_escape(b.title)}}}")
    parts.append(f"\\author{{{_latex_escape(b.author)}}}")
    parts.append("\\date{\\today}")
    parts.append("\\begin{document}")

    if b.logo_path:
        logo_rel = _rel_image(b.logo_path, output_dir)
        parts.append("\\begin{center}")
        parts.append(f"\\includegraphics[width=0.3\\textwidth]{{{logo_rel}}}")
        parts.append("\\end{center}")

    parts.append("\\maketitle")
    if options.include_toc:
        parts.append("\\tableofcontents")
    if options.include_lof:
        parts.append("\\listoffigures")
    parts.append("\\newpage")

    if options.introduction:
        parts.append("\\section*{Introduction}")
        parts.append("\\addcontentsline{toc}{section}{Introduction}")
        parts.append(_latex_escape(options.introduction))
        parts.append("")

    fig_no = 0
    for i, s in enumerate(visible, 1):
        parts.append(f"\\section{{{_latex_escape(s.title or 'Untitled')}}}")
        if options.include_descriptions and s.body_text:
            parts.append(_latex_escape(s.body_text))
            parts.append("")
        status = _image_status(s.image_path, output_dir)
        if status == "ok":
            img = _rel_image(s.image_path, output_dir)
            fig_no += 1
            cap = s.caption(fig_no)
            parts.append("\\begin{figure}[H]")
            parts.append("\\centering")
            parts.append(f"\\includegraphics[width=0.85\\textwidth]{{{img}}}")
            parts.append(f"\\caption{{{_latex_escape(cap)}}}")
            parts.append(f"\\label{{fig:step{i}}}")
            parts.append("\\end{figure}")
        elif status == "missing":
            parts.append(f"\\textit{{[Screenshot missing: {_latex_escape(s.image_path or '')}]}}")
            parts.append("")
        if options.include_notes and s.notes:
            parts.append(f"\\textit{{Note: {_latex_escape(s.notes)}}}")
            parts.append("")

    if options.conclusion:
        parts.append("\\section*{Conclusion}")
        parts.append("\\addcontentsline{toc}{section}{Conclusion}")
        parts.append(_latex_escape(options.conclusion))
        parts.append("")

    parts.append("\\end{document}")
    content = "\n".join(parts)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(content)
    return output_path


# ---------------------------------------------------------------------------
# DOCX
# ---------------------------------------------------------------------------

def generate_docx(steps: list[ReportStep], options: ReportOptions, output_path: str) -> str:
    from docx import Document
    from docx.shared import Inches, Pt
    from docx.enum.text import WD_ALIGN_PARAGRAPH

    b = options.branding
    visible = _visible_steps(steps)
    doc = Document()

    if b.logo_path and os.path.exists(b.logo_path):
        try:
            doc.add_picture(b.logo_path, width=Inches(2))
            doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
        except Exception:
            pass

    title = doc.add_heading(b.title, 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    if b.subtitle:
        sub = doc.add_paragraph(b.subtitle)
        sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    if b.author:
        auth = doc.add_paragraph(f"Author: {b.author}")
        auth.alignment = WD_ALIGN_PARAGRAPH.CENTER

    # Manual Table of Contents (deterministic; survives PDF conversion)
    if options.include_toc:
        doc.add_heading("Table of Contents", level=1)
        for i, s in enumerate(visible, 1):
            doc.add_paragraph(f"{i}. {s.title or f'Step {i}'}", style="List Number" if False else None)

    if options.introduction:
        doc.add_heading("Introduction", level=1)
        doc.add_paragraph(options.introduction)

    fig_no = 0
    figure_captions: list[str] = []
    for i, s in enumerate(visible, 1):
        doc.add_heading(f"Step {i}: {s.title or 'Untitled'}", level=1)
        if options.include_descriptions and s.body_text:
            doc.add_paragraph(s.body_text)
        status = _image_status(s.image_path, os.path.dirname(os.path.abspath(output_path)))
        resolved = _resolve_image(s.image_path, os.path.dirname(os.path.abspath(output_path)))
        if status == "ok" and resolved:
            fig_no += 1
            try:
                doc.add_picture(resolved, width=Inches(6))
                doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
            except Exception:
                doc.add_paragraph(f"[Could not embed image: {s.image_path}]")
            cap = s.caption(fig_no)
            figure_captions.append(cap)
            caption_p = doc.add_paragraph()
            run = caption_p.add_run(cap)
            run.italic = True
            run.font.size = Pt(10)
            caption_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        elif status == "missing":
            warn_p = doc.add_paragraph()
            warn_run = warn_p.add_run(f"[Screenshot missing: {s.image_path}]")
            warn_run.italic = True
            warn_run.font.size = Pt(10)
            warn_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        if options.include_notes and s.notes:
            note_p = doc.add_paragraph()
            note_run = note_p.add_run(f"Note: {s.notes}")
            note_run.italic = True

    if options.conclusion:
        doc.add_heading("Conclusion", level=1)
        doc.add_paragraph(options.conclusion)

    if options.include_lof and figure_captions:
        doc.add_page_break()
        doc.add_heading("List of Figures", level=1)
        for cap in figure_captions:
            doc.add_paragraph(cap)

    doc.save(output_path)
    return output_path


# ---------------------------------------------------------------------------
# PDF (via LibreOffice headless conversion of a generated DOCX)
# ---------------------------------------------------------------------------

def _find_soffice() -> Optional[str]:
    for name in ("libreoffice", "soffice"):
        path = shutil.which(name)
        if path:
            return path
    return None


def generate_pdf(steps: list[ReportStep], options: ReportOptions, output_path: str) -> str:
    soffice = _find_soffice()
    if not soffice:
        raise RuntimeError(
            "PDF export requires LibreOffice (soffice) or a LaTeX toolchain, "
            "neither of which was found."
        )

    output_dir = os.path.dirname(os.path.abspath(output_path))
    os.makedirs(output_dir, exist_ok=True)

    # Build a DOCX in a temp dir, then convert it to PDF.
    with tempfile.TemporaryDirectory() as tmp:
        docx_path = os.path.join(tmp, "report.docx")
        generate_docx(steps, options, docx_path)

        result = subprocess.run(
            [soffice, "--headless", "--convert-to", "pdf", "--outdir", tmp, docx_path],
            capture_output=True,
            text=True,
            timeout=120,
        )
        produced = os.path.join(tmp, "report.pdf")
        if not os.path.exists(produced):
            raise RuntimeError(
                f"LibreOffice failed to produce a PDF. stdout={result.stdout} stderr={result.stderr}"
            )
        shutil.copy(produced, output_path)

    return output_path


# ---------------------------------------------------------------------------
# JSON manifest
# ---------------------------------------------------------------------------

def generate_json(steps: list[ReportStep], options: ReportOptions, output_path: str) -> str:
    payload = {
        "title": options.branding.title,
        "author": options.branding.author,
        "template": options.template,
        "introduction": options.introduction,
        "conclusion": options.conclusion,
        "steps": [
            {
                "number": s.number,
                "title": s.title,
                "description": s.description,
                "generated_description": s.generated_description,
                "generated_caption": s.generated_caption,
                "notes": s.notes,
                "ocr_text": s.ocr_text,
                "image_path": s.image_path,
                "skipped": s.skipped,
            }
            for s in steps
        ],
    }
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    return output_path


# ---------------------------------------------------------------------------
# Dispatcher
# ---------------------------------------------------------------------------

GENERATORS = {
    "md": generate_markdown,
    "markdown": generate_markdown,
    "tex": generate_latex,
    "latex": generate_latex,
    "docx": generate_docx,
    "word": generate_docx,
    "pdf": generate_pdf,
    "json": generate_json,
}

EXTENSIONS = {
    "md": "md", "markdown": "md",
    "tex": "tex", "latex": "tex",
    "docx": "docx", "word": "docx",
    "pdf": "pdf",
    "json": "json",
}


def generate_report(
    fmt: str,
    steps: list[ReportStep],
    options: ReportOptions,
    output_path: str,
) -> str:
    fmt = (fmt or "md").lower()
    generator = GENERATORS.get(fmt)
    if not generator:
        raise ValueError(f"Unsupported format: {fmt}")
    apply_template_preset(options)
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    return generator(steps, options, output_path)
