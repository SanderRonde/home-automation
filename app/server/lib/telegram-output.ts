import { RESPONSE_TYPE } from "../modules/bot";

function padWord(word: string, length: number, padChar: string = ' ') {
	if (word.length === length) return word;

	let newStr: string = word;
	while (newStr.length + 1 <= length) {
        newStr = `${newStr}${padChar}`;
    }
    return newStr;
}

export function makeTable({ header, contents }: {
	header?: string[];
	contents: string[][];
}) {
	// const result: string[] = [];

	// if (header) {
	// 	result.push(header.join('|'));
	// 	result.push(header.map(_ => '---').join('|'));
	// }

	// for (const row of contents) {
	// 	result.push(row.join('|'));
	// 

	if (!contents.every(row => row.length === (header ? 
			header.length : contents[0].length))) {
				throw new Error('Invalid table dimensions');
			}

	if (contents.length === 0) {
		if (!header) {
			return 'Empty table';
		} else {
			contents = [new Array(header.length).fill('empty')];
		}
	}
	const data = [...(header ? [ header ] : []), ...contents];

	const columns = contents[0].length;
	const colLengths = [];

	for (let column = 0; column < columns; column++) {
		colLengths[column] = 0;
		for (let row = 0; row < data.length; row++) {
			if (data[row][column].length > colLengths[column]) {
				colLengths[column] = data[row][column].length;
			}
		}
	}

	const output: string[] = [];
	for (let i = 0; i < data.length; i++) {
		output.push('');
		for (let j = 0; j < data[i].length; j++) {
			let cellText = '';
			if (j !== 0) {
				cellText += '|';
			}
			if (j != 0) {
				cellText += ' ';
			}
			cellText += padWord(data[i][j], colLengths[j]);
			cellText += ' ';

			output[output.length - 1] += cellText;
		}

		if (header && i === 0) {
			output.push('');
			for (let j = 0; j < data[i].length; j++) {
				let cellText = '---';
				cellText += padWord('', colLengths[j], '-');
				output[output.length - 1] += cellText;
			}
		}
	}
	
	return {
		type: RESPONSE_TYPE.HTML,
		text: `<pre>${output.join('\n')}</pre>`
	};
}