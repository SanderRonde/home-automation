/**
 * System module types for server and process management.
 *
 * Commands are configured via the on-disk database file only (for security).
 * The web UI can only view the commands (read-only) and trigger them.
 */

/**
 * System commands that can be configured in the database.
 * These are shell commands that will be executed when triggered.
 */
export interface SystemCommands {
	/**
	 * Command to restart the server.
	 * Example: "systemctl restart home-automation"
	 */
	restartServer?: string;

	/**
	 * Command to stop the server.
	 * Example: "systemctl stop home-automation"
	 */
	stopServer?: string;

	/**
	 * Command to reboot the system.
	 * Example: "sudo reboot"
	 */
	rebootSystem?: string;

	/**
	 * Command to kill chromium processes (for kiosk mode).
	 * Example: "killall chromium" or path to kill-chromium.sh script
	 */
	killChromium?: string;
}

/**
 * Database schema for the system module.
 */
export interface SystemDB {
	/**
	 * Commands that can be executed from the web UI.
	 * These can only be configured by editing the database file directly.
	 */
	commands?: SystemCommands;
}

/**
 * Response type for the config endpoint.
 */
export interface SystemConfigResponse {
	commands: {
		restartServer: string | null;
		stopServer: string | null;
		rebootSystem: string | null;
		killChromium: string | null;
	};
}

/**
 * Response type for command execution.
 */
export interface CommandExecutionResponse {
	success: boolean;
	message: string;
	output?: string;
}
