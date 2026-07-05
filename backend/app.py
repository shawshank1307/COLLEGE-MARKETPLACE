import hashlib
import os
import random
import re
import secrets
import sqlite3
import time
from functools import wraps
from pathlib import Path

from flask import Flask, g, jsonify, request, send_from_directory
from flask_cors import CORS

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads" / "id_cards"
DB_PATH = BASE_DIR / "campus_market.db"
DEBUG = os.environ.get("FLASK_DEBUG", "1") == "1"

app = Flask(__name__)
CORS(app, supports_credentials=True, origins=[
    "https://shawshank1307.github.io",
    "http://localhost:5001",
    "http://127.0.0.1:5001",
    "http://localhost:5000",
    "http://127.0.0.1:5000",
])

COLLEGE_EMAIL_RE = re.compile(
    r"^[a-zA-Z0-9._%+-]+@(?!gmail\.com|yahoo\.com|hotmail\.com|outlook\.com)"
    r"[a-zA-Z0-9.-]+\.(edu|ac\.in|edu\.in)$",
    re.IGNORECASE,
)


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(_exc):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            roll_number TEXT NOT NULL UNIQUE,
            phone TEXT NOT NULL,
            college_email TEXT NOT NULL UNIQUE,
            campus TEXT NOT NULL DEFAULT 'JKLU Campus',
            id_card_path TEXT NOT NULL,
            email_verified INTEGER NOT NULL DEFAULT 0,
            id_verified INTEGER NOT NULL DEFAULT 0,
            created_at REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            created_at REAL NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS otp_codes (
            college_email TEXT PRIMARY KEY,
            code TEXT NOT NULL,
            expires_at REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS listings (
            id TEXT PRIMARY KEY,
            seller_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            price REAL NOT NULL,
            category TEXT NOT NULL,
            condition TEXT NOT NULL,
            campus TEXT NOT NULL,
            emoji TEXT,
            image TEXT,
            status TEXT NOT NULL DEFAULT 'active',
            created_at REAL NOT NULL,
            FOREIGN KEY (seller_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            listing_id TEXT NOT NULL,
            buyer_id INTEGER NOT NULL,
            seller_id INTEGER NOT NULL,
            created_at REAL NOT NULL,
            UNIQUE(listing_id, buyer_id),
            FOREIGN KEY (listing_id) REFERENCES listings(id),
            FOREIGN KEY (buyer_id) REFERENCES users(id),
            FOREIGN KEY (seller_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id INTEGER NOT NULL,
            sender_id INTEGER NOT NULL,
            body TEXT NOT NULL,
            created_at REAL NOT NULL,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id),
            FOREIGN KEY (sender_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS transactions (
            id TEXT PRIMARY KEY,
            listing_id TEXT NOT NULL,
            buyer_id INTEGER NOT NULL,
            seller_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            status TEXT NOT NULL DEFAULT 'completed',
            created_at REAL NOT NULL,
            FOREIGN KEY (listing_id) REFERENCES listings(id),
            FOREIGN KEY (buyer_id) REFERENCES users(id),
            FOREIGN KEY (seller_id) REFERENCES users(id)
        );
        """
    )

    count = db.execute("SELECT COUNT(*) FROM listings").fetchone()[0]
    if count == 0:
        seed_listings(db)

    db.commit()
    db.close()


def seed_listings(db):
    now = time.time()
    samples = [
        ("1", "Engineering Mathematics — Grewal", "Used for B.Tech Sem 1. Minimal highlighting.", 350, "textbooks", "Good", "JKLU Campus", "📚", now - 172800),
        ("2", "MacBook Air M1 — Perfect for CSE", "Battery health 92%. Comes with charger.", 45000, "electronics", "Like New", "JKLU Campus", "💻", now - 86400),
        ("3", "Study Desk + Chair — Hostel Ready", "Compact desk with chair.", 2500, "furniture", "Good", "JKLU Campus", "🛋️", now - 345600),
        ("4", "DSA & OS Tutoring — ₹300/hr", "CSE 3rd year. Evenings at JKLU campus.", 300, "services", "Like New", "JKLU Campus", "🛠️", now - 43200),
        ("5", "JKLU Hoodie — Size M", "Official JKLU merch, worn twice.", 800, "clothing", "Like New", "JKLU Campus", "👕", now - 259200),
        ("6", "Mini Fridge for Hostel Room", "Works perfectly. Quiet compressor.", 3500, "other", "Good", "JKLU Campus", "📦", now - 432000),
    ]
    db.execute(
        """
        INSERT INTO users (name, roll_number, phone, college_email, campus, id_card_path, email_verified, id_verified, created_at)
        VALUES ('Demo Seller', 'DEMO001', '9999999999', 'demo@jklu.edu.in', 'JKLU Campus', 'seed', 1, 1, ?)
        ON CONFLICT(college_email) DO NOTHING
        """,
        (now,),
    )
    seller = db.execute("SELECT id FROM users WHERE college_email = 'demo@jklu.edu.in'").fetchone()
    if seller:
        for row in samples:
            db.execute(
                """
                INSERT INTO listings (id, seller_id, title, description, price, category, condition, campus, emoji, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
                """,
                (row[0], seller["id"], row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8]),
            )


def user_to_dict(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "rollNumber": row["roll_number"],
        "phone": row["phone"],
        "collegeEmail": row["college_email"],
        "campus": row["campus"],
        "emailVerified": bool(row["email_verified"]),
        "idVerified": bool(row["id_verified"]),
        "createdAt": row["created_at"],
    }


def listing_to_dict(row, seller=None):
    data = {
        "id": row["id"],
        "title": row["title"],
        "description": row["description"],
        "price": row["price"],
        "category": row["category"],
        "condition": row["condition"],
        "campus": row["campus"],
        "emoji": row["emoji"],
        "image": row["image"],
        "status": row["status"],
        "sellerId": row["seller_id"],
        "createdAt": int(row["created_at"] * 1000),
    }
    if seller:
        data["sellerName"] = seller["name"]
        data["sellerEmail"] = seller["college_email"]
        data["sellerPhone"] = seller["phone"]
        data["sellerRollNumber"] = seller["roll_number"]
    return data


def get_token():
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return request.headers.get("X-Auth-Token")


def get_current_user():
    token = get_token()
    if not token:
        return None
    row = get_db().execute(
        """
        SELECT u.* FROM users u
        JOIN sessions s ON s.user_id = u.id
        WHERE s.token = ?
        """,
        (token,),
    ).fetchone()
    return row


def require_auth(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({"error": "Please log in to continue."}), 401
        if not user["email_verified"]:
            return jsonify({"error": "Please verify your college email first."}), 403
        return f(user, *args, **kwargs)

    return wrapper


def validate_college_email(email):
    return bool(COLLEGE_EMAIL_RE.match(email or ""))


def generate_otp():
    return f"{random.randint(100000, 999999)}"


@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/api/auth/signup", methods=["POST"])
def signup():
    name = (request.form.get("name") or "").strip()
    roll_number = (request.form.get("rollNumber") or "").strip().upper()
    phone = (request.form.get("phone") or "").strip()
    college_email = (request.form.get("collegeEmail") or "").strip().lower()
    campus = (request.form.get("campus") or "JKLU Campus").strip()
    id_card = request.files.get("idCard")

    if not all([name, roll_number, phone, college_email, campus]):
        return jsonify({"error": "All fields are required."}), 400

    if not validate_college_email(college_email):
        return jsonify({"error": "Use a valid college email (.edu or .ac.in)."}), 400

    if not re.fullmatch(r"\d{10}", phone):
        return jsonify({"error": "Phone number must be 10 digits."}), 400

    if not id_card or not id_card.filename:
        return jsonify({"error": "College ID card photo is required."}), 400

    db = get_db()
    existing = db.execute(
        "SELECT college_email, roll_number FROM users WHERE college_email = ? OR roll_number = ?",
        (college_email, roll_number),
    ).fetchone()
    if existing:
        return jsonify({"error": "An account with this email or roll number already exists."}), 409

    ext = Path(id_card.filename).suffix.lower() or ".jpg"
    if ext not in {".jpg", ".jpeg", ".png", ".webp"}:
        return jsonify({"error": "ID card must be JPG, PNG, or WEBP."}), 400

    file_hash = hashlib.sha256(f"{college_email}{time.time()}".encode()).hexdigest()[:16]
    filename = f"{file_hash}{ext}"
    id_card.save(UPLOAD_DIR / filename)

    now = time.time()
    cur = db.execute(
        """
        INSERT INTO users (name, roll_number, phone, college_email, campus, id_card_path, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (name, roll_number, phone, college_email, campus, filename, now),
    )
    user_id = cur.lastrowid

    otp = generate_otp()
    db.execute(
        """
        INSERT INTO otp_codes (college_email, code, expires_at)
        VALUES (?, ?, ?)
        ON CONFLICT(college_email) DO UPDATE SET code = excluded.code, expires_at = excluded.expires_at
        """,
        (college_email, otp, now + 600),
    )
    db.commit()

    print(f"\n[CampusSwap OTP] {college_email} -> {otp}\n")

    token = secrets.token_urlsafe(32)
    db.execute("INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)", (token, user_id, now))
    db.commit()

    user = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    payload = {
        "token": token,
        "user": user_to_dict(user),
        "message": "Account created. Verify your college email with the OTP sent.",
    }
    if DEBUG:
        payload["demoOtp"] = otp
    return jsonify(payload), 201


@app.route("/api/auth/send-otp", methods=["POST"])
def send_otp():
    data = request.get_json(silent=True) or {}
    college_email = (data.get("collegeEmail") or "").strip().lower()
    if not validate_college_email(college_email):
        return jsonify({"error": "Invalid college email."}), 400

    db = get_db()
    user = db.execute("SELECT id FROM users WHERE college_email = ?", (college_email,)).fetchone()
    if not user:
        return jsonify({"error": "No account found for this email."}), 404

    otp = generate_otp()
    now = time.time()
    db.execute(
        """
        INSERT INTO otp_codes (college_email, code, expires_at)
        VALUES (?, ?, ?)
        ON CONFLICT(college_email) DO UPDATE SET code = excluded.code, expires_at = excluded.expires_at
        """,
        (college_email, otp, now + 600),
    )
    db.commit()

    print(f"\n[CampusSwap OTP] {college_email} -> {otp}\n")

    payload = {"message": "Verification code sent to your college email."}
    if DEBUG:
        payload["demoOtp"] = otp
    return jsonify(payload)


@app.route("/api/auth/verify-email", methods=["POST"])
def verify_email():
    data = request.get_json(silent=True) or {}
    college_email = (data.get("collegeEmail") or "").strip().lower()
    code = (data.get("code") or "").strip()

    db = get_db()
    otp_row = db.execute(
        "SELECT code, expires_at FROM otp_codes WHERE college_email = ?",
        (college_email,),
    ).fetchone()
    if not otp_row:
        return jsonify({"error": "No verification code found. Request a new one."}), 404
    if time.time() > otp_row["expires_at"]:
        return jsonify({"error": "Verification code expired. Request a new one."}), 400
    if otp_row["code"] != code:
        return jsonify({"error": "Invalid verification code."}), 400

    db.execute(
        "UPDATE users SET email_verified = 1, id_verified = 1 WHERE college_email = ?",
        (college_email,),
    )
    db.execute("DELETE FROM otp_codes WHERE college_email = ?", (college_email,))
    db.commit()

    user = db.execute("SELECT * FROM users WHERE college_email = ?", (college_email,)).fetchone()
    return jsonify({"user": user_to_dict(user), "message": "Email verified successfully!"})


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    college_email = (data.get("collegeEmail") or "").strip().lower()
    roll_number = (data.get("rollNumber") or "").strip().upper()

    if not college_email or not roll_number:
        return jsonify({"error": "College email and roll number are required."}), 400

    db = get_db()
    user = db.execute(
        "SELECT * FROM users WHERE college_email = ? AND roll_number = ?",
        (college_email, roll_number),
    ).fetchone()
    if not user:
        return jsonify({"error": "Invalid email or roll number."}), 401

    token = secrets.token_urlsafe(32)
    now = time.time()
    db.execute("INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)", (token, user["id"], now))
    db.commit()

    return jsonify({"token": token, "user": user_to_dict(user)})


@app.route("/api/auth/me")
def me():
    user = get_current_user()
    if not user:
        return jsonify({"user": None})
    return jsonify({"user": user_to_dict(user)})


@app.route("/api/auth/logout", methods=["POST"])
def logout():
    token = get_token()
    if token:
        get_db().execute("DELETE FROM sessions WHERE token = ?", (token,))
        get_db().commit()
    return jsonify({"message": "Logged out."})


@app.route("/api/listings")
def list_listings():
    rows = get_db().execute(
        """
        SELECT l.*, u.name AS seller_name, u.college_email AS seller_email,
               u.phone AS seller_phone, u.roll_number AS seller_roll
        FROM listings l
        JOIN users u ON u.id = l.seller_id
        WHERE l.status = 'active'
        ORDER BY l.created_at DESC
        """
    ).fetchall()
    listings = []
    for row in rows:
        seller = {
            "name": row["seller_name"],
            "college_email": row["seller_email"],
            "phone": row["seller_phone"],
            "roll_number": row["seller_roll"],
        }
        listings.append(listing_to_dict(row, seller))
    return jsonify({"listings": listings})


@app.route("/api/listings/<listing_id>")
def get_listing(listing_id):
    row = get_db().execute(
        """
        SELECT l.*, u.name AS seller_name, u.college_email AS seller_email,
               u.phone AS seller_phone, u.roll_number AS seller_roll
        FROM listings l
        JOIN users u ON u.id = l.seller_id
        WHERE l.id = ?
        """,
        (listing_id,),
    ).fetchone()
    if not row:
        return jsonify({"error": "Listing not found."}), 404
    seller = {
        "name": row["seller_name"],
        "college_email": row["seller_email"],
        "phone": row["seller_phone"],
        "roll_number": row["seller_roll"],
    }
    return jsonify({"listing": listing_to_dict(row, seller)})


@app.route("/api/listings", methods=["POST"])
@require_auth
def create_listing(user):
    data = request.get_json(silent=True) or {}
    listing_id = secrets.token_urlsafe(8)
    now = time.time()
    get_db().execute(
        """
        INSERT INTO listings (id, seller_id, title, description, price, category, condition, campus, emoji, image, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            listing_id,
            user["id"],
            data.get("title", "").strip(),
            data.get("description", "").strip(),
            float(data.get("price", 0)),
            data.get("category"),
            data.get("condition"),
            data.get("campus") or user["campus"],
            data.get("emoji"),
            data.get("image"),
            now,
        ),
    )
    get_db().commit()
    return get_listing(listing_id)


@app.route("/api/my-listings")
@require_auth
def my_listings(user):
    rows = get_db().execute(
        """
        SELECT l.*, u.name AS seller_name, u.college_email AS seller_email,
               u.phone AS seller_phone, u.roll_number AS seller_roll
        FROM listings l
        JOIN users u ON u.id = l.seller_id
        WHERE l.seller_id = ?
        ORDER BY l.created_at DESC
        """,
        (user["id"],),
    ).fetchall()
    listings = []
    for row in rows:
        seller = {
            "name": row["seller_name"],
            "college_email": row["seller_email"],
            "phone": row["seller_phone"],
            "roll_number": row["seller_roll"],
        }
        listings.append(listing_to_dict(row, seller))
    return jsonify({"listings": listings})


@app.route("/api/listings/<listing_id>/mark-sold", methods=["POST"])
@require_auth
def mark_listing_sold(user, listing_id):
    row = get_db().execute("SELECT * FROM listings WHERE id = ?", (listing_id,)).fetchone()
    if not row:
        return jsonify({"error": "Listing not found."}), 404
    if row["seller_id"] != user["id"]:
        return jsonify({"error": "You can only update your own listings."}), 403
    if row["status"] == "sold":
        return jsonify({"message": "Already marked as sold.", "listing": listing_to_dict(row)})
    get_db().execute("UPDATE listings SET status = 'sold' WHERE id = ?", (listing_id,))
    get_db().commit()
    updated = get_db().execute(
        """
        SELECT l.*, u.name AS seller_name, u.college_email AS seller_email,
               u.phone AS seller_phone, u.roll_number AS seller_roll
        FROM listings l JOIN users u ON u.id = l.seller_id WHERE l.id = ?
        """,
        (listing_id,),
    ).fetchone()
    seller = {
        "name": updated["seller_name"],
        "college_email": updated["seller_email"],
        "phone": updated["seller_phone"],
        "roll_number": updated["seller_roll"],
    }
    return jsonify({"message": "Item marked as sold.", "listing": listing_to_dict(updated, seller)})


@app.route("/api/listings/<listing_id>", methods=["DELETE"])
@require_auth
def delete_listing(user, listing_id):
    row = get_db().execute("SELECT seller_id FROM listings WHERE id = ?", (listing_id,)).fetchone()
    if not row:
        return jsonify({"error": "Listing not found."}), 404
    if row["seller_id"] != user["id"]:
        return jsonify({"error": "You can only delete your own listings."}), 403
    get_db().execute("DELETE FROM listings WHERE id = ?", (listing_id,))
    get_db().commit()
    return jsonify({"message": "Listing deleted."})


@app.route("/api/conversations", methods=["GET"])
@require_auth
def list_conversations(user):
    rows = get_db().execute(
        """
        SELECT c.*, l.title AS listing_title, l.price AS listing_price,
               buyer.name AS buyer_name, seller.name AS seller_name,
               (SELECT body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
               (SELECT created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_at
        FROM conversations c
        JOIN listings l ON l.id = c.listing_id
        JOIN users buyer ON buyer.id = c.buyer_id
        JOIN users seller ON seller.id = c.seller_id
        WHERE c.buyer_id = ? OR c.seller_id = ?
        ORDER BY COALESCE(last_message_at, c.created_at) DESC
        """,
        (user["id"], user["id"]),
    ).fetchall()
    conversations = []
    for row in rows:
        other_name = row["seller_name"] if row["buyer_id"] == user["id"] else row["buyer_name"]
        conversations.append(
            {
                "id": row["id"],
                "listingId": row["listing_id"],
                "listingTitle": row["listing_title"],
                "listingPrice": row["listing_price"],
                "otherName": other_name,
                "lastMessage": row["last_message"] or "No messages yet",
                "lastMessageAt": int((row["last_message_at"] or row["created_at"]) * 1000),
            }
        )
    return jsonify({"conversations": conversations})


@app.route("/api/conversations", methods=["POST"])
@require_auth
def start_conversation(user):
    data = request.get_json(silent=True) or {}
    listing_id = data.get("listingId")
    listing = get_db().execute("SELECT * FROM listings WHERE id = ?", (listing_id,)).fetchone()
    if not listing:
        return jsonify({"error": "Listing not found."}), 404
    if listing["seller_id"] == user["id"]:
        return jsonify({"error": "You cannot message yourself."}), 400

    existing = get_db().execute(
        "SELECT id FROM conversations WHERE listing_id = ? AND buyer_id = ?",
        (listing_id, user["id"]),
    ).fetchone()
    if existing:
        return jsonify({"conversationId": existing["id"]})

    now = time.time()
    cur = get_db().execute(
        """
        INSERT INTO conversations (listing_id, buyer_id, seller_id, created_at)
        VALUES (?, ?, ?, ?)
        """,
        (listing_id, user["id"], listing["seller_id"], now),
    )
    get_db().commit()
    return jsonify({"conversationId": cur.lastrowid}), 201


@app.route("/api/conversations/<int:conversation_id>/messages")
@require_auth
def get_messages(user, conversation_id):
    conv = get_db().execute("SELECT * FROM conversations WHERE id = ?", (conversation_id,)).fetchone()
    if not conv or user["id"] not in (conv["buyer_id"], conv["seller_id"]):
        return jsonify({"error": "Conversation not found."}), 404

    rows = get_db().execute(
        """
        SELECT m.*, u.name AS sender_name
        FROM messages m
        JOIN users u ON u.id = m.sender_id
        WHERE m.conversation_id = ?
        ORDER BY m.created_at ASC
        """,
        (conversation_id,),
    ).fetchall()
    messages = [
        {
            "id": row["id"],
            "body": row["body"],
            "senderId": row["sender_id"],
            "senderName": row["sender_name"],
            "isMine": row["sender_id"] == user["id"],
            "createdAt": int(row["created_at"] * 1000),
        }
        for row in rows
    ]
    return jsonify({"messages": messages, "conversationId": conversation_id})


@app.route("/api/conversations/<int:conversation_id>/messages", methods=["POST"])
@require_auth
def send_message(user, conversation_id):
    conv = get_db().execute("SELECT * FROM conversations WHERE id = ?", (conversation_id,)).fetchone()
    if not conv or user["id"] not in (conv["buyer_id"], conv["seller_id"]):
        return jsonify({"error": "Conversation not found."}), 404

    data = request.get_json(silent=True) or {}
    body = (data.get("body") or "").strip()
    if not body:
        return jsonify({"error": "Message cannot be empty."}), 400

    now = time.time()
    cur = get_db().execute(
        """
        INSERT INTO messages (conversation_id, sender_id, body, created_at)
        VALUES (?, ?, ?, ?)
        """,
        (conversation_id, user["id"], body, now),
    )
    get_db().commit()
    return jsonify(
        {
            "message": {
                "id": cur.lastrowid,
                "body": body,
                "senderId": user["id"],
                "senderName": user["name"],
                "isMine": True,
                "createdAt": int(now * 1000),
            }
        }
    ), 201


@app.route("/api/payments", methods=["POST"])
@require_auth
def create_payment(user):
    data = request.get_json(silent=True) or {}
    listing_id = data.get("listingId")
    listing = get_db().execute("SELECT * FROM listings WHERE id = ?", (listing_id,)).fetchone()
    if not listing or listing["status"] != "active":
        return jsonify({"error": "Listing unavailable."}), 404
    if listing["seller_id"] == user["id"]:
        return jsonify({"error": "You cannot buy your own listing."}), 400

    txn_id = secrets.token_urlsafe(10)
    now = time.time()
    get_db().execute(
        """
        INSERT INTO transactions (id, listing_id, buyer_id, seller_id, amount, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (txn_id, listing_id, user["id"], listing["seller_id"], listing["price"], now),
    )
    get_db().execute("UPDATE listings SET status = 'sold' WHERE id = ?", (listing_id,))
    get_db().commit()

    return jsonify(
        {
            "transaction": {
                "id": txn_id,
                "listingId": listing_id,
                "amount": listing["price"],
                "status": "completed",
                "createdAt": int(now * 1000),
            },
            "message": "Payment successful! Contact the seller to arrange pickup.",
        }
    )


@app.route("/uploads/id_cards/<filename>")
def serve_id_card(filename):
    return send_from_directory(UPLOAD_DIR, filename)


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    frontend = BASE_DIR.parent
    if path and (frontend / path).exists():
        return send_from_directory(frontend, path)
    return send_from_directory(frontend, "index.html")


init_db()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=DEBUG)
