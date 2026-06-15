"""Lightweight language detection and report label localization.

This intentionally avoids extra runtime dependencies. It is not meant to be a
perfect classifier; it provides a stable hint so AI prompts and report labels
stay aligned with the source document language.
"""

from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class LanguageInfo:
    code: str
    name: str


LANGUAGES: dict[str, str] = {
    "en": "English",
    "fr": "French",
    "es": "Spanish",
    "ar": "Arabic",
    "de": "German",
    "it": "Italian",
    "pt": "Portuguese",
}


STOPWORDS: dict[str, set[str]] = {
    "fr": {
        "le", "la", "les", "des", "une", "un", "et", "ou", "dans", "pour",
        "avec", "sur", "vous", "votre", "cette", "ce", "ces", "du", "de",
        "est", "sont", "faire", "etape", "exercice", "travail", "rapport",
        "capture", "document", "installer", "configurer",
    },
    "en": {
        "the", "and", "or", "in", "for", "with", "on", "you", "your", "this",
        "that", "these", "is", "are", "step", "task", "exercise", "work",
        "report", "screenshot", "document", "install", "configure",
    },
    "es": {
        "el", "la", "los", "las", "un", "una", "y", "o", "en", "para",
        "con", "sobre", "usted", "tu", "este", "esta", "es", "son", "paso",
        "tarea", "ejercicio", "informe", "captura", "documento",
    },
    "de": {
        "der", "die", "das", "und", "oder", "im", "in", "fur", "mit", "auf",
        "sie", "ihr", "dies", "ist", "sind", "schritt", "aufgabe", "bericht",
        "bildschirmfoto", "dokument",
    },
    "it": {
        "il", "lo", "la", "gli", "le", "un", "una", "e", "o", "in", "per",
        "con", "su", "questo", "questa", "sono", "passo", "attivita",
        "relazione", "schermata", "documento",
    },
    "pt": {
        "o", "a", "os", "as", "um", "uma", "e", "ou", "em", "para", "com",
        "sobre", "voce", "seu", "este", "esta", "sao", "passo", "tarefa",
        "relatorio", "captura", "documento",
    },
}


REPORT_LABELS: dict[str, dict[str, str]] = {
    "en": {
        "author": "Author",
        "toc": "Table of Contents",
        "introduction": "Introduction",
        "conclusion": "Conclusion",
        "lof": "List of Figures",
        "step": "Step",
        "untitled": "Untitled",
        "figure": "Figure",
        "note": "Note",
        "screenshot_missing": "Screenshot missing",
        "could_not_embed": "Could not embed image",
    },
    "fr": {
        "author": "Auteur",
        "toc": "Table des matieres",
        "introduction": "Introduction",
        "conclusion": "Conclusion",
        "lof": "Liste des figures",
        "step": "Etape",
        "untitled": "Sans titre",
        "figure": "Figure",
        "note": "Remarque",
        "screenshot_missing": "Capture d'ecran manquante",
        "could_not_embed": "Impossible d'integrer l'image",
    },
    "es": {
        "author": "Autor",
        "toc": "Tabla de contenidos",
        "introduction": "Introduccion",
        "conclusion": "Conclusion",
        "lof": "Lista de figuras",
        "step": "Paso",
        "untitled": "Sin titulo",
        "figure": "Figura",
        "note": "Nota",
        "screenshot_missing": "Captura de pantalla faltante",
        "could_not_embed": "No se pudo insertar la imagen",
    },
    "ar": {
        "author": "المؤلف",
        "toc": "جدول المحتويات",
        "introduction": "المقدمة",
        "conclusion": "الخاتمة",
        "lof": "قائمة الأشكال",
        "step": "الخطوة",
        "untitled": "بدون عنوان",
        "figure": "الشكل",
        "note": "ملاحظة",
        "screenshot_missing": "لقطة الشاشة غير موجودة",
        "could_not_embed": "تعذر إدراج الصورة",
    },
}


def detect_language(text: str) -> LanguageInfo:
    sample = (text or "")[:20000]
    if re.search(r"[\u0600-\u06ff]", sample):
        return LanguageInfo("ar", LANGUAGES["ar"])

    normalized = sample.lower()
    normalized = (
        normalized.replace("é", "e").replace("è", "e").replace("ê", "e")
        .replace("à", "a").replace("ù", "u").replace("ç", "c")
        .replace("á", "a").replace("í", "i").replace("ó", "o")
        .replace("ú", "u").replace("ñ", "n").replace("ã", "a")
        .replace("õ", "o").replace("ü", "u")
    )
    words = re.findall(r"[a-z]+", normalized)
    if not words:
        return LanguageInfo("en", LANGUAGES["en"])

    scores: dict[str, int] = {}
    word_set = set(words)
    for code, stopwords in STOPWORDS.items():
        scores[code] = sum(1 for w in word_set if w in stopwords)

    code, score = max(scores.items(), key=lambda item: item[1])
    if score <= 1:
        code = "en"
    return LanguageInfo(code, LANGUAGES.get(code, LANGUAGES["en"]))


def language_info_for_code(code: str | None, name: str | None = None) -> LanguageInfo:
    normalized = (code or "en").lower()
    if normalized not in LANGUAGES:
        normalized = "en"
    return LanguageInfo(normalized, name or LANGUAGES[normalized])


def report_labels(language_code: str | None) -> dict[str, str]:
    return REPORT_LABELS.get((language_code or "en").lower(), REPORT_LABELS["en"])
