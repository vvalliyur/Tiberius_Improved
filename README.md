# Poker Accounting System

A full-stack application for managing poker game accounting data with a React frontend (deployed on Vercel) and FastAPI backend.

## Project Structure

```
.
├── backend/           # FastAPI backend application
│   ├── main.py       # FastAPI app and endpoints
│   ├── requirements.txt
│   ├── supabase_schema.sql
│   └── .env.example
├── frontend/         # React frontend application
│   ├── src/
│   ├── package.json
│   ├── vite.config.js
│   └── vercel.json
└── README.md
```

## Backend Setup

### 1. Navigate to backend directory
```bash
cd backend
```

### 2. Create conda environment
```bash
conda create -n poker-accounting python=3.11 -y
conda activate poker-accounting
pip install -r requirements.txt
```

### 3. Set up Supabase
1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to the SQL Editor in your Supabase dashboard
3. Run the SQL script from `backend/supabase_schema.sql` to create all tables
4. Get your project URL and anon key from Settings > API
5. **Enable Authentication**: The app uses Supabase Auth for user authentication
   - Go to Authentication > Providers in your Supabase dashboard
   - Enable Email provider (or your preferred authentication method)
   - Users can sign up and log in through Supabase Auth

### 4. Configure Environment Variables
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your Supabase credentials in `.env`:
   ```
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_KEY=your_supabase_anon_key
   ```

### 5. Run the Backend
```bash
cd backend
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`

API documentation:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

**Note**: All API endpoints (except `/` and `/health`) require authentication. Include the Supabase JWT token in the `Authorization` header as a Bearer token.

## Frontend Setup

### 1. Navigate to frontend directory
```bash
cd frontend
```

### 2. Install dependencies
```bash
npm install
```

### 3. Run development server
```bash
npm run dev
```

The frontend will be available at `http://localhost:3000`

### 4. Build for production
```bash
npm run build
```

## Deployment

### Frontend (Vercel)
1. Push your code to GitHub
2. Import your repository in Vercel
3. Set the root directory to `frontend`
4. Update `vercel.json` with your backend API URL
5. Deploy

### Backend
Deploy your FastAPI backend to your preferred hosting service (e.g., Railway, Render, AWS, etc.)

**Important:** Update CORS origins in `backend/main.py` to include your frontend URL in production.

## Authentication

All API endpoints (except `/` and `/health`) require authentication using Supabase JWT tokens.

### How it works:
1. Users sign up/login through Supabase Auth (handled in the frontend)
2. Supabase returns a JWT access token
3. Frontend includes this token in the `Authorization` header: `Bearer <token>`
4. Backend validates the token using Supabase's JWKS (JSON Web Key Set)
5. If valid, the request proceeds; otherwise, a 401 error is returned

### Testing with Swagger UI:
1. Get a JWT token from your frontend or Supabase Auth
2. Click the "Authorize" button in Swagger UI
3. Enter: `Bearer <your-jwt-token>`
4. All requests will now include the token

## API Endpoints

### `GET /health`
Health check endpoint (no authentication required).

### `GET /get_data`
Get all game data within a date range.

**Query Parameters:**
- `start_date` (required): Start date (YYYY-MM-DD)
- `end_date` (required): End date (YYYY-MM-DD)
- `lookback_days` (optional): Lookback period in days from end_date

### `GET /get_aggregated_data`
Get aggregated game data grouped by player within a date range.

**Query Parameters:**
- `start_date` (required): Start date (YYYY-MM-DD)
- `end_date` (required): End date (YYYY-MM-DD)
- `lookback_days` (optional): Lookback period in days from end_date

### `GET /get_agents`
Get all agents from the agents table.

### `GET /get_agent_report`
Get agent report with aggregated game data and calculated commissions.

**Query Parameters:**
- `start_date` (required): Start date (YYYY-MM-DD)
- `end_date` (required): End date (YYYY-MM-DD)
- `lookback_days` (optional): Lookback period in days from end_date

**Returns:** Agent data with total profit, total tips, calculated commission (tips * deal_percent), and game count.

### `GET /get_player_history`
Get player history for specific players within a date range.

**Query Parameters:**
- `start_date` (required): Start date (YYYY-MM-DD)
- `end_date` (required): End date (YYYY-MM-DD)
- `player_ids` (required): Comma-separated list of player IDs

## Database Schema

### Agents Table
- `agent_id` (SERIAL PRIMARY KEY)
- `agent_name` (VARCHAR)
- `deal_percent` (DECIMAL)
- `date_created` (TIMESTAMP)
- `date_updated` (TIMESTAMP)
- `comm_channel` (VARCHAR, nullable)
- `notes` (TEXT, nullable)
- `payment_methods` (TEXT, nullable)

### Players Table
- `player_id` (SERIAL PRIMARY KEY)
- `player_name` (VARCHAR)
- `agent_id` (INTEGER, foreign key to agents)
- `credit_limit` (DECIMAL, nullable)
- `notes` (TEXT, nullable)
- `comm_channel` (VARCHAR, nullable)
- `date_created` (TIMESTAMP)
- `date_updated` (TIMESTAMP)
- `payment_methods` (TEXT, nullable)

### Games Table
- `game_id` (SERIAL PRIMARY KEY)
- `player_id` (INTEGER, foreign key to players)
- `player_name` (VARCHAR)
- `game_start_date` (TIMESTAMP)
- `game_end_date` (TIMESTAMP)
- `profit` (DECIMAL)
- `tips` (DECIMAL)
- `created_at` (TIMESTAMP)

## Tech Stack

**Backend:**
- FastAPI
- Supabase (PostgreSQL)
- Pydantic
- Uvicorn

**Frontend:**
- React
- Vite
- React Router
- Axios

## Development

- Backend runs on port 8000
- Frontend runs on port 3000
- Frontend proxy configured to forward `/api/*` requests to backend
