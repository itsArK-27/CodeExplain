

import os
import json
from flask import Flask, request, jsonify, send_from_directory
from dotenv import load_dotenv

load_dotenv()

# Import our engine modules
from llm_engine import generate_quiz, analyze_stream
from utils import (
    detect_language, validate_code_input, truncate_code,
    get_sample_snippets, get_language_icon, SUPPORTED_LANGUAGES
)

app = Flask(__name__, static_folder="static", static_url_path="/static")




@app.route("/")
def index():
    return send_from_directory("static", "index.html")




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
    response_language = data.get("response_language", "English")

    valid, err = validate_code_input(code)
    if not valid:
        return jsonify({"error": err}), 400

    if not os.getenv("GROQ_API_KEY"):
        return jsonify({"error": "❌ GROQ_API_KEY not set in .env file."}), 500

    if language == "Auto-detect":
        language = detect_language(code)

    trimmed, was_truncated = truncate_code(code)

    def generate():
        import json
        yield f"data: {json.dumps({'type': 'meta', 'language': language, 'language_icon': get_language_icon(language), 'truncated': was_truncated})}\\n\\n"
        
        try:
            stream = analyze_stream(trimmed, language, response_language, options)
            for chunk in stream:
                yield f"data: {json.dumps(chunk)}\\n\\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\\n\\n"
            
    from flask import Response
    return Response(generate(), mimetype="text/event-stream")


@app.route("/api/quiz", methods=["POST"])
def api_quiz():
    data = request.get_json(force=True)
    code = data.get("code", "")
    language = data.get("language", "Python")
    explanation = data.get("explanation", "")
    response_language = data.get("response_language", "English")

    if not os.getenv("GROQ_API_KEY"):
        return jsonify({"error": "❌ GROQ_API_KEY not set in .env file."}), 500

    try:
        questions = generate_quiz(code, language, explanation, response_language)
        return jsonify({"questions": questions})
    except Exception as e:
        return jsonify({"error": str(e)}), 500




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
