#include <Arduino.h>
#include <string.h>
#include <ESP8266WiFi.h>
#include <ESP8266WiFiMulti.h>
#include <ESP8266HTTPClient.h>
#include <ESP8266WebServer.h>

void setup() {
	pinMode(A0, INPUT);
	Serial.begin(115200);

	Serial.println();
	Serial.println();
	Serial.println();
}

void loop() {
	Serial.println(analogRead(A0));
}