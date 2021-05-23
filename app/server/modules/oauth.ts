import * as OAuthServer from 'express-oauth-server';
import {
	attachMessage,
	attachSourcedMessage,
	logTag,
	ResponseLike,
} from '../lib/logger';
import oAuthUsers from '../config/oauth-users';
import oAuthClients from '../config/oauth-clients';
import { SettablePromise } from '../lib/util';
import { ModuleConfig } from './modules';
import { ModuleMeta } from './meta';
import { Database } from '../lib/db';
import * as path from 'path';
import { CLIENT_FOLDER } from '../lib/constants';
import * as express from 'express';
import type {
	AuthorizationCodeModel,
	Token,
	Client,
	User,
	RefreshToken,
	AuthorizationCode,
} from 'oauth2-server';
import * as fs from 'fs-extra';
import { createRouter } from '../lib/api';

export type OAuthUser = {
	username: string;
	password: string;
};

export type OAuthClient = {
	clientID: string;
	clientSecret: string;
};

export namespace OAuth {
	export const meta = new (class Meta extends ModuleMeta {
		name = 'oauth';

		async init(config: ModuleConfig) {
			Authorization.init(config.db);
			await Routing.init(config);
		}
	})();

	export namespace Authorization {
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
					refreshTokenExpiresAt:
						token.refreshTokenExpiresAt?.getTime(),
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
				const match = tokens.find(
					(token) => token.accessToken === accessToken
				);
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
						authCode.authorizationCode ===
						toRevoke.authorizationCode
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
		export const server = new SettablePromise<OAuthServer>();

		export function init(_db: Database): void {
			db.set(_db);
			server.set(
				new OAuthServer({
					model: new OAuthModel(_db),
				})
			);
		}
	}

	namespace OAuthUsers {
		export function validate(
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
	}

	namespace Routing {
		const oauthHTMLFile = new SettablePromise<string>();

		async function sendToLoginPage(
			req: express.Request,
			res: ResponseLike,
			invalidReason?: string
		) {
			if (!oauthHTMLFile.isSet) {
				oauthHTMLFile.set(
					await fs.readFile(
						path.join(CLIENT_FOLDER, 'oauth/oauth.html'),
						'utf8'
					)
				);
			}

			// Send back to a login page
			const previousParams = {
				...req.body,
				...req.params,
				...req.query,
			} as Record<string, string>;
			const params = [
				'client_id',
				'redirect_uri',
				'response_type',
				'scope',
				'response_mode',
				'state',
				'nonce',
			].map((p) => `${p}=${previousParams[p]}`);
			if (invalidReason) {
				params.push(`errorReason=${invalidReason}`);
			}

			res.status(200);
			res.redirect(`/oauth/login?${params.join('&')}`);
		}

		export async function init({ app }: ModuleConfig): Promise<void> {
			const router = createRouter(OAuth, {});
			router.all(
				'/authorize',
				async (req, res, next) => {
					attachSourcedMessage(
						res,
						'OAUTH.API',
						await meta.explainHook,
						'Authorizing OAuth'
					);

					const { username = '', password = '' } = {
						...req.body,
						...req.params,
					} as {
						username?: string;
						password?: string;
					};
					const { valid, invalidReason } = OAuthUsers.validate(
						username,
						password
					);
					if (!valid) {
						await sendToLoginPage(req, res, invalidReason);
						return;
					}

					attachMessage(
						attachMessage(res, 'Login success'),
						`Username: ${username}`
					);
					return (await Authorization.server.value).authorize({
						authenticateHandler: {
							handle: () => username,
						},
					})(req, res as express.Response, next);
				},
				(await Authorization.server.value).authorize()
			);
			router.get('/login', async (_req, res) => {
				attachSourcedMessage(
					res,
					'OAUTH.API',
					await meta.explainHook,
					'Logging in to auth'
				);

				res.status(200);
				res.write(await oauthHTMLFile.value);
				res.end();
			});
			router.post(
				'/token',
				async (_req, res, next) => {
					attachSourcedMessage(
						res,
						'OAUTH.API',
						await meta.explainHook,
						'Refreshing token for OAuth'
					);
					return next();
				},
				(await Authorization.server.value).token({})
			);
			router.use(app);
		}
	}
}
