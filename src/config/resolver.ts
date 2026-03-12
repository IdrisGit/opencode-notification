import type { Event } from "@opencode-ai/sdk";
import type { Config, EventConfig } from "@/config/schema";

type EventType = Event["type"] | "permission.asked" | "permission.replied" | "question.asked";
const EVENT_CONFIG_MAP: Record<string, keyof Config | undefined> = {
	"session.idle": "response_ready",
	"session.error": "error",
	"permission.asked": "permission_asked",
	"question.asked": "question_asked",
};

export interface ResolvedConfig {
	readonly globalEnabled: boolean;
	isEnabled(eventType: EventType): boolean;
	getDelay(eventType: EventType): number;
}

export function createResolvedConfig(config: Config): ResolvedConfig {
	const globalEnabled = config.enabled;

	return {
		get globalEnabled() {
			return globalEnabled;
		},

		isEnabled(eventType: EventType): boolean {
			const configKey = EVENT_CONFIG_MAP[eventType];
			// TS infers config[keyof Config] as union; cast safe since Zod validates + configKey from EVENT_CONFIG_MAP
			const eventConfig: EventConfig | undefined = configKey
				? (config[configKey] as EventConfig)
				: undefined;

			if (eventConfig?.enabled) {
				return eventConfig.enabled;
			}

			return globalEnabled;
		},

		getDelay(eventType: EventType): number {
			const configKey = EVENT_CONFIG_MAP[eventType];
			// TS infers config[keyof Config] as union; cast safe since Zod validates + configKey from EVENT_CONFIG_MAP
			const eventConfig: EventConfig | undefined = configKey
				? (config[configKey] as EventConfig)
				: undefined;
			const delayMS = eventConfig?.delay ?? config.delay;

			return delayMS * 1000;
		},
	};
}
