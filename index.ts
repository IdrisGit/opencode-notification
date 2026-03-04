import path from "node:path";
import type { Plugin } from "@opencode-ai/plugin";
import { createNotificationQueue } from "@/notification-queue";

export const SimpleNotificationPlugin: Plugin = async ({ client }) => {
	const queue = createNotificationQueue();
	// Tracks sessions where assistant has responded since last user message
	const activeSessions = new Map<string, boolean>();

	const cancelForSession = (sessionId: string) => {
		queue.cancelForSession(sessionId);
		activeSessions.delete(sessionId);
	};

	return {
		event: async ({ event }) => {
			switch (event.type) {
				case "session.idle": {
					const sessionId = event.properties.sessionID;
					if (activeSessions.get(sessionId)) {
						const title = await client.session
							.get({ path: { id: sessionId } })
							.then((details) => details.data?.title)
							.catch(() => undefined);
						queue.schedule(sessionId, "Response ready", title ?? sessionId);
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
						queue.schedule(sessionId, "Session error", message ?? sessionId);
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
					queue.schedule(
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
					queue.schedule(
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

				case "message.part.updated": {
					const part = event.properties.part;
					const sessionId = part.sessionID;
					const partType = part.type;
					if (partType === "text" || partType === "reasoning") {
						activeSessions.set(sessionId, true);
					}
					break;
				}

				case "message.updated": {
					const info = event.properties.info;
					if (info.role === "user") {
						cancelForSession(info.sessionID);
					}
					break;
				}

				case "session.status": {
					const status = event.properties.status;
					const sessionId = event.properties.sessionID;
					if (status.type === "busy") {
						cancelForSession(sessionId);
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
			queue.cancelAll();
			activeSessions.clear();
		},
	};
};
