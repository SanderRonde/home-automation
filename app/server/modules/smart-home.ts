import smartHomeConfig from '../config/smart-home';
import {
	smarthome,
	SmartHomeV1SyncRequest,
	SmartHomeV1QueryRequest,
	SmartHomeV1SyncResponse,
	SmartHomeV1QueryResponse,
	Headers,
	SmartHomeV1DisconnectResponse,
	SmartHomeV1ExecuteRequest,
	SmartHomeV1ExecuteResponse,
	SmartHomeV1DisconnectRequest,
} from 'actions-on-google';
import { BuiltinFrameworkMetadata } from 'actions-on-google/dist/framework';
import {
	Batcher,
	createHookables,
	flatMap,
	flatten,
	fromEntries,
	SettablePromise,
} from '../lib/util';
import { createRouter } from '../lib/api';
import { ModuleConfig } from './modules';
import { ModuleMeta } from './meta';
import { attachMessage, logTag, warning } from '../lib/logger';
import * as express from 'express';
import {
	SmartHomeDeviceSync,
	SmartHomeDeviceUpdate,
	SMART_HOME_COMMAND,
	SMART_HOME_DEVICE_TRAIT,
} from '../lib/smart-home/smart-home-types';
import { Database } from '../lib/db';
import { homegraph, homegraph_v1 } from '@googleapis/homegraph';
import { google } from 'googleapis';
import * as fs from 'fs-extra';
import * as path from 'path';
import {
	SECRETS_FOLDER,
	SMART_HOME_BATCH_MAX_TIMEOUT,
	SMART_HOME_BATCH_MIN_TIMEOUT,
} from '../lib/constants';
import { getAuth } from './oauth/helpers';

export namespace SmartHome {
	export const meta = new (class Meta extends ModuleMeta {
		name = 'smart-home';

		async init(config: ModuleConfig) {
			await Routing.init(config);
			await HomeGraph.init(config.db);
		}

		async postInit() {
			await HomeGraph.requestSync();
		}
	})();

	const smartHomeLogger = (...args: unknown[]) =>
		logTag('smart-home', 'cyan', ...args);
	namespace HomeGraph {
		export const homeGraph = new SettablePromise<homegraph_v1.Homegraph>();
		export const db = new SettablePromise<Database>();

		export namespace HomegraphUsers {
			export const currentUsers = new SettablePromise<string[]>();

			export async function addUser(username: string): Promise<void> {
				(await db.value).pushVal('homegraph-users', username, 'ignore');
				if (!(await currentUsers.value).includes(username)) {
					(await currentUsers.value).push(username);
				}
				smartHomeLogger('Added user', username);
			}

			export async function removeUser(username: string): Promise<void> {
				(await db.value).deleteArrayVal(
					'homegraph-users',
					(item) => item === username
				);
				(await currentUsers.value).splice(
					(await currentUsers.value).indexOf(username),
					1
				);
				smartHomeLogger('Removed user', username);
			}

			export async function init(): Promise<void> {
				currentUsers.set((await db.value).get('homegraph-users', []));
				smartHomeLogger(
					`Found ${(await currentUsers.value).length} users`
				);
			}
		}

		export async function requestSync(): Promise<void> {
			const hg = await homeGraph.value;
			await Promise.all(
				(
					await HomegraphUsers.currentUsers.value
				).map(async (user) => {
					await hg.devices.requestSync({
						requestBody: {
							agentUserId: user,
							async: true,
						},
					});
				})
			);
		}

		async function createAuthClient() {
			const serviceAccountFile = path.join(
				SECRETS_FOLDER,
				'service-account.json'
			);
			const serviceAccountJSON = await (async () => {
				try {
					return await fs.readFile(serviceAccountFile, 'utf8');
				} catch (e) {
					throw new Error(
						`Missing service account file ("${serviceAccountFile}")`
					);
				}
			})();
			const auth = new google.auth.GoogleAuth({
				scopes: ['https://www.googleapis.com/auth/homegraph'],
				credentials: JSON.parse(serviceAccountJSON),
			});
			const authClient = await auth.getClient();
			google.options({ auth: authClient });

			const hg = homegraph({
				version: 'v1',
				auth: authClient,
			});

			homeGraph.set(hg);
		}

