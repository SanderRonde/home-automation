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

function logAssociatedMessages(logTime: boolean, messages: AssociatedMessage[], indent: number = 0, hasNextMessage: boolean[] = []) {
	if (logLevel < indent + 2) return;

	for (let i = 0; i < messages.length; i++) {
		const padding = setDefaultArrValues(hasNextMessage, indent, false).map((next) => {
			if (next) {
				return ' |  ';
			} else {
				return '    ';
			}
		}).join('');
		const timeArr = logTime ? [getTime()]: [];
		if (i === messages.length - 1) {
			console.log(...timeArr, `${padding} \\- `, ...messages[i].content);
			hasNextMessage[indent] = false;
		} else {
			console.log(...timeArr, `${padding} |- `, ...messages[i].content);
			hasNextMessage[indent] = true;
		}
		logAssociatedMessages(false, msgMap.get(messages[i]) || [], indent + 1, hasNextMessage);
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
	isSend = true
}: { 
	req?: RequestLike; 
	method?: string;
	url?: string;
	statusCode?: number; 
	duration?: number | string; 
	ip?: string; 
	isSend?: boolean;
}) {
	if (statusCode === 200) {
		return [chalk.green(`[${statusCode}]`), `[${method.toUpperCase()}]`, 
			chalk.bgGreen(chalk.black(Auth.Secret.redact(url))), 
				`${isSend ? '<-' : '->'}`, chalk.bold(ip), `(${duration} ms)`];
	}
	else if (statusCode === 500) {
		return [chalk.red(`[${statusCode}]`), `[${method.toUpperCase()}]`, 
			chalk.bgRed(chalk.black(Auth.Secret.redact(url))), 
				`${isSend ? '<-' : '->'}`, chalk.bold(ip), `(${duration} ms)`];
	}
	else {
		return [chalk.yellow(`[${statusCode}]`), `[${method.toUpperCase()}]`, 
			chalk.bgYellow(chalk.black(Auth.Secret.redact(url))), 
				`${isSend ? '<-' : '->'}`, chalk.bold(ip), `(${duration} ms)`];
	}
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

		logAssociatedMessages(false, msgMap.get(res)!);
	});
}

function getTime() {
	return chalk.bold(`[${new Date().toLocaleString()}]`);
}

export function logOutgoingReq(req: http.ClientRequest, data: {
	method: string;
}) {
	const ip = req.path;

	if (logLevel < 1) return;

	console.log(getTime(), ...genURLLog({ 
		ip: 'localhost',
		method: data.method,
		url: ip
	}));

	// Log attached messages
	if (logLevel < 2 || !msgMap.has(req)) return;

	logAssociatedMessages(false, msgMap.get(req)!);
}

export function logAttached(obj: ResponseLike|AssociatedMessage|{}) {
	if (logLevel < 2 || !msgMap.has(obj)) return;

	logAssociatedMessages(true, msgMap.get(obj)!);
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