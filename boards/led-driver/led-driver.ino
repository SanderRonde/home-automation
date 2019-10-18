#include <Arduino.h>
#include <string.h>
#include <FastLED.h>

#define LED_PIN 7
#define LEDS_PER_M 60
#define METERS_PER_STRIP 5
#define STRIPS 1
#define NUM_LEDS ((LEDS_PER_M * METERS_PER_STRIP) * STRIPS)
#define PSU_VOLTAGE 5
#define PSU_MAMPS 2000

#define MAX_ARG_LEN 10

namespace Modes {
	typedef enum LED_MODE {
		LED_MODE_SOLID,
		LED_MODE_OFF
	} led_mode_t;	
}

Modes::led_mode_t mode = Modes::LED_MODE_OFF;

CRGB leds[NUM_LEDS];
void setup() {
	Serial.begin(115200);
	FastLED.setMaxPowerInVoltsAndMilliamps(PSU_VOLTAGE, PSU_MAMPS);
	FastLED.addLeds<WS2812B, LED_PIN, GRB>(leds, NUM_LEDS);
}

void (*iterate_fn)(void) = NULL;
unsigned long mode_update_time = 1000UL * 1UL;
namespace Modes {
	namespace Off {
		const unsigned long update_time = 1000UL * 1UL;

		void do_iteration() {
			FastLED.showColor(CRGB::Black);
		}

		void handle_serial(const String serial_data[MAX_ARG_LEN]) {
			iterate_fn = do_iteration;
			mode_update_time = update_time;
			mode = Modes::LED_MODE_OFF;
		}
	}

	namespace Solid {
		const unsigned long update_time = 1000UL * 1UL;
		CRGB color = CRGB::Black;

		void do_iteration() {
			FastLED.showColor(color);
		}

		void handle_serial(const String serial_data[MAX_ARG_LEN]) {
			color = CRGB(
				atoi(serial_data[1].c_str()),
				atoi(serial_data[2].c_str()),
				atoi(serial_data[3].c_str())
			);

			iterate_fn = do_iteration;
			mode_update_time = update_time;
			mode = Modes::LED_MODE_SOLID;
		}
	}
}

namespace serial_control {
	void parse_serial(const String str, String data[MAX_ARG_LEN]) {
		int data_index = 0;
		String current_word = "";

		const char* c_str = str.c_str();
		for (int i = 0; i < str.length(); i++) {
			if (c_str[i] == ' ') {
				if (data_index > MAX_ARG_LEN) return;
				data[data_index++] = current_word;
				current_word = "";
			} else {
				current_word += c_str[i];
			}
		}
		data[data_index++] = current_word;
		return;
	}

	void handle_serial(const String str) {
		String serial_data[MAX_ARG_LEN];
		parse_serial(str, serial_data);

		if (serial_data[0] == "off") {
			Modes::Off::handle_serial(serial_data);
		} else if (serial_data[0] == "solid") {
			Modes::Solid::handle_serial(serial_data);
		}
	}

	String str = "";
	bool read_serial() {
		if (!Serial.available()) return false;

		bool update = false;
		while (Serial.available()) {
			char last_char = (char) Serial.read();
			if (last_char == '\n') {
				handle_serial(str);
				str = "";
				update = true;
			} else {
				str += String(last_char);
			}
		}
		return update;
	}
}

unsigned long last_run = millis() - 1;
void loop() {
	bool update = serial_control::read_serial();
	if (iterate_fn == NULL) {
		iterate_fn = Modes::Off::do_iteration;
		mode_update_time = Modes::Off::update_time;
	}
	
	if (update || millis() - last_run >= mode_update_time) {
		last_run = millis();
		iterate_fn();
	}
}