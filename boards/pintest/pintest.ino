#include <Arduino.h>
#include <string.h>

void setup() {
	pinMode(D0, OUTPUT);
	pinMode(D1, OUTPUT);
	pinMode(D2, OUTPUT);
	pinMode(D3, OUTPUT);
	pinMode(D4, OUTPUT);
	pinMode(D5, OUTPUT);
	pinMode(D6, OUTPUT);
	pinMode(D7, OUTPUT);
	pinMode(D8, OUTPUT);

	Serial.begin(115200);

	Serial.println();
	Serial.println();
	Serial.println();
}

void loop() {
	digitalWrite(D0, HIGH);
	digitalWrite(D1, HIGH);
	digitalWrite(D2, HIGH);
	digitalWrite(D3, HIGH);
	digitalWrite(D4, HIGH);
	digitalWrite(D5, HIGH);
	digitalWrite(D6, HIGH);
	digitalWrite(D7, HIGH);
	digitalWrite(D8, HIGH);
	delay(1000);

	digitalWrite(D0, LOW);
	digitalWrite(D1, LOW);
	digitalWrite(D2, LOW);
	digitalWrite(D3, LOW);
	digitalWrite(D4, LOW);
	digitalWrite(D5, LOW);
	digitalWrite(D6, LOW);
	digitalWrite(D7, LOW);
	digitalWrite(D8, LOW);
	delay(1000);
}