		async function attachUpdateListeners() {
			const batcher = new Batcher<
				SmartHomeDeviceUpdate<SMART_HOME_DEVICE_TRAIT>
			>({
				minWaitTime: SMART_HOME_BATCH_MIN_TIMEOUT,
				maxWaitTime: SMART_HOME_BATCH_MAX_TIMEOUT,
				async onDispatch(data) {
					const requestBody: Omit<
						homegraph_v1.Schema$ReportStateAndNotificationRequest,
						'agentUserId'
					> = {
						payload: {
							devices: {
								states: fromEntries(
									data.map((dataPart) => [
										dataPart.id,
										dataPart.data,
									])
								),
							},
						},
					};

					const homeGraphInstance = await homeGraph.value;
					await Promise.all(
						(
							await HomegraphUsers.currentUsers.value
						).map(async (user) => {
							const userRequestBody: homegraph_v1.Schema$ReportStateAndNotificationRequest =
								{
									...requestBody,
									agentUserId: user,
								};
							smartHomeLogger(
								'Sending homegraph update for user',
								user,
								Object.keys(
									userRequestBody.payload!.devices!.states!
								)
							);
							try {
								await homeGraphInstance.devices.reportStateAndNotification(
									{ requestBody: userRequestBody }
								);
							} catch (e) {
								warning(
									'Error response from home-graph',
									e,
									'for request',
									userRequestBody
								);
							}
						})
					);
				},
			});

			const hookables = createHookables(
				await meta.modules,
				'SMART_HOME',
				'HOME_GRAPH',
				{}
			);
			smartHomeConfig.forEach((Device) =>
				new Device().attachHomeGraphListeners(
					hookables,
					(update: unknown) => {
						batcher.call(
							update as SmartHomeDeviceUpdate<SMART_HOME_DEVICE_TRAIT>
						);
					}
				)
			);
		}

		export async function init(_db: Database): Promise<void> {
			db.set(_db);
			await HomegraphUsers.init();
			await createAuthClient();
			await attachUpdateListeners();
		}
	}

	namespace State {
		export namespace Shared {
			export async function sync(
				username: string
			): Promise<SmartHomeDeviceSync[]> {
				await HomeGraph.HomegraphUsers.addUser(username);
				return smartHomeConfig.map((Device) => new Device().sync());
			}

			export async function query(
				ids: string[],
				res: express.Response
			): Promise<
				{
					id: string;
					value: Record<string, unknown>;
				}[]
			> {
				const hookables = createHookables(
					await meta.modules,
					'SMART_HOME',
					'QUERY',
					attachMessage(res, 'Smart Home Query')
				);
				const result = await Promise.all(
					ids.map(async (id) => {
						return {
							id,
							value: await smartHomeConfig
								.map((Device) => new Device())
								.find((entry) => entry.id === id)!
								.query(hookables),
						};
					})
				);
				return result;
			}

			export async function execute(
				deviceIDs: string[],
				command: SMART_HOME_COMMAND,
				params: Record<string, unknown>,
				res: express.Response
			): Promise<
				{
					ids: string[];
					status: 'SUCCESS' | 'OFFLINE' | 'ERROR';
					errorCode?: string;
					state?: Record<string, unknown>;
				}[]
			> {
				const hookables = createHookables(
					await meta.modules,
					'SMART_HOME',
					'EXECUTE',
					attachMessage(res, 'Smart Home Execute')
				);
				return await Promise.all(
					deviceIDs.map(async (deviceID) => {
						const device = smartHomeConfig
							.map((Device) => new Device())
							.find((entry) => entry.id === deviceID);
						if (!device) {
							return {
								ids: [deviceID],
								status: 'ERROR' as const,
								errorCode: 'deviceNotFound',
							};
						}
						if (!(await device.isOnline(hookables))) {
							return {
								ids: [deviceID],
								status: 'OFFLINE' as const,
							};
						}

						const result = await device.execute(
							command,
							// eslint-disable-next-line @typescript-eslint/no-explicit-any
							params as any,
							hookables
						);
						if (!result.success) {
							return {
								ids: [deviceID],
								status: 'ERROR' as const,
								errorCode: 'actionNotAvailable',
							};
						}

						return {
							ids: [deviceID],
							state: {
								...(await device.query(hookables)),
								...result.mergeWithQuery,
							},
							status: 'SUCCESS' as const,
						};
					})
				);
			}

