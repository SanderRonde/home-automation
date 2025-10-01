export type EnumValue = string;

export abstract class ClassEnum<V extends EnumValue = EnumValue> {
	protected constructor(public readonly value: V) {}

	public static values(): ClassEnum[] {
		return Object.values(this).filter((value) => value instanceof ClassEnum);
	}

	public static fromValue<V extends EnumValue>(value: V): ClassEnum<V> {
		const enumValue = this.tryFromValue(value);
		if (!enumValue) {
			throw new Error(`Invalid value: ${value}`);
		}
		return enumValue;
	}

	public static tryFromValue<V extends EnumValue>(value: V): ClassEnum<V> | null {
		const enumValue = Object.values(this).find(
			(enumInstance) => enumInstance instanceof ClassEnum && enumInstance.value === value
		);
		if (!enumValue) {
			return null;
		}
		return enumValue as ClassEnum<V>;
	}
}
