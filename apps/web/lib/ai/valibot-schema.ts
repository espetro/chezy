import { toJsonSchema } from "@valibot/to-json-schema";
import { jsonSchema, type JSONSchema7, type Schema } from "ai";
import * as v from "valibot";

/**
 * Wrap a Valibot schema as an AI SDK `Schema`: emits JSON Schema to the
 * provider (valibot Standard Schema alone can't convert) and keeps valibot
 * validation on tool inputs.
 */
export function valibotSchema<S extends v.GenericSchema>(
  schema: S
): Schema<v.InferOutput<S>> {
  return jsonSchema<v.InferOutput<S>>(toJsonSchema(schema) as JSONSchema7, {
    validate: (value) => {
      const result = v.safeParse(schema, value);
      return result.success
        ? { success: true, value: result.output }
        : {
            success: false,
            error: new Error(
              result.issues.map((issue) => issue.message).join("; ")
            ),
          };
    },
  });
}
