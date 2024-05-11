/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import {
	SchemaConnector,
	DiscoveryResponse,
	StateRefreshResponse,
	DevicesReqBody,
	CommandResponse,
	DeviceCommand,
	DeviceState,
	StateUpdateRequest,
	UpdateRequestDeviceState,
} from 'st-schema';
import {
	SAMSUNG_SMART_HOME_DEVICE_CAPABILITIES,
	SmartHomeDeviceUpdate,
	SMART_HOME_COMMAND,
	SMART_HOME_DEVICE_TRAIT,
} from '@server/lib/smart-home/smart-home-types';
import {
	sharedDisconnect,
	sharedExecute,
	sharedQuery,
	sharedSync,
	sharedUseradd,
} from '@server/modules/smart-home/state/shared';
import { currentUsers } from '@server/modules/smart-home/home-graph/users';
import { warning } from '@server/lib/logger';
import { flatten } from '@server/lib/util';
import { SAMSUNG_KEY } from '@server/modules/smart-home/home-graph';
import { smartHomeLogger } from '@server/modules/smart-home/shared';
import { getEnv } from '@server/lib/io';
import * as express from 'express';

function samsungSync(response: DiscoveryResponse, res: express.Response) {
	const devices = sharedSync(res);
	for (const device of devices) {
		response
			.addDevice(device.id, device.name, device.samsungType)
			.manufacturerName('Sander Ronde')
			.modelName(device.name);
	}
	return response;
}

async function samsungQuery(
	response: StateRefreshResponse,
	body: DevicesReqBody,
	res: express.Response
) {
	const devices = await sharedQuery(
		body.devices.map((d) => d.externalDeviceId),
		res
	);
	for (const device of devices) {
		response.addDevice(
			device.id,
			flatten(
				device.value
					.filter(
						(v) => !!SAMSUNG_SMART_HOME_DEVICE_CAPABILITIES[v.trait]
					)
					.map((value) => {
						return value.samsung.map((singleValue) => {
							return {
								component: 'main',
								capability:
									SAMSUNG_SMART_HOME_DEVICE_CAPABILITIES[
										value.trait
									]!,
								...singleValue,
							};
						});
					})
			)
		);
	}
	return response;
}

async function samsungCommandHandler(
	response: CommandResponse,
	body: DeviceCommand[],
	res: express.Response
) {
	await Promise.all(
		body.map(async (device) => {
			const deviceResponse = response.addDevice(device.externalDeviceId);
			for (const cmd of device.commands) {
				const [result] = await sharedExecute(
					[device.externalDeviceId],
					cmd.command as SMART_HOME_COMMAND,
					cmd.arguments,
					res
				);
				if (result.status === 'SUCCESS') {
					for (const updatedState of result.updatedState || []) {
						for (const singleValue of updatedState.samsung) {
							deviceResponse.addState({
								component: cmd.component,
								capability: cmd.capability,
								attribute: singleValue.attribute,
								value: singleValue.value,
							});
						}
					}
				} else {
					deviceResponse.setError(
						result.errorCode ?? 'Failed to execute command'
					);
				}
			}
		})
	);
}

export function createSamsungSchemaHandler(): SchemaConnector | null {
	const clientID = getEnv('SECRET_SAMSUNG_CLIENT_ID', false);
	const clientSecret = getEnv('SECRET_SAMSUNG_CLIENT_SECRET', false);
	if (!clientID || !clientSecret) {
		return null;
	}

	return new SchemaConnector({
		clientId: clientID,
		clientSecret: clientSecret,
	})
		.enableEventLogging(2)
		.discoveryHandler((_accessToken, response, body) => {
			return samsungSync(response, body.res);
		})
		.stateRefreshHandler((_accessToken, response, body) => {
			return samsungQuery(response, body, body.res);
		})
		.commandHandler((_accessToken, response, devices, body) => {
			return samsungCommandHandler(response, devices, body.res);
		})
		.callbackAccessHandler(
			async (
				accessToken: string,
				callbackAuthentication: {
					clientId: string;
					clientSecret: string;
				},
				callbackUrls: string[],
				body
			) => {
				await sharedUseradd(
					accessToken,
					SAMSUNG_KEY,
					body as unknown as express.Response,
					{
						callbackAuthentication,
						callbackUrls,
					}
				);
			}
		)
		.integrationDeletedHandler(async (accessToken: string) => {
			await sharedDisconnect(accessToken, SAMSUNG_KEY);
		});
}

export async function dispatchSamsungUsers(
	data: SmartHomeDeviceUpdate<SMART_HOME_DEVICE_TRAIT>[]
): Promise<void> {
	const clientID = getEnv('SECRET_SAMSUNG_CLIENT_ID', false);
	const clientSecret = getEnv('SECRET_SAMSUNG_CLIENT_SECRET', false);
	if (!clientID || !clientSecret) {
		return;
	}

	const samsungUsers = (await currentUsers.value)[SAMSUNG_KEY] ?? {};
	const updateRequest = new StateUpdateRequest(clientID, clientSecret);

	const states: UpdateRequestDeviceState[] = data.map((dataPart) => {
		return {
			externalDeviceId: dataPart.id,
			states: flatten(
				dataPart.data
					.map((state): DeviceState[] | null => {
						if (
							!SAMSUNG_SMART_HOME_DEVICE_CAPABILITIES[state.trait]
						) {
							return null;
						}

						return state.samsung.map((subPart) => ({
							component: 'main',
							capability:
								SAMSUNG_SMART_HOME_DEVICE_CAPABILITIES[
									state.trait
								]!,
							attribute: subPart.attribute,
							value: subPart.value,
						}));
					})
					.filter((s): s is DeviceState[] => s !== null)
			),
		};
	});
	await Promise.all(
		Object.entries(samsungUsers).map(
			async ([user, userData]: [
				string,
				{
					callbackAuthentication: {
						clientId: string;
						clientSecret: string;
					};
					callbackUrls: string[];
				},
			]) => {
				smartHomeLogger(
					'Sending smart things update for user',
					user,
					Object.keys(states),
					JSON.stringify(states)
				);
				try {
					await updateRequest.updateState(
						userData.callbackUrls,
						userData.callbackAuthentication,
						states
					);
				} catch (e) {
					warning(
						'Error response from home-graph',
						JSON.stringify(e),
						'for request',
						JSON.stringify(states)
					);
				}
			}
		)
	);
}
