#define DEFAULT_VALUE 0
#define SECRET_KEY String("***REMOVED***")
#define KEY_NAME "room.speakers.couch"
#define OUT_PIN D1
#define INVERT 0

#include <Arduino.h>
#include <string.h>
#include <ESP8266WiFi.h>
#include <ESP8266WiFiMulti.h>
#include <ESP8266HTTPClient.h>
#include <ESP8266WebServer.h>
#include <WiFiClient.h>

using namespace std;

ESP8266WiFiMulti WiFiMulti;
ESP8266WebServer server(80);

String ipToString(IPAddress ip){
	String s = "";
	for (int i = 0; i < 4; i++)
		s += i  ? "." + String(ip[i]) : String(ip[i]);
	return s;
}

void await_wifi() {
	while (WiFiMulti.run() != WL_CONNECTED) {
		delay(1000);
	}
}

void(*_handler)(String event, String type, String data);

void handle_request() {
	String arg = server.arg(0);
	Serial.printf("Got a request with arg \"%s\"\n", arg.c_str());
	int spaces = 0;

	String type = "";
	String data = "";
	for (int i = 0 ; i < arg.length(); i++) {
		if (arg.c_str()[i] == ' ') {
			spaces++;
			continue;
		}
		if (spaces == 0) {
			type += String(arg.c_str()[i]);
		} else if (spaces == 1) {
			data += String(arg.c_str()[i]);
		}
	}

	_handler("message", type, data);
	server.send(200, "text/plain", "OK");
}

class SemiWebSocket {
	private:
		String _ws_id;
		bool _connected;
		int _refresh_interval;
		int _ping_interval;
		unsigned long _last_refresh;
		unsigned long _last_ping;

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

		void _create_server() {
			await_wifi();
			server.on("/ws", handle_request);
			server.begin();
		}

		void _close() {
			_handler("closed", "", "");
			_connected = false;
		}

		void _ping() {
			send_message("ping", "");
			_last_ping = millis();
		}
	public:
		void connect() {
			// wait for WiFi connection
			await_wifi();

			HTTPClient http;
			http.setTimeout(2000);
			http.begin("***REMOVED***", 80, "/keyval/websocket");
			http.addHeader("Content-Type", "application/json");

			String data = String("{\"auth\": \"");
			
			data += SECRET_KEY;
			data += "\"";
			data += ", \"ip\": \"";
			data += ipToString(WiFi.localIP());
			data += "\"}";

			int httpCode = http.POST(data);
			if(httpCode > 0) {
				if(httpCode == 200) {
					_ws_id = http.getString();
					_connected = true;
					Serial.printf("Got id %s\n", _ws_id.c_str());
					_handler("connected", "", "");
				} else  {
					Serial.printf("Got err code %d and msg\n", httpCode, http.getString().c_str());
					_close();
				}
			} else {
				Serial.printf("Got sending error %s\n", http.errorToString(httpCode).c_str());
				_close();
			}
			_last_refresh = millis();
			_last_ping = millis();
			http.end();
		}

		void start_server() {
			await_wifi();
			_create_server();
		}

		SemiWebSocket(void(*handler)(String event, String type, String data), 
					  int refresh_interval, int ping_interval) {
			_handler = handler;
			_refresh_interval = refresh_interval;
			_ping_interval = ping_interval;
		}

		void send_message(String type, String data) {
			// wait for WiFi connection
			await_wifi();

			HTTPClient http;
			http.setTimeout(2000);
			http.begin("***REMOVED***", 80, "/ws");
			http.addHeader("Content-Type", "text/plain");

			String body = _ws_id + " " + type + " " + data;
			int httpCode = http.POST(body);
			if(httpCode > 0) {
				if(httpCode != 200) {
					Serial.printf("Got err code %d and msg\n", httpCode, http.getString().c_str());
					_close();
				}
			} else {
				Serial.printf("Got sending error %s\n", http.errorToString(httpCode).c_str());
				_close();
			}
			http.end();
		}

		void loop() {
			server.handleClient();
			if (!_connected && millis() > _last_refresh + _refresh_interval) {
				connect();
			}
			if (_connected && millis() > _last_ping + _ping_interval) {
				_ping();
			}
		}
};

SemiWebSocket ws = SemiWebSocket(ws_event, 5000, 60 * 1000);
int value = DEFAULT_VALUE;

void set(int value) {
	digitalWrite(LED_BUILTIN, value ? LOW : HIGH);
	if (INVERT) {
		value = !value;
	}
	digitalWrite(OUT_PIN, value ? HIGH : LOW);
}

void general_setup() {
	pinMode(LED_BUILTIN, OUTPUT);
	pinMode(OUT_PIN, OUTPUT);
	set(DEFAULT_VALUE);

	Serial.begin(115200);

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

	WiFi.mode(WIFI_AP_STA);
	WiFiMulti.addAP("***REMOVED***", "***REMOVED***");
}

void setup() {
	general_setup();
	wifi_setup();
	await_wifi();
	Serial.printf("Listening on %s\n", ipToString(WiFi.localIP()).c_str());
	ws.start_server();
	ws.connect();
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


void handle_msg(String type, String data) {
	if (type == "valChange") {
		on_value(atoi(data.c_str()));
	} else {
		Serial.printf("Unknown message %s, %s\n", type.c_str(), data.c_str());
	}
}

void ws_event(String event, String type, String data) {
	if (event == "closed") {
		Serial.printf("[WSc] Disconnected!\n");
	} else if (event == "connected") {
		Serial.printf("[WSc] Connected\n");
		ws.send_message("listen", KEY_NAME);
	} else if (event == "message") {
		Serial.printf("[WSc] get text: %s %s\n", type.c_str(), data.c_str());
		handle_msg(type, data);
	} else {
		Serial.printf("[WSc] Unknown msg, %s\n", event.c_str());
	}
}

void loop() {
	ws.loop();
}
