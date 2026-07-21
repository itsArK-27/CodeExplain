"use strict";

const state = {
  results: null,
  quizQuestions: [],
  quizAnswers: {},
  quizSubmitted: false,
  quizScore: 0,
  language: "Auto-detect",
  detectedLanguage: "Python",
  samples: {},
  chatHistory: [],
  leetcodeData: null,
  leetcodeChatHistory: [],
};

const $ = (id) => document.getElementById(id);

const codeInput     = $("code-input");
let editor = null;
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
const downloadResultsBtn = $("download-results-btn");
const sidebarEl     = $("sidebar");
const sidebarToggle = $("sidebar-toggle");

const chatInput     = $("chat-input");
const chatSendBtn   = $("chat-send-btn");
const chatHistoryEl = $("chat-history");
const chatContainer = $("chat-container");
const chatFullscreenBtn = $("chat-fullscreen-btn");
// Analysis options
const opts = {
  explanation:  $("opt-explanation"),
  complexity:   $("opt-complexity"),
  lines:        $("opt-lines"),
  improvements: $("opt-improvements"),
};

async function init() {
  await loadMeta();
  setupEditor();
  setupParticles();
  setupMouseEffects();
  setupEventListeners();
  updateStats();
}

function setupEditor() {
  editor = CodeMirror.fromTextArea(codeInput, {
    mode: "python",
    theme: "vscode-dark-modern",
    lineNumbers: true,
    indentUnit: 4,
    lineWrapping: true,
  });
  editor.on("change", updateStats);
}

function getCode() {
  return editor ? editor.getValue() : codeInput.value;
}

function setCode(val) {
  if (editor) editor.setValue(val);
  else codeInput.value = val;
}


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

function setupEventListeners() {
  
  langSelect.addEventListener("change", () => {
    state.language = langSelect.value;
    if (editor) {
      let mode = "javascript";
      const val = state.language.toLowerCase();
      if (val.includes("python")) mode = "python";
      else if (val.includes("java") || val.includes("c") || val.includes("go") || val.includes("rust")) mode = "clike";
      else if (val.includes("html") || val.includes("xml")) mode = "xml";
      editor.setOption("mode", mode);
    }
    updateStats();
  });

  sampleSelect.addEventListener("change", () => {
    const sample = state.samples[sampleSelect.value];
    if (sample) {
      setCode(sample);
      updateStats();
    }
  });

  analyzeBtn.addEventListener("click", runAnalysis);
  clearBtn.addEventListener("click", clearAll);
  quizBtn.addEventListener("click", runQuiz);
  downloadResultsBtn.addEventListener("click", downloadResults);

  if (chatSendBtn) chatSendBtn.addEventListener("click", sendChatMessage);
  
  if (chatFullscreenBtn) {
    chatFullscreenBtn.addEventListener("click", () => {
      if (chatContainer) {
        const isFullscreen = chatContainer.classList.toggle("fullscreen");
        if (isFullscreen) {
          const placeholder = document.createElement("div");
          placeholder.id = "chat-placeholder";
          chatContainer.parentNode.insertBefore(placeholder, chatContainer);
          document.body.appendChild(chatContainer);
        } else {
          const placeholder = document.getElementById("chat-placeholder");
          if (placeholder) {
            placeholder.parentNode.insertBefore(chatContainer, placeholder);
            placeholder.remove();
          }
        }
        chatFullscreenBtn.textContent = isFullscreen ? "🗗" : "⛶";
        chatFullscreenBtn.title = isFullscreen ? "Exit Fullscreen" : "Toggle Fullscreen";
      }
    });
    
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && chatContainer && chatContainer.classList.contains("fullscreen")) {
        chatContainer.classList.remove("fullscreen");
        const placeholder = document.getElementById("chat-placeholder");
        if (placeholder) {
          placeholder.parentNode.insertBefore(chatContainer, placeholder);
          placeholder.remove();
        }
        chatFullscreenBtn.textContent = "⛶";
        chatFullscreenBtn.title = "Toggle Fullscreen";
      }
    });
  }

  if (chatInput) {
    chatInput.addEventListener("input", () => {
      chatSendBtn.disabled = chatInput.value.trim().length === 0;
    });
    chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!chatSendBtn.disabled) sendChatMessage();
      }
    });
  }

  const themeSelect = $("theme-select");
  if (themeSelect) {
    themeSelect.addEventListener("change", () => {
      if (editor) {
        editor.setOption("theme", themeSelect.value);
      }
    });
  }

  const desktopCollapseBtn = $("desktop-collapse-btn");
  if (desktopCollapseBtn) {
    desktopCollapseBtn.addEventListener("click", () => {
      document.body.classList.add("sidebar-collapsed");
    });
  }

  sidebarToggle.addEventListener("click", () => {
    if (window.innerWidth <= 768) {
      sidebarEl.classList.toggle("open");
    } else {
      document.body.classList.remove("sidebar-collapsed");
    }
  });

  // Navigation View Switching
  const navItems = document.querySelectorAll(".nav-item");
  const views = document.querySelectorAll(".view-container");
  navItems.forEach(item => {
    item.addEventListener("click", () => {
      navItems.forEach(n => n.classList.remove("active"));
      item.classList.add("active");
      const targetView = item.dataset.view;
      views.forEach(v => {
        if (v.id === targetView) {
          v.style.display = "block";
          v.classList.add("active-view");
        } else {
          v.style.display = "none";
          v.classList.remove("active-view");
        }
      });
      // On mobile, close sidebar after nav
      if (window.innerWidth <= 768) {
        sidebarEl.classList.remove("open");
      }
    });
  });

  // Custom smooth scroll that works reliably after layout changes
  // Temporarily disables CSS scroll-behavior to avoid browser interference
  function smoothScrollTo(targetY, duration = 600) {
    const html = document.documentElement;
    const body = document.body;
    
    // Disable CSS smooth scrolling so it doesn't fight our animation
    const origHtml = html.style.scrollBehavior;
    const origBody = body.style.scrollBehavior;
    html.style.scrollBehavior = 'auto';
    body.style.scrollBehavior = 'auto';

    const startY = window.pageYOffset || html.scrollTop;
    const diff = targetY - startY;
    if (Math.abs(diff) < 2) {
      html.style.scrollBehavior = origHtml;
      body.style.scrollBehavior = origBody;
      return;
    }
    let startTime = null;

    function easeInOutCubic(t) {
      return t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeInOutCubic(progress);

      const newY = startY + diff * easedProgress;
      window.scrollTo(0, newY);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        // Restore CSS scroll-behavior
        html.style.scrollBehavior = origHtml;
        body.style.scrollBehavior = origBody;
      }
    }

    requestAnimationFrame(step);
  }

  // Smooth scroll for sub-menu items (using event delegation for dynamic links)
  document.addEventListener("click", (e) => {
    const subItem = e.target.closest(".nav-sub-item");
    if (!subItem) return;

    e.preventDefault();
    
    // Find parent nav item to activate the view first
    const parentGroup = subItem.closest(".nav-group");
    if (parentGroup) {
      const parentNavItem = parentGroup.querySelector(".nav-item");
      if (parentNavItem && !parentNavItem.classList.contains("active")) {
        parentNavItem.click();
      }
    }

    // Smooth scroll to target using custom animation
    const targetId = subItem.getAttribute("href");
    if (targetId && targetId.startsWith("#")) {
      // Use setTimeout to let the browser fully lay out the switched view
      setTimeout(() => {
        const targetEl = document.querySelector(targetId);
        if (targetEl) {
          const headerOffset = 20;
          const rect = targetEl.getBoundingClientRect();
          const offsetPosition = rect.top + (window.pageYOffset || document.documentElement.scrollTop) - headerOffset;
          smoothScrollTo(offsetPosition, 700);
        }
      }, 50);
    }
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

  // Drag-and-Drop File Upload
  const inputCard = $("input-card");
  if (inputCard) {
    inputCard.addEventListener("dragover", (e) => {
      e.preventDefault();
      inputCard.style.border = "2px dashed #6c63ff";
      inputCard.style.backgroundColor = "rgba(108, 99, 255, 0.1)";
    });
    inputCard.addEventListener("dragleave", (e) => {
      e.preventDefault();
      inputCard.style.border = "";
      inputCard.style.backgroundColor = "";
    });
    inputCard.addEventListener("drop", (e) => {
      e.preventDefault();
      inputCard.style.border = "";
      inputCard.style.backgroundColor = "";
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        const reader = new FileReader();
        reader.onload = (ev) => {
          setCode(ev.target.result);
          updateStats();
        };
        reader.readAsText(file);
      }
    });
  }
}

