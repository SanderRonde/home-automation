#define Serial1 Serial
#define Serial2 Serial

#include <Arduino.h>
#include <string.h>
#include <ESP8266WiFi.h>
#include <ESP8266WiFiMulti.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <Nextion.h>
#include "keypad_types.h"

#define SECRET_KEY String("***REMOVED***");

NexButton ceiling_on = NexButton(0, 2, "ce_on");
NexButton ceiling_off = NexButton(0, 6, "ce_off");
NexButton nightstand_on = NexButton(0, 7, "ns_on");
NexButton nightstand_off = NexButton(0, 8, "ns_off");
NexButton lamps_on = NexButton(0, 13, "l_on");
NexButton lamps_off = NexButton(0, 14, "l_off");
NexButton couch_on = NexButton(0, 9, "co_on");
NexButton couch_off = NexButton(0, 10, "co_off");
NexButton desk_on = NexButton(0, 11, "d_on");
NexButton desk_off = NexButton(0, 12, "d_off");
NexButton sound_on = NexButton(0, 15, "s_on");
NexButton sound_off = NexButton(0, 16, "s_off");

NexTouch *listen_list[] = {
	&ceiling_on,
	&ceiling_off,
	&nightstand_on,
	&nightstand_off,
	&lamps_on,
	&lamps_off,
	&couch_on,
	&couch_off,
	&desk_on,
	&desk_off,
	&sound_on,
	&sound_off,
	NULL
};

int send_request(String key, String value) {
	HTTPClient http;
	http.setTimeout(2000);

	String path = String("/keyval/");
	path += key;
	path += "/";
	path += value;

	http.begin("***REMOVED***", 80, path);
	http.addHeader("Content-Type", "application/json");

	String data = String("{\"auth\": \"");
	data += SECRET_KEY;
	data += "\"";
	data += "\"}";

	int httpCode = http.POST(data);
	if (httpCode > 0) {
		if (httpCode == 200) {
			http.end();
			return 1;
		} else  {
			http.end();
			return 0;
		}
	} else {
		http.end();
		return 0;
	}
}

void onPush(void* ptr) {
	descriptor_t* descr = (descriptor_t*) ptr;
	send_request(descr->key, String(descr->value));
};

descriptor_t* gen_descriptor(String key, STATE_t value) {
	descriptor_t* descriptor = (descriptor_t*) malloc(sizeof(descriptor_t));
	descriptor->key = key;
	descriptor->value = value;
	return descriptor;
};

void setup() {
	Serial.begin(9600);
	delay(500);
	
	ceiling_on.attachPush(onPush, (void*) gen_descriptor("lights.ceiling", ON));
	ceiling_off.attachPush(onPush, (void*) gen_descriptor("lights.ceiling", OFF));
	nightstand_on.attachPush(onPush, (void*) gen_descriptor("lights.nightstand", ON));
	nightstand_off.attachPush(onPush, (void*) gen_descriptor("lights.nightstand", OFF));
	lamps_on.attachPush(onPush, (void*) gen_descriptor("lights", ON));
	lamps_off.attachPush(onPush, (void*) gen_descriptor("lights", OFF));
	couch_on.attachPush(onPush, (void*) gen_descriptor("speakers.couch", ON));
	couch_off.attachPush(onPush, (void*) gen_descriptor("speakers.couch", OFF));
	desk_on.attachPush(onPush, (void*) gen_descriptor("speakers.desk", ON));
	desk_off.attachPush(onPush, (void*) gen_descriptor("speakers.desk", OFF));
	sound_on.attachPush(onPush, (void*) gen_descriptor("speakers", ON));
	sound_off.attachPush(onPush, (void*) gen_descriptor("speakers", OFF));
}

void loop() {
	nexLoop(listen_list);
	
}