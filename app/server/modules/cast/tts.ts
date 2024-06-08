import type { LogObj } from '../../lib/logging/lob-obj';
import { MAX_PART_LEN } from './constants';

function splitTTSParts(text: string) {
	const words = text.split(' ');
	const parts: string[] = [];

	let charLen = 0;
	let partIndex = 0;
	for (let i = 0; i < words.length; i++) {
		charLen += words[i].length + 1;
		if (charLen >= MAX_PART_LEN) {
			partIndex++;
			charLen = 0;
		}
		parts[partIndex] = parts[partIndex] || '';
		parts[partIndex] += words[i] + ' ';
	}
	return parts;
}

export function tts(text: string, lang: string) {
	return (loggable: LogObj): string[] => {
		loggable.attachMessage(`Casting TTS ${text} in lang ${lang}`);

		const parts = splitTTSParts(text);
		return parts.map((part) => {
			return `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&q=${encodeURIComponent(
				part
			)}&client=tw-ob`;
		});
	};
}
