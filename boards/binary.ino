#define DEFAULT_VALUE 0
#define SECRET_KEY String("SECRET_KEY")
#define KEY_NAME "lights.room.0"
#define OUT_PIN D1
#define INVERT 0

#include <Arduino.h>
#include <string.h>
#include <ESP8266WiFi.h>
#include <ESP8266WiFiMulti.h>
#include <ESP8266HTTPClient.h>
#include <WebSocketsClient.h>
#include <WiFiClient.h>

using namespace std;

ESP8266WiFiMulti WiFiMulti;
WebSocketsClient webSocket;

int value = DEFAULT_VALUE;
String auth_id;
String auth_key;

void general_setup() {
	pinMode(LED_BUILTIN, OUTPUT);
	pinMode(OUT_PIN, OUTPUT);
	digitalWrite(LED_BUILTIN, LOW);
	digitalWrite(OUT_PIN, DEFAULT_VALUE ? HIGH : LOW);

	Serial.begin(9600);

	Serial.println();
	Serial.println();
	Serial.println();
}

void wifi_setup() {
	for (uint8_t t = 4; t > 0; t--) {
		Serial.printf("[SETUP] WAIT %d...\n", t);
		Serial.flush();
		delay(1000);
	}

	WiFi.mode(WIFI_STA);
	WiFiMulti.addAP("***REMOVED***", "***REMOVED***");
}

void ws_setup() {
	webSocket.begin("***REMOVED***", 80, "/keyval");
    webSocket.onEvent(ws_event);
	webSocket.setReconnectInterval(5000);
}

void await_wifi() {
	while (WiFiMulti.run() != WL_CONNECTED) {
		delay(1000);
	}
}

int* str_to_nums(String str) {
	const char* c_str = str.c_str();
	int* num_arr = (int*) malloc(sizeof(int) * str.length());
	for (int i = 0; i < str.length(); i++) {
		num_arr[i] = c_str[i] - 48;
	}
	return num_arr;
}

String create_secret(String id) {
	String secret = String("");
	int* id_arr = str_to_nums(id);

	for (int i = 0; i < SECRET_KEY.length(); i++) {
		int secret_key_char = (int)SECRET_KEY.c_str()[i];
		for (int j = 0; j < id.length(); j++) {
			secret_key_char = secret_key_char ^ id_arr[j];
		}
		char* buffer = (char*) malloc(sizeof(char) * 20);
		itoa(secret_key_char, buffer, 10);
		secret += String(buffer);
		free(buffer);
	}

	free(id_arr);
	return secret;
}

void setup() {
	general_setup();
	wifi_setup();
	ws_setup();
}

void set(int value) {
	if (INVERT) {
		value = !value;
	}
	digitalWrite(OUT_PIN, value ? HIGH : LOW);
	digitalWrite(LED_BUILTIN, value ? LOW : HIGH);
}

void on_value(int new_value) {
	int old_value = value;
	if (old_value != new_value) {
		Serial.printf("Different values %d, %d\n", old_value, new_value);
		set(new_value);
	} else {
		Serial.printf("Same values %d, %d\n", old_value, new_value);
	}

	value = new_value;
}

void send_data(const char* type, const char* data) {
	char* buffer = (char*) malloc(sizeof(char) * 500);
	strcpy(buffer, type);
	strcat(buffer, " ");
	strcat(buffer, data);

	Serial.printf("Sending \"%s\"\n", buffer);
	webSocket.sendTXT(buffer, strlen(buffer));
	free(buffer);
}

void send_auth(String id) {
	// Send auth key back
	String secret = create_secret(id);
	Serial.printf("Sending auth\n");
	send_data("auth", secret.c_str());
}

char* get_type(char* payload) {
	int i;
	char* type = (char*) malloc(sizeof(char) * 500);
	for (i = 0; i < strlen(payload); i++) {
		if (payload[i] == ' ') {
			break;
		}
		type[i] = payload[i];
	}
	type[i] = '\0';
	return type;
}

char* get_data(char* payload) {
	int i;
	int j = 0;
	bool found_space = false;
	char* data = (char*) malloc(sizeof(char) * 500);
	for (i = 0; i < strlen(payload); i++) {
		if (found_space) {
			data[j] = payload[i];
			j++;
		}
		if (payload[i] == ' ') {
			found_space = true;
		}
	}
	data[j] = '\0';
	return data;
}

void handle_msg(char* payload) {
	char* type = get_type(payload);
	char* data = get_data(payload);
	if (strcmp(type, "authid") == 0) {
		send_auth(String(data));
	} else if (strcmp(type, "authfail") == 0) {
		Serial.printf("Auth failed");
		webSocket.disconnect();
	} else if (strcmp(type, "authsuccess") == 0) {
		Serial.printf("Auth success\n");
		Serial.printf("Sending listen\n");
		send_data("listen", KEY_NAME);
	} else if (strcmp(type, "valChange") == 0) {
		on_value(atoi(data));
	} else {
		Serial.printf("Unknown message %s, %s\n", type, data);
	}
	free(type);
	free(data);
}

void ws_event(WStype_t type, uint8_t * payload, size_t length) {
	switch(type) {
		case WStype_DISCONNECTED:
			Serial.printf("[WSc] Disconnected!\n");
			break;
		case WStype_CONNECTED:
			Serial.printf("[WSc] Connected to url: %s\n", payload);
			break;
		case WStype_TEXT:
			Serial.printf("[WSc] get text: %s\n", payload);
			handle_msg((char*) payload);
			break;
		default:
			Serial.printf("[WSc] Unknown msg");
			break;
    }
}

void loop() {
	webSocket.loop();
}
