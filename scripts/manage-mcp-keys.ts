#!/usr/bin/env bun

import { logImmediate } from '../app/server/lib/logging/logger';
import type { MCPDB } from '../app/server/modules/mcp';
import { Database } from '../app/server/lib/db';

/**
 * Manage MCP authorization keys
 * Usage:
 *   bun scripts/manage-mcp-keys.ts list                    # List all keys
 *   bun scripts/manage-mcp-keys.ts remove <key>            # Remove specific key
 *   bun scripts/manage-mcp-keys.ts clear                   # Remove all keys
 */

function listKeys(): void {
	const db = new Database<MCPDB>('mcp.json');
	const keys = db.current().authKeys || [];

	if (keys.length === 0) {
		logImmediate('📝 No MCP authorization keys found.');
		return;
	}

	logImmediate(`📝 Found ${keys.length} MCP authorization key(s):`);
	logImmediate('');
	keys.forEach((key, index) => {
		logImmediate(`${index + 1}. ${key}`);
	});
	logImmediate('');
	logImmediate('💡 To remove a key, use: bun scripts/manage-mcp-keys.ts remove <key>');
}

function removeKey(keyToRemove: string): void {
	const db = new Database<MCPDB>('mcp.json');
	const keys = db.current().authKeys || [];

	const keyIndex = keys.indexOf(keyToRemove);
	if (keyIndex === -1) {
		logImmediate('❌ Key not found.');
		return;
	}

	// Remove the key from the array
	const updatedKeys = keys.filter((key) => key !== keyToRemove);

	db.update((old) => ({
		...old,
		authKeys: updatedKeys,
	}));

	logImmediate('✅ Key removed successfully!');
	logImmediate(`📊 Remaining keys: ${updatedKeys.length}`);
}

function clearAllKeys(): void {
	const db = new Database<MCPDB>('mcp.json');
	const keys = db.current().authKeys || [];

	if (keys.length === 0) {
		logImmediate('📝 No keys to clear.');
		return;
	}

	db.update((old) => ({
		...old,
		authKeys: [],
	}));

	logImmediate(`✅ Cleared ${keys.length} key(s) successfully!`);
}

function showUsage(): void {
	logImmediate('🔧 MCP Key Management Tool');
	logImmediate('');
	logImmediate('Usage:');
	logImmediate('  bun scripts/manage-mcp-keys.ts list                    # List all keys');
	logImmediate('  bun scripts/manage-mcp-keys.ts remove <key>            # Remove specific key');
	logImmediate('  bun scripts/manage-mcp-keys.ts clear                   # Remove all keys');
	logImmediate('');
	logImmediate('Examples:');
	logImmediate('  bun scripts/manage-mcp-keys.ts list');
	logImmediate('  bun scripts/manage-mcp-keys.ts remove abc123...');
	logImmediate('  bun scripts/manage-mcp-keys.ts clear');
}

function main(): void {
	const args = process.argv.slice(2);
	const command = args[0];

	switch (command) {
		case 'list':
			listKeys();
			break;
		case 'remove':
			{
				const keyToRemove = args[1];
				if (!keyToRemove) {
					logImmediate('❌ Please provide a key to remove.');
					logImmediate('Usage: bun scripts/manage-mcp-keys.ts remove <key>');
					// eslint-disable-next-line n/no-process-exit
					process.exit(1);
				}
				removeKey(keyToRemove);
			}
			break;
		case 'clear':
			clearAllKeys();
			break;
		default:
			showUsage();
			break;
	}
}

// Run the script
main();
