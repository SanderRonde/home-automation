import type { SQL } from 'bun';

export interface User {
	id: number;
	username: string;
	password_hash: string;
	created_at: number;
}

export interface Session {
	id: string;
	user_id: number;
	created_at: number;
	expires_at: number;
}

export class UserManagement {
	public constructor(private readonly _db: SQL) {}

	public async init(): Promise<void> {
		// Create users table
		const usersTableExists = await this._db<{ name: string }[]>`
			SELECT name FROM sqlite_master WHERE type='table' AND name='users'
		`;

		if (!usersTableExists.length) {
			await this._db`
				CREATE TABLE users (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					username TEXT NOT NULL UNIQUE,
					password_hash TEXT NOT NULL,
					created_at INTEGER NOT NULL
				)
			`;
		}

		// Create sessions table
		const sessionsTableExists = await this._db<{ name: string }[]>`
			SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'
		`;

		if (!sessionsTableExists.length) {
			await this._db`
				CREATE TABLE sessions (
					id TEXT PRIMARY KEY,
					user_id INTEGER NOT NULL,
					created_at INTEGER NOT NULL,
					expires_at INTEGER NOT NULL,
					FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
				)
			`;
			// Add index for faster session lookups
			await this._db`
				CREATE INDEX idx_sessions_expires_at ON sessions(expires_at)
			`;
		}
	}

	public hashPassword(password: string): string {
		const hasher = new Bun.CryptoHasher('sha256');
		hasher.update(password);
		return hasher.digest('hex');
	}

	public async createUser(
		username: string,
		password: string
	): Promise<User | null> {
		try {
			const passwordHash = this.hashPassword(password);
			const createdAt = Date.now();

			await this._db`
				INSERT INTO users (username, password_hash, created_at)
				VALUES (${username}, ${passwordHash}, ${createdAt})
			`;

			const users = await this._db<User[]>`
				SELECT id, username, password_hash, created_at
				FROM users WHERE username = ${username}
			`;

			return users[0] || null;
		} catch (error) {
			console.error('Failed to create user:', error);
			return null;
		}
	}

	public async deleteUser(username: string): Promise<boolean> {
		try {
			await this._db`DELETE FROM users WHERE username = ${username}`;
			return true;
		} catch (error) {
			console.error('Failed to delete user:', error);
			return false;
		}
	}

	public async verifyCredentials(
		username: string,
		password: string
	): Promise<User | null> {
		const passwordHash = this.hashPassword(password);

		const users = await this._db<User[]>`
			SELECT id, username, password_hash, created_at
			FROM users
			WHERE username = ${username} AND password_hash = ${passwordHash}
		`;

		return users[0] || null;
	}

	public async createSession(userId: number): Promise<string> {
		// Generate a random session ID
		const sessionId = crypto.randomUUID();
		const createdAt = Date.now();
		// Sessions expire after a year
		const expiresAt = createdAt + 365.25 * 24 * 60 * 60 * 1000;

		await this._db`
			INSERT INTO sessions (id, user_id, created_at, expires_at)
			VALUES (${sessionId}, ${userId}, ${createdAt}, ${expiresAt})
		`;

		return sessionId;
	}

	public async verifySession(sessionId: string): Promise<User | null> {
		// Clean up expired sessions first
		await this.cleanupExpiredSessions();

		const sessions = await this._db<(Session & User)[]>`
			SELECT users.id, users.username, users.password_hash, users.created_at
			FROM sessions
			JOIN users ON sessions.user_id = users.id
			WHERE sessions.id = ${sessionId} AND sessions.expires_at > ${Date.now()}
		`;

		return sessions[0] || null;
	}

	public async deleteSession(sessionId: string): Promise<void> {
		await this._db`DELETE FROM sessions WHERE id = ${sessionId}`;
	}

	public async cleanupExpiredSessions(): Promise<void> {
		await this._db`DELETE FROM sessions WHERE expires_at <= ${Date.now()}`;
	}

	public async listUsers(): Promise<
		Array<{ id: number; username: string; created_at: number }>
	> {
		const users = await this._db<
			Array<{ id: number; username: string; created_at: number }>
		>`
			SELECT id, username, created_at FROM users ORDER BY created_at DESC
		`;
		return users;
	}
}
