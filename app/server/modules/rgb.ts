import { errorHandle, requireParams, auth, authCookie } from '../lib/decorators';
import { Discovery, Control, CustomMode, TransitionTypes } from 'magic-home';
import { attachMessage, ResDummy, getTime } from '../lib/logger';
import { AppWrapper } from '../lib/routes';
import { ResponseLike } from './multi';
import { Auth } from '../lib/auth';
import * as express from 'express';
import chalk from 'chalk';

let clients: Control[]|null = null;
export async function scanRGBControllers() {
	clients = (await new Discovery().scan(10000)).map((client) => {
		return new Control(client.address, {
			wait_for_reply: false
		});
	});
	console.log(getTime(), chalk.cyan(`[rgb]`),
		'Found', chalk.bold(clients.length + ''), 'clients');
}

type CustomPattern = 'rgb'|'rainbow'|'christmas'|'strobe'|'darkColors'|
	'shittyFire'|'betterFire';

const patterns: Object & {
	[K in CustomPattern]: {
		pattern: CustomMode;
		defaultSpeed: number;
	}
}= {
	rgb: {
		pattern: new CustomMode()
			.addColor(255, 0, 0)
			.addColor(0, 255, 0)
			.addColor(0, 0, 255)
			.setTransitionType('fade'),
		defaultSpeed: 100
	},
	rainbow: {
		pattern: new CustomMode()
			.addColor(255, 0, 0)
			.addColor(255, 127, 0)
			.addColor(255, 255, 0)
			.addColor(0, 255, 0)
			.addColor(0, 0, 255)
			.addColor(75, 0, 130)
			.addColor(143, 0, 255)
			.setTransitionType('fade'),
		defaultSpeed: 100
	},
	christmas: {
		pattern: new CustomMode()
			.addColor(255, 61, 42)
			.addColor(0, 239, 0)
			.setTransitionType('jump'),
		defaultSpeed: 70
	},
	strobe: {
		pattern: new CustomMode()
			.addColor(255, 255, 255)
			.addColor(255, 255, 255)
			.addColor(255, 255, 255)
			.setTransitionType('strobe'),
		defaultSpeed: 100
	},
	darkColors: {
		pattern: new CustomMode()
			.addColor(255, 0, 0)
			.addColor(255, 0, 85)
			.addColor(255, 0, 170)
			.addColor(255, 0, 255)
			.addColor(170, 0, 255)
			.addColor(85, 0, 255)
			.addColor(25, 0, 255)
			.addColor(0, 0, 255)
			.addColor(25, 0, 255)
			.addColor(85, 0, 255)
			.addColor(170, 0, 255)
			.addColor(255, 0, 255)
			.addColor(255, 0, 170)
			.addColor(255, 0, 85)
			.setTransitionType('fade'),
		defaultSpeed: 90
	},
	shittyFire: {
		pattern: new CustomMode()
			.addColor(255, 0, 0)
			.addColor(255, 25, 0)
			.addColor(255, 85, 0)
			.addColor(255, 170, 0)
			.addColor(255, 230, 0)
			.addColor(255, 255, 0)
			.addColor(255, 230, 0)
			.addColor(255, 170, 0)
			.addColor(255, 85, 0)
			.addColor(255, 25, 0)
			.addColor(255, 0, 0)
			.setTransitionType('fade'),
		defaultSpeed: 90
	},
	betterFire: {
		pattern: new CustomMode()
			.addColorList(new Array(15).fill('').map(() => {
				return [
					255 - (Math.random() * 90), 
					200 - (Math.random() * 200), 
					0
				] as [number, number, number];
			}))
			.setTransitionType('fade'),
		defaultSpeed: 100
	}
}

