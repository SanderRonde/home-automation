#include <Arduino.h>
#include <string.h>
#include <stdio.h>
#include <SoftwareSerial.h>
#include "keypad_types.h"
#include <Nextion.h>

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
	{ "lights.ceiling", 1 },
	{ "", -1 },
	{ "", -1 },
	{ "", -1 },
	{ "lights.ceiling", 0 },
	{ "lights.nightstand", 1 },
	{ "lights.nightstand", 0 },
	{ "speakers.couch", 1 },
	{ "speakers.couch", 0 },
	{ "speakers.desk", 1 },
	{ "speakers.desk", 0 },
	{ "lights", 1 },
	{ "lights", 0 },
	{ "speakers", 1 },
	{ "speakers", 0 }
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

	String dim = "dim=" + String(NORMAL_BRIGHTNESS);
	myNextion.sendCommand(dim.c_str());
	is_dimmed = false;
}

void dim_screen() {
	if (is_dimmed) return;
	Serial.println("# Dimming screen");

	String dim = "dim=" + String(DIM_BRIGHTNESS);
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