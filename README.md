# PaperLens

Research Companion AI that helps users understand research papers through AI-powered summarization, question answering, flashcards, and quizzes.

---

## Features

### Current Features
- PDF Upload
- PDF Text Extraction
- AI Summarization with Gemini
- Paper Intelligence Layer with concepts, prerequisites, domain, difficulty, and learning path
- MongoDB-backed saved papers dashboard
- Saved paper search by title or file name
- Saved paper sorting by newest, oldest, A-Z, and Z-A

### Planned Features
- Chat with Paper
- Flashcard Generation
- Quiz Generation
- User Authentication
- Research Roadmap Generation

---

## Tech Stack

### Frontend
- React
- Vite
- Tailwind CSS

### Backend
- Node.js
- Express.js
- Mongoose

### Database
- MongoDB Atlas

### AI & NLP
- Gemini API
- ChromaDB (planned)

---

## Project Structure

PaperLens/
├── frontend/
├── backend/
├── docs/
├── README.md
└── PROGRESS.md

---

## Setup Instructions

### Clone Repository

git clone <repo-url>

### Frontend

cd frontend
npm install
npm run dev

### Backend

cd backend
npm install
npm start

---

## Development Roadmap

- [x] Project Setup
- [x] React Frontend
- [x] Backend Setup
- [x] PDF Upload
- [x] PDF Parsing
- [x] AI Summarization
- [x] Paper Intelligence Layer
- [x] Saved Papers Dashboard
- [x] Dashboard Search and Sorting
- [ ] Authentication
- [ ] Chat with Paper
- [ ] Flashcards
- [ ] Quiz Generator
- [ ] Deployment

---

## Saved Papers Dashboard API

`GET /api/papers` supports paginated dashboard queries:

- `search`: optional title or original file name search
- `sort`: `newest`, `oldest`, `title-asc`, or `title-desc`
- `page`: page number, defaults to `1`
- `limit`: page size, defaults to `12` and is capped at `50`

The response includes `papers` plus `pagination` metadata for efficient loading.

---

## Future Improvements

- Multi-paper comparison
- Citation generation
- Mind map visualization
- Research trend analysis

---

## Author

Radhika Dwivedi
