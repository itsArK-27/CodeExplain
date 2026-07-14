/* ═══════════════════════════════════════════════════════════════
   CodeExplain — Frontend App Logic
   Communicates with Flask backend via REST API.
   ═══════════════════════════════════════════════════════════════ */

"use strict";

// ── State ──────────────────────────────────────────────────────────────────────
const state = {
  results: null,
  quizQuestions: [],
  quizAnswers: {},
  quizSubmitted: false,
  quizScore: 0,
  language: "Auto-detect",
  detectedLanguage: "Python",
  samples: {},
};

// ── DOM refs ───────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const codeInput     = $("code-input");
const analyzeBtn    = $("analyze-btn");
const analyzeLabel  = $("analyze-label");
const quizBtn       = $("quiz-btn");
const clearBtn      = $("clear-btn");
const langSelect    = $("lang-select");
const sampleSelect  = $("sample-select");
const statsBar      = $("stats-bar");
const statLang      = $("stat-lang");
const statLines     = $("stat-lines");
const statChars     = $("stat-chars");
const analyzingBanner = $("analyzing-banner");
const errorBanner   = $("error-banner");
const errorMsg      = $("error-msg");
const warnBanner    = $("warn-banner");
const resultsArea   = $("results-area");
const tabsBar       = $("tabs-bar");
const tabPanels     = $("tab-panels");
const emptyState    = $("empty-state");
const resultLangBadge = $("result-lang-badge");
const resultTime    = $("result-time");
const sidebarEl     = $("sidebar");
const sidebarToggle = $("sidebar-toggle");

// Analysis options
const opts = {
  explanation:  $("opt-explanation"),
  complexity:   $("opt-complexity"),
  lines:        $("opt-lines"),
  improvements: $("opt-improvements"),
};

// ── Init ───────────────────────────────────────────────────────────────────────
async function init() {
  await loadMeta();
  setupParticles();
  setupMouseEffects();
  setupEventListeners();
  updateStats();
}

// ── Load API metadata (languages + samples) ────────────────────────────────────
async function loadMeta() {
  try {
    const res = await fetch("/api/meta");
    const data = await res.json();

    // Populate language dropdown
    data.languages.forEach((lang) => {
      const opt = document.createElement("option");
      opt.value = lang;
      opt.textContent = lang;
      langSelect.appendChild(opt);
    });

    // Populate sample dropdown
    state.samples = data.samples;
    Object.keys(data.samples).forEach((key) => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = key;
      sampleSelect.appendChild(opt);
    });
  } catch (e) {
    console.warn("Could not load metadata:", e);
  }
}

// ── Event Listeners ────────────────────────────────────────────────────────────
function setupEventListeners() {
  codeInput.addEventListener("input", updateStats);
  langSelect.addEventListener("change", () => {
    state.language = langSelect.value;
    updateStats();
  });

  sampleSelect.addEventListener("change", () => {
    const sample = state.samples[sampleSelect.value];
    if (sample) {
      codeInput.value = sample;
      updateStats();
    }
  });

  analyzeBtn.addEventListener("click", runAnalysis);
  clearBtn.addEventListener("click", clearAll);
  quizBtn.addEventListener("click", runQuiz);

  sidebarToggle.addEventListener("click", () => {
    sidebarEl.classList.toggle("open");
  });

  // Close sidebar on outside click (mobile)
  document.addEventListener("click", (e) => {
    if (window.innerWidth <= 768 &&
        sidebarEl.classList.contains("open") &&
        !sidebarEl.contains(e.target) &&
        e.target !== sidebarToggle) {
      sidebarEl.classList.remove("open");
    }
  });
}