function updateStats() {
  const code = getCode();
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

async function runAnalysis() {
  hideError();
  warnBanner.style.display = "none";
  resultsArea.style.display = "none";
  if(document.getElementById("nav-link-results")) document.getElementById("nav-link-results").style.display = "none";
  if(document.getElementById("nav-link-chat")) document.getElementById("nav-link-chat").style.display = "none";
  emptyState.style.display = "none";
  analyzingBanner.style.display = "block";
  analyzeBtn.disabled = true;

  const body = {
    code: getCode(),
    language: state.language,
    response_language: $("response-lang-select").value,
    options: {
      explanation:  opts.explanation.checked,
      complexity:   opts.complexity.checked,
      lines:        opts.lines.checked,
      improvements: opts.improvements.checked,
    },
  };

  if (!body.options.explanation && !body.options.complexity && !body.options.lines && !body.options.improvements) {
    showError("All analysis options are turned off. Please turn on at least one option in the settings to get an analysis.");
    analyzingBanner.style.display = "none";
    analyzeBtn.disabled = false;
    emptyState.style.display = "block";
    return;
  }

  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errData = await res.json().catch(()=>({}));
      showError(errData.error || "Analysis failed.");
      analyzingBanner.style.display = "none";
      analyzeBtn.disabled = false;
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let explanationText = "";
    
    // We will render partial results as they arrive
    state.results = {};
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunkStr = decoder.decode(value, { stream: true });
      const events = chunkStr.split("\\n\\n");
      
      for (const ev of events) {
        if (!ev.trim() || !ev.startsWith("data: ")) continue;
        
        try {
          const data = JSON.parse(ev.substring(6));
          
          if (data.type === "meta") {
            analyzingBanner.style.display = "none";
            state.detectedLanguage = data.language;
            state.results = { ...data, code: getCode() };
            if (data.truncated) warnBanner.style.display = "block";
            
            // Render the initial shell of the results area
            renderResultsShell(data, body.options);
            state.chatHistory = []; // Reset chat on new analysis
            renderChatHistory();
          } 
          else if (data.type === "explanation_chunk") {
            explanationText += data.text;
            const expEl = document.getElementById("stream-explanation");
            if (expEl) {
              if (typeof marked !== 'undefined') {
                expEl.innerHTML = marked.parse(explanationText + '<span class="blinking-cursor">|</span>', { breaks: true });
                if (!expEl.classList.contains("chat-markdown")) expEl.classList.add("chat-markdown");
              } else {
                expEl.innerHTML = escapeHtml(explanationText) + '<span class="blinking-cursor">|</span>';
              }
            }
          }
          else if (data.type === "complete") {
            // Merge complete data
            state.results = { ...state.results, ...data.data };
            if (body.options.explanation) {
              state.results.explanation = explanationText;
            } else {
              delete state.results.explanation;
            }
            
            // Re-render the full tabs now that we have complexity/lines/improvements
            renderTabsComplete(state.results);
            
            quizBtn.disabled = false;
            updateStats();
            analyzeBtn.disabled = false;
          }
          else if (data.type === "error") {
            showError(data.error);
            analyzeBtn.disabled = false;
          }
        } catch (e) {
          console.warn("Error parsing chunk", e, ev);
        }
      }
    }
  } catch (e) {
    showError("❌ Network error — " + e.message);
    analyzingBanner.style.display = "none";
    analyzeBtn.disabled = false;
  }
}

function renderResultsShell(data, options) {
  resultsArea.style.display = "block";
  if(document.getElementById("nav-link-results")) document.getElementById("nav-link-results").style.display = "block";
  if(document.getElementById("nav-link-chat")) document.getElementById("nav-link-chat").style.display = "block";
  emptyState.style.display = "none";
  downloadResultsBtn.style.display = "none";

  const now = new Date();
  resultLangBadge.textContent = `${data.language_icon || ""} ${data.language}`;
  resultTime.textContent = `Analysis complete · ${now.getHours().toString().padStart(2,"0")}:${now.getMinutes().toString().padStart(2,"0")}`;

  let firstTab = null;
  let tabsHtml = "";
  let panelsHtml = "";

  if (options && options.explanation) {
    firstTab = "explanation";
    tabsHtml += `<button class="tab-btn active" data-tab="explanation">💬 Explanation</button>`;
    panelsHtml += `
    <div class="tab-panel active" data-tab="explanation">
      <div class="glass-card">
        <div class="section-title"><span class="icon">💬</span> Plain-English Explanation</div>
        <div class="section-divider"></div>
        <div class="explanation-text relative-container">
           <div id="stream-explanation" style="white-space:pre-wrap; min-height: 50px;"></div>
        </div>
      </div>
    </div>`;
  } else if (options) {
    const tabs = [];
    if (options.complexity)   tabs.push({ id: "complexity",   label: "⏱️ Complexity" });
    if (options.lines)        tabs.push({ id: "lines",        label: "📝 Line-by-Line" });
    if (options.improvements) tabs.push({ id: "improvements", label: "🚀 Improvements" });

    if (tabs.length > 0) {
      firstTab = tabs[0].id;
      tabsHtml = `<button class="tab-btn active" data-tab="${firstTab}">${tabs[0].label}</button>`;
      panelsHtml = `
      <div class="tab-panel active" data-tab="${firstTab}">
        <div class="glass-card" style="text-align:center; padding: 2rem; color: var(--text-sec);">
          Generating ${tabs[0].label.replace(/[^a-zA-Z- ]/g, "").trim()}...
        </div>
      </div>`;
    } else {
      tabsHtml = `<button class="tab-btn active" data-tab="none">Analysis</button>`;
      panelsHtml = `<div class="tab-panel active" data-tab="none"><div class="glass-card">No sections requested.</div></div>`;
    }
  }

  tabsBar.innerHTML = tabsHtml;
  tabPanels.innerHTML = panelsHtml;
}

