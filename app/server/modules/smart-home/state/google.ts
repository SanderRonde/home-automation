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
import { BuiltinFrameworkMetadata } from 'actions-on-google/dist/framework';
import { SMART_HOME_COMMAND } from '../../../lib/smart-home/smart-home-types';
import { flatMap, flatten, fromEntries } from '../../../lib/util';
import { getAuth } from '../../oauth/helpers';
import {
	sharedDisconnect,
	sharedExecute,
	sharedQuery,
	sharedSync,
} from './shared';

export async function googleSync(
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
			devices: (await sharedSync(auth.token.user)).map((device) => {
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
			}),
		},
	};
}

export async function googleQuery(
	body: SmartHomeV1QueryRequest,
	_headers: Headers,
	framework: BuiltinFrameworkMetadata
): Promise<SmartHomeV1QueryResponse> {
	return {
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
					return [device.id, device.value];
				})
			),
		},
	};
}

export async function googleExecute(
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
										(execution) => {
											return sharedExecute(
												deviceIDs,
												execution.command as SMART_HOME_COMMAND,
												execution.params || {},
												framework.express!.response
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

export async function googleDisconnect(
	_body: SmartHomeV1DisconnectRequest,
	_headers: Headers,
	framework: BuiltinFrameworkMetadata
): Promise<SmartHomeV1DisconnectResponse> {
	const auth = getAuth(
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		framework.express!.response as any
	);
	await sharedDisconnect(auth.token.user);
	return {};
}
