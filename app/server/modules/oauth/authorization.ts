import {
	AuthorizationCode,
	AuthorizationCodeModel,
	Client,
	RefreshToken,
	Token,
	User,
} from 'oauth2-server';
import { Database } from '../../lib/db';
import oAuthClients from '../../config/oauth-clients';
import { logTag } from '../../lib/logger';
import { SettablePromise } from '../../lib/util';
import OAuthServer from 'express-oauth-server';

type DBToken = {
	accessToken: string;
	accessTokenExpiresAt?: number;
	refreshToken?: string;
	refreshTokenExpiresAt?: number;
	scope?: string | string[];
	client: Client;
	user: User;
};

type DBAuthorizationCode = Pick<
	AuthorizationCode,
	'authorizationCode' | 'expiresAt' | 'redirectUri'
> & {
	client: Client;
	user: User;
};

class OAuthModel implements AuthorizationCodeModel {
	constructor(public db: Database) {}

	getClient(
		clientID: string,
		clientSecret: string | null
	): Promise<typeof oAuthClients[number] | undefined> {
		logTag('oauth', 'cyan', `Finding client "${clientID}"`);
		return Promise.resolve(
			oAuthClients.find((client) => {
				if (client.id !== clientID) {
					return false;
				}
				return (
					clientSecret === null ||
					client.clientSecret === clientSecret
				);
			})
		);
	}

	saveToken(token: Token | RefreshToken, client: Client, user: User) {
		const dbToken: DBToken = {
			accessToken: token.accessToken,
			accessTokenExpiresAt: (
				token.accessTokenExpiresAt as Date
			)?.getTime(),
			refreshToken: token.refreshToken,
			refreshTokenExpiresAt: token.refreshTokenExpiresAt?.getTime(),
			client,
			user,
		};
		this.db.pushVal('tokens', dbToken);

		logTag(
			'oauth',
			'cyan',
			`Saving token for client "${client.id}" and user`,
			user
		);

		return Promise.resolve({
			...dbToken,
			accessTokenExpiresAt: token.accessTokenExpiresAt,
			refreshTokenExpiresAt: token.refreshTokenExpiresAt,
		});
	}

	async getAccessToken(accessToken: string) {
		logTag(
			'oauth',
			'cyan',
			`Getting token for access token "${accessToken}"`
		);
		const tokens = this.db.get<DBToken[]>('tokens', []);
		const match = tokens.find((token) => token.accessToken === accessToken);
		if (!match) {
			return undefined;
		}

		return Promise.resolve({
			...match,
			accessTokenExpiresAt: match.accessTokenExpiresAt
				? new Date(match.accessTokenExpiresAt)
				: undefined,
			refreshTokenExpiresAt: match.refreshTokenExpiresAt
				? new Date(match.refreshTokenExpiresAt)
				: undefined,
		});
	}

	revokeToken(toRevokeToken: Token | RefreshToken) {
		logTag(
			'oauth',
			'cyan',
			`Revoking token for client "${toRevokeToken.client.id}" and user`,
			toRevokeToken.user
		);
		this.db.deleteArrayVal<DBToken>(
			'tokens',
			(token) => token.accessToken === toRevokeToken.accessToken
		);
		return true;
	}

	async saveAuthorizationCode(
		code: Pick<
			AuthorizationCode,
			'authorizationCode' | 'expiresAt' | 'redirectUri' | 'scope'
		>,
		client: Client,
		user: User
	) {
		const dbAuthorizationCode: DBAuthorizationCode = {
			authorizationCode: code.authorizationCode,
			expiresAt: code.expiresAt,
			redirectUri: code.redirectUri,
			client,
			user,
		};
		logTag(
			'oauth',
			'cyan',
			`Saving authorization code for client "${client.id}" and user`,
			user
		);
		this.db.pushVal('authorizationCodes', dbAuthorizationCode);
		return Promise.resolve(dbAuthorizationCode);
	}

	async getAuthorizationCode(code: string) {
		const authorizationCodes = this.db.get<DBAuthorizationCode[]>(
			'authorizationCodes',
			[]
		);
		logTag('oauth', 'cyan', `Getting authorization code "${code}"`);
		return Promise.resolve(
			authorizationCodes.find(
				(authCode) => authCode.authorizationCode === code
			)
		);
	}

	async revokeAuthorizationCode(toRevoke: AuthorizationCode) {
		logTag(
			'oauth',
			'cyan',
			`Revoking authorization code for client "${toRevoke.client.id}" and user`,
			toRevoke.user
		);
		this.db.deleteArrayVal<DBAuthorizationCode>(
			'authorizationCodes',
			(authCode) =>
				authCode.authorizationCode === toRevoke.authorizationCode
		);
		return Promise.resolve(true);
	}

	verifyScope(token: Token, scope: string | string[]) {
		logTag(
			'oauth',
			'cyan',
			`Verifying scope for client "${token.client.id}" and user`,
			token.user
		);
		const requestedScopes = Array.isArray(scope) ? scope : [scope];
		const givenScopes = token.scope
			? Array.isArray(token.scope)
				? token.scope
				: [token.scope]
			: [];
		for (const requestedScope of requestedScopes) {
			if (!givenScopes.includes(requestedScope)) {
				return Promise.resolve(false);
			}
		}
		return Promise.resolve(true);
	}
}

const db = new SettablePromise<Database>();
export const authorizationServer = new SettablePromise<OAuthServer>();

export function initAuthorization(_db: Database): void {
	db.set(_db);
	authorizationServer.set(
		new OAuthServer({
			model: new OAuthModel(_db),
		})
	);
}