function renderTabsComplete(data) {
  const tabs = [];
  if (data.explanation !== undefined)  tabs.push({ id: "explanation",  label: "💬 Explanation" });
  if (data.complexity !== undefined)   tabs.push({ id: "complexity",   label: "⏱️ Complexity" });
  if (data.lines !== undefined)        tabs.push({ id: "lines",        label: "📝 Line-by-Line" });
  if (data.improvements !== undefined) tabs.push({ id: "improvements", label: "🚀 Improvements" });

  if (tabs.length > 0) {
    downloadResultsBtn.style.display = "inline-flex";
  }

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

    tabPanels.appendChild(panel);
  });
  
  // Highlight JS on rendered blocks
  document.querySelectorAll('pre code').forEach((block) => {
    hljs.highlightElement(block);
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
}


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

    // Render quiz in the dedicated quiz view area
    const quizContainer = $("quiz-area-container");
    if (quizContainer) {
      quizContainer.innerHTML = renderQuiz();
      wireQuizInteraction();
    }
    
    // Auto-switch to quiz view
    const quizNavBtn = document.querySelector(".nav-item[data-view='quiz-view']");
    if (quizNavBtn) quizNavBtn.click();
  } catch (e) {
    showError("❌ Quiz error: " + e.message);
  } finally {
    quizBtn.disabled = false;
    quizBtn.textContent = state.quizQuestions.length ? "🔄 Generate New Quiz" : "🧠 Generate Quiz from Last Analysis";
  }
}

function renderExplanation(data) {
  const text = data.explanation || "";
  let content = text;
  if (typeof marked !== 'undefined') {
    content = marked.parse(content, { breaks: true });
  } else {
    content = escapeHtml(content);
  }
  
  return `
    <div class="glass-card">
      <div class="section-title"><span class="icon">💬</span> Plain-English Explanation</div>
      <div class="section-divider"></div>
      <div class="explanation-text relative-container">
        <div id="exp-content" class="chat-markdown" style="overflow-x: auto;">${content}</div>
      </div>
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
    return `<div class="case-row" style="flex-direction:column; align-items:flex-start; gap:0.5rem;"><div class="case-label" style="font-weight:700; color:var(--text-primary); margin-bottom:0.2rem;">${c.emoji} ${c.label}</div><div class="case-val" style="font-family:'Outfit',sans-serif; font-size:0.95rem; font-weight:400; color:var(--text-sec); line-height:1.6; white-space:pre-wrap;">${escapeHtml(val)}</div></div>`;
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
  const codeText = data.code || "";
  const codeLines = codeText.split('\n');
  
  const commentsByLine = {};
  const unmappedComments = [];

  items.forEach(item => {
    const match = String(item.line).match(/(\d+)/);
    if (match) {
      const lineNum = parseInt(match[1], 10);
      if (commentsByLine[lineNum]) {
        commentsByLine[lineNum] += " " + item.explanation;
      } else {
        commentsByLine[lineNum] = item.explanation;
      }
    } else {
      unmappedComments.push(item);
    }
  });

  let linesHtml = "";
  if (codeText.trim() === "") {
     linesHtml = `<div style="padding: 1rem; color: var(--text-sec); text-align: center;">No code available for line-by-line view.</div>`;
  } else {
    for (let i = 0; i < codeLines.length; i++) {
      const lineNum = i + 1;
      const codeStr = codeLines[i];
      
      linesHtml += `<div class="code-line-container" style="margin-bottom: 0.5rem; background: rgba(0,0,0,0.2); border-radius: 6px; border: 1px solid rgba(255,255,255,0.05); overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">`;
      
      let highlightedCode = escapeHtml(codeStr);
      try {
        const lang = (data.language || "").toLowerCase();
        let mode = lang;
        if (lang === "python") mode = "python";
        else if (lang === "javascript") mode = "javascript";
        else if (lang === "java") mode = "java";
        else if (lang === "c++") mode = "cpp";
        else if (lang === "c") mode = "c";
        
        if (mode && hljs.getLanguage(mode)) {
          highlightedCode = hljs.highlight(codeStr, { language: mode, ignoreIllegals: true }).value;
        } else {
          highlightedCode = hljs.highlightAuto(codeStr).value;
        }
      } catch (e) {}

      linesHtml += `<div class="code-line-code" style="display: flex;">
        <div class="line-num" style="padding: 0.5rem; color: rgba(255,255,255,0.3); background: rgba(0,0,0,0.3); text-align: right; min-width: 3rem; user-select: none; font-family: 'Fira Code', monospace; font-size: 0.85rem; border-right: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: flex-end;">${lineNum}</div>
        <div class="code-text" style="padding: 0.5rem 1rem; font-family: 'Fira Code', monospace; font-size: 0.9rem; white-space: pre-wrap; word-break: break-all; width: 100%;"><code class="language-${(data.language||'').toLowerCase()} hljs" style="background:transparent; padding:0;">${highlightedCode}</code></div>
      </div>`;

      if (commentsByLine[lineNum]) {
        linesHtml += `<div class="code-line-comment" style="padding: 0.75rem 1rem 0.75rem 3.5rem; border-top: 1px solid rgba(255,255,255,0.05); background: rgba(56, 189, 248, 0.08); color: #e0f2fe; font-size: 0.95rem; position: relative; line-height: 1.5;">
          <span style="position: absolute; left: 1.5rem; top: 0.75rem; color: #38bdf8; font-weight: bold;">↳</span>
          ${escapeHtml(commentsByLine[lineNum])}
        </div>`;
      }
      
      linesHtml += `</div>`;
    }
  }

  let unmappedHtml = "";
  if (unmappedComments.length > 0) {
    unmappedHtml = `<div class="unmapped-comments" style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--glass-border);">
      <strong style="color:#fff;font-size:1.1rem;margin-bottom:1rem;display:block;">Additional Commentary</strong>
      ${unmappedComments.map(c => `<div class="line-comment-row" style="margin-bottom:0.75rem; padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 6px; border-left: 4px solid #f59e0b;"><div class="line-comment-text" style="color:#e2e8f0; font-size:0.95rem; line-height:1.5;">${escapeHtml(c.explanation)}</div></div>`).join("")}
    </div>`;
  }

  return `
    <div class="glass-card">
      <div class="section-title"><span class="icon">📝</span> Line-by-Line Commentary</div>
      <div class="section-divider"></div>
      
      <div class="line-by-line-view" style="margin-bottom: 1.5rem;">
        ${linesHtml}
      </div>
      
      ${unmappedHtml}
    </div>`;
}

function renderImprovements(improvements) {
  if (!improvements || improvements.length === 0) {
    return `<div class="glass-card"><div class="section-title"><span class="icon">🚀</span> Improvements</div><div class="section-divider"></div><p style="color:var(--text-sec);text-align:center;padding:1rem">No improvements found — your code looks clean! 🎉</p></div>`;
  }
  const cards = improvements.map((imp, i) => {
    let diffBlock = "";
    if (imp.original_code && imp.original_code.toUpperCase() !== "N/A" && imp.code && imp.code.toUpperCase() !== "N/A") {
      diffBlock = `
        <div class="diff-container" style="display: flex; flex-direction: column; gap: 1rem; margin-top: 1rem;">
          <div class="diff-half" style="border: 1px solid rgba(255,107,107,0.4); border-radius: 8px; background: rgba(255,107,107,0.05); overflow: hidden;">
            <div style="background: rgba(255,107,107,0.2); padding: 0.4rem 1rem; font-size: 0.8rem; font-weight: bold; color: #ff8a8a;">Original</div>
            <pre style="margin:0; padding: 1rem; overflow-x: auto; font-family: 'JetBrains Mono', monospace; font-size: 0.82rem;"><code class="language-python">${escapeHtml(imp.original_code)}</code></pre>
          </div>
          <div class="diff-half" style="border: 1px solid rgba(0,245,160,0.4); border-radius: 8px; background: rgba(0,245,160,0.05); overflow: hidden;">
            <div style="background: rgba(0,245,160,0.2); padding: 0.4rem 1rem; font-size: 0.8rem; font-weight: bold; color: #00f5a0; position: relative;">
              Improved
              <button class="copy-btn" style="position: absolute; right: 8px; top: 2px; padding: 2px 8px; font-size: 0.7rem; cursor: pointer; border-radius: 4px; border: 1px solid rgba(0,245,160,0.4); background: rgba(0,245,160,0.1); color: #00f5a0;" onclick="navigator.clipboard.writeText(this.parentElement.nextElementSibling.innerText); alert('Copied!')">📋 Copy</button>
            </div>
            <pre style="margin:0; padding: 1rem; overflow-x: auto; font-family: 'JetBrains Mono', monospace; font-size: 0.82rem;"><code class="language-python">${escapeHtml(imp.code)}</code></pre>
          </div>
        </div>
      `;
    } else if (imp.code && imp.code.toUpperCase() !== "N/A") {
      diffBlock = `<div class="relative-container" style="margin-top: 1rem;"><button class="copy-btn" style="position: absolute; right: 8px; top: 8px; padding: 2px 8px; font-size: 0.7rem; cursor: pointer; border-radius: 4px; border: 1px solid rgba(0,245,160,0.4); background: rgba(0,245,160,0.1); color: #00f5a0;" onclick="navigator.clipboard.writeText(this.nextElementSibling.innerText); alert('Copied!')">📋 Copy</button><pre style="margin:0; padding: 1rem; overflow-x: auto; font-family: 'JetBrains Mono', monospace; font-size: 0.82rem; border: 1px solid rgba(0,245,160,0.4); border-radius: 8px; background: rgba(0,245,160,0.05);"><code class="language-python">${escapeHtml(imp.code)}</code></pre></div>`;
    }

    return `
      <div class="improvement-card">
        <div class="imp-num">Improvement #${i + 1}</div>
        <div class="imp-title">${escapeHtml(imp.title || "Suggestion")}</div>
        <div class="imp-detail"><strong>Issue:</strong> ${escapeHtml(imp.issue || "")}</div>
        <div class="imp-detail"><strong>Fix:</strong> ${escapeHtml(imp.fix || "")}</div>
        ${diffBlock}
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
      
      const quizContainer = $("quiz-area-container");
      if (quizContainer) {
        quizContainer.innerHTML = renderQuiz();
        wireQuizInteraction();
      }
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

