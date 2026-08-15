#!/usr/bin/env python3
"""Validate a project.json instance for the WebDesk Growth Dashboard profile.

CORRECTED per external verification review (2026-08-05). The prior approach —
a `contracts/project-profile.schema.json` using JSON Schema `allOf` + `$ref`
against the base skill's canonical schema — does NOT work. `allOf` is an
INTERSECTION of constraints, not an override: an instance must still satisfy
every subschema in the `allOf` list, so the base schema's restrictive enums
(host_target, tech_stack.storage) could never actually be relaxed that way.
`templates/project.json.example` failed real validation as a direct result
(6 errors: 2 enum violations + 4 numeric fields holding string placeholders).

This script does it correctly:
  1. Load the base schema (../../../../../../_contracts/project-json.schema.json)
     from disk, read-only.
  2. Deep-copy it in memory (json.loads(json.dumps(...))) — the base schema
     FILE is never modified, only a runtime copy.
  3. Apply the patch operations listed in ../contracts/project-profile.schema.json's
     "base_schema_patches" array to the in-memory copy.
  4. Validate the target project.json against the PATCHED COPY using a small,
     dependency-free JSON Schema validator implemented below (no `jsonschema`
     package required — this script runs with the Python 3 standard library
     only, so it works fully offline with no network access and no pip install).
  5. Print every error found; exit 0 only if there are none.

Usage:
    python3 validate-project-profile.py [path/to/project.json]
    (defaults to ../templates/project.json.example if no path given)
"""
from __future__ import annotations

import copy
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROFILE_ROOT = HERE.parent
BASE_SCHEMA_PATH = PROFILE_ROOT / ".." / ".." / ".." / ".." / ".." / "_contracts" / "project-json.schema.json"
PATCH_SPEC_PATH = PROFILE_ROOT / "contracts" / "project-profile.schema.json"
DEFAULT_INSTANCE_PATH = PROFILE_ROOT / "templates" / "project.json.example"

DATETIME_RE = re.compile(
    r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$"
)
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
URI_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9+.-]*://[^\s]+$")


# ---------------------------------------------------------------------------
# Step 1-3: load base schema, deep-copy, apply documented patches
# ---------------------------------------------------------------------------

def load_json(path: Path) -> dict:
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def get_at_path(node: dict, path: list[str]):
    for key in path:
        node = node[key]
    return node


def apply_patches(base_schema: dict, patch_spec: dict) -> dict:
    """Return a NEW patched schema. base_schema is never mutated in place
    beyond this function's own deep copy (the caller already passes a copy,
    but we deep-copy again defensively so this function is safe to call
    more than once against the same loaded object)."""
    patched = copy.deepcopy(base_schema)
    new_field_schemas = patch_spec["new_field_schemas"]

    for op in patch_spec["base_schema_patches"]:
        kind = op["op"]
        path = op["path"]

        if kind == "append_enum":
            node = get_at_path(patched, path)
            if "enum" not in node:
                raise ValueError(f"append_enum target has no 'enum': {path}")
            if op["value"] not in node["enum"]:
                node["enum"].append(op["value"])

        elif kind == "add_property":
            parent = get_at_path(patched, path)
            value = op["value"]
            if isinstance(value, dict) and "$ref_new_field" in value:
                value = copy.deepcopy(new_field_schemas[value["$ref_new_field"]])
            parent[op["key"]] = value

        elif kind == "append_required":
            node = get_at_path(patched, path) if path else patched
            node.setdefault("required", [])
            if op["value"] not in node["required"]:
                node["required"].append(op["value"])

        else:
            raise ValueError(f"Unknown patch op: {kind!r}")

    return patched


# ---------------------------------------------------------------------------
# Step 4: a small, dependency-free JSON Schema validator.
# Supports exactly the keyword subset used by project-json.schema.json and
# this profile's patches: type, const, enum, required, properties, items,
# pattern, format (date-time / email / uri), minimum, maximum.
# Deliberately NOT a general-purpose JSON Schema engine — scoped to what this
# project's schemas actually use, so its behavior is easy to audit by reading
# this file top to bottom.
# ---------------------------------------------------------------------------

_TYPE_CHECKERS = {
    "string": lambda v: isinstance(v, str),
    "integer": lambda v: isinstance(v, int) and not isinstance(v, bool),
    "number": lambda v: isinstance(v, (int, float)) and not isinstance(v, bool),
    "boolean": lambda v: isinstance(v, bool),
    "object": lambda v: isinstance(v, dict),
    "array": lambda v: isinstance(v, list),
    "null": lambda v: v is None,
}


