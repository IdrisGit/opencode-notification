import * as z from "zod";
import { CONFIG_FILE_NAME } from "@/config/constants";
import { ConfigSchema } from "@/config/schema";

// Read package.json to get version for schema $id
const packageJsonPath = `${import.meta.dir}/../package.json`;
const packageJson = await Bun.file(packageJsonPath).json();
const version = packageJson.version;

const jsonSchema = z.toJSONSchema(ConfigSchema, {
	io: "input",
	target: "draft-2020-12",
	unrepresentable: "throw",
});
const rootSchema = jsonSchema as z.core.JSONSchema.ObjectSchema;
rootSchema.properties ??= {};
rootSchema.properties.$schema = {
	type: "string",
	description: "JSON Schema URL for editor autocomplete and validation",
};

// Add $id with versioned URL for npm/unpkg CDN
// This allows users to reference specific schema versions
const schemaWithId = {
	$id: `https://unpkg.com/opencode-notification@${version}/schema/${CONFIG_FILE_NAME}`,
	...jsonSchema,
};

const outputPath = `${import.meta.dir}/../schema/${CONFIG_FILE_NAME}`;
const jsonString = `${JSON.stringify(schemaWithId, null, "\t")}\n`;
await Bun.write(outputPath, jsonString);

console.log(`Generated JSON schema: schema/${CONFIG_FILE_NAME} (version ${version})`);
