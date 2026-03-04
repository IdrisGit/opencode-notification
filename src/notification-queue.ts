import { Notification } from "@/notification";

export const DELAY_MS = 10 * 1000;

export interface QueuedNotification {
	id: string;
	title: string;
	message: string;
	scheduledAt: number;
}

interface PendingNotification {
	queue: QueuedNotification[];
	timeoutId: ReturnType<typeof setTimeout> | null;
}

export interface NotificationQueue {
	schedule: (sessionId: string, title: string, message: string) => void;
	cancelForSession: (sessionId: string) => void;
	cancelAll: () => void;
	getPendingCount: () => number;
}

export function createNotificationQueue(): NotificationQueue {
	const pendingNotifications = new Map<string, PendingNotification>();

	const generateNotificationId = (): string => {
		return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
	};

	const showPendingNotifications = (sessionId: string): void => {
		const pending = pendingNotifications.get(sessionId);
		if (!pending || pending.queue.length === 0) {
			pendingNotifications.delete(sessionId);
			return;
		}

		// Show all queued notifications immediately (no delay between them)
		for (const notification of pending.queue) {
			Notification.notify({
				title: notification.title,
				message: notification.message,
			});
		}

		pendingNotifications.delete(sessionId);
	};

	const schedule = (sessionId: string, title: string, message: string): void => {
		const notification: QueuedNotification = {
			id: generateNotificationId(),
			title,
			message,
			scheduledAt: Date.now(),
		};

		let pending = pendingNotifications.get(sessionId);

		if (!pending) {
			pending = {
				queue: [notification],
				timeoutId: setTimeout(() => {
					showPendingNotifications(sessionId);
				}, DELAY_MS),
			};
			pendingNotifications.set(sessionId, pending);
		} else {
			pending.queue.push(notification);
		}
	};

	const cancelForSession = (sessionId: string): void => {
		const pending = pendingNotifications.get(sessionId);
		if (pending) {
			if (pending.timeoutId) {
				clearTimeout(pending.timeoutId);
			}
			pendingNotifications.delete(sessionId);
		}
	};

	const cancelAll = (): void => {
		for (const [, pending] of pendingNotifications) {
			if (pending.timeoutId) {
				clearTimeout(pending.timeoutId);
			}
		}
		pendingNotifications.clear();
	};

	const getPendingCount = (): number => {
		let count = 0;
		for (const [, pending] of pendingNotifications) {
			count += pending.queue.length;
		}
		return count;
	};

	return {
		schedule,
		cancelForSession,
		cancelAll,
		getPendingCount,
	};
}