def _type_ok(value, type_name: str) -> bool:
    checker = _TYPE_CHECKERS.get(type_name)
    if checker is None:
        raise ValueError(f"Unsupported JSON Schema type in this validator: {type_name!r}")
    return checker(value)


def validate(instance, schema: dict, path: str = "$", errors: list[str] | None = None) -> list[str]:
    if errors is None:
        errors = []

    if "const" in schema:
        if instance != schema["const"]:
            errors.append(f"{path}: expected const {schema['const']!r}, got {instance!r}")
        return errors  # const is exhaustive for this validator's purposes

    if "enum" in schema:
        if instance not in schema["enum"]:
            errors.append(f"{path}: value {instance!r} not in enum {schema['enum']!r}")

    if "type" in schema:
        type_spec = schema["type"]
        type_names = type_spec if isinstance(type_spec, list) else [type_spec]
        if not any(_type_ok(instance, t) for t in type_names):
            errors.append(
                f"{path}: expected type {type_spec!r}, got "
                f"{type(instance).__name__} ({instance!r})"
            )
            return errors  # stop — further structural checks would be noise

    if isinstance(instance, str):
        if "pattern" in schema and not re.match(schema["pattern"], instance):
            errors.append(f"{path}: {instance!r} does not match pattern {schema['pattern']!r}")
        fmt = schema.get("format")
        if fmt == "date-time" and not DATETIME_RE.match(instance):
            errors.append(f"{path}: {instance!r} is not a valid date-time")
        elif fmt == "email" and not EMAIL_RE.match(instance):
            errors.append(f"{path}: {instance!r} is not a valid email")
        elif fmt == "uri" and not URI_RE.match(instance):
            errors.append(f"{path}: {instance!r} is not a valid uri")

    if isinstance(instance, (int, float)) and not isinstance(instance, bool):
        if "minimum" in schema and instance < schema["minimum"]:
            errors.append(f"{path}: {instance} < minimum {schema['minimum']}")
        if "maximum" in schema and instance > schema["maximum"]:
            errors.append(f"{path}: {instance} > maximum {schema['maximum']}")

    if isinstance(instance, dict):
        for required_key in schema.get("required", []):
            if required_key not in instance:
                errors.append(f"{path}: missing required property {required_key!r}")
        for key, subschema in schema.get("properties", {}).items():
            if key in instance:
                validate(instance[key], subschema, f"{path}.{key}", errors)

    if isinstance(instance, list) and "items" in schema:
        for i, item in enumerate(instance):
            validate(item, schema["items"], f"{path}[{i}]", errors)

    return errors


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> int:
    instance_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_INSTANCE_PATH

    if not BASE_SCHEMA_PATH.exists():
        print(f"FAIL: base schema not found at {BASE_SCHEMA_PATH}")
        print("This validator computes that path relative to its own location and never")
        print("reaches out to a URL — if this fails, the skill tree has moved or this")
        print("script was copied out of its expected location.")
        return 2

    base_schema = load_json(BASE_SCHEMA_PATH)
    patch_spec = load_json(PATCH_SPEC_PATH)
    instance = load_json(instance_path)

    patched_schema = apply_patches(base_schema, patch_spec)

    errors = validate(instance, patched_schema)

    # Also validate the new top-level field(s) against their standalone schemas,
    # independent of the patched base schema, as a second check.
    for field_key, field_schema in patch_spec["new_field_schemas"].items():
        if field_key == "vercel_execution" and "vercel_execution" in instance:
            validate(instance["vercel_execution"], field_schema, "$.vercel_execution", errors)
        if field_key == "project.project_profile" and "project" in instance and "project_profile" in instance["project"]:
            validate(
                instance["project"]["project_profile"],
                field_schema,
                "$.project.project_profile",
                errors,
            )

    print(f"Base schema:     {BASE_SCHEMA_PATH}")
    print(f"Patch spec:      {PATCH_SPEC_PATH}")
    print(f"Instance:        {instance_path}")
    print(f"Patches applied: {len(patch_spec['base_schema_patches'])}")
    print()

    if errors:
        print(f"FAIL — {len(errors)} error(s):")
        for err in errors:
            print(f"  - {err}")
        return 1

    print("PASS — instance validates against the patched schema, 0 errors.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
