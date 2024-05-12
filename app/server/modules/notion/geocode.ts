import {
	QueryDatabaseParameters,
	SearchResponse,
} from '@notionhq/client/build/src/api-endpoints';
import { NOTION_GEOCODE_UPDATE_INTERVAL } from '../../lib/constants';
import { getAllForQuery, notionRequest } from './client';
import { logTag } from '../../lib/logging/logger';
import { asyncSetInterval } from '../../lib/util';
import { captureTime } from '../../lib/timer';
import { Client } from '@notionhq/client';
import { WithAuth } from './types';

const geocodeLocationRegex = /(.*) \(#location\)/;

function getGeocodableProperties(
	database: SearchResponse['results'][number]
): string[] | null {
	if (database.object !== 'database') {
		return null;
	}

	const properties = Object.values(database.properties);
	const props: string[] = [];
	for (const property of properties) {
		if (property.type !== 'rich_text') {
			continue;
		}
		if (geocodeLocationRegex.exec(property.name)) {
			props.push(property.name);
		}
	}

	if (props.length === 0) {
		return null;
	}
	if (!properties.some((prop) => prop.type === 'last_edited_time')) {
		logTag(
			'notion-geocode',
			'red',
			`Not geocoding database ${
				// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-explicit-any
				(database as any).url
			} because column "last_edited_time" is missing`
		);
		return null;
	}
	return props;
}

async function performDatabaseGeocoding(
	client: Client,
	database: SearchResponse['results'][number],
	geocodingProps: string[],
	forAll: boolean = false
) {
	const timer = captureTime();
	if (!('properties' in database)) {
		return;
	}
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
			if (!('properties' in row)) {
				continue;
			}
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
