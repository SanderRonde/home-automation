type EnumValue = string;

export abstract class ClassEnum {
	protected constructor(public readonly value: EnumValue) {}

	public static values(): EnumValue[] {
		return Object.values(this).filter((value) => typeof value === 'string');
	}

	public static fromValue(value: EnumValue): ClassEnum {
		const enumValue = Object.values(this).find(
			(enumInstance) =>
				enumInstance instanceof ClassEnum &&
				enumInstance.value === value
		);
		if (!enumValue) {
			throw new Error(`Invalid value: ${value}`);
		}
		return enumValue as ClassEnum;
	}
}
