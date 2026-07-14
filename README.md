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
> 🔑 Get a **free** Groq API key at: https://console.groq.com/keys

### 3. Run the App
```bash
python server.py
```

The app opens at **http://localhost:5000**

---

## 📁 Project Structure

```
CodeExplain/
├── server.py           # Main Flask backend application
├── llm_engine.py       # Groq API integration (Llama-3.3-70b-versatile)
├── prompts.py          # All LLM prompt templates
├── quiz_engine.py      # Quiz mode state & rendering
├── utils.py            # Language detection & helpers
├── static/             # Frontend assets served by Flask
│   ├── index.html      # Main HTML file with CodeMirror & Highlight.js
│   ├── app.css         # Immersive glassmorphism and 3D design styles
│   └── app.js          # Client-side UI interactions, SSE streaming, and quiz logic
├── requirements.txt    # Python dependencies
├── .env.example        # API key template
└── README.md           # This file
```

---

## 🎯 Project Outcomes

1. **✅ Multi-language support** — Explains snippets in Python, JavaScript, Java, C++, Go, Rust, and more with accurate Big-O complexity analysis.
2. **✅ Structured consistent output** — Four clearly separated sections (Explanation / Complexity / Line-by-Line / Improvements) stay consistent across any input.
3. **✅ Quiz Mode** — Generates 5 comprehension questions (MCQ + True/False) with scoring, feedback, and retake option.
4. **✅ SSE Streaming & Code Copying** — Stream responses live and copy code or explanations easily via copy-to-clipboard buttons.
5. **✅ Rich Syntax Editing & Highlighting** — Live coding via CodeMirror editor and rendered code highlighting using Highlight.js.

---

## 🛠️ Tech Stack

- **Frontend**: Vanilla HTML5, CSS3, JavaScript (CodeMirror 5, Highlight.js, canvas particles, glassmorphism, mouse-parallax tilt)
- **Backend**: Flask (Python) with Server-Sent Events (SSE) streaming support
- **LLM**: Groq LLaMA 3.3 70B (`llama-3.3-70b-versatile`)
- **Libraries**: `groq`, `python-dotenv`, `flask`, `gunicorn`

---

## 💡 Usage Tips

- **Load a sample** from the sidebar dropdown to try without writing code manually.
- **Auto-detect** language is enabled by default — or select manually from the topbar dropdown.
- **Toggle sections** in the sidebar to run only what you need (Explanation, Complexity, Line-by-Line, Improvements).
- **Quiz Mode** requires analysis to be run first.
- Make sure to set your `GROQ_API_KEY` in the `.env` file before starting the Flask server.

---

## 📝 License
MIT — Free to use, modify, and distribute.

---

## 🚀 Future Improvements

### 1. Backend Optimization & Reliability

> [!WARNING]
> **API Abuse Protection**
> The Groq API key is used on the backend without any user authentication or rate limiting. If this app is deployed publicly, anyone could spam the `/api/analyze` endpoint and drain your API quota.

*   **Implement Rate Limiting**: Use a library like `Flask-Limiter` to restrict the number of requests a single IP address can make per minute.
*   **Response Caching**: Implement caching (e.g., using `functools.lru_cache` or `Flask-Caching`) so that if the exact same code and language settings are requested, the backend returns the cached response instead of making another Groq API call.
*   **Granular Error Handling**: Categorize errors (e.g., "Groq API Timeout", "Parsing Error", "Rate Limit Exceeded") with appropriate HTTP status codes (429, 502, etc.) to allow the frontend to show more helpful recovery messages.

### 2. Frontend Code Quality & Maintenance

> [!NOTE]
> **Modularization**
> `app.js` is nearly 1000 lines long. While it works well, it will become difficult to maintain as you add more features.

*   **Split into ES6 Modules**: Consider breaking `app.js` into distinct files:
    *   `api.js`: Handles all `fetch()` calls to the backend.
    *   `ui.js`: Handles tab switching, DOM updates, and rendering HTML.
    *   `quiz.js`: Contains the quiz logic.
    *   `effects.js`: Contains the particle canvas and mouse parallax logic.
*   **Template Rendering**: Use a lightweight templating engine or reactive framework (like Alpine.js) to make UI rendering much cleaner and safer against potential injection/typo issues.