function clearAll() {
  setCode("");
  sampleSelect.value = "";
  state.results = null;
  state.quizQuestions = [];
  state.quizAnswers = {};
  state.quizSubmitted = false;
  state.quizScore = 0;
  resultsArea.style.display = "none";
  if(document.getElementById("nav-link-results")) document.getElementById("nav-link-results").style.display = "none";
  if(document.getElementById("nav-link-chat")) document.getElementById("nav-link-chat").style.display = "none";
  emptyState.style.display = "block";
  warnBanner.style.display = "none";
  hideError();
  quizBtn.disabled = true;
  quizBtn.textContent = "🧠 Generate Quiz from Last Analysis";
  $("quiz-area-container").innerHTML = "";
  updateStats();
}

function getFriendlyError(msg) {
  const msgLower = String(msg).toLowerCase();
  
  if (msgLower.includes("not set") || msgLower.includes("not found")) {
    return msg; // Return original message which tells them to set it in .env
  }
  
  if (msgLower.includes("api key") || msgLower.includes("quota") || msgLower.includes("429") || msgLower.includes("rate limit") || msgLower.includes("401") || msgLower.includes("403") || msgLower.includes("insufficient_quota")) {
    return `⚠️ API Limit Reached: The API key quota has run out or is invalid. \n\nPlease note that CodeExplain is currently in its Alpha/Beta version. We appreciate your patience as we scale!`;
  }
  return msg;
}

