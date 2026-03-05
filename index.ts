import path from "node:path";
import type { Plugin } from "@opencode-ai/plugin";
import { createNotificationScheduler } from "@/notification-scheduler";

export const SimpleNotificationPlugin: Plugin = async ({ client }) => {
	const scheduler = createNotificationScheduler();
	// Tracks sessions where assistant has responded since last user message
	const activeSessions = new Set<string>();

	const cancelForSession = (sessionId: string) => {
		scheduler.cancelForSession(sessionId);
		activeSessions.delete(sessionId);
	};

	return {
		event: async ({ event }) => {
			switch (event.type) {
				case "session.idle": {
					const sessionId = event.properties.sessionID;
					if (activeSessions.has(sessionId)) {
						const title = await client.session
							.get({ path: { id: sessionId } })
							.then((details) => details.data?.title)
							.catch(() => undefined);
						scheduler.schedule(sessionId, "Response ready", title ?? sessionId);
					}
					activeSessions.delete(sessionId);
					break;
				}

				case "session.error": {
					const sessionId = event.properties.sessionID;
					const message = sessionId
						? await client.session
								.get({ path: { id: sessionId } })
								.then((details) => details.data?.title)
								.catch(() => undefined)
						: (event.properties.error?.data.message as string);
					if (sessionId) {
						scheduler.schedule(sessionId, "Session error", message ?? sessionId);
					}
					break;
				}

				// @ts-ignore: SDK v1 doesn't have permission types yet
				case "permission.asked": {
					const evt = event as { properties: { sessionID: string } };
					const sessionId = evt.properties.sessionID;
					const session = await client.session
						.get({ path: { id: sessionId } })
						.then((details) => ({
							title: details.data?.title,
							directory: details.data?.directory,
						}))
						.catch(() => undefined);
					const projectName = path.basename(session?.directory ?? "");
					scheduler.schedule(
						sessionId,
						"Permission Asked",
						`${session?.title} in ${projectName} needs permission`,
					);
					break;
				}

				// @ts-ignore: SDK v1 doesn't have question types yet
				case "question.asked": {
					const evt = event as { properties: { sessionID: string } };
					const sessionId = evt.properties.sessionID;
					const session = await client.session
						.get({ path: { id: sessionId } })
						.then((details) => ({
							title: details.data?.title,
							directory: details.data?.directory,
						}))
						.catch(() => undefined);
					const projectName = path.basename(session?.directory ?? "");
					scheduler.schedule(
						sessionId,
						"Question",
						`${session?.title} in ${projectName} has a question`,
					);
					break;
				}

				// @ts-ignore: SDK v1 doesn't have permission types yet
				case "permission.replied":
				// @ts-ignore: SDK v1 doesn't have question types yet
				case "question.replied": {
					const evt = event as { properties: { sessionID: string } };
					const sessionId = evt.properties.sessionID;
					cancelForSession(sessionId);
					break;
				}

				case "message.updated": {
					const info = event.properties.info;
					if (info.role === "user") {
						// Only cancel for real user messages, not automatic system messages
						// System messages have 'agent' or 'model' fields
						const infoAny = info;
						const isAutomaticMessage = infoAny.agent || infoAny.model;
						if (!isAutomaticMessage) {
							cancelForSession(info.sessionID);
						}
					} else if (info.role === "assistant") {
						activeSessions.add(info.sessionID);
					}
					break;
				}

				case "session.status": {
					const status = event.properties.status;
					const sessionId = event.properties.sessionID;
					if (status.type === "busy") {
						scheduler.cancelForSession(sessionId);
					}
					break;
				}

				case "tui.prompt.append":
				case "tui.command.execute":
					// No sessionID in these events, can't cancel reliably
					break;
			}
		},

		destroy: () => {
			scheduler.cancelAll();
			activeSessions.clear();
		},
	};
};