// ── Stats Bar ──────────────────────────────────────────────────────────────────
function updateStats() {
  const code = codeInput.value;
  const lines = code.split("\n").length;
  const chars = code.length;
  const hasCode = code.trim().length > 0;

  analyzeBtn.disabled = !hasCode;

  if (hasCode) {
    statsBar.style.display = "flex";
    statLines.innerHTML = `📄 Lines: <span class="stat-val">${lines}</span>`;
    statChars.innerHTML = `🔤 Chars: <span class="stat-val">${chars.toLocaleString()}</span>`;
    const detectedLang = state.language === "Auto-detect" ? state.detectedLanguage : state.language;
    statLang.innerHTML = `Language: <span class="stat-val">${detectedLang}</span>`;
  } else {
    statsBar.style.display = "none";
  }
}

// ── Analysis ───────────────────────────────────────────────────────────────────
async function runAnalysis() {
  hideError();
  warnBanner.style.display = "none";
  resultsArea.style.display = "none";
  emptyState.style.display = "none";
  analyzingBanner.style.display = "block";
  analyzeBtn.disabled = true;

  const body = {
    code: codeInput.value,
    language: state.language,
    response_language: $("response-lang-select").value,
    options: {
      explanation:  opts.explanation.checked,
      complexity:   opts.complexity.checked,
      lines:        opts.lines.checked,
      improvements: opts.improvements.checked,
    },
  };

  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (!res.ok) {
      showError(data.error || "Analysis failed.");
      return;
    }

    state.results = data;
    state.detectedLanguage = data.language;
    state.quizQuestions = [];
    state.quizAnswers = {};
    state.quizSubmitted = false;
    state.quizScore = 0;

    if (data.truncated) {
      warnBanner.style.display = "block";
    }

    renderResults(data);
    quizBtn.disabled = false;
    updateStats();
  } catch (e) {
    showError("❌ Network error — is the server running? " + e.message);
  } finally {
    analyzingBanner.style.display = "none";
    analyzeBtn.disabled = false;
  }
}

// ── Quiz ───────────────────────────────────────────────────────────────────────
async function runQuiz() {
  if (!state.results) return;

  quizBtn.disabled = true;
  quizBtn.textContent = "⏳ Generating...";

  const body = {
    code: state.results.code,
    language: state.results.language,
    explanation: state.results.explanation || "",
    response_language: $("response-lang-select").value,
  };

  try {
    const res = await fetch("/api/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (!res.ok) {
      showError(data.error || "Quiz generation failed.");
      return;
    }

    state.quizQuestions = data.questions || [];
    state.quizAnswers = {};
    state.quizSubmitted = false;
    state.quizScore = 0;

    // Re-render results adding/refreshing quiz tab
    renderResults(state.results);
    // Auto-switch to quiz tab
    const quizTabBtn = document.querySelector(".tab-btn[data-tab='quiz']");
    if (quizTabBtn) quizTabBtn.click();
  } catch (e) {
    showError("❌ Quiz error: " + e.message);
  } finally {
    quizBtn.disabled = false;
    quizBtn.textContent = state.quizQuestions.length ? "🔄 New Quiz" : "🧠 Generate Quiz";
  }
}

// ── Render Results ─────────────────────────────────────────────────────────────
function renderResults(data) {
  resultsArea.style.display = "block";
  emptyState.style.display = "none";

  const now = new Date();
  resultLangBadge.textContent = `${data.language_icon || ""} ${data.language}`;
  resultTime.textContent = `Analysis complete · ${now.getHours().toString().padStart(2,"0")}:${now.getMinutes().toString().padStart(2,"0")}`;

  // Build tabs
  const tabs = [];
  if (data.explanation !== undefined)  tabs.push({ id: "explanation",  label: "💬 Explanation" });
  if (data.complexity !== undefined)   tabs.push({ id: "complexity",   label: "⏱️ Complexity" });
  if (data.lines !== undefined)        tabs.push({ id: "lines",        label: "📝 Line-by-Line" });
  if (data.improvements !== undefined) tabs.push({ id: "improvements", label: "🚀 Improvements" });
  if (state.quizQuestions.length)      tabs.push({ id: "quiz",         label: "🧠 Quiz" });

  tabsBar.innerHTML = tabs.map((t, i) =>
    `<button class="tab-btn${i === 0 ? " active" : ""}" data-tab="${t.id}">${t.label}</button>`
  ).join("");

  tabPanels.innerHTML = "";

  tabs.forEach((t, i) => {
    const panel = document.createElement("div");
    panel.className = `tab-panel${i === 0 ? " active" : ""}`;
    panel.dataset.tab = t.id;

    if (t.id === "explanation") panel.innerHTML = renderExplanation(data);
    else if (t.id === "complexity") panel.innerHTML = renderComplexity(data.complexity);
    else if (t.id === "lines") panel.innerHTML = renderLines(data);
    else if (t.id === "improvements") panel.innerHTML = renderImprovements(data.improvements);
    else if (t.id === "quiz") panel.innerHTML = renderQuiz();

    tabPanels.appendChild(panel);
  });

  // Tab switching
  tabsBar.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      tabsBar.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      tabPanels.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      tabPanels.querySelector(`[data-tab="${btn.dataset.tab}"]`).classList.add("active");
    });
  });

  // Wire up quiz interaction after render
  if (state.quizQuestions.length) {
    wireQuizInteraction();
  }
}

