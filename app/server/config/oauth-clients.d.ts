import type { Client } from 'oauth2-server';

type OAuthClients = (Client & {
	clientSecret: string;
})[]

export default OAuthClients;
