import {
	CHANGE_TYPE,
	TemplateFn,
} from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { render } from '../../../../../node_modules/lit-html/lit-html.js';
import type { HomeDetectorDisplay } from './home-detector-display.js';

export const HomeDetectorDisplayHTML = new TemplateFn<HomeDetectorDisplay>(
	(html, { props }) => {
		return html`
			<div id="background">
				<div id="horizontal-center">
					<div id="vertical-center">
						<div id="content">
							${Object.keys(props.json || {}).map((key) => {
								return html`
									<div class="row">
										<div class="name">${key}</div>
										<div class="status">
											${props.json[key]}
										</div>
									</div>
								`;
							})}
						</div>
					</div>
				</div>
			</div>
		`;
	},
	CHANGE_TYPE.PROP,
	render
);
