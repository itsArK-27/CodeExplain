

import os
import json
from pydantic import BaseModel, Field, create_model
from groq import Groq
from dotenv import load_dotenv
from prompts import (
    SYSTEM_PROMPT,
    get_full_analysis_prompt,
    get_quiz_prompt,
    get_chat_system_prompt,
    get_leetcode_prompt,
    get_leetcode_chat_system_prompt,
    get_github_analysis_prompt,
    get_github_chat_system_prompt,
)

load_dotenv()




class LineComment(BaseModel):
    line: str = Field(description="The line number or block")
    explanation: str = Field(description="Short explanation of what that line does")

class Improvement(BaseModel):
    title: str = Field(description="Short title of the improvement")
    issue: str = Field(description="What is wrong or suboptimal")
    fix: str = Field(description="How to fix it")
    original_code: str = Field(description="The original code snippet that needs improvement if applicable, else 'N/A'")
    code: str = Field(description="Improved code snippet if applicable, else 'N/A'")

class Complexity(BaseModel):
    time: str = Field(description="Big-O notation for time complexity")
    time_explanation: str = Field(description="1-2 sentence explanation of time complexity")
    space: str = Field(description="Big-O notation for space complexity")
    space_explanation: str = Field(description="1-2 sentence explanation of space complexity")
    best: str = Field(description="Detailed explanation of best-case time complexity, including Big-O notation, why it occurs, and an example scenario")
    worst: str = Field(description="Detailed explanation of worst-case time complexity, including Big-O notation, why it occurs, and an example scenario")
    average: str = Field(description="Detailed explanation of average-case time complexity, including Big-O notation, why it occurs, and an example scenario")
    summary: str = Field(description="1 paragraph layman summary of what this complexity means in practice")

def get_analysis_model(options: dict = None):
    if options is None:
        options = {"explanation": True, "complexity": True, "lines": True, "improvements": True}
        
    fields = {}
    if options.get("explanation"):
        fields["explanation"] = (str, Field(description="Clear, friendly 1-2 sentence explanation of the code, concisely"))
    if options.get("complexity"):
        fields["complexity"] = (Complexity, Field(description="Time and space complexity analysis"))
    if options.get("lines"):
        fields["lines"] = (list[LineComment], Field(description="Line-by-line commentary"))
    if options.get("improvements"):
        fields["improvements"] = (list[Improvement], Field(description="List of suggested improvements"))
        
    return create_model('DynamicAnalysis', **fields)

class QuizOption(BaseModel):
    A: str
    B: str
    C: str
    D: str

class QuizQuestion(BaseModel):
    type: str = Field(description="MCQ or TRUE_FALSE")
    question: str = Field(description="The question text")
    options: QuizOption | dict = Field(description="Options for MCQ, empty dict for TRUE_FALSE")
    answer: str = Field(description="Correct letter (A/B/C/D) or TRUE/FALSE")
    explanation: str = Field(description="Why this answer is correct")

class Quiz(BaseModel):
    questions: list[QuizQuestion]


class LeetCodeSolution(BaseModel):
    stage_name: str = Field(description="Name of this stage (e.g., 'Brute Force', 'Optimal')")
    code: str = Field(description="The code implementation")
    explanation: str = Field(description="Explanation of the approach")
    complexity: Complexity = Field(description="Time and space complexity")
    lines: list[LineComment] = Field(description="Line-by-line commentary")

class LeetCodeAnalysis(BaseModel):
    question_title: str = Field(description="The exact title of the LeetCode question")
    question_description: str = Field(description="The original problem statement as it appears on LeetCode")
    question_explanation: str = Field(description="A simple plain-English explanation of what the question is asking")
    brute_force: LeetCodeSolution = Field(description="The initial brute force solution")
    transitions: list[str] = Field(description="List of transition strings explaining why we optimize the previous solution. e.g., ['But previous solution lacks this...']")
    optimizations: list[LeetCodeSolution] = Field(description="List of optimized solutions in order of efficiency. There should be exactly as many optimizations as there are transitions.")




def _get_client() -> Groq:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError(
            "❌ GROQ_API_KEY not found. Please set it in your .env file or the sidebar."
        )
    return Groq(api_key=api_key)



def generate_quiz(code: str, language: str, explanation: str, response_language: str = "English") -> list[dict]:
    """Generate quiz questions from the code and explanation."""
    client = _get_client()
    
    schema = json.dumps(Quiz.model_json_schema(), indent=2)
    prompt = get_quiz_prompt(code, language, explanation, response_language).replace("{json_schema}", schema)
    
    response = client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ],
        temperature=0.3,
        max_tokens=2048,
        response_format={"type": "json_object"}
    )
    
    content = response.choices[0].message.content
    if not content:
        return []
        
    try:
        parsed_data = Quiz.model_validate_json(content)
        return parsed_data.model_dump().get("questions", [])
    except Exception:
        return []


