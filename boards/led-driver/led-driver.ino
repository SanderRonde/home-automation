#include <Arduino.h>
#include <string.h>
#include <FastLED.h>

#define LED_PIN 7
// TODO: double this number
#define LEDS_PER_M 30
#define METERS_PER_STRIP 5
#define STRIPS 1
#define NUM_LEDS ((LEDS_PER_M * METERS_PER_STRIP) * STRIPS)
#define MAX_SCALE_FACTOR 127UL
#define PRETTY_SCALE_FACTOR 90UL

// TODO: change when I get more RAM
#define MAX_ARG_LEN 50

#define RED_POWER_DRAW 16
#define GREEN_POWER_DRAW 11
#define BLUE_POWER_DRAW 15

#define ALL_WHITE_AMPS 12600UL
#define MAX_AMPS_UINT (ALL_WHITE_AMPS * MAX_SCALE_FACTOR)
#define PRETTY_AMPS_UINT (ALL_WHITE_AMPS * PRETTY_SCALE_FACTOR)

#define MAX_DOTS 5
#define MAX_SPLIT_COLORS 10
#define MAX_PATTERN_LEN 20

namespace Modes {
	typedef enum LED_MODE {
		LED_MODE_DOT,
		LED_MODE_SOLID,
		LED_MODE_SPLIT,
		LED_MODE_PATTERN,
		LED_MODE_PRIMED,
		LED_MODE_OFF
	} led_mode_t;	
}

typedef enum DIR {
	DIR_BACKWARDS = 0,
	DIR_FORWARDS = 1
} dir_t;

Modes::led_mode_t mode = Modes::LED_MODE_OFF;
boolean new_data = false;
char received_chars[MAX_ARG_LEN];

CRGB leds[NUM_LEDS];
void setup() {
	Serial.begin(115200);
	FastLED.addLeds<WS2812B, LED_PIN, GRB>(leds, NUM_LEDS);
}

