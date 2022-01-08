import { errorHandle } from '../../lib/decorators';
import { ResponseLike } from '../../lib/logger';

function infoScreenHTML(randomNum: number): string {
	return `<!DOCTYPE HTML>
		<html lang="en" style="background-color: rgb(0, 0, 0);">
			<head>
				<title>Info screen</title>
			</head>
			<body style="margin: 0;overflow-x: hidden;">
				<info-screen>Javascript should be enabled</info-screen>
				<script type="module" src="/info-screen/info-screen.bundle.js?n=${randomNum}"></script>
			</body>
		</html>`;
}

export class WebPageHandler {
	private readonly _randomNum: number;

	public constructor({ randomNum }: { randomNum: number }) {
		this._randomNum = randomNum;
	}

	@errorHandle
	public index(res: ResponseLike): void {
		res.status(200);
		res.contentType('.html');
		res.write(infoScreenHTML(this._randomNum));
		res.end();
	}
}
