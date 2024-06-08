import express = require('express');
import { errorHandle, authCookie, upgradeToHTTPS } from '../../lib/decorators';
import type { ResponseLike } from '../../lib/logging/response-logger';

function visualizeHTML(randomNum: number) {
	return `<!DOCTYPE HTML>
			<html lang="en" style="background-color: rgb(70,70,70);">
				<head>
					<link rel="icon" href="/visualize/favicon.ico" type="image/x-icon" />
					<meta name="description" content="An app for viewing data">
					<meta name="viewport" content="width=device-width, initial-scale=1">
					<title>Visualize</title>
				</head>
				<body style="margin: 0;overflow-x: hidden;">
					<div id="app"></div>
					<script type="module" src="/visualize/visualize.bundle.js?n=${randomNum}"></script>
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
		res.write(visualizeHTML(this._randomNum));
		res.end();
	}
}
