import { ResponseLike } from '../modules/multi';
import * as express from 'express';
import { Auth } from './auth';
import * as http from 'http';
import chalk from 'chalk';

interface AssociatedMessage {
	content: string[];
}

const msgMap: WeakMap<ResponseLike|AssociatedMessage|{}, AssociatedMessage[]> = new WeakMap();

let logLevel: number = 1;
export function setLogLevel(level: number) {
	logLevel = level;
}

export function getLogLevel() {
	return logLevel;
}

function setDefaultArrValues<T>(arr: T[], len: number, value: T): T[] {
	for (let i = 0; i < len; i++) {
		arr[i] = arr[i] || value;
	}
	arr.splice(len);
	return arr;
}

function logAssociatedMessages(messages: AssociatedMessage[], indent: number = 0, hasNextMessage: boolean[] = []) {
	if (logLevel < indent + 2) return;

	for (let i = 0; i < messages.length; i++) {
		const padding = setDefaultArrValues(hasNextMessage, indent, false).map((next) => {
			if (next) {
				return ' |   ';
			} else {
				return '     ';
			}
		}).join('');
		const timeFiller = getTimeFiller();
		if (i === messages.length - 1) {
			console.log(timeFiller, `${padding} \\- `, ...messages[i].content);
			hasNextMessage[indent] = false;
		} else {
			console.log(timeFiller, `${padding} |- `, ...messages[i].content);
			hasNextMessage[indent] = true;
		}
		logAssociatedMessages(msgMap.get(messages[i]) || [], indent + 1, hasNextMessage);
	}
}

interface RequestLike {
	url?: string;
	method?: string;
	ip?: string;
}

export function genURLLog({ 
	req = {}, 
	url = req.url || '?', 
	method = req.method || '?',
	statusCode = 200, 
	duration = '?', 
	ip = req.ip || '?' ,
	isSend = false
}: { 
	req?: RequestLike; 
	method?: string;
	url?: string;
	statusCode?: number; 
	duration?: number | string; 
	ip?: string; 
	isSend?: boolean;
}) {
	const [ statusColor, ipBg ] = (() => {
		if (statusCode === 200) {
			return [chalk.green, chalk.bgGreen];
		}
		else if (statusCode === 500) {
			return [chalk.red, chalk.bgRed];
		}
		else {
			return [chalk.yellow, chalk.bgYellow];
		}
	})();
	return [statusColor(`[${statusCode}]`), `[${method.toUpperCase()}]`, 
		ipBg(chalk.black(Auth.Secret.redact(url))), 
			`${isSend ? '->' : '<-'}`, chalk.bold(ip), `(${duration} ms)`];
}

export function logReq(req: express.Request, res: express.Response) {
	const start = Date.now();
	const ip = req.ip;
	res.on('finish', async () => {
		if (logLevel < 1) return;

		const end = Date.now();
		console.log(getTime(), ...genURLLog({ 
			req, 
			statusCode: res.statusCode, 
			duration: end - start, 
			ip 
		}));

		// Log attached messages
		if (logLevel < 2 || !msgMap.has(res)) return;

		logAssociatedMessages(msgMap.get(res)!);
	});
}

export function getTime() {
	return chalk.bold(`[${new Date().toLocaleString()}]`);
}

function getTimeFiller() {
	return new Array(new Date().toLocaleString().length + 2).fill(' ').join('');
}

export function logOutgoingReq(req: http.ClientRequest, data: {
	method: string;
	target: string;
}) {
	const ip = req.path;

	if (logLevel < 1) return;

	console.log(getTime(), ...genURLLog({ 
		ip: data.target,
		method: data.method,
		url: ip,
		isSend: true
	}));

	// Log attached messages
	if (logLevel < 2 || !msgMap.has(req)) return;

	logAssociatedMessages(msgMap.get(req)!);
}

export function logFixture(obj: ResponseLike|AssociatedMessage|{}, ...name: string[]) {
	console.log(getTime(), ...name);

	// Log attached messages
	if (logLevel < 2 || !msgMap.has(obj)) return;

	logAssociatedMessages(msgMap.get(obj)!);
}

export function transferAttached(from: ResponseLike|AssociatedMessage|{}, to: ResponseLike|AssociatedMessage|{}) {
	const attached = msgMap.get(from) || [];
	if (!msgMap.has(to)) {
		msgMap.set(to, []);
	}

	const messages = msgMap.get(to)!;
	messages.push(...attached);

	msgMap.set(to, messages);
	msgMap.delete(from);
}

export function attachMessage(obj: ResponseLike|AssociatedMessage|{}, ...messages: string[]) {
	if (!msgMap.has(obj)) {
		msgMap.set(obj, []);
	}

	const prevMessages = msgMap.get(obj)!;
	const msg = {
		content: messages,
		children: []
	};
	prevMessages.push(msg);

	return msg;
}

export class ResDummy implements ResponseLike {
	status() {
		return this;
	}
	write() { }
	end() { }
	contentType() {}
	cookie() {}

	transferTo(obj: ResponseLike|AssociatedMessage|{}) {
		transferAttached(this, obj);
	}
}