// ── Tab Renderers ──────────────────────────────────────────────────────────────
function renderExplanation(data) {
  const text = data.explanation || "";
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  return `
    <div class="glass-card">
      <div class="section-title"><span class="icon">💬</span> Plain-English Explanation</div>
      <div class="section-divider"></div>
      <div class="explanation-text">${escapeHtml(text)}</div>
      <a class="download-btn" href="${url}" download="codeexplain_explanation.txt">
        ⬇️ Download Explanation
      </a>
    </div>`;
}

function complexityClass(c) {
  const u = (c || "").toUpperCase();
  if (u.includes("O(1)")) return "complexity-green";
  if (u.includes("O(LOG") || u.includes("O(N LOG")) return "complexity-blue";
  if (u.includes("O(N)")) return "complexity-yellow";
  if (u.includes("O(N^2)") || u.includes("O(N²)") || u.includes("O(N*N)")) return "complexity-orange";
  if (u.includes("O(2^N)") || u.includes("O(N!)")) return "complexity-red";
  return "complexity-gray";
}

function renderComplexity(cx) {
  if (!cx) return `<div class="glass-card"><p style="color:var(--text-sec)">No complexity data.</p></div>`;
  const cases = [
    { key: "best",    label: "Best Case",    emoji: "🟢" },
    { key: "average", label: "Average Case", emoji: "🟡" },
    { key: "worst",   label: "Worst Case",   emoji: "🔴" },
  ];
  const caseRows = cases.map(c => {
    const val = cx[c.key];
    if (!val || val === "N/A") return "";
    return `<div class="case-row"><span class="case-label">${c.emoji} ${c.label}</span><span class="case-val">${escapeHtml(val)}</span></div>`;
  }).join("");
  const summary = cx.summary ? `<div class="in-practice"><strong style="color:#00d4ff">📊 In Practice:</strong> ${escapeHtml(cx.summary)}</div>` : "";
  return `
    <div class="glass-card">
      <div class="section-title"><span class="icon">⏱️</span> Complexity Analysis</div>
      <div class="section-divider"></div>
      <div class="complexity-grid">
        <div class="complexity-chip ${complexityClass(cx.time)}">
          <div class="label">⏱ Time Complexity</div>
          <div class="value">${escapeHtml(cx.time || "N/A")}</div>
          <div class="note">${escapeHtml(cx.time_explanation || "")}</div>
        </div>
        <div class="complexity-chip ${complexityClass(cx.space)}">
          <div class="label">💾 Space Complexity</div>
          <div class="value">${escapeHtml(cx.space || "N/A")}</div>
          <div class="note">${escapeHtml(cx.space_explanation || "")}</div>
        </div>
      </div>
      ${caseRows}
      ${summary}
    </div>`;
}

