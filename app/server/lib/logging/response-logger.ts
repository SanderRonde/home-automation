import * as express from 'express';

export interface ResponseLike {
	status(code: number): this;
	redirect(url: string, status?: number): void;
	write(str: string): void;
	sendFile(path: string): void;
	end(): void;
	contentType(type: string): void;
	cookie(name: string, value: string, options?: express.CookieOptions): void;
	_headersSent?: boolean;
}

export class ResDummy implements ResponseLike {
	public _headersSent = false;
	public status(): this {
		return this;
	}
	public sendFile(): void {}
	public redirect(): void {}
	public write(): void {}
	public end(): void {}
	public contentType(): void {}
	public cookie(): void {}
}
