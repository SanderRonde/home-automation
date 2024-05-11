import {
	ResponseLike,
	attachSourcedMessage,
	attachMessage,
} from '@server/lib/logger';
import {
	errorHandle,
	requireParams,
	authAll,
	auth,
} from '@server/lib/decorators';
import { addListener, removeListener, update } from '@server/modules/keyval/get-set-listener';
import { Database } from '@server/lib/db';
import { str } from '@server/modules/keyval/helpers';
import { KeyVal } from '.';

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
	public async get(
		res: ResponseLike,
		{
			key,
		}: {
			key: string;
			auth?: string;
		},
		source: string
	): Promise<string> {
		const value = ensureString(this._db.get(key, '0'));
		attachSourcedMessage(
			res,
			source,
			await KeyVal.explainHook,
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
		},
		source: string
	): Promise<string> {
		const original = ensureString(this._db.get<string>(key, '0'));
		const value = original === '0' ? '1' : '0';
		this._db.setVal(key, value);
		const msg = attachSourcedMessage(
			res,
			source,
			await KeyVal.explainHook,
			`Toggling key: "${key}", to val: "${str(value)}"`
		);
		const nextMessage = attachMessage(
			msg,
			`"${str(original)}" -> "${str(value)}"`
		);
		const updated = await update(
			key,
			value,
			attachMessage(nextMessage, 'Updates')
		);
		attachMessage(nextMessage, `Updated ${updated} listeners`);
		res.status(200).write(value);
		res.end();
		return value;
	}

	@errorHandle
	@requireParams('key', 'maxtime', 'expected')
	@auth
	public async getLongPoll(
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
		},
		source: string
	): Promise<void> {
		const value = this._db.get(key, '0');
		if (value !== expected) {
			const msg = attachSourcedMessage(
				res,
				source,
				await KeyVal.explainHook,
				`Key: "${key}", val: "${str(value)}"`
			);
			attachMessage(
				msg,
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
				const msg = attachMessage(
					res,
					`Key: "${key}", val: "${str(value)}"`
				);
				attachMessage(
					msg,
					`Set to "${str(value)}". Expected "${expected}"`
				);
				attachMessage(
					logObj,
					`Returned longpoll with value "${value}"`
				);
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
					const msg = attachMessage(
						res,
						`Key: "${key}", val: "${str(value)}"`
					);
					attachMessage(msg, `Timeout. Expected "${expected}"`);
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
		},
		source: string
	): Promise<boolean> {
		const original = this._db.get(key);
		if (original !== value) {
			this._db.setVal(key, value);
			const msg = attachSourcedMessage(
				res,
				source,
				await KeyVal.explainHook,
				`Key: "${key}", val: "${str(value)}"`
			);
			const nextMessage = attachMessage(
				msg,
				`"${str(original)}" -> "${str(value)}"`
			);
			if (performUpdate) {
				const updated = await update(
					key,
					value,
					attachMessage(nextMessage, 'Updates')
				);
				attachMessage(nextMessage, `Updated ${updated} listeners`);
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
		},
		source: string
	): Promise<void> {
		const data = await this._db.json(force);
		const msg = attachSourcedMessage(
			res,
			source,
			await KeyVal.explainHook,
			data
		);
		attachMessage(msg, `Force? ${force ? 'true' : 'false'}`);
		res.status(200).write(data);
		res.end();
	}
}