function renderLines(data) {
  const items = data.lines || [];
  const code = data.code || "";
  const commentRows = items.map(item => `
    <div class="line-comment-row">
      <div class="line-num-badge">L${escapeHtml(String(item.line || "?"))}</div>
      <div class="line-comment-text">${escapeHtml(item.explanation || "")}</div>
    </div>`).join("");
  return `
    <div class="glass-card">
      <div class="section-title"><span class="icon">📝</span> Line-by-Line Commentary</div>
      <div class="section-divider"></div>
      <div class="lbl-grid">
        <div>
          <strong style="color:#fff;font-size:.9rem;margin-bottom:.6rem;display:block;">🖥️ Original Code</strong>
          <pre class="code-block">${escapeHtml(code)}</pre>
        </div>
        <div>
          <strong style="color:#fff;font-size:.9rem;margin-bottom:.6rem;display:block;">💡 Commentary</strong>
          ${commentRows}
        </div>
      </div>
    </div>`;
}

function renderImprovements(improvements) {
  if (!improvements || improvements.length === 0) {
    return `<div class="glass-card"><div class="section-title"><span class="icon">🚀</span> Improvements</div><div class="section-divider"></div><p style="color:var(--text-sec);text-align:center;padding:1rem">No improvements found — your code looks clean! 🎉</p></div>`;
  }
  const cards = improvements.map((imp, i) => {
    const codeBlock = (imp.code && imp.code.toUpperCase() !== "N/A")
      ? `<div class="imp-code">${escapeHtml(imp.code)}</div>` : "";
    return `
      <div class="improvement-card">
        <div class="imp-num">Improvement #${i + 1}</div>
        <div class="imp-title">${escapeHtml(imp.title || "Suggestion")}</div>
        <div class="imp-detail"><strong>Issue:</strong> ${escapeHtml(imp.issue || "")}</div>
        <div class="imp-detail"><strong>Fix:</strong> ${escapeHtml(imp.fix || "")}</div>
        ${codeBlock}
      </div>`;
  }).join("");
  return `
    <div class="glass-card">
      <div class="section-title"><span class="icon">🚀</span> Suggested Improvements</div>
      <div class="section-divider"></div>
      ${cards}
    </div>`;
}

function renderQuiz() {
  const qs = state.quizQuestions;
  if (!qs.length) return `<div class="glass-card"><p style="color:var(--text-sec);text-align:center;padding:2rem">No quiz questions loaded.</p></div>`;

  const header = `<div class="quiz-header"><h2>🧠 Code Comprehension Quiz</h2><p>Test your understanding of the analyzed code</p></div>`;

  const cards = qs.map((q, i) => {
    const qType = q.type || "MCQ";
    const options = q.options || {};
    let optionsHtml = "";

    if (qType === "TRUE_FALSE") {
      optionsHtml = ["TRUE", "FALSE"].map(v => `
        <label class="quiz-option" data-qi="${i}" data-val="${v}">
          <input type="radio" name="quiz_${i}" value="${v}" />
          ${v}
        </label>`).join("");
    } else if (typeof options === "object" && Object.keys(options).length) {
      optionsHtml = Object.entries(options).sort().map(([k, v]) => `
        <label class="quiz-option" data-qi="${i}" data-val="${k}">
          <input type="radio" name="quiz_${i}" value="${k}" />
          <strong>${k}:</strong>&nbsp;${escapeHtml(String(v))}
        </label>`).join("");
    }

    return `
      <div class="quiz-q-card" id="quiz-card-${i}">
        <div class="quiz-q-meta">
          <span class="quiz-q-num">Q${i + 1} / ${qs.length}</span>
          <span class="quiz-q-type">${qType}</span>
        </div>
        <div class="quiz-question">${escapeHtml(q.question || "")}</div>
        <div class="quiz-options" id="quiz-opts-${i}">${optionsHtml}</div>
        <div class="quiz-feedback" id="quiz-fb-${i}" style="display:none"></div>
      </div>`;
  }).join("");

  const submitBtn = `<button class="btn btn-primary" id="quiz-submit-btn" style="margin-bottom:1.5rem">🎯 Submit Quiz</button>`;
  const scoreDiv = `<div id="quiz-score-area" style="display:none"></div>`;
  const retakeBtn = `<button class="btn btn-secondary" id="quiz-retake-btn" style="display:none;margin-top:1rem">🔄 Retake Quiz</button>`;

  return `<div>${header}${cards}${!state.quizSubmitted ? submitBtn : ""}${scoreDiv}${retakeBtn}</div>`;
}

