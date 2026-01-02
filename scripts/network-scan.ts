#!/usr/bin/env bun

/**
 * Network scanning utility to find devices by MAC address on the local network
 */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

interface NetworkDevice {
	ip: string;
	mac: string;
	interfaceName?: string;
	state?: string;
}

/**
 * Get the local network interface and IP range
 */
function getLocalNetwork(): { interfaceName: string; network: string; ip: string } | null {
	try {
		// Get default route interface
		const routeResult = Bun.spawnSync(['ip', 'route', 'show', 'default'], {
			stdout: 'pipe',
		});
		const routeOutput = routeResult.stdout.toString();
		const interfaceMatch = /dev\s+(\w+)/.exec(routeOutput);
		if (!interfaceMatch) {
			return null;
		}

		const interfaceName = interfaceMatch[1];

		// Get IP address for the interface
		const ipResult = Bun.spawnSync(['ip', 'addr', 'show', interfaceName], {
			stdout: 'pipe',
		});
		const ipOutput = ipResult.stdout.toString();
		const ipMatch = /inet\s+(\d+\.\d+\.\d+\.\d+)/.exec(ipOutput);
		if (!ipMatch) {
			return null;
		}

		const ip = ipMatch[1];
		const parts = ip.split('.');
		const network = `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;

		return { interfaceName, network, ip };
	} catch (error) {
		console.error('Failed to get local network:', error);
		return null;
	}
}


/**
 * Get ARP entries using ip neigh command (alternative method)
 */
function getARPEntries(): NetworkDevice[] {
	const devices: NetworkDevice[] = [];
	try {
		const result = Bun.spawnSync(['ip', 'neigh', 'show'], {
			stdout: 'pipe',
		});
		const output = result.stdout.toString();
		const lines = output.split('\n');

		for (const line of lines) {
			if (!line.trim()) {
				continue;
			}
			// Format: IP_ADDR dev INTERFACE lladdr MAC_ADDR STALE|REACHABLE
			const match = /(\d+\.\d+\.\d+\.\d+)\s+dev\s+(\w+)\s+lladdr\s+([0-9a-f:]+)\s+(\w+)/i.exec(line);
			if (match) {
				devices.push({
					ip: match[1],
					mac: match[3].toLowerCase(),
					interfaceName: match[2],
					state: match[4],
				});
			}
		}
	} catch (error) {
		console.error('Failed to get ARP entries:', error);
	}
	return devices;
}

/**
 * Scan network by pinging IPs and checking ARP table
 * This is slower but can discover devices that haven't been contacted recently
 */
async function scanNetwork(
	network: string,
	callback?: (device: NetworkDevice) => void
): Promise<NetworkDevice[]> {
	const devices: NetworkDevice[] = [];
	const [baseIP, cidr] = network.split('/');
	const subnetMask = cidr ? parseInt(cidr, 10) : 24;
	const ipParts = baseIP.split('.').map(Number);
	const startIP = ipParts[3] || 1;
	const endIP = subnetMask === 24 ? 254 : Math.pow(2, 32 - subnetMask) - 2;

	console.log(`Scanning network ${network} (${endIP - startIP} IPs)...`);

	const pingPromises: Promise<void>[] = [];

	for (let i = startIP; i <= endIP; i++) {
		const ip = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.${i}`;
		pingPromises.push(
			(async () => {
				try {
					// Quick ping with timeout
					await Bun.spawn(['ping', '-c', '1', '-W', '1', ip], {
						stdout: 'pipe',
						stderr: 'pipe',
					}).exited;
					// Even if ping fails, device might be in ARP table
				} catch {
					// Ignore ping errors
				}
			})()
		);

		// Limit concurrent pings
		if (pingPromises.length >= 50) {
			await Promise.all(pingPromises);
			pingPromises.length = 0;
		}
	}

	// Wait for remaining pings
	await Promise.all(pingPromises);

	// Wait a bit for ARP table to update
	await new Promise((resolve) => setTimeout(resolve, 1000));

	// Get updated ARP table
	const arpDevices = getARPEntries();
	for (const device of arpDevices) {
		if (callback) {
			callback(device);
		}
		devices.push(device);
	}

	return devices;
}

/**
 * Normalize MAC address format (remove colons, dashes, make lowercase)
 */
function normalizeMAC(mac: string): string {
	return mac.replace(/[:-]/g, '').toLowerCase();
}

