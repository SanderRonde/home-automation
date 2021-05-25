import { GroupConfig, KEYVAL_GROUP_EFFECT } from '../modules/keyval/types';

// When the inital key is triggered, the others are updated
// to that value (or the inverted value) as well

// without triggering any listeners
export default {
	'some.key.val': {
		'other.key.val': KEYVAL_GROUP_EFFECT.SAME,
		'another.key.val': KEYVAL_GROUP_EFFECT.INVERT,
	},
} as GroupConfig;
