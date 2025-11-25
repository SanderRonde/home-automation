/* eslint-disable no-restricted-globals */
export interface TuyaContextOptions {
	baseUrl: string;
	accessKey: string;
	secretKey: string;
}

export interface TuyaRequestOptions {
	method: string;
	path: string;
	body?: Record<string, unknown>;
}

export interface TuyaResponse<T> {
	result: T;
	success: boolean;
}

export class TuyaContext {
	private readonly baseUrl: string;
	private readonly accessKey: string;
	private readonly secretKey: string;
	private accessToken: string | null = null;
	private tokenExpireTime: number = 0;

	public constructor(options: TuyaContextOptions) {
		this.baseUrl = options.baseUrl;
		this.accessKey = options.accessKey;
		this.secretKey = options.secretKey;
	}

	public async request<T>(options: TuyaRequestOptions): Promise<TuyaResponse<T>> {
		// Refresh token if needed
		if (!this.accessToken || Date.now() >= this.tokenExpireTime) {
			await this.refreshToken();
		}

		// Ensure access token is set
		if (!this.accessToken) {
			throw new Error('Access token not available');
		}

		const timestamp = Date.now().toString();
		const bodyJson = options.body ? JSON.stringify(options.body) : '';

		// Parse path to handle query params (simplified - full implementation would use qs library)
		const [uri, pathQuery] = options.path.split('?');
		// For paths without query params, use uri; with query params, keep as-is for now
		// The original processes and sorts query params, but for simple cases this works
		const processedPath = pathQuery ? options.path : uri;
		const url = `${this.baseUrl}${processedPath}`;

		// Generate content hash - exactly as original line 252
		const contentHash = await this.hashContent(bodyJson);

		// Build string to sign for v2 - exactly as original line 253
		const stringToSign = [
			options.method,
			contentHash,
			'',
			decodeURIComponent(processedPath),
		].join('\n');

		// Final signature - exactly as original line 254
		const signStr = this.accessKey + this.accessToken + timestamp + stringToSign;
		const sign = (await this.hmacSHA256(signStr, this.secretKey)).toUpperCase();

		// Build headers - match the original getSignHeaders return (lines 255-264)
		const headers: Record<string, string> = {
			client_id: this.accessKey,
			access_token: this.accessToken,
			sign: sign,
			t: timestamp,
			sign_method: 'HMAC-SHA256',
			Dev_channel: 'SaaSFramework',
			Dev_lang: 'Nodejs',
		};
		const fetchOptions: RequestInit = {
			method: options.method,
			headers,
		};

		if (options.method !== 'GET' && bodyJson.length > 0) {
			fetchOptions.body = bodyJson;
		}

		const response = await fetch(url, fetchOptions);

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const data = (await response.json()) as
			| TuyaResponse<T>
			| { code: number; msg?: string; success?: boolean };

		// Check for API errors
		if ('success' in data && !data.success) {
			const errorCode = 'code' in data ? data.code : 'unknown';
			const errorMsg = 'msg' in data ? data.msg : 'Unknown error';
			throw new Error(`Tuya API error (code: ${errorCode}, msg: ${errorMsg})`);
		}

		// Handle token expiration (code 1010)
		if ('code' in data && data.code === 1010) {
			await this.refreshToken();
			// Retry the request
			return this.request<T>(options);
		}

		return data as TuyaResponse<T>;
	}

	private async refreshToken(): Promise<void> {
		const timestamp = Date.now().toString();
		const path = '/v1.0/token?grant_type=1';
		const method = 'GET';

		// For v2 token request format
		// Content hash for empty body (SHA-256 of empty string)
		const emptyContentHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

		// Headers object (empty for token request)
		const headers = new Headers();

		// Build string to sign: method + contentHash + signHeaders + path
		const stringToSign = [method, emptyContentHash, '', path].join('\n');

		// Final signature string: accessKey + timestamp + nonce + stringToSign
		const nonce = '';
		const signStr = `${this.accessKey}${timestamp}${nonce}${stringToSign}`;
		const sign = (await this.hmacSHA256(signStr, this.secretKey)).toUpperCase();

		headers.set('client_id', this.accessKey);
		headers.set('sign', sign);
		headers.set('t', timestamp);
		headers.set('sign_method', 'HMAC-SHA256');
		headers.set('access_token', '');
		headers.set('Dev_lang', 'Nodejs');
		headers.set('Dev_channel', 'SaaSFramework');
		headers.set('Signature-Headers', '');

		const response = await fetch(`${this.baseUrl}${path}`, {
			method: 'GET',
			headers: headers,
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Failed to refresh token: HTTP ${response.status} - ${errorText}`);
		}

		const data = (await response.json()) as {
			success: boolean;
			result?: {
				access_token: string;
				expire_time: number;
			};
			code?: number;
			msg?: string;
		};

		if (!data.success) {
			const errorMsg = data.msg || 'Unknown error';
			const errorCode = data.code || 'unknown';
			throw new Error(
				`Failed to refresh token: API returned error (code: ${errorCode}, msg: ${errorMsg})`
			);
		}

		if (!data.result) {
			throw new Error('Failed to refresh token: No result in response');
		}

		this.accessToken = data.result.access_token;
		// expire_time is in seconds, convert to milliseconds and subtract 60 seconds buffer
		this.tokenExpireTime = Date.now() + (data.result.expire_time - 60) * 1000;
	}

	private async hashContent(contentString: string): Promise<string> {
		const encoder = new TextEncoder();
		const data = encoder.encode(contentString);
		const hashBuffer = await crypto.subtle.digest('SHA-256', data);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
	}

	private async hmacSHA256(message: string, secret: string): Promise<string> {
		const encoder = new TextEncoder();
		const keyData = encoder.encode(secret);
		const messageData = encoder.encode(message);

		const key = await crypto.subtle.importKey(
			'raw',
			keyData,
			{ name: 'HMAC', hash: 'SHA-256' },
			false,
			['sign']
		);

		const signature = await crypto.subtle.sign('HMAC', key, messageData);
		const signatureArray = Array.from(new Uint8Array(signature));
		return signatureArray.map((b) => b.toString(16).padStart(2, '0')).join('');
	}
}