class APIHandler {
	@errorHandle
	@requireParams('color')
	@auth
	public static async setColor(res: ResponseLike, { color }: {
		color: string;
		auth?: string;
	}) {
		if (!(color in colorList)) return;
		const hexColor = colorList[color as keyof typeof colorList];
		const { r, g, b } = hexToRGB(hexColor);

		attachMessage(attachMessage(attachMessage(res, `rgb(${r}, ${g}, ${b})`),
			chalk.bgHex(hexColor)('   ')), 
				`Updated ${clients!.length} clients`);
		

		await Promise.all(clients!.map(async (client) => {
			return Promise.all([
				client.setColorWithBrightness(r, g, b, 100),
				client.turnOn()
			]);
		}));

		res.status(200).end();
	}

	private static _singleNumToHex(num: number) {
		if (num < 10) {
			return num + '';
		}
		return String.fromCharCode(97 + (num - 10));
	}

	static toHex(num: number) {
		return this._singleNumToHex(Math.floor(num / 16)) + this._singleNumToHex(num % 16);
	}

	@errorHandle
	@requireParams('red', 'green', 'blue')
	@auth
	public static async setRGB(res: ResponseLike, { red, green, blue }: {
		red: string;
		green: string;
		blue: string;
		auth?: string;
	}) {
		const redNum = Math.min(255, Math.max(0, parseInt(red, 10)));
		const greenNum = Math.min(255, Math.max(0, parseInt(green, 10)));
		const blueNum = Math.min(255, Math.max(0, parseInt(blue, 10)));
		attachMessage(attachMessage(attachMessage(res, `rgb(${red}, ${green}, ${blue})`),
			chalk.bgHex(`#${
				this.toHex(redNum)
			}${
				this.toHex(greenNum)
			}${
				this.toHex(blueNum)
			}`)('   ')), `Updated ${clients!.length} clients`);

		await Promise.all(clients!.map(async (client) => {
			return Promise.all([
				client.setColorWithBrightness(redNum, greenNum, blueNum, 100),
				client.turnOn()
			]);
		}));

		res.status(200).end();
	}

	@errorHandle
	@requireParams('power')
	@auth
	public static async setPower(res: ResponseLike, { power }: {
		power: string;
		auth?: string;
	}) {
		attachMessage(attachMessage(res, `Turned ${power}`),
			`Updated ${clients!.length} clients`);
		await Promise.all(clients!.map(c => power === 'on' ? c.turnOn() : c.turnOff()));
		res.status(200).end();
	}

	static overrideTransition(pattern: CustomMode, transition: 'fade'|'jump'|'strobe') {
		return new CustomMode().addColorList(pattern.colors.map(({ red, green, blue }) => {
			return [red, green, blue] as [number, number, number];
		})).setTransitionType(transition);
	}

	@errorHandle
	@requireParams('pattern')
	@auth
	public static async runPattern(res: ResponseLike, { pattern: patternName, speed, transition }: {
		pattern: CustomPattern;
		speed?: number;
		transition?: string;
		auth?: string;
	}) {
		if (!patterns.hasOwnProperty(patternName)) {
			attachMessage(res, `Pattern ${patternName} does not exist`);
			res.status(400).write('Unknown pattern');
			res.end();
			return;
		}

		let { pattern, defaultSpeed } = patterns[patternName as CustomPattern];
		if (transition) {
			if (['fade', 'jump', 'strobe'].indexOf(transition) === -1) {
				attachMessage(res, `Invalid transition mode ${transition}`);
				res.status(400).write('Invalid transiton mode');
				res.end();
				return;
			}

			pattern = this.overrideTransition(pattern, transition as TransitionTypes);
		}

		attachMessage(
			attachMessage(res, `Running pattern ${patternName}`),
			`Updated ${clients!.length} clients`);
		try {
			await Promise.all(clients!.map((c) => {
				return Promise.all([
					c.setCustomPattern(pattern, speed || defaultSpeed),
					c.turnOn()
				]);
			}));
			res.status(200).end();
		} catch(e) {
			res.status(400).write('Failed to run pattern');
			res.end();
		}
	}

	@errorHandle
	@requireParams('function')
	@auth
	public static async runFunction(res: ResponseLike, { function: fn }: {
		function: string;
		auth?: string;
	}) {
		attachMessage(attachMessage(res, `Running function ${fn}`),
			`Updated ${clients!.length} clients`);
		await Promise.all(clients!.map((c) => {
			c.startEffectMode()
		}));
		res.status(200).end();
	}

