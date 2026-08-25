"""Repeatable, offline tests for the local NullDraft backend API."""

from __future__ import annotations

import asyncio

import pytest
from fastapi import HTTPException
from PIL import Image

import server


class InMemoryUpload:
    """Minimal async UploadFile replacement for endpoint tests."""

    def __init__(self, filename: str, content: bytes, content_type: str):
        self.filename = filename
        self.content = content
        self.content_type = content_type

    async def read(self) -> bytes:
        return self.content


def upload(filename: str, content: bytes, content_type: str) -> InMemoryUpload:
    return InMemoryUpload(filename, content, content_type)


def test_health_reports_backend_capabilities(monkeypatch):
    monkeypatch.setattr(server.ai, "get_provider", lambda: "mistral")
    monkeypatch.setattr(server.ai, "is_configured", lambda: False)
    monkeypatch.setattr(server.report_gen, "_find_soffice", lambda: None)

    response = server.health_check()

    assert response["status"] == "ok"
    assert response["ai_configured"] is False
    assert "pdf" in response["formats"]


@pytest.mark.parametrize(
    ("provider", "environment_key"),
    [
        ("mistral", "MISTRAL_API_KEY"),
        ("openai", "OPENAI_API_KEY"),
        ("anthropic", "ANTHROPIC_API_KEY"),
        ("gemini", "GEMINI_API_KEY"),
    ],
)
def test_each_supported_provider_uses_its_own_api_key(monkeypatch, provider, environment_key):
    for key in server.ai.PROVIDER_KEY_NAMES.values():
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv(environment_key, "test-key")
    monkeypatch.setattr(server.ai, "get_provider", lambda: provider)

    assert server.ai.is_configured() is True


def test_anthropic_and_gemini_calls_use_their_own_api_protocols(monkeypatch):
    calls = []

    def fake_post(url, payload, headers):
        calls.append((url, payload, headers))
        if "anthropic" in url:
            return {"content": [{"type": "text", "text": "Claude response"}]}
        return {"candidates": [{"content": {"parts": [{"text": "Gemini response"}]}}]}

    monkeypatch.setattr(server.ai, "_post_json", fake_post)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "anthropic-key")
    monkeypatch.setattr(server.ai, "get_provider", lambda: "anthropic")
    assert server.ai.chat_text("Hello") == "Claude response"
    assert calls[-1][2]["x-api-key"] == "anthropic-key"

    monkeypatch.setenv("GEMINI_API_KEY", "gemini-key")
    monkeypatch.setattr(server.ai, "get_provider", lambda: "gemini")
    assert server.ai.chat_vision("Describe", b"image", "image/png") == "Gemini response"
    assert calls[-1][2]["x-goog-api-key"] == "gemini-key"
    assert calls[-1][1]["contents"][0]["parts"][0]["inline_data"]["mime_type"] == "image/png"


def test_instruction_analysis_requires_an_ai_key(monkeypatch):
    monkeypatch.setattr(server.ai, "is_configured", lambda: False)

    with pytest.raises(HTTPException, match="AI provider not configured") as error:
        asyncio.run(server.analyze_instructions(upload("assignment.txt", b"1. Open the terminal.", "text/plain")))

    assert error.value.status_code == 500


def test_instruction_analysis_uses_the_local_api_contract(monkeypatch):
    monkeypatch.setattr(server.ai, "is_configured", lambda: True)
    monkeypatch.setattr(
        server.ai,
        "analyze_instructions",
        lambda text, language_name, language_code: [
            {"number": 1, "title": "Open Terminal", "description": "Open a terminal window."}
        ],
    )

    response = asyncio.run(
        server.analyze_instructions(
            upload("assignment.txt", b"1. Open the terminal.", "text/plain"),
            language_code="en",
            language_name="English",
        )
    )

    assert response == {
        "steps": [{"number": 1, "title": "Open Terminal", "description": "Open a terminal window."}],
        "language": {"code": "en", "name": "English"},
    }


def test_report_export_writes_markdown_without_cloud_ai(tmp_path):
    output_path = tmp_path / "school-report"

    response = asyncio.run(
        server.generate_report(server.ReportRequest(**{
            "format": "md",
            "title": "School Report",
            "output_path": str(output_path),
            "steps": [{"number": 1, "title": "Open Terminal", "description": "Open a terminal window."}],
        }))
    )

    report_path = tmp_path / "school-report.md"
    assert response["output_path"] == str(report_path)
    assert report_path.exists()
    assert "School Report" in report_path.read_text(encoding="utf-8")


def test_blur_regions_writes_a_local_image(tmp_path):
    source = tmp_path / "source.png"
    destination = tmp_path / "blurred.png"
    Image.new("RGB", (100, 100), "white").save(source)

    response = asyncio.run(
        server.blur_regions(server.BlurRequest(**{
            "input_path": str(source),
            "output_path": str(destination),
            "regions": [{"x": 0.1, "y": 0.1, "width": 0.4, "height": 0.4}],
        }))
    )

    assert response["output_path"] == str(destination)
    assert destination.exists()
