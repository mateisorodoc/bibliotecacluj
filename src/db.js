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

        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
        CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
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
        `)
    };

    const ensureUserProfile = (userId, username) => {
        statements.ensureUserProfile.run(userId, username);
    };

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
        }
    };
}

module.exports = {
    openDatabase,
    createRepository
};
