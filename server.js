const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const express = require("express");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const { Readable } = require("stream");
const { openDatabase, createRepository } = require("./src/db");
const { indexFaculty, indexAllFaculties } = require("./src/lib/server_crawler");

dotenv.config();

const app = express();
const rootDir = __dirname;
const newAppDistDir = path.join(rootDir, "newapp", "dist");
const BCU_ALLOWED_URLS = [
    "https://public-view.bcucluj.ro/pdfview/",
    "https://dspace.bcucluj.ro/oai/request",
    "https://dspace.bcucluj.ro/handle/",
    "https://dspace.bcucluj.ro/bitstream/"
].map((url) => new URL(url));
const bcuResolvedUrlCache = new Map();
const BCU_RESOLVED_TTL_MS = 1000 * 60 * 60 * 12;
const USERNAME_REGEX = /^[A-Za-z0-9._-]{3,64}$/;

const config = {
    port: Number(process.env.PORT || 3000),
    host: process.env.HOST || "127.0.0.1",
    jwtSecret: process.env.JWT_SECRET || "dev-insecure-secret-change-me",
    jwtExpiresHours: Number(process.env.JWT_EXPIRES_HOURS || 12),
    adminUsername: process.env.ADMIN_USERNAME || "admin",
    adminPassword: process.env.ADMIN_PASSWORD || "ChangeMe123!",
    publicAppUrl: String(process.env.PUBLIC_APP_URL || "").trim().replace(/\/+$/, ""),
    isProd: process.env.NODE_ENV === "production",
    smtp: {
        host: process.env.SMTP_HOST || "",
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === "true",
        user: process.env.SMTP_USER || "",
        pass: process.env.SMTP_PASS || "",
        fromEmail: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || ""
    }
};

if (!process.env.JWT_SECRET) {
    // Keep startup explicit to avoid unsafe production defaults.
    console.warn("[WARN] JWT_SECRET is not set. Using an insecure fallback for development only.");
}

if (config.isProd && (!process.env.JWT_SECRET || config.jwtSecret.length < 32)) {
    throw new Error("In production, JWT_SECRET must be set and at least 32 characters long.");
}

if (config.isProd && config.adminPassword === "ChangeMe123!") {
    throw new Error("In production, ADMIN_PASSWORD must be changed from default value.");
}

if (config.publicAppUrl) {
    try {
        const parsed = new URL(config.publicAppUrl);
        if (config.isProd && parsed.protocol !== "https:") {
            throw new Error("PUBLIC_APP_URL must use https in production.");
        }
    } catch {
        throw new Error("PUBLIC_APP_URL is invalid. Use absolute URL, e.g. https://bibliotecacluj.com");
    }
}

const dbPath = path.join(rootDir, "data", "bcu.db");
const db = openDatabase(dbPath);
const repo = createRepository(db);
repo.ensureAdmin({
    username: config.adminUsername,
    password: config.adminPassword
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 40,
    standardHeaders: true,
    legacyHeaders: false
});

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 800,
    standardHeaders: true,
    legacyHeaders: false
});

const adminActionLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false
});

app.disable("x-powered-by");
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: "250kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https:"],
            frameAncestors: ["'none'"]
        }
    }
}));
app.use("/api", apiLimiter);

function sanitizeUsername(value) {
    return String(value || "").trim();
}

function sanitizeText(value, maxLength = 500) {
    return String(value || "").trim().slice(0, maxLength);
}

function sanitizeOptionalUrl(value) {
    const normalized = sanitizeText(value, 1024);
    if (!normalized) {
        return "";
    }

    try {
        const parsed = new URL(normalized);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
            return "";
        }
        return parsed.toString();
    } catch {
        return "";
    }
}

function isValidUsername(value) {
    return USERNAME_REGEX.test(String(value || ""));
}

function isValidRole(value) {
    return value === "admin" || value === "user";
}

function isValidProgressStatus(value) {
    return value === "none" || value === "reading" || value === "completed" || value === "wishlist";
}

function toAllowedBcuUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) {
        return null;
    }

    try {
        const parsed = new URL(raw);
        if (parsed.protocol !== "https:") {
            return null;
        }

        const isAllowed = BCU_ALLOWED_URLS.some((allowed) => {
            return parsed.hostname === allowed.hostname && parsed.pathname.startsWith(allowed.pathname);
        });

        if (!isAllowed) {
            return null;
        }

        return parsed.toString();
    } catch {
        return null;
    }
}

function normalizeBcuResourceUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) {
        return null;
    }

    try {
        const parsed = new URL(raw);
        if (parsed.protocol === "http:" && (parsed.hostname === "dspace.bcucluj.ro" || parsed.hostname === "public-view.bcucluj.ro")) {
            parsed.protocol = "https:";
        }

        const allowed = BCU_ALLOWED_URLS.some((entry) => {
            return parsed.protocol === "https:" && parsed.hostname === entry.hostname && parsed.pathname.startsWith(entry.pathname);
        });

        return allowed ? parsed.toString() : null;
    } catch {
        return null;
    }
}

