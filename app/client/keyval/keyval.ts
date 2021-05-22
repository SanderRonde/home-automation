import {
	TemplateResult,
	PropertyCommitter,
	EventPart,
	BooleanAttributePart,
	AttributeCommitter,
	NodePart,
	isDirective,
	noChange,
} from '../../../node_modules/lit-html/lit-html.js';
import { WebComponent } from '../../../node_modules/wc-lib/build/es/wc-lib.js';
import { JSONSwitches } from './components/json-switches/json-switches.js';

function registerElements() {
	WebComponent.initComplexTemplateProvider({
		TemplateResult,
		PropertyCommitter,
		EventPart,
		BooleanAttributePart,
		AttributeCommitter,
		NodePart,
		isDirective,
		noChange,
	});

	JSONSwitches.define();
}

function registerServiceworker() {
	if ('serviceWorker' in navigator) {
		navigator.serviceWorker.register('/keyval/serviceworker.js', {
			scope: '/keyval/',
			updateViaCache: 'none',
		});
	}
}

registerElements();

registerServiceworker();