// Wire up quiz interactivity after DOM insertion
function wireQuizInteraction() {
  // Option clicks
  document.querySelectorAll(".quiz-option").forEach(label => {
    label.addEventListener("click", () => {
      if (state.quizSubmitted) return;
      const qi = parseInt(label.dataset.qi);
      const val = label.dataset.val;
      state.quizAnswers[qi] = val;
      // Highlight selected
      document.querySelectorAll(`.quiz-option[data-qi="${qi}"]`).forEach(l => l.classList.remove("selected"));
      label.classList.add("selected");
    });
  });

  const submitBtn = $("quiz-submit-btn");
  if (submitBtn) {
    submitBtn.addEventListener("click", submitQuiz);
  }
}

function submitQuiz() {
  state.quizSubmitted = true;
  const qs = state.quizQuestions;
  let score = 0;

  qs.forEach((q, i) => {
    const userAns = (state.quizAnswers[i] || "").trim().toUpperCase();
    const correct = (q.answer || "").trim().toUpperCase();
    const isCorrect = userAns === correct;
    if (isCorrect) score++;

    // Show feedback
    const fb = $(`quiz-fb-${i}`);
    const opts = document.querySelectorAll(`.quiz-option[data-qi="${i}"]`);
    opts.forEach(o => {
      o.classList.add("disabled");
      const oVal = o.dataset.val.toUpperCase();
      if (oVal === correct) o.classList.add("correct");
      else if (oVal === userAns && !isCorrect) o.classList.add("wrong");
    });
    fb.style.display = "block";
    fb.className = `quiz-feedback ${isCorrect ? "correct-fb" : "wrong-fb"}`;
    fb.innerHTML = isCorrect
      ? `✅ Correct! ${escapeHtml(q.explanation || "")}`
      : `❌ Incorrect. Correct answer: <strong>${escapeHtml(correct)}</strong> — ${escapeHtml(q.explanation || "")}`;
  });

  state.quizScore = score;

  // Hide submit, show score
  const submitBtn = $("quiz-submit-btn");
  if (submitBtn) submitBtn.style.display = "none";

  const scoreArea = $("quiz-score-area");
  if (scoreArea) {
    scoreArea.style.display = "block";
    scoreArea.innerHTML = renderScoreCard(score, qs.length);
  }

  const retakeBtn = $("quiz-retake-btn");
  if (retakeBtn) {
    retakeBtn.style.display = "inline-flex";
    retakeBtn.addEventListener("click", () => {
      state.quizAnswers = {};
      state.quizSubmitted = false;
      state.quizScore = 0;
      renderResults(state.results);
      // Switch to quiz tab
      setTimeout(() => {
        const qTab = document.querySelector(".tab-btn[data-tab='quiz']");
        if (qTab) qTab.click();
      }, 50);
    });
  }
}

function renderScoreCard(score, total) {
  const pct = total > 0 ? Math.round(score / total * 100) : 0;
  let emoji, title, msg;
  if (pct >= 90)      { emoji="🏆"; title="Outstanding!";    msg="You've mastered this code!"; }
  else if (pct >= 70) { emoji="🎯"; title="Great Job!";       msg="Solid understanding of the code."; }
  else if (pct >= 50) { emoji="📚"; title="Keep Going!";      msg="Review the explanations and try again."; }
  else                { emoji="💡"; title="Learning Mode";    msg="Read through the line-by-line commentary and retry!"; }
  return `
    <div class="score-card">
      <div class="score-emoji">${emoji}</div>
      <div class="score-title">${title}</div>
      <div class="score-value">${score} / ${total}</div>
      <div class="score-pct">${pct}%</div>
      <div class="score-msg">${msg}</div>
    </div>`;
}

