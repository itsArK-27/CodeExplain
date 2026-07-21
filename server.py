

import os
import json
import subprocess
import tempfile
from flask import Flask, request, jsonify, send_from_directory
from dotenv import load_dotenv

load_dotenv()

# Import our engine modules
from llm_engine import generate_quiz, analyze_stream, chat_stream, generate_leetcode_stream, generate_leetcode_chat_stream, generate_github_analysis_stream, generate_github_chat_stream
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

@app.route("/api/chat", methods=["POST"])
def api_chat():
    data = request.get_json(force=True)
    code = data.get("code", "")
    language = data.get("language", "Python")
    explanation = data.get("explanation", "")
    history = data.get("history", [])
    response_language = data.get("response_language", "English")

    if not os.getenv("GROQ_API_KEY"):
        return jsonify({"error": "❌ GROQ_API_KEY not set in .env file."}), 500

    def generate():
        import json
        try:
            stream = chat_stream(code, language, explanation, history, response_language)
            for chunk in stream:
                yield f"data: {json.dumps(chunk)}\\n\\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\\n\\n"

    from flask import Response
    return Response(generate(), mimetype="text/event-stream")

@app.route("/api/leetcode", methods=["POST"])
def api_leetcode():
    data = request.get_json(force=True)
    question_number = data.get("question_number", "")
    language = data.get("language", "Python")
    response_language = data.get("response_language", "English")

    if not question_number:
        return jsonify({"error": "Question number is required."}), 400

    if not os.getenv("GROQ_API_KEY"):
        return jsonify({"error": "❌ GROQ_API_KEY not set in .env file."}), 500

    def generate():
        import json
        try:
            stream = generate_leetcode_stream(question_number, language, response_language)
            for chunk in stream:
                yield f"data: {json.dumps(chunk)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"

    from flask import Response
    return Response(generate(), mimetype="text/event-stream")

@app.route("/api/leetcode_chat", methods=["POST"])
def api_leetcode_chat():
    data = request.get_json(force=True)
    question_title = data.get("question_title", "")
    question_description = data.get("question_description", "")
    context_json_str = data.get("context_json_str", "")
    history = data.get("history", [])
    response_language = data.get("response_language", "English")

    if not os.getenv("GROQ_API_KEY"):
        return jsonify({"error": "❌ GROQ_API_KEY not set in .env file."}), 500

    def generate():
        import json
        try:
            stream = generate_leetcode_chat_stream(question_title, question_description, context_json_str, history, response_language)
            for chunk in stream:
                yield f"data: {json.dumps(chunk)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"

    from flask import Response
    return Response(generate(), mimetype="text/event-stream")


@app.route("/api/meta")
def api_meta():
    return jsonify({
        "languages": SUPPORTED_LANGUAGES,
        "samples": get_sample_snippets(),
        "has_key": bool(os.getenv("GROQ_API_KEY")),
    })

def clone_and_parse_github_repo_stream(url: str, max_chars=30000):
    yield {"type": "status", "message": "Cloning repository..."}
    with tempfile.TemporaryDirectory() as temp_dir:
        # Clone repo
        try:
            subprocess.run(["git", "clone", "--depth", "1", url, temp_dir], check=True, capture_output=True, text=True)
        except subprocess.CalledProcessError as e:
            raise Exception(f"Failed to clone repository: {e.stderr}")
            
        yield {"type": "status", "message": "Parsing file structure..."}
        repo_context = ""
        ignored_dirs = {".git", "node_modules", "venv", "__pycache__", "dist", "build"}
        ignored_exts = {".png", ".jpg", ".jpeg", ".gif", ".pdf", ".zip", ".exe", ".ico", ".svg", ".lock"}
        
        for root, dirs, files in os.walk(temp_dir):
            dirs[:] = [d for d in dirs if d not in ignored_dirs and not d.startswith('.')]
            for file in files:
                if any(file.endswith(ext) for ext in ignored_exts) or file.startswith('.'):
                    continue
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, temp_dir)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        repo_context += f"File: {rel_path}\n```\n{content}\n```\n\n"
                except Exception:
                    continue
                
                if len(repo_context) > max_chars:
                    repo_context = repo_context[:max_chars] + "\n...[TRUNCATED]..."
                    yield {"type": "status", "message": "Analyzing architecture..."}
                    yield {"type": "context", "repo_context": repo_context}
                    return
                    
        yield {"type": "status", "message": "Analyzing architecture..."}
        yield {"type": "context", "repo_context": repo_context}

@app.route("/api/github_analyze", methods=["POST"])
def api_github_analyze():
    data = request.get_json(force=True)
    url = data.get("url", "")
    response_language = data.get("response_language", "English")

    if not url.startswith("https://github.com/"):
        return jsonify({"error": "Invalid GitHub URL."}), 400

    if not os.getenv("GROQ_API_KEY"):
        return jsonify({"error": "❌ GROQ_API_KEY not set in .env file."}), 500

    def generate():
        import json
        try:
            repo_context = ""
            for item in clone_and_parse_github_repo_stream(url):
                if item["type"] == "status":
                    yield f"data: {json.dumps(item)}\n\n"
                elif item["type"] == "context":
                    repo_context = item["repo_context"]
                    yield f"data: {json.dumps(item)}\n\n"
            
            stream = generate_github_analysis_stream(repo_context, response_language)
            for chunk in stream:
                yield f"data: {json.dumps(chunk)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"

    from flask import Response
    return Response(generate(), mimetype="text/event-stream")

@app.route("/api/github_chat", methods=["POST"])
def api_github_chat():
    data = request.get_json(force=True)
    repo_context = data.get("repo_context", "")
    history = data.get("history", [])
    response_language = data.get("response_language", "English")

    if not os.getenv("GROQ_API_KEY"):
        return jsonify({"error": "❌ GROQ_API_KEY not set in .env file."}), 500

    def generate():
        import json
        try:
            stream = generate_github_chat_stream(repo_context, history, response_language)
            for chunk in stream:
                yield f"data: {json.dumps(chunk)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"

    from flask import Response
    return Response(generate(), mimetype="text/event-stream")



if __name__ == "__main__":
    print("CodeExplain server starting at http://localhost:5000")
    app.run(debug=True, port=5000)
