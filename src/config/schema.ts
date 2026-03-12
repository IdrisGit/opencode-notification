import * as z from "zod";

export const EventConfigSchema = z.object({
	enabled: z.boolean().default(true).describe("Enable notifications for this event type"),
	delay: z.number().optional().describe("Optional override for notification delay in milliseconds"),
});

export const ConfigSchema = z.object({
	delay: z.number().default(15000).describe("Default notification delay in milliseconds"),
	enabled: z.boolean().default(true).describe("Master switch to enable/disable all notifications"),
	response_ready: EventConfigSchema.default({ enabled: true }).describe(
		"Notification when AI response is ready (session.idle event)",
	),
	error: EventConfigSchema.default({ enabled: true }).describe("Notification on session error"),
	permission_asked: EventConfigSchema.default({ enabled: true }).describe(
		"Notification when permission is requested",
	),
	question_asked: EventConfigSchema.default({ enabled: true }).describe(
		"Notification when a question is asked",
	),
});

export type Config = z.infer<typeof ConfigSchema>;
