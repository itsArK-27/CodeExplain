"""
server.py — CodeExplain Flask Backend
Replaces Streamlit entirely. Serves the HTML UI and provides REST API endpoints.
"""

import os
import json
from flask import Flask, request, jsonify, send_from_directory
from dotenv import load_dotenv

load_dotenv()

# Import our engine modules (same as before — these haven't changed)
from llm_engine import analyze_all, generate_quiz
from utils import (
    detect_language, validate_code_input, truncate_code,
    get_sample_snippets, get_language_icon, SUPPORTED_LANGUAGES
)

app = Flask(__name__, static_folder="static", static_url_path="/static")


# ── Serve the single-page app ──────────────────────────────────────────────────

@app.route("/")
def index():
    return send_from_directory("static", "index.html")


# ── API: Analyze Code ──────────────────────────────────────────────────────────

@app.route("/api/analyze", methods=["POST"])
def api_analyze():
    data = request.get_json(force=True)
    code = data.get("code", "")
    language = data.get("language", "Auto-detect")
    options = data.get("options", {
        "explanation": True,
        "complexity": True,
        "lines": True,
        "improvements": True,
    })

    # Validate
    valid, err = validate_code_input(code)
    if not valid:
        return jsonify({"error": err}), 400

    if not os.getenv("GROQ_API_KEY"):
        return jsonify({"error": "❌ GROQ_API_KEY not set in .env file."}), 500

    # Language detection
    if language == "Auto-detect":
        language = detect_language(code)

    # Truncate if needed
    trimmed, was_truncated = truncate_code(code)

    try:
        full = analyze_all(trimmed, language)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    result = {
        "code": trimmed,
        "language": language,
        "language_icon": get_language_icon(language),
        "truncated": was_truncated,
    }
    if options.get("explanation"):
        result["explanation"] = full.get("explanation", "")
    if options.get("complexity"):
        result["complexity"] = full.get("complexity", {})
    if options.get("lines"):
        result["lines"] = full.get("lines", [])
    if options.get("improvements"):
        result["improvements"] = full.get("improvements", [])

    return jsonify(result)


# ── API: Generate Quiz ─────────────────────────────────────────────────────────

@app.route("/api/quiz", methods=["POST"])
def api_quiz():
    data = request.get_json(force=True)
    code = data.get("code", "")
    language = data.get("language", "Python")
    explanation = data.get("explanation", "")

    if not os.getenv("GROQ_API_KEY"):
        return jsonify({"error": "❌ GROQ_API_KEY not set in .env file."}), 500

    try:
        questions = generate_quiz(code, language, explanation)
        return jsonify({"questions": questions})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── API: Metadata ──────────────────────────────────────────────────────────────

@app.route("/api/meta")
def api_meta():
    return jsonify({
        "languages": SUPPORTED_LANGUAGES,
        "samples": get_sample_snippets(),
        "has_key": bool(os.getenv("GROQ_API_KEY")),
    })


if __name__ == "__main__":
    print("CodeExplain server starting at http://localhost:5000")
    app.run(debug=True, port=5000)
