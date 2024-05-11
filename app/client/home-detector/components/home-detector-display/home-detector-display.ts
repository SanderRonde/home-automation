import {
	Props,
	ComplexType,
	config,
} from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { HomeDetectorDisplayHTML } from './home-detector-display.html.js';
import { ServerComm } from '../../../shared/server-comm/server-comm.js';
import { HomeDetectorDisplayCSS } from './home-detector-display.css.js';

@config({
	is: 'home-detector-display',
	html: HomeDetectorDisplayHTML,
	css: HomeDetectorDisplayCSS,
})
export class HomeDetectorDisplay extends ServerComm {
	public props = Props.define(
		this,
		{
			reflect: {
				json: {
					value: {},
					type: ComplexType<{ [key: string]: 'home' | 'away' }>(),
				},
			},
		},
		super.props
	);

	private async _refreshJSON() {
		const url = location.href.includes('/e')
			? `${location.origin}/home-detector/all/e`
			: `${location.origin}/home-detector/all`;
		const res = await this.request(url, {}, 'Failed to refresh');
		if (res === false) {
			return false;
		}
		const json = await res.json();

		const isDifferent = (() => {
			for (const key in this.props.json) {
				if (
					(json as Record<string, unknown>)[key] !==
					this.props.json[key]
				) {
					return true;
				}
			}
			for (const key in json) {
				if (
					(json as Record<string, unknown>)[key] !==
					this.props.json[key]
				) {
					return true;
				}
			}
			return false;
		})();

		if (isDifferent) {
			this.props.json = json;
		}
		return true;
	}

	public async firstRender(): Promise<void> {
		window.setInterval(() => {
			void this._refreshJSON();
		}, 1000 * 15);
		this.props.key = this.props.key || localStorage.getItem('key')!;
		localStorage.setItem('key', this.props.key);
		if (!this.props.json || Object.keys(this.props.json).length === 0) {
			await this._refreshJSON();
		}
	}
}
