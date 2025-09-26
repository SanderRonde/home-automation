#!/usr/bin/env bun

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
		console.log('📝 No MCP authorization keys found.');
		return;
	}

	console.log(`📝 Found ${keys.length} MCP authorization key(s):`);
	console.log('');
	keys.forEach((key, index) => {
		console.log(`${index + 1}. ${key}`);
	});
	console.log('');
	console.log(
		'💡 To remove a key, use: bun scripts/manage-mcp-keys.ts remove <key>'
	);
}

function removeKey(keyToRemove: string): void {
	const db = new Database<MCPDB>('mcp.json');
	const keys = db.current().authKeys || [];

	const keyIndex = keys.indexOf(keyToRemove);
	if (keyIndex === -1) {
		console.log('❌ Key not found.');
		return;
	}

	// Remove the key from the array
	const updatedKeys = keys.filter((key) => key !== keyToRemove);

	db.update((old) => ({
		...old,
		authKeys: updatedKeys,
	}));

	console.log('✅ Key removed successfully!');
	console.log(`📊 Remaining keys: ${updatedKeys.length}`);
}

function clearAllKeys(): void {
	const db = new Database<MCPDB>('mcp.json');
	const keys = db.current().authKeys || [];

	if (keys.length === 0) {
		console.log('📝 No keys to clear.');
		return;
	}

	db.update((old) => ({
		...old,
		authKeys: [],
	}));

	console.log(`✅ Cleared ${keys.length} key(s) successfully!`);
}

function showUsage(): void {
	console.log('🔧 MCP Key Management Tool');
	console.log('');
	console.log('Usage:');
	console.log(
		'  bun scripts/manage-mcp-keys.ts list                    # List all keys'
	);
	console.log(
		'  bun scripts/manage-mcp-keys.ts remove <key>            # Remove specific key'
	);
	console.log(
		'  bun scripts/manage-mcp-keys.ts clear                   # Remove all keys'
	);
	console.log('');
	console.log('Examples:');
	console.log('  bun scripts/manage-mcp-keys.ts list');
	console.log('  bun scripts/manage-mcp-keys.ts remove abc123...');
	console.log('  bun scripts/manage-mcp-keys.ts clear');
}

function main(): void {
	const args = process.argv.slice(2);
	const command = args[0];

	switch (command) {
		case 'list':
			listKeys();
			break;
		case 'remove':
			const keyToRemove = args[1];
			if (!keyToRemove) {
				console.log('❌ Please provide a key to remove.');
				console.log(
					'Usage: bun scripts/manage-mcp-keys.ts remove <key>'
				);
				process.exit(1);
			}
			removeKey(keyToRemove);
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
