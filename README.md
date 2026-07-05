# JKLU Swap — College Marketplace

**Live site:** [https://shawshank1307.github.io/COLLEGE-MARKETPLACE/](https://shawshank1307.github.io/COLLEGE-MARKETPLACE/)

> On the live site, data is stored in your browser (demo mode) so signup, login, ID upload, listings, and messages all work without a server.

A student marketplace built for **JK Lakshmipat University (JKLU)**, Jaipur — where students can buy and sell textbooks, electronics, furniture, clothing, and services within the campus community.

---

## The Idea (How I Think About It)

College students constantly trade things — old textbooks after a semester, a mini fridge when moving out of hostel, a laptop upgrade, tutoring help. Today this happens on random WhatsApp groups, Instagram stories, or word of mouth. It's messy, untrusted, and hard to search.

**JKLU Swap** solves that by giving students one trusted place to:

1. **List items** they want to sell (with photos, price, and category)
2. **Browse** what others are selling on campus
3. **Message** sellers directly inside the app
4. **Verify identity** so only real college students participate

The goal is simple: **a safe, campus-only marketplace that feels as easy as scrolling Instagram but as useful as OLX — built specifically for JKLU students.**

---

## How the Website Works (In Simple Words)

```
Student signs up → Uploads college ID → Verifies email (OTP)
       ↓
Posts a listing (title, price, photo, category)
       ↓
Other students browse, search, and filter listings
       ↓
Buyer messages seller → They agree on pickup → Demo payment completes the sale
```

### Step by step

| Step | What happens |
|------|--------------|
| **Sign up** | Student enters name, roll number, phone, and college email (`@jklu.edu.in`) |
| **ID verification** | Student uploads or captures a photo of their college ID card |
| **Email OTP** | A one-time code is sent to verify the college email (demo mode shows the code on screen) |
| **Browse** | Anyone logged in can see all active listings — textbooks, electronics, furniture, etc. |
| **Sell** | Post a new item with title, description, price, category, and optional photo |
| **Message** | Click "Contact Seller" to start a private chat about an item |
| **Buy** | Demo checkout marks the item as sold (no real payment — placeholder for future UPI integration) |
| **Profile** | View your listings, mark items sold, or delete them |

On first launch, the app automatically adds **6 sample listings** (textbooks, MacBook, desk, hoodie, etc.) so the marketplace never looks empty.

---

## Tools & Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | HTML, CSS, JavaScript (vanilla) | No framework overhead — fast, simple, works everywhere |
| **Routing** | Hash-based SPA (`#/browse`, `#/sell`) | Single-page app feel without a build step |
| **Fonts** | Google Fonts (DM Sans, Outfit) | Clean, modern typography |
| **Backend** | Python + Flask | Lightweight API server, easy to run locally |
| **Database** | SQLite | File-based DB — no separate database server needed |
| **Auth** | Session tokens + email OTP | Students prove they belong to the college |
| **File uploads** | Flask + Pillow | College ID card images stored securely on server |
| **API** | REST JSON (`/api/listings`, `/api/auth`, etc.) | Frontend talks to backend via `fetch()` |
| **Hosting** | GitHub Pages (frontend) + Render (full app) | Free hosting for demos and production |

### Project structure

```
COLLEGE-MARKETPLACE/
├── index.html          # Main page shell (header, footer, nav)
├── css/
│   ├── styles.css      # Layout, components, responsive design
│   └── ambient.css     # Background animations & visual effects
├── js/
│   ├── app.js          # Main app logic, routing, all screens
│   ├── api.js          # HTTP client for backend API
│   ├── auth.js         # Login/signup session handling
│   ├── config.js       # JKLU branding, campus photos, logos
│   ├── data.js         # Categories, conditions, sample data
│   ├── image-utils.js  # Listing image processing
│   └── ambient.js      # Animated background layer
├── assets/jklu/        # JKLU logos and campus photos
└── backend/
    ├── app.py          # Flask API + serves frontend in production
    ├── requirements.txt
    └── uploads/        # Student ID card uploads (not in git)
```

---

## Run Locally

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Open **http://localhost:5001** in your browser.

> The Flask server serves both the API and the frontend from one URL.

---

## Deploy the Full App (with working login & listings)

GitHub Pages hosts the static UI. For the **full experience** (signup, listings, messages), deploy the Flask backend to [Render](https://render.com) (free tier):

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → **New → Blueprint**
3. Connect the `shawshank1307/COLLEGE-MARKETPLACE` repo
4. Render reads `render.yaml` and deploys automatically
5. Your live full app will be at `https://jklu-swap.onrender.com`

---

## Features

- Student signup with college email verification
- College ID photo upload / camera capture
- Email OTP verification (demo mode shows OTP on screen)
- Browse, search, filter, and sort listings
- Post items with photos and categories
- In-app messaging between buyers and sellers
- Mock checkout payment flow
- Responsive design with JKLU branding

---

## Author

Built by **Shawshank** ([@shawshank1307](https://github.com/shawshank1307)) for JK Lakshmipat University students.

## License

This project is open source under the [MIT License](LICENSE).
