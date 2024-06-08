import express = require('express');
import { errorHandle, authCookie, upgradeToHTTPS } from '../../lib/decorators';
import type { ResponseLike } from '../../lib/logging/response-logger';
import { LogObj } from '../../lib/logging/lob-obj';
import type { CustomPattern } from './patterns';
import { patterns } from './patterns';
import { RGB } from '.';

const patternPreviews = JSON.stringify(
	Object.keys(patterns).map((key) => {
		const {
			pattern: { colors, transitionType },
			defaultSpeed,
		} = patterns[key as CustomPattern];
		return {
			defaultSpeed,
			colors,
			transitionType,
			name: key,
		};
	})
);

async function rgbHTML(randomNum: number, logObj: LogObj) {
	const key = await new (await RGB.modules).auth.External(
		logObj
	).getSecretKey();
	return `<html style="background-color: rgb(70,70,70);">
			<head>
				<link rel="icon" href="/rgb/favicon.ico" type="image/x-icon" />
				<link rel="manifest" href="/rgb/static/manifest.json">
				<meta name="viewport" content="width=device-width, initial-scale=1">
				<title>RGB controller</title>
			</head>
			<body style="margin: 0">
				<rgb-controller key="${key}" patterns='${patternPreviews}'></rgb-controller>
				<script type="module" src="/rgb/rgb.bundle.js?n=${randomNum}"></script>
			</body>
		</html>`;
}

export class WebPageHandler {
	@errorHandle
	@authCookie
	@upgradeToHTTPS
	public static async index(
		res: ResponseLike,
		_req: express.Request,
		randomNum: number
	): Promise<void> {
		res.status(200);
		res.contentType('.html');
		res.write(await rgbHTML(randomNum, LogObj.fromRes(res)));
		res.end();
	}
}
