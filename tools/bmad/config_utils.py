"""Shared strict TOML loading and structural merge support."""

from __future__ import annotations

import tomllib
from collections.abc import Iterable
from pathlib import Path
from typing import Any


class ConfigError(ValueError):
    """Raised when a present configuration layer cannot be used safely."""


_KEYED_MERGE_FIELDS = ("code", "id")


def contained_source(path: Path, directory: Path) -> Path:
    """Validate shipped source containment before reading it; overrides are separate."""
    root = directory.resolve(strict=True)
    resolved = path.resolve(strict=True)
    if not resolved.is_relative_to(root) or not resolved.is_file():
        raise ConfigError("shipped configuration is not contained regular source")
    return resolved


def load_toml(path: Path, *, required: bool = False) -> dict[str, Any]:
    """Load a TOML table, allowing absence only for optional layers."""
    if not path.exists() and not path.is_symlink():
        if required:
            raise ConfigError(f"required TOML file not found: {path}")
        return {}
    if not path.is_file():
        raise ConfigError(f"TOML layer is not a file: {path}")
    try:
        with path.open("rb") as stream:
            parsed = tomllib.load(stream)
    except tomllib.TOMLDecodeError as error:
        raise ConfigError(f"failed to parse {path}: {error}") from error
    except OSError as error:
        raise ConfigError(f"failed to read {path}: {error}") from error
    if not isinstance(parsed, dict):
        raise ConfigError(f"TOML layer did not parse to a table: {path}")
    _validate_layer(parsed)
    return parsed


def _detect_keyed_merge_field(items: list[Any]) -> str | None:
    if not items or not all(isinstance(item, dict) for item in items):
        return None
    for candidate in _KEYED_MERGE_FIELDS:
        if all(candidate in item for item in items):
            for item in items:
                value = item[candidate]
                if not isinstance(value, str):
                    raise ConfigError(
                        f"keyed array identifier `{candidate}` must be a string, got {type(value).__name__}"
                    )
                if not value:
                    raise ConfigError(f"keyed array identifier `{candidate}` must not be empty")
            return candidate
    return None


def _validate_layer(value: Any) -> None:
    """Reject duplicate identities inside a layer, never across override layers."""
    if isinstance(value, dict):
        for child in value.values():
            _validate_layer(child)
    elif isinstance(value, list):
        if value and all(isinstance(item, dict) for item in value):
            for keyed_field in _KEYED_MERGE_FIELDS:
                if not all(keyed_field in item for item in value):
                    continue
                seen: set[str] = set()
                for item in value:
                    key = item[keyed_field]
                    if not isinstance(key, str) or not key:
                        raise ConfigError(f"keyed array identifier `{keyed_field}` must be a non-empty string")
                    if key in seen:
                        raise ConfigError(f"duplicate keyed array identifier `{keyed_field}`")
                    seen.add(key)
        for child in value:
            _validate_layer(child)


def _merge_arrays(base: list[Any], override: list[Any]) -> list[Any]:
    keyed_field = _detect_keyed_merge_field(base + override)
    if keyed_field is None:
        return list(base) + list(override)

    result: list[Any] = []
    index_by_key: dict[str, int] = {}
    for item in base:
        copied = dict(item)
        index_by_key[copied[keyed_field]] = len(result)
        result.append(copied)
    for item in override:
        copied = dict(item)
        key = copied[keyed_field]
        if key in index_by_key:
            result[index_by_key[key]] = copied
        else:
            index_by_key[key] = len(result)
            result.append(copied)
    return result


def structural_merge(base: Any, override: Any) -> Any:
    """Merge tables recursively, keyed table arrays by identity, and append other arrays."""
    _validate_layer(base)
    _validate_layer(override)
    return _structural_merge(base, override)


def _structural_merge(base: Any, override: Any) -> Any:
    if isinstance(base, dict) and isinstance(override, dict):
        result = dict(base)
        for key, value in override.items():
            result[key] = _structural_merge(result[key], value) if key in result else value
        return result
    if isinstance(base, list) and isinstance(override, list):
        return _merge_arrays(base, override)
    return override


def merge_layers(layers: Iterable[dict[str, Any]]) -> dict[str, Any]:
    merged: dict[str, Any] = {}
    for layer in layers:
        merged = structural_merge(merged, layer)
    return merged


def load_central_config(project_root: Path) -> dict[str, Any]:
    bmad_dir = project_root / "_bmad"
    runtime_dir = Path(__file__).resolve(strict=True).parent
    defaults = load_toml(contained_source(runtime_dir / "config.toml", runtime_dir), required=True)
    _validate_central_config(defaults)
    merged = merge_layers(
        (
            defaults,
            load_toml(bmad_dir / "config.toml"),
            load_toml(bmad_dir / "custom" / "config.toml"),
            load_toml(bmad_dir / "custom" / "config.user.toml"),
        )
    )
    _validate_central_config(merged)
    return merged


def _validate_central_config(config: dict[str, Any]) -> None:
    core = config.get("core")
    if not isinstance(core, dict):
        raise ConfigError("core must be a table")
    output_folder = core.get("output_folder")
    if not isinstance(output_folder, str) or not output_folder.strip():
        raise ConfigError("core.output_folder must be a non-empty string")
    if not isinstance(core.get("active_initiative"), str):
        raise ConfigError("core.active_initiative must be a string")


def load_customization(project_root: Path | None, skill_dir: Path) -> dict[str, Any]:
    skill_name = skill_dir.name
    custom_dir = project_root / "_bmad" / "custom" if project_root else None
    return merge_layers(
        (
            load_toml(contained_source(skill_dir / "customize.toml", skill_dir), required=True),
            load_toml(custom_dir / f"{skill_name}.toml") if custom_dir else {},
            load_toml(custom_dir / f"{skill_name}.user.toml") if custom_dir else {},
        )
    )
