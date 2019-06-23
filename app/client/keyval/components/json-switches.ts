import { config, TemplateFn, CHANGE_TYPE, ConfigurableWebComponent } from 'wclib';
import { render } from 'lit-html';

@config({
	is: 'json-switches',
	html: new TemplateFn<JSONSwitches>((html) => {
		return html`<div>hi</div>`;
	}, CHANGE_TYPE.PROP, render)
})
export class JSONSwitches extends ConfigurableWebComponent {
	
}