uint8_t get_scale() {
	unsigned long total_draw = 0;
	for (int i = 0; i < NUM_LEDS; i++) {
		total_draw += leds[i].r * RED_POWER_DRAW;
		total_draw += leds[i].g * GREEN_POWER_DRAW;
		total_draw += leds[i].b * BLUE_POWER_DRAW;
	}
	double draw_percent = ((double) PRETTY_AMPS_UINT) / (double)total_draw;
	return draw_percent * 255UL;
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
			for (int i = 0; i < NUM_LEDS; i++) {
				leds[i] = color;
			}
			FastLED.show(get_scale());
		}

		void handle_serial(const String serial_data[MAX_ARG_LEN]) {
			color = CRGB(
				atoi(serial_data[2].c_str()),
				atoi(serial_data[3].c_str()),
				atoi(serial_data[4].c_str())
			);

			iterate_fn = do_iteration;
			mode_update_time = update_time;
			mode = Modes::LED_MODE_SOLID;
		}
	}

	namespace Dot {
		typedef struct dot {
			unsigned int dot_size;
			unsigned int dot_speed;
			unsigned int dot_pos;
			unsigned long last_move;
			dir_t dir;
			CRGB dot_color;
		} dot_t;

		const unsigned long update_time = 10;
		CRGB bg_color = CRGB::Black;
		dot_t dots[MAX_DOTS] = {{
			.dot_size = 0,
			.dot_speed = 0,
			.dot_pos = 0
		}};

		void do_iteration() {
			// Draw the background
			for (int i = 0; i < NUM_LEDS; i++) {
				leds[i] = bg_color;
			}

			// Draw the dots
			for (int i = 0; i < MAX_DOTS; i++) {
				dot_t* dot = &dots[i];
				if (dot->dot_size == 0) break;

				if (millis() - dot->last_move >= dot->dot_speed) {
					// Move it
					if (dot->dir == DIR_FORWARDS) {
						dot->dot_pos = (dot->dot_pos + 1) % NUM_LEDS;
					} else {
						dot->dot_pos = ((dot->dot_pos - 1) + NUM_LEDS) % NUM_LEDS;
					}
					dot->last_move = millis();
				}

				for (int j = dot->dot_pos; j < dot->dot_pos + dot->dot_size; j++) {
					leds[j % NUM_LEDS] = dot->dot_color;
				}
			}

			FastLED.show(get_scale());
		}

		void handle_serial(const String serial_data[MAX_ARG_LEN]) {
			// Set background color
			bg_color = CRGB(
				atoi(serial_data[2].c_str()),
				atoi(serial_data[3].c_str()),
				atoi(serial_data[4].c_str())
			);

			// Parse the dots
			int last_dot = 0;
			for (int i = 5; i < MAX_ARG_LEN && serial_data[i].c_str()[0] != '\\'; i += 7) {
				last_dot = ((i - 5) % 7);
				dot_t* dot = &dots[last_dot];
				// First get the size
				dot->dot_size = atoi(serial_data[i].c_str());
				// Then the speed
				dot->dot_speed = atoi(serial_data[i + 1].c_str());
				// Then the direction
				dot->dir = atoi(serial_data[i + 2].c_str()) == 0 ? DIR_BACKWARDS : DIR_FORWARDS;
				// Then the position as a percentage
				int pos_percent = atoi(serial_data[i + 3].c_str());
				dot->dot_pos = (unsigned int)(((float)pos_percent * NUM_LEDS) / 100);
				// Then the color
				dot->dot_color = CRGB(
					atoi(serial_data[i + 4].c_str()),
					atoi(serial_data[i + 5].c_str()),
					atoi(serial_data[i + 6].c_str())
				);
			}
			// Unset all other dots
			for (int i = last_dot + 1; i < MAX_DOTS; i++) {
				dots[i].dot_size = 0;
			}

			iterate_fn = do_iteration;
			mode_update_time = update_time;
			mode = Modes::LED_MODE_OFF;
		}
	}

	namespace Split {
		CRGB split_colors[MAX_SPLIT_COLORS];
		int split_colors_len = 0;
		int update_time = 0;
		int leds_per_split = 0;
		int offset = 0;
		dir_t dir = DIR_FORWARDS;

		void do_iteration() {
			int current_split_start = 0;
			for (int i = 0; i < split_colors_len; i++, current_split_start += leds_per_split) {
				for (int j = 0; j < leds_per_split && j < NUM_LEDS; j++) {
					leds[(current_split_start + j + offset + NUM_LEDS) % NUM_LEDS] = split_colors[i];
				}
			}

			// If there are any left, set them as well
			if (current_split_start + split_colors_len < NUM_LEDS) {
				for (int i = current_split_start + split_colors_len; i < NUM_LEDS; i++) {
					leds[(i + offset + NUM_LEDS) % NUM_LEDS] = split_colors[0];
				}
			}

			if (update_time != 0) {
				if (dir == DIR_FORWARDS) {
					offset++;
				} else {
					offset--;
				}
			}

			FastLED.show(get_scale());
		}

		void handle_serial(const String serial_data[MAX_ARG_LEN]) {
			update_time = atoi(serial_data[2].c_str());
			dir = atoi(serial_data[3].c_str()) == 0 ? DIR_BACKWARDS : DIR_FORWARDS;
			split_colors_len = 0;

			for (int i = 4; i < MAX_ARG_LEN && serial_data[i].c_str()[0] != '\\'; i += 3) {
				split_colors[split_colors_len++] = CRGB(
					atoi(serial_data[i].c_str()),
					atoi(serial_data[i + 1].c_str()),
					atoi(serial_data[i + 2].c_str())	
				);
			}
			
			leds_per_split = NUM_LEDS / split_colors_len;

			if (split_colors_len % 2 != 0) {
				Serial.println("Number of split colors needs to be even");
			}

			iterate_fn = do_iteration;
			if (update_time != 0) {
				mode_update_time = update_time;
			} else {
				mode_update_time = 1000;
			}
			mode = Modes::LED_MODE_SPLIT;
		}
	}

	namespace Pattern {
		CRGB pattern_colors[MAX_PATTERN_LEN];
		int pattern_len = 0;
		int update_time = 0;
		int offset = 0;
		dir_t dir = DIR_FORWARDS;

		void do_iteration() {
			for (int i = 0; i < NUM_LEDS; i += pattern_len) {
				for (int j = 0; j < pattern_len; j++) {
					leds[(j + i + offset + NUM_LEDS) % NUM_LEDS] = pattern_colors[j];
				}
			}

			if (update_time != 0) {
				if (dir == DIR_FORWARDS) {
					offset++;
				} else {
					offset--;
				}
			}

			FastLED.show(get_scale());
		}

		void handle_serial(const String serial_data[MAX_ARG_LEN]) {
			update_time = atoi(serial_data[2].c_str());
			dir = atoi(serial_data[3].c_str()) == 0 ? DIR_BACKWARDS : DIR_FORWARDS;
			pattern_len = 0;

			for (int i = 4; i < MAX_ARG_LEN && serial_data[i].c_str()[0] != '\\'; i += 3) {
				pattern_colors[pattern_len++] = CRGB(
					atoi(serial_data[i].c_str()),
					atoi(serial_data[i + 1].c_str()),
					atoi(serial_data[i + 2].c_str())	
				);
			}
			
			iterate_fn = do_iteration;
			if (update_time != 0) {
				mode_update_time = update_time;
			} else {
				mode_update_time = 1000;
			}
			mode = Modes::LED_MODE_PATTERN;
		}
	}

	namespace Prime {
		void do_iteration() {
			if (new_data) {
				char* str = received_chars;

				// 3 * 2 hex chars
				if (strlen(str) != 6) {
					return;
				}

				CRGB color;
				char* cur_part = str + 4;
				color.b = strtol(cur_part, NULL, 16);
				cur_part -= 2;
				cur_part[3] = '\0';
				color.g = strtol(cur_part, NULL, 16);
				cur_part -= 2;
				cur_part[3] = '\0';
				color.r = strtol(cur_part, NULL, 16);

				for (int i = 0; i < NUM_LEDS; i++) {
					leds[i] = color;
				}

				FastLED.show(get_scale());
			}
		}

		void handle_serial(const String serial_data[MAX_ARG_LEN]) {
			FastLED.showColor(CRGB::Black);

			iterate_fn = do_iteration;
			mode_update_time = 0;
			mode = Modes::LED_MODE_PRIMED;
		}
	}
}

