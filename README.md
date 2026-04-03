# Quiz Patente B 🚗

A fast, offline-ready quiz app to prepare for the Italian **Patente B** driving exam.  
Built with React + Vite. Runs in the browser or as a standalone Windows `.exe`.

---

## Features

- **7,139 official questions** updated to 2023, including 3,983 with road sign images
- **4 quiz modes** — Infinite, Normal, Ministerial Simulation, Review Errors
- **V / F buttons** with keyboard shortcuts (`←` Vero, `→` Falso)
- **Readiness score** — algorithm tracking accuracy, pass rate, category coverage, and questions seen
- **Per-question statistics** — tracks every question you've seen and how often you get it right
- **Session history** — last 15 sessions with date, mode, score
- **Category breakdown** — see which topics need more work
- Fully **offline** — no internet required after first load (Google Fonts aside)
- Works on **desktop and mobile**

---

## Quiz Modes

| Mode | Questions | Timer | Max Errors |
|------|-----------|-------|------------|
| Quiz Infinito | ∞ random | — | — |
| Quiz Normale | 30 random | — | — |
| Simulazione Ministeriale | 30 | 20 min | 3 |
| Ripassa Errori | Your wrong answers | — | — |

---

## Getting Started

### Browser (dev server)

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.  
If on a local network, other devices can connect via the IP shown on the home screen.

### Production build

```bash
npm run build
```

Output goes to `docs/` (configured for GitHub Pages).

### Windows `.exe`

```bash
npm run build:exe
```

Produces `QuizPatente.exe` — a self-contained desktop app, no install needed.

---

## Project Structure

```
quiz-patente/
├── src/
│   ├── App.jsx          # Main React app — all screens and logic
│   └── index.css        # Design system — earthy minimal theme
├── QuizPatenteB-main/
│   ├── quizPatenteB2023.json   # 7,139 questions
│   └── img_sign/               # Road sign images
├── docs/                # Built output (GitHub Pages)
├── server.js            # Express server (for .exe / LAN mode)
└── QuizPatente.exe      # Prebuilt Windows executable
```

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `←` | Vero (True) |
| `→` | Falso (False) |

---

## Tech Stack

- [React 18](https://react.dev/)
- [Vite 5](https://vitejs.dev/)
- [Playfair Display](https://fonts.google.com/specimen/Playfair+Display) + [DM Sans](https://fonts.google.com/specimen/DM+Sans) (Google Fonts)
- [pkg](https://github.com/vercel/pkg) — for `.exe` packaging

---

## Data Source

Questions from [Quiz Patente B 2023](https://github.com/raffaelecalza/quiz-patente-b) — 7,139 Vero/Falso questions from the official Italian motorisation database.
