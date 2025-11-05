/**
 * Utility functions for network detection and IP address handling
 */

/**
 * Check if an IP address is in a private network range
 */
export function isPrivateIP(ip: string): boolean {
	// Remove IPv6 prefix if present
	const cleanIp = ip.replace(/^::ffff:/, '');
	
	// IPv4 private ranges
	const ipv4PrivateRanges = [
		/^10\./,                    // 10.0.0.0/8
		/^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
		/^192\.168\./,              // 192.168.0.0/16
		/^127\./,                   // 127.0.0.0/8 (loopback)
		/^169\.254\./,              // 169.254.0.0/16 (link-local)
	];
	
	// Check IPv4 private ranges
	for (const range of ipv4PrivateRanges) {
		if (range.test(cleanIp)) {
			return true;
		}
	}
	
	// IPv6 private ranges
	const ipv6PrivatePatterns = [
		/^fe80:/i,    // Link-local
		/^fc00:/i,    // Unique local address
		/^fd00:/i,    // Unique local address
		/^::1$/,      // Loopback
	];
	
	for (const pattern of ipv6PrivatePatterns) {
		if (pattern.test(ip)) {
			return true;
		}
	}
	
	return false;
}

/**
 * Extract client IP from request, considering proxy headers
 */
export function getClientIP(req: Request): string {
	// Check X-Forwarded-For header (set by reverse proxies)
	const forwardedFor = req.headers.get('x-forwarded-for');
	if (forwardedFor) {
		// X-Forwarded-For can contain multiple IPs, take the first one
		const ips = forwardedFor.split(',').map((ip) => ip.trim());
		return ips[0];
	}
	
	// Check X-Real-IP header
	const realIP = req.headers.get('x-real-ip');
	if (realIP) {
		return realIP;
	}
	
	// Fallback: extract from URL (not reliable but better than nothing)
	// In Bun, we don't have direct access to socket info from Request object
	// This is a limitation - in production, rely on proxy headers
	return 'unknown';
}

/**
 * Check if a request is coming from a local network
 */
export function isLocalRequest(req: Request): boolean {
	const clientIP = getClientIP(req);
	
	if (clientIP === 'unknown') {
		// If we can't determine IP, assume remote for security
		return false;
	}
	
	return isPrivateIP(clientIP);
}

/**
 * Get the base URL for the current request
 */
export function getRequestBaseUrl(req: Request): string {
	const url = new URL(req.url);
	return `${url.protocol}//${url.host}`;
}
