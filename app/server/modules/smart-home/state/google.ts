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
	sharedDisconnect,
	sharedExecute,
	sharedQuery,
	sharedSync,
} from './shared';
import { SMART_HOME_COMMAND } from '../../../lib/smart-home/smart-home-types';
import { BuiltinFrameworkMetadata } from 'actions-on-google/dist/framework';
import { flatMap, flatten, fromEntries } from '../../../lib/util';
import { getAuth } from '../../oauth/helpers';
import { time } from '../../../lib/timer';

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
	const response = {
		requestId: body.requestId,
		payload: {
			agentUserId: auth.token.user,
			debugString: `Sync for username: "${auth.token.user}"`,
			devices: (
				await sharedSync(auth.token.user, framework.express!.response)
			).map((device) => {
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
	time(framework.express!.response, 'gather-google-sync-response');
	return response;
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
					return [device.id, device.value];
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
	await sharedDisconnect(auth.token.user);
	return {};
}
