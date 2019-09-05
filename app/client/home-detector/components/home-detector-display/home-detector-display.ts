import { Props, ComplexType, config } from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { HomeDetectorDisplayHTML } from './home-detector-display.html.js';
import { HomeDetectorDisplayCSS } from './home-detector-display.css.js';
import { ServerComm } from '../../../shared/server-comm/server-comm.js';

@config({
	is: 'home-detector-display',
	html: HomeDetectorDisplayHTML,
	css: HomeDetectorDisplayCSS
})
export class HomeDetectorDisplay extends ServerComm {
	props = Props.define(this, {
		reflect: {
			json: {
				value: {},
				type: ComplexType<{[key: string]: 'home'|'away';}>()
			}
		}
	}, super.props);

	private async _refreshJSON() {
		const res = await this.request(`${location.origin}/home-detector/all`, {},
			'Failed to refresh');
		if (res === false) return false;
		const json = await res.json();

		const isDifferent = (() => {
			for (const key in this.props.json) {
				if (json[key] !== this.props.json[key]) {
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

	firstRender() {
		window.setInterval(() => {
			this._refreshJSON();
		}, 1000 * 15);
		this.props.key = this.props.key || localStorage.getItem('key')!;
		localStorage.setItem('key', this.props.key!);
		if (!this.props.json || Object.keys(this.props.json).length === 0) {
			this._refreshJSON();
		}
	}
}