function getResolvedUrlFromCache(sourceUrl) {
    const entry = bcuResolvedUrlCache.get(sourceUrl);
    if (!entry) {
        return null;
    }

    if (Date.now() - entry.savedAt > BCU_RESOLVED_TTL_MS) {
        bcuResolvedUrlCache.delete(sourceUrl);
        return null;
    }

    return entry.url;
}

function setResolvedUrlCache(sourceUrl, resolvedUrl) {
    bcuResolvedUrlCache.set(sourceUrl, {
        url: resolvedUrl,
        savedAt: Date.now()
    });
}

function extractDspacePdfUrl(html) {
    const metaMatch = html.match(/<meta\s+name=["']citation_pdf_url["']\s+content=["']([^"']+)["']/i);
    if (metaMatch && metaMatch[1]) {
        return metaMatch[1].replace(/&amp;/g, "&");
    }

    const bitstreamMatch = html.match(/href=["']([^"']*\/bitstream\/[^"']+)["']/i);
    if (bitstreamMatch && bitstreamMatch[1]) {
        const candidate = bitstreamMatch[1].replace(/&amp;/g, "&");
        return new URL(candidate, "https://dspace.bcucluj.ro").toString();
    }

    return null;
}

function safeDownloadFileName(value) {
    const raw = String(value || "").trim().replace(/[\\/:*?"<>|]+/g, "_").slice(0, 180);
    if (!raw) {
        return "document.pdf";
    }

    if (/\.pdf$/i.test(raw)) {
        return raw;
    }

    return `${raw}.pdf`;
}

function fileNameFromUrl(value) {
    try {
        const parsed = new URL(value);
        const candidate = decodeURIComponent(path.basename(parsed.pathname || "")).trim();
        if (!candidate) {
            return "document.pdf";
        }
        return safeDownloadFileName(candidate);
    } catch {
        return "document.pdf";
    }
}

async function resolveBcuFileUrl(sourceUrl) {
    if (!/https:\/\/dspace\.bcucluj\.ro\/handle\//i.test(sourceUrl)) {
        return sourceUrl;
    }

    const cached = getResolvedUrlFromCache(sourceUrl);
    if (cached) {
        return cached;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
        const upstream = await fetch(sourceUrl, {
            redirect: "follow",
            signal: controller.signal,
            headers: {
                "user-agent": "BCU-Library-Platform/1.0",
                accept: "text/html,*/*;q=0.8"
            }
        });

        if (!upstream.ok) {
            return sourceUrl;
        }

        const html = await upstream.text();
        const extracted = extractDspacePdfUrl(html);
        const resolvedUrl = normalizeBcuResourceUrl(extracted) || sourceUrl;
        setResolvedUrlCache(sourceUrl, resolvedUrl);
        return resolvedUrl;
    } finally {
        clearTimeout(timeout);
    }
}

function getTokenCookieOptions() {
    return {
        httpOnly: true,
        sameSite: "lax",
        secure: config.isProd,
        path: "/",
        maxAge: config.jwtExpiresHours * 60 * 60 * 1000
    };
}

function signSessionToken(user) {
    return jwt.sign(
        {
            sub: user.id,
            role: user.role,
            username: user.username
        },
        config.jwtSecret,
        {
            expiresIn: `${config.jwtExpiresHours}h`
        }
    );
}

function getSessionPayload(req) {
    const token = req.cookies?.bcu_session;
    if (!token) {
        return null;
    }

    try {
        return jwt.verify(token, config.jwtSecret);
    } catch {
        return null;
    }
}

function attachUserFromSession(req) {
    const payload = getSessionPayload(req);
    if (!payload) {
        req.user = null;
        return null;
    }

    const user = repo.getUserAuthById(Number(payload.sub));
    if (!user || user.is_active !== 1) {
        req.user = null;
        return null;
    }

    req.user = {
        id: user.id,
        username: user.username,
        role: user.role
    };
    return req.user;
}

function buildUserPayload(user) {
    const profile = repo.getUserProfile(user.id);
    return {
        id: user.id,
        username: user.username,
        role: user.role,
        displayName: profile?.display_name || user.username,
        avatarUrl: profile?.avatar_url || "",
        bio: profile?.bio || "",
        kindleEmail: profile?.kindle_email || ""
    };
}

function toSqlDateString(date) {
    return date.toISOString().slice(0, 19).replace("T", " ");
}

function parseSqlDate(value) {
    if (!value) {
        return null;
    }

    const timestamp = Date.parse(String(value).replace(" ", "T") + "Z");
    if (Number.isNaN(timestamp)) {
        return null;
    }

    return new Date(timestamp);
}

function isInviteLinkOpen(inviteLink) {
    if (!inviteLink || inviteLink.is_active !== 1) {
        return false;
    }

    const expiresAt = parseSqlDate(inviteLink.expires_at);
    if (expiresAt && expiresAt.getTime() <= Date.now()) {
        return false;
    }

    if (inviteLink.max_uses > 0 && inviteLink.uses_count >= inviteLink.max_uses) {
        return false;
    }

    return true;
}

function toInviteLinkPayload(inviteLink, req) {
    const origin = config.publicAppUrl || `${req.protocol}://${req.get("host")}`;
    return {
        id: inviteLink.id,
        token: inviteLink.token,
        maxUses: inviteLink.max_uses,
        usesCount: inviteLink.uses_count,
        isActive: inviteLink.is_active === 1,
        expiresAt: inviteLink.expires_at || null,
        createdAt: inviteLink.created_at,
        createdByUserId: inviteLink.created_by_user_id,
        createdByUsername: inviteLink.created_by_username || null,
        inviteUrl: `${origin}/app/invite/${encodeURIComponent(inviteLink.token)}`
    };
}

function toInviteRequestPayload(entry) {
    return {
        id: entry.id,
        inviteLinkId: entry.invite_link_id,
        inviteToken: entry.invite_token,
        username: entry.username,
        status: entry.status,
        decisionNote: entry.decision_note || "",
        invitedByUserId: entry.created_by_user_id,
        invitedByUsername: entry.invited_by_username || null,
        reviewedByUserId: entry.reviewed_by_user_id || null,
        reviewedByUsername: entry.reviewed_by_username || null,
        approvedUserId: entry.approved_user_id || null,
        requestedAt: entry.requested_at,
        reviewedAt: entry.reviewed_at || null
    };
}

function generateInviteToken() {
    return crypto.randomBytes(24).toString("base64url");
}

function requireAuth(req, res, next) {
    const user = attachUserFromSession(req);
    if (!user) {
        return res.status(401).json({ error: "Authentication required" });
    }
    return next();
}

function requireAdmin(req, res, next) {
    const user = req.user || attachUserFromSession(req);
    if (!user) {
        return res.status(401).json({ error: "Authentication required" });
    }
    if (user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
    }
    return next();
}

app.get("/health", (_req, res) => {
    res.json({ ok: true, uptimeSeconds: Math.round(process.uptime()) });
});

app.get("/api/public/stats", (_req, res) => {
    try {
        const stats = repo.getPublicStats();
        return res.json({ stats });
    } catch (error) {
        console.error("[Server] Public stats error:", error);
        return res.status(500).json({ error: "Cannot load public stats" });
    }
});

app.get("/api/bcu/html", requireAuth, async (req, res) => {
    const targetUrl = toAllowedBcuUrl(req.query.url);
    if (!targetUrl) {
        return res.status(400).json({ error: "Invalid BCU URL" });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
        const upstream = await fetch(targetUrl, {
            redirect: "follow",
            signal: controller.signal,
            headers: {
                "user-agent": "BCU-Library-Platform/1.0",
                accept: "text/html,*/*;q=0.8"
            }
        });

        if (!upstream.ok) {
            return res.status(upstream.status).json({ error: `BCU upstream HTTP ${upstream.status}` });
        }

        const body = await upstream.text();
        const contentType = upstream.headers.get("content-type") || "text/plain; charset=utf-8";
        return res.set("content-type", contentType).send(body);
    } catch (error) {
        if (error && error.name === "AbortError") {
            return res.status(504).json({ error: "BCU request timed out" });
        }
        return res.status(502).json({ error: "Cannot reach BCU listing" });
    } finally {
        clearTimeout(timeout);
    }
});

app.get("/api/bcu/resolve-file", requireAuth, async (req, res) => {
    const sourceUrl = normalizeBcuResourceUrl(req.query.url);
    if (!sourceUrl) {
        return res.status(400).json({ error: "Invalid resource URL" });
    }

    try {
        const resolvedUrl = await resolveBcuFileUrl(sourceUrl);
        return res.json({ url: resolvedUrl });
    } catch (error) {
        if (error && error.name === "AbortError") {
            return res.status(504).json({ error: "Resolve request timed out" });
        }
        return res.status(502).json({ error: "Cannot resolve file URL" });
    }
});

app.get("/api/bcu/download", requireAuth, async (req, res) => {
    const sourceUrl = normalizeBcuResourceUrl(req.query.url);
    if (!sourceUrl) {
        return res.status(400).json({ error: "Invalid resource URL" });
    }

    let resolvedUrl;
    try {
        resolvedUrl = await resolveBcuFileUrl(sourceUrl);
    } catch (error) {
        if (error && error.name === "AbortError") {
            return res.status(504).json({ error: "Resolve request timed out" });
        }
        return res.status(502).json({ error: "Cannot resolve file URL" });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
        const upstream = await fetch(resolvedUrl, {
            redirect: "follow",
            signal: controller.signal,
            headers: {
                "user-agent": "BCU-Library-Platform/1.0",
                accept: "application/pdf,*/*;q=0.8"
            }
        });

        if (!upstream.ok) {
            return res.status(upstream.status).json({ error: `BCU upstream HTTP ${upstream.status}` });
        }

        const contentType = upstream.headers.get("content-type") || "application/pdf";
        const downloadName = fileNameFromUrl(resolvedUrl);

        res.setHeader("content-type", contentType);
        res.setHeader("content-disposition", `attachment; filename=\"${downloadName}\"`);

        if (upstream.body) {
            Readable.fromWeb(upstream.body).pipe(res);
            return;
        }

        const buffer = Buffer.from(await upstream.arrayBuffer());
        return res.send(buffer);
    } catch (error) {
        if (error && error.name === "AbortError") {
            return res.status(504).json({ error: "Download request timed out" });
        }
        return res.status(502).json({ error: "Cannot download file" });
    } finally {
        clearTimeout(timeout);
    }
});

app.get(["/app/bcu/download", "/app/api/bcu/download"], (req, res) => {
    const queryIndex = req.originalUrl.indexOf("?");
    const query = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : "";
    return res.redirect(307, `/api/bcu/download${query}`);
});

// Faculty Catalog Indexing API
app.get("/api/bcu/catalog/:faculty", requireAuth, async (req, res) => {
    const facultyKey = req.params.faculty;
    if (!facultyKey) return res.status(400).json({ error: "Faculty key required" });

    try {
        const cached = repo.getFacultyCatalog(facultyKey);
        if (cached) {
            return res.json({
                books: JSON.parse(cached.books_json),
                indexedAt: cached.indexed_at,
                version: cached.version
            });
        }
        return res.status(404).json({ error: "Catalog not indexed yet" });
    } catch (error) {
        return res.status(500).json({ error: "Failed to fetch catalog" });
    }
});

app.get("/api/bcu/search", requireAuth, async (req, res) => {
    const query = sanitizeText(req.query.q, 100);
    if (!query) return res.status(400).json({ error: "Query required" });

    try {
        const results = repo.searchBooksGlobal(query);
        return res.json({ books: results });
    } catch (error) {
        console.error("[Server] Search error:", error);
        return res.status(500).json({ error: "Search failed" });
    }
});

app.post("/api/bcu/catalog/rebuild-all", requireAuth, requireAdmin, adminActionLimiter, async (req, res) => {
    // Start global indexing in background
    indexAllFaculties(async (key, label, books) => {
        repo.upsertFacultyCatalog({
            facultyKey: key,
            booksJson: JSON.stringify(books),
            version: 1
        });
        repo.clearAndInsertBooks(label, books);
    }).then(() => {
        console.log("[Server] Global indexing completed successfully.");
    }).catch((err) => {
        console.error("[Server] Global indexing failed:", err);
    });

    return res.json({ ok: true, message: "Global indexing started in background" });
});

app.post("/api/bcu/catalog/:faculty/rebuild", requireAuth, requireAdmin, adminActionLimiter, async (req, res) => {
    const facultyKey = req.params.faculty;
    const { label, url } = req.body;

    if (!facultyKey || !label || !url) {
        return res.status(400).json({ error: "Faculty key, label and url are required" });
    }

    // Start indexing in background (or foreground if small)
    try {
        const books = await indexFaculty(facultyKey, label, url);
        repo.upsertFacultyCatalog({
            facultyKey,
            booksJson: JSON.stringify(books),
            version: 1 // Start at 1
        });
        repo.clearAndInsertBooks(label, books);

        return res.json({
            ok: true,
            count: books.length,
            indexedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error(`[Server] Rebuild error for ${facultyKey}:`, error);
        return res.status(500).json({ error: "Indexing failed" });
    }
});

app.post("/api/auth/login", authLimiter, async (req, res) => {
    const username = sanitizeUsername(req.body?.username);
    const password = String(req.body?.password || "");

    if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
    }

    const user = repo.getUserAuthByUsername(username);
    if (!user || user.is_active !== 1) {
        return res.status(401).json({ error: "Invalid credentials" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
        return res.status(401).json({ error: "Invalid credentials" });
    }

    repo.updateLastLogin(user.id);
    repo.ensureUserProfile(user.id, user.username);

    const token = signSessionToken(user);
    res.cookie("bcu_session", token, getTokenCookieOptions());

    const payload = buildUserPayload(user);
    if (user.role === "admin") {
        payload.pendingInviteRequests = repo.getPendingInviteRequestCount();
    }

    return res.json({
        ok: true,
        user: payload
    });
});

app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("bcu_session", {
        httpOnly: true,
        sameSite: "lax",
        secure: config.isProd,
        path: "/"
    });
    return res.json({ ok: true });
});

app.get("/api/auth/me", (req, res) => {
    const user = attachUserFromSession(req);
    if (!user) {
        return res.status(200).json({ authenticated: false });
    }

    repo.ensureUserProfile(user.id, user.username);

    const payload = buildUserPayload(user);
    if (user.role === "admin") {
        payload.pendingInviteRequests = repo.getPendingInviteRequestCount();
    }

    return res.json({ authenticated: true, user: payload });
});

app.get("/api/user/invites", requireAuth, (req, res) => {
    const rows = repo.listInviteLinksByCreator(req.user.id).map((entry) => toInviteLinkPayload(entry, req));
    return res.json({ invites: rows });
});

app.post("/api/user/invites", requireAuth, (req, res) => {
    const rawExpiresInDays = Number(req.body?.expiresInDays);

    const totalByCreator = repo.countInviteLinksByCreator(req.user.id);
    if (totalByCreator >= 2) {
        return res.status(400).json({ error: "Poti genera maximum 2 linkuri de invitatie." });
    }

    const maxUses = 1;
    const expiresInDays = Number.isInteger(rawExpiresInDays) && rawExpiresInDays > 0
        ? Math.min(rawExpiresInDays, 90)
        : 14;
    const expiresAt = toSqlDateString(new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000));

    let created = null;
    for (let attempt = 0; attempt < 6; attempt += 1) {
        const token = generateInviteToken();
        if (repo.getInviteLinkByToken(token)) {
            continue;
        }

        created = repo.createInviteLink({
            token,
            createdByUserId: req.user.id,
            maxUses,
            expiresAt
        });
        break;
    }

    if (!created) {
        return res.status(500).json({ error: "Cannot generate invite link right now" });
    }

    const invites = repo.listInviteLinksByCreator(req.user.id);
    const createdInvite = invites.find((entry) => entry.id === created.lastInsertRowid);
    if (!createdInvite) {
        return res.status(500).json({ error: "Invite link created but cannot be loaded" });
    }

    return res.status(201).json({ ok: true, invite: toInviteLinkPayload(createdInvite, req) });
});

app.get("/api/invites/:token", (req, res) => {
    const token = sanitizeText(req.params.token, 240);
    if (!token) {
        return res.status(400).json({ error: "Invalid invite token" });
    }

    const invite = repo.getInviteLinkByToken(token);
    if (!invite) {
        return res.status(404).json({ error: "Invite link not found" });
    }

    if (!isInviteLinkOpen(invite)) {
        return res.status(410).json({ error: "Invite link is no longer valid" });
    }

    return res.json({
        invite: {
            token: invite.token,
            expiresAt: invite.expires_at || null,
            maxUses: invite.max_uses,
            usesCount: invite.uses_count,
            isActive: invite.is_active === 1
        }
    });
});

app.post("/api/invites/:token/register", authLimiter, async (req, res) => {
    const token = sanitizeText(req.params.token, 240);
    const username = sanitizeUsername(req.body?.username);
    const password = String(req.body?.password || "");

    if (!token) {
        return res.status(400).json({ error: "Invalid invite token" });
    }
    if (!isValidUsername(username)) {
        return res.status(400).json({ error: "Username must have 3-64 chars and contain only letters, numbers, ., _ or -" });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const invite = repo.getInviteLinkByToken(token);
    if (!invite || !isInviteLinkOpen(invite)) {
        return res.status(410).json({ error: "Invite link is no longer valid" });
    }

    if (repo.getUserAuthByUsername(username)) {
        return res.status(409).json({ error: "Username already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = repo.createInviteRequest({
        inviteLinkId: invite.id,
        username,
        passwordHash
    });

    if (!result.ok) {
        if (result.error === "USERNAME_EXISTS") {
            return res.status(409).json({ error: "Username already exists" });
        }
        if (result.error === "REQUEST_ALREADY_PENDING") {
            return res.status(409).json({ error: "A request for this username is already pending" });
        }
        if (result.error === "INVITE_NOT_AVAILABLE" || result.error === "INVITE_EXPIRED" || result.error === "INVITE_EXHAUSTED") {
            return res.status(410).json({ error: "Invite link is no longer valid" });
        }
        return res.status(500).json({ error: "Cannot create registration request" });
    }

    return res.status(201).json({
        ok: true,
        message: "Registration request submitted. An admin must approve your account."
    });
});

app.get("/api/admin/users", requireAuth, requireAdmin, (_req, res) => {
    const users = repo.listUsers().map((user) => ({
        id: user.id,
        username: user.username,
        role: user.role,
        isActive: user.is_active === 1,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        lastLoginAt: user.last_login_at
    }));

    return res.json({ users });
});

app.get("/api/admin/invite-requests/summary", requireAuth, requireAdmin, (_req, res) => {
    return res.json({ pendingCount: repo.getPendingInviteRequestCount() });
});

app.get("/api/admin/invite-requests", requireAuth, requireAdmin, (req, res) => {
    const rawStatus = sanitizeText(req.query.status, 20).toLowerCase();
    const status = rawStatus === "pending" || rawStatus === "approved" || rawStatus === "denied"
        ? rawStatus
        : null;

    const requests = repo.listInviteRequests(status).map(toInviteRequestPayload);
    return res.json({ requests });
});

app.patch("/api/admin/invite-requests/:id", requireAuth, requireAdmin, adminActionLimiter, (req, res) => {
    const requestId = Number(req.params.id);
    const decision = sanitizeText(req.body?.decision, 20).toLowerCase();
    const note = sanitizeText(req.body?.note, 240);

    if (!Number.isInteger(requestId) || requestId <= 0) {
        return res.status(400).json({ error: "Invalid request id" });
    }

    if (decision !== "approve" && decision !== "deny") {
        return res.status(400).json({ error: "Decision must be approve or deny" });
    }

    if (decision === "deny") {
        const denied = repo.denyInviteRequest({
            requestId,
            reviewedByUserId: req.user.id,
            decisionNote: note
        });

        if (!denied.changes) {
            return res.status(404).json({ error: "Pending request not found" });
        }

        return res.json({ ok: true, status: "denied" });
    }

    const approved = repo.approveInviteRequest({
        requestId,
        reviewedByUserId: req.user.id,
        decisionNote: note
    });

    if (!approved.ok) {
        if (approved.error === "REQUEST_NOT_PENDING") {
            return res.status(404).json({ error: "Pending request not found" });
        }
        if (approved.error === "USERNAME_EXISTS") {
            return res.status(409).json({ error: "Username already exists" });
        }
        if (approved.error === "REQUEST_ALREADY_PENDING") {
            return res.status(409).json({ error: "Another pending request exists for this username" });
        }
        return res.status(500).json({ error: "Cannot approve request" });
    }

    return res.json({
        ok: true,
        status: "approved",
        userId: approved.userId,
        username: approved.username
    });
});

app.post("/api/admin/users", requireAuth, requireAdmin, adminActionLimiter, async (req, res) => {
    const username = sanitizeUsername(req.body?.username);
    const password = String(req.body?.password || "");
    const role = String(req.body?.role || "user").toLowerCase();
    const isActive = req.body?.isActive !== false;

    if (!isValidUsername(username)) {
        return res.status(400).json({ error: "Username must have 3-64 chars and contain only letters, numbers, ., _ or -" });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    if (!isValidRole(role)) {
        return res.status(400).json({ error: "Invalid role" });
    }

    const existing = repo.getUserAuthByUsername(username);
    if (existing) {
        return res.status(409).json({ error: "Username already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    repo.createUser({ username, passwordHash, role, isActive });
    return res.status(201).json({ ok: true });
});

app.patch("/api/admin/users/:id", requireAuth, requireAdmin, adminActionLimiter, async (req, res) => {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({ error: "Invalid user id" });
    }

    const target = repo.getUserAuthById(userId);
    if (!target) {
        return res.status(404).json({ error: "User not found" });
    }

    const username = sanitizeUsername(req.body?.username || target.username);
    const role = String(req.body?.role || target.role).toLowerCase();
    const isActive = req.body?.isActive !== undefined ? Boolean(req.body.isActive) : target.is_active === 1;
    const newPassword = String(req.body?.password || "");

    if (!isValidUsername(username)) {
        return res.status(400).json({ error: "Username must have 3-64 chars and contain only letters, numbers, ., _ or -" });
    }
    if (!isValidRole(role)) {
        return res.status(400).json({ error: "Invalid role" });
    }

    const conflict = repo.getUserAuthByUsername(username);
    if (conflict && conflict.id !== userId) {
        return res.status(409).json({ error: "Username already exists" });
    }

    if (target.role === "admin" && !isActive && repo.countActiveAdmins() <= 1) {
        return res.status(400).json({ error: "At least one active admin is required" });
    }
    if (target.role === "admin" && role !== "admin" && repo.countActiveAdmins() <= 1) {
        return res.status(400).json({ error: "At least one active admin is required" });
    }

    let passwordHash;
    if (newPassword) {
        if (newPassword.length < 8) {
            return res.status(400).json({ error: "Password must be at least 8 characters" });
        }
        passwordHash = await bcrypt.hash(newPassword, 12);
    }

    repo.updateUser({
        id: userId,
        username,
        role,
        isActive,
        passwordHash
    });

    return res.json({ ok: true });
});

app.delete("/api/admin/users/:id", requireAuth, requireAdmin, adminActionLimiter, (req, res) => {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({ error: "Invalid user id" });
    }

    if (req.user.id === userId) {
        return res.status(400).json({ error: "You cannot delete your own account" });
    }

    const target = repo.getUserAuthById(userId);
    if (!target) {
        return res.status(404).json({ error: "User not found" });
    }

    if (target.role === "admin" && repo.countActiveAdmins() <= 1) {
        return res.status(400).json({ error: "At least one active admin is required" });
    }

    repo.deleteUser(userId);
    return res.json({ ok: true });
});

function decodeRouteParam(value) {
    try {
        return decodeURIComponent(String(value || ""));
    } catch {
        return String(value || "");
    }
}

function getOwnedListOrReject(req, res) {
    const listId = Number(req.params.id);
    if (!Number.isInteger(listId) || listId <= 0) {
        res.status(400).json({ error: "Invalid list id" });
        return null;
    }

    const list = repo.getReadingListById(listId);
    if (!list || list.user_id !== req.user.id) {
        res.status(404).json({ error: "List not found" });
        return null;
    }

    return list;
}

app.get("/api/user/profile", requireAuth, (req, res) => {
    repo.ensureUserProfile(req.user.id, req.user.username);
    return res.json({ profile: buildUserPayload(req.user) });
});

app.patch("/api/user/profile", requireAuth, (req, res) => {
    const displayName = sanitizeText(req.body?.displayName || req.user.username, 100);
    const avatarUrl = sanitizeOptionalUrl(req.body?.avatarUrl || "");
    const bio = sanitizeText(req.body?.bio || "", 600);
    const kindleEmail = sanitizeText(req.body?.kindleEmail || "", 254);

    if (!displayName) {
        return res.status(400).json({ error: "Display name is required" });
    }

    if (kindleEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(kindleEmail)) {
        return res.status(400).json({ error: "Invalid Kindle email address" });
    }

    repo.upsertUserProfile({
        userId: req.user.id,
        displayName,
        avatarUrl,
        bio,
        kindleEmail
    });

    return res.json({ ok: true, profile: buildUserPayload(req.user) });
});

const kindleSendLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false
});

app.post("/api/user/send-to-kindle", requireAuth, kindleSendLimiter, async (req, res) => {
    if (!config.smtp.host || !config.smtp.fromEmail) {
        return res.status(503).json({ error: "Send to Kindle is not configured on this server" });
    }

    const profile = repo.getUserProfile(req.user.id);
    const kindleEmail = profile?.kindle_email || "";
    if (!kindleEmail) {
        return res.status(400).json({ error: "No Kindle email set in your profile" });
    }

    const sourceUrl = normalizeBcuResourceUrl(req.body?.url);
    if (!sourceUrl) {
        return res.status(400).json({ error: "Invalid resource URL" });
    }

    const title = sanitizeText(req.body?.title || "Document", 300);

    let resolvedUrl;
    try {
        resolvedUrl = await resolveBcuFileUrl(sourceUrl);
    } catch (error) {
        if (error && error.name === "AbortError") {
            return res.status(504).json({ error: "Resolve request timed out" });
        }
        return res.status(502).json({ error: "Cannot resolve file URL" });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    let pdfBuffer;
    let downloadName;
    try {
        const upstream = await fetch(resolvedUrl, {
            redirect: "follow",
            signal: controller.signal,
            headers: {
                "user-agent": "BCU-Library-Platform/1.0",
                accept: "application/pdf,*/*;q=0.8"
            }
        });

        if (!upstream.ok) {
            return res.status(upstream.status).json({ error: `BCU upstream HTTP ${upstream.status}` });
        }

        pdfBuffer = Buffer.from(await upstream.arrayBuffer());
        downloadName = safeDownloadFileName(title || fileNameFromUrl(resolvedUrl));
    } catch (error) {
        if (error && error.name === "AbortError") {
            return res.status(504).json({ error: "Download request timed out" });
        }
        return res.status(502).json({ error: "Cannot download file" });
    } finally {
        clearTimeout(timeout);
    }

    try {
        const transporter = nodemailer.createTransport({
            host: config.smtp.host,
            port: config.smtp.port,
            secure: config.smtp.secure,
            auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined
        });

        await transporter.sendMail({
            from: config.smtp.fromEmail,
            to: kindleEmail,
            subject: title,
            text: `Attached: ${title}`,
            attachments: [
                {
                    filename: downloadName,
                    content: pdfBuffer,
                    contentType: "application/pdf"
                }
            ]
        });

        return res.json({ ok: true });
    } catch (error) {
        console.error("[Server] Send to Kindle email error:", error);
        return res.status(502).json({ error: "Failed to send email to Kindle" });
    }
});

app.get("/api/user/lists", requireAuth, (req, res) => {
    const lists = repo.listReadingLists(req.user.id).map((entry) => ({
        id: entry.id,
        name: entry.name,
        itemCount: entry.item_count,
        createdAt: entry.created_at,
        updatedAt: entry.updated_at
    }));

    return res.json({ lists });
});

app.post("/api/user/lists", requireAuth, (req, res) => {
    const name = sanitizeText(req.body?.name, 120);
    if (!name || name.length < 2) {
        return res.status(400).json({ error: "List name must be at least 2 characters" });
    }

    const result = repo.createReadingList({
        userId: req.user.id,
        name
    });

    return res.status(201).json({ ok: true, listId: result.lastInsertRowid });
});

app.patch("/api/user/lists/:id", requireAuth, (req, res) => {
    const list = getOwnedListOrReject(req, res);
    if (!list) {
        return;
    }

    const name = sanitizeText(req.body?.name, 120);
    if (!name || name.length < 2) {
        return res.status(400).json({ error: "List name must be at least 2 characters" });
    }

    repo.renameReadingList({ listId: list.id, name });
    return res.json({ ok: true });
});

app.delete("/api/user/lists/:id", requireAuth, (req, res) => {
    const list = getOwnedListOrReject(req, res);
    if (!list) {
        return;
    }

    repo.deleteReadingListById(list.id);
    return res.json({ ok: true });
});

app.get("/api/user/lists/:id/items", requireAuth, (req, res) => {
    const list = getOwnedListOrReject(req, res);
    if (!list) {
        return;
    }

    const items = repo.listReadingListItems(list.id).map((entry) => ({
        listId: entry.list_id,
        bookId: entry.book_id,
        title: entry.title,
        author: entry.author,
        coverImage: entry.cover_image,
        filePath: entry.file_path,
        addedAt: entry.added_at
    }));

    return res.json({ items });
});

app.post("/api/user/lists/:id/items", requireAuth, (req, res) => {
    const list = getOwnedListOrReject(req, res);
    if (!list) {
        return;
    }

    const bookId = sanitizeText(req.body?.bookId, 400);
    const title = sanitizeText(req.body?.title, 300);
    const author = sanitizeText(req.body?.author, 200);
    const coverImage = sanitizeOptionalUrl(req.body?.coverImage || "");
    const filePath = sanitizeText(req.body?.filePath, 2000);

    if (!bookId || !title || !filePath) {
        return res.status(400).json({ error: "bookId, title and filePath are required" });
    }

    repo.addOrUpdateReadingListItem({
        listId: list.id,
        bookId,
        title,
        author,
        coverImage,
        filePath
    });

    return res.status(201).json({ ok: true });
});

app.delete("/api/user/lists/:id/items/:bookId", requireAuth, (req, res) => {
    const list = getOwnedListOrReject(req, res);
    if (!list) {
        return;
    }

    const bookId = decodeRouteParam(req.params.bookId).trim();
    if (!bookId) {
        return res.status(400).json({ error: "Invalid book id" });
    }

    repo.removeReadingListItem({ listId: list.id, bookId });
    return res.json({ ok: true });
});

app.get("/api/user/progress", requireAuth, (req, res) => {
    const progress = repo.listReadingProgress(req.user.id).map((entry) => ({
        bookId: entry.book_id,
        title: entry.title,
        percentage: entry.percentage,
        status: entry.status,
        filePath: entry.file_path,
        coverImage: entry.cover_image,
        updatedAt: entry.updated_at
    }));

    return res.json({ progress });
});

app.put("/api/user/progress/:bookId", requireAuth, (req, res) => {
    const bookId = decodeRouteParam(req.params.bookId).trim();
    const title = sanitizeText(req.body?.title, 300);
    const filePath = sanitizeText(req.body?.filePath, 2000);
    const coverImage = sanitizeOptionalUrl(req.body?.coverImage || "");
    const rawPercentage = Number(req.body?.percentage);
    const percentage = Number.isFinite(rawPercentage) ? Math.max(0, Math.min(100, Math.round(rawPercentage))) : 0;

    let status = sanitizeText(req.body?.status, 20).toLowerCase();
    if (!status) {
        status = percentage >= 100 ? "completed" : percentage > 0 ? "reading" : "none";
    }

    if (!bookId || !title) {
        return res.status(400).json({ error: "bookId and title are required" });
    }
    if (!isValidProgressStatus(status)) {
        return res.status(400).json({ error: "Invalid status" });
    }

    repo.upsertReadingProgress({
        userId: req.user.id,
        bookId,
        title,
        percentage,
        status,
        filePath,
        coverImage
    });

    return res.json({ ok: true });
});

app.get("/api/user/history", requireAuth, (req, res) => {
    const progress = repo.listReadingProgress(req.user.id)
        .filter((entry) => entry.percentage > 0 || entry.status === "completed")
        .map((entry) => ({
            bookId: entry.book_id,
            title: entry.title,
            percentage: entry.percentage,
            status: entry.status,
            filePath: entry.file_path,
            coverImage: entry.cover_image,
            updatedAt: entry.updated_at
        }));

    return res.json({ items: progress });
});

app.get("/api/user/wishlist", requireAuth, (req, res) => {
    const wishlist = repo.listReadingProgressByStatus({ userId: req.user.id, status: "wishlist" }).map((entry) => ({
        bookId: entry.book_id,
        title: entry.title,
        percentage: entry.percentage,
        status: entry.status,
        filePath: entry.file_path,
        coverImage: entry.cover_image,
        updatedAt: entry.updated_at
    }));

    return res.json({ items: wishlist });
});

app.get("/api/user/dashboard-summary", requireAuth, (req, res) => {
    const summary = repo.getUserDashboardSummary(req.user.id);
    const recent = repo.listReadingProgress(req.user.id)
        .slice(0, 6)
        .map((entry) => ({
            bookId: entry.book_id,
            title: entry.title,
            percentage: entry.percentage,
            status: entry.status,
            filePath: entry.file_path,
            coverImage: entry.cover_image,
            updatedAt: entry.updated_at
        }));

    return res.json({ summary, recent });
});

app.get("/", (req, res) => {
    return res.redirect("/app");
});

app.get("/login", (_req, res) => {
    return res.redirect("/app/login");
});

app.use("/assets", (req, res, next) => {
    const assetsDir = path.join(newAppDistDir, "assets");
    if (!fs.existsSync(assetsDir)) {
        return next();
    }

    return express.static(assetsDir)(req, res, next);
});

app.use("/app", (req, res, next) => {
    if (!fs.existsSync(newAppDistDir)) {
        return next();
    }

    return express.static(newAppDistDir, { index: false })(req, res, next);
});

app.get("/app", (_req, res) => {
    if (!fs.existsSync(newAppDistDir)) {
        return res.status(503).send("newapp build not found. Run: npm --prefix newapp run build");
    }

    try {
        repo.incrementTotalAccesses();
    } catch (error) {
        console.error("[Server] Cannot increment total accesses:", error);
    }

    return res.sendFile(path.join(newAppDistDir, "index.html"));
});

app.get("/app/*", (_req, res) => {
    if (!fs.existsSync(newAppDistDir)) {
        return res.status(503).send("newapp build not found. Run: npm --prefix newapp run build");
    }

    try {
        repo.incrementTotalAccesses();
    } catch (error) {
        console.error("[Server] Cannot increment total accesses:", error);
    }

    return res.sendFile(path.join(newAppDistDir, "index.html"));
});

app.use((err, _req, res, _next) => {
    console.error("[ERROR]", err);
    res.status(500).json({ error: "Internal server error" });
});

app.listen(config.port, config.host, () => {
    console.log(`[BCU] Server running at http://${config.host}:${config.port}`);
    console.log(`[BCU] Default admin: ${config.adminUsername}`);
});
