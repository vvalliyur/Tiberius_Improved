# Quick Start Guide

## If you're getting CORS errors:

### 1. Start the Backend Server

Open a terminal and run:

```bash
cd backend
conda activate poker-accounting  # or your conda environment name
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The backend should start on `http://localhost:8000`

### 2. Verify Backend is Running

Open your browser and go to:
- `http://localhost:8000/health` - Should return `{"status":"healthy"}`
- `http://localhost:8000/docs` - Should show the Swagger API documentation

### 3. Check Environment Variables

Make sure your `backend/.env` file exists and has:
```
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key
SUPABASE_JWT_SECRET=your_jwt_secret
```

### 4. Start the Frontend

In a separate terminal:

```bash
cd frontend
npm install  # if you haven't already
npm run dev
```

The frontend should start on `http://localhost:3000`

### 5. Verify CORS is Working

The backend CORS is configured to allow all origins. If you're still getting CORS errors:
- Make sure the backend is actually running (check step 2)
- Check that the frontend is trying to connect to `http://localhost:8000`
- Check browser console for the exact error message

### Common Issues:

1. **Backend not running**: The most common cause. Make sure uvicorn is running.
2. **Wrong port**: Backend should be on port 8000, frontend on port 3000
3. **Missing .env file**: Backend needs Supabase credentials to start
4. **Python dependencies**: Run `pip install -r requirements.txt` in the backend directory

