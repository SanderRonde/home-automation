import {
	ComplexType,
	config,
	Props,
} from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import {
	JSONSwitchesCSS,
	JSONSwitchesHTML,
} from './json-switches.templates.js';
import { MessageToast } from '../../../shared/message-toast/message-toast.js';
import { ServerComm } from '../../../shared/server-comm/server-comm.js';
import { JSONValue } from '../json-value/json-value.js';

function isValSame(a: unknown, b: unknown): boolean {
	if (typeof a !== typeof b) {
		return false;
	}
	if (typeof a === 'object') {
		if (!a) {
			if (b) {
				return false;
			}
		} else if (!b) {
			return false;
		} else {
			if (Array.isArray(a)) {
				if (!isArrSame(a, b as unknown[])) {
					return false;
				}
			} else {
				if (
					!isObjSame(
						a as Record<string, unknown>,
						b as Record<string, unknown>
					)
				) {
					return false;
				}
			}
		}
	} else if (
		typeof a === 'number' ||
		typeof a === 'string' ||
		typeof a === 'boolean'
	) {
		if (a !== b) {
			return false;
		}
	} else {
		return false;
	}
	return true;
}

function isArrSame(a: unknown[], b: unknown[]): boolean {
	if (a.length !== b.length) {
		return false;
	}
	for (let i = 0; i < a.length; i++) {
		if (!isValSame(a[i], b[i])) {
			return false;
		}
	}
	return true;
}

function isObjSame(
	a: Record<string, unknown>,
	b: Record<string, unknown>
): boolean {
	const aKeys = Object.keys(a);
	const bKeys = Object.keys(b);
	if (aKeys.length !== bKeys.length) {
		return false;
	}

	for (const keyA of aKeys) {
		if (bKeys.indexOf(keyA) === -1) {
			return false;
		}
	}
	for (const keyB of bKeys) {
		if (aKeys.indexOf(keyB) === -1) {
			return false;
		}
	}

	for (const key in a) {
		if (!isValSame(a[key], b[key])) {
			return false;
		}
	}
	return true;
}

@config({
	is: 'json-switches',
	html: JSONSwitchesHTML,
	css: JSONSwitchesCSS,
	dependencies: [JSONValue, MessageToast],
})
export class JSONSwitches extends ServerComm {
	props = Props.define(
		this,
		{
			reflect: {
				json: {
					value: {},
					type: ComplexType<unknown>(),
				},
			},
		},
		super.props
	);

	private async _sendValChange(key: string, value: string) {
		return this.request(
			`${location.origin}/keyval/${key}/${value}`,
			{},
			'Failed to update value'
		);
	}

	private async _refreshJSON() {
		const res = await this.request(
			`${location.origin}/keyval/all`,
			{},
			'Failed to refresh'
		);
		if (res === false) {
			return false;
		}
		const json = (await res.json()) as unknown;
		if (!isValSame(json, this.props.json)) {
			this.props.json = json;
		}
		return true;
	}

	async changeValue(path: string[], toValue: string): Promise<void> {
		const keys =
			path.length !== 0
				? [path.join('.')]
				: Object.getOwnPropertyNames(this.props.json);
		for (const key of keys) {
			if (!(await this._sendValChange(key, toValue))) {
				return;
			}
		}
		if (!(await this._refreshJSON())) {
			return;
		}
	}

	async firstRender(): Promise<void> {
		window.setInterval(() => {
			void this._refreshJSON();
		}, 1000 * 60);
		this.props.key = this.props.key || localStorage.getItem('key')!;
		localStorage.setItem('key', this.props.key!);
		if (
			!this.props.json ||
			Object.keys(this.props.json as Record<string, unknown>).length === 0
		) {
			await this._refreshJSON();
		}
	}
}
