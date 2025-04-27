# Employee Management Backend – Deployment Guide (Render)

## 1. Prerequisites
- Node.js 20+ and npm
- PostgreSQL database (managed, e.g., Neon, Supabase, etc.)
- GitHub account (for connecting to Render)

## 2. Environment Variables
Set these securely in Render's dashboard (do NOT commit secrets):
- `PORT` (Render sets this automatically)
- `NODE_ENV=production`
- `DATABASE_URL` (e.g., `postgres://username:password@host:port/dbname?sslmode=require`)
- Any other secrets in `.env` (SendGrid, Firebase, etc.)

## 3. Build & Start
- Build: `npm run build`
- Start: `npm start` (runs `node dist/index.js`)

## 4. Render Deployment Steps
1. Push this folder to a GitHub repository.
2. Go to [https://render.com](https://render.com) and create a new Web Service.
3. Connect your GitHub repo, select this folder.
4. Set build command: `npm run build`
5. Set start command: `npm start`
6. Set environment variables as above.
7. Deploy!

## 5. Docker (optional)
- The included `Dockerfile` supports containerized deployment.

## 6. Notes
- Make sure your database connection string ends with `?sslmode=require` for secure SSL connections.
- Logs and errors will be visible in the Render dashboard.
- For 300+ users, consider increasing database pool size in production.

---

**Contact:** If you need help, ask your developer or Cascade AI assistant.
