import type { Event } from "@opencode-ai/sdk";
import type { ResolvedConfig } from "@/config/resolver";
import { Notification } from "@/notification";

type EventType = Event["type"] | "permission.asked" | "permission.replied" | "question.asked";
type Schedule = (sessionId: string, title: string, message: string, eventType: EventType) => void;

interface PendingNotification {
	title: string;
	message: string;
	timeoutId: ReturnType<typeof setTimeout>;
}
interface NotificationScheduler {
	schedule: Schedule;
	cancelForSession: (sessionId: string) => void;
	cancelAll: () => void;
}

export function createNotificationScheduler(resolvedConfig: ResolvedConfig): NotificationScheduler {
	const pendingBySession = new Map<string, PendingNotification>();

	const schedule: Schedule = (sessionId, title, message, eventType) => {
		if (eventType && !resolvedConfig.isEnabled(eventType)) {
			return;
		}

		const existing = pendingBySession.get(sessionId);
		if (existing) {
			clearTimeout(existing.timeoutId);
		}

		const delay = resolvedConfig.getDelay(eventType);
		const timeoutId = setTimeout(() => {
			Notification.notify({ title, message });
			pendingBySession.delete(sessionId);
		}, delay);

		pendingBySession.set(sessionId, { title, message, timeoutId });
	};

	const cancelForSession = (sessionId: string): void => {
		const pending = pendingBySession.get(sessionId);
		if (pending) {
			clearTimeout(pending.timeoutId);
			pendingBySession.delete(sessionId);
		}
	};

	const cancelAll = (): void => {
		for (const pending of pendingBySession.values()) {
			clearTimeout(pending.timeoutId);
		}
		pendingBySession.clear();
	};

	return {
		schedule,
		cancelForSession,
		cancelAll,
	};
}
