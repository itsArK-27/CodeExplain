"""
prompts.py — All LLM prompt templates for CodeExplain
"""

SYSTEM_PROMPT = """You are CodeExplain, an expert programming tutor and code analyst. 
You excel at breaking down complex code into simple, understandable explanations.
You provide accurate Big-O complexity analysis, insightful line-by-line commentary,
and actionable improvement suggestions.
You MUST respond in valid JSON matching the schema provided by the user.
Be extremely concise to save tokens. Use simple language a beginner can understand."""

def get_full_analysis_prompt(code: str, language: str, response_language: str = "English") -> str:
    lines = code.strip().split('\n')
    numbered = '\n'.join([f"{i+1:3}| {line}" for i, line in enumerate(lines)])
    return f"""Analyze the following {language} code and provide a complete analysis including Explanation, Complexity, Line-by-Line commentary, and Improvements.

CRITICAL INSTRUCTION: You MUST write your ENTIRE response (except for the code snippets themselves) in the following language: {response_language}.

CODE (with line numbers):
```{language.lower()}
{numbered}
```

Provide a clear, friendly explanation that:
1. Describes what this code does overall (1-2 sentences)
2. Explains the core concept/algorithm used
3. Gives a real-world analogy if applicable
4. States who would use this code and why
(Write concisely, no bullet points)

For Line-by-Line commentary:
Skip blank lines. Max one sentence per meaningful block.

For Improvements:
Provide up to 3 improvements. Focus on: readability, performance, best practices. If no improvements are needed, provide an empty list.

JSON SCHEMA REQUIREMENT:
Your response MUST be a valid JSON object matching the following Pydantic schema:
{{json_schema}}
"""

def get_quiz_prompt(code: str, language: str, explanation: str, response_language: str = "English") -> str:
    return f"""Create a QUIZ about the following {language} code to test comprehension.

CRITICAL INSTRUCTION: You MUST write the ENTIRE quiz (questions, options, and explanations) in the following language: {response_language}.

CODE:
```{language.lower()}
{code}
```

EXPLANATION CONTEXT:
{explanation[:500]}

Generate EXACTLY 5 questions. Make questions progressively harder. Mix conceptual, behavioral, and complexity questions.

JSON SCHEMA REQUIREMENT:
Your response MUST be a valid JSON object matching the following Pydantic schema:
{{json_schema}}"""
