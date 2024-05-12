import { errorHandle, authCookie, upgradeToHTTPS } from '../../lib/decorators';
import { ResponseLike } from '../../lib/logging/response-logger';
import { LogObj } from '../../lib/logging/lob-obj';
import { Detector } from './classes';
import * as express from 'express';
import { HomeDetector } from '.';

async function homeDetectorHTML(
	json: string,
	randomNum: number,
	logObj: LogObj
) {
	const key = await new (await HomeDetector.modules).auth.External(
		logObj
	).getSecretKey();
	return `<html style="background-color: rgb(40, 40, 40);">
			<head>
				<link rel="icon" href="/home-detector/favicon.ico" type="image/x-icon" />
				<meta name="viewport" content="width=device-width, initial-scale=1">
				<title>Who is home</title>
			</head>
			<body style="margin: 0">
				<home-detector-display json='${json}' key="${key}"></home-detector-display>
				<script type="module" src="/home-detector/home-detector.bundle.js?n=${randomNum}"></script>
			</body>
		</html>`;
}

export class WebPageHandler {
	private readonly _detector: Detector;
	private readonly _randomNum: number;

	public constructor({
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
	public async index(
		res: ResponseLike,
		_req: express.Request,
		extended = false
	): Promise<void> {
		res.status(200);
		res.contentType('.html');
		res.write(
			await homeDetectorHTML(
				JSON.stringify(this._detector.getAll(extended)),
				this._randomNum,
				LogObj.fromRes(res)
			)
		);
		res.end();
	}
}
