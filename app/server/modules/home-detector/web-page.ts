import * as express from 'express';
import { errorHandle, authCookie, upgradeToHTTPS } from '../../lib/decorators';
import { ResponseLike } from '../../lib/logger';
import { Auth } from '../auth';
import { Detector } from './classes';

function homeDetectorHTML(json: string, randomNum: number) {
	// TODO: replace auth with external
	return `<html style="background-color: rgb(40, 40, 40);">
			<head>
				<link rel="icon" href="/home-detector/favicon.ico" type="image/x-icon" />
				<meta name="viewport" content="width=device-width, initial-scale=1">
				<title>Who is home</title>
			</head>
			<body style="margin: 0">
				<home-detector-display json='${json}' key="${Auth.Secret.getKey()}"></home-detector-display>
				<script type="module" src="/home-detector/home-detector.bundle.js?n=${randomNum}"></script>
			</body>
		</html>`;
}

export class WebPageHandler {
	private _detector: Detector;
	private _randomNum: number;

	constructor({
		detector,
		randomNum,
	}: {
		randomNum: number;
		detector: Detector;
	}) {
		this._detector = detector;
		this._randomNum = randomNum;
	}

	@errorHandle
	@authCookie
	@upgradeToHTTPS
	public index(
		res: ResponseLike,
		_req: express.Request,
		extended = false
	): void {
		res.status(200);
		res.contentType('.html');
		res.write(
			homeDetectorHTML(
				JSON.stringify(this._detector.getAll(extended)),
				this._randomNum
			)
		);
		res.end();
	}
}
