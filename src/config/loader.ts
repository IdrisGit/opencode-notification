import { homedir } from "node:os";
import { ConfigSchema, type Config } from "@/config/schema";

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

export async function loadConfig(projectRoot?: string): Promise<Config> {
	const filePaths = await discoverConfigFiles(projectRoot);
	const configs: Record<string, unknown>[] = [];

	for (const filePath of filePaths) {
		try {
			const content = await Bun.file(filePath).json();
			if (content && typeof content === "object") {
				configs.push(content as Record<string, unknown>);
			}
		} catch {
			// Log config loading errors - these are typically file not found or JSON parse errors
			// which are recoverable (we'll use defaults)
		}
	}

	const mergedConfig = configs.reduce(
		(acc, config) => deepMerge(acc as Record<string, unknown>, config),
		{} as Record<string, unknown>,
	);

	try {
		return ConfigSchema.parse(mergedConfig);
	} catch (error) {
		// Config validation errors are logged but we continue with defaults
		// This ensures the plugin remains functional even with invalid config
		console.error("Config validation failed, using defaults:", error);
		return ConfigSchema.parse({});
	}
}
