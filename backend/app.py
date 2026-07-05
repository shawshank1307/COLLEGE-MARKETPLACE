import hashlib
import os
import random
import re
import secrets
import time
from functools import wraps
from io import BytesIO
from pathlib import Path

from flask import Flask, g, jsonify, request, send_file, send_from_directory
from flask_cors import CORS

from database import BASE_DIR, UPLOAD_DIR, connect, init_schema, use_postgres
from mail import send_otp_email, smtp_configured

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

DEBUG = os.environ.get("FLASK_DEBUG", "1") == "1"
APP_SECRET = os.environ.get("SECRET_KEY", "dev-only-change-in-production")
DEFAULT_ORIGINS = [
    "https://shawshank1307.github.io",
    "https://jklu-swap.onrender.com",
    "http://localhost:5001",
    "http://127.0.0.1:5001",
    "http://localhost:5000",
    "http://127.0.0.1:5000",
]
extra_origins = [
    o.strip()
    for o in os.environ.get("ALLOWED_ORIGINS", "").split(",")
    if o.strip()
]

app = Flask(__name__)
app.config["SECRET_KEY"] = APP_SECRET
CORS(app, supports_credentials=True, origins=DEFAULT_ORIGINS + extra_origins)

COLLEGE_EMAIL_RE = re.compile(
    r"^[a-zA-Z0-9._%+-]+@(?!gmail\.com|yahoo\.com|hotmail\.com|outlook\.com)"
    r"[a-zA-Z0-9.-]+\.(edu|ac\.in|edu\.in)$",
    re.IGNORECASE,
)


def get_db():
    if "db" not in g:
        g.db = connect()
    return g.db


