import type { Client } from 'oauth2-server';

declare const clients: (Client & {
	clientSecret: string;
})[];

export default clients;
