#include <string.h>

typedef enum STATE {
	ON = 1,
	OFF = 0
} STATE_t;

typedef struct descriptor {
	String key;
	STATE_t value;
} descriptor_t;