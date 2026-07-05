import { JKLU } from "./config.js";
import { SAMPLE_LISTINGS } from "./data.js";

const STORE_KEY = "jklu_swap_db";

function loadDb() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return seedDb();
}

function saveDb(db) {
  localStorage.setItem(STORE_KEY, JSON.stringify(db));
}

function seedDb() {
  const now = Date.now();
  const demoSeller = {
    id: 1,
    name: "Demo Seller",
    rollNumber: "DEMO001",
    phone: "9999999999",
    collegeEmail: "demo@jklu.edu.in",
    campus: JKLU.campus,
    emailVerified: true,
    idVerified: true,
    createdAt: now / 1000,
  };

  const listings = SAMPLE_LISTINGS.map((item, i) => ({
    id: item.id,
    sellerId: 1,
    title: item.title,
    description: item.description,
    price: item.price,
    category: item.category,
    condition: item.condition,
    campus: item.campus,
    emoji: item.emoji,
    image: item.image || null,
    status: "active",
    createdAt: item.createdAt || now - i * 86400000,
    sellerName: item.sellerName,
    sellerEmail: item.sellerEmail,
    sellerPhone: "9999999999",
    sellerRollNumber: "DEMO001",
  }));

  const db = {
    users: [demoSeller],
    sessions: {},
    otps: {},
    listings,
    conversations: [],
    messages: [],
    nextUserId: 2,
    nextConvId: 1,
    nextMsgId: 1,
  };
  saveDb(db);
  return db;
}

function token() {
  return localStorage.getItem("campusswap_token");
}

function findUser(db, userId) {
  return db.users.find((u) => u.id === userId) || null;
}

function currentUser(db) {
  const t = token();
  if (!t || !db.sessions[t]) return null;
  return findUser(db, db.sessions[t]);
}

function userPublic(user) {
  return {
    id: user.id,
    name: user.name,
    rollNumber: user.rollNumber,
    phone: user.phone,
    collegeEmail: user.collegeEmail,
    campus: user.campus,
    emailVerified: !!user.emailVerified,
    idVerified: !!user.idVerified,
    createdAt: user.createdAt,
  };
}

function listingPublic(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    price: row.price,
    category: row.category,
    condition: row.condition,
    campus: row.campus,
    emoji: row.emoji,
    image: row.image,
    status: row.status,
    sellerId: row.sellerId,
    createdAt: row.createdAt,
    sellerName: row.sellerName,
    sellerEmail: row.sellerEmail,
    sellerPhone: row.sellerPhone,
    sellerRollNumber: row.sellerRollNumber,
  };
}

function enrichListing(db, listing) {
  const seller = findUser(db, listing.sellerId);
  return listingPublic({
    ...listing,
    sellerName: seller?.name || listing.sellerName,
    sellerEmail: seller?.collegeEmail || listing.sellerEmail,
    sellerPhone: seller?.phone || listing.sellerPhone,
    sellerRollNumber: seller?.rollNumber || listing.sellerRollNumber,
  });
}

function validateCollegeEmail(email) {
  return /^[a-zA-Z0-9._%+-]+@(?!gmail\.com|yahoo\.com|hotmail\.com|outlook\.com)[a-zA-Z0-9.-]+\.(edu|ac\.in|edu\.in)$/i.test(
    email || ""
  );
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function generateToken() {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function fail(message) {
  const err = new Error(message);
  throw err;
}

function requireUser(db) {
  const user = currentUser(db);
  if (!user) fail("Please log in to continue.");
  if (!user.emailVerified) fail("Please verify your college email first.");
  return user;
}

async function readFormFile(file) {
  if (!file) return null;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read ID card photo."));
    reader.readAsDataURL(file);
  });
}