			export async function disconnect(username: string): Promise<void> {
				await HomeGraph.HomegraphUsers.removeUser(username);
			}
		}

		export namespace Google {
			export async function sync(
				body: SmartHomeV1SyncRequest,
				_headers: Headers,
				framework: BuiltinFrameworkMetadata
			): Promise<SmartHomeV1SyncResponse> {
				const auth = getAuth(
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					framework.express!.response as any
				);
				return {
					requestId: body.requestId,
					payload: {
						agentUserId: auth.token.user,
						debugString: `Sync for username: "${auth.token.user}"`,
						devices: (await Shared.sync(auth.token.user)).map(
							(device) => {
								return {
									id: device.id,
									name: {
										defaultNames: [device.name],
										name: device.name,
										nicknames: device.nicknames,
									},
									traits: device.traits,
									type: device.type,
									willReportState: device.willReportState,
									attributes: device.attributes,
								};
							}
						),
					},
				};
			}

			export async function query(
				body: SmartHomeV1QueryRequest,
				_headers: Headers,
				framework: BuiltinFrameworkMetadata
			): Promise<SmartHomeV1QueryResponse> {
				return {
					requestId: body.requestId,
					payload: {
						devices: fromEntries(
							(
								await Shared.query(
									flatMap(
										body.inputs.filter(
											(input) =>
												input.intent ===
												'action.devices.QUERY'
										),
										(input) => {
											return input.payload.devices.map(
												(device) => device.id
											);
										}
									),
									framework.express!.response
								)
							).map((device) => {
								return [device.id, device.value];
							})
						),
					},
				};
			}

			export async function execute(
				body: SmartHomeV1ExecuteRequest,
				_headers: Headers,
				framework: BuiltinFrameworkMetadata
			): Promise<SmartHomeV1ExecuteResponse> {
				return {
					requestId: body.requestId,
					payload: {
						commands: flatten(
							await Promise.all(
								flatMap(
									body.inputs.filter(
										(input) =>
											input.intent ===
											'action.devices.EXECUTE'
									),
									(input) => {
										return flatMap(
											input.payload.commands,
											(command) => {
												const deviceIDs =
													command.devices.map(
														(device) => device.id
													);
												return flatMap(
													command.execution,
													(execution) => {
														return Shared.execute(
															deviceIDs,
															execution.command as SMART_HOME_COMMAND,
															execution.params ||
																{},
															framework.express!
																.response
														);
													}
												);
											}
										);
									}
								)
							)
						),
					},
				};
			}

			export async function disconnect(
				_body: SmartHomeV1DisconnectRequest,
				_headers: Headers,
				framework: BuiltinFrameworkMetadata
			): Promise<SmartHomeV1DisconnectResponse> {
				const auth = getAuth(
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					framework.express!.response as any
				);
				await Shared.disconnect(auth.token.user);
				return {};
			}
		}
	}

	namespace Routing {
		export async function init({ app }: ModuleConfig): Promise<void> {
			const smartHomeApp = smarthome({});

			smartHomeApp.onSync(State.Google.sync);
			smartHomeApp.onQuery(State.Google.query);
			smartHomeApp.onExecute(State.Google.execute);
			smartHomeApp.onDisconnect(State.Google.disconnect);

			const router = createRouter(SmartHome, {});
			router.all(
				'/google',
				await new (
					await meta.modules
				).oauth.external(
					{},
					'SMART_HOME.ROUTING_INIT'
				).getAuthenticateMiddleware(),
				smartHomeApp
			);
			router.use(app, '/actions');
		}
	}
}
