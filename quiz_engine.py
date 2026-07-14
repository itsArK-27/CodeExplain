"""
quiz_engine.py — Quiz logic for CodeExplain (no UI framework dependency)
"""


def calculate_score(questions: list[dict], answers: dict) -> tuple[int, int]:
    """Calculate quiz score. Returns (score, total)."""
    score = 0
    total = len(questions)
    for i, q in enumerate(questions):
        user_ans = answers.get(i, "").strip().upper()
        correct = q.get("answer", "").strip().upper()
        if user_ans == correct:
            score += 1
    return score, total


def get_score_result(score: int, total: int) -> dict:
    """Return title/message based on score percentage."""
    pct = (score / total * 100) if total > 0 else 0
    if pct >= 90:
        return {"emoji": "🏆", "title": "Outstanding!", "message": "You've mastered this code!"}
    elif pct >= 70:
        return {"emoji": "🎯", "title": "Great Job!", "message": "Solid understanding of the code."}
    elif pct >= 50:
        return {"emoji": "📚", "title": "Keep Going!", "message": "Review the explanations and try again."}
    else:
        return {"emoji": "💡", "title": "Learning Mode", "message": "Read through the line-by-line commentary and retry!"}
