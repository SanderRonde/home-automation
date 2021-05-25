import express = require('express');
import { RGB } from '.';
import { errorHandle, authCookie, upgradeToHTTPS } from '../../lib/decorators';
import { ResponseLike } from '../../lib/logger';
import { CustomPattern, patterns } from './patterns';

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

async function rgbHTML(randomNum: number, res: ResponseLike) {
	const key = await new (
		await RGB.modules
	).auth.external(res, 'HOME_DETECTOR.WEB_PAGE').getSecretKey();
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
		res.write(await rgbHTML(randomNum, res));
		res.end();
	}
}
