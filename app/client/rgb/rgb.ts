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
import { RGBController } from './components/rgb-controller/rgb-controller.js';
import { WebComponent } from '../../../node_modules/wc-lib/build/es/wc-lib.js';

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

	RGBController.define();
}

async function registerServiceworker() {
	if ('serviceWorker' in navigator) {
		await navigator.serviceWorker.register('/rgb/serviceworker.js', {
			scope: '/rgb/',
			updateViaCache: 'none',
		});
	}
}

registerElements();
void registerServiceworker();
