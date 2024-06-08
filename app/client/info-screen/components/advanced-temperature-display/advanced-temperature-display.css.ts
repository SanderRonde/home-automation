import type { AdvancedTemperatureDisplay } from './advanced-temperature-display.js';
import { TemplateFn, CHANGE_TYPE } from 'wc-lib/build/es/wc-lib';
import { render } from 'lit-html';

export const AdvancedTemperatureDisplayCSS =
	new TemplateFn<AdvancedTemperatureDisplay>(
		(html, { props }) => {
			return html`
				<style>
					#centerer,
					#wind,
					#chance-of-rain,
					#temp,
					#high,
					#low {
						display: flex;
						flex-direction: column;
						justify-content: center;
					}

					#container {
						display: flex;
						flex-direction: row;
						justify-content: flex-start;
					}

					#wind-row,
					#high-low-rain-row,
					#wind-row {
						display: flex;
						flex-direction: row;
						justify-content: center;
					}

					#wind-row {
						margin-top: -20px;
					}

					#icon {
						width: auto;
						height: 9vh;
					}

					#temp {
						text-align: center;
						font-size: 200%;
						font-weight: bold;
					}

					#rain-icon {
						height: 2.5vh;
						margin-left: 20px;
					}

					#wind-icon {
						width: 1vh;
						height: 1vh;
						transform: rotate(${props.windDegrees}deg);
						margin-left: 20px;
					}

					#wind {
						margin-left: 10px;
					}

					#low {
						margin-left: 10px;
					}

					.bold {
						font-weight: bold;
					}
				</style>
			`;
		},
		CHANGE_TYPE.PROP,
		render
	);
