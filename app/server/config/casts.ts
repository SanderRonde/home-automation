export const PASTAS: {
	[key: string]: {
		lang: string;
		text: string;
	};
} = {
	'***REMOVED***': {
		lang: 'nl',
		text: `***REMOVED***`
	},
	'***REMOVED***': {
		lang: 'nl',
		text: `***REMOVED***`
	},
	'***REMOVED***': {
		lang: 'nl',
		text: `***REMOVED***`
	},
	'***REMOVED***': {
		lang: 'nl',
		text: `in dit huis

		hebben we plezier
		
		maken we fouten
		
		zeggen we sorry
		
		beginnen we opnieuw
		
		worden we boos
		
		vergeven we
		
		geven we knuffels
		
		horen we bij elkaar
		
		hebben we lief`
	},
	'***REMOVED***': {
		lang: 'en',
		text: `***REMOVED***`
	},
	'h': {
		lang: 'nl',
		text: `hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh`
	},
	'penguin': {
		lang: 'en',
		text: `hi every1 im new!!!!!!! *holds up spork* my name is katy but u can call me t3h PeNgU1N oF d00m!!!!!!!! lol…as u can see im very random!!!! thats why i came here, 2 meet random ppl like me ^_^… im 13 years old (im mature 4 my age tho!!) i like 2 watch invader zim w/ my girlfreind (im bi if u dont like it deal w/it) its our favorite tv show!!! bcuz its SOOOO random!!!! shes random 2 of course but i want 2 meet more random ppl =) like they say the more the merrier!!!! lol…neways i hope 2 make alot of freinds here so give me lots of commentses!!!!
		DOOOOOMMMM!!!!!!!!!!!!!!!! <--- me bein random again ^_^ hehe…toodles!!!!!
		
		love and waffles,
		
		t3h PeNgU1N oF d00m`
	},
	'***REMOVED***': {
		lang: 'en',
		text: `***REMOVED***
		`
	}
};

export const LOCAL_URLS: {
	[key: string]: string;
} = ((obj: {
	[key: string]: string;
}) => {
	const newObj: {
		[key: string]: string;
	} = {};
	for (const key in obj) {
		newObj[key] = `http://***REMOVED***/${obj[key]}`;
	}
	return newObj;
})({
	'***REMOVED***': '***REMOVED***.mp3',
	'***REMOVED***': '***REMOVED***.mp3',
	'***REMOVED***': '***REMOVED***.mp3'
});