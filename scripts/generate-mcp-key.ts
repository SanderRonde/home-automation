#!/usr/bin/env bun

import type { MCPDB } from '../app/server/modules/mcp';
import { Database } from '../app/server/lib/db';
import { randomBytes } from 'crypto';

/**
 * Generate a new MCP authorization key and store it in the database
 */
function generateMCPKey(): void {
	try {
		// Generate a secure random key (32 bytes = 256 bits)
		const authKey = randomBytes(32).toString('hex');

		// Load the MCP database
		const db = new Database<MCPDB>('mcp.json');

		// Update the database with the new key (add to array)
		db.update((old) => ({
			...old,
			authKeys: [...(old.authKeys || []), authKey],
		}));

		console.log('✅ MCP authorization key generated successfully!');
		console.log(`🔑 Key: ${authKey}`);
		console.log('');
		console.log('📝 Usage:');
		console.log('  Add this key to your MCP client configuration');
		console.log('  Include it in the Authorization header:');
		console.log(`  Authorization: Bearer ${authKey}`);
		console.log('');
		console.log('⚠️  Keep this key secure and do not share it!');
		console.log(`📊 Total keys: ${(db.current().authKeys || []).length}`);
	} catch (error) {
		throw new Error('❌ Failed to generate MCP key:', error);
	}
}

// Run the script
generateMCPKey();
