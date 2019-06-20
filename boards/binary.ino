#define DEFAULT_VALUE 0
#define SECRET_KEY String("SECRET_KEY")
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

void setup() {
	pinMode(LED_BUILTIN, OUTPUT);
	digitalWrite(LED_BUILTIN, LOW);

	Serial.begin(9600);
	// Serial.setDebugOutput(true);

	Serial.println();
	Serial.println();
	Serial.println();

	for (uint8_t t = 4; t > 0; t--) {
		Serial.printf("[SETUP] WAIT %d...\n", t);
		Serial.flush();
		delay(1000);
	}

	WiFi.mode(WIFI_STA);
	WiFiMulti.addAP("***REMOVED***", "***REMOVED***");

}

int do_request(int last_value) {
	// wait for WiFi connection
	if ((WiFiMulti.run() == WL_CONNECTED)) {

		WiFiClient client;

		HTTPClient http;
		http.setTimeout((MAX_TIMEOUT + 10) * 1000);

		String url = String();
		url += "http://***REMOVED***/long/";
		url += String(MAX_TIMEOUT) + "/";
		url += SECRET_KEY + "/";
		url += KEY_NAME + "/";
		url += String(last_value);
		Serial.printf("Sending request: %s\n", url.c_str());
		if (http.begin(client, url)) {  // HTTP
			int httpCode = http.GET();

			// httpCode will be negative on error
			if (httpCode > 0) {
				// HTTP header has been send and Server response header has been handled
				// file found at server
				if (httpCode == HTTP_CODE_OK || httpCode == HTTP_CODE_MOVED_PERMANENTLY) {
					String payload = http.getString();
					Serial.println(payload);
					return (int)payload.toInt();
				}
			} else {
				Serial.printf("[HTTP] GET... failed, error: %s\n", http.errorToString(httpCode).c_str());
			}

			http.end();
		} else {
			Serial.printf("[HTTP} Unable to connect\n");
		}
	}
	return last_value;
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