	@errorHandle
	@auth
	public static async refresh(res: ResponseLike) {
		await scanRGBControllers();
		res.status(200);
		res.end();
	}
}

type ExternalRequest = (({
	type: 'color';
} & ({
	color: string;
}|{
	r: string;
	g: string;
	b: string;
}))|{
	type: 'power';
	state: 'on'|'off';
}|{
	type: 'pattern';
	name: string;
	speed?: number;
	transition?: 'fade'|'jump'|'strobe';
}) & {
	logObj: any;
	resolver: () => void;
}

export class RGBExternal {
	private static _requests: ExternalRequest[] = [];

	private static _ready: boolean = false;
	static async init() {
		this._ready = true;
		for (const req of this._requests) {
			await this._handleRequest(req);
		}
	}

	constructor(private _logObj: any) { }

	private static async _handleRequest(request: ExternalRequest) {
		const { logObj, resolver } = request;
		const resDummy = new ResDummy();
		if (request.type === 'color') {
			if ('color' in request) {
				await APIHandler.setColor(resDummy, {
					color: request.color,
					auth: await Auth.Secret.getKey()
				});
			} else {
				const { r, g, b } = request;
				await APIHandler.setRGB(resDummy, {
					red: r,
					green: g,
					blue: b,
					auth: await Auth.Secret.getKey()
				});
			}
		} else if (request.type == 'power') {
			await APIHandler.setPower(resDummy, {
				power: request.state,
				auth: await Auth.Secret.getKey()
			});
		} else {
			const { name, speed, transition } = request;
			await APIHandler.runPattern(resDummy, {
				pattern: name as any,
				speed,
				transition,
				auth: await Auth.Secret.getKey()
			});
		}
		resDummy.transferTo(logObj);
		resolver();
	}

	async color(color: string) {
		return new Promise((resolve) => {
			const req: ExternalRequest = {
				type: 'color',
				color: color,
				logObj: this._logObj,
				resolver: resolve
			};
			if (RGBExternal._ready) {
				RGBExternal._handleRequest(req);
			} else {
				RGBExternal._requests.push(req)
			}
		});
	}

	async rgb(red: string, green: string, blue: string) {
		return new Promise((resolve) => {
			const req: ExternalRequest = {
				type: 'color',
				r: red,
				g: green,
				b: blue,
				logObj: this._logObj,
				resolver: resolve
			};
			if (RGBExternal._ready) {
				RGBExternal._handleRequest(req);
			} else {
				RGBExternal._requests.push(req)
			}
		});
	}

	async power(state: 'on'|'off') {
		return new Promise((resolve) => {
			const req: ExternalRequest = {
				type: 'power',
				state: state,
				logObj: this._logObj,
				resolver: resolve
			};
			if (RGBExternal._ready) {
				RGBExternal._handleRequest(req);
			} else {
				RGBExternal._requests.push(req)
			}
		});
	}

	async pattern(name: string, speed?: number, transition?: 'fade'|'jump'|'strobe') {
		return new Promise((resolve) => {
			const req: ExternalRequest = {
				type: 'pattern',
				name,
				speed,
				transition,
				logObj: this._logObj,
				resolver: resolve
			};
			if (RGBExternal._ready) {
				RGBExternal._handleRequest(req);
			} else {
				RGBExternal._requests.push(req)
			}
		});
	}
}

const patternPreviews = JSON.stringify(Object.keys(patterns).map((key) => {
	const { pattern: { colors, transitionType}, defaultSpeed } = patterns[key as CustomPattern];
	return {
		defaultSpeed,
		colors,
		transitionType,
		name: key
	}
}));

