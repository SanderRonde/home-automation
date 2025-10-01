declare module 'wled-client' {
	type Primitive = null | undefined | string | number | boolean | symbol | bigint;

	type PartialDeep<T> = T extends Primitive
		? Partial<T>
		: T extends Map<infer KeyType, infer ValueType>
			? PartialMapDeep<KeyType, ValueType>
			: T extends Set<infer ItemType>
				? PartialSetDeep<ItemType>
				: T extends ReadonlyMap<infer KeyType, infer ValueType>
					? PartialReadonlyMapDeep<KeyType, ValueType>
					: T extends ReadonlySet<infer ItemType>
						? PartialReadonlySetDeep<ItemType>
						: T extends (...arguments: any[]) => unknown
							? T | undefined
							: T extends object
								? PartialObjectDeep<T>
								: unknown;

	/**
Same as `PartialDeep`, but accepts only `Map`s and  as inputs. Internal helper for `PartialDeep`.
*/
	interface PartialMapDeep<KeyType, ValueType>
		extends Map<PartialDeep<KeyType>, PartialDeep<ValueType>> {}

	/**
Same as `PartialDeep`, but accepts only `Set`s as inputs. Internal helper for `PartialDeep`.
*/
	interface PartialSetDeep<T> extends Set<PartialDeep<T>> {}

	/**
Same as `PartialDeep`, but accepts only `ReadonlyMap`s as inputs. Internal helper for `PartialDeep`.
*/
	interface PartialReadonlyMapDeep<KeyType, ValueType>
		extends ReadonlyMap<PartialDeep<KeyType>, PartialDeep<ValueType>> {}

	/**
Same as `PartialDeep`, but accepts only `ReadonlySet`s as inputs. Internal helper for `PartialDeep`.
*/
	interface PartialReadonlySetDeep<T> extends ReadonlySet<PartialDeep<T>> {}

	/**
Same as `PartialDeep`, but accepts only `object`s as inputs. Internal helper for `PartialDeep`.
*/
	type PartialObjectDeep<ObjectType extends object> = {
		[KeyType in keyof ObjectType]?: PartialDeep<ObjectType[KeyType]>;
	};

	declare type RGBColor = [number, number, number];
	declare type RGBWColor = [number, number, number, number];
	declare type IPV4 = [number, number, number, number];
	declare type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<
		T,
		Exclude<keyof T, Keys>
	> &
		{
			[K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
		}[Keys];
	declare type BuildStateFn = (
		segment?: WLEDClientSegment
	) => WLEDClientUpdatableState | WLEDClientUpdatableSegment;

	/**
	 * Options used to configure the WLED Client instance
	 * @typedef {Object} WLEDClientOptions
	 */
	interface WLEDClientOptions {
		/** Device requires a secure connection. */
		secure: boolean;
		/** IP or hostname of the device. */
		host: string;
		/** Port used to connect to the WLED APIs. */
		port?: number;
		/** Device is in debug mode and has access to an extended API. */
		debug?: boolean;
		/**
		 * If `boolean`, this will enable or disable the WebSocket API.
		 *
		 * Otherwise pass an object to configure the WebSocket connection.
		 */
		websocket:
			| boolean
			| {
					/** Attempt to reconnect if connection is lost. */
					reconnect?: boolean;
			  };
		/** Immediately initiates a context refresh and ws connection */
		immediate: boolean;
		/** Choose what information to fetch on initialization */
		init?: {
			/** Fetch device presets on init */
			presets?: boolean;
			/** Fetch device config on init */
			config?: boolean;
		};
	}
	/**
	 * Segment state that are only available when sending commands.
	 * @typedef {Object} WLEDClientSegmentSendOnly
	 */
	interface WLEDClientSegmentSendOnly {
		/** Zero-indexed ID of the segment. May be omitted, in that case the ID will be inferred from the order of the segment objects in the seg array. */
		id?: number;
		/** Individual LED control. */
		i?: number | (RGBColor | RGBWColor)[];
	}
	/**
	 * Segment state that can be both set and get.
	 * @typedef {Object} WLEDClientSegment
	 */
	interface WLEDClientSegment {
		/** The ID of this segment. */
		id?: number;
		/** The name of this segment. */
		name?: string;
		/**
		 * LED index that the segment starts at.
		 * @type {number} 0 to `info.leds.count`-1
		 */
		start: number;
		/**
		 * LED the segment stops at, not included in range. If stop is set to a lower or equal value than start (setting to `0` is recommended), the segment is invalidated and deleted.
		 * @type {number} 0 to `info.leds.count`
		 */
		stop?: number;
		/**
		 * Length of the segment (`stop` - `start`). `stop` has preference, so if it is included, `len` is ignored.
		 * @type {number} 0 to info.leds.count
		 */
		length?: number;
		/** Offset of this segment. */
		offset?: number;
		/**
		 * Grouping - how many consecutive LEDs of the same segment will be grouped to the same color.
		 * @type {number} 0 to 255
		 */
		grouping?: number;
		/**
		 * Spacing - how many LEDs are turned off and skipped between each group.
		 * @type {number} 0 to 255
		 */
		spacing?: number;
		/**
		 * Repeat - multiplies segment until all LEDs are used, or max segments reached
		 */
		repeat?: boolean;
		/**
		 * If true the segment's contents will not be refreshed
		 */
		freeze?: boolean;
		/** Array that has up to 3 color arrays as elements, the primary, secondary (background) and tertiary colors of the segment. Each color is an array of 3 or 4 bytes, which represent an RGB(W) color. */
		colors?: (RGBColor | RGBWColor)[];
		/**
		 * ID of the effect on the individual segment.
		 * @type {number} 0 to `info.effectsCount`-1
		 */
		effectId?: number;
		/**
		 * Relative effect speed
		 * @type {number} 0 to 255
		 */
		effectSpeed?: number;
		/**
		 * Effect intensity
		 * @type {number} 0 to 255
		 */
		effectIntensity?: number;
		/**
		 * ID of the color palette on the individual segment.
		 * @type {number} 0 to `info.palettesCount`-1
		 */
		paletteId?: number;
		/**
		 * `true` if the segment is selected. Selected segments will have their state (color/FX) updated by APIs that don't support segments (currently any API except this JSON API).
		 *
		 * If no segment is selected, the first segment (id: `0`) will behave as if selected. WLED will report the state of the first (lowest id) segment that is selected to APIs (UDP sync, HTTP, MQTT, Blynk...).
		 */
		selected?: boolean;
		/** Reverses the segment, causing animations to change direction. */
		reverse?: boolean;
		/** Turns on and off the individual segment. */
		on?: boolean;
		/** Sets the brightness of the individual segment. */
		brightness?: number;
		/** The correlated color temperature of this segment. */
		cct?: number;
		/** Mirrors the individual segment. */
		mirror?: boolean;
		/** Loxone RGB value for primary color. Each color (RRR,GGG,BBB) is specified in the range from 0 to 100%. */
		loxonePrimaryColor?: number;
		/** Loxone RGB value for secondary color. Each color (RRR,GGG,BBB) is specified in the range from 0 to 100%. */
		loxoneSecondaryColor?: number;
	}
	/**
	 * Every segment state key that can be set.
	 * @typedef {Object} WLEDClientUpdatableSegment
	 */
	declare type WLEDClientUpdatableSegment = PartialDeep<WLEDClientSegment> &
		WLEDClientSegmentSendOnly;
	/**
	 * Playlist object used when creating a playlist.
	 * @typedef {Object} WLEDClientPlaylist
	 */
	interface WLEDClientPlaylist {
		/** Array of preset ID integers to be applied in order. */
		presets: number[];
		/** Array of time each preset should be kept, in tenths of seconds. If only one integer is supplied, all presets will be kept for that time. Defaults to 10 seconds if not provided. */
		durations: number[];
		/** Array of time each preset should transition to the next one, in tenths of seconds. If only one integer is supplied, all presets will transition for that time. Defaults to the current transition time if not provided. */
		transitions: number | number[];
		/** How many times the entire playlist should cycle before finishing. Set to `0` for an indefinite cycle. Default to indefinite if not provided. */
		repeat: number;
		/** Single preset ID to apply after the playlist finished. Has no effect when an indefinite cycle is set. If not provided, the light will stay on the last preset of the playlist. */
		endId: number;
	}
	/**
	 * Playlist object used when creating a playlist.
	 * @typedef {Object} WLEDClientStateSendOnly
	 */
	interface WLEDClientStateSendOnly {
		/**
		 * Transition time in 100ms intervals (eg. 4 is 400ms), for the current API call only.
		 * @type {number} 0 to 255
		 */
		temporaryTransition?: number;
		/** UDP Sync state object. */
		udpSync?: {
			/** Don't send a UDP Sync broadcast packet for the current API call only. */
			noSync?: boolean;
		};
		/** ID of the preset slot to save to. */
		savePresetId?: number;
		/** ID of the preset to delete. */
		deletePresetId?: number;
		/** Sets flag includeBri */
		includeBrightness?: boolean;
		/** Sets flag segmentBounds */
		segmentBounds?: boolean;
		/** Build new state when saving preset. */
		overwriteState?: boolean;
		/** If set to `true` in a JSON POST command, the response will contain the full JSON state object. */
		returnFullState?: boolean;
		/** If set to `true`, device will reboot immediately. */
		reboot?: boolean;
		/** Set module time to unix timestamp. */
		time?: number;
		segments?: WLEDClientSegmentSendOnly[];
		/** Set playlist. */
		playlist?: WLEDClientPlaylist;
	}
	interface WLEDClientStateReceiveOnly {
		/** Error flag that may be set when some issues are encountered in WLED. */
		error?: string;
		nightlight: {
			/** Remaining nightlight duration in seconds, `-1` if not active. */
			remaining?: number;
		};
	}
	interface WLEDClientNightlightState {
		/** Whether or not nightlight is currently active. */
		on?: boolean;
		/**
		 * Duration of the nightlight in minutes.
		 * @type {number} 1 to 255
		 */
		duration?: number;
		/**
		 * Nightlight mode
		 * @type {WLEDNightlightMode} 0: Instant, 1: Fade, 2: Color fade, 3: Sunrise
		 */
		mode?: WLEDNightlightMode;
		/**
		 * Target brightness of the nightlight
		 * @type {number} 0 to 255
		 */
		targetBrightness?: number;
	}
	interface WLEDClientExchangeableState {
		/** Device's current power state. */
		on?: boolean;
		/**
		 * Device's current brightness.
		 * @type {number} Between 0 and 255.
		 */
		brightness?: number;
		/**
		 * Device's current transition time in 100ms intervals (eg. 4 is 400ms).
		 * @type {number} 0 to 255
		 */
		transitionTime?: number;
		/** ID of the device's current preset. */
		presetId?: number;
		/** ID of the device's current playlist. */
		playlistId?: number;
		/** Object containing the device's nightlight state. */
		nightlight: WLEDClientNightlightState;
		/** UDP Sync state object. */
		udpSync: {
			/** Send UDP Sync broadcast packet on state change. */
			send?: boolean;
			/** Receive UDP Sync broadcast packets. */
			receive?: boolean;
		};
		/**
		 * Live data override.
		 * @type {WLEDLiveDataOverride} 0: Off, 1: Override until data ends, 2: Override until reboot
		 */
		liveDataOverride?: WLEDLiveDataOverride;
		/**
		 * ID of the main segment.
		 * @type {number} 0 to `info.leds.maxSegments`-1
		 */
		mainSegmentId?: number;
		/**
		 * Array of segments.
		 */
		segments: WLEDClientSegment[];
	}
	declare type WLEDClientUpdatableState = PartialDeep<WLEDClientExchangeableState> &
		WLEDClientStateSendOnly;
	declare type WLEDClientState = WLEDClientExchangeableState & WLEDClientStateReceiveOnly;
	interface WLEDClientInfoLEDs {
		/**
		 * Total number of LEDs.
		 * @type {number} 1 to 1200
		 */
		count?: number;
		/**
		 * Current frames per second.
		 * @type {number} 0 to 255
		 */
		fps?: number;
		/**
		 * `true` if LEDs are 4-channel (RGBW).
		 * @deprecated use info.leds.segmentLightCapabilities
		 */
		rgbw?: boolean;
		/**
		 * `true` if device has cct support.
		 * @deprecated use info.leds.segmentLightCapabilities
		 */
		cct?: boolean;
		/**
		 * `true` if a white channel slider should be displayed.
		 * @deprecated use info.leds.segmentLightCapabilities
		 */
		whiteValueInput?: boolean;
		/**
		 * Capabilities of the busses included in each segment in ascending ID order up to last active segment (0 for non-active segment).
		 */
		segmentLightCapabilities?: number[];
		/**
		 * Combined light capabilities across all segments.
		 */
		lightCapabilities?: number;
		/**
		 * Current LED power usage in milliamps as determined by the ABL. `0` if ABL is disabled.
		 * @type {number} 0 to 65000
		 */
		currentPower?: number;
		/**
		 * Maximum power budget in milliamps for the ABL. `0` if ABL is disabled.
		 * @type {number} 0 to 65000
		 */
		maxPower?: number;
		/** Maximum number of segments supported by this version. */
		maxSegments?: number;
	}
	interface WLEDClientInfo {
		/** Device's WLED version name. */
		version?: string;
		/** Device's WLED build ID. (YYMMDDB, B = daily build index) */
		buildId?: number;
		/** The producer/vendor of the light. Always `WLED` for standard installations. */
		brand?: string;
		/** The product name. Always `FOSS` for standard installations. */
		product?: string;
		/** Device's individual name. Intended for display in lists and titles. */
		name?: string;
		/** Name of the platform. */
		arch?: string;
		/** Version of the underlying (Arduino core) SDK. */
		core?: string;
		/** Bytes of heap memory (RAM) currently available. Problematic if more than `10k`. */
		freeheap?: number;
		/** Time since the last boot/reset in seconds. */
		uptime?: number;
		/** The hexadecimal hardware MAC address of the device. Lowercase and without colons. */
		mac?: string;
		/** The UDP port for realtime packets and WLED broadcast. */
		udpPort?: number;
		/** Info on the device's physical LED setup. */
		leds: WLEDClientInfoLEDs;
		/** If `true`, the software is currently receiving realtime data via UDP or E1.31. */
		live?: boolean;
		/** Source of the realtime data. */
		liveSource?: string;
		/** IP of the realtime data source.  */
		liveIp?: string;
		/**
		 * Number of other WLED devices discovered on the network. `-1` if Node discovery disabled.
		 * @type {number} -1 to 255
		 */
		discoveredDevicesCount?: number;
		/**
		 * Current number of WebSocket clients connected to the device.
		 * @type {number} -1 to 8
		 */
		wsConnectedCount?: number;
		/** Number of effects available on the device. */
		effectsCount?: number;
		/** Number of color palettes available on the device. */
		palettesCount?: number;
		/** Info on the device's WiFi connection. */
		wifi: {
			/** Basic service set identifier of the currently connected network. */
			bssid?: string;
			/** Received signal strength indicator. */
			rssi?: number;
			/** Strength of the signal produced. Exists only if debug mode is enabled on the device. */
			txPower?: number;
			/** True if modem sleep is enabled. Exists only if debug mode is enabled on the device. */
			sleep?: boolean;
			/**
			 * Relative signal quality of the current connection.
			 * @type {number} 0 to 100
			 */
			signal?: number;
			/**
			 * The current WiFi channel.
			 * @type {number} 1 to 14
			 */
			channel?: number;
		};
		/** Info about the embedded LittleFS filesystem. */
		fs: {
			/** Estimate of used filesystem space in kilobytes. */
			used?: number;
			/** Total filesystem size in kilobytes. */
			total?: number;
			/** Unix timestamp for the last modification to the `presets.json` file. Not accurate after boot or after using `/edit`. */
			presetsModifiedTime?: number;
		};
		/**
		 * If `true`, an UI with only a single button for toggling sync should toggle receive+send, otherwise send only
		 */
		syncToggleReceive?: boolean;
		/** Bit field of options that WLED is configured with. */
		options?: number;
		/** Reason for reset. Exists only if debug mode is enabled on the device.  */
		resetReason?: string;
		/** Reason for reset. Exists only if debug mode is enabled on the device.  */
		resetReason0?: string;
		/** Reason for reset. Exists only if debug mode is enabled on the device.  */
		resetReason1?: string;
		/**
		 * Version of LwIP. `1` or `2` on ESP8266, `0` (does not apply) on ESP32.
		 * @deprecated Will be removed in 0.14
		 */
		lwip?: 0 | 1 | 2;
	}
	declare type WLEDClientEffects = string[];
	declare type WLEDClientPalettes = string[];
	interface WLEDClientLive {
		/** Live stream of LED data. Start with `startLEDStream()`. */
		leds: boolean;
	}
	declare type WLEDClientLiveLEDs = Uint8Array[];
	interface WLEDClientCurrentStatePreset {
		/**
		 * Name
		 */
		name: string;
		/**
		 * Quick load label
		 */
		label?: string;
		/** Sets flag includeBri */
		includeBrightness?: boolean;
		/** Sets flag segmentBounds */
		segmentBounds?: boolean;
	}
	interface WLEDClientPreset {
		/**
		 * Name
		 */
		name: string;
		/**
		 * Quick load label
		 */
		label?: string;
		/**
		 * Device's power state
		 */
		on?: boolean;
		/**
		 * Brightness
		 */
		brightness?: number;
		/**
		 * Transition time
		 */
		transition?: number;
		/**
		 * Main segment ID
		 */
		mainSegment?: number;
		/**
		 * Segments configuration
		 */
		segments?: WLEDClientSegment[];
	}
	declare type WLEDClientPresets = {
		[key: number]: WLEDClientPreset;
	};
	interface WLEDClientDeviceOptions {
		/** Device has debug mode enabled. */
		debug?: boolean;
		/** Device has support for Alexa. */
		alexa?: boolean;
		/** Device has support for Blynk IoT platform. */
		blynk?: boolean;
		/** Device has support for Cronixie clock kit. */
		cronixie?: boolean;
		/** Device has filesystem. */
		filesystem?: boolean;
		/** Device has support for Hue Sync. */
		huesync?: boolean;
		/** Device has support for Adalight. */
		adalight?: boolean;
		/** Device has support for Over The Air updates. */
		OTA?: boolean;
	}
	interface WLEDClientLightCapabilities {
		/** Supports color temperature. */
		cct?: boolean;
		/** Supports white channel. */
		white?: boolean;
		/** Supports RGB color. */
		rgb?: boolean;
	}
	interface WLEDClientConfigSendOnly {
		network?: {
			instances?: {
				/** Pre-shared key */
				psk?: string;
			}[];
		};
		accessPoint?: {
			/** Pre-shared key */
			psk?: string;
		};
		interfaces?: {
			mqtt?: {
				/** Pre-shared key */
				psk?: string;
			};
		};
		ota?: {
			/** Pre-shared key */
			psk?: string;
		};
		/** Reboot device */
		reboot?: boolean;
	}
	interface WLEDClientConfigReceiveOnly {
		/** Ethernet */
		ethernet?: {
			/** Ethernet pins */
			pins?: number[];
		};
		/**
		 * Settings revision
		 * @type {[number, number]} [Major, minor]
		 */
		revision?: [number, number];
		/** Version ID */
		versionId?: number;
		network?: {
			instances?: {
				/** Length of the pre-shared key */
				pskLength?: number;
			}[];
		};
		accessPoint?: {
			/** IP address */
			ip?: IPV4;
			/** Length of the pre-shared key */
			pskLength?: number;
		};
		hardware?: {
			led?: {
				/**
				 * Total number of LEDs
				 *
				 * No longer read, but provided for compatibility on downgrade.
				 */
				total?: number;
			};
		};
		interfaces?: {
			mqtt?: {
				/** Length of the pre-shared key */
				pskLength?: number;
			};
		};
		ota?: {
			/** Length of the pre-shared key */
			pskLength?: number;
		};
	}
	interface WLEDClientExchangeableConfig {
		/** Ethernet */
		ethernet?: {
			/** Ethernet type */
			type?: number;
		};
		/** Identity */
		id?: {
			/** Multicast DNS hostname */
			mdns?: string;
			/** Device name */
			name?: string;
			/** Alexa invocation name */
			invocationName?: string;
		};
		/** Network */
		network?: {
			/** Instances */
			instances?: {
				/** Service set identifier (Network ID) */
				ssid?: string;
				/** Static IP address */
				ip?: IPV4;
				/** Static gateway */
				gateway?: IPV4;
				/** Static subnet */
				subnet?: IPV4;
			}[];
		};
		/** WiFi access point */
		accessPoint?: {
			/** Service set identifier (Network ID) */
			ssid?: string;
			/** Channel */
			chan?: number;
			/** Hide SSID from broadcast */
			hide?: number;
			/** AP open behavior */
			openBehavior?: WLEDAPOpenBehavior;
		};
		/** WiFi firmware */
		wifi?: {
			/** WiFi sleep is enabled */
			sleep?: boolean;
		};
		/** Hardware Settings */
		hardware?: {
			/** LED */
			led?: {
				/** Maximum current for the whole strip in milliamps */
				maxCurrent?: number;
				/** Maximum current per LED in milliamps */
				maxCurrentPerLED?: number;
				/** Auto white mode */
				autoWhiteMode?: WLEDAutoWhiteMode;
				/** White temperature correction */
				cctCorrection?: boolean;
				/** Enable CCT calculation from RGB */
				cctFromRGB?: boolean;
				/** CCT blending */
				cctBlending?: number;
				/** Target FPS */
				fps?: number;
				/** Bus instances (strips, busses, channels?) */
				instances?: {
					/** Type of LEDs attached to this bus (eg. WS2812b, SK6812 etc.) */
					type?: WLEDBusType;
					/** Starting LED */
					start?: number;
					/** Length of bus in number of LEDs */
					length?: number;
					/** Skip first N LEDs (offset) */
					skip?: number;
					/** Color order */
					colorOrder?: WLEDBusColorOrder;
					/** Bus pins */
					pins?: number[];
					/** Bus requires off refresh */
					offRefresh?: boolean;
					/** Reverse bus */
					reverse?: boolean;
					/** Bus is RGBW */
					rgbw?: boolean;
				}[];
			};
			/** Button */
			button?: {
				/** Maximum number of buttons */
				max?: number;
				/** Button instances */
				instances?: {
					/** Button type */
					type?: WLEDButtonType;
					/** Button pin */
					pin?: [number];
					/** Button macros (interactions) */
					macros?: [
						/** Short press */
						number,
						/** Long press */
						number,
						/** Double press */
						number,
					];
				}[];
				/** Touch threshold */
				touchThreshold?: number;
				/** Publish to MQTT */
				mqtt?: boolean;
			};
			/** Infrared */
			ir?: {
				/** Pin used by the IR sensor */
				pin?: number;
				/** Type of IR remote */
				type?: WLEDIRRemoteType;
			};
			/** Relay */
			relay?: {
				/** Pin used by the relay */
				pin?: number;
				/** Reverse the relay */
				reverse?: boolean;
			};
		};
		/** Light */
		light?: {
			/** Brightness multiplier */
			scaleBrightness?: number;
			/** Palette blending mode */
			paletteBlendingMode?: WLEDPaletteBlendingMode;
			/** Auto segments is enabled */
			autoSegments?: boolean;
			/** Gamma correction */
			gammaCorrection?: {
				/**
				 * Brightness gamma correction
				 * @type {number} 2.8 if on, 1.0 if off
				 */
				brightness?: number;
				/**
				 * Color gamma correction
				 * @type {number} 2.8 if on, 1.0 if off
				 */
				color?: number;
			};
			/** Transitions */
			transition?: {
				/** Transitions are enabled */
				enabled?: boolean;
				/** Transition duration in milliseconds */
				duration?: number;
				/** Transitions between palettes is enabled */
				palettes?: boolean;
			};
			/** Nightlight */
			nightlight?: {
				/** Default nightlight mode */
				mode?: WLEDNightlightMode;
				/** Default duration of the nightlight in minutes */
				duration?: number;
				/** Default target brightness of the nightlight */
				targetBrightness?: number;
			};
		};
		/** Defaults */
		defaults?: {
			/** Apply specified preset */
			preset?: number;
			/** Turn LEDs on */
			on?: boolean;
			/** Set target brightness */
			brightness?: number;
		};
		/** Interfaces */
		interfaces?: {
			/** Blynk */
			blynk?: {
				/** Blynk host */
				host?: string;
				/** Blynk port */
				port?: number;
				/** Blynk token */
				token?: string;
			};
			/** Hue Sync */
			hue?: {
				/** Hue Sync polling is enabled */
				enabled?: boolean;
				/** Light ID */
				id?: number;
				/** Hue IP */
				ip?: IPV4;
				/** Polling interval */
				interval?: number;
				/** Receive from Hue */
				receive?: {
					/** Receive on/off notifications */
					on?: boolean;
					/** Receive brightness notifications */
					brightness?: boolean;
					/** Receive color notifications */
					color?: boolean;
				};
			};
			/** Live */
			live?: {
				/** DMX */
				dmx?: {
					/** DMX Address */
					address?: number;
					/** DMX Mode */
					mode?: WLEDDMXMode;
					/** e131 skip out of sequence */
					sequenceSkip?: boolean;
					/** e131 universe */
					universe?: number;
				};
				/** e131 multicast */
				multicast?: boolean;
				/** e131 port */
				port?: number;
				/** Receive direct notifications */
				enabled?: boolean;
				/** arlsForceMaxBri */
				maxBrightness?: boolean;
				/** arlsDisableGammaCorrection */
				noGammaCorrection?: boolean;
				/** arlsOffset */
				offset?: number;
				/** Real-time timeout duration  */
				timeout?: number;
			};
			/** MQTT */
			mqtt?: {
				/** MQTT is enabled */
				enabled?: boolean;
				/** Broker host */
				broker?: string;
				/** Broker port */
				port?: number;
				/** Client ID */
				clientId?: string;
				/** Username */
				user?: string;
				/** MQTT Topics */
				topics?: {
					/** Device topic */
					device?: string;
					/** Group topic */
					group?: string;
				};
			};
			/** Nodes */
			nodes?: {
				/** Listen for other WLED nodes */
				list?: boolean;
				/** Broadcast existence to other WLED nodes */
				broadcast?: boolean;
			};
			/** Network Time Protocol */
			ntp?: {
				/** NTP is enabled */
				enabled?: boolean;
				/** NTP host address */
				host?: string;
				/** Use AM/PM instead of 24 hour time */
				ampm?: boolean;
				/** Timezone */
				timezone?: number;
				/** Longitude */
				lon?: number;
				/** Latitude */
				lat?: number;
				/** Time offset in seconds */
				offset?: number;
			};
			/** Synchronize */
			sync?: {
				/** UDP port */
				port0?: number;
				/** UDP port */
				port1?: number;
				/** Sync receive */
				receive?: {
					/** Receive notifications for brightness */
					brightness?: boolean;
					/** Receive notifications for color */
					color?: boolean;
					/** Receive notifications for effects */
					effects?: boolean;
					/** Receive groups */
					groups?: number;
				};
				/** Sync send */
				send?: {
					/** Send button input notifications */
					button?: boolean;
					/** Send direct notifications */
					direct?: boolean;
					/** Send Hue notifications */
					hue?: boolean;
					/** Send Macro notifications */
					macro?: boolean;
					/** Send Alexa notifications */
					alexa?: boolean;
					/** Send notifications twice */
					twice?: boolean;
					/** Send groups */
					groups?: number;
				};
			};
			/** Alexa */
			alexa?: {
				/** Alexa enabled */
				enabled?: boolean;
				/** Alexa macros */
				macros?: [
					/** Alexa On macro */
					number,
					/** Alexa Off macro */
					number,
				];
			};
		};
		/** Overlay */
		overlay?: {
			/**
			 * Clock overlay mode
			 * @type {WLEDClockOverlay}
			 */
			clock?: WLEDClockOverlay;
			/** Countdown mode enabled */
			countdown?: boolean;
			/** First LED index used by the analog clock */
			min?: number;
			/** Last LED index used by the analog clock */
			max?: number;
			/** LED index for the "12" in the analog clock */
			show12LED?: number;
			/** Show 5 minute marks */
			show5MinuteMarks?: boolean;
			/** Show seconds trail */
			showSecondsTrail?: boolean;
		};
		/** Timers */
		timers?: {
			/** Countdown */
			countdown?: {
				/** Goal for the timer as datetime */
				goal?: [
					/** Year */
					number,
					/** Month */
					number,
					/** Day */
					number,
					/** Hour */
					number,
					/** Minute */
					number,
					/** Second */
					number,
				];
				/** Countdown macro */
				macro?: number;
			};
			/** Active timer instances */
			instances?: {
				/** Timer is enabled */
				enabled?: boolean;
				/** Hour */
				hour?: number;
				/** Minute */
				minute?: number;
				/** Day of Week */
				dayOfWeek?: number;
				/** Preset ID */
				macro?: number;
				/** Timer start date */
				start?: {
					/** Start month */
					month?: number;
					/** Start day */
					day?: number;
				};
				/** Timer end date */
				end?: {
					/** End month */
					month?: number;
					/** End day */
					day?: number;
				};
			}[];
		};
		/** Over-The-Air */
		ota?: {
			/** Arduino OTA is enabled */
			arduinoOTA?: boolean;
			/** Lock OTA software updates */
			lock?: boolean;
			/** Lock changes to WiFi settings */
			lockWiFi?: boolean;
		};
		/** DMX */
		dmx?: {
			/** Channel */
			channel?: number;
			/** Gap */
			gap?: number;
			/** Start */
			start?: number;
			/** Start LED */
			startLED?: number;
			/** Fixture map */
			fixtureMap?: number[];
			/** e131 proxy universe */
			e131Proxy?: boolean;
		};
		/** User mods */
		usermods?: {
			[key: string]: any;
		};
	}
	declare type WLEDClientUpdatableConfig = PartialDeep<
		WLEDClientExchangeableConfig & WLEDClientConfigSendOnly
	>;
	declare type WLEDClientConfig = WLEDClientExchangeableConfig & WLEDClientConfigReceiveOnly;
	interface WLEDClientContext {
		/** WLED Client state object. */
		state: WLEDClientState;
		/** WLED Client info object */
		info: WLEDClientInfo;
		/** List of effects available on the device. */
		effects: WLEDClientEffects;
		/** List of color palettes available on the device. */
		palettes: WLEDClientPalettes;
		/** List of presets saved on the device. */
		presets: WLEDClientPresets;
		/** Options parsed from `info.opt` */
		deviceOptions: WLEDClientDeviceOptions;
		/** Lighting capabilities of the device. */
		lightCapabilities: WLEDClientLightCapabilities;
		/** Live streaming data sources currently sending data. */
		live: WLEDClientLive;
		/**  */
		config: WLEDClientConfig;
	}
	/**
	 * Optional properties you can set when using sending this command.
	 */
	interface WLEDClientSendOptions {
		/**
		 * Transition time in 100ms intervals (eg. 4 is 400ms), for the current API call only.
		 * @type {number} 0 to 255
		 */
		transition?: number;
		/** Don't send a UDP Sync broadcast packet for the current API call only. */
		noSync?: boolean;
		/** Choose which API to use. */
		method?: 'ws' | 'json';
		/** Set a timeout on this request for **JSON API only** */
		timeout?: number;
	}
	/** Optional properties relating to the segment this method will affect. */
	interface WLEDClientSendSegmentOptions {
		/** Segment ID or an array of Segment IDs to target with this command. */
		segmentId?: number | number[];
	}

	declare enum WLEDNightlightMode {
		INSTANT = 0,
		FADE = 1,
		COLOR_FADE = 2,
		SUNRISE = 3,
	}
	declare enum WLEDLiveDataOverride {
		OFF = 0,
		UNTIL_END = 1,
		UNTIL_REBOOT = 2,
	}
	declare enum WLEDAPOpenBehavior {
		/** Open AP when there is no WiFi connection after boot */
		NO_CONNECTION_AFTER_BOOT = 0,
		/** Open AP when disconnected from WiFi */
		DISCONNECTED = 1,
		/** Always open the AP */
		AWLAYS = 2,
		/** Never open the AP (not recommended) */
		NEVER = 3,
	}
	declare enum WLEDAutoWhiteMode {
		NONE = 0,
		BRIGHTER = 1,
		ACCURATE = 2,
		DUAL = 3,
	}
	declare enum WLEDBusColorOrder {
		GRB = 0,
		RGB = 1,
		BRG = 2,
		RBG = 3,
		BGR = 4,
		GBR = 5,
	}
	declare enum WLEDBusType {
		WS281x = 22,
		SK6812_RGBW = 30,
		TM1814 = 31,
		KHZ400 = 24,
		WS2801 = 50,
		APA102 = 51,
		LPD8806 = 52,
		P9813 = 53,
		PWM_White = 41,
		PWM_CCT = 42,
		PWM_RGB = 43,
		PWM_RGBW = 44,
		PWM_RGB_CCT = 45,
		DDP_RGB_NETWORK = 80,
	}
	declare enum WLEDButtonType {
		DISABLED = 0,
		PUSHBUTTON = 2,
		PUSHBUTTON_INVERTED = 3,
		SWITCH = 4,
		PIR_SENSOR = 5,
		TOUCH = 6,
		ANALOG = 7,
		ANALOG_INVERTED = 8,
	}
	declare enum WLEDIRRemoteType {
		REMOTE_DISABLED = 0,
		KEY_24_RGB = 1,
		KEY_24_WITH_CT = 2,
		KEY_40_BLUE = 3,
		KEY_44_RGB = 4,
		KEY_21_RGB = 5,
		KEY_6_BLACK = 6,
		KEY_9_RED = 7,
		JSON_REMOTE = 8,
	}
	declare enum WLEDPaletteBlendingMode {
		LINEAR_WRAP_IF_MOVING = 0,
		LINEAR_ALWAYS_WRAP = 1,
		LINEAR_NEVER_WRAP = 2,
		NONE = 3,
	}
	declare enum WLEDClockOverlay {
		NONE = 0,
		ANALOG = 1,
		DIGITAL = 2,
	}
	declare enum WLEDDMXMode {
		DISABLED = 0,
		SINGLE_RGB = 1,
		SINGLE_DRGB = 2,
		EFFECT = 3,
		MULTI_RGB = 4,
		DIMMER_MULTI_RGB = 5,
		MULTI_RGBW = 6,
	}

	interface WLEDSegmentSendOnly {
		/** Zero-indexed ID of the segment. May be omitted, in that case the ID will be inferred from the order of the segment objects in the seg array. */
		id: number;
		/** Individual LED control. */
		i: number | [number, number, number][];
	}
	interface WLEDSegment {
		/** The ID of this segment. */
		id: number;
		/** The name of this segment. */
		n: string;
		/**
		 * LED index that the segment starts at.
		 * @type {number} 0 to `info.leds.count`-1
		 */
		start: number;
		/**
		 * LED the segment stops at, not included in range. If stop is set to a lower or equal value than start (setting to `0` is recommended), the segment is invalidated and deleted.
		 * @type {number} 0 to `info.leds.count`
		 */
		stop: number;
		/**
		 * Length of the segment (`stop` - `start`). `stop` has preference, so if it is included, `len` is ignored.
		 * @type {number} 0 to info.leds.count
		 */
		len: number;
		/** Offset of this segment. */
		of: number;
		/**
		 * Grouping - how many consecutive LEDs of the same segment will be grouped to the same color.
		 * @type {number} 0 to 255
		 */
		grp: number;
		/**
		 * Spacing - how many LEDs are turned off and skipped between each group.
		 * @type {number} 0 to 255
		 */
		spc: number;
		/**
		 * Repeat - multiplies segment until all LEDs are used, or max segments reached
		 */
		rpt: boolean;
		/**
		 * If true the segment's contents will not be refreshed
		 */
		frz?: boolean;
		/** Array that has up to 3 color arrays as elements, the primary, secondary (background) and tertiary colors of the segment. Each color is an array of 3 or 4 bytes, which represent an RGB(W) color. */
		col: (RGBColor | RGBWColor)[];
		/** The correlated color temperature of this segment. */
		cct: number;
		/**
		 * ID of the effect on the individual segment.
		 * @type {number} 0 to `info.fxcount`-1
		 */
		fx: number;
		/**
		 * Relative effect speed
		 * @type {number} 0 to 255
		 */
		sx: number;
		/**
		 * Effect intensity
		 * @type {number} 0 to 255
		 */
		ix: number;
		/**
		 * ID of the color palette on the individual segment.
		 * @type {number} 0 to `info.palcount`-1
		 */
		pal: number;
		/**
		 * `true` if the segment is selected. Selected segments will have their state (color/FX) updated by APIs that don't support segments (currently any API except this JSON API).
		 *
		 * If no segment is selected, the first segment (id: `0`) will behave as if selected. WLED will report the state of the first (lowest id) segment that is selected to APIs (UDP sync, HTTP, MQTT, Blynk...).
		 */
		sel: boolean;
		/** Reverses the segment, causing animations to change direction. */
		rev: boolean;
		/** Turns on and off the individual segment. */
		on: boolean;
		/** Sets the brightness of the individual segment. */
		bri: number;
		/** Mirrors the individual segment. */
		mi: boolean;
		/** Loxone RGB value for primary color. Each color (RRR,GGG,BBB) is specified in the range from 0 to 100%. */
		lx: number;
		/** Loxone RGB value for secondary color. Each color (RRR,GGG,BBB) is specified in the range from 0 to 100%. */
		ly: number;
	}
	interface WLEDPlaylist {
		/** Array of preset ID integers to be applied in order. */
		ps: number[];
		/** Array of time each preset should be kept, in tenths of seconds. If only one integer is supplied, all presets will be kept for that time. Defaults to 10 seconds if not provided. */
		dur: number[];
		/** Array of time each preset should transition to the next one, in tenths of seconds. If only one integer is supplied, all presets will transition for that time. Defaults to the current transition time if not provided. */
		transition: number | number[];
		/** How many times the entire playlist should cycle before finishing. Set to `0` for an indefinite cycle. Default to indefinite if not provided. */
		repeat: number;
		/** Single preset ID to apply after the playlist finished. Has no effect when an indefinite cycle is set. If not provided, the light will stay on the last preset of the playlist. */
		end: number;
	}
	interface WLEDStateSendOnly {
		/** Transition time for the current API call only. */
		tt: number;
		udpn: {
			/** Don't send a UDP Sync broadcast packet for the current API call only. */
			nn: boolean;
		};
		/** ID of the preset slot to save to. */
		psave: number;
		/** ID of the preset to delete. */
		pdel: number;
		/** Sets flag includeBri */
		ib: boolean;
		/** Sets flag segmentBounds */
		sb: boolean;
		/** Build new state when saving preset. */
		o: boolean;
		/** If set to `true` in a JSON POST command, the response will contain the full JSON state object. */
		v: boolean;
		/** If set to `true`, device will reboot immediately. */
		rb: boolean;
		/** Set module time to unix timestamp. */
		time: number;
		seg: WLEDSegmentSendOnly[];
		/** Set playlist. */
		playlist: WLEDPlaylist;
	}
	interface WLEDStateReceiveOnly {
		/** Error flag that may be set when some issues are encountered in WLED. */
		error: string;
		nightlight: {
			/** Remaining nightlight duration in seconds, `-1` if not active. */
			rem: number;
		};
	}
	interface WLEDNightlightState {
		/** Whether or not nightlight is currently active. */
		on: boolean;
		/**
		 * Duration of the nightlight in minutes.
		 * @type {number} 1 to 255
		 */
		dur: number;
		/**
		 * Nightlight mode
		 * @type {WLEDNightlightMode} 0: Instant, 1: Fade, 2: Color fade, 3: Sunrise
		 */
		mode: WLEDNightlightMode;
		/**
		 * Target brightness of the nightlight
		 * @type {number} 0 to 255
		 */
		tbri: number;
	}
	interface WLEDExchangeableState {
		/** Device's current power state. */
		on: boolean;
		/**
		 * Device's current brightness.
		 * @type {number} Between 0 and 255.
		 */
		bri: number;
		/** Device's current transition time. */
		transition: number;
		/** ID of the device's current preset. */
		ps: number;
		/** ID of the device's current playlist. */
		pl: number;
		/** Nightlight feature state object. */
		nl: WLEDNightlightState;
		/** UDP Sync state object. */
		udpn: {
			/** Send UDP Sync broadcast packet on state change. */
			send: boolean;
			/** Receive UDP Sync broadcast packets. */
			recv: boolean;
		};
		/**
		 * Live data override.
		 * @type {WLEDLiveDataOverride} 0: Off, 1: Override until data ends, 2: Override until reboot
		 */
		lor: WLEDLiveDataOverride;
		/**
		 * ID of the main segment.
		 * @type {number} 0 to `info.leds.maxseg`-1
		 */
		mainseg: number;
		/**
		 * Array of segments.
		 */
		seg: WLEDSegment[];
	}
	declare type WLEDUpdatableState = PartialDeep<WLEDExchangeableState & WLEDStateSendOnly>;
	declare type WLEDState = WLEDExchangeableState & WLEDStateReceiveOnly;
	interface WLEDInfoLEDs {
		/**
		 * Total number of LEDs.
		 * @type {number} 1 to 1200
		 */
		count: number;
		/**
		 * Current frames per second.
		 * @type {number} 0 to 255
		 */
		fps: number;
		/**
		 * `true` if LEDs are 4-channel (RGBW).
		 * @deprecated use info.leds.lc
		 */
		rgbw: boolean;
		/**
		 * `true` if a white channel slider should be displayed.
		 * @deprecated use info.leds.lc
		 */
		wv: boolean;
		/**
		 * `true` if device has cct support.
		 * @deprecated use info.leds.lc
		 */
		cct: boolean;
		/**
		 * Capabilities of the busses included in each segment in ascending ID order up to last active segment (0 for non-active segment)
		 */
		seglc: number[];
		/**
		 * Combined light capabilities across all segments.
		 */
		lc: number;
		/**
		 * Current LED power usage in milliamps as determined by the ABL. `0` if ABL is disabled.
		 * @type {number} 0 to 65000
		 */
		pwr: number;
		/**
		 * Maximum power budget in milliamps for the ABL. `0` if ABL is disabled.
		 * @type {number} 0 to 65000
		 */
		maxpwr: number;
		/** Maximum number of segments supported by this version. */
		maxseg: number;
	}
	interface WLEDInfo {
		/** Device's WLED version name. */
		ver: string;
		/** Device's WLED build ID. (YYMMDDB, B = daily build index) */
		vid: number;
		/** The producer/vendor of the light. Always `WLED` for standard installations. */
		brand: string;
		/** The product name. Always `FOSS` for standard installations. */
		product: string;
		/** Device's individual name. Intended for display in lists and titles. */
		name: string;
		/** Name of the platform. */
		arch: string;
		/** Version of the underlying (Arduino core) SDK. */
		core: string;
		/** Bytes of heap memory (RAM) currently available. Problematic if more than `10k`. */
		freeheap: number;
		/** Time since the last boot/reset in seconds. */
		uptime: number;
		/** The hexadecimal hardware MAC address of the device. Lowercase and without colons. */
		mac: string;
		/** The UDP port for realtime packets and WLED broadcast. */
		udpport: number;
		/** Info on the device's physical LED setup. */
		leds: WLEDInfoLEDs;
		/** If `true`, the software is currently receiving realtime data via UDP or E1.31. */
		live: boolean;
		/** Source of the realtime data. */
		lm: string;
		/** IP of the realtime data source.  */
		lip: string;
		/**
		 * Number of other WLED devices discovered on the network. `-1` if Node discovery disabled.
		 * @type {number} -1 to 255
		 */
		ndc: number;
		/**
		 * Current number of WebSocket clients connected to the device.
		 * @type {number} -1 to 8
		 */
		ws: number;
		/** Number of effects available on the device. */
		fxcount: number;
		/** Number of color palettes available on the device. */
		palcount: number;
		/** Info on the device's WiFi connection. */
		wifi: {
			/** Basic service set identifier of the currently connected network. */
			bssid: string;
			/** Received signal strength indicator. */
			rssi: number;
			/** Strength of the signal produced. Exists only if debug mode is enabled on the device. */
			txPower?: number;
			/** True if modem sleep is enabled. Exists only if debug mode is enabled on the device. */
			sleep?: boolean;
			/**
			 * Relative signal quality of the current connection.
			 * @type {number} 0 to 100
			 */
			signal: number;
			/**
			 * The current WiFi channel.
			 * @type {number} 1 to 14
			 */
			channel: number;
		};
		/** Info about the embedded LittleFS filesystem. */
		fs: {
			/** Estimate of used filesystem space in kilobytes. */
			u: number;
			/** Total filesystem size in kilobytes. */
			t: number;
			/** Unix timestamp for the last modification to the `presets.json` file. Not accurate after boot or after using `/edit`. */
			pmt: number;
		};
		/** If `true`, an UI with only a single button for toggling sync should toggle receive+send, otherwise send only. */
		str: boolean;
		/** Bit field of options that WLED is configured with. */
		opt: number;
		/** Reason for reset. Exists only if debug mode is enabled on the device.  */
		resetReason?: string;
		/** Reason for reset. Exists only if debug mode is enabled on the device.  */
		resetReason0?: string;
		/** Reason for reset. Exists only if debug mode is enabled on the device.  */
		resetReason1?: string;
		/**
		 * Version of LwIP. `1` or `2` on ESP8266, `0` (does not apply) on ESP32.
		 * @deprecated Will be removed in 0.14
		 */
		lwip: 0 | 1 | 2;
	}
	declare type WLEDEffects = string[];
	declare type WLEDPalettes = string[];
	declare type WLEDPaletteData = ([number, number, number, number] | string)[];
	declare type WLEDPalettesData = {
		[id: string]: WLEDPaletteData;
	};
	interface WLEDPaletteDataPage {
		m: number;
		p: WLEDPalettesData;
	}
	interface WLEDLive {
		/** List of color values from every `n`th LED attached to the device. */
		leds: string[];
		/** If the number of LEDs is more than device's supported number of live LEDs, then WLED will send every `n`th LED. */
		n: number;
	}
	interface WLEDPreset {
		/**
		 * Name
		 */
		n: string;
		/**
		 * Quick load label
		 */
		ql?: string;
		/**
		 * Device's power state
		 */
		on?: boolean;
		/**
		 * Brightness
		 */
		bri?: number;
		/**
		 * Transition time
		 */
		transition?: number;
		/**
		 * Main segment ID
		 */
		mainseg?: number;
		/**
		 * Segments configuration
		 */
		segments?: WLEDSegment[];
	}
	declare type WLEDPresets = {
		[key: number]: WLEDPreset;
	};
	interface WLEDConfigSendOnly {
		nw?: {
			ins?: {
				/** Pre-shared key */
				psk?: string;
			}[];
		};
		ap?: {
			/** Pre-shared key */
			psk?: string;
		};
		if?: {
			mqtt?: {
				/** Pre-shared key */
				psk?: string;
			};
		};
		ota?: {
			/** Pre-shared key */
			psk?: string;
		};
		/** Reboot device */
		rb?: boolean;
	}
	interface WLEDConfigReceiveOnly {
		/** Ethernet */
		eth?: {
			/** Ethernet pins */
			pins?: number[];
		};
		/**
		 * Settings revision
		 * @type {[number, number]} [Major, minor]
		 */
		rev?: [number, number];
		/** Version ID */
		vid?: number;
		nw?: {
			ins?: {
				/** Length of the pre-shared key */
				pskl?: number;
			}[];
		};
		ap?: {
			/** IP address */
			ip?: IPV4;
			/** Length of the pre-shared key */
			pskl?: number;
		};
		hw?: {
			led?: {
				/**
				 * Total number of LEDs
				 *
				 * No longer read, but provided for compatibility on downgrade.
				 */
				total?: number;
			};
		};
		if?: {
			mqtt?: {
				/** Length of the pre-shared key */
				pskl?: number;
			};
		};
		ota?: {
			/** Length of the pre-shared key */
			pskl?: number;
		};
	}
	interface WLEDExchangeableConfig {
		/** Ethernet */
		eth?: {
			/** Ethernet type */
			type?: number;
		};
		/** Identity */
		id?: {
			/** Multicast DNS hostname */
			mdns?: string;
			/** Device name */
			name?: string;
			/** Alexa invocation name */
			inv?: string;
		};
		/** Network */
		nw?: {
			/** Instances */
			ins?: {
				/** Service set identifier (Network ID) */
				ssid?: string;
				/** Static IP address */
				ip?: IPV4;
				/** Static gateway */
				gw?: IPV4;
				/** Static subnet */
				sn?: IPV4;
			}[];
		};
		/** WiFi access point */
		ap?: {
			/** Service set identifier (Network ID) */
			ssid?: string;
			/** Channel */
			chan?: number;
			/** Hide SSID from broadcast */
			hide?: number;
			/** AP open behavior */
			behav?: WLEDAPOpenBehavior;
		};
		/** WiFi firmware */
		wifi?: {
			/** WiFi sleep is enabled */
			sleep?: boolean;
		};
		/** Hardware Settings */
		hw?: {
			led?: {
				/** Maximum power in milliamps. */
				maxpwr?: number;
				/** Milliamps per LED */
				ledma?: number;
				/** Auto white mode */
				rgbwm?: WLEDAutoWhiteMode;
				/** White temperature correction */
				cct?: boolean;
				/** Enable CCT calculation from RGB */
				cr?: boolean;
				/** CCT blending */
				cb?: number;
				/** Target FPS */
				fps?: number;
				/** Bus instances (strips, busses, channels?) */
				ins?: {
					/** Type of LEDs attached to this bus (eg. WS2812b, SK6812 etc.) */
					type?: WLEDBusType;
					/** Starting LED */
					start?: number;
					/** Length of bus in number of LEDs */
					len?: number;
					/** Skip first N LEDs (offset) */
					skip?: number;
					/** Color order */
					order?: WLEDBusColorOrder;
					/** Bus pins */
					pin?: number[];
					/** Bus requires off refresh */
					ref?: boolean;
					/** Reverse bus */
					rev?: boolean;
					/** Bus is RGBW */
					rgbw?: boolean;
				}[];
			};
			/** Buttons */
			btn?: {
				/** Maximum number of buttons */
				max?: number;
				/** Button instances */
				ins?: {
					/** Button type */
					type?: WLEDButtonType;
					/** Button pin */
					pin?: [number];
					/** Button macros (interactions) */
					macros?: [
						/** Short press */
						number,
						/** Long press */
						number,
						/** Double press */
						number,
					];
				}[];
				/** Touch threshold */
				tt?: number;
				/** Publish to MQTT */
				mqtt?: boolean;
			};
			/** Infrared */
			ir?: {
				/** Pin used by the IR sensor */
				pin?: number;
				/** Type of IR remote */
				type?: WLEDIRRemoteType;
			};
			/** Relay */
			relay?: {
				/** Pin used by the relay */
				pin?: number;
				/** Reverse the relay */
				rev?: boolean;
			};
		};
		/** Light */
		light?: {
			/** Brightness multiplier */
			'scale-bri'?: number;
			/** Palette blending mode */
			'pal-mode'?: WLEDPaletteBlendingMode;
			/** Auto segments is enabled */
			aseg?: boolean;
			/** Gamma correction */
			gc?: {
				/**
				 * Brightness gamma correction
				 * @type {number} 2.8 if on, 1.0 if off
				 */
				bri?: number;
				/**
				 * Color gamma correction
				 * @type {number} 2.8 if on, 1.0 if off
				 */
				col?: number;
			};
			/** Transitions */
			tr?: {
				/** Transitions are enabled */
				mode?: boolean;
				/** Transition duration in milliseconds */
				dur?: number;
				/** Transitions between palettes is enabled */
				pal?: boolean;
			};
			/** Nightlight */
			nl?: {
				/** Default nightlight mode */
				mode?: WLEDNightlightMode;
				/** Default duration of the nightlight in minutes */
				dur?: number;
				/** Default target brightness of the nightlight */
				tbri?: number;
			};
		};
		/** Defaults */
		def?: {
			/** Apply specified preset */
			ps?: number;
			/** Turn LEDs on */
			on?: boolean;
			/** Set target brightness */
			bri?: number;
		};
		/** Interfaces */
		if?: {
			/** Blynk */
			blynk?: {
				/** Blynk host */
				host?: string;
				/** Blynk port */
				port?: number;
				/** Blynk token */
				token?: string;
			};
			/** Hue Sync */
			hue?: {
				/** Hue Sync polling is enabled */
				en?: boolean;
				/** Light ID */
				id?: number;
				/** Hue IP */
				ip?: IPV4;
				/** Polling interval */
				iv?: number;
				/** Receive from Hue */
				recv?: {
					/** Receive on/off notifications */
					on?: boolean;
					/** Receive brightness notifications */
					bri?: boolean;
					/** Receive color notifications */
					col?: boolean;
				};
			};
			/** Live */
			live?: {
				/** DMX */
				dmx?: {
					/** DMX Address */
					addr?: number;
					/** DMX Mode */
					mode?: WLEDDMXMode;
					/** e131 skip out of sequence */
					seqskip?: boolean;
					/** e131 universe */
					uni?: number;
				};
				/** e131 multicast */
				mc?: boolean;
				/** e131 port */
				port?: number;
				/** Receive direct notifications */
				en?: boolean;
				/** arlsForceMaxBri */
				maxbri?: boolean;
				/** arlsDisableGammaCorrection */
				'no-gc'?: boolean;
				/** arlsOffset */
				offset?: number;
				/** Real-time timeout duration  */
				timeout?: number;
			};
			/** MQTT */
			mqtt?: {
				/** MQTT is enabled */
				en?: boolean;
				/** Broker host */
				broker?: string;
				/** Broker port */
				port?: number;
				/** Client ID */
				cid?: string;
				/** Username */
				user?: string;
				/** MQTT Topics */
				topics?: {
					/** Device topic */
					device?: string;
					/** Group topic */
					group?: string;
				};
			};
			/** Nodes */
			nodes?: {
				/** Listen for other WLED nodes */
				list?: boolean;
				/** Broadcast existence to other WLED nodes */
				bcast?: boolean;
			};
			/** Network Time Protocol */
			ntp?: {
				/** NTP is enabled */
				en?: boolean;
				/** NTP host address */
				host?: string;
				/** Use AM/PM instead of 24 hour time */
				ampm?: boolean;
				/** Timezone */
				tz?: number;
				/** Longitude */
				ln?: number;
				/** Latitude */
				lt?: number;
				/** Time offset in seconds */
				offset?: number;
			};
			/** Synchronize */
			sync?: {
				/** UDP port */
				port0?: number;
				/** UDP port */
				port1?: number;
				/** Sync receive */
				recv?: {
					/** Receive notifications for brightness */
					bri?: boolean;
					/** Receive notifications for color */
					col?: boolean;
					/** Receive notifications for effects */
					fx?: boolean;
					/** Receive groups */
					grp?: number;
				};
				/** Sync send */
				send?: {
					/** Send button input notifications */
					btn?: boolean;
					/** Send direct notifications */
					dir?: boolean;
					/** Send Hue notifications */
					hue?: boolean;
					/** Send Macro notifications */
					macro?: boolean;
					/** Send Alexa notifications */
					va?: boolean;
					/** Send notifications twice */
					twice?: boolean;
					/** Send groups */
					grp?: number;
				};
			};
			/** Alexa */
			va?: {
				/** Alexa enabled */
				alexa?: boolean;
				/** Alexa macros */
				macros?: [
					/** Alexa On macro */
					number,
					/** Alexa Off macro */
					number,
				];
			};
		};
		/** Overlay */
		ol?: {
			/**
			 * Clock overlay mode
			 * @type {WLEDClockOverlay}
			 */
			clock?: WLEDClockOverlay;
			/** Countdown mode enabled */
			cntdwn?: boolean;
			/** First LED index used by the analog clock */
			min?: number;
			/** Last LED index used by the analog clock */
			max?: number;
			/** LED index for the "12" in the analog clock */
			o12pix?: number;
			/** Show 5 minute marks */
			o5m?: boolean;
			/** Show seconds trail */
			osec?: boolean;
		};
		/** Timers */
		timers?: {
			/** Countdown */
			cntdwn?: {
				/** Goal for the timer as datetime */
				goal?: [
					/** Year */
					number,
					/** Month */
					number,
					/** Day */
					number,
					/** Hour */
					number,
					/** Minute */
					number,
					/** Second */
					number,
				];
				/** Countdown macro */
				macro?: number;
			};
			/** Active timer instances */
			ins?: {
				/** Timer is enabled */
				en?: boolean;
				/** Hour */
				hour?: number;
				/** Minute */
				min?: number;
				/** Day of Week */
				dow?: number;
				/** Preset ID */
				macro?: number;
				/** Timer start date */
				start?: {
					/** Start month */
					mon?: number;
					/** Start day */
					day?: number;
				};
				/** Timer end date */
				end?: {
					/** End month */
					mon?: number;
					/** End day */
					day?: number;
				};
			}[];
		};
		/** Over-The-Air */
		ota?: {
			/** Arduino OTA is enabled */
			aota?: boolean;
			/** Lock OTA software updates */
			lock?: boolean;
			/** Lock changes to WiFi settings */
			'lock-wifi'?: boolean;
		};
		/** DMX */
		dmx?: {
			/** Channel */
			chan?: number;
			/** Gap */
			gap?: number;
			/** Start */
			start?: number;
			/** Start LED */
			'start-led'?: number;
			/** Fixture map */
			fixmap?: number[];
			/** e131 proxy universe */
			e131proxy?: boolean;
		};
		/** User mods */
		um?: {
			[key: string]: any;
		};
	}
	declare type WLEDUpdatableConfig = PartialDeep<WLEDExchangeableConfig & WLEDConfigSendOnly>;
	declare type WLEDConfig = WLEDExchangeableConfig & WLEDConfigReceiveOnly;
	interface WLEDContext {
		/** WLED state object. */
		state: WLEDState;
		/** WLED info object */
		info: WLEDInfo;
		/** List of effects available on the device. */
		effects: WLEDEffects;
		/** List of color palettes available on the device. */
		palettes: WLEDPalettes;
	}

	/** Class to support event emitters in an isomorphic way using EventTarget */
	declare class IsomorphicEventEmitter extends EventTarget {
		on(eventName: string, listener: (...args: any[]) => void): void;
		once(eventName: string, listener: (...args: any[]) => void): void;
		off(eventName: string, listener: (...args: any[]) => void): void;
		emit<T extends any[]>(eventName: string, ...args: T): boolean;
	}

	/**
	 * Client interface for WLED devices.
	 */
	declare class WLEDClient extends IsomorphicEventEmitter {
		/** Device's current state. */
		readonly state: WLEDClientState;
		/** Information about the device. */
		readonly info: WLEDClientInfo;
		/** List of effects available for this device. */
		readonly effects: WLEDClientEffects;
		/** List of color palettes available for this device. */
		readonly palettes: WLEDClientPalettes;
		/** List of presets save on this device. */
		readonly presets: WLEDClientPresets;
		/**  */
		readonly config: WLEDClientConfig;
		/** Options that are set on the device. */
		readonly deviceOptions: WLEDClientDeviceOptions;
		/** Lighting capabilities of the device. */
		readonly lightCapabilities: WLEDClientLightCapabilities;
		/** Live streaming data sources currently sending data. */
		readonly live: WLEDClientLive;
		/** Promise that is resolved when a successful connection has been made and the state has been retrieved. */
		private isReady;
		private options;
		/** The ready state of the WebSocket instance. */
		get wsReadyState(): 0 | 3 | 1 | 2;
		private JSONAPI;
		private WSAPI;
		/**
		 * @param {string} host - The IP or hostname of the device.
		 */
		constructor(host: string);
		/**
		 * @param {Partial<WLEDClientOptions>} options - Client options object.
		 */
		constructor(options: Partial<WLEDClientOptions>);
		init(): Promise<boolean | undefined>;
		/** Get the latest context from the device. */
		refreshContext(options?: { presets?: boolean; config?: boolean }): Promise<void>;
		/** Get the latest state from the device. */
		refreshState(): Promise<void>;
		/** Get the latest info from the device. */
		refreshInfo(): Promise<void>;
		/** Get the latest effects from the device. */
		refreshEffects(): Promise<void>;
		/** Get the latest palettes from the device. */
		refreshPalettes(): Promise<void>;
		/** Get the latest presets from the device. */
		refreshPresets(): Promise<void>;
		/** Get the latest config from the device. */
		refreshConfig(): Promise<void>;
		private setContext;
		/**
		 * Make an update to the state object with multiple values.
		 * @param {WLEDClientUpdatableState} state Partial state object of values to update
		 */
		updateState(
			state: WLEDClientUpdatableState,
			options?: WLEDClientSendOptions
		): Promise<void>;
		/**
		 * Make an update to the config object with multiple values.
		 * @param {WLEDClientUpdatableConfig} config Partial config object of values to update
		 */
		updateConfig(config: WLEDClientUpdatableConfig): Promise<boolean>;
		/**
		 * Constructs a state update request that applies new state to all segments passed, or to the main state object if no segments are passed.
		 * @param state The state to update, or a function that is called optionally per-segment and returns the state to update
		 * @param segmentId One or more segment IDs
		 */
		buildStateWithSegments(
			state: (WLEDClientUpdatableState | WLEDClientUpdatableSegment) | BuildStateFn,
			segmentId?: number | number[]
		): WLEDClientUpdatableState | WLEDClientUpdatableSegment;
		/** Connect to the device's WebSocket API. */
		connect(): Promise<boolean>;
		/** Disconnect from the device's WebSocket API. */
		disconnect(): void;
		/** Start a live stream of LED values from the device via the WebSocket API. Listen to the `update:leds` event (e.g. `wled.addEventListener('update:leds', cb)`). */
		startLEDStream(): Promise<void>;
		/** Stop the live stream of LED values from the device. */
		stopLEDStream(): Promise<void>;
		/** Start the live stream if it is stopped, or stop the live stream if it is started */
		toggleLEDStream(): Promise<void>;
		/** Hard reboot the device. */
		reboot(): Promise<void>;
		/** Set the device or segment power state to on. */
		turnOn({
			segmentId,
			...options
		}?: WLEDClientSendOptions & WLEDClientSendSegmentOptions): Promise<void>;
		/** Set the device or segment power state to off. */
		turnOff({
			segmentId,
			...options
		}?: WLEDClientSendOptions & WLEDClientSendSegmentOptions): Promise<void>;
		/** Change the device or segment power state to the opposite of what it currently is. */
		toggle({
			segmentId,
			...options
		}?: WLEDClientSendOptions & WLEDClientSendSegmentOptions): Promise<void>;
		/**
		 * Set the device's master brightness.
		 * @param value Any integer between 0 and 255
		 */
		setBrightness(
			value: number,
			{ segmentId, ...options }?: WLEDClientSendOptions & WLEDClientSendSegmentOptions
		): Promise<void>;
		/**
		 * Set the primary color of the device's main segment.
		 * @param {RGBColor|RGBWColor} color RGB or RGBW color array
		 * @alias setPrimaryColor
		 */
		setColor(
			color: RGBColor | RGBWColor,
			options?: WLEDClientSendOptions & WLEDClientSendSegmentOptions
		): Promise<void>;
		/**
		 * Set the primary color of the device's main segment.
		 * @param {RGBColor|RGBWColor} color RGB or RGBW color array
		 */
		setPrimaryColor(
			color: RGBColor | RGBWColor,
			{ segmentId, ...options }?: WLEDClientSendOptions & WLEDClientSendSegmentOptions
		): Promise<void>;
		/**
		 * Set the secondary color of the device's main segment.
		 * @param {RGBColor|RGBWColor} color RGB or RGBW color array
		 */
		setSecondaryColor(
			color: RGBColor | RGBWColor,
			{ segmentId, ...options }?: WLEDClientSendOptions & WLEDClientSendSegmentOptions
		): Promise<void>;
		/**
		 * Set the tertiary color of the device's main segment.
		 * @param {RGBColor|RGBWColor} color RGB or RGBW color array
		 */
		setTertiaryColor(
			color: RGBColor | RGBWColor,
			{ segmentId, ...options }?: WLEDClientSendOptions & WLEDClientSendSegmentOptions
		): Promise<void>;
		/**
		 * Set the correlated color temperature of the device's main segment.
		 * @param {number} kelvin The desired temperature in Kevlin
		 */
		setCCT(
			kelvin: number,
			{ segmentId, ...options }?: WLEDClientSendOptions & WLEDClientSendSegmentOptions
		): Promise<void>;
		/**
		 * Set the palette applied to the device's main segment.
		 * @param {number} paletteId ID of the desired palette, as found in `palettes`
		 */
		setPalette(
			paletteId: number,
			{ segmentId, ...options }?: WLEDClientSendOptions & WLEDClientSendSegmentOptions
		): Promise<void>;
		private paletteDataCache;
		getPalettesData(page?: number): Promise<WLEDPalettesData>;
		/**
		 * Set the effect applied to the device's main segment.
		 * @param {number} effectId ID of the desired effect, as found in `effects`
		 */
		setEffect(
			effectId: number,
			{ segmentId, ...options }?: WLEDClientSendOptions & WLEDClientSendSegmentOptions
		): Promise<void>;
		setEffectSpeed(
			value: number,
			{ segmentId, ...options }?: WLEDClientSendOptions & WLEDClientSendSegmentOptions
		): Promise<void>;
		setEffectIntensity(
			value: number,
			{ segmentId, ...options }?: WLEDClientSendOptions & WLEDClientSendSegmentOptions
		): Promise<void>;
		/**
		 * Duration of the crossfade between different colors/brightness levels.
		 * @param {number} value Time in 100ms intervals (eg. 4 is 400ms), 0 to 255
		 */
		setTransitionTime(value: number): Promise<void>;
		/**
		 * Set which segment should be considered the main one.
		 * @param {number} id ID of the main segment
		 */
		setMainSegmentId(id: number): Promise<void>;
		/**
		 * Get a segment by its `id`.
		 * @param {number} id ID of the desired segment
		 */
		getSegment(id: number): WLEDClientSegment;
		/**
		 * Create a new segment and adds it to the segment array.
		 * @param {WLEDClientUpdatableSegment} data Every updatable parameter on the segment object except `id`
		 */
		createSegment(data: Omit<WLEDClientUpdatableSegment, 'id'>): Promise<void>;
		/**
		 * Update a specific segment by `id`.
		 * @param {number} id ID of the segment to be updated
		 * @param {WLEDClientUpdatableSegment} data Every updatable parameter on the segment object except `id`
		 */
		updateSegment(
			id: number,
			data: Omit<WLEDClientUpdatableSegment, 'id'>,
			options?: WLEDClientSendOptions
		): Promise<void>;
		/**
		 * Delete a specific segment by `id`.
		 * @param {number} id ID of the segment to be removed
		 */
		deleteSegment(id: number): Promise<void>;
		/**
		 * Set the entire segment array.
		 * @param {WLEDClientUpdatableSegment[]} segments Array of segment objects to replace the current array of segment objects
		 */
		setSegments(segments: Omit<WLEDClientUpdatableSegment, 'id'>[]): Promise<void>;
		/** Clear the segment array completely. */
		clearSegments(): Promise<void>;
		/**
		 * Set a playlist for the device.
		 * @param {WLEDClientPlaylist} playlist A playlist object
		 */
		setPlaylist(playlist: WLEDClientPlaylist): Promise<void>;
		/** Methods relating to the nightlight feature. */
		nightlight: {
			/**
			 * State object of the nightlight feature
			 * @alias WLEDClient.state.nightlight
			 */
			readonly state: WLEDClientNightlightState & {
				remaining?: number | undefined;
			};
			/**
			 * Activate the nightlight. Depending on the set mode, the device will fade towards the target brightness over the set duration.
			 * @param {number|WLEDClientNightlightState} with_state Optional. Duration if number is passed, otherwise nightlight state object containing other properties to set while activating the nightlight
			 */
			enable(
				with_state?: number | Omit<Partial<WLEDClientNightlightState>, 'on'>
			): Promise<void>;
			/** Deactivate the nightlight. */
			disable(): Promise<void>;
			/** Change the nightlight state to the opposite of what it currently is. */
			toggle(): Promise<void>;
			/**
			 * Set the length of time the nightlight feature will remain active for.
			 * @param {number} value Time in minutes, 1 to 255
			 */
			setDuration(value: number): Promise<void>;
			/**
			 * Set the target brightness of the nightlight feature.
			 * @param {number} value 0 to 255
			 */
			setTargetBrightness(value: number): Promise<void>;
			/**
			 * Set the mode the nightlight will operate by.
			 * @param {WLEDNightlightMode} mode
			 */
			setMode(mode: WLEDNightlightMode): Promise<void>;
		};
		/**
		 * Ignore any live data if the device is currently being used to display the live data.
		 * @param {boolean} until_reboot If `false` or `undefined`, the live data will be ignored until the live data stream ends. If `true` the device will ignore live data until it reboots.
		 */
		ignoreLiveData(until_reboot?: boolean): Promise<void>;
		/** Allow live data to be displayed by the device. */
		allowLiveData(): Promise<void>;
		enableUDPSync(options?: RequireAtLeastOne<WLEDClientState['udpSync']>): Promise<void>;
		disableUDPSync(): Promise<void>;
		/**
		 * Get a preset by its ID.
		 * @param {number} id ID of the desired preset
		 */
		getPreset(id: number): WLEDClientPreset;
		/**
		 * Activate a new preset.
		 * @param {number} id ID of the desired preset
		 */
		setPreset(id: number): Promise<void>;
		/**
		 * Save a preset using the device's current state.
		 * @param {number} id
		 * @param {WLEDClientCurrentStatePreset} preset
		 */
		saveStateAsPreset(id: number, preset: WLEDClientCurrentStatePreset): Promise<void>;
		/**
		 * Save a preset.
		 * @param {number} id
		 * @param {WLEDClientPreset} preset
		 */
		savePreset(id: number, preset: WLEDClientPreset): Promise<void>;
		/**
		 * Delete a preset by its ID.
		 * @param {number} id ID of the preset to delete
		 */
		deletePreset(id: number): Promise<void>;
	}

	export {
		WLEDAPOpenBehavior,
		WLEDAutoWhiteMode,
		WLEDBusColorOrder,
		WLEDBusType,
		WLEDButtonType,
		WLEDClient,
		WLEDClientConfig,
		WLEDClientConfigReceiveOnly,
		WLEDClientConfigSendOnly,
		WLEDClientContext,
		WLEDClientCurrentStatePreset,
		WLEDClientDeviceOptions,
		WLEDClientEffects,
		WLEDClientExchangeableConfig,
		WLEDClientExchangeableState,
		WLEDClientInfo,
		WLEDClientInfoLEDs,
		WLEDClientLightCapabilities,
		WLEDClientLive,
		WLEDClientLiveLEDs,
		WLEDClientNightlightState,
		WLEDClientOptions,
		WLEDClientPalettes,
		WLEDClientPlaylist,
		WLEDClientPreset,
		WLEDClientPresets,
		WLEDClientSegment,
		WLEDClientSegmentSendOnly,
		WLEDClientSendOptions,
		WLEDClientSendSegmentOptions,
		WLEDClientState,
		WLEDClientStateReceiveOnly,
		WLEDClientStateSendOnly,
		WLEDClientUpdatableConfig,
		WLEDClientUpdatableSegment,
		WLEDClientUpdatableState,
		WLEDClockOverlay,
		WLEDConfig,
		WLEDConfigReceiveOnly,
		WLEDConfigSendOnly,
		WLEDContext,
		WLEDDMXMode,
		WLEDEffects,
		WLEDExchangeableConfig,
		WLEDExchangeableState,
		WLEDIRRemoteType,
		WLEDInfo,
		WLEDInfoLEDs,
		WLEDLive,
		WLEDLiveDataOverride,
		WLEDNightlightMode,
		WLEDNightlightState,
		WLEDPaletteBlendingMode,
		WLEDPaletteData,
		WLEDPaletteDataPage,
		WLEDPalettes,
		WLEDPalettesData,
		WLEDPlaylist,
		WLEDPreset,
		WLEDPresets,
		WLEDSegment,
		WLEDSegmentSendOnly,
		WLEDState,
		WLEDStateReceiveOnly,
		WLEDStateSendOnly,
		WLEDUpdatableConfig,
		WLEDUpdatableState,
	};
}
