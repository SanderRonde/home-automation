declare module "@serialport/parser-readline" {
	export class ReadLine extends WritableStream {
		constructor(config?: {
			delimiter?: string;
			encoding?: string;
		});

		on(event: 'data', handler: (line: string) => void): void;
		on(event: string, handler: Function): void;
	}
}