async function rgbHTML(randomNum: number) {
	return `<html style="background-color: rgb(70,70,70);">
		<head>
			<link rel="icon" href="/rgb/favicon.ico" type="image/x-icon" />
			<link rel="manifest" href="/rgb/static/manifest.json">
			<meta name="viewport" content="width=device-width, initial-scale=1">
			<title>RGB controller</title>
		</head>
		<body style="margin: 0">
			<rgb-controller key="${await Auth.Secret.getKey()}" patterns='${patternPreviews}'></rgb-controller>
			<script type="module" src="/rgb/rgb.bundle.js?n=${randomNum}"></script>
		</body>
	</html>`;
}

class WebpageHandler {
	@errorHandle
	@authCookie
	public static async index(res: ResponseLike, _req: express.Request, randomNum: number) {
		res.status(200);
		res.contentType('.html');
		res.write(await rgbHTML(randomNum));
		res.end();
	}
}

export async function initRGBRoutes({ app, randomNum }: { 
	app: AppWrapper; 
	randomNum: number; 
}) {
	await scanRGBControllers();
	setInterval(scanRGBControllers, 1000 * 60 * 60);
	await RGBExternal.init();

	app.post('/rgb/color/:color', async (req, res) => {
		await APIHandler.setColor(res, {...req.params, ...req.body});
	});
	app.post('/rgb/color/:red/:green/:blue', async (req, res) => {
		await APIHandler.setRGB(res, {...req.params, ...req.body});
	});
	app.post('/rgb/power/:power', async (req, res) => {
		await APIHandler.setPower(res, {...req.params, ...req.body});
	});
	app.post('/rgb/pattern/:pattern/:speed?/:transition?', async (req, res) => {
		await APIHandler.runPattern(res, {...req.params, ...req.body});
	});
	app.post('/rgb/function/:function', async (req, res) => {
		await APIHandler.runFunction(res, {...req.params, ...req.body});
	});
	app.post('/rgb/refresh', async (_req, res) => {
		await APIHandler.refresh(res);
	});
	app.all('/rgb', async (req, res) => {
		await WebpageHandler.index(res, req, randomNum);
	});
}

const HEX_REGEX = /#([a-fA-F\d]{2})([a-fA-F\d]{2})([a-fA-F\d]{2})/;
function hexToRGB(hex: string) {
	const match = HEX_REGEX.exec(hex)!;

	const [ , r, g, b ] = match;
	return {
		r: parseInt(r, 16),
		g: parseInt(g, 16),
		b: parseInt(b, 16)
	}
}