@app.teardown_appcontext
def close_db(_exc):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    db = connect()
    try:
        init_schema(db)
        count = db.fetchone(db.execute("SELECT COUNT(*) AS c FROM listings"))
        if count and count["c"] == 0:
            seed_listings(db)
        db.commit()
    finally:
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

    if db.is_postgres:
        db.execute(
            """
            INSERT INTO users (name, roll_number, phone, college_email, campus, id_card_path, email_verified, id_verified, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, 1, 1, %s)
            ON CONFLICT (college_email) DO NOTHING
            """,
            ("Demo Seller", "DEMO001", "9999999999", "demo@jklu.edu.in", "JKLU Campus", "seed", now),
        )
    else:
        db.execute(
            """
            INSERT OR IGNORE INTO users (name, roll_number, phone, college_email, campus, id_card_path, email_verified, id_verified, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, 1, 1, %s)
            """,
            ("Demo Seller", "DEMO001", "9999999999", "demo@jklu.edu.in", "JKLU Campus", "seed", now),
        )

    seller = db.fetchone(
        db.execute("SELECT id FROM users WHERE college_email = %s", ("demo@jklu.edu.in",))
    )
    if not seller:
        return

    for row in samples:
        db.execute(
            """
            INSERT INTO listings (id, seller_id, title, description, price, category, condition, campus, emoji, status, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'active', %s)
            ON CONFLICT (id) DO NOTHING
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
    return get_db().fetchone(
        get_db().execute(
            """
            SELECT u.* FROM users u
            JOIN sessions s ON s.user_id = u.id
            WHERE s.token = %s
            """,
            (token,),
        )
    )


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


def deliver_otp(college_email, otp):
    if smtp_configured():
        send_otp_email(college_email, otp)
        return {"sent": True, "demoOtp": None}

    print(f"\n[JKLU Swap OTP] {college_email} -> {otp}\n")
    if DEBUG:
        return {"sent": False, "demoOtp": otp}
    raise RuntimeError(
        "Email delivery is not configured. Set SMTP_HOST and SMTP_FROM on the server."
    )


def save_id_card(id_card, college_email):
    ext = Path(id_card.filename).suffix.lower() or ".jpg"
    if ext not in {".jpg", ".jpeg", ".png", ".webp"}:
        raise ValueError("ID card must be JPG, PNG, or WEBP.")

    file_bytes = id_card.read()
    if len(file_bytes) > 5 * 1024 * 1024:
        raise ValueError("ID card image must be under 5 MB.")

    file_hash = hashlib.sha256(f"{college_email}{time.time()}".encode()).hexdigest()[:16]
    filename = f"{file_hash}{ext}"

    try:
        (UPLOAD_DIR / filename).write_bytes(file_bytes)
    except OSError:
        pass

    return filename, file_bytes


@app.route("/api/health")
def health():
    return jsonify({
        "status": "ok",
        "database": "postgresql" if use_postgres() else "sqlite",
        "email": "smtp" if smtp_configured() else "demo",
    })


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
    existing = db.fetchone(
        db.execute(
            "SELECT college_email, roll_number FROM users WHERE college_email = %s OR roll_number = %s",
            (college_email, roll_number),
        )
    )
    if existing:
        return jsonify({"error": "An account with this email or roll number already exists."}), 409

    try:
        filename, file_bytes = save_id_card(id_card, college_email)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    now = time.time()
    user_id = db.insert_returning_id(
        """
        INSERT INTO users (name, roll_number, phone, college_email, campus, id_card_path, id_card_data, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (name, roll_number, phone, college_email, campus, filename, file_bytes, now),
    )

    otp = generate_otp()
    if db.is_postgres:
        db.execute(
            """
            INSERT INTO otp_codes (college_email, code, expires_at)
            VALUES (%s, %s, %s)
            ON CONFLICT (college_email) DO UPDATE
            SET code = EXCLUDED.code, expires_at = EXCLUDED.expires_at
            """,
            (college_email, otp, now + 600),
        )
    else:
        db.execute(
            """
            INSERT INTO otp_codes (college_email, code, expires_at)
            VALUES (%s, %s, %s)
            ON CONFLICT(college_email) DO UPDATE SET code = excluded.code, expires_at = excluded.expires_at
            """,
            (college_email, otp, now + 600),
        )

    try:
        delivery = deliver_otp(college_email, otp)
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 503

    token = secrets.token_urlsafe(32)
    db.execute(
        "INSERT INTO sessions (token, user_id, created_at) VALUES (%s, %s, %s)",
        (token, user_id, now),
    )
    db.commit()

    user = db.fetchone(db.execute("SELECT * FROM users WHERE id = %s", (user_id,)))
    payload = {
        "token": token,
        "user": user_to_dict(user),
        "message": "Account created. Check your college email for the verification code.",
    }
    if delivery.get("demoOtp"):
        payload["demoOtp"] = delivery["demoOtp"]
    return jsonify(payload), 201


@app.route("/api/auth/send-otp", methods=["POST"])
def send_otp():
    data = request.get_json(silent=True) or {}
    college_email = (data.get("collegeEmail") or "").strip().lower()
    if not validate_college_email(college_email):
        return jsonify({"error": "Invalid college email."}), 400

    db = get_db()
    user = db.fetchone(
        db.execute("SELECT id FROM users WHERE college_email = %s", (college_email,))
    )
    if not user:
        return jsonify({"error": "No account found for this email."}), 404

    otp = generate_otp()
    now = time.time()
    if db.is_postgres:
        db.execute(
            """
            INSERT INTO otp_codes (college_email, code, expires_at)
            VALUES (%s, %s, %s)
            ON CONFLICT (college_email) DO UPDATE
            SET code = EXCLUDED.code, expires_at = EXCLUDED.expires_at
            """,
            (college_email, otp, now + 600),
        )
    else:
        db.execute(
            """
            INSERT INTO otp_codes (college_email, code, expires_at)
            VALUES (%s, %s, %s)
            ON CONFLICT(college_email) DO UPDATE SET code = excluded.code, expires_at = excluded.expires_at
            """,
            (college_email, otp, now + 600),
        )
    db.commit()

    try:
        delivery = deliver_otp(college_email, otp)
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 503

    payload = {"message": "Verification code sent to your college email."}
    if delivery.get("demoOtp"):
        payload["demoOtp"] = delivery["demoOtp"]
    return jsonify(payload)


@app.route("/api/auth/verify-email", methods=["POST"])
def verify_email():
    data = request.get_json(silent=True) or {}
    college_email = (data.get("collegeEmail") or "").strip().lower()
    code = (data.get("code") or "").strip()

    db = get_db()
    otp_row = db.fetchone(
        db.execute(
            "SELECT code, expires_at FROM otp_codes WHERE college_email = %s",
            (college_email,),
        )
    )
    if not otp_row:
        return jsonify({"error": "No verification code found. Request a new one."}), 404
    if time.time() > otp_row["expires_at"]:
        return jsonify({"error": "Verification code expired. Request a new one."}), 400
    if otp_row["code"] != code:
        return jsonify({"error": "Invalid verification code."}), 400

    db.execute(
        "UPDATE users SET email_verified = 1, id_verified = 1 WHERE college_email = %s",
        (college_email,),
    )
    db.execute("DELETE FROM otp_codes WHERE college_email = %s", (college_email,))
    db.commit()

    user = db.fetchone(
        db.execute("SELECT * FROM users WHERE college_email = %s", (college_email,))
    )
    return jsonify({"user": user_to_dict(user), "message": "Email verified successfully!"})


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    college_email = (data.get("collegeEmail") or "").strip().lower()
    roll_number = (data.get("rollNumber") or "").strip().upper()

    if not college_email or not roll_number:
        return jsonify({"error": "College email and roll number are required."}), 400

    db = get_db()
    user = db.fetchone(
        db.execute(
            "SELECT * FROM users WHERE college_email = %s AND roll_number = %s",
            (college_email, roll_number),
        )
    )
    if not user:
        return jsonify({"error": "Invalid email or roll number."}), 401

    token = secrets.token_urlsafe(32)
    now = time.time()
    db.execute(
        "INSERT INTO sessions (token, user_id, created_at) VALUES (%s, %s, %s)",
        (token, user["id"], now),
    )
    db.commit()
    return jsonify({"token": token, "user": user_to_dict(user)})


@app.route("/api/auth/me")
def me():
    user = get_current_user()
    return jsonify({"user": user_to_dict(user) if user else None})


@app.route("/api/auth/logout", methods=["POST"])
def logout():
    token = get_token()
    if token:
        get_db().execute("DELETE FROM sessions WHERE token = %s", (token,))
        get_db().commit()
    return jsonify({"message": "Logged out."})


@app.route("/api/listings")
def list_listings():
    rows = get_db().fetchall(
        get_db().execute(
            """
            SELECT l.*, u.name AS seller_name, u.college_email AS seller_email,
                   u.phone AS seller_phone, u.roll_number AS seller_roll
            FROM listings l
            JOIN users u ON u.id = l.seller_id
            WHERE l.status = 'active'
            ORDER BY l.created_at DESC
            """
        )
    )
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
    row = get_db().fetchone(
        get_db().execute(
            """
            SELECT l.*, u.name AS seller_name, u.college_email AS seller_email,
                   u.phone AS seller_phone, u.roll_number AS seller_roll
            FROM listings l
            JOIN users u ON u.id = l.seller_id
            WHERE l.id = %s
            """,
            (listing_id,),
        )
    )
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
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
    rows = get_db().fetchall(
        get_db().execute(
            """
            SELECT l.*, u.name AS seller_name, u.college_email AS seller_email,
                   u.phone AS seller_phone, u.roll_number AS seller_roll
            FROM listings l
            JOIN users u ON u.id = l.seller_id
            WHERE l.seller_id = %s
            ORDER BY l.created_at DESC
            """,
            (user["id"],),
        )
    )
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
    db = get_db()
    row = db.fetchone(db.execute("SELECT * FROM listings WHERE id = %s", (listing_id,)))
    if not row:
        return jsonify({"error": "Listing not found."}), 404
    if row["seller_id"] != user["id"]:
        return jsonify({"error": "You can only update your own listings."}), 403
    if row["status"] == "sold":
        return jsonify({"message": "Already marked as sold.", "listing": listing_to_dict(row)})

    db.execute("UPDATE listings SET status = 'sold' WHERE id = %s", (listing_id,))
    db.commit()
    updated = db.fetchone(
        db.execute(
            """
            SELECT l.*, u.name AS seller_name, u.college_email AS seller_email,
                   u.phone AS seller_phone, u.roll_number AS seller_roll
            FROM listings l JOIN users u ON u.id = l.seller_id WHERE l.id = %s
            """,
            (listing_id,),
        )
    )
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
    db = get_db()
    row = db.fetchone(db.execute("SELECT seller_id FROM listings WHERE id = %s", (listing_id,)))
    if not row:
        return jsonify({"error": "Listing not found."}), 404
    if row["seller_id"] != user["id"]:
        return jsonify({"error": "You can only delete your own listings."}), 403
    db.execute("DELETE FROM listings WHERE id = %s", (listing_id,))
    db.commit()
    return jsonify({"message": "Listing deleted."})


@app.route("/api/conversations", methods=["GET"])
@require_auth
def list_conversations(user):
    rows = get_db().fetchall(
        get_db().execute(
            """
            SELECT c.*, l.title AS listing_title, l.price AS listing_price,
                   buyer.name AS buyer_name, seller.name AS seller_name,
                   (SELECT body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
                   (SELECT created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_at
            FROM conversations c
            JOIN listings l ON l.id = c.listing_id
            JOIN users buyer ON buyer.id = c.buyer_id
            JOIN users seller ON seller.id = c.seller_id
            WHERE c.buyer_id = %s OR c.seller_id = %s
            ORDER BY COALESCE(
              (SELECT created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1),
              c.created_at
            ) DESC
            """,
            (user["id"], user["id"]),
        )
    )
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
    db = get_db()
    listing = db.fetchone(db.execute("SELECT * FROM listings WHERE id = %s", (listing_id,)))
    if not listing:
        return jsonify({"error": "Listing not found."}), 404
    if listing["seller_id"] == user["id"]:
        return jsonify({"error": "You cannot message yourself."}), 400

    existing = db.fetchone(
        db.execute(
            "SELECT id FROM conversations WHERE listing_id = %s AND buyer_id = %s",
            (listing_id, user["id"]),
        )
    )
    if existing:
        return jsonify({"conversationId": existing["id"]})

    now = time.time()
    conv_id = db.insert_returning_id(
        """
        INSERT INTO conversations (listing_id, buyer_id, seller_id, created_at)
        VALUES (%s, %s, %s, %s)
        """,
        (listing_id, user["id"], listing["seller_id"], now),
    )
    db.commit()
    return jsonify({"conversationId": conv_id}), 201


@app.route("/api/conversations/<int:conversation_id>/messages")
@require_auth
def get_messages(user, conversation_id):
    db = get_db()
    conv = db.fetchone(
        db.execute("SELECT * FROM conversations WHERE id = %s", (conversation_id,))
    )
    if not conv or user["id"] not in (conv["buyer_id"], conv["seller_id"]):
        return jsonify({"error": "Conversation not found."}), 404

    rows = db.fetchall(
        db.execute(
            """
            SELECT m.*, u.name AS sender_name
            FROM messages m
            JOIN users u ON u.id = m.sender_id
            WHERE m.conversation_id = %s
            ORDER BY m.created_at ASC
            """,
            (conversation_id,),
        )
    )
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
    db = get_db()
    conv = db.fetchone(
        db.execute("SELECT * FROM conversations WHERE id = %s", (conversation_id,))
    )
    if not conv or user["id"] not in (conv["buyer_id"], conv["seller_id"]):
        return jsonify({"error": "Conversation not found."}), 404

    data = request.get_json(silent=True) or {}
    body = (data.get("body") or "").strip()
    if not body:
        return jsonify({"error": "Message cannot be empty."}), 400

    now = time.time()
    msg_id = db.insert_returning_id(
        """
        INSERT INTO messages (conversation_id, sender_id, body, created_at)
        VALUES (%s, %s, %s, %s)
        """,
        (conversation_id, user["id"], body, now),
    )
    db.commit()
    return jsonify(
        {
            "message": {
                "id": msg_id,
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
    db = get_db()
    listing = db.fetchone(db.execute("SELECT * FROM listings WHERE id = %s", (listing_id,)))
    if not listing or listing["status"] != "active":
        return jsonify({"error": "Listing unavailable."}), 404
    if listing["seller_id"] == user["id"]:
        return jsonify({"error": "You cannot buy your own listing."}), 400

    txn_id = secrets.token_urlsafe(10)
    now = time.time()
    db.execute(
        """
        INSERT INTO transactions (id, listing_id, buyer_id, seller_id, amount, created_at)
        VALUES (%s, %s, %s, %s, %s, %s)
        """,
        (txn_id, listing_id, user["id"], listing["seller_id"], listing["price"], now),
    )
    db.execute("UPDATE listings SET status = 'sold' WHERE id = %s", (listing_id,))
    db.commit()

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
    path = UPLOAD_DIR / filename
    if path.exists():
        return send_from_directory(UPLOAD_DIR, filename)

    row = get_db().fetchone(
        get_db().execute(
            "SELECT id_card_data FROM users WHERE id_card_path = %s",
            (filename,),
        )
    )
    if row and row.get("id_card_data"):
        return send_file(BytesIO(row["id_card_data"]), mimetype="image/jpeg")

    return jsonify({"error": "File not found."}), 404


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
