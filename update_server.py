import re

with open('server.py', 'r', encoding='utf-8') as f:
    content = f.read()

# I need to change how `/api/analyze` works, and import analyze_stream.
# Let's replace the from llm_engine import...
content = content.replace(
    'from llm_engine import analyze_all, generate_quiz',
    'from llm_engine import analyze_all, generate_quiz, analyze_stream'
)

# And replace the app.route("/api/analyze") completely
import re
new_analyze = """@app.route("/api/analyze", methods=["POST"])
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
            stream = analyze_stream(trimmed, language, response_language)
            for chunk in stream:
                yield f"data: {json.dumps(chunk)}\\n\\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\\n\\n"
            
    from flask import Response
    return Response(generate(), mimetype="text/event-stream")
"""

content = re.sub(
    r'@app\.route\("/api/analyze", methods=\["POST"\]\)\s*def api_analyze\(\):.*?return jsonify\(result\)\s*',
    new_analyze,
    content,
    flags=re.DOTALL
)

with open('server.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated server.py")