const colorList = {
	"aliceblue": "#f0f8ff",
	"antiquewhite": "#faebd7",
	"aqua": "#00ffff",
	"aquamarine": "#7fffd4",
	"azure": "#f0ffff",
	"beige": "#f5f5dc",
	"bisque": "#ffe4c4",
	"black": "#000000",
	"blanchedalmond": "#ffebcd",
	"blue": "#0000ff",
	"blueviolet": "#8a2be2",
	"brown": "#a52a2a",
	"burlywood": "#deb887",
	"cadetblue": "#5f9ea0",
	"chartreuse": "#7fff00",
	"chocolate": "#d2691e",
	"coral": "#ff7f50",
	"cornflowerblue": "#6495ed",
	"cornsilk": "#fff8dc",
	"crimson": "#dc143c",
	"cyan": "#00ffff",
	"darkblue": "#00008b",
	"darkcyan": "#008b8b",
	"darkgoldenrod": "#b8860b",
	"darkgray": "#a9a9a9",
	"darkgreen": "#006400",
	"darkgrey": "#a9a9a9",
	"darkkhaki": "#bdb76b",
	"darkmagenta": "#8b008b",
	"darkolivegreen": "#556b2f",
	"darkorange": "#ff8c00",
	"darkorchid": "#9932cc",
	"darkred": "#8b0000",
	"darksalmon": "#e9967a",
	"darkseagreen": "#8fbc8f",
	"darkslateblue": "#483d8b",
	"darkslategray": "#2f4f4f",
	"darkslategrey": "#2f4f4f",
	"darkturquoise": "#00ced1",
	"darkviolet": "#9400d3",
	"deeppink": "#ff1493",
	"deepskyblue": "#00bfff",
	"dimgray": "#696969",
	"dimgrey": "#696969",
	"dodgerblue": "#1e90ff",
	"firebrick": "#b22222",
	"floralwhite": "#fffaf0",
	"forestgreen": "#228b22",
	"fuchsia": "#ff00ff",
	"gainsboro": "#dcdcdc",
	"ghostwhite": "#f8f8ff",
	"gold": "#ffd700",
	"goldenrod": "#daa520",
	"gray": "#808080",
	"green": "#008000",
	"greenyellow": "#adff2f",
	"grey": "#808080",
	"honeydew": "#f0fff0",
	"hotpink": "#ff69b4",
	"indianred": "#cd5c5c",
	"indigo": "#4b0082",
	"ivory": "#fffff0",
	"khaki": "#f0e68c",
	"lavender": "#e6e6fa",
	"lavenderblush": "#fff0f5",
	"lawngreen": "#7cfc00",
	"lemonchiffon": "#fffacd",
	"lightblue": "#add8e6",
	"lightcoral": "#f08080",
	"lightcyan": "#e0ffff",
	"lightgoldenrodyellow": "#fafad2",
	"lightgray": "#d3d3d3",
	"lightgreen": "#90ee90",
	"lightgrey": "#d3d3d3",
	"lightpink": "#ffb6c1",
	"lightsalmon": "#ffa07a",
	"lightseagreen": "#20b2aa",
	"lightskyblue": "#87cefa",
	"lightslategray": "#778899",
	"lightslategrey": "#778899",
	"lightsteelblue": "#b0c4de",
	"lightyellow": "#ffffe0",
	"lime": "#00ff00",
	"limegreen": "#32cd32",
	"linen": "#faf0e6",
	"magenta": "#ff00ff",
	"maroon": "#800000",
	"mediumaquamarine": "#66cdaa",
	"mediumblue": "#0000cd",
	"mediumorchid": "#ba55d3",
	"mediumpurple": "#9370db",
	"mediumseagreen": "#3cb371",
	"mediumslateblue": "#7b68ee",
	"mediumspringgreen": "#00fa9a",
	"mediumturquoise": "#48d1cc",
	"mediumvioletred": "#c71585",
	"midnightblue": "#191970",
	"mintcream": "#f5fffa",
	"mistyrose": "#ffe4e1",
	"moccasin": "#ffe4b5",
	"navajowhite": "#ffdead",
	"navy": "#000080",
	"oldlace": "#fdf5e6",
	"olive": "#808000",
	"olivedrab": "#6b8e23",
	"orange": "#ffa500",
	"orangered": "#ff4500",
	"orchid": "#da70d6",
	"palegoldenrod": "#eee8aa",
	"palegreen": "#98fb98",
	"paleturquoise": "#afeeee",
	"palevioletred": "#db7093",
	"papayawhip": "#ffefd5",
	"peachpuff": "#ffdab9",
	"peru": "#cd853f",
	"pink": "#ffc0cb",
	"plum": "#dda0dd",
	"powderblue": "#b0e0e6",
	"purple": "#800080",
	"rebeccapurple": "#663399",
	"red": "#ff0000",
	"rosybrown": "#bc8f8f",
	"royalblue": "#4169e1",
	"saddlebrown": "#8b4513",
	"salmon": "#fa8072",
	"sandybrown": "#f4a460",
	"seagreen": "#2e8b57",
	"seashell": "#fff5ee",
	"sienna": "#a0522d",
	"silver": "#c0c0c0",
	"skyblue": "#87ceeb",
	"slateblue": "#6a5acd",
	"slategray": "#708090",
	"slategrey": "#708090",
	"snow": "#fffafa",
	"springgreen": "#00ff7f",
	"steelblue": "#4682b4",
	"tan": "#d2b48c",
	"teal": "#008080",
	"thistle": "#d8bfd8",
	"tomato": "#ff6347",
	"turquoise": "#40e0d0",
	"violet": "#ee82ee",
	"wheat": "#f5deb3",
	"white": "#ffffff",
	"whitesmoke": "#f5f5f5",
	"yellow": "#ffff00",
	"yellowgreen": "#9acd32"
};