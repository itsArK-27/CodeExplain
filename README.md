# 🔮 CodeExplain — Plain-English Code Tutor

> **Project 4** from the AI Engineer Launchpad · Built with Python, Flask & Groq API

---

## 🌟 Features

| Feature | Description |
|---------|-------------|
| 💬 **Plain-English Explanation** | Understand code like you're reading a story |
| ⏱️ **Complexity Analysis** | Time & space complexity with best/worst/average cases |
| 📝 **Line-by-Line Commentary** | Every line explained in plain English |
| 🚀 **Smart Improvements** | Actionable suggestions for cleaner, faster code |
| 🧠 **Quiz Mode** | Auto-generated comprehension questions with scoring |
| 🌐 **Multi-Language** | Python, JavaScript, Java, C++, Go, Rust, and more |

## 🎨 UI Highlights
- **Immersive 3D design** with glassmorphism panels
- **Particle animation** background with connecting lines
- **Mouse-parallax** — cards tilt to follow your cursor
- **Click ripple** effects on every interaction
- **Floating glow orbs** for depth and atmosphere

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd self/CodeExplain
pip install -r requirements.txt
```

### 2. Set Up API Key
```bash
# Copy the template
copy .env.example .env

# Edit .env and add your key:
# GROQ_API_KEY=your_key_here
```
> 🔑 Get a **free** Gemini API key at: https://console.groq.com/keys

### 3. Run the App
```bash
python server.py
```

The app opens at **http://localhost:5000**

---

## 📁 Project Structure

```
CodeExplain/
├── app.py              # Main Streamlit application
├── llm_engine.py       # Google Gemini API integration
├── prompts.py          # All LLM prompt templates
├── quiz_engine.py      # Quiz mode state & rendering
├── utils.py            # Language detection & helpers
├── styles/
│   └── main.css        # 3D immersive CSS
├── requirements.txt    # Python dependencies
├── .env.example        # API key template
└── README.md           # This file
```

---

## 🎯 Project Outcomes

1. **✅ Multi-language support** — Explains snippets in Python, JavaScript, Java, C++, Go, Rust, and more with accurate Big-O complexity analysis
2. **✅ Structured consistent output** — Four clearly separated sections (Explanation / Complexity / Line-by-Line / Improvements) stay consistent across any input
3. **✅ Quiz Mode** — Generates 5 comprehension questions (MCQ + True/False) with scoring, feedback, and retake option

---

## 🛠️ Tech Stack

- **Frontend**: Streamlit + Custom CSS/JS (3D, animations, particles)
- **LLM**: Groq LLaMA 3.3 70B
- **Language**: Python 3.10+
- **Libraries**: `groq`, `python-dotenv`, `flask`

---

## 💡 Usage Tips

- **Load a sample** from the sidebar to try without writing code
- **Auto-detect** language is enabled by default — or select manually
- **Toggle sections** in the sidebar to run only what you need
- **Quiz Mode** requires analysis to be run first
- Enter your API key directly in the sidebar (no need to edit .env)

---

## 📝 License
MIT — Free to use, modify, and distribute.


---

## 🚀 Future Improvements

## 2. UI & User Experience (UX)

The current UI is beautiful, but the interaction with code can be enhanced.

*   **Syntax Highlighting in Output**: The returned code in the "Line-by-Line" and "Improvements" tabs is currently plain text. Integrating a lightweight library like [PrismJS](https://prismjs.com/) or [Highlight.js](https://highlightjs.org/) would make the explanations much easier to read.
*   **Rich Code Editor Input**: Replace the plain `<textarea>` in `index.html` with a lightweight code editor library like [CodeMirror](https://codemirror.net/). This will give users live syntax highlighting, proper indentation, and line numbers as they type or paste.
*   **Copy to Clipboard**: Add a small "Copy" icon button to the code snippets and the generated explanations so users can easily extract the information.
*   **Streaming Responses**: The backend currently waits for the complete LLM response before sending it to the frontend. Implementing Server-Sent Events (SSE) and utilizing Groq's streaming capabilities would create a ChatGPT-like typing effect, significantly reducing perceived latency.

## 3. Backend Optimization & Reliability

> [!WARNING]
> **API Abuse Protection**
> Your Groq API key is used on the backend without any user authentication or rate limiting. If this app is deployed publicly, anyone could spam the `/api/analyze` endpoint and drain your API quota.

*   **Implement Rate Limiting**: Use a library like `Flask-Limiter` to restrict the number of requests a single IP address can make per minute.
*   **Response Caching**: Many users might try the built-in sample snippets. Implement caching (e.g., using `functools.lru_cache` or `Flask-Caching`) so that if the exact same code and language settings are requested, the backend returns the cached response instead of making another Groq API call.
*   **Granular Error Handling**: Currently, the server catches all exceptions and returns `{"error": str(e)}`. Categorizing errors (e.g., "Groq API Timeout", "Parsing Error", "Rate Limit Exceeded") with appropriate HTTP status codes (429, 502, etc.) allows the frontend to show more helpful recovery messages.

## 4. Frontend Code Quality (`app.js`)

> [!NOTE]
> **Modularization**
> `app.js` is nearly 800 lines long. While it works well, it will become difficult to maintain as you add more features.

*   **Split into ES6 Modules**: Consider breaking `app.js` into distinct files:
    *   `api.js`: Handles all `fetch()` calls to the backend.
    *   `ui.js`: Handles tab switching, DOM updates, and rendering HTML.
    *   `quiz.js`: Contains the quiz logic.
    *   `effects.js`: Contains the particle canvas and mouse parallax logic.
*   **Template Rendering**: Building HTML strings directly in JS (e.g., `renderExplanation`, `renderQuiz`) can be prone to typos and XSS vulnerabilities if `escapeHtml` is forgotten. In the future, a lightweight templating engine or framework (like Alpine.js) could make rendering much cleaner.
