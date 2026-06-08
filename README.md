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
- Chat with Paper using stored extracted PDF text, context-aware Gemini prompts, saved conversation history, suggested questions, and cited source chunks
- Cloudinary-backed PDF storage with permanent file URLs, preview/download actions, file-size metadata, and synchronized cloud deletion
- Dedicated Analytics tab with upload trends, research activity insights, summary/analysis coverage, recent activity, and paper statistics
- User registration, login, JWT sessions, and private per-user paper libraries
- User profile page with account details, uploaded-paper count, avatar navigation, and logout
- Saved activity history with a Dashboard timeline for uploads, summaries, analyses, deletes, login, and registration
- Premium AI workspace UI with dark mode, notification center, animated dashboard hero, glassmorphism stats, modern paper cards, and export activity tracking

### Planned Features
- Flashcard Generation
- Quiz Generation
- Research Roadmap Generation

---

## Tech Stack

### Frontend
- React
- Vite
- Tailwind CSS
- Recharts

### Backend
- Node.js
- Express.js
- Mongoose
- JSON Web Tokens
- bcrypt

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

Required backend environment variables include:

- `MONGODB_URI`
- `GEMINI_API_KEY`
- `JWT_SECRET`
- `JWT_EXPIRES_IN` (defaults to `7d`)
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

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
- [x] Analytics & Insights Dashboard
- [x] Authentication
- [x] Chat with Paper
- [x] Cloud PDF Storage
- [x] User Profile & Account Management
- [x] Saved Analysis History & Recent Activity Timeline
- [x] Premium AI Research Workspace
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

All saved-paper APIs require a Bearer token and return only papers owned by the authenticated user.

Saved paper records include cloud file metadata for new uploads:

```json
{
  "originalFilename": "paper.pdf",
  "cloudinaryPublicId": "paperlens/...",
  "fileUrl": "https://res.cloudinary.com/...",
  "fileSize": 1234567,
  "uploadDate": "..."
}
```

Older papers without `cloudinaryPublicId` or `fileUrl` remain readable in the dashboard. PDF preview and download buttons are shown only when a cloud URL exists.

---

## Cloud PDF Storage

PaperLens stores uploaded PDFs in Cloudinary so files remain available after deployment.

### Cloudinary Setup

1. Create a Cloudinary account.
2. Copy the Cloud name, API key, and API secret from the Cloudinary dashboard.
3. Add them to `backend/.env`:

