

SYSTEM_PROMPT = """You are CodeExplain, an expert programming tutor and code analyst. 
You excel at breaking down complex code into simple, understandable explanations.
You provide accurate Big-O complexity analysis, insightful line-by-line commentary,
and actionable improvement suggestions.
You MUST respond in valid JSON matching the schema provided by the user.
Be extremely concise to save tokens. Use simple language a beginner can understand."""

def get_full_analysis_prompt(code: str, language: str, response_language: str = "English", options: dict = None) -> str:
    if options is None:
        options = {"explanation": True, "complexity": True, "lines": True, "improvements": True}
        
    lines = code.strip().split('\n')
    numbered = '\n'.join([f"{i+1:3}| {line}" for i, line in enumerate(lines)])
    
    requested_sections = []
    if options.get("explanation"): requested_sections.append("Explanation")
    if options.get("complexity"): requested_sections.append("Complexity")
    if options.get("lines"): requested_sections.append("Line-by-Line commentary")
    if options.get("improvements"): requested_sections.append("Improvements")
    
    sections_str = ", ".join(requested_sections)
    
    prompt = f"""Analyze the following {language} code and provide an analysis including: {sections_str}.

CRITICAL INSTRUCTION: You MUST write your ENTIRE response (except for the code snippets themselves) in the following language: {response_language}.

CODE (with line numbers):
```{language.lower()}
{numbered}
```
"""
    if options.get("explanation"):
        prompt += """
Provide a clear, friendly explanation that:
1. Describes what this code does overall (1-2 sentences)
2. Explains the core concept/algorithm used
3. Gives a real-world analogy if applicable
4. States who would use this code and why
(Write concisely, no bullet points)
"""
    if options.get("lines"):
        prompt += """
For Line-by-Line commentary:
Skip blank lines. Max one sentence per meaningful block.
"""
    if options.get("improvements"):
        prompt += """
For Improvements:
Provide up to 3 improvements. Focus on: readability, performance, best practices. If no improvements are needed, provide an empty list.
For each improvement, be sure to include the exact `original_code` block that you are replacing, alongside your `code` block. Do not provide the entire file, only the modified blocks.
"""

    prompt += """
JSON SCHEMA REQUIREMENT:
Your response MUST be a valid JSON object matching the following Pydantic schema:
{json_schema}
"""
    return prompt

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

def get_chat_system_prompt(code: str, language: str, explanation: str, response_language: str = "English") -> str:
    return f"""You are CodeExplain, an expert programming tutor and interactive AI agent.
You have just provided an analysis of the following {language} code. The user is now asking follow-up questions.

CRITICAL INSTRUCTION: You MUST write your responses in the following language: {response_language}.
Use Markdown for formatting, including code blocks where appropriate. Be concise but helpful.

ORIGINAL CODE:
```{language.lower()}
{code}
```

YOUR PREVIOUS EXPLANATION SUMMARY:
{explanation[:1000]}
"""