namespace serial_control {
	int parse_serial(const String str, String data[MAX_ARG_LEN]) {
		int data_index = 0;
		String current_word = "";

		const char* c_str = str.c_str();
		for (int i = 0; i < str.length(); i++) {
			if (c_str[i] == ' ') {
				if (data_index > MAX_ARG_LEN) return MAX_ARG_LEN;
				data[data_index++] = current_word;
				current_word = "";
			} else {
				current_word += c_str[i];
			}
		}
		data[data_index++] = current_word;
		data[data_index++] = "";
		return data_index - 1;
	}

	bool checksum_serial(String serial_data[MAX_ARG_LEN], int length) {
		return serial_data[0][0] == '/' && serial_data[length - 1][0] == '\\';
	}

	void handle_serial(const String str) {
		String serial_data[MAX_ARG_LEN];
		int length = parse_serial(str, serial_data);

		if (!checksum_serial(serial_data, length)) {
			return;
		}

		if (serial_data[1] == "off") {
			Modes::Off::handle_serial(serial_data);
		} else if (serial_data[1] == "solid") {
			Modes::Solid::handle_serial(serial_data);
		} else if (serial_data[1] == "dot") {
			Modes::Dot::handle_serial(serial_data);
		} else if (serial_data[1] == "split") {
			Modes::Split::handle_serial(serial_data);
		} else if (serial_data[1] == "pattern") {
			Modes::Pattern::handle_serial(serial_data);
		} else if (serial_data[1] == "prime" ){
			Modes::Prime::handle_serial(serial_data);
		} else if (serial_data[1] == "leds") {
			Serial.println(NUM_LEDS);
		}
	}

	void recv_with_end_marker() {
		static byte ndx = 0;
		char endMarker = '\n';
		char rc;
	
		while (Serial.available() > 0 && new_data == false) {
			rc = Serial.read();

			if (rc != endMarker) {
				received_chars[ndx] = rc;
				ndx++;
				if (ndx >= MAX_ARG_LEN) {
					ndx = MAX_ARG_LEN - 1;
				}
			}
			else {
				received_chars[ndx] = '\0'; // terminate the string
				ndx = 0;
				new_data = true;
			}
		}
	}
}

unsigned long last_run = millis() - 1;
void loop() {
	serial_control::recv_with_end_marker();
	if (iterate_fn == NULL) {
		iterate_fn = Modes::Off::do_iteration;
		mode_update_time = Modes::Off::update_time;
	}
	if (new_data) {
		serial_control::handle_serial(received_chars);
	}
	if (new_data || mode_update_time == 0 || millis() - last_run >= mode_update_time) {
		last_run = millis();
		iterate_fn();
		new_data = false;
	}
}

// / dot 0 0 255 3 50 1 50 255 0 0 \
// / dot 0 0 255 3 50 0 50 255 0 0 \
// / solid 255 0 0 \
// / split 10 1 0 0 255 255 0 0 255 0 255 0 255 0 \
// / pattern 10 1 255 0 0 255 128 0 255 255 0 128 255 0 0 255 0 0 255 128 0 255 255 0 128 255 0 0 255 128 0 255 255 0 255 255 0 128 \

// / pattern 50 1 255 0 0 0 255 0 0 0 255 \
