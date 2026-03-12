import type { Event } from "@opencode-ai/sdk";
import type { Config, EventConfig } from "@/config/schema";

type EventType = Event["type"] | "permission.asked" | "permission.replied" | "question.asked";
const EVENT_CONFIG_MAP: Record<string, keyof Config> = {
	"session.idle": "response_ready",
	"session.error": "error",
	"permission.asked": "permission_asked",
	"question.asked": "question_asked",
};

function isEventConfig(value: unknown): value is EventConfig {
	return typeof value === "object" && value !== null && "enabled" in value;
}

export interface ResolvedEventConfig {
	enabled: boolean;
	delay: number;
}

export interface ResolvedConfig {
	readonly globalEnabled: boolean;
	getEventConfig(eventType: EventType): ResolvedEventConfig;
	isEnabled(eventType: EventType): boolean;
	getDelay(eventType: EventType): number;
}

export function createResolvedConfig(config: Config): ResolvedConfig {
	return {
		get globalEnabled() {
			return config.enabled;
		},

		getEventConfig(eventType: EventType): ResolvedEventConfig {
			if (!config.enabled) {
				return { enabled: false, delay: config.delay };
			}

			const configKey = EVENT_CONFIG_MAP[eventType];
			const rawEventConfig = configKey ? config[configKey] : undefined;
			const eventConfig = isEventConfig(rawEventConfig) ? rawEventConfig : undefined;

			if (!eventConfig) {
				return { enabled: config.enabled, delay: config.delay };
			}

			return {
				enabled: eventConfig.enabled ?? true,
				delay: eventConfig.delay ?? config.delay,
			};
		},

		isEnabled(eventType: EventType): boolean {
			if (!config.enabled) {
				return false;
			}

			const configKey = EVENT_CONFIG_MAP[eventType];
			const rawEventConfig = configKey ? config[configKey] : undefined;
			const eventConfig = isEventConfig(rawEventConfig) ? rawEventConfig : undefined;

			return eventConfig?.enabled ?? config.enabled;
		},

		getDelay(eventType: EventType): number {
			const configKey = EVENT_CONFIG_MAP[eventType];
			const rawEventConfig = configKey ? config[configKey] : undefined;
			const eventConfig = isEventConfig(rawEventConfig) ? rawEventConfig : undefined;
			const delayMS = eventConfig?.delay ?? config.delay;

			return delayMS * 1000;
		},
	};
}
