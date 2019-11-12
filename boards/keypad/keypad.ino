#include <Arduino.h>
#include <string.h>
#include <stdio.h>
#include <SoftwareSerial.h>
#include "keypad_types.h"
#include <Nextion.h>

/**
 * IR Data
 * Decode type = NEC = 3
 * 
 * Help			E17250AF
 * Power		E172E817
 * Menu			E17240BF
 * Esc			E1720AF5
 * Left			E1728877
 * Up			E172C837
 * Right		E17248B7
 * Down			E17228D7
 * Select		E1724CB3
 * Source		E17208F7
 * AutoImg		E172CC33
 * PC			E1729867
 * Video		E17258A7
 * VolUp		E17210EF
 * VolDown		E17220DF
 * KeyStoneUp	E17204FB
 * KeyStoneDown	E172847B
 * ZoomIn		E1724AB5
 * ZoomOut		E172CA35
 * Mute			E172946B
 * Blank		E1728C73
 * Presets		E17234CB
 * Resize		E1722CD3
 * Freeze		E172708F
 * Overscan		E172AC53
 * SuperMute	E1728A75
 * Custom		E172D42B
 */

#define DO_DIM 1
#define DIM_TIME 20
#define DIM_BRIGHTNESS 1
#define NORMAL_BRIGHTNESS 100

SoftwareSerial nextion(2, 3);
Nextion myNextion(nextion, 9600);

void setup() {
	Serial.begin(9600);
	myNextion.init();
}

instruction_t ids[] = {
	{ "", -1 },
	{ "", -1 },
	{ "room.lights.ceiling", 1 },
	{ "", -1 },
	{ "", -1 },
	{ "", -1 },
	{ "room.lights.ceiling", 0 },
	{ "room.lights.nightstand", 1 },
	{ "room.lights.nightstand", 0 },
	{ "room.speakers.couch", 1 },
	{ "room.speakers.couch", 0 },
	{ "room.speakers.desk", 1 },
	{ "room.speakers.desk", 0 },
	{ "room.lights", 1 },
	{ "room.lights", 0 },
	{ "room.speakers", 1 },
	{ "room.speakers", 0 }
};

const int SPLIT_LEN = 10;
char** split_string(String str) {
	char** strings = (char**) malloc(sizeof(char*) * SPLIT_LEN);
	for (int i = 0; i < SPLIT_LEN; i++) {
		strings[i] = NULL;
	}

	int str_index = 0;
	char* delim = { " " };
	char* ptr = strtok(str.c_str(), delim);
	while (ptr != NULL) {
		strings[str_index++] = strdup(ptr);
		ptr = strtok(NULL, delim);
	}

	return strings;
}

void free_split(char** strings) {
	for (int i = 0; i < SPLIT_LEN; i++) {
		if (strings[i] != NULL) {
			free(strings[i]);
		}
	}
	free(strings);
}

msg_t* parse_msg(String message) {
	char** split = split_string(message);
	msg_t* msg = (msg_t*) malloc(sizeof(msg_t));

	msg->event_type = strtol(split[0], NULL, 10);
	msg->screen = strtol(split[1], NULL, 10);
	msg->id = strtol(split[2], NULL, 16);
	msg->action = strtol(split[3], NULL, 10);
	msg->strings = split;
	
	return msg;
}

void free_msg(msg_t* msg) {
	free_split(msg->strings);
	free(msg);
}

void handle_click(msg_t* msg) {
	if (msg->id == NULL) return;

	instruction_t ins = ids[msg->id];
	if (ins.value == -1) return;

	Serial.print(ins.name);
	Serial.print(" ");
	Serial.println(ins.value);
}

unsigned long last_touch = 0;
bool is_dimmed = false;
bool enable_dimming = true;
void wake_screen() {
	if (!is_dimmed) return;
	Serial.println("# Waking screen");

	String dim = "sleep=0";
	myNextion.sendCommand(dim.c_str());
	is_dimmed = false;
}

void dim_screen() {
	if (is_dimmed) return;
	Serial.println("# Dimming screen");

	String dim = "sleep=1";
	myNextion.sendCommand(dim.c_str());
	is_dimmed = true;
}

void on_touch() {
	last_touch = millis();
	if (is_dimmed) {
		wake_screen();
	}
}

void check_dim() {
	if (!DO_DIM || !enable_dimming || is_dimmed) return;

	if (millis() - last_touch > DIM_TIME * 1000) {
		dim_screen();
	}
}

void handle_message(String message) {
	msg_t* msg = parse_msg(message);

	String log_msg = "# " + message;
	Serial.println(log_msg.c_str());

	if (msg->event_type == 65) {
		on_touch();
		handle_click(msg);
	}

	free_msg(msg);
}

void handle_serial(String str) {
	if (str == "1") {
		enable_dimming = false;
		wake_screen();
	} else if (str == "0") {
		enable_dimming = true;
		check_dim();
	}
}

void read_serial() {
	String str = "";
	while (Serial.available()) {
		str += String((char) Serial.read());
	}

	if (str != "") {
		handle_serial(str);
	}
}

void loop() {
	String message = myNextion.listen(); //check for message
	if (message != "") { // if a message is received...
		handle_message(message);
	}
	read_serial();
	check_dim();
}