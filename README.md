# CampusSwap — College Marketplace

A campus student marketplace for buying and selling textbooks, electronics, furniture, and more — verified students only.

## Features

- **Student signup** with name, roll number, phone, and college email
- **College ID verification** via photo upload/camera capture
- **Email OTP verification** (`.edu` / `.ac.in` emails)
- **Browse & sell** listings by category and campus
- **In-app messaging** between buyers and sellers
- **Mock checkout** payment flow

## Quick Start

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

Open **http://localhost:5001** in your browser.

## Tech Stack

- **Frontend:** HTML, CSS, JavaScript (SPA)
- **Backend:** Flask + SQLite
- **Auth:** Session tokens + email OTP

## Project Structure

```
campus-market/
├── index.html
├── css/styles.css
├── js/              # Frontend app, API client, auth
└── backend/
    ├── app.py       # Flask API
    └── requirements.txt
```
