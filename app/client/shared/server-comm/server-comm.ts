import { 
	ConfigurableWebComponent, Props, PROP_TYPE, config, EventListenerObj
} from "../../../../node_modules/wclib/build/es/wclib.js";
import { MessageToast } from "../message-toast/message-toast.js";

@config({
	is: 'server-comm',
	html: null,
	css: null,
	dependencies: [
		MessageToast
	]
})
export abstract class ServerComm<ELS extends {
	IDS: {
		[key: string]: HTMLElement|SVGElement;
	};
	CLASSES: {
		[key: string]: HTMLElement|SVGElement;
	}
} = {
	IDS: {};
	CLASSES: {}
}, E extends EventListenerObj = {}> extends ConfigurableWebComponent<ELS, E> {
	props = Props.define(this, {
		reflect: {
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
	protected async assertConnection() {
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
			this._connection = null;
			return false;
		}
	}

	protected async assertOnline() {
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

	protected async request(url: string, postBody: {
		[key: string]: any;
	} = {}, errName: string = 'Failed request') {
		await this.assertOnline();
		if (!await this.assertConnection()) return false;

		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({...{
					id: this._connection!.id,
					auth: this._connection!.clientSecret
				}, ...postBody})
			});
			if (!response.ok) {
				MessageToast.create({
					message: `${errName} ${response.status}`,
					duration: 5000
				});
				this._connection = null;
				return false;
			}
			return response;
		} catch(e) {
			MessageToast.create({
				message: `${errName} (network error)`,
				duration: 5000
			});
			this._connection = null;
			return false;
		}
	}
}