import { MARKED_AUDIO_FOLDER } from '../../lib/constants';
import { MatchHandlerParams } from '../../lib/bot-state';
import { LogObj } from '../../lib/logger';
import { ringClients } from './clients';
import { Color } from '../../lib/color';
import { wait } from '../../lib/util';
import * as fs from 'fs-extra';
import * as path from 'path';
import { RGB } from '.';

interface ParsedMarked {
	'spotify-uri': string;
	color: Color;
	offset?: number;
	items: {
		type: 'melody';
		time: number;
		duration: number;
	}[];
}

async function getData(
	name: string,
	logObj: LogObj
): Promise<
	| { success: true; message: string | null }
	| { success: false; message: string }
	| ParsedMarked
> {
	// Find the file first
	const filePath = path.join(MARKED_AUDIO_FOLDER, `${name}.json`);
	if (!(await fs.pathExists(filePath))) {
		return {
			success: false,
			message: 'File does not exist',
		};
	}

	// Read it
	const file = await fs.readFile(filePath, {
		encoding: 'utf8',
	});

	// Parse it
	let parsed: ParsedMarked | null = null;
	try {
		parsed = JSON.parse(file);
	} catch (e) {
		return {
			success: false,
			message: 'Failed to parse file',
		};
	}

	// Try and authenticate
	const modules = await RGB.modules;
	const authenticated = await new modules.spotifyBeats.External(
		logObj,
		'RGB.MARKED'
	).test();
	if (!authenticated) {
		return {
			success: false,
			message: 'Unauthenticated',
		};
	}

	return parsed!;
}

async function startPlay(
	logObj: LogObj,
	helpers: Pick<MatchHandlerParams, 'ask' | 'sendText'>,
	parsed: ParsedMarked
): Promise<
	| { success: true; message: string | null }
	| { success: false; message: string }
	| null
> {
	// Get devices
	const modules = await RGB.modules;
	const devices = await new modules.spotifyBeats.External(
		logObj,
		'RGB.MARKED'
	).getDevices();

	const devicesParsed = devices && (await devices.json());

	if (!devices || !devicesParsed || devicesParsed.devices.length === 0) {
		return {
			success: false,
			message: 'Failed to find devices',
		};
	}

	// Ask user what device to use
	const response = await helpers.ask(
		`On what device do you want to play? Type the name to choose and type "cancel" to cancel.\n${devicesParsed.devices
			.map((device) => {
				return device.name;
			})
			.join(', ')}`
	);
	if (!response || response.toLowerCase() === 'cancel') {
		return {
			success: true,
			message: 'Canceled by user',
		};
	}

	// Get chosen device
	const chosen = devicesParsed.devices.find(
		(d) => d.name.toLowerCase() === response.toLowerCase()
	);

	if (!chosen) {
		return {
			success: false,
			message: 'Unknown device',
		};
	}

	// Play
	const playResponse = await new modules.spotifyBeats.External(
		logObj,
		'RGB.MARKED'
	).play(parsed['spotify-uri'], chosen.id);

	if (
		!playResponse ||
		playResponse.status >= 300 ||
		playResponse.status < 200
	) {
		return {
			success: false,
			message: 'Failed to play',
		};
	}

	return null;
}

export async function play(
	name: string,
	logObj: LogObj,
	helpers: Pick<MatchHandlerParams, 'ask' | 'sendText' | 'askCancelable'>
): Promise<
	| { success: true; message: string | null }
	| { success: false; message: string }
> {
	// Parse data and make sure everything can run
	const parsed = await getData(name, logObj);
	if ('success' in parsed) {
		return parsed;
	}

	// Start playing the music
	const playing = await startPlay(logObj, helpers, parsed);
	if (playing !== null) {
		return playing;
	}

	await wait(1000 * 2);

	// Fetch playstate at this time, which should allow us to
	// calculate exactly when the song started playing
	const modules = await RGB.modules;
	const playState = await new modules.spotifyBeats.External(
		logObj,
		'RGB.MARKED'
	).getPlayState();
	if (!playState) {
		return {
			success: false,
			message: 'Failed to play',
		};
	}

	const playingTime =
		Date.now() - playState.playStart! + (parsed.offset ?? 0);

	const timeouts: NodeJS.Timeout[] = [];
	parsed.items.forEach((item) => {
		timeouts.push(
			setTimeout(() => {
				void Promise.all(
					ringClients.map((c) =>
						c
							.setColor
							// parsed.color.r,
							// parsed.color.g,
							// parsed.color.b
							()
					)
				).then(() => {
					timeouts.push(
						setTimeout(() => {
							void Promise.all(
								ringClients.map((c) =>
									c
										.setColor
										// 0, 0, 0
										()
								)
							);
						}, Math.min(item.duration, 1) * 1000)
					);
				});
			}, item.time * 1000 - playingTime)
		);
	});

	// eslint-disable-next-line @typescript-eslint/unbound-method
	const { cancel, prom } = helpers.askCancelable(
		'Tell me when I need to stop by saying anything'
	);

	void prom.then(async () => {
		timeouts.forEach((t) => clearTimeout(t));
		await wait(1000);
		await Promise.all(
			ringClients.map((c) =>
				c
					.setColor
					// 0, 0, 0
					()
			)
		);

		await helpers.sendText('stopped');
	});

	const lastItem = parsed.items[parsed.items.length - 1];
	await wait(lastItem.time * 1000 - playingTime + lastItem.duration * 1000);

	cancel();

	return {
		success: true,
		message: 'Done playing',
	};
}
