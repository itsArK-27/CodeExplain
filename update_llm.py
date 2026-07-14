import re
import json

with open('llm_engine.py', 'r', encoding='utf-8') as f:
    content = f.read()

new_func = """

def analyze_stream(code: str, language: str, response_language: str = "English"):
    \"\"\"Make a single LLM call, stream the explanation field, and yield the final parsed JSON.\"\"\"
    import re
    client = _get_client()
    
    schema = json.dumps(FullAnalysis.model_json_schema(), indent=2)
    prompt = get_full_analysis_prompt(code, language, response_language).replace("{json_schema}", schema)
    
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ],
        temperature=0.3,
        max_tokens=2048,
        response_format={"type": "json_object"},
        stream=True
    )
    
    full_content = ""
    last_yielded_len = 0
    
    for chunk in response:
        delta = chunk.choices[0].delta.content or ""
        full_content += delta
        
        match = re.search(r'"explanation"\\s*:\\s*"((?:[^"\\\\\\\\]|\\\\\\\\.)*)', full_content, re.DOTALL)
        if match:
            current_explanation = match.group(1)
            # basic unescape
            current_explanation = current_explanation.replace('\\\\n', '\\n').replace('\\\\"', '"').replace('\\\\\\\\', '\\\\')
            if len(current_explanation) > last_yielded_len:
                new_text = current_explanation[last_yielded_len:]
                yield {"type": "explanation_chunk", "text": new_text}
                last_yielded_len = len(current_explanation)
                
    try:
        parsed_data = FullAnalysis.model_validate_json(full_content)
        yield {"type": "complete", "data": parsed_data.model_dump()}
    except Exception as e:
        yield {"type": "error", "error": f"Failed to parse output: {e}"}
"""

if "def analyze_stream" not in content:
    with open('llm_engine.py', 'a', encoding='utf-8') as f:
        f.write(new_func)
    print("Added analyze_stream")
else:
    print("analyze_stream already exists")
