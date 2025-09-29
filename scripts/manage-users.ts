#!/usr/bin/env bun

import * as readline from 'readline';
import * as path from 'path';
import { SQL } from 'bun';

const DB_PATH = path.join(__dirname, '../database/auth.db');

interface User {
	id: number;
	username: string;
	password_hash: string;
	created_at: number;
}

class UserManager {
	private readonly _db: SQL;

	public constructor() {
		this._db = new SQL(`sqlite://${DB_PATH}`);
	}

	public async init(): Promise<void> {
		// Create users table if it doesn't exist
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
	}

	private async hashPassword(password: string): Promise<string> {
		const hasher = new Bun.CryptoHasher('sha256');
		hasher.update(password);
		return hasher.digest('hex');
	}

	public async createUser(username: string, password: string): Promise<void> {
		try {
			const passwordHash = await this.hashPassword(password);
			const createdAt = Date.now();

			await this._db`
				INSERT INTO users (username, password_hash, created_at)
				VALUES (${username}, ${passwordHash}, ${createdAt})
			`;

			console.log(`✓ User '${username}' created successfully`);
		} catch (error) {
			if (
				error instanceof Error &&
				error.message.includes('UNIQUE constraint failed')
			) {
				console.error(`✗ User '${username}' already exists`);
			} else {
				console.error('✗ Failed to create user:', error);
			}
		}
	}

	public async deleteUser(username: string): Promise<void> {
		try {
			const result = await this
				._db`DELETE FROM users WHERE username = ${username}`;
			if (result.changes > 0) {
				console.log(`✓ User '${username}' deleted successfully`);
			} else {
				console.error(`✗ User '${username}' not found`);
			}
		} catch (error) {
			console.error('✗ Failed to delete user:', error);
		}
	}

	public async listUsers(): Promise<void> {
		const users = await this._db<
			Array<{ id: number; username: string; created_at: number }>
		>`
			SELECT id, username, created_at FROM users ORDER BY created_at DESC
		`;

		if (users.length === 0) {
			console.log('No users found');
			return;
		}

		console.log('\nUsers:');
		console.log('─'.repeat(60));
		for (const user of users) {
			const date = new Date(user.created_at).toLocaleString();
			console.log(
				`ID: ${user.id} | Username: ${user.username} | Created: ${date}`
			);
		}
		console.log('─'.repeat(60));
	}

	public async changePassword(
		username: string,
		newPassword: string
	): Promise<void> {
		try {
			const passwordHash = await this.hashPassword(newPassword);

			const result = await this._db`
				UPDATE users SET password_hash = ${passwordHash}
				WHERE username = ${username}
			`;

			if (result.changes > 0) {
				console.log(
					`✓ Password for user '${username}' changed successfully`
				);
			} else {
				console.error(`✗ User '${username}' not found`);
			}
		} catch (error) {
			console.error('✗ Failed to change password:', error);
		}
	}
}

function promptInput(question: string): Promise<string> {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	return new Promise((resolve) => {
		rl.question(question, (answer) => {
			rl.close();
			resolve(answer);
		});
	});
}

async function promptPassword(question: string): Promise<string> {
	// For Bun, we can use stdin directly with masking
	process.stdout.write(question);

	const password = await new Promise<string>((resolve) => {
		const stdin = process.stdin;
		stdin.setRawMode(true);
		stdin.resume();
		stdin.setEncoding('utf8');

		let pass = '';
		stdin.on('data', (char) => {
			const charStr = char.toString();
			if (charStr === '\n' || charStr === '\r' || charStr === '\u0004') {
				stdin.setRawMode(false);
				stdin.pause();
				process.stdout.write('\n');
				resolve(pass);
			} else if (charStr === '\u0003') {
				// Ctrl+C
				process.exit(0);
			} else if (charStr === '\u007f') {
				// Backspace
				if (pass.length > 0) {
					pass = pass.slice(0, -1);
					process.stdout.write('\b \b');
				}
			} else {
				pass += charStr;
				process.stdout.write('*');
			}
		});
	});

	return password;
}

async function main() {
	const manager = new UserManager();
	await manager.init();

	const args = process.argv.slice(2);
	const command = args[0];

	if (
		!command ||
		command === 'help' ||
		command === '--help' ||
		command === '-h'
	) {
		console.log('Usage: bun scripts/manage-users.ts <command> [options]');
		console.log('');
		console.log('Commands:');
		console.log('  create <username>          Create a new user');
		console.log('  delete <username>          Delete a user');
		console.log('  list                       List all users');
		console.log("  change-password <username> Change a user's password");
		console.log('  help                       Show this help message');
		process.exit(0);
	}

	switch (command) {
		case 'create': {
			const username = args[1];
			if (!username) {
				console.error('Error: Username is required');
				console.log(
					'Usage: bun scripts/manage-users.ts create <username>'
				);
				process.exit(1);
			}

			const password = await promptPassword('Enter password: ');
			const confirmPassword = await promptPassword('Confirm password: ');

			if (password !== confirmPassword) {
				console.error('✗ Passwords do not match');
				process.exit(1);
			}

			if (password.length < 6) {
				console.error('✗ Password must be at least 6 characters long');
				process.exit(1);
			}

			await manager.createUser(username, password);
			break;
		}

		case 'delete': {
			const username = args[1];
			if (!username) {
				console.error('Error: Username is required');
				console.log(
					'Usage: bun scripts/manage-users.ts delete <username>'
				);
				process.exit(1);
			}

			const confirm = await promptInput(
				`Are you sure you want to delete user '${username}'? (yes/no): `
			);
			if (
				confirm.toLowerCase() === 'yes' ||
				confirm.toLowerCase() === 'y'
			) {
				await manager.deleteUser(username);
			} else {
				console.log('Cancelled');
			}
			break;
		}

		case 'list': {
			await manager.listUsers();
			break;
		}

		case 'change-password': {
			const username = args[1];
			if (!username) {
				console.error('Error: Username is required');
				console.log(
					'Usage: bun scripts/manage-users.ts change-password <username>'
				);
				process.exit(1);
			}

			const password = await promptPassword('Enter new password: ');
			const confirmPassword = await promptPassword(
				'Confirm new password: '
			);

			if (password !== confirmPassword) {
				console.error('✗ Passwords do not match');
				process.exit(1);
			}

			if (password.length < 6) {
				console.error('✗ Password must be at least 6 characters long');
				process.exit(1);
			}

			await manager.changePassword(username, password);
			break;
		}

		default:
			console.error(`Unknown command: ${command}`);
			console.log('Run "bun scripts/manage-users.ts help" for usage');
			process.exit(1);
	}
}

main().catch((error) => {
	console.error('Error:', error);
	process.exit(1);
});
