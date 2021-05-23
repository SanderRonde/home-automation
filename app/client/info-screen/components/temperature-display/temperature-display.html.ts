import {
	TemplateFn,
	CHANGE_TYPE,
} from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { TemperatureDisplay } from './temperature-display.js';
import { render } from '../../../../../node_modules/lit-html/lit-html.js';

export const TemperatureDisplayHTML = new TemplateFn<TemperatureDisplay>(
	(html, { props }) => {
		return html`
			<div id="centerer">
				<div id="container">
					<img
						id="icon"
						src="/info-screen/images/weather/${props.icon}"
					/>
					<div id="temp">
						${props.temperature}
						<div></div>
					</div>
				</div>
			</div>
		`;
	},
	CHANGE_TYPE.PROP,
	render
);