// ── Clear ──────────────────────────────────────────────────────────────────────
function clearAll() {
  codeInput.value = "";
  sampleSelect.value = "";
  state.results = null;
  state.quizQuestions = [];
  state.quizAnswers = {};
  state.quizSubmitted = false;
  state.quizScore = 0;
  resultsArea.style.display = "none";
  emptyState.style.display = "block";
  warnBanner.style.display = "none";
  hideError();
  quizBtn.disabled = true;
  quizBtn.textContent = "🧠 Generate Quiz";
  updateStats();
}

// ── Error ──────────────────────────────────────────────────────────────────────
function showError(msg) {
  errorBanner.style.display = "block";
  errorMsg.textContent = msg;
}
function hideError() {
  errorBanner.style.display = "none";
  errorMsg.textContent = "";
}

// ── HTML Escape ────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Particle System ────────────────────────────────────────────────────────────
function setupParticles() {
  const canvas = $("particles-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let particles = [];
  let W, H;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  function Particle() { this.reset(); }
  Particle.prototype.reset = function () {
    this.x  = Math.random() * W;
    this.y  = Math.random() * H;
    this.r  = Math.random() * 1.5 + 0.3;
    this.vx = (Math.random() - 0.5) * 0.4;
    this.vy = (Math.random() - 0.5) * 0.4;
    this.alpha = Math.random() * 0.5 + 0.1;
    const hues = [240, 200, 170, 260, 220];
    this.hue = hues[Math.floor(Math.random() * hues.length)];
  };
  Particle.prototype.update = function () {
    this.x += this.vx;
    this.y += this.vy;
    if (this.x < 0 || this.x > W || this.y < 0 || this.y > H) this.reset();
  };
  Particle.prototype.draw = function () {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${this.hue},80%,70%,${this.alpha})`;
    ctx.fill();
  };

  for (let i = 0; i < 120; i++) particles.push(new Particle());

  function drawLines() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(108,99,255,${0.12 * (1 - dist / 120)})`;
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
}

// ── Mouse Parallax + Ripple ────────────────────────────────────────────────────
function setupMouseEffects() {
  document.addEventListener("mousemove", (e) => {
    const W = window.innerWidth, H = window.innerHeight;
    const dx = (e.clientX / W - 0.5) * 2;
    const dy = (e.clientY / H - 0.5) * 2;

    document.querySelectorAll(".orb").forEach((orb, i) => {
      const f = (i + 1) * 0.02;
      orb.style.transform = `translate(${dx * 30 * f}px,${dy * 20 * f}px)`;
    });

    document.querySelectorAll(".glass-card").forEach(card => {
      const rect = card.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top  + rect.height / 2;
      const rx = (e.clientX - cx) / W;
      const ry = (e.clientY - cy) / H;
      card.style.transform = `perspective(1000px) rotateY(${rx * 6}deg) rotateX(${-ry * 4}deg) translateZ(0)`;
    });
  });

  document.addEventListener("mouseleave", () => {
    document.querySelectorAll(".glass-card").forEach(card => {
      card.style.transform = "";
    });
  });

  document.addEventListener("click", (e) => {
    const ripple = document.createElement("div");
    ripple.style.cssText = `
      position:fixed;left:${e.clientX - 20}px;top:${e.clientY - 20}px;
      width:40px;height:40px;border-radius:50%;
      background:radial-gradient(circle,rgba(108,99,255,0.6),transparent);
      pointer-events:none;z-index:9999;
      animation:rippleOut .6s ease-out forwards;`;
    document.body.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  });

  const style = document.createElement("style");
  style.textContent = `
    @keyframes rippleOut {
      0%   { transform:scale(0); opacity:1; }
      100% { transform:scale(4); opacity:0; }
    }`;
  document.head.appendChild(style);
}

// ── Boot ───────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", init);
