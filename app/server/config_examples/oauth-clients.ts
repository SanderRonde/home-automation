import type { Client } from 'oauth2-server';

export default [
	{
		id: 'Google',
		clientSecret: 'some-secret',
		grants: [],
		accessTokenLifetime: 1000 * 60 * 60,
		refreshTokenLifetime: 1000 * 60 * 60 * 24 * 30,
	},
] as (Client & {
	clientSecret: string;
})[];
