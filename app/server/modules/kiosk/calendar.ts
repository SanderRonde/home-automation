import { SettablePromise } from '../../lib/settable-promise';
import type { Credentials } from 'google-auth-library';
import { SECRETS_FOLDER } from '../../lib/constants';
import { logTag } from '../../lib/logging/logger';
import type { calendar_v3 } from 'googleapis';
import { flatten } from '../../lib/array';
import { getEnv } from '../../lib/io';
import { SCOPES } from './constants';
import { google } from 'googleapis';
import * as fs from 'fs-extra';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const optionalRequire = require('optional-require')(require) as (requirePath: string) => unknown;

export async function refresh(): Promise<void> {
	try {
		// #region agent log
		fetch('http://127.0.0.1:7244/ingest/79424a24-85e1-4d1d-8c1a-bb0cd37fbd73', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				location: 'calendar.ts:16',
				message: 'refresh() called',
				data: {},
				timestamp: Date.now(),
				sessionId: 'debug-session',
				runId: 'run1',
				hypothesisId: 'B',
			}),
		}).catch(() => {});
		// #endregion
		const filePath = path.join(SECRETS_FOLDER, 'last_tokens.json');
		const fileContent = await fs.readFile(filePath, {
			encoding: 'utf8',
		});
		// #region agent log
		fetch('http://127.0.0.1:7244/ingest/79424a24-85e1-4d1d-8c1a-bb0cd37fbd73', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				location: 'calendar.ts:20',
				message: 'File content read',
				data: {
					hasRefreshToken: fileContent.includes('refresh_token'),
					fileLength: fileContent.length,
				},
				timestamp: Date.now(),
				sessionId: 'debug-session',
				runId: 'run1',
				hypothesisId: 'B',
			}),
		}).catch(() => {});
		// #endregion
		const credentials: Credentials = JSON.parse(fileContent);
		// #region agent log
		fetch('http://127.0.0.1:7244/ingest/79424a24-85e1-4d1d-8c1a-bb0cd37fbd73', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				location: 'calendar.ts:23',
				message: 'Credentials parsed',
				data: {
					hasRefreshToken: !!credentials.refresh_token,
					hasAccessToken: !!credentials.access_token,
					hasExpiryDate: !!credentials.expiry_date,
					keys: Object.keys(credentials),
				},
				timestamp: Date.now(),
				sessionId: 'debug-session',
				runId: 'run1',
				hypothesisId: 'B',
			}),
		}).catch(() => {});
		// #endregion
		await authTokens(credentials, true);
	} catch (e) {
		// #region agent log
		fetch('http://127.0.0.1:7244/ingest/79424a24-85e1-4d1d-8c1a-bb0cd37fbd73', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				location: 'calendar.ts:26',
				message: 'refresh() error',
				data: { error: (e as Error).message, stack: (e as Error).stack },
				timestamp: Date.now(),
				sessionId: 'debug-session',
				runId: 'run1',
				hypothesisId: 'B',
			}),
		}).catch(() => {});
		// #endregion
		logTag('calendar', 'red', 'Failed to re-use google code', (e as Error).message);
	}
}

const secrets: {
	client_id: string;
	client_secret: string;
	redirect_url: string;
} = {
	client_id: getEnv('SECRET_GOOGLE_CLIENT_ID', true),
	client_secret: getEnv('SECRET_GOOGLE_CLIENT_SECRET', true),
	redirect_url: getEnv('SECRET_GOOGLE_REDIRECT_URL', true),
};
function createClient(): void {
	if (client.isSet) {
		return;
	}
	const { client_id, client_secret, redirect_url } = secrets;

	client.set(new google.auth.OAuth2(client_id, client_secret, redirect_url));
}

const client = new SettablePromise<InstanceType<typeof google.auth.OAuth2>>();
let calendar: calendar_v3.Calendar | null = null;

export function getCalendar(): calendar_v3.Calendar | null {
	return calendar;
}

