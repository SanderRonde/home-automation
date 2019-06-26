import { ComplexType, config, ConfigurableWebComponent, Props, PROP_TYPE } from '../../../../../node_modules/wclib/build/es/wclib.js';
import { JSONSwitchesCSS, JSONSwitchesHTML } from './json-switches.templates.js';
import { MessageToast } from '../message-toast/message-toast.js';
import { JSONValue } from '../json-value/json-value.js';

@config({
	is: 'json-switches',
	html: JSONSwitchesHTML,
	css: JSONSwitchesCSS,
	dependencies: [
		JSONValue,
		MessageToast
	]
})
export class JSONSwitches extends ConfigurableWebComponent {
	props = Props.define(this, {
		reflect: {
			json: {
				value: {},
				type: ComplexType<any>()
			},
			key: {
				type: PROP_TYPE.STRING
			}
		}
	});

	private _createClientSecret(id: number) {
		const key = this.props.key!;
		const idArr = (id + '').split('').map(s => parseInt(s, 10));
		this.props.key = '';

		return key.split('').map((char) => {
			let charCode = char.charCodeAt(0);
			for (const idChar of idArr) {
				charCode = charCode ^ idChar;
			}
			return charCode;
		}).join('');
	}

	private _connection: {
		id: string;
		clientSecret: string;
	}|null = null;
	private async _assertConnection() {
		if (this._connection) return true;

		try {
			const response = await fetch(`${location.origin}/authid`, {
				method: 'POST'
			});
			if (!response.ok) {
				MessageToast.create({
					message: `Failed to establish secure connection ${response.status}`,
					duration: 5000
				});
				return false;
			}
			const id = await response.text();
			this._connection = {
				id,
				clientSecret: this._createClientSecret(parseInt(id, 10))
			}
			return true;
		} catch(e) {
			MessageToast.create({
				message: 'Failed to establish secure connection (network error)',
				duration: 5000
			});
			return false;
		}
	}

	private async _sendValChange(key: string, value: string) {
		await this._assertOnline();
		if (!await this._assertConnection()) return false;

		try {
			const response = await fetch(`${location.origin}/keyval/${key}/${value}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					id: this._connection!.id,
					auth: this._connection!.clientSecret
				})
			});
			if (!response.ok) {
				MessageToast.create({
					message: `Failed to update value ${response.status}`,
					duration: 5000
				});
				return false;
			}
			return true;
		} catch(e) {
			MessageToast.create({
				message: 'Failed to update value (network error)',
				duration: 5000
			});
			return false;
		}
	}

	private async _assertOnline() {
		if (navigator.onLine) return;
		return new Promise((resolve) => {
			const toast = MessageToast.create({
				message: 'Waiting for internet...',
				duration: 100000000
			});

			const interval = window.setInterval(() => {
				if (navigator.onLine) {
					window.clearInterval(interval);
					toast.hide();
					resolve();
				}
			}, 1000);
		});
	}

	private async _refreshJSON() {
		await this._assertOnline();
		if (!await this._assertConnection()) return false;

		try {
			const response = await fetch(`${location.origin}/keyval/all`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					id: this._connection!.id,
					auth: this._connection!.clientSecret
				})
			});
			if (!response.ok) {
				MessageToast.create({
					message: `Failed to refresh. ${response.status}`,
					duration: 5000
				});
				return false;
			}
			const json = await response.json();
			this.props.json = json;
			return true;
		} catch(e) {
			MessageToast.create({
				message: 'Failed to refresh (network error)',
				duration: 5000
			});
			return false;
		}
	}

	async changeValue(path: string[], toValue: string) {
		const keys = path.length !== 0 ? 
			[path.join('.')] : Object.getOwnPropertyNames(this.props.json);
		for (const key of keys) {
			if (!await this._sendValChange(key, toValue)) return;
		}
		if (!await this._refreshJSON()) return;
		MessageToast.create({
			message: `Set "${
				path.length === 0 ? '*' :  path.join('.')
			}" to "${toValue}"`,
			duration: 3000
		});
	}

	firstRender() {
		window.setInterval(() => {
			this._refreshJSON();
		}, 1000 * 60);
		this.props.key = this.props.key || localStorage.getItem('key')!;
		localStorage.setItem('key', this.props.key!);
		if (!this.props.json) {
			this._refreshJSON();
		}
	}
}