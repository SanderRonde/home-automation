import { 
	TemplateResult, PropertyCommitter, EventPart, 
	BooleanAttributePart, AttributeCommitter, 
	NodePart, isDirective, noChange 
} from "lit-html";
import { JSONSwitches } from './components/json-switches.js';
import { WebComponent } from 'wclib';

WebComponent.initComplexTemplateProvider({
	TemplateResult, PropertyCommitter, EventPart, BooleanAttributePart,
	AttributeCommitter, NodePart, isDirective, noChange
});

JSONSwitches.define();