function showError(msg) {
  errorBanner.style.display = "block";
  const friendlyMsg = getFriendlyError(msg);
  errorMsg.innerText = friendlyMsg; // Using innerText to preserve the newlines
}
function hideError() {
  errorBanner.style.display = "none";
  errorMsg.textContent = "";
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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

function downloadResults() {
  if (!state.results) return;

  const data = state.results;
  let content = `# CodeExplain Analysis Results\n\n`;
  content += `**Language:** ${data.language || "Unknown"}\n\n`;
  content += `---\n\n`;

  if (data.explanation) {
    content += `## 💬 Plain-English Explanation\n\n`;
    content += `${data.explanation}\n\n`;
  }

  if (data.complexity) {
    const cx = data.complexity;
    content += `## ⏱️ Complexity Analysis\n\n`;
    content += `- **Time Complexity:** ${cx.time || "N/A"}\n`;
    if (cx.time_explanation) content += `  - *Reason:* ${cx.time_explanation}\n`;
    content += `- **Space Complexity:** ${cx.space || "N/A"}\n`;
    if (cx.space_explanation) content += `  - *Reason:* ${cx.space_explanation}\n`;
    if (cx.best && cx.best !== "N/A") content += `- **Best Case:** ${cx.best}\n`;
    if (cx.average && cx.average !== "N/A") content += `- **Average Case:** ${cx.average}\n`;
    if (cx.worst && cx.worst !== "N/A") content += `- **Worst Case:** ${cx.worst}\n`;
    if (cx.summary) content += `- **In Practice:** ${cx.summary}\n`;
    content += `\n`;
  }

  if (data.lines && data.lines.length > 0) {
    content += `## 📝 Line-by-Line Explanation\n\n`;
    data.lines.forEach(item => {
      content += `**Line ${item.line}:** ${item.explanation}\n\n`;
    });
  }

  if (data.improvements && data.improvements.length > 0) {
    content += `## 🚀 Suggested Improvements\n\n`;
    data.improvements.forEach((imp, i) => {
      content += `### Improvement #${i + 1}: ${imp.title}\n\n`;
      if (imp.issue) content += `- **Issue:** ${imp.issue}\n`;
      if (imp.fix) content += `- **Fix:** ${imp.fix}\n`;
      if (imp.code && imp.code !== "N/A") {
        content += `\n**Example Code:**\n\`\`\`${(data.language || "").toLowerCase()}\n${imp.code}\n\`\`\`\n`;
      }
      content += `\n`;
    });
  }

  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `CodeExplain_Results.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --- Chat Logic ---
function renderChatHistory() {
  if (!chatHistoryEl) return;
  chatHistoryEl.innerHTML = state.chatHistory.map(msg => {
    let content = msg.content;
    
    if (msg.role !== 'user' && typeof marked !== 'undefined') {
      content = marked.parse(content, { breaks: true });
    } else {
      content = escapeHtml(content);
      content = content.replace(/\n/g, '<br>');
    }
    
    return `
      <div class="chat-bubble ${msg.role === 'user' ? 'user' : 'ai'}">
        <div class="chat-markdown">${content}</div>
      </div>
    `;
  }).join("");
  chatHistoryEl.scrollTop = chatHistoryEl.scrollHeight;
  
  // Highlight code blocks
  chatHistoryEl.querySelectorAll('pre code').forEach((block) => {
    try { hljs.highlightElement(block); } catch(e){}
  });
}

async function sendChatMessage() {
  if (!chatInput || !state.results || !state.results.code) return;
  const text = chatInput.value.trim();
  if (!text) return;

  // Add user msg
  state.chatHistory.push({ role: "user", content: text });
  chatInput.value = "";
  chatSendBtn.disabled = true;
  renderChatHistory();

  // Add a placeholder for AI
  const aiMsgIndex = state.chatHistory.length;
  state.chatHistory.push({ role: "assistant", content: "..." });
  renderChatHistory();

  const body = {
    code: state.results.code,
    language: state.results.language,
    explanation: state.results.explanation || "No previous explanation available.",
    history: state.chatHistory.slice(0, -1), // exclude the placeholder
    response_language: $("response-lang-select").value,
  };

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errData = await res.json().catch(()=>({}));
      const friendlyErr = getFriendlyError(errData.error || "Failed to get response.");
      state.chatHistory[aiMsgIndex].content = "❌ Error: " + friendlyErr;
      renderChatHistory();
      return;
    }

    state.chatHistory[aiMsgIndex].content = "";
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunkStr = decoder.decode(value, { stream: true });
      const events = chunkStr.split("\\n\\n");
      
      for (const ev of events) {
        if (!ev.trim() || !ev.startsWith("data: ")) continue;
        try {
          const data = JSON.parse(ev.substring(6));
          if (data.type === "chunk") {
            state.chatHistory[aiMsgIndex].content += data.text;
            renderChatHistory();
          } else if (data.type === "error") {
            const friendlyErr = getFriendlyError(data.error);
            state.chatHistory[aiMsgIndex].content += "\\n❌ " + friendlyErr;
            renderChatHistory();
          }
        } catch(e) {}
      }
    }
  } catch(e) {
    state.chatHistory[aiMsgIndex].content = "❌ Network error: " + e.message;
    renderChatHistory();
  }
}

// --- LeetCode Mode Logic ---
const leetcodeFetchBtn = $("leetcode-fetch-btn");
const leetcodeQuestionInput = $("leetcode-question-input");
const leetcodeLangSelect = $("leetcode-lang-select");
const leetcodeAnalyzingBanner = $("leetcode-analyzing-banner");
const leetcodeErrorBanner = $("leetcode-error-banner");
const leetcodeResultsArea = $("leetcode-results-area");
const leetcodeStagesContainer = $("leetcode-stages-container");
const leetcodeQuestionTitle = $("leetcode-question-title");

if (leetcodeFetchBtn) {
    leetcodeFetchBtn.addEventListener("click", runLeetCodeAnalysis);
}

async function runLeetCodeAnalysis() {
    const questionNumber = leetcodeQuestionInput.value.trim();
    if (!questionNumber) return;

    leetcodeErrorBanner.style.display = "none";
    leetcodeResultsArea.style.display = "none";
    leetcodeAnalyzingBanner.style.display = "flex";
    leetcodeFetchBtn.disabled = true;

    if ($("nav-link-leetcode-results")) $("nav-link-leetcode-results").style.display = "none";

    try {
        const res = await fetch("/api/leetcode", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                question_number: questionNumber,
                language: leetcodeLangSelect.value,
                response_language: $("response-lang-select") ? $("response-lang-select").value : "English"
            })
        });

        if (!res.ok) {
            const errData = await res.json().catch(()=>({}));
            throw new Error(errData.error || "Failed to analyze.");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let completeData = null;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunkStr = decoder.decode(value, { stream: true });
            const events = chunkStr.split("\n\n");
            
            for (const ev of events) {
                if (!ev.trim() || !ev.startsWith("data: ")) continue;
                try {
                    const data = JSON.parse(ev.substring(6));
                    if (data.type === "error") {
                        throw new Error(data.error);
                    } else if (data.type === "complete") {
                        completeData = data.data;
                    }
                } catch(e) {
                    if (e.message && e.message !== "Unexpected end of JSON input") throw e;
                }
            }
        }

        if (completeData) {
            state.leetcodeData = completeData;
            state.leetcodeChatHistory = [];
            renderLeetCodeChatHistory();
            renderLeetCodeResults(completeData);
        } else {
            throw new Error("No data received from the server.");
        }

    } catch (err) {
        leetcodeErrorBanner.textContent = err.message;
        leetcodeErrorBanner.style.display = "block";
    } finally {
        leetcodeAnalyzingBanner.style.display = "none";
        leetcodeFetchBtn.disabled = false;
    }
}

function renderLeetCodeResults(data) {
    leetcodeQuestionTitle.textContent = data.question_title || "LeetCode Solution";
    leetcodeStagesContainer.innerHTML = "";
    
    const subMenu = $("leetcode-sub-menu");
    if (subMenu) {
        subMenu.innerHTML = `<a href="#leetcode-input-card" class="nav-sub-item" onclick="document.querySelector('[data-view=\\'leetcode-view\\']').click()">Select Question</a>`;
    }

    // Render Question Description and Explanation
    if (data.question_description || data.question_explanation) {
        const qCard = document.createElement("div");
        qCard.className = "glass-card";
        qCard.style.marginBottom = "2rem";
        qCard.id = "leetcode-question-info";

        const qTitle = document.createElement("h3");
        qTitle.className = "leetcode-stage-title";
        qTitle.innerHTML = `<span class="icon">📝</span> Question Details`;
        qCard.appendChild(qTitle);

        if (data.question_description) {
            const desc = document.createElement("p");
            desc.style.marginBottom = "1rem";
            desc.style.color = "var(--text-primary)";
            desc.style.lineHeight = "1.6";
            desc.style.whiteSpace = "pre-wrap";
            desc.textContent = data.question_description;
            qCard.appendChild(desc);
        }

        if (data.question_explanation) {
            const exp = document.createElement("div");
            exp.style.padding = "1rem";
            exp.style.background = "var(--bg-mid)";
            exp.style.borderRadius = "var(--radius-sm)";
            exp.style.color = "var(--text-sec)";
            exp.innerHTML = `<strong>Simple Explanation:</strong><br/>${escapeHtml(data.question_explanation)}`;
            qCard.appendChild(exp);
        }
        
        leetcodeStagesContainer.appendChild(qCard);
        
        if (subMenu) {
            subMenu.innerHTML += `<a href="#leetcode-question-info" class="nav-sub-item" onclick="document.querySelector('[data-view=\\'leetcode-view\\']').click()">Question Info</a>`;
        }
    }
    
    let stageIndex = 1;
    // Render Brute Force
    if (data.brute_force) {
        const id = "leetcode-stage-" + stageIndex;
        leetcodeStagesContainer.appendChild(createLeetCodeStageEl(data.brute_force, id));
        if (subMenu) {
            subMenu.innerHTML += `<a href="#${id}" class="nav-sub-item" onclick="document.querySelector('[data-view=\\'leetcode-view\\']').click()">${escapeHtml(data.brute_force.stage_name || "Brute Force")}</a>`;
        }
        stageIndex++;
    }

    // Render Transitions and Optimizations
    if (data.optimizations && data.optimizations.length > 0) {
        for (let i = 0; i < data.optimizations.length; i++) {
            if (data.transitions && data.transitions[i]) {
                leetcodeStagesContainer.appendChild(createLeetCodeTransitionEl(data.transitions[i]));
            }
            const id = "leetcode-stage-" + stageIndex;
            leetcodeStagesContainer.appendChild(createLeetCodeStageEl(data.optimizations[i], id));
            if (subMenu) {
                subMenu.innerHTML += `<a href="#${id}" class="nav-sub-item" onclick="document.querySelector('[data-view=\\'leetcode-view\\']').click()">${escapeHtml(data.optimizations[i].stage_name || "Optimization " + (i+1))}</a>`;
            }
            stageIndex++;
        }
    }

    if (subMenu) {
        subMenu.innerHTML += `<a href="#leetcode-chat-container" class="nav-sub-item" onclick="document.querySelector('[data-view=\\'leetcode-view\\']').click()">Follow-Up Q&A</a>`;
    }

    leetcodeResultsArea.style.display = "block";
    
    // Highlight Code
    document.querySelectorAll('#leetcode-stages-container pre code').forEach((block) => {
        hljs.highlightElement(block);
    });
}

function createLeetCodeStageEl(stage, id) {
    const card = document.createElement("div");
    card.className = "glass-card";
    card.style.marginBottom = "2rem";
    if (id) card.id = id;

    const title = document.createElement("h3");
    title.className = "leetcode-stage-title";
    title.innerHTML = `<span class="icon">💻</span> ${escapeHtml(stage.stage_name || "Solution")}`;
    card.appendChild(title);

    if (stage.explanation) {
        const exp = document.createElement("p");
        exp.style.marginBottom = "1rem";
        exp.style.color = "var(--text-sec)";
        exp.style.lineHeight = "1.6";
        exp.textContent = stage.explanation;
        card.appendChild(exp);
    }

    if (stage.complexity) {
        const comp = document.createElement("div");
        comp.style.marginBottom = "1rem";
        comp.style.padding = "1rem";
        comp.style.background = "var(--bg-mid)";
        comp.style.borderRadius = "var(--radius-sm)";
        comp.innerHTML = `
            <div><strong>Time Complexity:</strong> <span style="color: var(--accent-sec);">${escapeHtml(stage.complexity.time || "")}</span></div>
            <div style="font-size: 0.9em; color: var(--text-sec); margin-bottom: 0.5rem;">${escapeHtml(stage.complexity.time_explanation || "")}</div>
            <div><strong>Space Complexity:</strong> <span style="color: var(--accent-pink);">${escapeHtml(stage.complexity.space || "")}</span></div>
            <div style="font-size: 0.9em; color: var(--text-sec);">${escapeHtml(stage.complexity.space_explanation || "")}</div>
        `;
        card.appendChild(comp);
    }

    if (stage.code) {
        const pre = document.createElement("pre");
        pre.style.margin = "1rem 0";
        pre.style.whiteSpace = "pre-wrap"; // ensure it wraps and newlines are respected
        pre.style.wordBreak = "break-word";
        const code = document.createElement("code");
        const lang = $("leetcode-lang-select") ? $("leetcode-lang-select").value.toLowerCase() : "python";
        code.className = "language-" + (lang === "c++" ? "cpp" : lang);
        code.textContent = stage.code;
        pre.appendChild(code);
        card.appendChild(pre);
    }

    if (stage.lines && stage.lines.length > 0) {
        const linesDiv = document.createElement("div");
        linesDiv.style.marginTop = "1rem";
        const linesTitle = document.createElement("h4");
        linesTitle.textContent = "Line-by-Line Breakdown";
        linesTitle.style.marginBottom = "0.5rem";
        linesTitle.style.color = "var(--text-main)";
        linesDiv.appendChild(linesTitle);

        stage.lines.forEach(l => {
            const row = document.createElement("div");
            row.style.display = "flex";
            row.style.gap = "1rem";
            row.style.marginBottom = "0.5rem";
            row.style.padding = "0.5rem";
            row.style.background = "var(--bg-deep)";
            row.style.borderRadius = "4px";
            row.innerHTML = `
                <div style="color: var(--accent-primary); font-family: 'JetBrains Mono', monospace; font-size: 0.9rem; min-width: 60px;">${escapeHtml(l.line)}</div>
                <div style="color: var(--text-sec); font-size: 0.95rem;">${escapeHtml(l.explanation)}</div>
            `;
            linesDiv.appendChild(row);
        });
        card.appendChild(linesDiv);
    }

    return card;
}

function createLeetCodeTransitionEl(text) {
    const banner = document.createElement("div");
    banner.className = "leetcode-transition-banner";
    banner.innerHTML = `
        <div class="leetcode-transition-icon">💡</div>
        <div class="leetcode-transition-content">
            <strong>Why optimize?</strong><br/>
            ${escapeHtml(text)}
        </div>
    `;
    return banner;
}

// --- LeetCode Chat Logic ---
const leetcodeChatInput = $("leetcode-chat-input");
const leetcodeChatSendBtn = $("leetcode-chat-send-btn");
const leetcodeChatHistoryEl = $("leetcode-chat-history");
const leetcodeChatContainer = $("leetcode-chat-container");
const leetcodeChatFullscreenBtn = $("leetcode-chat-fullscreen-btn");

if (leetcodeChatSendBtn) leetcodeChatSendBtn.addEventListener("click", sendLeetCodeChatMessage);
if (leetcodeChatInput) {
    leetcodeChatInput.addEventListener("input", () => {
        leetcodeChatSendBtn.disabled = leetcodeChatInput.value.trim().length === 0;
    });
    leetcodeChatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (!leetcodeChatSendBtn.disabled) sendLeetCodeChatMessage();
        }
    });
}
if (leetcodeChatFullscreenBtn) {
    leetcodeChatFullscreenBtn.addEventListener("click", () => {
        if (leetcodeChatContainer) {
            const isFullscreen = leetcodeChatContainer.classList.toggle("fullscreen");
            if (isFullscreen) {
                const placeholder = document.createElement("div");
                placeholder.id = "leetcode-chat-placeholder";
                leetcodeChatContainer.parentNode.insertBefore(placeholder, leetcodeChatContainer);
                document.body.appendChild(leetcodeChatContainer);
            } else {
                const placeholder = document.getElementById("leetcode-chat-placeholder");
                if (placeholder) {
                    placeholder.parentNode.insertBefore(leetcodeChatContainer, placeholder);
                    placeholder.remove();
                }
            }
            leetcodeChatFullscreenBtn.textContent = isFullscreen ? "🗗" : "⛶";
            leetcodeChatFullscreenBtn.title = isFullscreen ? "Exit Fullscreen" : "Toggle Fullscreen";
        }
    });
    
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && leetcodeChatContainer && leetcodeChatContainer.classList.contains("fullscreen")) {
            leetcodeChatContainer.classList.remove("fullscreen");
            const placeholder = document.getElementById("leetcode-chat-placeholder");
            if (placeholder) {
                placeholder.parentNode.insertBefore(leetcodeChatContainer, placeholder);
                placeholder.remove();
            }
            leetcodeChatFullscreenBtn.textContent = "⛶";
            leetcodeChatFullscreenBtn.title = "Toggle Fullscreen";
        }
    });
}

function renderLeetCodeChatHistory() {
    if (!leetcodeChatHistoryEl) return;
    leetcodeChatHistoryEl.innerHTML = state.leetcodeChatHistory.map(msg => {
        let content = msg.content;
        
        if (msg.role !== 'user' && typeof marked !== 'undefined') {
            content = marked.parse(content, { breaks: true });
        } else {
            content = escapeHtml(content);
            content = content.replace(/\n/g, '<br>');
        }
        
        return `
            <div class="chat-bubble ${msg.role === 'user' ? 'user' : 'ai'}">
                <div class="chat-markdown">${content}</div>
            </div>
        `;
    }).join("");
    leetcodeChatHistoryEl.scrollTop = leetcodeChatHistoryEl.scrollHeight;
    
    leetcodeChatHistoryEl.querySelectorAll('pre code').forEach((block) => {
        try { hljs.highlightElement(block); } catch(e){}
    });
}

async function sendLeetCodeChatMessage() {
    if (!leetcodeChatInput || !state.leetcodeData) return;
    const text = leetcodeChatInput.value.trim();
    if (!text) return;

    state.leetcodeChatHistory.push({ role: "user", content: text });
    leetcodeChatInput.value = "";
    leetcodeChatSendBtn.disabled = true;
    renderLeetCodeChatHistory();

    const aiMsgIndex = state.leetcodeChatHistory.length;
    state.leetcodeChatHistory.push({ role: "assistant", content: "..." });
    renderLeetCodeChatHistory();

    const body = {
        question_title: state.leetcodeData.question_title || "Unknown Question",
        question_description: state.leetcodeData.question_description || "",
        context_json_str: JSON.stringify(state.leetcodeData),
        history: state.leetcodeChatHistory.slice(0, -1),
        response_language: $("response-lang-select") ? $("response-lang-select").value : "English"
    };

    try {
        const res = await fetch("/api/leetcode_chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const errData = await res.json().catch(()=>({}));
            const friendlyErr = getFriendlyError(errData.error || "Failed to get response.");
            state.leetcodeChatHistory[aiMsgIndex].content = "❌ Error: " + friendlyErr;
            renderLeetCodeChatHistory();
            return;
        }

        state.leetcodeChatHistory[aiMsgIndex].content = "";
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunkStr = decoder.decode(value, { stream: true });
            const events = chunkStr.split("\n\n");
            
            for (const ev of events) {
                if (!ev.trim() || !ev.startsWith("data: ")) continue;
                try {
                    const data = JSON.parse(ev.substring(6));
                    if (data.type === "chunk") {
                        state.leetcodeChatHistory[aiMsgIndex].content += data.text;
                        renderLeetCodeChatHistory();
                    } else if (data.type === "error") {
                        const friendlyErr = getFriendlyError(data.error);
                        state.leetcodeChatHistory[aiMsgIndex].content += "\n❌ " + friendlyErr;
                        renderLeetCodeChatHistory();
                    }
                } catch(e) {}
            }
        }
    } catch(e) {
        state.leetcodeChatHistory[aiMsgIndex].content = "❌ Network error: " + e.message;
        renderLeetCodeChatHistory();
    }
}

// --- GitHub Repository Analysis Logic ---
state.githubContext = "";
state.githubChatHistory = [];

const githubUrlInput = $("github-url-input");
const githubAnalyzeBtn = $("github-analyze-btn");
const githubAnalyzingBanner = $("github-analyzing-banner");
const githubErrorBanner = $("github-error-banner");
const githubResultsArea = $("github-results-area");
const githubOverviewContainer = $("github-overview-container");

const githubChatInput = $("github-chat-input");
const githubChatSendBtn = $("github-chat-send-btn");
const githubChatHistoryEl = $("github-chat-history");
const githubChatContainer = $("github-chat-container");
const githubChatFullscreenBtn = $("github-chat-fullscreen-btn");

if (githubAnalyzeBtn) {
    githubAnalyzeBtn.addEventListener("click", runGithubAnalysis);
}

function renderGithubStats(repoData) {
    const statsContainer = $("github-repo-stats");
    if (!statsContainer) return;
    
    const stars = repoData.stargazers_count || 0;
    const forks = repoData.forks_count || 0;
    const issues = repoData.open_issues_count || 0;
    const lang = repoData.language || "Unknown";
    const license = repoData.license ? repoData.license.spdx_id : "No License";
    
    statsContainer.innerHTML = `
        <div class="github-stat-chip">⭐ Stars: <span>${stars.toLocaleString()}</span></div>
        <div class="github-stat-chip">🍴 Forks: <span>${forks.toLocaleString()}</span></div>
        <div class="github-stat-chip">🐛 Issues: <span>${issues.toLocaleString()}</span></div>
        <div class="github-stat-chip">🔤 Language: <span>${lang}</span></div>
        <div class="github-stat-chip">📜 License: <span>${license}</span></div>
    `;
    statsContainer.style.display = "flex";
}

async function fetchGithubFileTree(url) {
    const sidebar = $("github-file-tree-sidebar");
    if (!sidebar) return;
    
    sidebar.innerHTML = '<div style="padding: 1rem; color: var(--text-sec); text-align: center;">Fetching file tree...</div>';
    
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
        sidebar.innerHTML = '<div style="padding: 1rem; color: var(--text-sec); text-align: center;">Invalid GitHub URL</div>';
        return;
    }
    
    const owner = match[1];
    let repo = match[2];
    if (repo.endsWith('.git')) repo = repo.slice(0, -4);
    
    try {
        const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
        if (!repoRes.ok) throw new Error("Repo fetch failed");
        const repoData = await repoRes.json();
        renderGithubStats(repoData);
        const branch = repoData.default_branch || 'main';
        
        const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);
        if (!treeRes.ok) throw new Error("Tree fetch failed");
        const treeData = await treeRes.json();
        
        renderFileTree(treeData.tree, sidebar, repo);
    } catch (e) {
        sidebar.innerHTML = `<div style="padding: 1rem; color: #ff5555; text-align: center;">Failed to load file tree.</div>`;
    }
}

function renderFileTree(flatTree, container, repoName) {
    // Build nested structure
    const root = { name: repoName, type: 'tree', children: {} };
    
    for (const item of flatTree) {
        const parts = item.path.split('/');
        let current = root;
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (!current.children[part]) {
                current.children[part] = { 
                    name: part, 
                    type: i === parts.length - 1 ? item.type : 'tree', 
                    children: {} 
                };
            }
            current = current.children[part];
        }
    }
    
    // Sort tree (folders first, then files, alphabetically)
    function sortTree(node) {
        const sortedChildren = Object.values(node.children).sort((a, b) => {
            if (a.type === 'tree' && b.type !== 'tree') return -1;
            if (a.type !== 'tree' && b.type === 'tree') return 1;
            return a.name.localeCompare(b.name);
        });
        node.sortedChildren = sortedChildren;
        for (const child of sortedChildren) {
            if (child.type === 'tree') sortTree(child);
        }
    }
    sortTree(root);
    
    // Create DOM recursively
    function createDOM(node, isRoot = false) {
        const ul = document.createElement('ul');
        ul.className = isRoot ? 'file-tree-list root-list' : 'file-tree-list';
        
        for (const child of node.sortedChildren) {
            const li = document.createElement('li');
            li.className = 'file-tree-item';
            
            const content = document.createElement('div');
            content.className = 'file-tree-content';
            
            const icon = document.createElement('span');
            icon.className = 'file-tree-icon';
            
            // Map common file types to icons
            let iconStr = '📄';
            if (child.type === 'tree') {
                iconStr = '📁';
            } else {
                const ext = child.name.split('.').pop().toLowerCase();
                const iconMap = {
                    'js': '🟨', 'jsx': '⚛️', 'ts': '🟦', 'tsx': '⚛️',
                    'py': '🐍', 'html': '🌐', 'css': '🎨', 'json': '📋',
                    'md': '📝', 'go': '🐹', 'java': '☕', 'cpp': '⚙️',
                    'c': '⚙️', 'rs': '🦀', 'rb': '💎', 'php': '🐘',
                    'yml': '🔧', 'yaml': '🔧', 'xml': '📋', 'svg': '🖼️',
                    'png': '🖼️', 'jpg': '🖼️', 'jpeg': '🖼️', 'gif': '🖼️',
                };
                iconStr = iconMap[ext] || '📄';
            }
            icon.textContent = iconStr;
            
            const text = document.createElement('span');
            text.textContent = child.name;
            
            content.appendChild(icon);
            content.appendChild(text);
            li.appendChild(content);
            
            if (child.type === 'tree') {
                li.classList.add('file-tree-folder');
                const childrenDOM = createDOM(child);
                // Collapse directories by default if not root level
                if (!isRoot) {
                    childrenDOM.style.display = 'none';
                } else {
                    icon.textContent = '📂'; // open folder icon for top level
                }
                li.appendChild(childrenDOM);
                
                content.addEventListener('click', (e) => {
                    e.stopPropagation();
                    childrenDOM.style.display = childrenDOM.style.display === 'none' ? 'block' : 'none';
                    icon.textContent = childrenDOM.style.display === 'none' ? '📁' : '📂';
                });
            }
            ul.appendChild(li);
        }
        return ul;
    }
    
    container.innerHTML = `<h3 style="margin-top: 0; color: var(--text-main); border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem;"><span style="font-size: 1.2rem;">🐙</span> ${repoName}</h3>`;
    container.appendChild(createDOM(root, true));
}

async function runGithubAnalysis() {
    const url = githubUrlInput ? githubUrlInput.value.trim() : "";
    if (!url.startsWith("https://github.com/")) {
        if (githubErrorBanner) {
            githubErrorBanner.textContent = "Please enter a valid GitHub repository URL.";
            githubErrorBanner.style.display = "block";
        }
        return;
    }

    if (githubErrorBanner) githubErrorBanner.style.display = "none";
    if (githubResultsArea) githubResultsArea.style.display = "none";
    if (githubAnalyzingBanner) githubAnalyzingBanner.style.display = "flex";
    if (githubAnalyzeBtn) githubAnalyzeBtn.disabled = true;

    // Start fetching file tree asynchronously
    fetchGithubFileTree(url);

    if (githubOverviewContainer) githubOverviewContainer.innerHTML = "";
    state.githubContext = "";
    state.githubChatHistory = [];
    renderGithubChatHistory();

    try {
        const body = {
            url: url,
            response_language: $("response-lang-select") ? $("response-lang-select").value : "English"
        };
        const res = await fetch("/api/github_analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const errData = await res.json().catch(()=>({}));
            throw new Error(errData.error || "Failed to analyze repository.");
        }

        if (githubAnalyzingBanner) githubAnalyzingBanner.style.display = "none";
        if (githubResultsArea) githubResultsArea.style.display = "block";
        
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        
        let markdownText = "";
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const events = buffer.split("\n\n");
            buffer = events.pop();
            
            for (const ev of events) {
                if (!ev.trim() || !ev.startsWith("data: ")) continue;
                let data;
                try {
                    data = JSON.parse(ev.substring(6));
                } catch(e) { continue; }
                
                if (data.type === "context") {
                    state.githubContext = data.repo_context;
                } else if (data.type === "chunk") {
                    markdownText += data.text;
                    if (typeof marked !== 'undefined' && githubOverviewContainer) {
                        githubOverviewContainer.innerHTML = marked.parse(markdownText, { breaks: true });
                        githubOverviewContainer.querySelectorAll('pre code').forEach((block) => {
                            try { hljs.highlightElement(block); } catch(e){}
                        });
                    }
                } else if (data.type === "error") {
                    throw new Error(data.error);
                }
            }
        }
    } catch (e) {
        if (githubAnalyzingBanner) githubAnalyzingBanner.style.display = "none";
        if (githubErrorBanner) {
            githubErrorBanner.textContent = "❌ " + e.message;
            githubErrorBanner.style.display = "block";
        }
    } finally {
        if (githubAnalyzeBtn) githubAnalyzeBtn.disabled = false;
    }
}

// GitHub Chat
if (githubChatSendBtn) githubChatSendBtn.addEventListener("click", sendGithubChatMessage);
if (githubChatInput) {
    githubChatInput.addEventListener("input", () => {
        githubChatSendBtn.disabled = githubChatInput.value.trim().length === 0;
    });
    githubChatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (!githubChatSendBtn.disabled) sendGithubChatMessage();
        }
    });
}
if (githubChatFullscreenBtn) {
    githubChatFullscreenBtn.addEventListener("click", () => {
        if (githubChatContainer) {
            const isFullscreen = githubChatContainer.classList.toggle("fullscreen");
            if (isFullscreen) {
                const placeholder = document.createElement("div");
                placeholder.id = "github-chat-placeholder";
                githubChatContainer.parentNode.insertBefore(placeholder, githubChatContainer);
                document.body.appendChild(githubChatContainer);
            } else {
                const placeholder = document.getElementById("github-chat-placeholder");
                if (placeholder) {
                    placeholder.parentNode.insertBefore(githubChatContainer, placeholder);
                    placeholder.remove();
                }
            }
            githubChatFullscreenBtn.textContent = isFullscreen ? "🗗" : "⛶";
            githubChatFullscreenBtn.title = isFullscreen ? "Exit Fullscreen" : "Toggle Fullscreen";
        }
    });
    
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && githubChatContainer && githubChatContainer.classList.contains("fullscreen")) {
            githubChatContainer.classList.remove("fullscreen");
            const placeholder = document.getElementById("github-chat-placeholder");
            if (placeholder) {
                placeholder.parentNode.insertBefore(githubChatContainer, placeholder);
                placeholder.remove();
            }
            githubChatFullscreenBtn.textContent = "⛶";
            githubChatFullscreenBtn.title = "Toggle Fullscreen";
        }
    });
}

function renderGithubChatHistory() {
    if (!githubChatHistoryEl) return;
    githubChatHistoryEl.innerHTML = state.githubChatHistory.map(msg => {
        let content = msg.content;
        
        if (msg.role !== 'user' && typeof marked !== 'undefined') {
            content = marked.parse(content, { breaks: true });
        } else {
            content = escapeHtml(content);
            content = content.replace(/\n/g, '<br>');
        }
        
        return `
            <div class="chat-bubble ${msg.role === 'user' ? 'user' : 'ai'}">
                <div class="chat-markdown">${content}</div>
            </div>
        `;
    }).join("");
    githubChatHistoryEl.scrollTop = githubChatHistoryEl.scrollHeight;
    
    githubChatHistoryEl.querySelectorAll('pre code').forEach((block) => {
        try { hljs.highlightElement(block); } catch(e){}
    });
}

async function sendGithubChatMessage() {
    if (!githubChatInput || !state.githubContext) return;
    const text = githubChatInput.value.trim();
    if (!text) return;

    state.githubChatHistory.push({ role: "user", content: text });
    githubChatInput.value = "";
    githubChatSendBtn.disabled = true;
    renderGithubChatHistory();

    const aiMsgIndex = state.githubChatHistory.length;
    state.githubChatHistory.push({ role: "assistant", content: "..." });
    renderGithubChatHistory();

    const body = {
        repo_context: state.githubContext,
        history: state.githubChatHistory.slice(0, -1),
        response_language: $("response-lang-select") ? $("response-lang-select").value : "English"
    };

    try {
        const res = await fetch("/api/github_chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const errData = await res.json().catch(()=>({}));
            const friendlyErr = getFriendlyError(errData.error || "Failed to get response.");
            state.githubChatHistory[aiMsgIndex].content = "❌ Error: " + friendlyErr;
            renderGithubChatHistory();
            return;
        }

        state.githubChatHistory[aiMsgIndex].content = "";
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        
        let buffer = "";
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const events = buffer.split("\n\n");
            buffer = events.pop();
            
            for (const ev of events) {
                if (!ev.trim() || !ev.startsWith("data: ")) continue;
                try {
                    const data = JSON.parse(ev.substring(6));
                    if (data.type === "chunk") {
                        state.githubChatHistory[aiMsgIndex].content += data.text;
                        renderGithubChatHistory();
                    } else if (data.type === "error") {
                        const friendlyErr = getFriendlyError(data.error);
                        state.githubChatHistory[aiMsgIndex].content += "\n❌ " + friendlyErr;
                        renderGithubChatHistory();
                    }
                } catch(e) {}
            }
        }
    } catch(e) {
        state.githubChatHistory[aiMsgIndex].content = "❌ Network error: " + e.message;
        renderGithubChatHistory();
    }
}

document.addEventListener("DOMContentLoaded", init);
