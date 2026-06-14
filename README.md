# Spreetail Shared Expenses App

Live URLs:
- Frontend: [VERCEL_URL]
- Backend: [RAILWAY_URL]

Tech Stack: Node.js, Express, Prisma, PostgreSQL, React, Vite, Tailwind CSS

Local Setup:

Backend:
  cd backend
  npm install
  cp .env.example .env   ← fill in DATABASE_URL and JWT_SECRET
  npx prisma migrate dev
  npm run dev

Frontend:
  cd frontend
  npm install
  cp .env.example .env   ← set VITE_API_URL=http://localhost:5000
  npm run dev

How to import CSV:
  1. Register/login
  2. Create a group called "Flat Expenses"
  3. Add members: Aisha, Rohan, Priya, Meera with joinedAt = 2024-02-01
  4. Set Meera's leftAt = 2024-03-31
  5. Add Sam with joinedAt = 2024-04-15
  6. Go to Import page → select group → upload expenses_export.csv
  7. Review Flagged tab → approve or reject each anomaly

AI Tools Used: Claude (Anthropic), GitHub Copilot
