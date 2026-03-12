import * as z from "zod";
import { ConfigSchema } from "../src/config/schema";

// Read package.json to get version for schema $id
const packageJsonPath = `${import.meta.dir}/../package.json`;
const packageJson = await Bun.file(packageJsonPath).json();
const version = packageJson.version;

const jsonSchema = z.toJSONSchema(ConfigSchema, {
	target: "draft-2020-12",
	unrepresentable: "throw",
});

// Add $id with versioned URL for npm/unpkg CDN
// This allows users to reference specific schema versions
const schemaWithId = {
	$id: `https://unpkg.com/opencode-notification@${version}/schema/notification-plugin.json`,
	...jsonSchema,
};

const outputPath = `${import.meta.dir}/../schema/notification-plugin.json`;
await Bun.write(outputPath, JSON.stringify(schemaWithId, null, 2));

console.log(`Generated JSON schema: schema/notification-plugin.json (version ${version})`);
