import { TemplateFn, CHANGE_TYPE } from 'wc-lib/build/es/wc-lib';
import {
	AdvancedTemperatureDisplay,
	TEMPERATURE_DISPLAY_PERIOD,
} from './advanced-temperature-display.js';
import { render } from 'lit-html';

export const AdvancedTemperatureDisplayHTML =
	new TemplateFn<AdvancedTemperatureDisplay>(
		(html, { props }) => {
			console.log(`transform: rotate(${props.windDegrees}deg);`);
			return html`
				<div id="centerer">
					<div id="temp-row">
						<div id="container">
							<img
								id="icon"
								src="/info-screen/images/weather/${props.icon}"
							/>
							<div id="temp">
								${props.temperature}
							</div>
						</div>
					</div>
						<div id="wind-row">
							<span class="bold">${
								props.period ===
								TEMPERATURE_DISPLAY_PERIOD.CURRENT
									? 'NU'
									: 'DAG'
							}</span>
							<img
								id="wind-icon"
								style="transform: rotate(${String(props.windDegrees)}deg);"
								src="/info-screen/images/weather/arrow.png"
							/>
							<div id="wind">
								${props.windSpeed} km/h
							</div>
					</div>
					</div>
					<div id="high-low-rain-row">
						${
							props.tempMax &&
							props.tempMin &&
							html`<span id="high"
									><span
										><span class="bold">H</span>
										${props.tempMax}</span
									></span
								><span id="low"
									><span
										><span class="bold">L</span>
										${props.tempMin}</span
									></span
								>`
						}
							<img
									id="rain-icon"
									src="/info-screen/images/weather/umbrella.png"
								/>
							<div id="chance-of-rain">
							${`${props.chanceOfRain}%`}
						</div>
						</div>
				</div>
			`;
		},
		CHANGE_TYPE.PROP,
		render
	);
