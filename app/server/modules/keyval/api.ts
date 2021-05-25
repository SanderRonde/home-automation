import { KeyVal } from '.';
import { Database } from '../../lib/db';
import {
	errorHandle,
	requireParams,
	authAll,
	auth,
} from '../../lib/decorators';
import {
	ResponseLike,
	attachSourcedMessage,
	attachMessage,
} from '../../lib/logger';
import { addListener, removeListener, update } from './get-set-listener';
import { str } from './helpers';

export class APIHandler {
	private _db: Database;

	constructor({ db }: { db: Database }) {
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
		const value = this._db.get(key, '0');
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
		const original = this._db.get(key);
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
			(value, logObj) => {
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
		setTimeout(() => {
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
		}, parseInt(maxtime, 10) * 1000);
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
