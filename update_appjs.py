import re

with open('static/app.js', 'r', encoding='utf-8') as f:
    js = f.read()

# 1. Add CodeMirror global
js = js.replace('const codeInput     = $("code-input");', 'const codeInput     = $("code-input");\nlet editor = null;')

# 2. Update init to initialize editor
init_func = """async function init() {
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
    theme: "dracula",
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
"""
js = re.sub(r'async function init\(\) \{.*?\}', init_func, js, flags=re.DOTALL)

# 3. Update all codeInput.value accesses
js = js.replace('codeInput.value = sample;', 'setCode(sample);')
js = js.replace('codeInput.value = "";', 'setCode("");')
js = re.sub(r'const code = codeInput\.value;', 'const code = getCode();', js)
js = re.sub(r'code: codeInput\.value,', 'code: getCode(),', js)
js = js.replace('codeInput.addEventListener("input", updateStats);', '') # CodeMirror handles this now

# 4. Update langSelect to update CodeMirror mode
lang_change = """langSelect.addEventListener("change", () => {
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
  });"""
js = re.sub(r'langSelect\.addEventListener\("change", \(\) => \{.*?\}\);', lang_change, js, flags=re.DOTALL)

# 5. Update runAnalysis to handle streaming
run_analysis = """async function runAnalysis() {
  hideError();
  warnBanner.style.display = "none";
  resultsArea.style.display = "none";
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
            state.results = { ...data };
            if (data.truncated) warnBanner.style.display = "block";
            
            // Render the initial shell of the results area
            renderResultsShell(data);
          } 
          else if (data.type === "explanation_chunk") {
            explanationText += data.text;
            const expEl = document.getElementById("stream-explanation");
            if (expEl) expEl.textContent = explanationText;
          }
          else if (data.type === "complete") {
            // Merge complete data
            state.results = { ...state.results, ...data.data };
            state.results.explanation = explanationText;
            
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

function renderResultsShell(data) {
  resultsArea.style.display = "block";
  emptyState.style.display = "none";

  const now = new Date();
  resultLangBadge.textContent = `${data.language_icon || ""} ${data.language}`;
  resultTime.textContent = `Analysis complete · ${now.getHours().toString().padStart(2,"0")}:${now.getMinutes().toString().padStart(2,"0")}`;

  tabsBar.innerHTML = `<button class="tab-btn active" data-tab="explanation">💬 Explanation</button>`;
  tabPanels.innerHTML = `
    <div class="tab-panel active" data-tab="explanation">
      <div class="glass-card">
        <div class="section-title"><span class="icon">💬</span> Plain-English Explanation</div>
        <div class="section-divider"></div>
        <div class="explanation-text relative-container">
           <button class="copy-btn" onclick="copyText('stream-explanation')">📋 Copy</button>
           <div id="stream-explanation" style="white-space:pre-wrap; min-height: 50px;"></div>
        </div>
      </div>
    </div>
  `;
}

function copyText(id) {
  const el = document.getElementById(id);
  if (el) {
    navigator.clipboard.writeText(el.innerText || el.textContent);
    alert("Copied to clipboard!");
  }
}

function renderTabsComplete(data) {
  const tabs = [];
  if (data.explanation !== undefined)  tabs.push({ id: "explanation",  label: "💬 Explanation" });
  if (data.complexity !== undefined)   tabs.push({ id: "complexity",   label: "⏱️ Complexity" });
  if (data.lines !== undefined)        tabs.push({ id: "lines",        label: "📝 Line-by-Line" });
  if (data.improvements !== undefined) tabs.push({ id: "improvements", label: "🚀 Improvements" });

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
"""

js = re.sub(r'async function runAnalysis\(\) \{.*?(?=// ── Quiz ───────────────────────────────────────────────────────────────────────)', run_analysis + '\n\n', js, flags=re.DOTALL)
# Wait, replacing runAnalysis completely removes renderResults since renderResults is used in runAnalysis... wait.
# Oh, `renderResults` is below `runQuiz`. No it's defined around line 287.
# The regex above will replace from `runAnalysis` up to `// ── Quiz`. That means it replaces `runAnalysis`.
# What about `renderResults`? I can just replace `renderResults` with `renderTabsComplete`.
js = re.sub(r'function renderResults\(data\) \{.*?// ── Tab Renderers ──────────────────────────────────────────────────────────────', '// ── Tab Renderers ──────────────────────────────────────────────────────────────', js, flags=re.DOTALL)
# I also need to update runQuiz and clearAll that call renderResults(state.results) to call renderTabsComplete
js = js.replace('renderResults(state.results);', 'renderTabsComplete(state.results);')
js = js.replace('renderResults(data);', 'renderTabsComplete(data);')


