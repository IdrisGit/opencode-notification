import * as z from "zod";
import { ConfigSchema } from "../src/config/schema";

const jsonSchema = z.toJSONSchema(ConfigSchema, {
	target: "draft-2020-12",
	unrepresentable: "throw",
});

const outputPath = `${import.meta.dir}/../schema/notification-plugin.json`;
await Bun.write(outputPath, JSON.stringify(jsonSchema, null, 2));
