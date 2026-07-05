# Deploy JKLU Swap to Production

## What you get

- **Frontend:** https://shawshank1307.github.io/COLLEGE-MARKETPLACE/
- **Backend:** https://jklu-swap.onrender.com (after you deploy)
- **Database:** PostgreSQL on Render (persistent)
- **Email OTP:** Real emails when SMTP is configured

---

## Step 1 — Deploy on Render (15 minutes)

1. Go to [render.com](https://render.com) and sign up with GitHub
2. Click **New → Blueprint**
3. Connect repo: `shawshank1307/COLLEGE-MARKETPLACE`
4. Render reads `render.yaml` and creates:
   - Web service `jklu-swap`
   - PostgreSQL database `jklu-swap-db`
5. Click **Apply** and wait for the deploy to finish (~5 min)
6. Open `https://jklu-swap.onrender.com/api/health` — you should see `{"status":"ok","database":"postgresql",...}`

> Free Render apps sleep after 15 minutes of inactivity. First visit may take 30–60 seconds to wake up.

---

## Step 2 — Set up email OTP (required for real signups)

In Render dashboard → **jklu-swap** → **Environment**, add:

| Variable | Example |
|----------|---------|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `your@gmail.com` |
| `SMTP_PASSWORD` | Gmail [App Password](https://myaccount.google.com/apppasswords) |
| `SMTP_FROM` | `JKLU Swap <your@gmail.com>` |
| `SMTP_USE_TLS` | `1` |

Click **Save Changes** — Render will redeploy automatically.

Without SMTP, signup works locally in demo mode (OTP printed in logs) but **not in production**.

---

## Step 3 — Frontend is already connected

`js/config.js` points GitHub Pages to:

```
https://jklu-swap.onrender.com
```

After Render is live, the live site uses the real backend automatically. If the backend is asleep, it falls back to browser demo mode.

---

## Step 4 — Test end-to-end

1. Open https://shawshank1307.github.io/COLLEGE-MARKETPLACE/
2. Sign up with your `@jklu.edu.in` email
3. Check your inbox for the OTP (not on screen)
4. Post a listing, send a message
5. Restart the Render service — data should still be there (PostgreSQL)

---

## Local development

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

Open http://localhost:5001 — uses SQLite, demo OTP in terminal.

---

## Optional next steps

- Custom domain (e.g. `jkluswap.in`)
- Real payments (Razorpay / UPI)
- Admin panel to review ID cards
- Upgrade Render plan to avoid cold starts
