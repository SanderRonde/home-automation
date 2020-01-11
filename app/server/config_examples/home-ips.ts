export default {
	base: {
		self: ['1.2.3.4'],
		pc: ['5.6.7.8'],
		phone: ['9.10.11.12', '13.14.15.16']
	}
} as {
	base: {
		[key: string]: string[];
	};
};
