import { ResponseLike } from './routes';
import * as express from 'express';
import { Auth } from './auth';
import chalk from 'chalk';

interface AssociatedMessage {
	content: string;
}

const msgMap: WeakMap<ResponseLike|AssociatedMessage, AssociatedMessage[]> = new WeakMap();

function leftpad(char: string, amount: number) {
	return new Array(amount).fill(char).join('');
}

let logLevel: number = 1;
export function setLogLevel(level: number) {
	logLevel = level;
}

function logAssociatedMessages(messages: AssociatedMessage[], indent: number = 0) {
	if (logLevel < indent + 2) return;

	for (let i = 0; i < messages.length; i++) {
		if (i === messages.length - 1) {
			console.log(`${leftpad(' ', indent * 4)}\\-- ${messages[i].content}`);
		} else {
			console.log(`${leftpad(' ', indent * 4)}|-- ${messages[i].content}`);
		}
		logAssociatedMessages(msgMap.get(messages[i]) || [], indent + 1);
	}
}

export function logReq(req: express.Request, res: express.Response) {
	const start = Date.now();
	const ip = req.ip;
	res.on('finish', async () => {
		if (logLevel < 1) return;

		const end = Date.now();
		if (res.statusCode === 200) {
			console.log(chalk.green(`[${res.statusCode}]`), `[${req.method.toUpperCase()}]`, 
				chalk.bgGreen(chalk.black(Auth.Secret.redact(req.url))), 
					'from ip', chalk.bold(ip), `(${end - start} ms)`);
		}
		else if (res.statusCode === 500) {
			console.log(chalk.red(`[${res.statusCode}]`), `[${req.method.toUpperCase()}]`, 
				chalk.bgRed(chalk.black(Auth.Secret.redact(req.url))), 
					'from ip', chalk.bold(ip), `(${end - start} ms)`);
		}
		else {
			console.log(chalk.yellow(`[${res.statusCode}]`), `[${req.method.toUpperCase()}]`, 
				chalk.bgYellow(chalk.black(Auth.Secret.redact(req.url))), 
					'from ip', chalk.bold(ip), `(${end - start} ms)`);
		}

		// Log attached messages
		if (logLevel < 2 || !msgMap.has(res)) return;

		logAssociatedMessages(msgMap.get(res)!);
	});
}

export function transferAttached(from: ResponseLike|AssociatedMessage, to: ResponseLike|AssociatedMessage) {
	const attached = msgMap.get(from) || [];
	if (!msgMap.has(to)) {
		msgMap.set(to, []);
	}

	const messages = msgMap.get(to)!;
	messages.push(...attached);

	msgMap.set(to, messages);
}

export function attachMessage(obj: ResponseLike|AssociatedMessage, message: string) {
	if (!msgMap.has(obj)) {
		msgMap.set(obj, []);
	}

	const messages = msgMap.get(obj)!;
	const msg = {
		content: message,
		children: []
	};
	messages.push(msg);

	return msg;
}