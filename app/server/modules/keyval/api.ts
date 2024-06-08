import {
	errorHandle,
	requireParams,
	authAll,
	auth,
} from '../../lib/decorators';
import { addListener, removeListener, update } from './get-set-listener';
import type { ResponseLike } from '../../lib/logging/response-logger';
import { LogObj } from '../../lib/logging/lob-obj';
import type { Database } from '../../lib/db';
import { str } from './helpers';

type MultiValueResolver<V> = (values: V[]) => V;

function getObjectValue<V>(
	obj: ObjValue<V>,
	resolver: MultiValueResolver<V>
): V {
	const values: V[] = [];
	for (const key in obj) {
		const value = obj[key];
		if (typeof value === 'object') {
			values.push(getObjectValue(value as ObjValue<V>, resolver));
		} else {
			values.push(value);
		}
	}
	return resolver(values);
}

const keyvalMultiValueResolver: MultiValueResolver<'1' | '0'> = (values) => {
	if (values.length === 0) {
		return '0';
	}
	for (const value of values) {
		if (value === '0') {
			return '0';
		}
	}
	return '1';
};

type ObjValue<V> = {
	[key: string]: V | ObjValue<V>;
};

function ensureString(value: string | ObjValue<string>): string {
	if (typeof value === 'object') {
		return getObjectValue(value, keyvalMultiValueResolver);
	}
	return value;
}

export class APIHandler {
	private readonly _db: Database;

	public constructor({ db }: { db: Database }) {
		this._db = db;
	}

	@errorHandle
	@requireParams('key')
	@auth
	public get(
		res: ResponseLike,
		{
			key,
		}: {
			key: string;
			auth?: string;
		}
	): string {
		const value = ensureString(this._db.get(key, '0'));
		LogObj.fromRes(res).attachMessage(
			`Key: "${key}", val: "${str(value)}"`
		);
		res.status(200).write(value === undefined ? '' : value);
		res.end();
		return value;
	}

	@errorHandle
	@requireParams('key')
	@auth
	public async toggle(
		res: ResponseLike,
		{
			key,
		}: {
			key: string;
			auth?: string;
		}
	): Promise<string> {
		const original = ensureString(this._db.get<string>(key, '0'));
		const value = original === '0' ? '1' : '0';
		this._db.setVal(key, value);
		const msg = LogObj.fromRes(res).attachMessage(
			`Toggling key: "${key}", to val: "${str(value)}"`
		);
		const nextMessage = msg.attachMessage(
			`"${str(original)}" -> "${str(value)}"`
		);
		const updated = await update(
			key,
			value,
			nextMessage.attachMessage('Updates'),
			this._db
		);
		nextMessage.attachMessage(`Updated ${updated} listeners`);
		res.status(200).write(value);
		res.end();
		return value;
	}

	@errorHandle
	@requireParams('key', 'maxtime', 'expected')
	@auth
	public getLongPoll(
		res: ResponseLike,
		{
			key,
			expected,
			maxtime,
		}: {
			key: string;
			expected: string;
			auth: string;
			maxtime: string;
		}
	): void {
		const value = this._db.get(key, '0');
		if (value !== expected) {
			const msg = LogObj.fromRes(res).attachMessage(
				`Key: "${key}", val: "${str(value)}"`
			);
			msg.attachMessage(
				`(current) "${str(value)}" != (expected) "${expected}"`
			);
			res.status(200).write(value === undefined ? '' : value);
			res.end();
			return;
		}

		// Wait for changes to this key
		let triggered = false;
		const id = addListener(
			key,
			(value, _key, logObj) => {
				triggered = true;
				const msg = logObj.attachMessage(
					`Key: "${key}", val: "${str(value)}"`
				);
				msg.attachMessage(
					`Set to "${str(value)}". Expected "${expected}"`
				);
				logObj.attachMessage(`Returned longpoll with value "${value}"`);
				res.status(200).write(value === undefined ? '' : value);
				res.end();
			},
			{ once: true }
		);
		setTimeout(
			() => {
				if (!triggered) {
					removeListener(id);
					const value = this._db.get(key, '0');
					const msg = LogObj.fromRes(res).attachMessage(
						`Key: "${key}", val: "${str(value)}"`
					);
					msg.attachMessage(`Timeout. Expected "${expected}"`);
					res.status(200).write(value === undefined ? '' : value);
					res.end();
				}
			},
			parseInt(maxtime, 10) * 1000
		);
	}

	@errorHandle
	@requireParams('key', 'value')
	@authAll
	public async set(
		res: ResponseLike,
		{
			key,
			value,
			update: performUpdate = true,
		}: {
			key: string;
			value: string;
			auth?: string;
			update?: boolean;
		}
	): Promise<boolean> {
		const original = this._db.get(key);
		if (original !== value) {
			this._db.setVal(key, value);
			const msg = LogObj.fromRes(res).attachMessage(
				`Key: "${key}", val: "${str(value)}"`
			);
			const nextMessage = msg.attachMessage(
				`"${str(original)}" -> "${str(value)}"`
			);
			if (performUpdate) {
				const updated = await update(
					key,
					value,
					nextMessage.attachMessage('Updates'),
					this._db
				);
				nextMessage.attachMessage(`Updated ${updated} listeners`);
			}
		}
		res.status(200).write(value);
		res.end();
		return true;
	}

	@errorHandle
	@authAll
	public async all(
		res: ResponseLike,
		{
			force = false,
		}: {
			force?: boolean;
		}
	): Promise<void> {
		const data = await this._db.json(force);
		const msg = LogObj.fromRes(res).attachMessage(data);
		msg.attachMessage(`Force? ${force ? 'true' : 'false'}`);
		res.status(200).write(data);
		res.end();
	}
}
