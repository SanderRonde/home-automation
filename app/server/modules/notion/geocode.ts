import {
	QueryDatabaseParameters,
	SearchResponse,
} from '@notionhq/client/build/src/api-endpoints';
import { Client } from '@notionhq/client';
import { getAllForQuery } from './client';
import { NOTION_GEOCODE_UPDATE_INTERVAL } from '../../lib/constants';

const geocodeLocationRegex = /(.*) \(#location\)/;

type WithAuth<P> = P & {
	auth?: string | undefined;
};

function getGeocodableProperties(
	database: SearchResponse['results'][number]
): string | null {
	if (database.object !== 'database') {
		return null;
	}

	const properties = Object.values(database.properties);
	if (!properties.some((prop) => prop.type === 'last_edited_time')) {
		return null;
	}
	for (const property of properties) {
		if (property.type !== 'rich_text') {
			continue;
		}
		if (geocodeLocationRegex.exec(property.name)) {
			return property.name;
		}
	}

	return null;
}

async function performDatabaseGeocoding(
	client: Client,
	database: SearchResponse['results'][number],
	geocodingProp: string,
	forAll: boolean = false
) {
	const lastEditedProp = Object.values(database.properties).find(
		(prop: { type: string }) => prop.type === 'last_edited_time'
	) as {
		name: string;
	};
	const filters: unknown[] = [
		{
			property: geocodingProp,
			text: {
				is_not_empty: true,
			},
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

	for (const row of contents) {
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
		}
	}
}

async function initDatabaseGeocoding(
	client: Client,
	database: SearchResponse['results'][number]
) {
	const geocodingProp = getGeocodableProperties(database);
	if (!geocodingProp) {
		return;
	}

	await performDatabaseGeocoding(client, database, geocodingProp, true);
	setInterval(async () => {
		await performDatabaseGeocoding(client, database, geocodingProp);
	}, NOTION_GEOCODE_UPDATE_INTERVAL);
}

export async function initGeocoder(client: Client): Promise<void> {
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
