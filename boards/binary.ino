#define DEFAULT_VALUE 0
//TODO: change
#define SECRET_KEY String("e1a4a738825ebaa5a2e8e235526e471bb678f64b4ee7ece596cd265644de2e7d083f22f6406fa3e5f88da04d5ea735eabad81334f8538fb4c42c2f0a05fd2cf6")
#define MAX_TIMEOUT 60
#define KEY_NAME String("lights.room.0")

#include <Arduino.h>
#include <string.h>

#include <ESP8266WiFi.h>
#include <ESP8266WiFiMulti.h>

#include <ESP8266HTTPClient.h>

#include <WiFiClient.h>

using namespace std;

ESP8266WiFiMulti WiFiMulti;
int value = DEFAULT_VALUE;
String auth_id;
String auth_key;

void general_setup() {
	pinMode(LED_BUILTIN, OUTPUT);
	digitalWrite(LED_BUILTIN, LOW);

	Serial.begin(9600);
	// Serial.setDebugOutput(true);

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

void await_wifi() {
	while (WiFiMulti.run() != WL_CONNECTED) {
		delay(1000);
	}
}

char* get(String url) {
	await_wifi();

	WiFiClient client;
	HTTPClient http;
	http.setTimeout((MAX_TIMEOUT + 10) * 1000);

	Serial.printf("Doing get request: \"%s\"\n", url.c_str());
	if (http.begin(client, url)) {
		int httpCode = http.GET();
		String result = http.getString();
		if (httpCode > 0 && (httpCode == HTTP_CODE_OK || httpCode == HTTP_CODE_MOVED_PERMANENTLY)) {
			Serial.printf("Result payload: %s\n", result.c_str());
			http.end();
			return strdup(result.c_str());
		} else {
			Serial.printf("[HTTP] GET... failed, error: %s\n", http.errorToString(httpCode).c_str());
		}
	} else {
		Serial.printf("[HTTP} Unable to connect\n");
	}
	http.end();
	return NULL;
}

char* post_json(String url, String payload) {
	await_wifi();

	WiFiClient client;
	HTTPClient http;

	Serial.printf("Doing post request: \"%s\" with payload \"%s\"\n", url.c_str(), payload.c_str());
	if (http.begin(client, url)) {
		http.addHeader("Content-Type", "application/json");
		int httpCode = http.POST(payload);
		String result = http.getString();
		http.end();
		if (httpCode > 0 && (httpCode == HTTP_CODE_OK || httpCode == HTTP_CODE_MOVED_PERMANENTLY)) {
			Serial.printf("Result payload: %s\n", result.c_str());
			return strdup(result.c_str());
		} else {
			Serial.printf("[HTTP] GET... failed, error: %s\n", http.errorToString(httpCode).c_str());
		}
	} else {
		Serial.printf("[HTTP} Unable to connect\n");
	}
	return NULL;
}

int* str_to_nums(String str) {
	const char* c_str = str.c_str();
	int* num_arr = (int*) malloc(sizeof(int) * str.length());
	for (int i = 0; i < str.length(); i++) {
		num_arr[i] = c_str[i] - 48;
	}
	return num_arr;
}

String createSecret(String id) {
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

void get_key() {
	char* id;
	do {
		id = post_json(String("http://***REMOVED***/authid"), String(""));
	} while (id == NULL);
	auth_id = String(id);
	free(id);
	auth_key = createSecret(auth_id);
	Serial.printf("Auth id: %s, auth key: %s\n", auth_id.c_str(), auth_key.c_str());
}

void setup() {
	general_setup();
	wifi_setup();
	get_key();
}

int do_request(int last_value) {
	// wait for WiFi connection
	String url = String();
	url += "http://***REMOVED***/keyval/long/req/";
	url += KEY_NAME;

	String payload = "{\"maxtime\": \"" + String(MAX_TIMEOUT) + "\",";
	payload += "\"expected\": \"" + String(last_value) + "\",";
	payload += "\"auth\": \"" + auth_key + "\",";
	payload += "\"id\": \"" + auth_id + "\"}";

	char* req_id = post_json(url, payload.c_str());
	if (req_id == NULL) {
		Serial.print("Getting new key because result was null\n");
		get_key();
		return last_value;
	};

	// Req id is valid, do long poll now
	char* result = get(String("http://***REMOVED***/keyval/long/req/") + String(req_id));
	if (result == NULL) {
		Serial.print("Getting new key because result was null\n");
		get_key();
		return last_value;
	};

	int result_num = String(result).toInt();
	free(result);
	Serial.printf("Got result: %d\n", result_num);
	return result_num;
}

void loop() {
	int old_value = value;
	int new_value = do_request(value);
	if (old_value != new_value) {
		Serial.printf("Different values %d, %d\n", old_value, new_value);
		if (new_value == 1) {
			digitalWrite(LED_BUILTIN, LOW);
		} else {
			digitalWrite(LED_BUILTIN, HIGH);
		}
	} else {
		Serial.printf("Same values %d, %d\n", old_value, new_value);
	}

	value = new_value;
}
