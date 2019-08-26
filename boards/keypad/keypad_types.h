#include <string.h>

typedef enum STATE {
	ON = 1,
	OFF = 0
} STATE_t;

typedef struct descriptor {
	String key;
	STATE_t value;
} descriptor_t;

typedef struct msg {
	long event_type;
	long screen;
	long id;
	long action;
	char** strings;
} msg_t;

typedef struct instruction {
	char* name;
	int value;
} instruction_t;