# 6. Update renderExplanation to include copy button
exp = """function renderExplanation(data) {
  const text = data.explanation || "";
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  return `
    <div class="glass-card">
      <div class="section-title"><span class="icon">💬</span> Plain-English Explanation</div>
      <div class="section-divider"></div>
      <div class="explanation-text relative-container">
        <button class="copy-btn" onclick="copyText('exp-content')">📋 Copy</button>
        <div id="exp-content" style="white-space:pre-wrap;">${escapeHtml(text)}</div>
      </div>
      <a class="download-btn" href="${url}" download="codeexplain_explanation.txt">
        ⬇️ Download Explanation
      </a>
    </div>`;
}"""
js = re.sub(r'function renderExplanation\(data\) \{.*?(?=function complexityClass)', exp + '\n\n', js, flags=re.DOTALL)

# 7. Update renderImprovements to use Highlight.js
imp = """function renderImprovements(improvements) {
  if (!improvements || improvements.length === 0) {
    return `<div class="glass-card"><div class="section-title"><span class="icon">🚀</span> Improvements</div><div class="section-divider"></div><p style="color:var(--text-sec);text-align:center;padding:1rem">No improvements found — your code looks clean! 🎉</p></div>`;
  }
  const cards = improvements.map((imp, i) => {
    const codeBlock = (imp.code && imp.code.toUpperCase() !== "N/A")
      ? `<div class="relative-container" style="margin-top: 1rem;"><button class="copy-btn" onclick="navigator.clipboard.writeText(this.nextElementSibling.innerText); alert('Copied!')">📋</button><pre><code class="language-python">${escapeHtml(imp.code)}</code></pre></div>` : "";
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
}"""
js = re.sub(r'function renderImprovements\(improvements\) \{.*?(?=function renderQuiz)', imp + '\n\n', js, flags=re.DOTALL)

# 8. Update renderLines to use Highlight.js for the code view
lines = """function renderLines(data) {
  const items = data.lines || [];
  const codeText = data.code || "";
  
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

  let unmappedHtml = "";
  if (unmappedComments.length > 0) {
    unmappedHtml = `<div class="unmapped-comments" style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--glass-border);">
      <strong style="color:#fff;font-size:.9rem;margin-bottom:.6rem;display:block;">Additional Commentary</strong>
      ${unmappedComments.map(c => `<div class="line-comment-row"><div class="line-num-badge">${escapeHtml(String(c.line))}</div><div class="line-comment-text">${escapeHtml(c.explanation)}</div></div>`).join("")}
    </div>`;
  }

  // To combine Highlight.js with line-by-line comments, we just display the raw code in a pre/code block 
  // and list the comments below, or we manually build the lines. 
  // The original implementation manually built the lines. Let's just use Highlight.js on the whole block 
  // and list the comments nicely formatted.
  
  let commentsHtml = Object.entries(commentsByLine).sort((a,b) => parseInt(a[0]) - parseInt(b[0])).map(([line, text]) => 
     `<div class="line-comment-row"><div class="line-num-badge">Line ${line}</div><div class="line-comment-text">${escapeHtml(text)}</div></div>`
  ).join("");

  return `
    <div class="glass-card">
      <div class="section-title"><span class="icon">📝</span> Line-by-Line Commentary</div>
      <div class="section-divider"></div>
      
      <div class="relative-container" style="margin-bottom: 1.5rem;">
        <button class="copy-btn" onclick="navigator.clipboard.writeText(this.nextElementSibling.innerText); alert('Copied!')">📋</button>
        <pre><code class="language-${(data.language||'').toLowerCase()}">${escapeHtml(codeText)}</code></pre>
      </div>
      
      <div class="comments-section">
        <strong style="color:#fff;font-size:.9rem;margin-bottom:.6rem;display:block;">Line Commentary</strong>
        ${commentsHtml}
      </div>
      ${unmappedHtml}
    </div>`;
}"""
js = re.sub(r'function renderLines\(data\) \{.*?(?=function renderImprovements)', lambda m: lines + '\n\n', js, flags=re.DOTALL)


with open('static/app.js', 'w', encoding='utf-8') as f:
    f.write(js)
print("Updated static/app.js")
