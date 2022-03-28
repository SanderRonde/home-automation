import {
	QueryDatabaseParameters,
	SearchResponse,
} from '@notionhq/client/build/src/api-endpoints';
import { NOTION_GEOCODE_UPDATE_INTERVAL } from '../../lib/constants';
import { getAllForQuery, notionRequest } from './client';
import { asyncSetInterval } from '../../lib/util';
import { captureTime } from '../../lib/timer';
import { Client } from '@notionhq/client';
import { logTag } from '../../lib/logger';
import { WithAuth } from './types';

const geocodeLocationRegex = /(.*) \(#location\)/;

function getGeocodableProperties(
	database: SearchResponse['results'][number]
): string[] | null {
	if (database.object !== 'database') {
		return null;
	}

	const properties = Object.values(database.properties);
	if (!properties.some((prop) => prop.type === 'last_edited_time')) {
		return null;
	}
	const props: string[] = [];
	for (const property of properties) {
		if (property.type !== 'rich_text') {
			continue;
		}
		if (geocodeLocationRegex.exec(property.name)) {
			props.push(property.name);
		}
	}

	return props.length > 0 ? props : null;
}

async function performDatabaseGeocoding(
	client: Client,
	database: SearchResponse['results'][number],
	geocodingProps: string[],
	forAll: boolean = false
) {
	const timer = captureTime();
	const lastEditedProp = Object.values(database.properties).find(
		(prop: { type: string }) => prop.type === 'last_edited_time'
	) as {
		name: string;
	};
	const filters: unknown[] = [
		{
			or: geocodingProps.map((geocodingProp) => {
				return {
					property: geocodingProp,
					text: {
						is_not_empty: true,
					},
				};
			}),
		},
	];
	if (!forAll) {
		filters.push({
			property: lastEditedProp.name,
			last_edited_time: {
				after: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
			},
		});
	}
	const query = {
		database_id: database.id,
		filter: {
			and: filters,
		},
	} as WithAuth<QueryDatabaseParameters>;
	const contents = await getAllForQuery(
		client.databases.query.bind(client.databases),
		query
	);

	let updates: number = 0;
	for (const row of contents) {
		for (const geocodingProp of geocodingProps) {
			const textProp = row.properties[geocodingProp];
			if (
				textProp.type !== 'rich_text' ||
				textProp.rich_text[0].type !== 'text'
			) {
				continue;
			}
			const plainText = textProp.rich_text[0].text.content;
			const link = `https://www.google.com/maps/place/${encodeURIComponent(
				plainText
			)}`;
			if (
				!textProp.rich_text[0].text.link?.url ||
				textProp.rich_text[0].text.link?.url !== link
			) {
				await notionRequest(async () => {
					await client.pages.update({
						page_id: row.id,
						properties: {
							[geocodingProp]: {
								rich_text: [
									{
										type: 'text',
										text: {
											content: plainText,
											link: {
												url: link,
											},
										},
									},
								],
							},
						},
					});
				});
				updates++;
			}
		}
	}
	const duration = timer.getTime();
	logTag(
		'notion-geocode',
		'cyan',
		`Geocoded ${updates} locations in ${duration}ms`
	);
}

async function initDatabaseGeocoding(
	client: Client,
	database: SearchResponse['results'][number]
) {
	const geocodingProps = getGeocodableProperties(database);
	if (!geocodingProps) {
		return;
	}

	await performDatabaseGeocoding(client, database, geocodingProps, true);
	asyncSetInterval(async () => {
		await performDatabaseGeocoding(client, database, geocodingProps);
	}, NOTION_GEOCODE_UPDATE_INTERVAL);
}

export async function startGeocoder(client: Client): Promise<void> {
	const databases = await getAllForQuery(client.search.bind(client), {
		filter: {
			property: 'object',
			value: 'database',
		},
	});

	const geocodableDatabases = databases.filter((db) =>
		getGeocodableProperties(db)
	);

	for (const geocodableDatabase of geocodableDatabases) {
		await initDatabaseGeocoding(client, geocodableDatabase);
	}
}