export async function handle(path, options = {}) {
  const db = loadDb();
  const method = (options.method || "GET").toUpperCase();
  let body = options.body;

  if (path === "/api/health") {
    return { status: "ok", mode: "local" };
  }

  if (path === "/api/auth/signup" && method === "POST") {
    if (!(body instanceof FormData)) fail("Invalid signup data.");

    const name = (body.get("name") || "").trim();
    const rollNumber = (body.get("rollNumber") || "").trim().toUpperCase();
    const phone = (body.get("phone") || "").trim();
    const collegeEmail = (body.get("collegeEmail") || "").trim().toLowerCase();
    const campus = (body.get("campus") || JKLU.campus).trim();
    const idCard = body.get("idCard");

    if (!name || !rollNumber || !phone || !collegeEmail || !campus) {
      fail("All fields are required.");
    }
    if (!validateCollegeEmail(collegeEmail)) {
      fail("Use a valid college email (.edu or .ac.in).");
    }
    if (!/^\d{10}$/.test(phone)) {
      fail("Phone number must be 10 digits.");
    }
    if (!idCard || !idCard.name) {
      fail("College ID card photo is required.");
    }

    const exists = db.users.some(
      (u) => u.collegeEmail === collegeEmail || u.rollNumber === rollNumber
    );
    if (exists) fail("An account with this email or roll number already exists.");

    const idCardData = await readFormFile(idCard);
    const userId = db.nextUserId++;
    const now = Date.now() / 1000;
    const otp = generateOtp();

    const user = {
      id: userId,
      name,
      rollNumber,
      phone,
      collegeEmail,
      campus,
      emailVerified: false,
      idVerified: false,
      idCardData,
      createdAt: now,
    };

    db.users.push(user);
    db.otps[collegeEmail] = { code: otp, expiresAt: Date.now() + 600000 };

    const sessionToken = generateToken();
    db.sessions[sessionToken] = userId;
    saveDb(db);
    localStorage.setItem("campusswap_token", sessionToken);

    return {
      token: sessionToken,
      user: userPublic(user),
      message: "Account created. Verify your college email with the OTP sent.",
      demoOtp: otp,
    };
  }

  if (path === "/api/auth/send-otp" && method === "POST") {
    const collegeEmail = (body?.collegeEmail || "").trim().toLowerCase();
    if (!validateCollegeEmail(collegeEmail)) fail("Invalid college email.");
    if (!db.users.some((u) => u.collegeEmail === collegeEmail)) {
      fail("No account found for this email.");
    }
    const otp = generateOtp();
    db.otps[collegeEmail] = { code: otp, expiresAt: Date.now() + 600000 };
    saveDb(db);
    return { message: "Verification code sent to your college email.", demoOtp: otp };
  }

  if (path === "/api/auth/verify-email" && method === "POST") {
    const collegeEmail = (body?.collegeEmail || "").trim().toLowerCase();
    const code = (body?.code || "").trim();
    const otpRow = db.otps[collegeEmail];
    if (!otpRow) fail("No verification code found. Request a new one.");
    if (Date.now() > otpRow.expiresAt) fail("Verification code expired. Request a new one.");
    if (otpRow.code !== code) fail("Invalid verification code.");

    const user = db.users.find((u) => u.collegeEmail === collegeEmail);
    if (!user) fail("Account not found.");
    user.emailVerified = true;
    user.idVerified = true;
    delete db.otps[collegeEmail];
    saveDb(db);
    return { user: userPublic(user), message: "Email verified successfully!" };
  }

  if (path === "/api/auth/login" && method === "POST") {
    const collegeEmail = (body?.collegeEmail || "").trim().toLowerCase();
    const rollNumber = (body?.rollNumber || "").trim().toUpperCase();
    if (!collegeEmail || !rollNumber) {
      fail("College email and roll number are required.");
    }
    const user = db.users.find(
      (u) => u.collegeEmail === collegeEmail && u.rollNumber === rollNumber
    );
    if (!user) fail("Invalid email or roll number.");

    const sessionToken = generateToken();
    db.sessions[sessionToken] = user.id;
    saveDb(db);
    localStorage.setItem("campusswap_token", sessionToken);
    return { token: sessionToken, user: userPublic(user) };
  }

  if (path === "/api/auth/me") {
    const user = currentUser(db);
    return { user: user ? userPublic(user) : null };
  }

  if (path === "/api/auth/logout" && method === "POST") {
    const t = token();
    if (t) delete db.sessions[t];
    saveDb(db);
    localStorage.removeItem("campusswap_token");
    return { message: "Logged out." };
  }

  if (path === "/api/listings" && method === "GET") {
    const listings = db.listings
      .filter((l) => l.status === "active")
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((l) => enrichListing(db, l));
    return { listings };
  }

  if (path === "/api/my-listings" && method === "GET") {
    const user = requireUser(db);
    const listings = db.listings
      .filter((l) => l.sellerId === user.id)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((l) => enrichListing(db, l));
    return { listings };
  }

  const listingMatch = path.match(/^\/api\/listings\/([^/]+)$/);
  if (listingMatch && method === "GET") {
    const listing = db.listings.find((l) => l.id === listingMatch[1]);
    if (!listing) fail("Listing not found.");
    return { listing: enrichListing(db, listing) };
  }

  if (path === "/api/listings" && method === "POST") {
    const user = requireUser(db);
    const listingId = generateId();
    const now = Date.now();
    const listing = {
      id: listingId,
      sellerId: user.id,
      title: (body?.title || "").trim(),
      description: (body?.description || "").trim(),
      price: Number(body?.price || 0),
      category: body?.category,
      condition: body?.condition,
      campus: body?.campus || user.campus,
      emoji: body?.emoji || null,
      image: body?.image || null,
      status: "active",
      createdAt: now,
    };
    db.listings.unshift(listing);
    saveDb(db);
    return { listing: enrichListing(db, listing) };
  }

  const markSoldMatch = path.match(/^\/api\/listings\/([^/]+)\/mark-sold$/);
  if (markSoldMatch && method === "POST") {
    const user = requireUser(db);
    const listing = db.listings.find((l) => l.id === markSoldMatch[1]);
    if (!listing) fail("Listing not found.");
    if (listing.sellerId !== user.id) fail("You can only update your own listings.");
    listing.status = "sold";
    saveDb(db);
    return { message: "Item marked as sold.", listing: enrichListing(db, listing) };
  }

  if (listingMatch && method === "DELETE") {
    const user = requireUser(db);
    const idx = db.listings.findIndex((l) => l.id === listingMatch[1]);
    if (idx === -1) fail("Listing not found.");
    if (db.listings[idx].sellerId !== user.id) fail("You can only delete your own listings.");
    db.listings.splice(idx, 1);
    saveDb(db);
    return { message: "Listing deleted." };
  }

  if (path === "/api/conversations" && method === "GET") {
    const user = requireUser(db);
    const conversations = db.conversations
      .filter((c) => c.buyerId === user.id || c.sellerId === user.id)
      .map((c) => {
        const listing = db.listings.find((l) => l.id === c.listingId);
        const buyer = findUser(db, c.buyerId);
        const seller = findUser(db, c.sellerId);
        const msgs = db.messages.filter((m) => m.conversationId === c.id);
        const last = msgs[msgs.length - 1];
        const otherName = c.buyerId === user.id ? seller?.name : buyer?.name;
        return {
          id: c.id,
          listingId: c.listingId,
          listingTitle: listing?.title || "Listing",
          listingPrice: listing?.price || 0,
          otherName: otherName || "User",
          lastMessage: last?.body || "No messages yet",
          lastMessageAt: last?.createdAt || c.createdAt,
        };
      })
      .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    return { conversations };
  }

  if (path === "/api/conversations" && method === "POST") {
    const user = requireUser(db);
    const listingId = body?.listingId;
    const listing = db.listings.find((l) => l.id === listingId);
    if (!listing) fail("Listing not found.");
    if (listing.sellerId === user.id) fail("You cannot message yourself.");

    let conv = db.conversations.find(
      (c) => c.listingId === listingId && c.buyerId === user.id
    );
    if (!conv) {
      conv = {
        id: db.nextConvId++,
        listingId,
        buyerId: user.id,
        sellerId: listing.sellerId,
        createdAt: Date.now(),
      };
      db.conversations.push(conv);
      saveDb(db);
    }
    return { conversationId: conv.id };
  }

  const messagesMatch = path.match(/^\/api\/conversations\/(\d+)\/messages$/);
  if (messagesMatch && method === "GET") {
    const user = requireUser(db);
    const conversationId = parseInt(messagesMatch[1], 10);
    const conv = db.conversations.find((c) => c.id === conversationId);
    if (!conv || (conv.buyerId !== user.id && conv.sellerId !== user.id)) {
      fail("Conversation not found.");
    }
    const messages = db.messages
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((m) => {
        const sender = findUser(db, m.senderId);
        return {
          id: m.id,
          body: m.body,
          senderId: m.senderId,
          senderName: sender?.name || "User",
          isMine: m.senderId === user.id,
          createdAt: m.createdAt,
        };
      });
    return { messages, conversationId };
  }

  if (messagesMatch && method === "POST") {
    const user = requireUser(db);
    const conversationId = parseInt(messagesMatch[1], 10);
    const conv = db.conversations.find((c) => c.id === conversationId);
    if (!conv || (conv.buyerId !== user.id && conv.sellerId !== user.id)) {
      fail("Conversation not found.");
    }
    const text = (body?.body || "").trim();
    if (!text) fail("Message cannot be empty.");

    const message = {
      id: db.nextMsgId++,
      conversationId,
      senderId: user.id,
      body: text,
      createdAt: Date.now(),
    };
    db.messages.push(message);
    saveDb(db);
    return {
      message: {
        id: message.id,
        body: text,
        senderId: user.id,
        senderName: user.name,
        isMine: true,
        createdAt: message.createdAt,
      },
    };
  }

  if (path === "/api/payments" && method === "POST") {
    const user = requireUser(db);
    const listing = db.listings.find((l) => l.id === body?.listingId);
    if (!listing || listing.status !== "active") fail("Listing unavailable.");
    if (listing.sellerId === user.id) fail("You cannot buy your own listing.");
    listing.status = "sold";
    saveDb(db);
    return {
      transaction: {
        id: generateId(),
        listingId: listing.id,
        amount: listing.price,
        status: "completed",
        createdAt: Date.now(),
      },
      message: "Payment successful! Contact the seller to arrange pickup.",
    };
  }

  fail("Unknown API route.");
}