```env
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

### Upload Architecture

```text
User -> Backend memory upload -> PDF validation -> pdf-parse text extraction -> Cloudinary raw upload -> MongoDB metadata save
```

The backend accepts only `application/pdf` files and limits uploads to 20MB. The reusable Cloudinary upload service returns `cloudinaryPublicId`, `secureUrl`, `fileUrl`, `originalFilename`, `fileSize`, and `uploadDate`.

When a paper is deleted, the backend validates ownership, deletes the Cloudinary raw file when `cloudinaryPublicId` is present, and then removes the MongoDB record. Existing local-only records skip cloud deletion and continue to work.

Dashboard and paper detail views show PDF size plus View PDF and Download PDF buttons for cloud-backed files.

---

## Authentication API

`POST /api/auth/register` creates a user account and returns `{ user, token }`.

Required fields:

- `name`
- `email`
- `password`
- `confirmPassword`

`POST /api/auth/login` validates credentials and returns `{ user, token }`.

`GET /api/auth/me` validates the current JWT and returns the authenticated user's public profile:

```json
{
  "user": {
    "id": "...",
    "name": "Ada Lovelace",
    "email": "ada@example.com",
    "createdAt": "..."
  }
}
```

Passwords are hashed with bcrypt before storage. JWTs are signed with `JWT_SECRET` and expire according to `JWT_EXPIRES_IN`.

Protected backend routes return `401 Unauthorized` when the token is missing, invalid, or expired:

- `GET /api/auth/me`
- `POST /api/upload`
- `POST /api/summarize`
- `POST /api/analyze`
- `POST /api/papers/upload`
- `POST /api/papers/summary`
- `POST /api/papers/analyze`
- `GET /api/papers`
- `POST /api/papers`
- `GET /api/papers/:id`
- `PUT /api/papers/:id`
- `DELETE /api/papers/:id`
- `GET /api/analytics`
- `GET /api/activities`
- `GET /api/chat/:paperId`
- `POST /api/chat/:paperId`

The React app stores the JWT for refresh persistence, restores the user with `/api/auth/me`, and redirects unauthenticated users to `/login` before showing `/dashboard`, `/upload`, `/analytics`, `/profile`, or `/chat/:paperId`.

The Profile page at `/profile` displays the authenticated user's name, email, account creation date, and number of uploaded papers. The navbar profile button opens this page, and the Logout button clears the stored JWT/user session and redirects to `/login`.

---

## Recent Activity API

`GET /api/activities` returns the authenticated user's latest activity records sorted newest first.

Supported activity types:

- `pdf_uploaded`
- `paper_summarized`
- `paper_analyzed`
- `paper_deleted`
- `chat_completed`
- `export_generated`
- `login`
- `registration`

Each activity contains:

```json
{
  "_id": "...",
  "type": "paper_analyzed",
  "title": "Attention Is All You Need",
  "timestamp": "...",
  "metadata": {
    "paperId": "...",
    "domain": "Machine Learning",
    "difficulty": "Intermediate"
  }
}
```

The endpoint accepts an optional `limit` query parameter, defaults to `12`, and caps results at `50`.

Activity records are stored in MongoDB and scoped by `userId`. PaperLens records activities when users register, log in, upload PDFs, generate summaries, generate analyses, complete chats, generate exports, or delete papers.

The Dashboard includes a Recent Activity timeline with activity icons, descriptions, relative timestamps, loading state, empty state, retry support, and automatic refresh after upload, analysis, and delete flows.

---

## Premium Workspace UI

PaperLens uses a SaaS-style workspace shell with:

- Desktop sidebar and mobile tab navigation for Dashboard, Upload, Analytics, Chat, Activity, and Profile
- Notification bell with unread badge, dropdown panel, mark-as-read, and clear actions
- Persisted dark mode toggle using `localStorage`
- Premium Dashboard hero: "Welcome back, <User Name>", "Research Smarter with AI", and an animated gradient background
- Glassmorphism statistic cards for total papers, chats, analyses, and exports
- Modern saved-paper cards with upload date, animated analysis status badges, hover motion, quick View, Chat, Export, and Delete actions
- Dedicated Activity page for full timeline history
- Smooth transitions, skeleton loaders, toast feedback, and responsive layouts

The frontend design system defines primary, secondary, accent, success, warning, and error colors through CSS variables and dark-mode variants.

---

## Chat With Paper

PaperLens includes a protected chat page at `/chat/:paperId`.

### Chat Architecture

1. The frontend loads saved chat history with `GET /api/chat/:paperId`.
2. When a user asks a question, the backend validates the authenticated user's ownership of the paper.
3. The backend retrieves the stored `extractedText` from MongoDB, splits it into overlapping text chunks, ranks chunks by question relevance, and sends only the best chunks to Gemini.
4. Gemini is prompted to answer only from the provided paper content and return JSON containing an answer plus supporting sources.
5. The backend stores both the user question and assistant answer in MongoDB, including source chunk citations.
6. The frontend displays user messages on the right, AI messages on the left, source snippets under answers, a typing indicator while Gemini responds, and suggested quick questions.

### Chat API

`GET /api/chat/:paperId` returns the selected paper title and previous messages:

```json
{
  "paper": { "_id": "...", "title": "..." },
  "messages": [
    {
      "role": "assistant",
      "content": "...",
      "sources": [{ "chunkId": 1, "page": 2, "snippet": "..." }],
      "timestamp": "..."
    }
  ]
}
```

`POST /api/chat/:paperId` accepts:

```json
{
  "question": "What methodology was used in this paper?"
}
```

It returns:

```json
{
  "answer": "...",
  "sources": [{ "chunkId": 1, "page": 2, "snippet": "..." }]
}
```

Errors are returned for empty questions, missing extracted paper text, inaccessible papers, and Gemini failures.

### Chat Data Model

Chats are stored in MongoDB with one conversation per user and paper:

```json
{
  "userId": "...",
  "paperId": "...",
  "messages": [
    {
      "role": "user",
      "content": "What methodology was used?",
      "timestamp": "..."
    },
    {
      "role": "assistant",
      "content": "...",
      "sources": [{ "chunkId": 3, "page": 4, "snippet": "..." }],
      "timestamp": "..."
    }
  ]
}
```

---

## Analytics API

`GET /api/analytics` returns research activity metrics and chart data:

- `totalPapers`, `totalSummaries`, `totalAnalyses`
- `totalChats`, `totalQuestionsAsked`, `mostActivePapers`
- `uploadsThisWeek`, `uploadsThisMonth`, `latestUpload`
- `averageUploadsPerWeek`, `averagePaperLength`, `oldestUpload`
- `summaryAnalysisMetrics` with summary, analysis, and pending-analysis counts and percentages
- `recentUploads` limited to the latest 5 papers with summary/analysis status flags
- `uploadTrends.last7Days`, `uploadTrends.last30Days`, and `uploadTrends.weekly`

The endpoint uses MongoDB aggregation facets to keep the analytics response compact and avoid fetching unnecessary paper fields. Newly saved papers store `pageCount` and `wordCount` so dashboard statistics can be queried efficiently.

---

## Analytics Page

The frontend Analytics tab includes:

- Overview cards for uploaded papers, generated summaries, generated analyses, weekly uploads, monthly uploads, and most recent upload date
- Chat activity cards for total chats and questions asked
- Responsive Recharts visualizations for last 7 days and last 30 days upload trends
- Summary vs analysis metric cards and chart
- Most active papers by chat question count
- Recent activity list for the latest 5 uploaded papers
- Search insights showing current result count against the total library count
- Skeleton loaders, user-friendly errors, and retry support

Screenshots are not currently checked into the repository.

---

## Future Improvements

- Multi-paper comparison
- Citation generation
- Mind map visualization
- Research trend analysis

---

## Author

Radhika Dwivedi
