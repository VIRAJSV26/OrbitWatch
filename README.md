# OrbitWatch 🛰️ // Space Debris Collision Risk Intelligence Platform

OrbitWatch is a full-stack space debris collision risk intelligence platform featuring a futuristic, high-density HUD (Heads-Up Display) theme. The system tracks active satellites, dead spacecraft, and space debris, monitors close-approach (conjunction) risk levels, and models Kessler syndrome collision cascade chain reactions in real-time.

---

## 🏗️ System Architecture & Stack

- **Frontend:** Next.js 14 (App Router) + React + Tailwind CSS + TanStack React Query + Recharts.
- **3D Visualization:** Cesium.js + Resium for interactive, real-time client-side Keplerian orbits tracking.
- **Backend:** FastAPI (Python 3) + Uvicorn + Psycopg2 (connection pooling).
- **Database:** PostgreSQL with automated alert triggers, stored procedures, and recursive CTE indexing.
- **Data Ingestion:** Space-Track.org API crawler with built-in resilient mock seeder fallback (1,700 realistic space assets pre-seeded).

---

## 🔮 Design Token Specs (HUD theme)

OrbitWatch strictly implements a custom head-up display system defined in `DESIGN.md`:
- **Sharp Corners:** Strict 90-degree corner philosophy (`border-radius: 0px` globally).
- **Visual Grid:** Subtle `32px` square layout grids in the background.
- **Color tokens:**
  - Deep Navy Space BG: `#060d1a`
  - Primary Cyan Accent: `#00d4ff` (Safe/Operational)
  - Orange Warning Accent: `#ffa500` (Medium/High Risk)
  - Red Danger Accent: `#ff4b2b` (Critical Risk)
- **Typography:** `Inter` for UI layout, `JetBrains Mono` for coordinates, numeric telemetry, and clock widgets to prevent layout jitter on live updates.

---

## 🛠️ Getting Started & Launch Guide

### 1. Database Configuration
Ensure a local PostgreSQL server is active and accessible via port `5432`. Create the database:
```sql
CREATE DATABASE orbitwatch_db;
```
To build tables, trigger actions, views, and stored procedures:
```bash
psql -d orbitwatch_db -f database/schema.sql
```

### 2. Ingestion Pipeline & Backend Server
Configure backend environmental variables in `backend/.env`:
```ini
DB_URL=postgresql://postgres:postgres@localhost:5432/orbitwatch_db
SPACETRACK_EMAIL=your_email_here
SPACETRACK_PASSWORD=your_password_here
```
Install requirements and run database ingestion:
```bash
cd backend
pip install -r requirements.txt
python3 ingest.py
```
Start the FastAPI server:
```bash
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
- Health Check: `http://localhost:8000/api/health`
- Stats Check: `http://localhost:8000/api/stats`

### 3. Frontend App Dev Server
Run Next.js dev server:
```bash
cd frontend
npm install
npm run dev
```
Navigate to `http://localhost:3000` to interact with the platform.

---

## 🚦 Features & Screen Layouts

1. **HUD 3D Observation Deck (`/dashboard`):** Real-time count-up cards showing satellite stats, interactive 3D Earth globe plotting colored paths (Blue for Satellites, Red for Debris, Gray for Rocket Bodies), live-updating critical encounter cards, and stacked altitude shell histograms.
2. **Kessler Cascade Simulator (`/cascade`):** A custom target picker to select two objects and trigger a simulated collision, displaying staggered impact trees, glowing Bezier connection curves, and a retro scrolling terminal log.
3. **Conjunction Telemetry Logs (`/conjunctions`):** Table listing of close encounters, filtered by risk tier (ALL/LOW/MEDIUM/HIGH/CRITICAL) with a 30-second polling refresh rate.
4. **Polluter Leaderboard (`/leaderboard`):** Ranked polluter records with gold, silver, and bronze trophies and percentage contribution bars showing global contributors.