async function authTokens(tokens: Credentials, reAuth: boolean) {
	// #region agent log
	fetch('http://127.0.0.1:7244/ingest/79424a24-85e1-4d1d-8c1a-bb0cd37fbd73', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			location: 'calendar.ts:54',
			message: 'authTokens() called',
			data: {
				reAuth,
				hasRefreshToken: !!tokens.refresh_token,
				hasAccessToken: !!tokens.access_token,
				hasExpiryDate: !!tokens.expiry_date,
			},
			timestamp: Date.now(),
			sessionId: 'debug-session',
			runId: 'run1',
			hypothesisId: 'D',
		}),
	}).catch(() => {});
	// #endregion
	createClient();

	if (!reAuth) {
		// #region agent log
		fetch('http://127.0.0.1:7244/ingest/79424a24-85e1-4d1d-8c1a-bb0cd37fbd73', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				location: 'calendar.ts:58',
				message: 'Writing tokens to file',
				data: {
					hasRefreshToken: !!tokens.refresh_token,
					hasAccessToken: !!tokens.access_token,
				},
				timestamp: Date.now(),
				sessionId: 'debug-session',
				runId: 'run1',
				hypothesisId: 'E',
			}),
		}).catch(() => {});
		// #endregion
		await fs.writeFile(
			path.join(SECRETS_FOLDER, 'last_tokens.json'),
			JSON.stringify(tokens, null, '\t'),
			{
				encoding: 'utf8',
			}
		);
		// #region agent log
		fetch('http://127.0.0.1:7244/ingest/79424a24-85e1-4d1d-8c1a-bb0cd37fbd73', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				location: 'calendar.ts:64',
				message: 'Tokens written to file',
				data: {},
				timestamp: Date.now(),
				sessionId: 'debug-session',
				runId: 'run1',
				hypothesisId: 'E',
			}),
		}).catch(() => {});
		// #endregion
	}

	const oauthClient = await client.value;
	// #region agent log
	fetch('http://127.0.0.1:7244/ingest/79424a24-85e1-4d1d-8c1a-bb0cd37fbd73', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			location: 'calendar.ts:67',
			message: 'Setting credentials on OAuth2 client',
			data: { hasRefreshToken: !!tokens.refresh_token },
			timestamp: Date.now(),
			sessionId: 'debug-session',
			runId: 'run1',
			hypothesisId: 'D',
		}),
	}).catch(() => {});
	// #endregion
	oauthClient.setCredentials(tokens);

	// #region agent log
	const clientCredentials = oauthClient.credentials;
	fetch('http://127.0.0.1:7244/ingest/79424a24-85e1-4d1d-8c1a-bb0cd37fbd73', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			location: 'calendar.ts:70',
			message: 'OAuth2 client credentials after setCredentials',
			data: {
				hasRefreshToken: !!clientCredentials.refresh_token,
				hasAccessToken: !!clientCredentials.access_token,
				hasExpiryDate: !!clientCredentials.expiry_date,
			},
			timestamp: Date.now(),
			sessionId: 'debug-session',
			runId: 'run1',
			hypothesisId: 'C',
		}),
	}).catch(() => {});
	// #endregion

	// Set up token refresh listener to persist refreshed tokens
	oauthClient.on('tokens', (newTokens) => {
		// #region agent log
		fetch('http://127.0.0.1:7244/ingest/79424a24-85e1-4d1d-8c1a-bb0cd37fbd73', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				location: 'calendar.ts:73',
				message: 'OAuth2 tokens event fired',
				data: {
					hasRefreshToken: !!newTokens.refresh_token,
					hasAccessToken: !!newTokens.access_token,
					hasExpiryDate: !!newTokens.expiry_date,
				},
				timestamp: Date.now(),
				sessionId: 'debug-session',
				runId: 'run1',
				hypothesisId: 'A',
			}),
		}).catch(() => {});
		// #endregion
		const updatedCredentials = oauthClient.credentials;
		// #region agent log
		fetch('http://127.0.0.1:7244/ingest/79424a24-85e1-4d1d-8c1a-bb0cd37fbd73', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				location: 'calendar.ts:76',
				message: 'OAuth2 client credentials after refresh',
				data: {
					hasRefreshToken: !!updatedCredentials.refresh_token,
					hasAccessToken: !!updatedCredentials.access_token,
					hasExpiryDate: !!updatedCredentials.expiry_date,
				},
				timestamp: Date.now(),
				sessionId: 'debug-session',
				runId: 'run1',
				hypothesisId: 'A',
			}),
		}).catch(() => {});
		// #endregion
	});

	if (reAuth) {
		// #region agent log
		fetch('http://127.0.0.1:7244/ingest/79424a24-85e1-4d1d-8c1a-bb0cd37fbd73', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				location: 'calendar.ts:81',
				message: 'Calling getRequestHeaders (may trigger refresh)',
				data: {},
				timestamp: Date.now(),
				sessionId: 'debug-session',
				runId: 'run1',
				hypothesisId: 'A',
			}),
		}).catch(() => {});
		// #endregion
		await oauthClient.getRequestHeaders();
		// #region agent log
		const afterHeadersCredentials = oauthClient.credentials;
		fetch('http://127.0.0.1:7244/ingest/79424a24-85e1-4d1d-8c1a-bb0cd37fbd73', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				location: 'calendar.ts:84',
				message: 'OAuth2 client credentials after getRequestHeaders',
				data: {
					hasRefreshToken: !!afterHeadersCredentials.refresh_token,
					hasAccessToken: !!afterHeadersCredentials.access_token,
					hasExpiryDate: !!afterHeadersCredentials.expiry_date,
				},
				timestamp: Date.now(),
				sessionId: 'debug-session',
				runId: 'run1',
				hypothesisId: 'A',
			}),
		}).catch(() => {});
		// #endregion
	}

	calendar = google.calendar({
		version: 'v3',
		auth: oauthClient,
	});
}

