# Nutrition Assistant — MERN

## Requirements
- Node.js LTS and npm
- MongoDB Community Server running locally, or a MongoDB Atlas connection string
- VS Code

## Setup
1. Extract the ZIP and open `nutrition-assistant-mern` in VS Code.
2. Open Terminal > New Terminal.
3. Backend:
   ```bash
   cd server
   copy .env.example .env
   npm install
   npm run dev
   ```
   Edit `server/.env` if you use MongoDB Atlas. For local MongoDB, the default URI is `mongodb://127.0.0.1:27017/nutrition_assistant`.
4. Open a second VS Code terminal:
   ```bash
   cd client
   npm install
   npm run dev
   ```
5. Open the URL Vite prints, normally `http://localhost:5173`.
6. Register a user, then fill in the profile and generate recommendations.

## API
- `POST /api/auth/register` — `{name,email,password}`
- `POST /api/auth/login` — `{email,password}`
- `GET /api/profile` / `PUT /api/profile` — authenticated profile
- `GET /api/recommendations` — calculated targets and sample meal suggestions
- `GET /api/logs` / `POST /api/logs` / `DELETE /api/logs/:id` — food log

## Notes
This starter uses transparent rule-based food matching and calorie estimates; it does not call a trained AI model or external AI API. BMI and calorie estimates are informational only and may not be appropriate for children, pregnancy, medical conditions, or eating-disorder recovery. Seek a qualified healthcare professional for medical nutrition advice.

## Troubleshooting: Meal ideas is empty
1. Open `http://localhost:5000/api/health` — it must show `"status":"ok"`. If not, the backend is not running.
2. Restart the backend (`npm run dev` in `server`) after any code change, then hard-refresh the browser (Ctrl+F5).
3. Open the browser DevTools > Network tab and click **Meal ideas**; check the `recommendations` request for errors.
4. In **My profile**, press **Save profile** once, then click **Generate new ideas** in Meal ideas.
