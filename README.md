# 🚀 Spark Innovation Center

A full-stack, enterprise-grade application for managing the Spark Innovation Center. Built with **Next.js 14**, **FastAPI**, **PostgreSQL**, and **Docker**.

![Spark Dashboard](https://img.shields.io/badge/Status-Production_Ready-green) ![License](https://img.shields.io/badge/License-MIT-blue)

---

## ✨ Features

### 🔐 Authentication & Security
- JWT Access/Refresh Tokens
- Role-Based Access Control (RBAC) – Super Admin, Admin, Faculty, Mentor, Student
- Password hashing (bcrypt)
- Google OAuth integration (scaffolded)
- Email OTP verification (scaffolded)
- CORS configuration
- API rate limiting ready

### 📊 Dashboard
- Real-time statistics cards
- Chart.js analytics (Line, Bar, Doughnut charts)
- Recent activities timeline
- Upcoming events feed
- AI Insights panel

### 👨‍🎓 Student Module
- Student profiles with skills, resume, certificates
- Innovation Score tracking
- Department-wise filtering and search
- Paginated table with sorting

### 📁 Project Management
- Project CRUD with status tracking
- Progress visualization
- Grid and Table views
- Tech stack tagging
- Team and mentor assignment

### 📅 Event Management
- Workshop, Hackathon, Seminar, Competition, Guest Lecture support
- Event registration system
- QR-based attendance (scaffolded)
- Certificate generation
- Calendar and gallery views

### 🔔 Notifications
- Real-time notification bell
- Mark as read / mark all
- Event, project, certificate, and announcement types

### ⚙️ Admin Panel
- User management with role assignment
- Equipment tracking
- Activity logs
- System settings

### 🎨 Premium UI
- Light/Dark mode with smooth transitions
- Framer Motion animations
- Glassmorphism cards
- Responsive design (mobile-ready)
- Loading skeletons
- Toast notifications

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14, React 18, TypeScript, Tailwind CSS v3 |
| **UI** | Framer Motion, Chart.js, Lucide Icons, react-hot-toast |
| **State** | TanStack Query (React Query), React Hook Form |
| **Backend** | FastAPI, Python 3.12, Pydantic v2 |
| **ORM** | SQLAlchemy 2.0 |
| **Database** | PostgreSQL 16 (Docker) / SQLite (local dev) |
| **Auth** | JWT (python-jose), bcrypt (passlib) |
| **Deploy** | Docker, Docker Compose |

---

## 📁 Project Structure

```
Spark/
├── backend/
│   ├── app/
│   │   ├── core/           # Config, database, security
│   │   ├── models/         # SQLAlchemy ORM models
│   │   ├── schemas/        # Pydantic request/response schemas
│   │   ├── routes/         # API route handlers
│   │   └── main.py         # FastAPI application entry point
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── app/            # Next.js App Router pages
│   │   ├── components/     # Reusable UI components
│   │   ├── context/        # Auth & providers
│   │   ├── services/       # API service layer (Axios)
│   │   └── types/          # TypeScript definitions
│   ├── Dockerfile
│   ├── tailwind.config.js
│   └── package.json
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 🚀 Quick Start

### Option 1: Local Development (Recommended for getting started)

#### Backend
```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate     # Windows
# source venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Run server (auto-creates SQLite DB with demo data)
uvicorn app.main:app --reload --port 8000
```

#### Frontend
```bash
cd frontend

# Install dependencies
npm install

# Run dev server
npm run dev
```

📌 **Frontend**: http://localhost:3000
📌 **Backend API**: http://localhost:8000
📌 **API Docs (Swagger)**: http://localhost:8000/docs

### Option 2: Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

📌 **Frontend**: http://localhost:3000
📌 **Backend**: http://localhost:8000
📌 **pgAdmin**: http://localhost:5050

---

## 🔑 Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@spark.edu | Admin@123 |
| Student | arjun@spark.edu | spark@IC2024001 (default pattern: spark@{ic_number}) |

---

## 📡 API Endpoints

| Module | Endpoints |
|--------|-----------|
| **Auth** | `POST /api/auth/login`, `/register`, `/refresh`, `/logout`, `/me` |
| **Dashboard** | `GET /api/dashboard/stats`, `/charts/*`, `/recent-activities`, `/upcoming-events` |
| **Students** | `GET/POST /api/students`, `GET/PUT/DELETE /api/students/{id}` |
| **Projects** | `GET/POST /api/projects`, `GET/PUT/DELETE /api/projects/{id}` |
| **Events** | `GET/POST /api/events`, `POST /api/events/{id}/register`, `/attendance`, `/certificates` |
| **Users** | `GET /api/users`, `PUT /api/users/{id}`, `DELETE /api/users/{id}` |
| **Notifications** | `GET /api/notifications`, `/unread-count`, `PUT /{id}/read`, `/read-all` |
| **Equipment** | `GET/POST /api/equipment`, `PUT/DELETE /api/equipment/{id}` |

Full interactive docs at **http://localhost:8000/docs** (Swagger UI).

---

## 🗃 Database Schema

14 tables: `users`, `roles`, `students`, `faculty`, `mentors`, `projects`, `teams`, `team_members`, `events`, `registrations`, `attendance`, `certificates`, `notifications`, `equipment`, `activity_logs`

---

## 🔧 Environment Variables

See `.env.example` for all available configuration options.

---

## 📦 Deployment

### Production Build
```bash
# Frontend
cd frontend && npm run build && npm start

# Backend
uvicorn app.main:app --host 0.0.0.0 --port 8000

# Docker (recommended)
docker-compose -f docker-compose.yml up -d
```

### Production Checklist
- [ ] Change `SECRET_KEY` in `.env`
- [ ] Set `DEBUG=False`
- [ ] Use PostgreSQL (not SQLite)
- [ ] Configure HTTPS
- [ ] Set proper CORS origins
- [ ] Set up email service for notifications
- [ ] Add Google OAuth credentials

---

## 📄 License

MIT License – feel free to use and modify for your institution.
