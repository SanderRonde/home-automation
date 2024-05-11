import { SettablePromise, flatten } from '../../lib/util';
import { SECRETS_FOLDER } from '../../lib/constants';
import { Credentials } from 'google-auth-library';
import { google, calendar_v3 } from 'googleapis';
import { getEnv } from '../../lib/io';
import { SCOPES } from './constants';
import * as fs from 'fs-extra';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const optionalRequire = require('optional-require')(require) as (
	requirePath: string
) => unknown;

export let authenticated = false;

export async function refresh(): Promise<void> {
	try {
		const credentials: Credentials = JSON.parse(
			await fs.readFile(path.join(SECRETS_FOLDER, 'last_tokens.json'), {
				encoding: 'utf8',
			})
		);
		await authTokens(credentials, true);
	} catch (e) {
		console.log('Failed to re-use google code', e);
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

async function authTokens(tokens: Credentials, reAuth: boolean) {
	createClient();

	if (!reAuth) {
		await fs.writeFile(
			path.join(SECRETS_FOLDER, 'last_tokens.json'),
			JSON.stringify(tokens, null, '\t'),
			{
				encoding: 'utf8',
			}
		);
	}

	(await client.value).setCredentials(tokens);
	if (reAuth) {
		await (await client.value).getRequestHeaders();
	}

	calendar = google.calendar({
		version: 'v3',
		auth: await client.value,
	});

	authenticated = true;
}

export async function authCode(code: string): Promise<void> {
	createClient();

	const { tokens } = await (await client.value).getToken(code);
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

export async function getEvents(days: number): Promise<CalendarEvent[]> {
	const listResponse = await calendar!.calendarList.list();
	const calendars = listResponse.data.items || [];

	const colors = await calendar!.colors.get();

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
	const filter = optionalRequire(
		path.join(SECRETS_FOLDER, 'event-filter.js')
	) as (toFilter: CalendarEvent) => boolean;
	if (filter) {
		return flatEvents.filter((event) => {
			return filter(event);
		});
	}
	return flatEvents;
}