/**
 * Find device by MAC address
 */
function findDeviceByMAC(devices: NetworkDevice[], macAddress: string): NetworkDevice | null {
	const normalized = normalizeMAC(macAddress);
	return devices.find((d) => normalizeMAC(d.mac) === normalized) || null;
}

// CLI usage
void (async () => {
	const args = process.argv.slice(2);
	const command = args[0];

	if (command === 'list' || !command) {
		// List all devices
		console.log('Reading ARP table...\n');
		const devices = getARPEntries();
		if (devices.length === 0) {
			console.log('No devices found in ARP table.');
		} else {
			console.log(`Found ${devices.length} device(s):\n`);
			console.log('IP Address\t\tMAC Address\t\tInterface\tState');
			console.log('─'.repeat(70));
			for (const device of devices) {
				console.log(
					`${device.ip.padEnd(16)}\t${device.mac.padEnd(18)}\t${device.interfaceName || 'N/A'}\t\t${device.state || 'N/A'}`
				);
			}
		}
	} else if (command === 'find') {
		// Find specific MAC address
		const macAddress = args[1];
		if (!macAddress) {
			console.error('Usage: bun scripts/network-scan.ts find <MAC_ADDRESS>');
			console.error('Example: bun scripts/network-scan.ts find aa:bb:cc:dd:ee:ff');
			// eslint-disable-next-line n/no-process-exit
			process.exit(1);
		}

		console.log(`Searching for MAC address: ${macAddress}\n`);

		// Check current ARP table
		let devices = getARPEntries();
		let device = findDeviceByMAC(devices, macAddress);

		if (device) {
			console.log('✓ Found in ARP table:');
			console.log(`  IP: ${device.ip}`);
			console.log(`  MAC: ${device.mac}`);
			console.log(`  Interface: ${device.interfaceName || 'N/A'}`);
			console.log(`  State: ${device.state || 'N/A'}`);
		} else {
			console.log('Not found in current ARP table.');
			console.log('Scanning network...\n');

			const network = getLocalNetwork();
			if (!network) {
				console.error('Failed to determine local network.');
				// eslint-disable-next-line n/no-process-exit
				process.exit(1);
			}

			devices = await scanNetwork(network.network);
			device = findDeviceByMAC(devices, macAddress);

			if (device) {
				console.log('\n✓ Found after scanning:');
				console.log(`  IP: ${device.ip}`);
				console.log(`  MAC: ${device.mac}`);
				console.log(`  Interface: ${device.interfaceName || 'N/A'}`);
				console.log(`  State: ${device.state || 'N/A'}`);
			} else {
				console.log('\n✗ Device not found on network.');
				console.log(`\nScanned ${devices.length} device(s) in ARP table.`);
			}
		}
	} else if (command === 'scan') {
		// Scan entire network
		const network = getLocalNetwork();
		if (!network) {
			console.error('Failed to determine local network.');
			// eslint-disable-next-line n/no-process-exit
			process.exit(1);
		}

		console.log(`Local network: ${network.network}`);
		console.log(`Interface: ${network.interfaceName}`);
		console.log(`Your IP: ${network.ip}\n`);

		const devices = await scanNetwork(network.network, (device) => {
			process.stdout.write(`Found: ${device.ip} (${device.mac})\r`);
		});

		console.log(`\n\nFound ${devices.length} device(s):\n`);
		console.log('IP Address\t\tMAC Address\t\tInterface\tState');
		console.log('─'.repeat(70));
		for (const device of devices) {
			console.log(
				`${device.ip.padEnd(16)}\t${device.mac.padEnd(18)}\t${device.interfaceName || 'N/A'}\t\t${device.state || 'N/A'}`
			);
		}
	} else {
		console.log('Network scanning utility');
		console.log('');
		console.log('Usage:');
		console.log('  bun scripts/network-scan.ts [command]');
		console.log('');
		console.log('Commands:');
		console.log('  list          List all devices in ARP table (default)');
		console.log('  find <MAC>    Find device by MAC address');
		console.log('  scan          Scan entire local network');
		console.log('');
		console.log('Examples:');
		console.log('  bun scripts/network-scan.ts');
		console.log('  bun scripts/network-scan.ts find aa:bb:cc:dd:ee:ff');
		console.log('  bun scripts/network-scan.ts scan');
	}
})();

export { getARPEntries, findDeviceByMAC, scanNetwork, normalizeMAC, type NetworkDevice };

