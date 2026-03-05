import { Notification } from "@/notification";

export const DELAY_MS = 10 * 1000;

interface PendingNotification {
	title: string;
	message: string;
	timeoutId: ReturnType<typeof setTimeout>;
}

export interface NotificationScheduler {
	schedule: (sessionId: string, title: string, message: string) => void;
	cancelForSession: (sessionId: string) => void;
	cancelAll: () => void;
}

export function createNotificationScheduler(): NotificationScheduler {
	const pendingBySession = new Map<string, PendingNotification>();

	const schedule = (sessionId: string, title: string, message: string): void => {
		const existing = pendingBySession.get(sessionId);
		if (existing) {
			clearTimeout(existing.timeoutId);
		}

		const timeoutId = setTimeout(() => {
			Notification.notify({ title, message });
			pendingBySession.delete(sessionId);
		}, DELAY_MS);

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
