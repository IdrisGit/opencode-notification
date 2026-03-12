import path from "node:path";
import type { Plugin } from "@opencode-ai/plugin";
import { createNotificationScheduler } from "@/notification-scheduler";
import { loadConfig, ConfigError } from "@/config/loader";
import { createResolvedConfig } from "@/config/resolver";

export const SimpleNotificationPlugin: Plugin = async ({ client }) => {
	const config = await loadConfig().catch(async (error) => {
		const message =
			error instanceof ConfigError
				? `Notification plugin config error: ${error.message}`
				: `Notification plugin failed to load: ${error instanceof Error ? error.message : String(error)}`;
		await client.tui.showToast({ body: { message, variant: "error" } });
		throw error;
	});

	const resolvedConfig = createResolvedConfig(config);
	const scheduler = createNotificationScheduler(resolvedConfig);
	// Tracks sessions where assistant has responded since last user message
	const activeSessions = new Set<string>();
	// Tracks sessions interrupted explicitly by user command
	const interruptedSessions = new Set<string>();

	const cancelForSession = (sessionId: string) => {
		scheduler.cancelForSession(sessionId);
		activeSessions.delete(sessionId);
	};

	const markSessionInterrupted = (sessionId: string) => {
		interruptedSessions.add(sessionId);
		cancelForSession(sessionId);
	};

	const isDeniedReply = (response: unknown) => {
		const normalized = String(response ?? "")
			.trim()
			.toLowerCase();

		return (
			normalized.includes("deny") ||
			normalized.includes("reject") ||
			normalized.includes("interrupt") ||
			normalized.includes("cancel") ||
			normalized.includes("abort") ||
			normalized === "esc"
		);
	};

	return {
		event: async ({ event }) => {
			switch (event.type) {
				case "session.idle": {
					const sessionId = event.properties.sessionID;

					if (interruptedSessions.has(sessionId)) {
						interruptedSessions.delete(sessionId);
						activeSessions.delete(sessionId);
						return;
					}

					if (!activeSessions.has(sessionId)) return;

					const session = await client.session.get({ path: { id: sessionId } }).catch(() => null);
					const title = session?.data?.title ?? sessionId;

					scheduler.schedule(sessionId, "Response ready", title, "session.idle");
					activeSessions.delete(sessionId);
					return;
				}

				case "session.error": {
					const sessionId = event.properties.sessionID;
					if (!sessionId) return;

					const isAborted = event.properties.error?.name === "MessageAbortedError";

					if (isAborted) {
						markSessionInterrupted(sessionId);
						return;
					}

					const session = await client.session.get({ path: { id: sessionId } }).catch(() => null);
					const title = session?.data?.title ?? sessionId;
					scheduler.schedule(sessionId, "Session error", title, "session.error");
					return;
				}

				case "command.executed": {
					const sessionId = event.properties.sessionID;
					const commandName = event.properties.name;
					if (commandName === "session.interrupt") {
						markSessionInterrupted(sessionId);
					}
					return;
				}

				// @ts-ignore: SDK v1 doesn't have permission types yet
				case "permission.asked": {
					const sessionId = (event as { properties: { sessionID: string } }).properties.sessionID;
					const session = await client.session.get({ path: { id: sessionId } }).catch(() => null);
					const projectName = path.basename(session?.data?.directory ?? "");
					scheduler.schedule(
						sessionId,
						"Permission Asked",
						`${session?.data?.title} in ${projectName} needs permission`,
						"permission.asked",
					);
					return;
				}

				// @ts-ignore: SDK v1 doesn't have question types yet
				case "question.asked": {
					const sessionId = (event as { properties: { sessionID: string } }).properties.sessionID;
					const session = await client.session.get({ path: { id: sessionId } }).catch(() => null);
					const projectName = path.basename(session?.data?.directory ?? "");
					scheduler.schedule(
						sessionId,
						"Question",
						`${session?.data?.title} in ${projectName} has a question`,
						"question.asked",
					);
					return;
				}

				// @ts-ignore: SDK v1 doesn't have permission types yet
				case "permission.replied":
				// @ts-ignore: SDK v1 doesn't have question types yet
				case "question.replied": {
					const sessionId = (event as { properties: { sessionID: string } }).properties.sessionID;
					const response = (event as { properties: { response?: unknown } }).properties.response;
					if (isDeniedReply(response)) {
						markSessionInterrupted(sessionId);
					} else {
						cancelForSession(sessionId);
					}
					return;
				}

				case "message.updated": {
					const info = event.properties.info;

					if (info.role === "assistant") {
						if (info.error?.name === "MessageAbortedError") {
							markSessionInterrupted(info.sessionID);
							return;
						}
						activeSessions.add(info.sessionID);
					} else if (info.role === "user") {
						if (!info.agent && !info.model) {
							interruptedSessions.delete(info.sessionID);
							cancelForSession(info.sessionID);
						}
					}
					return;
				}

				case "message.part.updated": {
					const part = event.properties.part as {
						sessionID: string;
						type: string;
						state?: { status?: string; error?: string };
					};
					const isDismissed =
						part.state?.status === "error" &&
						part.state?.error?.toLowerCase().includes("dismissed");

					if (isDismissed && ["tool", "question", "permission"].includes(part.type)) {
						markSessionInterrupted(part.sessionID);
					}
					return;
				}

				case "session.status": {
					if (event.properties.status.type === "busy") {
						scheduler.cancelForSession(event.properties.sessionID);
					}
					return;
				}

				case "tui.prompt.append":
				case "tui.command.execute":
					return;
			}
		},

		destroy: () => {
			scheduler.cancelAll();
			activeSessions.clear();
			interruptedSessions.clear();
		},
	};
};
