import { homedir } from "node:os";
import { ConfigSchema, type Config } from "@/config/schema";

/**
 * Custom error class for configuration-related errors.
 */
export class ConfigError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ConfigError";
	}
}

/**
 * Recursively merges objects. Arrays are replaced, not merged.
 * Null/undefined values in source do not overwrite existing values.
 */
function deepMerge(
	target: Record<string, unknown>,
	source: Record<string, unknown>,
): Record<string, unknown> {
	if (source === null || typeof source !== "object") return target;
	if (Array.isArray(source)) return source;

	const result: Record<string, unknown> = { ...target };

	for (const key in source) {
		const sourceValue = source[key];
		const targetValue = result[key];

		if (
			sourceValue !== null &&
			typeof sourceValue === "object" &&
			!Array.isArray(sourceValue) &&
			targetValue !== null &&
			typeof targetValue === "object" &&
			!Array.isArray(targetValue)
		) {
			// Recursively merge nested objects
			result[key] = deepMerge(
				targetValue as Record<string, unknown>,
				sourceValue as Record<string, unknown>,
			);
		} else if (sourceValue !== undefined) {
			result[key] = sourceValue;
		}
	}

	return result;
}

/**
 * Discovers configuration files in order of precedence:
 * 1. Global config (XDG/AppData)
 * 2. Project root config
 * 3. .opencode config
 */
export async function discoverConfigFiles(projectRoot?: string): Promise<string[]> {
	const paths: string[] = [];

	// 1. Global config
	const globalPath =
		process.platform === "win32"
			? // Convert forward slashes to backslashes for Windows paths (e.g., "a/b" -> "a\b")
				`${process.env.APPDATA || homedir()}\\notification-plugin.json`.replace(/\//g, "\\") // windows
			: `${process.env.XDG_CONFIG_HOME || `${homedir()}/.config`}/notification-plugin.json`; // linux/macos

	if (await Bun.file(globalPath).exists()) {
		paths.push(globalPath);
	}

	// 2. Project root config
	if (projectRoot) {
		const projectPath = `${projectRoot}/notification-plugin.json`;
		if (await Bun.file(projectPath).exists()) {
			paths.push(projectPath);
		}

		// 3. .opencode config
		const dotOpenCodePath = `${projectRoot}/.opencode/notification-plugin.json`;
		if (await Bun.file(dotOpenCodePath).exists()) {
			paths.push(dotOpenCodePath);
		}
	}

	return paths;
}

/**
 * Loads and validates configuration from all discovered config files.
 * Configs are merged in order of discovery (lower precedence first).
 *
 * @throws {ConfigError} If a config file has invalid JSON or validation fails.
 *         This ensures the plugin fails fast on misconfiguration rather than
 *         silently using defaults.
 */
export async function loadConfig(projectRoot?: string): Promise<Config> {
	const filePaths = await discoverConfigFiles(projectRoot);
	const configs: Record<string, unknown>[] = [];

	for (const filePath of filePaths) {
		try {
			const content = await Bun.file(filePath).json();
			if (content && typeof content === "object") {
				configs.push(content as Record<string, unknown>);
			}
		} catch (error) {
			// JSON parse errors are fatal - user has a config file but it's broken
			if (error instanceof SyntaxError) {
				throw new ConfigError(`Invalid JSON in ${filePath}: ${error.message}`);
			}
			// Other errors (e.g., file not readable) are also fatal
			throw new ConfigError(
				`Failed to read config file ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	const mergedConfig = configs.reduce<Record<string, unknown>>(
		(acc, config) => deepMerge(acc, config),
		{},
	);

	try {
		return ConfigSchema.parse(mergedConfig);
	} catch (error) {
		// Zod validation errors - rethrow as ConfigError for consistent error handling
		const message = error instanceof Error ? error.message : String(error);
		throw new ConfigError(`Config validation failed: ${message}`);
	}
}
