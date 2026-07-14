"""
quiz_engine.py — Quiz Mode state management for CodeExplain
"""

import streamlit as st


def init_quiz_state():
    """Initialize quiz session state."""
    if "quiz_questions" not in st.session_state:
        st.session_state.quiz_questions = []
    if "quiz_answers" not in st.session_state:
        st.session_state.quiz_answers = {}
    if "quiz_submitted" not in st.session_state:
        st.session_state.quiz_submitted = False
    if "quiz_score" not in st.session_state:
        st.session_state.quiz_score = 0


def reset_quiz():
    """Reset quiz to initial state."""
    st.session_state.quiz_questions = []
    st.session_state.quiz_answers = {}
    st.session_state.quiz_submitted = False
    st.session_state.quiz_score = 0


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


def get_score_emoji(score: int, total: int) -> str:
    """Return emoji/message based on score percentage."""
    pct = (score / total * 100) if total > 0 else 0
    if pct >= 90:
        return "🏆 Outstanding!", "You've mastered this code!"
    elif pct >= 70:
        return "🎯 Great Job!", "Solid understanding of the code."
    elif pct >= 50:
        return "📚 Keep Going!", "Review the explanations and try again."
    else:
        return "💡 Learning Mode", "Read through the line-by-line commentary and retry!"


def render_quiz(questions: list[dict]):
    """Render the quiz UI and handle submission."""
    init_quiz_state()

    if not questions:
        st.info("No quiz questions loaded. Analyze some code first!")
        return

    st.session_state.quiz_questions = questions

    st.markdown("""
    <div class="quiz-header">
        <h2>🧠 Code Comprehension Quiz</h2>
        <p>Test your understanding of the analyzed code</p>
    </div>
    """, unsafe_allow_html=True)

    answers = {}
    all_answered = True

    for i, q in enumerate(questions):
        q_type = q.get("type", "MCQ")
        question_text = q.get("question", f"Question {i+1}")
        options = q.get("options", {})
        correct = q.get("answer", "").upper()
        explanation = q.get("explanation", "")

        submitted = st.session_state.quiz_submitted

        # Question card
        st.markdown(f"""
        <div class="quiz-card" id="quiz-q{i}">
            <div class="quiz-q-num">Q{i+1} / {len(questions)}</div>
            <div class="quiz-q-type">{q_type}</div>
        </div>
        """, unsafe_allow_html=True)

        st.markdown(f"**{question_text}**")

        if q_type == "TRUE_FALSE":
            choice = st.radio(
                f"q_{i}",
                options=["TRUE", "FALSE"],
                key=f"quiz_radio_{i}",
                label_visibility="collapsed",
                disabled=submitted,
            )
            answers[i] = choice
        elif options:
            option_labels = [f"{k}: {v}" for k, v in sorted(options.items())]
            choice = st.radio(
                f"q_{i}",
                options=option_labels,
                key=f"quiz_radio_{i}",
                label_visibility="collapsed",
                disabled=submitted,
            )
            answers[i] = choice[0] if choice else ""
        else:
            choice = st.text_input(
                f"Your answer for Q{i+1}",
                key=f"quiz_text_{i}",
                disabled=submitted,
            )
            answers[i] = choice
            if not choice:
                all_answered = False

        # Show result if submitted
        if submitted:
            user_ans = answers[i].strip().upper() if answers[i] else ""
            correct_upper = correct.upper()
            is_correct = user_ans == correct_upper or user_ans.startswith(correct_upper)

            if is_correct:
                st.success(f"✅ Correct! {explanation}")
            else:
                if q_type == "MCQ" and options:
                    correct_text = options.get(correct_upper, correct_upper)
                    st.error(f"❌ Incorrect. Correct answer: **{correct_upper}: {correct_text}**\n\n{explanation}")
                else:
                    st.error(f"❌ Incorrect. Correct answer: **{correct_upper}**\n\n{explanation}")

        st.markdown("---")

    st.session_state.quiz_answers = answers

    if not st.session_state.quiz_submitted:
        col1, col2 = st.columns([1, 3])
        with col1:
            if st.button("🎯 Submit Quiz", type="primary", use_container_width=True):
                st.session_state.quiz_submitted = True
                score, total = calculate_score(questions, answers)
                st.session_state.quiz_score = score
                st.rerun()
    else:
        score = st.session_state.quiz_score
        total = len(questions)
        title, msg = get_score_emoji(score, total)

        st.markdown(f"""
        <div class="score-card">
            <div class="score-title">{title}</div>
            <div class="score-value">{score} / {total}</div>
            <div class="score-pct">{int(score/total*100) if total else 0}%</div>
            <div class="score-msg">{msg}</div>
        </div>
        """, unsafe_allow_html=True)

        if st.button("🔄 Retake Quiz", use_container_width=True):
            reset_quiz()
            st.rerun()
