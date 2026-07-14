"""
llm_engine.py — Groq API integration for CodeExplain
Uses the groq SDK with JSON mode and Pydantic schema validation.
"""

import os
import json
from pydantic import BaseModel, Field
from groq import Groq
from dotenv import load_dotenv
from prompts import (
    SYSTEM_PROMPT,
    get_full_analysis_prompt,
    get_quiz_prompt,
)

load_dotenv()


# ─── Pydantic Models for Structured Output ────────────────────────────────────

class LineComment(BaseModel):
    line: str = Field(description="The line number or block")
    explanation: str = Field(description="Short explanation of what that line does")

class Improvement(BaseModel):
    title: str = Field(description="Short title of the improvement")
    issue: str = Field(description="What is wrong or suboptimal")
    fix: str = Field(description="How to fix it")
    code: str = Field(description="Improved code snippet if applicable, else 'N/A'")

class Complexity(BaseModel):
    time: str = Field(description="Big-O notation for time complexity")
    time_explanation: str = Field(description="1-2 sentence explanation of time complexity")
    space: str = Field(description="Big-O notation for space complexity")
    space_explanation: str = Field(description="1-2 sentence explanation of space complexity")
    best: str = Field(description="Big-O notation and brief reason for best case")
    worst: str = Field(description="Big-O notation and brief reason for worst case")
    average: str = Field(description="Big-O notation and brief reason for average case")
    summary: str = Field(description="1 paragraph layman summary of what this complexity means in practice")

class FullAnalysis(BaseModel):
    explanation: str = Field(description="Clear, friendly 1-2 sentence explanation of the code, concisely")
    complexity: Complexity = Field(description="Time and space complexity analysis")
    lines: list[LineComment] = Field(description="Line-by-line commentary")
    improvements: list[Improvement] = Field(description="List of suggested improvements")

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


# ─── API Client ───────────────────────────────────────────────────────────────

def _get_client() -> Groq:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError(
            "❌ GROQ_API_KEY not found. Please set it in your .env file or the sidebar."
        )
    return Groq(api_key=api_key)


def analyze_all(code: str, language: str) -> dict:
    """Make a single LLM call to get all analysis components to bypass rate limits."""
    client = _get_client()
    
    # Inject JSON schema into prompt
    schema = json.dumps(FullAnalysis.model_json_schema(), indent=2)
    prompt = get_full_analysis_prompt(code, language).replace("{json_schema}", schema)
    
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
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
        raise ValueError("Failed to parse LLM response.")
        
    try:
        # Validate through Pydantic
        parsed_data = FullAnalysis.model_validate_json(content)
        return parsed_data.model_dump()
    except Exception as e:
        raise ValueError(f"Failed to parse LLM structured output: {e}")


def generate_quiz(code: str, language: str, explanation: str) -> list[dict]:
    """Generate quiz questions from the code and explanation."""
    client = _get_client()
    
    schema = json.dumps(Quiz.model_json_schema(), indent=2)
    prompt = get_quiz_prompt(code, language, explanation).replace("{json_schema}", schema)
    
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
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
