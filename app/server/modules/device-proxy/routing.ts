import type { ModuleConfig } from '..';
import type { Device } from '../device';
import { logTag } from '../../lib/logging/logger';
import type { ServerWebSocket } from 'bun';

export async function initRouting(config: ModuleConfig) {
	const { modules } = config;

	return {
		// Main proxy route - handles all paths under /device-proxy/:deviceId/*
		'/proxy/:deviceId/*': async (req: Request, _server: Bun.Server) => {
			const url = new URL(req.url);
			const pathParts = url.pathname.split('/');
			
			// Extract deviceId (after /device-proxy/proxy/)
			const deviceIdIndex = pathParts.indexOf('proxy') + 1;
			const deviceId = decodeURIComponent(pathParts[deviceIdIndex]);
			
			// Get remaining path after deviceId
			const remainingPath = '/' + pathParts.slice(deviceIdIndex + 1).join('/');
			
			// Get device from device module
			const deviceModule = await modules.device.getModules<{
				api: {
					getDevices: () => Promise<Device[]>;
				};
			}>();
			
			const devices = await deviceModule.api.getDevices();
			const device = devices.find((d) => d.getUniqueId() === deviceId);
			
			if (!device) {
				return new Response('Device not found', { status: 404 });
			}
			
			const managementUrl = await device.getManagementUrl();
			if (!managementUrl) {
				return new Response('Device has no management URL', { status: 404 });
			}
			
			// Skip custom URL schemes (like hue://)
			if (!managementUrl.startsWith('http://') && !managementUrl.startsWith('https://')) {
				return new Response('Device management URL is not HTTP-based', { status: 400 });
			}
			
			// Build target URL
			const targetUrl = new URL(remainingPath + url.search, managementUrl);
			
			// Note: WebSocket proxying not yet implemented
			// Most device management UIs work fine with HTTP-only
			if (req.headers.get('upgrade')?.toLowerCase() === 'websocket') {
				logTag('DEVICE-PROXY', 'yellow', 'WebSocket proxying not yet supported');
				return new Response('WebSocket proxying not yet supported', { status: 501 });
			}
			
			// Regular HTTP proxy
			return handleHttpProxy(req, targetUrl.toString());
		},
	};
}

async function handleHttpProxy(req: Request, targetUrl: string): Promise<Response> {
	try {
		// Forward the request to the target device
		const headers = new Headers(req.headers);
		
		// Remove headers that shouldn't be forwarded
		headers.delete('host');
		headers.delete('cookie');
		headers.delete('authorization');
		headers.delete('x-forwarded-for');
		headers.delete('x-forwarded-proto');
		headers.delete('x-forwarded-host');
		
		const proxyReq = new Request(targetUrl, {
			method: req.method,
			headers: headers,
			body: req.body,
		});
		
		const response = await fetch(proxyReq);
		
		// Create response with proxied data
		const responseHeaders = new Headers(response.headers);
		
		// Remove headers that might cause issues
		responseHeaders.delete('set-cookie');
		
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers: responseHeaders,
		});
	} catch (error) {
		logTag('DEVICE-PROXY', 'red', `Error proxying HTTP request to ${targetUrl}: ${error}`);
		return new Response('Error proxying request', { status: 502 });
	}
}

// WebSocket handlers placeholder - not yet implemented
// Most device management UIs work fine without WebSocket support
export const websocketHandlers = undefined;
