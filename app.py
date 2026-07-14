"""
app.py — CodeExplain: Plain-English Code Tutor
Main Streamlit Application
"""

import streamlit as st
import os
import time
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# ── Page Config (must be first Streamlit call) ─────────────────
st.set_page_config(
    page_title="CodeExplain — Plain-English Code Tutor",
    page_icon="🔮",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Load CSS ───────────────────────────────────────────────────
def load_css():
    css_path = Path(__file__).parent / "styles" / "main.css"
    if css_path.exists():
        with open(css_path, "r", encoding="utf-8") as f:
            st.markdown(f"<style>{f.read()}</style>", unsafe_allow_html=True)

load_css()

# ── Inject 3D JS (particles + mouse parallax) ─────────────────
st.markdown("""
<canvas id="particles-canvas"></canvas>
<div class="orb orb-1"></div>
<div class="orb orb-2"></div>
<div class="orb orb-3"></div>

<script>
// ── Particle System ──────────────────────────────────────────
(function() {
    const canvas = document.getElementById('particles-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let particles = [];
    let W, H;

    function resize() {
        W = canvas.width  = window.innerWidth;
        H = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    function Particle() {
        this.reset();
    }
    Particle.prototype.reset = function() {
        this.x = Math.random() * W;
        this.y = Math.random() * H;
        this.r = Math.random() * 1.5 + 0.3;
        this.vx = (Math.random() - 0.5) * 0.4;
        this.vy = (Math.random() - 0.5) * 0.4;
        this.alpha = Math.random() * 0.5 + 0.1;
        const hues = [240, 200, 170, 260, 220];
        this.hue = hues[Math.floor(Math.random() * hues.length)];
    };
    Particle.prototype.update = function() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < 0 || this.x > W || this.y < 0 || this.y > H) this.reset();
    };
    Particle.prototype.draw = function() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${this.hue}, 80%, 70%, ${this.alpha})`;
        ctx.fill();
    };

    for (let i = 0; i < 120; i++) particles.push(new Particle());

    // Draw connecting lines
    function drawLines() {
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < 120) {
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(108, 99, 255, ${0.12 * (1 - dist/120)})`;
                    ctx.lineWidth = 0.5;
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.stroke();
                }
            }
        }
    }

    function animate() {
        ctx.clearRect(0, 0, W, H);
        particles.forEach(p => { p.update(); p.draw(); });
        drawLines();
        requestAnimationFrame(animate);
    }
    animate();

    // ── Mouse Parallax ─────────────────────────────────────────
    let mouseX = W / 2, mouseY = H / 2;
    document.addEventListener('mousemove', function(e) {
        mouseX = e.clientX;
        mouseY = e.clientY;
        // Subtle card tilt on mouse move
        document.querySelectorAll('.glass-card').forEach(function(card) {
            const rect = card.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const dx = (mouseX - cx) / window.innerWidth;
            const dy = (mouseY - cy) / window.innerHeight;
            card.style.transform = `perspective(1000px) rotateY(${dx * 6}deg) rotateX(${-dy * 4}deg) translateZ(0)`;
        });
        // Orbs follow cursor slightly
        const orbs = document.querySelectorAll('.orb');
        orbs.forEach(function(orb, i) {
            const factor = (i + 1) * 0.02;
            orb.style.transform = `translate(${dx * 30 * factor}px, ${dy * 20 * factor}px)`;
        });
        const dx2 = (mouseX / W - 0.5) * 2;
        const dy2 = (mouseY / H - 0.5) * 2;
    });

    // Reset card tilt on mouse leave
    document.addEventListener('mouseleave', function() {
        document.querySelectorAll('.glass-card').forEach(function(card) {
            card.style.transform = '';
        });
    });

    // ── Click Ripple Effect ────────────────────────────────────
    document.addEventListener('click', function(e) {
        const ripple = document.createElement('div');
        ripple.style.cssText = `
            position: fixed;
            left: ${e.clientX - 20}px;
            top: ${e.clientY - 20}px;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(108,99,255,0.6), transparent);
            pointer-events: none;
            z-index: 9999;
            animation: rippleOut 0.6s ease-out forwards;
        `;
        document.body.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
    });

    // Inject ripple keyframe
    const style = document.createElement('style');
    style.textContent = `
        @keyframes rippleOut {
            0%   { transform: scale(0); opacity: 1; }
            100% { transform: scale(4); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
})();
</script>
""", unsafe_allow_html=True)

# ── Imports (after page config) ────────────────────────────────
from utils import (
    SUPPORTED_LANGUAGES, detect_language, get_language_icon,
    validate_code_input, complexity_color, get_sample_snippets, truncate_code
)
from quiz_engine import render_quiz, reset_quiz

# ── Session State Init ─────────────────────────────────────────
def init_state():
    defaults = {
        "results": None,
        "analyzing": False,
        "quiz_mode": False,
        "quiz_questions": [],
        "quiz_answers": {},
        "quiz_submitted": False,
        "quiz_score": 0,
        "last_code": "",
        "last_language": "",
    }
    for k, v in defaults.items():
        if k not in st.session_state:
            st.session_state[k] = v

init_state()

# ── Sidebar ────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("""
    <div class="sidebar-logo">
        <span class="logo-icon">🔮</span>
        <div class="logo-text">CodeExplain</div>
        <div class="logo-sub">Plain-English Code Tutor</div>
    </div>
    """, unsafe_allow_html=True)

    st.markdown("### ⚙️ Settings")

    # API Key input
    # api_key_env = os.getenv("GROQ_API_KEY", "")
    # api_key_input = st.text_input(
    #     "🔑 Groq API Key",
    #     value=api_key_env,
    #     type="password",
    #     placeholder="gsk_...",
    #     help="Get your free API key from https://console.groq.com/keys",
    # )
    # if api_key_input:
    #     os.environ["GROQ_API_KEY"] = api_key_input

    st.markdown("---")

    # Language selector
    st.markdown("### 🌐 Language")
    detected_hint = "Auto-detect"
    lang_options = [detected_hint] + SUPPORTED_LANGUAGES
    selected_lang = st.selectbox(
        "Programming Language",
        options=lang_options,
        index=0,
        label_visibility="collapsed",
    )

    st.markdown("---")

    # Analysis options
    st.markdown("### 🎛️ Analysis Options")
    run_explanation  = st.checkbox("💬 Explanation",    value=True)
    run_complexity   = st.checkbox("⏱️ Complexity",     value=True)
    run_line_by_line = st.checkbox("📝 Line-by-Line",   value=True)
    run_improvements = st.checkbox("🚀 Improvements",   value=True)

    st.markdown("---")

    # Quiz mode toggle
    quiz_toggle = st.toggle("🧠 Quiz Mode", value=st.session_state.quiz_mode)
    if quiz_toggle != st.session_state.quiz_mode:
        st.session_state.quiz_mode = quiz_toggle
        if not quiz_toggle:
            reset_quiz()

    st.markdown("---")

    # Sample snippets
    st.markdown("### 📦 Sample Code")
    samples = get_sample_snippets()
    sample_choice = st.selectbox(
        "Load a sample",
        options=["— Select —"] + list(samples.keys()),
        label_visibility="collapsed",
    )

    st.markdown("---")
    st.markdown("""
    <div style="font-size:0.75rem; color: #5c6594; text-align:center; line-height:1.8;">
        Built with ❤️ using<br>
        <b style="color:#6c63ff">Streamlit</b> · <b style="color:#f55036">Groq API</b><br>
        Project 4 — AI Engineer Launchpad
    </div>
    """, unsafe_allow_html=True)

# ── Hero ───────────────────────────────────────────────────────
st.markdown("""
<div class="hero-section">
    <div class="hero-badge">✨ AI-Powered Code Analysis</div>
    <h1 class="hero-title">CodeExplain</h1>
    <p class="hero-sub">
        Paste any code snippet and instantly get a plain-English explanation,
        complexity analysis, line-by-line commentary, and smart improvement suggestions.
    </p>
</div>
""", unsafe_allow_html=True)

# ── Code Input Area ────────────────────────────────────────────
st.markdown('<div class="glass-card">', unsafe_allow_html=True)
st.markdown('<div class="section-title"><span class="icon">📋</span> Paste Your Code</div>', unsafe_allow_html=True)
st.markdown('<div class="section-divider"></div>', unsafe_allow_html=True)

# Pre-fill with sample if selected
default_code = ""
if sample_choice and sample_choice != "— Select —":
    default_code = samples.get(sample_choice, "")

code_input = st.text_area(
    "code_input_area",
    value=default_code,
    height=280,
    placeholder="# Paste your Python, JavaScript, Java, C++, Go, Rust or any other code here...\n\ndef example():\n    pass",
    label_visibility="collapsed",
    key="code_textarea",
)
st.markdown('</div>', unsafe_allow_html=True)

# Language detection
effective_lang = selected_lang
if selected_lang == "Auto-detect" and code_input.strip():
    effective_lang = detect_language(code_input)
elif selected_lang == "Auto-detect":
    effective_lang = "Python"

lang_icon = get_language_icon(effective_lang)

# Stats bar
if code_input.strip():
    lines = code_input.strip().split('\n')
    chars = len(code_input)
    st.markdown(f"""
    <div class="stats-bar">
        <div class="stat-chip">{lang_icon} Language: <span class="stat-val">{effective_lang}</span></div>
        <div class="stat-chip">📄 Lines: <span class="stat-val">{len(lines)}</span></div>
        <div class="stat-chip">🔤 Chars: <span class="stat-val">{chars:,}</span></div>
    </div>
    """, unsafe_allow_html=True)

# ── Action Buttons ─────────────────────────────────────────────
col_btn1, col_btn2, col_btn3 = st.columns([2, 1, 1])
with col_btn1:
    analyze_btn = st.button(
        f"🔮 Analyze Code ({effective_lang})",
        type="primary",
        use_container_width=True,
        disabled=not code_input.strip(),
    )
with col_btn2:
    clear_btn = st.button("🗑️ Clear", use_container_width=True)
with col_btn3:
    if st.session_state.results:
        quiz_btn = st.button(
            "🧠 Generate Quiz" if not st.session_state.quiz_questions else "🔄 New Quiz",
            use_container_width=True,
        )
    else:
        st.button("🧠 Quiz", use_container_width=True, disabled=True)

if clear_btn:
    st.session_state.results = None
    st.session_state.quiz_questions = []
    reset_quiz()
    st.rerun()

# ── Analysis Logic ─────────────────────────────────────────────
if analyze_btn:
    valid, err_msg = validate_code_input(code_input)
    if not valid:
        st.error(err_msg)
    elif not os.getenv("GROQ_API_KEY"):
        st.error("❌ Please ensure GROQ_API_KEY is set in your .env file!")
        st.info("💡 Get a free API key at https://console.groq.com/keys")
    else:
        trimmed_code, was_truncated = truncate_code(code_input)
        if was_truncated:
            st.warning("⚠️ Code truncated to 150 lines for analysis. Results based on first 150 lines.")

        # Progress display
        st.markdown("""
        <div class="analyzing-banner">
            <div class="pulse-ring"></div>
            <div style="color:#6c63ff; font-weight:700; font-size:1.1rem;">Analyzing your code...</div>
            <div style="color:#9fa8c7; font-size:0.85rem; margin-top:0.4rem;">Powered by Groq</div>
        </div>
        """, unsafe_allow_html=True)

        try:
            from llm_engine import analyze_all

            progress = st.progress(10)
            with st.spinner("🚀 Analyzing your code... (This may take a few seconds)"):
                full_analysis = analyze_all(trimmed_code, effective_lang)
                progress.progress(90)
            
            # Filter results based on user checkboxes
            results = {}
            if run_explanation:
                results["explanation"] = full_analysis.get("explanation", "")
            if run_complexity:
                results["complexity"] = full_analysis.get("complexity", {})
            if run_line_by_line:
                results["lines"] = full_analysis.get("lines", [])
            if run_improvements:
                results["improvements"] = full_analysis.get("improvements", [])

            results["code"] = trimmed_code
            results["language"] = effective_lang
            progress.empty()

            st.session_state.results = results
            st.session_state.last_code = trimmed_code
            st.session_state.last_language = effective_lang
            st.session_state.quiz_questions = []
            reset_quiz()
            st.rerun()

        except ValueError as e:
            st.error(str(e))
        except Exception as e:
            st.error(f"❌ Analysis failed: {str(e)}")
            st.info("💡 Check your API key and internet connection.")

# Handle quiz generation button
if st.session_state.results and 'quiz_btn' in dir() and quiz_btn:
    if not os.getenv("GROQ_API_KEY"):
        st.error("❌ API key required for quiz generation.")
    else:
        with st.spinner("🧠 Generating quiz questions..."):
            try:
                from llm_engine import generate_quiz
                explanation = st.session_state.results.get("explanation", "")
                questions = generate_quiz(
                    st.session_state.results["code"],
                    st.session_state.results["language"],
                    explanation
                )
                st.session_state.quiz_questions = questions
                reset_quiz()
                st.session_state.quiz_mode = True
                st.rerun()
            except Exception as e:
                st.error(f"Quiz generation failed: {e}")

# ── Results Display ────────────────────────────────────────────
if st.session_state.results:
    res = st.session_state.results
    lang = res.get("language", "Code")
    lang_icon = get_language_icon(lang)

    st.markdown(f"""
    <div style="margin: 1.5rem 0 1rem; display:flex; align-items:center; gap:0.8rem;">
        <div class="lang-badge">{lang_icon} {lang}</div>
        <span style="color:#5c6594; font-size:0.85rem;">Analysis complete · {time.strftime('%H:%M')}</span>
    </div>
    """, unsafe_allow_html=True)

    # ── Tabs ──────────────────────────────────────────────────
    tab_labels = []
    if "explanation"  in res: tab_labels.append("💬 Explanation")
    if "complexity"   in res: tab_labels.append("⏱️ Complexity")
    if "lines"        in res: tab_labels.append("📝 Line-by-Line")
    if "improvements" in res: tab_labels.append("🚀 Improvements")
    if st.session_state.quiz_mode: tab_labels.append("🧠 Quiz")

    if not tab_labels:
        st.info("No analysis sections selected. Enable options in the sidebar.")
    else:
        tabs = st.tabs(tab_labels)
        tab_idx = 0

        # ── Explanation Tab ────────────────────────────────────
        if "explanation" in res:
            with tabs[tab_idx]:
                st.markdown('<div class="glass-card">', unsafe_allow_html=True)
                st.markdown('<div class="section-title"><span class="icon">💬</span> Plain-English Explanation</div>', unsafe_allow_html=True)
                st.markdown('<div class="section-divider"></div>', unsafe_allow_html=True)
                explanation_text = res["explanation"]
                st.markdown(f'<div class="explanation-text">{explanation_text}</div>', unsafe_allow_html=True)
                st.markdown('</div>', unsafe_allow_html=True)

                # Copy button
                st.download_button(
                    "⬇️ Download Explanation",
                    data=explanation_text,
                    file_name=f"codeexplain_{lang.lower()}_explanation.txt",
                    mime="text/plain",
                    use_container_width=False,
                )
            tab_idx += 1

        # ── Complexity Tab ─────────────────────────────────────
        if "complexity" in res:
            with tabs[tab_idx]:
                cx = res["complexity"]
                st.markdown('<div class="glass-card">', unsafe_allow_html=True)
                st.markdown('<div class="section-title"><span class="icon">⏱️</span> Complexity Analysis</div>', unsafe_allow_html=True)
                st.markdown('<div class="section-divider"></div>', unsafe_allow_html=True)

                time_cls  = complexity_color(cx.get("time",  ""))
                space_cls = complexity_color(cx.get("space", ""))

                st.markdown(f"""
                <div class="complexity-grid">
                    <div class="complexity-chip {time_cls}">
                        <div class="label">⏱ Time Complexity</div>
                        <div class="value">{cx.get('time', 'N/A')}</div>
                        <div class="note">{cx.get('time_explanation', '')}</div>
                    </div>
                    <div class="complexity-chip {space_cls}">
                        <div class="label">💾 Space Complexity</div>
                        <div class="value">{cx.get('space', 'N/A')}</div>
                        <div class="note">{cx.get('space_explanation', '')}</div>
                    </div>
                </div>
                """, unsafe_allow_html=True)

                # Best/Worst/Average
                for case, label, emoji in [
                    ("best",    "Best Case",    "🟢"),
                    ("average", "Average Case", "🟡"),
                    ("worst",   "Worst Case",   "🔴"),
                ]:
                    val = cx.get(case, "N/A")
                    if val and val != "N/A":
                        st.markdown(f"""
                        <div class="case-row">
                            <span class="case-label">{emoji} {label}</span>
                            <span class="case-val">{val}</span>
                        </div>
                        """, unsafe_allow_html=True)

                if cx.get("summary"):
                    st.markdown(f"""
                    <div style="margin-top:1.2rem; padding:1rem 1.2rem;
                        background:rgba(0,212,255,0.06); border-left:3px solid #00d4ff;
                        border-radius: 0 10px 10px 0; font-size:0.93rem; color:#9fa8c7; line-height:1.7;">
                        <strong style="color:#00d4ff;">📊 In Practice:</strong> {cx.get('summary', '')}
                    </div>
                    """, unsafe_allow_html=True)

                st.markdown('</div>', unsafe_allow_html=True)
            tab_idx += 1

        # ── Line-by-Line Tab ───────────────────────────────────
        if "lines" in res:
            with tabs[tab_idx]:
                st.markdown('<div class="glass-card">', unsafe_allow_html=True)
                st.markdown('<div class="section-title"><span class="icon">📝</span> Line-by-Line Commentary</div>', unsafe_allow_html=True)
                st.markdown('<div class="section-divider"></div>', unsafe_allow_html=True)

                # Show code + commentary side-by-side
                col_code, col_comment = st.columns([1, 1])
                with col_code:
                    st.markdown("**🖥️ Original Code**")
                    st.code(res.get("code", ""), language=lang.lower() if lang.lower() in
                        ["python","javascript","java","c","go","rust","ruby","php","swift","kotlin","sql","bash"] else "text")

                with col_comment:
                    st.markdown("**💡 Commentary**")
                    for item in res["lines"]:
                        st.markdown(f"""
                        <div class="line-comment-row">
                            <div class="line-num-badge">L{item.get('line','?')}</div>
                            <div class="line-comment-text">{item.get('explanation','')}</div>
                        </div>
                        """, unsafe_allow_html=True)

                st.markdown('</div>', unsafe_allow_html=True)
            tab_idx += 1

        # ── Improvements Tab ───────────────────────────────────
        if "improvements" in res:
            with tabs[tab_idx]:
                st.markdown('<div class="glass-card">', unsafe_allow_html=True)
                st.markdown('<div class="section-title"><span class="icon">🚀</span> Suggested Improvements</div>', unsafe_allow_html=True)
                st.markdown('<div class="section-divider"></div>', unsafe_allow_html=True)

                improvements = res["improvements"]
                if not improvements:
                    st.info("No improvements found — your code looks clean! 🎉")
                else:
                    for i, imp in enumerate(improvements, 1):
                        code_block = ""
                        if imp.get("code") and imp["code"].upper() != "N/A":
                            code_block = f'<div class="imp-code">{imp["code"]}</div>'

                        st.markdown(f"""
                        <div class="improvement-card">
                            <div class="imp-num">Improvement #{i}</div>
                            <div class="imp-title">{imp.get('title', 'Suggestion')}</div>
                            <div class="imp-detail"><strong>Issue:</strong> {imp.get('issue','')}</div>
                            <div class="imp-detail"><strong>Fix:</strong> {imp.get('fix','')}</div>
                            {code_block}
                        </div>
                        """, unsafe_allow_html=True)

                st.markdown('</div>', unsafe_allow_html=True)
            tab_idx += 1

        # ── Quiz Tab ───────────────────────────────────────────
        if st.session_state.quiz_mode:
            with tabs[tab_idx]:
                if not st.session_state.quiz_questions:
                    st.markdown('<div class="glass-card">', unsafe_allow_html=True)
                    st.markdown("""
                    <div style="text-align:center; padding:2rem;">
                        <div style="font-size:3rem; margin-bottom:1rem;">🧠</div>
                        <div style="font-size:1.2rem; font-weight:700; color:#fff; margin-bottom:0.5rem;">
                            Ready to Test Your Knowledge?
                        </div>
                        <div style="color:#9fa8c7; font-size:0.9rem; margin-bottom:1.5rem;">
                            Generate comprehension questions from the analyzed code
                        </div>
                    </div>
                    """, unsafe_allow_html=True)

                    if st.button("🎯 Generate Quiz Questions", type="primary", use_container_width=True):
                        if not os.getenv("GROQ_API_KEY"):
                            st.error("❌ API key required.")
                        else:
                            with st.spinner("Generating 5 quiz questions..."):
                                try:
                                    from llm_engine import generate_quiz
                                    explanation = res.get("explanation", "")
                                    questions = generate_quiz(res["code"], res["language"], explanation)
                                    st.session_state.quiz_questions = questions
                                    reset_quiz()
                                    st.rerun()
                                except Exception as e:
                                    st.error(f"Quiz generation failed: {e}")

                    st.markdown('</div>', unsafe_allow_html=True)
                else:
                    render_quiz(st.session_state.quiz_questions)

# ── Empty State ────────────────────────────────────────────────
if not st.session_state.results and not analyze_btn:
    st.markdown("""
    <div class="glass-card" style="text-align:center; padding:3rem 2rem; margin-top:1.5rem;">
        <div style="font-size:4rem; margin-bottom:1rem; animation: logoPulse 3s ease-in-out infinite;">🔮</div>
        <div style="font-size:1.4rem; font-weight:700; color:#fff; margin-bottom:0.8rem;">
            Ready to Decode Any Code
        </div>
        <div style="color:#9fa8c7; font-size:0.95rem; line-height:1.8; max-width:500px; margin:0 auto;">
            Paste a snippet above and click <strong style="color:#6c63ff;">Analyze Code</strong> to get:<br><br>
            💬 Plain-English explanation<br>
            ⏱️ Time &amp; space complexity<br>
            📝 Line-by-line commentary<br>
            🚀 Improvement suggestions<br>
            🧠 Interactive quiz questions
        </div>
        <div style="margin-top:1.5rem; color:#5c6594; font-size:0.82rem;">
            Supports Python · JavaScript · Java · C++ · Go · Rust · and more
        </div>
    </div>
    """, unsafe_allow_html=True)

# ── Footer ─────────────────────────────────────────────────────
st.markdown("""
<div class="footer">
    <strong style="color:#6c63ff;">CodeExplain</strong> — Project 4 · AI Engineer Launchpad · 
    Built with Streamlit &amp; Groq ·
    <span style="color:#00d4ff;">Plain-English Code Tutor</span>
</div>
""", unsafe_allow_html=True)