export async function authCode(code: string): Promise<void> {
	// #region agent log
	fetch('http://127.0.0.1:7244/ingest/79424a24-85e1-4d1d-8c1a-bb0cd37fbd73', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			location: 'calendar.ts:78',
			message: 'authCode() called',
			data: {},
			timestamp: Date.now(),
			sessionId: 'debug-session',
			runId: 'run1',
			hypothesisId: 'D',
		}),
	}).catch(() => {});
	// #endregion
	createClient();

	const { tokens } = await (await client.value).getToken(code);
	// #region agent log
	fetch('http://127.0.0.1:7244/ingest/79424a24-85e1-4d1d-8c1a-bb0cd37fbd73', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			location: 'calendar.ts:82',
			message: 'Tokens received from getToken',
			data: {
				hasRefreshToken: !!tokens.refresh_token,
				hasAccessToken: !!tokens.access_token,
				hasExpiryDate: !!tokens.expiry_date,
			},
			timestamp: Date.now(),
			sessionId: 'debug-session',
			runId: 'run1',
			hypothesisId: 'D',
		}),
	}).catch(() => {});
	// #endregion
	await authTokens(tokens, false);
}

function getDay(dayOffset: number) {
	const date = new Date();
	date.setDate(date.getDate() + dayOffset);
	return date;
}

export type CalendarEvent = calendar_v3.Schema$Event & {
	color: calendar_v3.Schema$ColorDefinition;
};

export async function getEvents(
	calendar: calendar_v3.Calendar,
	days: number
): Promise<CalendarEvent[]> {
	// #region agent log
	const oauthClient = await client.value;
	const beforeCallCredentials = oauthClient.credentials;
	fetch('http://127.0.0.1:7244/ingest/79424a24-85e1-4d1d-8c1a-bb0cd37fbd73', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			location: 'calendar.ts:99',
			message: 'getEvents() called - credentials before API call',
			data: {
				hasRefreshToken: !!beforeCallCredentials.refresh_token,
				hasAccessToken: !!beforeCallCredentials.access_token,
				hasExpiryDate: !!beforeCallCredentials.expiry_date,
			},
			timestamp: Date.now(),
			sessionId: 'debug-session',
			runId: 'run1',
			hypothesisId: 'A',
		}),
	}).catch(() => {});
	// #endregion
	const listResponse = await calendar.calendarList.list();
	// #region agent log
	const afterCallCredentials = oauthClient.credentials;
	fetch('http://127.0.0.1:7244/ingest/79424a24-85e1-4d1d-8c1a-bb0cd37fbd73', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			location: 'calendar.ts:101',
			message: 'getEvents() - credentials after API call',
			data: {
				hasRefreshToken: !!afterCallCredentials.refresh_token,
				hasAccessToken: !!afterCallCredentials.access_token,
				hasExpiryDate: !!afterCallCredentials.expiry_date,
			},
			timestamp: Date.now(),
			sessionId: 'debug-session',
			runId: 'run1',
			hypothesisId: 'A',
		}),
	}).catch(() => {});
	// #endregion
	const calendars = listResponse.data.items || [];

	const colors = await calendar.colors.get();

	const startTime = getDay(0);
	startTime.setHours(0, 0, 0);
	const endTime = getDay(days - 1);
	endTime.setHours(23, 59, 59);
	const events = await Promise.all(
		calendars.map(async (calendarObj) => {
			return {
				response: await calendar?.events.list({
					calendarId: calendarObj.id || undefined,
					singleEvents: true,
					orderBy: 'startTime',
					timeMin: startTime.toISOString(),
					timeMax: endTime.toISOString(),
				}),
				calendar: calendarObj,
			};
		})
	);
	const joined = events.map(({ response, calendar }) =>
		[...(response?.data.items || [])].map((event) => {
			return {
				...event,
				color:
					event.colorId && colors.data.calendar![event.colorId]
						? colors.data.calendar![event.colorId]
						: colors.data.calendar![calendar.colorId!],
			};
		})
	);
	const flatEvents = flatten(joined);
	const filter = optionalRequire(path.join(SECRETS_FOLDER, 'event-filter.js')) as (
		toFilter: CalendarEvent
	) => boolean;
	if (filter) {
		return flatEvents.filter((event) => {
			return filter(event);
		});
	}
	return flatEvents;
}

export async function authenticateURL(): Promise<string | null> {
	createClient();

	if (client) {
		const url = (await client.value).generateAuthUrl({
			access_type: 'offline',
			scope: SCOPES,
		});
		return url;
	}
	return null;
}
