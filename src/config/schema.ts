import * as z from "zod";

export const EventConfigSchema = z.object({
	enabled: z.boolean().default(true).describe("Enable notifications for this event type"),
	delay: z.number().optional().describe("Optional override for notification delay in seconds"),
});

export const ConfigSchema = z.object({
	delay: z.number().default(15).describe("Default notification delay in seconds"),
	enabled: z.boolean().default(true).describe("Master switch to enable/disable all notifications"),
	response_ready: EventConfigSchema.default({ enabled: true }).describe(
		"Notification when AI response is ready",
	),
	error: EventConfigSchema.default({ enabled: true }).describe("Notification on session error"),
	permission_asked: EventConfigSchema.default({ enabled: true }).describe(
		"Notification when permission is requested",
	),
	question_asked: EventConfigSchema.default({ enabled: true }).describe(
		"Notification when a question is asked",
	),
});

export type EventConfig = z.infer<typeof EventConfigSchema>;
export type Config = z.infer<typeof ConfigSchema>;
