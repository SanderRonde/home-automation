import express = require('express');
import { errorHandle, authCookie, upgradeToHTTPS } from '../../lib/decorators';
import type { ResponseLike } from '../../lib/logging/response-logger';

function configHTML(randomNum: number) {
	return `<!DOCTYPE HTML>
		<html lang="en" style="background-color: #000;">
		<head>
			<meta
				name="description"
				content="Configuration page"
			/>
			<meta name="viewport" content="width=device-width, initial-scale=1" />
			<title>Config</title>
		</head>
		<body style="margin: 0; overflow-x: hidden">
			<div id="root">
				Javascript should be enabled
			</div>
			<script
				type="module"
				src="/config/config.js?n=${randomNum}"
			></script>
		</body>
	</html>`;
}

export class WebPageHandler {
	private readonly _randomNum: number;

	public constructor({ randomNum }: { randomNum: number }) {
		this._randomNum = randomNum;
	}

	@errorHandle
	@authCookie
	@upgradeToHTTPS
	public index(
		res: ResponseLike,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		_req: express.Request
	): void {
		res.status(200);
		res.contentType('.html');
		res.write(configHTML(this._randomNum));
		res.end();
	}
}
