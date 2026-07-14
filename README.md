# 🔮 CodeExplain — Plain-English Code Tutor

> **Project 4** from the AI Engineer Launchpad · Built with Python, Streamlit & Google Gemini API

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
# GEMINI_API_KEY=your_key_here
```
> 🔑 Get a **free** Gemini API key at: https://aistudio.google.com/app/apikey

### 3. Run the App
```bash
streamlit run app.py
```

The app opens at **http://localhost:8501**

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
- **LLM**: Google Gemini 1.5 Flash
- **Language**: Python 3.10+
- **Libraries**: `google-generativeai`, `python-dotenv`, `pygments`

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
