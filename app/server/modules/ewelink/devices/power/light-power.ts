import { EwelinkPower, EwelinkPowerParams } from './power';

type EwelinkLightPowerPowerParams = EwelinkPowerParams & {
	ltype?: string;
} & {
	[ltype: string]: {
		br: number;
		ct: number;
	};
};

export class EwelinkLightPower extends EwelinkPower<EwelinkLightPowerPowerParams> {
	/**
	 * 0 to 100
	 */
	// Unused for now
	public brightness: number = 0;
	/**
	 * 0 to 255, where 0 is warm and 255 is cold
	 */
	// Unused for now
	public colorTemperature: number = 0;

	protected _onRemoteUpdate(params: EwelinkLightPowerPowerParams): void {
		if (!params.ltype) {
			return;
		}
		const ltype = params.ltype;
		const ltypeParams = params[ltype];
		if (!ltypeParams) {
			return;
		}

		this.brightness = ltypeParams.br;
		this.colorTemperature = ltypeParams.ct;
	}
}
