import {
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
import {
	GOOGLE_SMART_HOME_DEVICE_TRAITS,
	SmartHomeDeviceUpdate,
	SMART_HOME_DEVICE_TRAIT,
} from '../../../lib/smart-home/smart-home-types';
import {
	sharedDisconnect,
	sharedExecute,
	sharedQuery,
	sharedSync,
	sharedUseradd,
} from './shared';
import { SMART_HOME_COMMAND } from '../../../lib/smart-home/smart-home-types';
import { BuiltinFrameworkMetadata } from 'actions-on-google/dist/framework';
import { flatMap, flatten, fromEntries } from '../../../lib/util';
import { GOOGLE_KEY, homeGraph } from '../home-graph';
import { currentUsers } from '../home-graph/users';
import { flattenObject } from '../../../lib/util';
import { warning } from '../../../lib/logger';
import { getAuth } from '../../oauth/helpers';
import { smartHomeLogger } from '../shared';
import { time } from '../../../lib/timer';
import { homegraph_v1 } from 'googleapis';

export async function googleSync(
	body: SmartHomeV1SyncRequest,
	_headers: Headers,
	framework: BuiltinFrameworkMetadata
): Promise<SmartHomeV1SyncResponse> {
	time(framework.express!.response, 'sync');
	const auth = getAuth(
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		framework.express!.response as any
	);
	time(framework.express!.response, 'get-auth');
	await sharedUseradd(
		auth.token.user,
		GOOGLE_KEY,
		framework.express!.response
	);
	const response = {
		requestId: body.requestId,
		payload: {
			agentUserId: auth.token.user,
			debugString: `Sync for username: "${auth.token.user}"`,
			devices: sharedSync(framework.express!.response).map((device) => {
				return {
					id: device.id,
					name: {
						defaultNames: [device.name],
						name: device.name,
						nicknames: device.nicknames,
					},
					traits: device.traits
						.map((t) => GOOGLE_SMART_HOME_DEVICE_TRAITS[t])
						.filter((t): t is string => !!t),
					type: device.googleType,
					willReportState: device.willReportState,
					attributes: device.attributes,
				};
			}),
		},
	};
	time(framework.express!.response, 'gather-google-sync-response');
	return response;
}

function objJoin(value: Record<string, unknown>[]): Record<string, unknown> {
	let joined: Record<string, unknown> = {};
	for (const obj of value) {
		joined = {
			...joined,
			...obj,
		};
	}
	return joined;
}

export async function googleQuery(
	body: SmartHomeV1QueryRequest,
	_headers: Headers,
	framework: BuiltinFrameworkMetadata
): Promise<SmartHomeV1QueryResponse> {
	time(framework.express!.response, 'query');
	const response = {
		requestId: body.requestId,
		payload: {
			devices: fromEntries(
				(
					await sharedQuery(
						flatMap(
							body.inputs.filter(
								(input) =>
									input.intent === 'action.devices.QUERY'
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
					// Google doesn't care about the capability/trait
					// so we just flatten until we have just one prop left
					let returnValue = {};
					for (const newValue of device.value) {
						if (!GOOGLE_SMART_HOME_DEVICE_TRAITS[newValue.trait]) {
							// Samsung-only
							continue;
						}

						for (const googleTrait of newValue.google) {
							returnValue = {
								...returnValue,
								...googleTrait.value,
							};
						}
					}

					return [
						device.id,
						{
							...returnValue,
							online: true,
							status: 'SUCCESS',
						},
					];
				})
			),
		},
	};
	time(framework.express!.response, 'gather-google-query-response');
	return response;
}

export async function googleExecute(
	body: SmartHomeV1ExecuteRequest,
	_headers: Headers,
	framework: BuiltinFrameworkMetadata
): Promise<SmartHomeV1ExecuteResponse> {
	time(framework.express!.response, 'google-execute-start');
	const response = {
		requestId: body.requestId,
		payload: {
			commands: flatten(
				await Promise.all(
					flatMap(
						body.inputs.filter(
							(input) => input.intent === 'action.devices.EXECUTE'
						),
						(input) => {
							return flatMap(
								input.payload.commands,
								(command) => {
									const deviceIDs = command.devices.map(
										(device) => device.id
									);
									return flatMap(
										command.execution,
										async (execution) => {
											const result = await sharedExecute(
												deviceIDs,
												execution.command as SMART_HOME_COMMAND,
												execution.params || {},
												framework.express!.response
											);
											return result.map(
												(commandResult) => ({
													...commandResult,
													state: !commandResult.state
														? commandResult.state
														: objJoin(
																flatten(
																	commandResult.state
																		.filter(
																			(
																				d
																			) =>
																				GOOGLE_SMART_HOME_DEVICE_TRAITS[
																					d
																						.trait
																				]
																		)
																		.map(
																			(
																				d
																			) => ({
																				[GOOGLE_SMART_HOME_DEVICE_TRAITS[
																					d
																						.trait
																				]!]:
																					d.google.map(
																						(
																							g
																						) =>
																							g.value
																					),
																			})
																		)
																)
														  ),
												})
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
	time(framework.express!.response, 'google-response-ready');
	return response;
}

export async function googleDisconnect(
	_body: SmartHomeV1DisconnectRequest,
	_headers: Headers,
	framework: BuiltinFrameworkMetadata
): Promise<SmartHomeV1DisconnectResponse> {
	const auth = getAuth(
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		framework.express!.response as any
	);
	await sharedDisconnect(auth.token.user, GOOGLE_KEY);
	return {};
}

export async function dispatchGoogleUsers(
	data: SmartHomeDeviceUpdate<SMART_HOME_DEVICE_TRAIT>[]
): Promise<void> {
	const googleUsers = (await currentUsers.value)[GOOGLE_KEY] ?? {};
	const requestBody: Omit<
		homegraph_v1.Schema$ReportStateAndNotificationRequest,
		'agentUserId'
	> = {
		payload: {
			devices: {
				states: fromEntries(
					data.map((dataPart) => [
						dataPart.id,
						flattenObject(
							flatten(
								dataPart.data.map((subData) => {
									return subData.google.map((subSubData) => {
										return subSubData.value;
									});
								})
							)
						),
					])
				),
			},
		},
	};
	const homeGraphInstance = await homeGraph.value;

	await Promise.all(
		Object.keys(googleUsers).map(async (user) => {
			const userRequestBody: homegraph_v1.Schema$ReportStateAndNotificationRequest =
				{
					...requestBody,
					agentUserId: user,
				};
			smartHomeLogger(
				'Sending homegraph update for user',
				user,
				Object.keys(userRequestBody.payload!.devices!.states!),
				JSON.stringify(userRequestBody.payload!.devices!.states!)
			);
			try {
				await homeGraphInstance.devices.reportStateAndNotification({
					requestBody: userRequestBody,
				});
			} catch (e) {
				warning(
					'Error response from home-graph',
					JSON.stringify(e),
					'for request',
					JSON.stringify(userRequestBody)
				);
			}
		})
	);
}
