import oAuthUsers from '@server/config/oauth-users';

export function validateOAUthUsers(
	username: string,
	password: string
): {
	valid: boolean;
	invalidReason?: string;
} {
	if (!username || !password) {
		return {
			valid: false,
		};
	}

	const user = oAuthUsers.find((user) => user.username === username);
	if (!user) {
		return {
			valid: false,
			invalidReason: 'Unknown username',
		};
	}

	if (user.password !== password) {
		return {
			valid: false,
			invalidReason: 'Invalid password',
		};
	}

	return {
		valid: true,
	};
}
