import express = require('express');
import { errorHandle, authCookie, upgradeToHTTPS } from '../../lib/decorators';
import type { ResponseLike } from '../../lib/logging/response-logger';
import { LogObj } from '../../lib/logging/lob-obj';
import type { Database } from '../../lib/db';
import { KeyVal } from '.';

async function keyvalHTML(json: string, randomNum: number, logObj: LogObj) {
	const key = await new (await KeyVal.modules).auth.External(
		logObj
	).getSecretKey();
	return `<!DOCTYPE HTML>
			<html lang="en" style="background-color: rgb(70, 70, 70)">
			<head>
				<link rel="icon" href="/keyval/favicon.ico" type="image/x-icon" />
				<link rel="manifest" href="/keyval/static/manifest.json" />
				<link
					rel="apple-touch-icon"
					href="/keyval/static/apple-touch-icon.png"
				/>
				<meta
					name="description"
					content="An app for controlling keyval entries"
				/>
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<link rel="stylesheet" href="/keyval/antd.dark.css" />
				<title>KeyVal Switch</title>
			</head>
			<body style="margin: 0; overflow-x: hidden">
				<div id="root" json="${json.replace(/"/g, '&quot;')}" key="${key.replace(/"/g, '&quot;')}">
					Javascript should be enabled
				</div>
				<script
					type="module"
					src="/keyval/keyval.js?n=${randomNum}"
				></script>
			</body>
		</html>`;
}

export class WebPageHandler {
	private readonly _db: Database;
	private readonly _randomNum: number;

	public constructor({ db, randomNum }: { randomNum: number; db: Database }) {
		this._db = db;
		this._randomNum = randomNum;
	}

	@errorHandle
	@authCookie
	@upgradeToHTTPS
	public async index(
		res: ResponseLike,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		_req: express.Request
	): Promise<void> {
		res.status(200);
		res.contentType('.html');
		res.write(
			await keyvalHTML(
				await this._db.json(true),
				this._randomNum,
				LogObj.fromRes(res)
			)
		);
		res.end();
	}
}