def analyze_stream(code: str, language: str, response_language: str = "English", options: dict = None):
    """Make a single LLM call, stream the explanation field, and yield the final parsed JSON."""
    import re
    client = _get_client()
    
    DynamicAnalysis = get_analysis_model(options)
    schema = json.dumps(DynamicAnalysis.model_json_schema(), indent=2)
    prompt = get_full_analysis_prompt(code, language, response_language, options).replace("{json_schema}", schema)
    
    response = client.chat.completions.create(
        model="openai/gpt-oss-120b",
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
        
        if options and options.get("explanation"):
            match = re.search(r'"explanation"\s*:\s*"((?:[^"\\\\]|\\\\.)*)', full_content, re.DOTALL)
            if match:
                current_explanation = match.group(1)
                # basic unescape
                current_explanation = current_explanation.replace('\\n', '\n').replace('\\"', '"').replace('\\\\', '\\')
                if len(current_explanation) > last_yielded_len:
                    new_text = current_explanation[last_yielded_len:]
                    yield {"type": "explanation_chunk", "text": new_text}
                    last_yielded_len = len(current_explanation)
                
    try:
        parsed_data = DynamicAnalysis.model_validate_json(full_content)
        yield {"type": "complete", "data": parsed_data.model_dump()}
    except Exception as e:
        yield {"type": "error", "error": f"Failed to parse output: {e}"}

def chat_stream(code: str, language: str, explanation: str, history: list, response_language: str = "English"):
    client = _get_client()
    system_prompt_content = get_chat_system_prompt(code, language, explanation, response_language)
    
    messages = [{"role": "system", "content": system_prompt_content}]
    
    for msg in history:
        messages.append({"role": msg.get("role"), "content": msg.get("content")})
        
    try:
        response = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=messages,
            temperature=0.7,
            max_tokens=2048,
            stream=True
        )
        
        for chunk in response:
            delta = chunk.choices[0].delta.content or ""
            if delta:
                yield {"type": "chunk", "text": delta}
                
        yield {"type": "done"}
    except Exception as e:
        yield {"type": "error", "error": f"Failed to get chat response: {e}"}

def generate_leetcode_chat_stream(question_title: str, question_description: str, context_json_str: str, history: list, response_language: str = "English"):
    client = _get_client()
    system_prompt_content = get_leetcode_chat_system_prompt(question_title, question_description, context_json_str, response_language)
    
    messages = [{"role": "system", "content": system_prompt_content}]
    
    for msg in history:
        messages.append({"role": msg.get("role"), "content": msg.get("content")})
        
    try:
        response = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=messages,
            temperature=0.7,
            max_tokens=2048,
            stream=True
        )
        
        for chunk in response:
            delta = chunk.choices[0].delta.content or ""
            if delta:
                yield {"type": "chunk", "text": delta}
                
        yield {"type": "done"}
    except Exception as e:
        yield {"type": "error", "error": f"Failed to get leetcode chat response: {e}"}

def generate_leetcode_stream(question_number: str, language: str, response_language: str = "English"):
    client = _get_client()
    
    schema = json.dumps(LeetCodeAnalysis.model_json_schema(), indent=2)
    prompt = get_leetcode_prompt(question_number, language, response_language).replace("{json_schema}", schema)
    
    response = client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ],
        temperature=0.3,
        max_tokens=4096,
        response_format={"type": "json_object"},
        stream=True
    )
    
    full_content = ""
    for chunk in response:
        delta = chunk.choices[0].delta.content or ""
        full_content += delta
        # We can yield a simple progress ping so the frontend knows it's working
        if delta:
             yield {"type": "ping"}
                
    try:
        parsed_data = LeetCodeAnalysis.model_validate_json(full_content)
        yield {"type": "complete", "data": parsed_data.model_dump()}
    except Exception as e:
        yield {"type": "error", "error": f"Failed to parse output: {e}"}

def generate_github_analysis_stream(repo_context: str, response_language: str = "English"):
    client = _get_client()
    
    prompt = get_github_analysis_prompt(repo_context, response_language)
    
    try:
        response = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=4096,
            stream=True
        )
        
        for chunk in response:
            delta = chunk.choices[0].delta.content or ""
            if delta:
                yield {"type": "chunk", "text": delta}
                
        yield {"type": "done"}
    except Exception as e:
        yield {"type": "error", "error": f"Failed to get github analysis: {e}"}

def generate_github_chat_stream(repo_context: str, history: list, response_language: str = "English"):
    client = _get_client()
    system_prompt_content = get_github_chat_system_prompt(repo_context, response_language)
    
    messages = [{"role": "system", "content": system_prompt_content}]
    
    for msg in history:
        messages.append({"role": msg.get("role"), "content": msg.get("content")})
        
    try:
        response = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=messages,
            temperature=0.7,
            max_tokens=2048,
            stream=True
        )
        
        for chunk in response:
            delta = chunk.choices[0].delta.content or ""
            if delta:
                yield {"type": "chunk", "text": delta}
                
        yield {"type": "done"}
    except Exception as e:
        yield {"type": "error", "error": f"Failed to get github chat response: {e}"}
