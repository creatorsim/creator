/**
 * Copyright 2018-2026 CREATOR Team.
 *
 * This file is part of CREATOR.
 *
 * CREATOR is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * CREATOR is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with CREATOR.  If not, see <http://www.gnu.org/licenses/>.
 */

import { Ajv } from "ajv";

// this HAS to use `with` or else Deno screams, and `with` is only supported on `TypeScript`, so...
import archSchema from "../../../docs/schema/architecture.json" with { type: "json" };

/**
 * Validates the architecture object w/ the architecture schema
 */
export function validateArchSchema(architectureObj: object): boolean {
    return validateSchema(architectureObj, archSchema);
}

/**
 * Validates an object against a JSON schema
 */
export function validateSchema(object: object, schema: object): boolean {
    // we need to do this, else the validator screams
    delete (schema as unknown as { $schema?: string }).$schema;

    try {
        const validator = new Ajv().compile(schema);
        return validator(object);
    }
    catch (error) {
        throw new Error(`Invalid JSON schema: ${error}`)
    }

}
