#!/usr/bin/env bun

import { logImmediate } from '../app/server/lib/logging/logger';
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

		logImmediate('✅ MCP authorization key generated successfully!');
		logImmediate(`🔑 Key: ${authKey}`);
		logImmediate('');
		logImmediate('📝 Usage:');
		logImmediate('  Add this key to your MCP client configuration');
		logImmediate('  Include it in the Authorization header:');
		logImmediate(`  Authorization: Bearer ${authKey}`);
		logImmediate('');
		logImmediate('⚠️  Keep this key secure and do not share it!');
		logImmediate(`📊 Total keys: ${(db.current().authKeys || []).length}`);
	} catch (error) {
		throw new Error('❌ Failed to generate MCP key:', error);
	}
}

// Run the script
generateMCPKey();
