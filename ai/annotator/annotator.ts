import {
	TemplateResult,
	PropertyCommitter,
	EventPart,
	BooleanAttributePart,
	AttributeCommitter,
	NodePart,
	isDirective,
	noChange
} from '../../node_modules/lit-html/lit-html.js';
import { WebComponent } from '../../node_modules/wc-lib/build/es/wc-lib.js';
import { AnnotatorMain } from './components/annotator-main/annotator-main.js';

WebComponent.initComplexTemplateProvider({
	TemplateResult,
	PropertyCommitter,
	EventPart,
	BooleanAttributePart,
	AttributeCommitter,
	NodePart,
	isDirective,
	noChange
});

AnnotatorMain.define();
