type LogLevel = "debug" | "info" | "warn" | "error";
interface Logger {
	debug: (message: string, extra?: Record<string, unknown>) => void;
	info: (message: string, extra?: Record<string, unknown>) => void;
	warn: (message: string, extra?: Record<string, unknown>) => void;
	error: (message: string, extra?: Record<string, unknown>) => void;
}

function getLogFilePath(): string {
	const home = process.platform === "win32" ? Bun.env.USERPROFILE : Bun.env.HOME;
	return `${home}/.local/share/opencode/log/notification-plugin.log`;
}

const LOG_FILE = getLogFilePath();
export function createLogger(service: string): Logger {
	const log = async (level: LogLevel, message: string, extra?: Record<string, unknown>) => {
		const entry =
			JSON.stringify({
				timestamp: new Date().toISOString(),
				level,
				service,
				message,
				extra,
			}) + "\n";

		const file = Bun.file(LOG_FILE);
		const existing = (await file.exists()) ? await file.text() : "";
		await Bun.write(LOG_FILE, existing + entry);
	};

	return {
		debug: (message: string, extra?: Record<string, unknown>) => log("debug", message, extra),
		info: (message: string, extra?: Record<string, unknown>) => log("info", message, extra),
		warn: (message: string, extra?: Record<string, unknown>) => log("warn", message, extra),
		error: (message: string, extra?: Record<string, unknown>) => log("error", message, extra),
	};
}
