export interface ParsedUserAgent {
	browser: string;
	browserVersion: string;
	os: string;
	osVersion: string;
	platform: 'iPhone' | 'Android' | 'Web';
	deviceModel?: string;
	raw: string;
}

export function parseUserAgent(userAgent: string): ParsedUserAgent {
	const ua = userAgent.toLowerCase();

	// Determine platform
	let platform: 'iPhone' | 'Android' | 'Web' = 'Web';
	let deviceModel: string | undefined;

	if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) {
		platform = 'iPhone';
		// Extract iOS device model
		const iphoneMatch = /iPhone(\d+,\d+)?/i.exec(userAgent);
		const ipadMatch = /iPad(\d+,\d+)?/i.exec(userAgent);
		if (iphoneMatch) {
			deviceModel = 'iPhone';
		} else if (ipadMatch) {
			deviceModel = 'iPad';
		}
	} else if (ua.includes('android')) {
		platform = 'Android';
		// Extract Android device model
		const modelMatch = /Android.*;\s*([^)]+)\s*Build/i.exec(userAgent);
		if (modelMatch?.[1]) {
			deviceModel = modelMatch[1].trim();
		}
	}

	// Detect browser
	let browser = 'Unknown';
	let browserVersion = '';

	if (ua.includes('edg/')) {
		browser = 'Edge';
		const match = /Edg\/(\d+\.\d+)/i.exec(userAgent);
		browserVersion = match ? match[1] : '';
	} else if (ua.includes('chrome/') && !ua.includes('edg/')) {
		browser = 'Chrome';
		const match = /Chrome\/(\d+\.\d+)/i.exec(userAgent);
		browserVersion = match ? match[1] : '';
	} else if (ua.includes('firefox/')) {
		browser = 'Firefox';
		const match = /Firefox\/(\d+\.\d+)/i.exec(userAgent);
		browserVersion = match ? match[1] : '';
	} else if (ua.includes('safari/') && !ua.includes('chrome/')) {
		browser = 'Safari';
		const match = /Version\/(\d+\.\d+)/i.exec(userAgent);
		browserVersion = match ? match[1] : '';
	} else if (ua.includes('opera/') || ua.includes('opr/')) {
		browser = 'Opera';
		const match = /(?:Opera|OPR)\/(\d+\.\d+)/i.exec(userAgent);
		browserVersion = match ? match[1] : '';
	}

	// Detect OS
	let os = 'Unknown';
	let osVersion = '';

	if (ua.includes('windows nt')) {
		os = 'Windows';
		const versionMap: Record<string, string> = {
			'10.0': '10/11',
			'6.3': '8.1',
			'6.2': '8',
			'6.1': '7',
		};
		const match = /Windows NT (\d+\.\d+)/i.exec(userAgent);
		if (match?.[1]) {
			osVersion = versionMap[match[1]] || match[1];
		}
	} else if (ua.includes('mac os x')) {
		os = 'macOS';
		const match = /Mac OS X (\d+[._]\d+)/i.exec(userAgent);
		if (match?.[1]) {
			osVersion = match[1].replace(/_/g, '.');
		}
	} else if (ua.includes('iphone') || ua.includes('ipad')) {
		os = 'iOS';
		const match = /OS (\d+[._]\d+)/i.exec(userAgent);
		if (match?.[1]) {
			osVersion = match[1].replace(/_/g, '.');
		}
	} else if (ua.includes('android')) {
		os = 'Android';
		const match = /Android (\d+\.?\d*)/i.exec(userAgent);
		osVersion = match ? match[1] : '';
	} else if (ua.includes('linux')) {
		os = 'Linux';
	} else if (ua.includes('cros')) {
		os = 'Chrome OS';
	}

	return {
		browser,
		browserVersion,
		os,
		osVersion,
		platform,
		deviceModel,
		raw: userAgent,
	};
}

export function getDisplayString(parsed: ParsedUserAgent): string {
	const parts: string[] = [];

	// Browser info
	if (parsed.browser !== 'Unknown') {
		parts.push(
			parsed.browserVersion ? `${parsed.browser} ${parsed.browserVersion}` : parsed.browser
		);
	}

	// OS info
	if (parsed.os !== 'Unknown') {
		parts.push(parsed.osVersion ? `${parsed.os} ${parsed.osVersion}` : parsed.os);
	}

	// Device model
	if (parsed.deviceModel) {
		parts.push(parsed.deviceModel);
	}

	// Platform indicator
	parts.push(`(${parsed.platform})`);

	return parts.join(' • ');
}
