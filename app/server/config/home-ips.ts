export default {
	"base": {
		"self": ["192.168.1.14"],
		"***REMOVED***": ["***REMOVED***"],
		"***REMOVED***": ["192.168.1.5", "***REMOVED***"]
	},
	"extended": {
		"***REMOVED***": ["***REMOVED***"],
		"***REMOVED***": ["***REMOVED***"]
	}
} as {
	base: {
		[key: string]: string[];
	}
	extended: {
		[key: string]: string[];
	}
}