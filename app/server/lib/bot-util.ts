import { RESPONSE_TYPE } from '../modules/bot';

export namespace BotUtil {
	function padWord(word: string, length: number, padChar: string = ' ') {
		if (word.length === length) return word;
	
		let newStr: string = word;
		while (newStr.length + 1 <= length) {
			newStr = `${newStr}${padChar}`;
		}
		return newStr;
	}

	export abstract class BotUtil {
		public static mergeArr(arr1: any[], arr2: any[]) {
			for (let i = 0; i < arr2.length; i++) {
				if (i > arr1.length || typeof arr1[i] !== 'object') {
					arr1[i] = arr2[i];
				} else {
					if (Array.isArray(arr1[i])) {
						this.mergeArr(arr1[i], arr2[i]);
					} else {
						this.mergeObj(arr1[i], arr2[i]);
					}
				}
			}
			return arr1;
		}

		public static mergeObj<T1>(config: T1, extra: Object): T1 {
			const final = { ...config };
			for (const key in extra) {
				if (!(key in config) || typeof (config as any)[key] !== 'object') {
					if ((extra as any)[key] === undefined) continue;
					(final as any)[key] = (extra as any)[key];
				} else {
					// Merge object or array
					if (Array.isArray((config as any)[key])) {
						this.mergeArr((final as any)[key], (extra as any)[key]);
					} else {
						this.mergeObj((final as any)[key], (extra as any)[key]);
					}
				}
			}
			return final;
		}

		public static formatList(list: string[]): string {
			if (list.length === 0) {
				return `(empty)`
			}
			if (list.length === 1) {
				return `${list[0]}`;
			} else {
				return `${list.slice(0, -1).join(', ')} and ${list.slice(-1)}`
			}
		}
		
		public static makeTable({ header, contents }: {
			header?: string[];
			contents: string[][];
		}) {
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
	}
}