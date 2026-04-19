const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");

function openDatabase(dbFilePath) {
    const dir = path.dirname(dbFilePath);
    fs.mkdirSync(dir, { recursive: true });

    const db = new Database(dbFilePath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");

    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            last_login_at TEXT
        );

        CREATE TABLE IF NOT EXISTS user_profiles (
            user_id INTEGER PRIMARY KEY,
            display_name TEXT NOT NULL,
            avatar_url TEXT NOT NULL DEFAULT '',
            bio TEXT NOT NULL DEFAULT '',
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS invite_links (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            token TEXT NOT NULL UNIQUE,
            created_by_user_id INTEGER NOT NULL,
            max_uses INTEGER NOT NULL DEFAULT 1,
            uses_count INTEGER NOT NULL DEFAULT 0,
            is_active INTEGER NOT NULL DEFAULT 1,
            expires_at TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS invite_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invite_link_id INTEGER NOT NULL,
            username TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'denied')),
            decision_note TEXT NOT NULL DEFAULT '',
            reviewed_by_user_id INTEGER,
            approved_user_id INTEGER,
            requested_at TEXT NOT NULL DEFAULT (datetime('now')),
            reviewed_at TEXT,
            FOREIGN KEY (invite_link_id) REFERENCES invite_links(id) ON DELETE CASCADE,
            FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY (approved_user_id) REFERENCES users(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS reading_lists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS reading_list_items (
            list_id INTEGER NOT NULL,
            book_id TEXT NOT NULL,
            title TEXT NOT NULL,
            author TEXT,
            cover_image TEXT,
            file_path TEXT NOT NULL,
            added_at TEXT NOT NULL DEFAULT (datetime('now')),
            PRIMARY KEY (list_id, book_id),
            FOREIGN KEY (list_id) REFERENCES reading_lists(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS reading_progress (
            user_id INTEGER NOT NULL,
            book_id TEXT NOT NULL,
            title TEXT NOT NULL,
            percentage INTEGER NOT NULL DEFAULT 0 CHECK(percentage >= 0 AND percentage <= 100),
            status TEXT NOT NULL DEFAULT 'none' CHECK(status IN ('none', 'reading', 'completed', 'wishlist')),
            file_path TEXT,
            cover_image TEXT,
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            PRIMARY KEY (user_id, book_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS faculty_catalogs (
            faculty_key TEXT PRIMARY KEY,
            books_json TEXT NOT NULL,
            indexed_at TEXT NOT NULL DEFAULT (datetime('now')),
            version INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS books (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            author TEXT,
            description TEXT,
            cover_image TEXT,
            faculty TEXT NOT NULL,
            department TEXT,
            language TEXT,
            published_year INTEGER,
            file_path TEXT NOT NULL,
            folder_path TEXT NOT NULL,
            indexed_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS app_metrics (
            id INTEGER PRIMARY KEY CHECK(id = 1),
            total_accesses INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        INSERT INTO app_metrics (id, total_accesses, updated_at)
        SELECT 1, 0, datetime('now')
        WHERE NOT EXISTS (SELECT 1 FROM app_metrics WHERE id = 1);

        CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);
        CREATE INDEX IF NOT EXISTS idx_books_author ON books(author);
        CREATE INDEX IF NOT EXISTS idx_books_faculty ON books(faculty);
        CREATE INDEX IF NOT EXISTS idx_books_department ON books(department);

        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
        CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
        CREATE INDEX IF NOT EXISTS idx_invite_links_token ON invite_links(token);
        CREATE INDEX IF NOT EXISTS idx_invite_links_creator ON invite_links(created_by_user_id);
        CREATE INDEX IF NOT EXISTS idx_invite_requests_status ON invite_requests(status);
        CREATE INDEX IF NOT EXISTS idx_invite_requests_username ON invite_requests(username);
        CREATE INDEX IF NOT EXISTS idx_reading_lists_user ON reading_lists(user_id);
        CREATE INDEX IF NOT EXISTS idx_reading_progress_user ON reading_progress(user_id);
        CREATE INDEX IF NOT EXISTS idx_reading_progress_status ON reading_progress(user_id, status);
    `);

    return db;
}

function createRepository(db) {
    const statements = {
        getUserById: db.prepare(`
            SELECT id, username, role, is_active, created_at, updated_at, last_login_at
            FROM users
            WHERE id = ?
        `),
        getUserAuthById: db.prepare(`
            SELECT id, username, password_hash, role, is_active
            FROM users
            WHERE id = ?
        `),
        getUserAuthByUsername: db.prepare(`
            SELECT id, username, password_hash, role, is_active
            FROM users
            WHERE lower(username) = lower(?)
        `),
        listUsers: db.prepare(`
            SELECT id, username, role, is_active, created_at, updated_at, last_login_at
            FROM users
            ORDER BY created_at DESC, id DESC
        `),
        countAdmins: db.prepare(`
            SELECT COUNT(*) AS total
            FROM users
            WHERE role = 'admin' AND is_active = 1
        `),
        insertUser: db.prepare(`
            INSERT INTO users (username, password_hash, role, is_active)
            VALUES (?, ?, ?, ?)
        `),
        updateUser: db.prepare(`
            UPDATE users
            SET username = ?, role = ?, is_active = ?, updated_at = datetime('now')
            WHERE id = ?
        `),
        updateUserWithPassword: db.prepare(`
            UPDATE users
            SET username = ?, password_hash = ?, role = ?, is_active = ?, updated_at = datetime('now')
            WHERE id = ?
        `),
        updateLastLogin: db.prepare(`
            UPDATE users
            SET last_login_at = datetime('now'), updated_at = datetime('now')
            WHERE id = ?
        `),
        deleteUser: db.prepare(`
            DELETE FROM users
            WHERE id = ?
        `),
        createInviteLink: db.prepare(`
            INSERT INTO invite_links (token, created_by_user_id, max_uses, expires_at)
            VALUES (?, ?, ?, ?)
        `),
        listInviteLinksByCreator: db.prepare(`
            SELECT
                il.id,
                il.token,
                il.created_by_user_id,
                il.max_uses,
                il.uses_count,
                il.is_active,
                il.expires_at,
                il.created_at,
                u.username AS created_by_username
            FROM invite_links il
            LEFT JOIN users u ON u.id = il.created_by_user_id
            WHERE il.created_by_user_id = ?
            ORDER BY il.created_at DESC, il.id DESC
            LIMIT 50
        `),
        countInviteLinksByCreator: db.prepare(`
            SELECT COUNT(*) AS total
            FROM invite_links
            WHERE created_by_user_id = ?
        `),
        getInviteLinkById: db.prepare(`
            SELECT id, token, created_by_user_id, max_uses, uses_count, is_active, expires_at, created_at
            FROM invite_links
            WHERE id = ?
        `),
        getInviteLinkByToken: db.prepare(`
            SELECT id, token, created_by_user_id, max_uses, uses_count, is_active, expires_at, created_at
            FROM invite_links
            WHERE token = ?
        `),
        getActiveInviteLinkByToken: db.prepare(`
            SELECT id, token, created_by_user_id, max_uses, uses_count, is_active, expires_at, created_at
            FROM invite_links
            WHERE token = ?
              AND is_active = 1
              AND (expires_at IS NULL OR expires_at > datetime('now'))
              AND (max_uses <= 0 OR uses_count < max_uses)
        `),
        incrementInviteLinkUse: db.prepare(`
            UPDATE invite_links
            SET
                uses_count = uses_count + 1,
                is_active = CASE
                    WHEN max_uses > 0 AND (uses_count + 1) >= max_uses THEN 0
                    ELSE is_active
                END
            WHERE id = ?
        `),
        getPendingInviteRequestByUsername: db.prepare(`
            SELECT id, invite_link_id, username, status
            FROM invite_requests
            WHERE lower(username) = lower(?) AND status = 'pending'
            ORDER BY requested_at DESC
            LIMIT 1
        `),
        createInviteRequest: db.prepare(`
            INSERT INTO invite_requests (invite_link_id, username, password_hash, status)
            VALUES (?, ?, ?, 'pending')
        `),
        getInviteRequestById: db.prepare(`
            SELECT id, invite_link_id, username, password_hash, status, requested_at
            FROM invite_requests
            WHERE id = ?
        `),
        listInviteRequestsAll: db.prepare(`
            SELECT
                ir.id,
                ir.invite_link_id,
                ir.username,
                ir.status,
                ir.decision_note,
                ir.reviewed_by_user_id,
                ir.approved_user_id,
                ir.requested_at,
                ir.reviewed_at,
                il.token AS invite_token,
                il.created_by_user_id,
                iu.username AS invited_by_username,
                ru.username AS reviewed_by_username
            FROM invite_requests ir
            JOIN invite_links il ON il.id = ir.invite_link_id
            LEFT JOIN users iu ON iu.id = il.created_by_user_id
            LEFT JOIN users ru ON ru.id = ir.reviewed_by_user_id
            ORDER BY
                CASE ir.status WHEN 'pending' THEN 0 ELSE 1 END,
                ir.requested_at DESC,
                ir.id DESC
        `),
        listInviteRequestsByStatus: db.prepare(`
            SELECT
                ir.id,
                ir.invite_link_id,
                ir.username,
                ir.status,
                ir.decision_note,
                ir.reviewed_by_user_id,
                ir.approved_user_id,
                ir.requested_at,
                ir.reviewed_at,
                il.token AS invite_token,
                il.created_by_user_id,
                iu.username AS invited_by_username,
                ru.username AS reviewed_by_username
            FROM invite_requests ir
            JOIN invite_links il ON il.id = ir.invite_link_id
            LEFT JOIN users iu ON iu.id = il.created_by_user_id
            LEFT JOIN users ru ON ru.id = ir.reviewed_by_user_id
            WHERE ir.status = ?
            ORDER BY ir.requested_at DESC, ir.id DESC
        `),
        getPendingInviteRequestCount: db.prepare(`
            SELECT COUNT(*) AS total
            FROM invite_requests
            WHERE status = 'pending'
        `),
        approveInviteRequest: db.prepare(`
            UPDATE invite_requests
            SET
                status = 'approved',
                decision_note = ?,
                reviewed_by_user_id = ?,
                approved_user_id = ?,
                reviewed_at = datetime('now')
            WHERE id = ? AND status = 'pending'
        `),
        denyInviteRequest: db.prepare(`
            UPDATE invite_requests
            SET
                status = 'denied',
                decision_note = ?,
                reviewed_by_user_id = ?,
                reviewed_at = datetime('now')
            WHERE id = ? AND status = 'pending'
        `),
        ensureUserProfile: db.prepare(`
            INSERT INTO user_profiles (user_id, display_name, avatar_url, bio, updated_at)
            VALUES (?, ?, '', '', datetime('now'))
            ON CONFLICT(user_id) DO NOTHING
        `),
        getUserProfile: db.prepare(`
            SELECT user_id, display_name, avatar_url, bio, updated_at
            FROM user_profiles
            WHERE user_id = ?
        `),
        upsertUserProfile: db.prepare(`
            INSERT INTO user_profiles (user_id, display_name, avatar_url, bio, updated_at)
            VALUES (?, ?, ?, ?, datetime('now'))
            ON CONFLICT(user_id) DO UPDATE SET
                display_name = excluded.display_name,
                avatar_url = excluded.avatar_url,
                bio = excluded.bio,
                updated_at = datetime('now')
        `),
        listReadingLists: db.prepare(`
            SELECT rl.id, rl.name, rl.created_at, rl.updated_at,
                COUNT(rli.book_id) AS item_count
            FROM reading_lists rl
            LEFT JOIN reading_list_items rli ON rli.list_id = rl.id
            WHERE rl.user_id = ?
            GROUP BY rl.id
            ORDER BY rl.updated_at DESC, rl.id DESC
        `),
        getReadingListById: db.prepare(`
            SELECT id, user_id, name, created_at, updated_at
            FROM reading_lists
            WHERE id = ?
        `),
        insertReadingList: db.prepare(`
            INSERT INTO reading_lists (user_id, name)
            VALUES (?, ?)
        `),
        updateReadingListName: db.prepare(`
            UPDATE reading_lists
            SET name = ?, updated_at = datetime('now')
            WHERE id = ?
        `),
        deleteReadingList: db.prepare(`
            DELETE FROM reading_lists
            WHERE id = ?
        `),
        listReadingListItems: db.prepare(`
            SELECT list_id, book_id, title, author, cover_image, file_path, added_at
            FROM reading_list_items
            WHERE list_id = ?
            ORDER BY added_at DESC
        `),
        upsertReadingListItem: db.prepare(`
            INSERT INTO reading_list_items (list_id, book_id, title, author, cover_image, file_path)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(list_id, book_id) DO UPDATE SET
                title = excluded.title,
                author = excluded.author,
                cover_image = excluded.cover_image,
                file_path = excluded.file_path,
                added_at = datetime('now')
        `),
        removeReadingListItem: db.prepare(`
            DELETE FROM reading_list_items
            WHERE list_id = ? AND book_id = ?
        `),
        getReadingProgressByBook: db.prepare(`
            SELECT user_id, book_id, title, percentage, status, file_path, cover_image, updated_at
            FROM reading_progress
            WHERE user_id = ? AND book_id = ?
        `),
        listReadingProgress: db.prepare(`
            SELECT user_id, book_id, title, percentage, status, file_path, cover_image, updated_at
            FROM reading_progress
            WHERE user_id = ?
            ORDER BY updated_at DESC
        `),
        listReadingProgressByStatus: db.prepare(`
            SELECT user_id, book_id, title, percentage, status, file_path, cover_image, updated_at
            FROM reading_progress
            WHERE user_id = ? AND status = ?
            ORDER BY updated_at DESC
        `),
        upsertReadingProgress: db.prepare(`
            INSERT INTO reading_progress (user_id, book_id, title, percentage, status, file_path, cover_image, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(user_id, book_id) DO UPDATE SET
                title = excluded.title,
                percentage = excluded.percentage,
                status = excluded.status,
                file_path = excluded.file_path,
                cover_image = excluded.cover_image,
                updated_at = datetime('now')
        `),
        getProgressSummary: db.prepare(`
            SELECT
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
                SUM(CASE WHEN status = 'reading' THEN 1 ELSE 0 END) AS reading_count,
                SUM(CASE WHEN status = 'wishlist' THEN 1 ELSE 0 END) AS wishlist_count,
                COUNT(*) AS tracked_count
            FROM reading_progress
            WHERE user_id = ?
        `),
        getReadingListCount: db.prepare(`
            SELECT COUNT(*) AS total
            FROM reading_lists
            WHERE user_id = ?
        `),
        getFacultyCatalog: db.prepare(`
            SELECT faculty_key, books_json, indexed_at, version
            FROM faculty_catalogs
            WHERE faculty_key = ?
        `),
        upsertFacultyCatalog: db.prepare(`
            INSERT INTO faculty_catalogs (faculty_key, books_json, indexed_at, version)
            VALUES (?, ?, datetime('now'), ?)
            ON CONFLICT(faculty_key) DO UPDATE SET
                books_json = excluded.books_json,
                indexed_at = datetime('now'),
                version = excluded.version
        `),
        clearBooksByFaculty: db.prepare(`
            DELETE FROM books WHERE faculty = ?
        `),
        insertBook: db.prepare(`
            INSERT INTO books (
                id, title, author, description, cover_image, faculty, 
                department, language, published_year, file_path, folder_path
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `),
        searchBooks: db.prepare(`
            SELECT id, title, author, description, cover_image, faculty, department, language, published_year, file_path, folder_path
            FROM books
            WHERE title LIKE ? OR author LIKE ? OR faculty LIKE ? OR department LIKE ?
            LIMIT 100
        `),
        getPublicStats: db.prepare(`
            SELECT
                (SELECT COUNT(*) FROM books) AS total_documents,
                (
                    SELECT COUNT(DISTINCT trim(faculty))
                    FROM books
                    WHERE trim(COALESCE(faculty, '')) <> ''
                ) AS total_faculties,
                (
                    SELECT COUNT(DISTINCT trim(department))
                    FROM books
                    WHERE trim(COALESCE(department, '')) <> '' AND lower(trim(department)) <> 'general'
                ) AS total_departments,
                (SELECT COUNT(*) FROM users WHERE is_active = 1) AS total_users,
                (SELECT total_accesses FROM app_metrics WHERE id = 1) AS total_accesses
        `),
        incrementTotalAccesses: db.prepare(`
            UPDATE app_metrics
            SET total_accesses = total_accesses + 1,
                updated_at = datetime('now')
            WHERE id = 1
        `)
    };

    const ensureUserProfile = (userId, username) => {
        statements.ensureUserProfile.run(userId, username);
    };

    const createInviteRequestTransaction = db.transaction(({ inviteLinkId, username, passwordHash }) => {
        const inviteLink = statements.getInviteLinkById.get(inviteLinkId);
        if (!inviteLink || inviteLink.is_active !== 1) {
            return { ok: false, error: "INVITE_NOT_AVAILABLE" };
        }

        if (inviteLink.expires_at) {
            const expiryTimestamp = Date.parse(String(inviteLink.expires_at).replace(" ", "T") + "Z");
            if (Number.isFinite(expiryTimestamp) && expiryTimestamp <= Date.now()) {
                return { ok: false, error: "INVITE_EXPIRED" };
            }
        }

        if (inviteLink.max_uses > 0 && inviteLink.uses_count >= inviteLink.max_uses) {
            return { ok: false, error: "INVITE_EXHAUSTED" };
        }

        const existingUser = statements.getUserAuthByUsername.get(username);
        if (existingUser) {
            return { ok: false, error: "USERNAME_EXISTS" };
        }

        const pending = statements.getPendingInviteRequestByUsername.get(username);
        if (pending) {
            return { ok: false, error: "REQUEST_ALREADY_PENDING" };
        }

        const created = statements.createInviteRequest.run(inviteLink.id, username, passwordHash);
        statements.incrementInviteLinkUse.run(inviteLink.id);
        return { ok: true, requestId: created.lastInsertRowid };
    });

    const approveInviteRequestTransaction = db.transaction(({ requestId, reviewedByUserId, decisionNote }) => {
        const request = statements.getInviteRequestById.get(requestId);
        if (!request || request.status !== "pending") {
            return { ok: false, error: "REQUEST_NOT_PENDING" };
        }

        const existingUser = statements.getUserAuthByUsername.get(request.username);
        if (existingUser) {
            return { ok: false, error: "USERNAME_EXISTS" };
        }

        const duplicatePending = statements.getPendingInviteRequestByUsername.get(request.username);
        if (duplicatePending && duplicatePending.id !== request.id) {
            return { ok: false, error: "REQUEST_ALREADY_PENDING" };
        }

        const createdUser = statements.insertUser.run(request.username, request.password_hash, "user", 1);
        statements.approveInviteRequest.run(decisionNote || "", reviewedByUserId, createdUser.lastInsertRowid, request.id);
        ensureUserProfile(createdUser.lastInsertRowid, request.username);

        return {
            ok: true,
            userId: createdUser.lastInsertRowid,
            username: request.username
        };
    });

    const ensureAdmin = ({ username, password }) => {
        const existing = statements.getUserAuthByUsername.get(username);
        if (existing) {
            ensureUserProfile(existing.id, existing.username);
            return;
        }

        const passwordHash = bcrypt.hashSync(password, 12);
        const result = statements.insertUser.run(username, passwordHash, "admin", 1);
        ensureUserProfile(result.lastInsertRowid, username);
    };

    return {
        ensureAdmin,
        ensureUserProfile,
        getUserById: (id) => statements.getUserById.get(id),
        getUserAuthById: (id) => statements.getUserAuthById.get(id),
        getUserAuthByUsername: (username) => statements.getUserAuthByUsername.get(username),
        listUsers: () => statements.listUsers.all(),
        countActiveAdmins: () => statements.countAdmins.get().total,
        createUser: ({ username, passwordHash, role, isActive }) => {
            const result = statements.insertUser.run(username, passwordHash, role, isActive ? 1 : 0);
            ensureUserProfile(result.lastInsertRowid, username);
            return result;
        },
        updateUser: ({ id, username, role, isActive, passwordHash }) => {
            if (passwordHash) {
                return statements.updateUserWithPassword.run(username, passwordHash, role, isActive ? 1 : 0, id);
            }
            return statements.updateUser.run(username, role, isActive ? 1 : 0, id);
        },
        updateLastLogin: (id) => statements.updateLastLogin.run(id),
        deleteUser: (id) => statements.deleteUser.run(id),
        createInviteLink: ({ token, createdByUserId, maxUses, expiresAt }) =>
            statements.createInviteLink.run(token, createdByUserId, maxUses, expiresAt || null),
        listInviteLinksByCreator: (userId) => statements.listInviteLinksByCreator.all(userId),
        countInviteLinksByCreator: (userId) => {
            const row = statements.countInviteLinksByCreator.get(userId);
            return Number(row?.total || 0);
        },
        getInviteLinkByToken: (token) => statements.getInviteLinkByToken.get(token),
        getActiveInviteLinkByToken: (token) => statements.getActiveInviteLinkByToken.get(token),
        createInviteRequest: ({ inviteLinkId, username, passwordHash }) =>
            createInviteRequestTransaction({ inviteLinkId, username, passwordHash }),
        listInviteRequests: (status) =>
            status ? statements.listInviteRequestsByStatus.all(status) : statements.listInviteRequestsAll.all(),
        getPendingInviteRequestCount: () => statements.getPendingInviteRequestCount.get().total,
        denyInviteRequest: ({ requestId, reviewedByUserId, decisionNote }) =>
            statements.denyInviteRequest.run(decisionNote || "", reviewedByUserId, requestId),
        approveInviteRequest: ({ requestId, reviewedByUserId, decisionNote }) =>
            approveInviteRequestTransaction({ requestId, reviewedByUserId, decisionNote }),
        getUserProfile: (userId) => statements.getUserProfile.get(userId),
        upsertUserProfile: ({ userId, displayName, avatarUrl, bio }) =>
            statements.upsertUserProfile.run(userId, displayName, avatarUrl || "", bio || ""),
        listReadingLists: (userId) => statements.listReadingLists.all(userId),
        getReadingListById: (listId) => statements.getReadingListById.get(listId),
        createReadingList: ({ userId, name }) => statements.insertReadingList.run(userId, name),
        renameReadingList: ({ listId, name }) => statements.updateReadingListName.run(name, listId),
        deleteReadingListById: (listId) => statements.deleteReadingList.run(listId),
        listReadingListItems: (listId) => statements.listReadingListItems.all(listId),
        addOrUpdateReadingListItem: ({ listId, bookId, title, author, coverImage, filePath }) =>
            statements.upsertReadingListItem.run(listId, bookId, title, author || null, coverImage || null, filePath),
        removeReadingListItem: ({ listId, bookId }) => statements.removeReadingListItem.run(listId, bookId),
        getReadingProgressByBook: ({ userId, bookId }) => statements.getReadingProgressByBook.get(userId, bookId),
        listReadingProgress: (userId) => statements.listReadingProgress.all(userId),
        listReadingProgressByStatus: ({ userId, status }) => statements.listReadingProgressByStatus.all(userId, status),
        upsertReadingProgress: ({ userId, bookId, title, percentage, status, filePath, coverImage }) =>
            statements.upsertReadingProgress.run(userId, bookId, title, percentage, status, filePath || null, coverImage || null),
        getUserDashboardSummary: (userId) => {
            const progress = statements.getProgressSummary.get(userId) || {};
            const lists = statements.getReadingListCount.get(userId) || { total: 0 };
            return {
                completedCount: progress.completed_count || 0,
                readingCount: progress.reading_count || 0,
                wishlistCount: progress.wishlist_count || 0,
                trackedCount: progress.tracked_count || 0,
                listCount: lists.total || 0
            };
        },
        getFacultyCatalog: (facultyKey) => statements.getFacultyCatalog.get(facultyKey),
        upsertFacultyCatalog: ({ facultyKey, booksJson, version }) =>
            statements.upsertFacultyCatalog.run(facultyKey, booksJson, version),
        clearAndInsertBooks: (facultyName, books) => {
            const transaction = db.transaction((booksList) => {
                statements.clearBooksByFaculty.run(facultyName);
                for (const book of booksList) {
                    statements.insertBook.run(
                        book.id, book.title, book.author, book.description, book.coverImage,
                        book.faculty, book.department, book.language, book.publishedYear || null,
                        book.filePath, book.folderPath || ""
                    );
                }
            });
            transaction(books);
        },
        searchBooksGlobal: (query) => {
            const q = `%${query}%`;
            return statements.searchBooks.all(q, q, q, q);
        },
        getPublicStats: () => {
            const row = statements.getPublicStats.get() || {};
            return {
                totalDocuments: Number(row.total_documents || 0),
                totalFaculties: Number(row.total_faculties || 0),
                totalDepartments: Number(row.total_departments || 0),
                totalUsers: Number(row.total_users || 0),
                totalAccesses: Number(row.total_accesses || 0)
            };
        },
        incrementTotalAccesses: () => statements.incrementTotalAccesses.run()
    };
}

module.exports = {
    openDatabase,
    createRepository
};
