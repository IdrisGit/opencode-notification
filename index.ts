import path from "node:path";
import type { Plugin } from "@opencode-ai/plugin";
import { Notification } from "@/notification";

export const SimpleNotificationPlugin: Plugin = async ({ client }) => {
  return {
    event: async ({ event }) => {
      switch (event.type) {
        case "session.idle": {
          const sesId = event.properties.sessionID;
          const message = await client.session
            .get({
              path: { id: sesId },
            })
            .then((details) => details.data?.title)
            .catch(() => undefined);

          Notification.notify({
            title: "Response ready",
            message: message ?? sesId,
          });

          break;
        }

        case "session.error": {
          const sesId = event.properties.sessionID;
          const message = sesId
            ? await client.session
                .get({
                  path: { id: sesId },
                })
                .then((details) => details.data?.title)
                .catch(() => undefined)
            : (event.properties.error?.data.message as string);

          Notification.notify({
            title: "Session error",
            message: message ?? sesId,
          });

          break;
        }

        // @ts-ignore: sdk version is not updated in the plugin
        case "permission.asked": {
          // @ts-ignore: sdk version is not updated in the plugin
          const sesId = event.properties.sessionID as string;
          const ses = await client.session
            .get({
              path: { id: sesId },
            })
            .then((details) => ({
              title: details.data?.title,
              directory: details.data?.directory,
            }))
            .catch(() => undefined);
          const projectName = path.basename(ses?.directory ?? "");

          Notification.notify({
            title: "Permission Asked",
            message: `${ses?.title} in ${projectName} needs permission`,
          });

          break;
        }

        // @ts-ignore: sdk version is not updated in the plugin
        case "question.asked": {
          // @ts-ignore: sdk version is not updated in the plugin
          const sesId = event.properties.sessionID;
          const ses = await client.session
            .get({
              path: { id: sesId },
            })
            .then((details) => ({
              title: details.data?.title,
              directory: details.data?.directory,
            }))
            .catch(() => undefined);
          const projectName = path.basename(ses?.directory ?? "");

          Notification.notify({
            title: "Question",
            message: `${ses?.title} in ${projectName} has a question`,
          });

          break;
        }
      }
    },
  };
};
