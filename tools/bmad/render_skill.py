#!/usr/bin/env python3
"""Render tracked BMAD sources into private, immutable local snapshots.

Requires Python >=3.11 and Jinja2 >=3.1, provisioned by the caller. No installer,
network access, or dependency installation is performed. Snapshots are local
loading artifacts, never public reports or exports.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import posixpath
import re
import shutil
import sys
from types import ModuleType

_HALT = "HALT: BMAD rendering failed.\n"
_last_failure: BaseException | None = None

if sys.version_info < (3, 11):
    sys.stdout.write(_HALT)
    raise SystemExit(1)

import tomllib
from datetime import date, time
from html import unescape
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlsplit
import unicodedata

# Runtime sources are not a location for interpreter caches.
sys.dont_write_bytecode = True

try:
    import jinja2
    from jinja2.sandbox import SandboxedEnvironment

    _jinja_version = tuple(int(part) for part in jinja2.__version__.split(".")[:2])
    if _jinja_version < (3, 1):
        raise RuntimeError("Jinja2 >=3.1 is required")
except Exception as error:
    _last_failure = error
    sys.stdout.write(_HALT)
    raise SystemExit(1) from error

try:
    _runtime_dir = Path(__file__).resolve(strict=True).parent
    _helper_source = _runtime_dir / "config_utils.py"
    if _helper_source.is_symlink():
        raise RuntimeError("config helper must not be a symlink")
    _helper_path = _helper_source.resolve(strict=True)
    if not _helper_path.is_relative_to(_runtime_dir) or not _helper_path.is_file():
        raise RuntimeError("config helper is not contained runtime source")
    _helper_bytes = _helper_path.read_bytes()
    _helper = ModuleType("bmad_config_utils")
    _helper.__file__ = str(_helper_path)
    _helper.__package__ = ""
    sys.modules[_helper.__name__] = _helper
    exec(compile(_helper_bytes, str(_helper_path), "exec"), _helper.__dict__)
    ConfigError = _helper.ConfigError
    load_central_config = _helper.load_central_config
    load_customization = _helper.load_customization
    load_toml = _helper.load_toml
    structural_merge = _helper.structural_merge
    contained_source = _helper.contained_source
except Exception as error:
    _last_failure = error
    sys.stdout.write(_HALT)
    raise SystemExit(1) from error


class RenderError(ValueError):
    """Raised when rendering cannot safely publish a snapshot."""


class _ArgumentParser(argparse.ArgumentParser):
    def error(self, message: str) -> None:
        raise RenderError(message)


_PARAMETER = r"[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*"


def _hash_bytes(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _canonical_json(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=_json_scalar).encode(
        "utf-8"
    )


def _json_scalar(value: Any) -> str:
    if isinstance(value, (date, time)):
        return value.isoformat()
    raise TypeError(f"unsupported JSON value: {type(value).__name__}")


def _toml_literal(text: str, label: str) -> Any:
    try:
        parsed = tomllib.loads(f"value = {text}")
    except tomllib.TOMLDecodeError as error:
        raise RenderError(f"invalid TOML value for {label}: {error}") from error
    if set(parsed) != {"value"}:
        raise RenderError(f"{label} must contain a single TOML value")
    return parsed["value"]


def _invocation_customization(
    defaults: dict[str, Any], overrides: Path | None, assignments: list[str]
) -> tuple[dict[str, Any], dict[str, Any]]:
    file_layer = load_toml(overrides, required=True) if overrides is not None else {}
    command_layer: dict[str, Any] = {}
    assigned: list[str] = []
    for assignment in assignments:
        path, separator, raw = assignment.partition("=")
        if not separator or re.fullmatch(_PARAMETER, path) is None:
            raise RenderError(f"invalid --set assignment {assignment!r}; expected bare dotted key=value")
        # A repeated or overlapping path is a caller mistake, not a precedence rule.
        for earlier in assigned:
            if path == earlier or path.startswith(f"{earlier}.") or earlier.startswith(f"{path}."):
                raise RenderError(f"--set `{path}` conflicts with earlier --set `{earlier}`")
        assigned.append(path)
        default = _lookup(defaults, path, "customization parameter")
        value = (
            raw if isinstance(default, str) and not raw.lstrip().startswith(('"', "'")) else _toml_literal(raw, path)
        )
        target = command_layer
        parts = path.split(".")
        for part in parts[:-1]:
            target = target.setdefault(part, {})
        target[parts[-1]] = value
    return file_layer, command_layer


def _leaf_paths(table: dict[str, Any], prefix: str = "") -> set[str]:
    leaves: set[str] = set()
    for key, value in table.items():
        path = f"{prefix}{key}"
        if isinstance(value, dict) and value:
            leaves |= _leaf_paths(value, f"{path}.")
        else:
            leaves.add(path)
    return leaves


def _declares(defaults: dict[str, Any], path: str) -> bool:
    node: Any = defaults
    for part in path.split("."):
        if not isinstance(node, dict) or part not in node:
            return False
        node = node[part]
    return True


def _check_persistent_layers(project_root: Path, skill_dir: Path, defaults: dict[str, Any] | None) -> None:
    """A persistent override may only set keys the skill declares; a stale or misspelled key halts."""
    custom_dir = project_root / "_bmad" / "custom"
    for layer in (custom_dir / f"{skill_dir.name}.toml", custom_dir / f"{skill_dir.name}.user.toml"):
        undeclared = sorted(path for path in _leaf_paths(load_toml(layer)) if not _declares(defaults or {}, path))
        if undeclared:
            raise RenderError(f"{layer} sets keys {skill_dir.name} does not declare: {', '.join(undeclared)}")


def _lookup(data: dict[str, Any], dotted_path: str, label: str) -> Any:
    current: Any = data
    for part in dotted_path.split("."):
        if not isinstance(current, dict) or part not in current:
            raise RenderError(f"missing {label} `{dotted_path}`")
        current = current[part]
    return current


def _require_string(value: Any, label: str, *, allow_empty: bool = False) -> str:
    if not isinstance(value, str):
        raise RenderError(f"{label} must be a string, got {type(value).__name__}")
    if not allow_empty and not value.strip():
        raise RenderError(f"{label} must not be empty")
    return value


def _require_string_list(value: Any, label: str) -> list[str]:
    if not isinstance(value, list):
        raise RenderError(f"{label} must be a list, got {type(value).__name__}")
    result = []
    for index, item in enumerate(value):
        result.append(_require_string(item, f"{label}[{index}]"))
    return result


def _require_review_layers(value: Any, label: str) -> list[dict[str, str]]:
    if not isinstance(value, list):
        raise RenderError(f"{label} must be a list of tables")
    result: list[dict[str, str]] = []
    seen: set[str] = set()
    for index, item in enumerate(value):
        item_label = f"{label}[{index}]"
        if not isinstance(item, dict):
            raise RenderError(f"{item_label} must be a table")
        identifier = _require_string(item.get("id"), f"{item_label}.id")
        if identifier in seen:
            raise RenderError(f"duplicate review layer id `{identifier}`")
        seen.add(identifier)
        layer = {
            "id": identifier,
            "name": _require_string(item.get("name", identifier), f"{item_label}.name"),
            "instruction": _require_string(item.get("instruction"), f"{item_label}.instruction", allow_empty=True),
        }
        if "when" in item:
            layer["when"] = _require_string(item["when"], f"{item_label}.when")
        result.append(layer)
    return result


def _load_sources(skill_dir: Path) -> dict[str, str]:
    sources: dict[str, str] = {}
    for candidate in sorted(skill_dir.rglob("*.md")):
        if candidate.name == "SKILL.md":
            continue
        name = candidate.relative_to(skill_dir).as_posix()
        path = candidate.resolve(strict=True)
        if not path.is_relative_to(skill_dir):
            raise RenderError(f"render source escapes skill directory: {name}")
        if not path.is_file():
            raise RenderError(f"render source is missing or not a file: {path}")
        try:
            sources[name] = path.read_text(encoding="utf-8")
        except (OSError, UnicodeError) as error:
            raise RenderError(f"failed to read render source {path}: {error}") from error
    if "workflow.md" not in sources:
        raise RenderError(f"render entry is missing: {skill_dir / 'workflow.md'}")
    return sources


def _resolve_config_value(value: Any, label: str, project_root: Path) -> str:
    text = _require_string(value, label, allow_empty=label == "config.core.active_initiative")
    expanded = text.replace("{project-root}", project_root.as_posix())
    portable = expanded.replace("\\", "/")
    key = label.rsplit(".", 1)[-1]
    if key in {"output_folder", "active_initiative"}:
        # These values are filesystem destinations, not arbitrary prose. Resolve
        # output paths against the checkout, never the caller's nested cwd.
        path = Path(portable)
        if not path.is_absolute() and ".." in portable.split("/"):
            raise RenderError("config path contains parent traversal")
        if portable.startswith(("~", "$HOME", "${HOME}", "%USERPROFILE%", "%HOMEPATH%")):
            raise RenderError("config path contains a home reference")
        if not path.is_absolute() and re.match(r"^[A-Za-z][A-Za-z0-9+.-]*:", portable):
            raise RenderError("config path contains a URI or drive-relative reference")
        if key == "active_initiative":
            # Initiatives are appended to output_folder. Preserve that base;
            # resolving them independently against the checkout would validate
            # a different target and miss symlinks inside the output directory.
            if path.is_absolute():
                raise RenderError("initiative must be an output-relative path")
            return posixpath.normpath(portable) if portable else ""
        resolved = (path if path.is_absolute() else project_root / path).resolve()
        if not resolved.is_relative_to(project_root):
            raise RenderError("consumed config path is outside repository")
        return resolved.relative_to(project_root).as_posix()
    if Path(portable).is_absolute():
        path = Path(portable).resolve()
        if not path.is_relative_to(project_root):
            raise RenderError("consumed config path is outside repository")
        return path.relative_to(project_root).as_posix()
    return _relative_text(expanded, project_root)


def _validate_output_destination(central: dict[str, Any], project_root: Path) -> None:
    core = central.get("core")
    if not isinstance(core, dict):
        raise RenderError("core configuration must be a table")
    output = _resolve_config_value(core.get("output_folder"), "config.core.output_folder", project_root)
    initiative = _resolve_config_value(core.get("active_initiative"), "config.core.active_initiative", project_root)
    if not (project_root / output / initiative).resolve().is_relative_to(project_root):
        raise RenderError("composed initiative destination is outside repository")


def _check_url_credentials(query: str, fragment: str) -> None:
    sensitive_keys = {
        "key", "code", "sig", "policy", "keypairid", "auth", "authorization",
        "authentication", "apikey", "accesskey", "privatekey", "jwt", "session",
        "sessionid", "cookie", "credential", "credentials", "password", "passwd",
        "pwd", "token", "secret",
    }
    for component in (query, fragment):
        decoded = component
        for _ in range(8):
            expanded = unicodedata.normalize("NFKC", unescape(unquote(decoded)))
            if expanded == decoded:
                break
            decoded = expanded
        else:
            raise RenderError("ambiguous encoded URI parameters")
        if "\\" in decoded:
            raise RenderError("ambiguous structured URI escape")
        # Include router fragments, HTML/semicolon separators and nested URL or
        # JSON parameters. Inspect decoded keys, never retain a credential value.
        for match in re.finditer(r"(?:^|[?&#;/{,])([^?&#;/{,=:]+)[=:]", decoded):
            key = "".join(character for character in match[1].casefold() if character.isalnum())
            if (
                key in sensitive_keys
                or key.startswith(("xamz", "xgoog"))
                or key.endswith(("token", "secret", "password", "signature", "credential", "credentials"))
            ):
                raise RenderError("credential-bearing URI parameters")


def _relative_text(text: str, project_root: Path) -> str:
    """Normalize canonical checkout tokens; reject machine paths, preserve public web links."""
    root = project_root.as_posix()
    home_prefix = r"(?:\$HOME|\$\{HOME\}|%USERPROFILE%|%HOMEPATH%)[/\\]"

    def reference(match: re.Match[str]) -> str:
        original = match.group()
        marker = match.group("marker")
        if marker is not None:
            # Classify complete emphasis/code contents, not a slash after a
            # glob-like delimiter. Keep markup and normalize only its contents.
            # A wrapper cannot span whitespace-separated references: otherwise
            # the literal `_bmad/` binding can capture a later emphasis marker.
            return marker + _relative_text(match.group("wrapped"), project_root) + marker
        if match.group("incomplete") is not None:
            marked_uri = match.group("marked_uri")
            if marked_uri is not None:
                # Multiword emphasis still contains a complete URI token. Run
                # the ordinary URI policy, including credential rejection,
                # without interpreting later words as part of its location.
                return match.group("incomplete") + _relative_text(marked_uri, project_root)
            raise RenderError("unrepresentable marked reference")
        # Consume actual XML closing tags as markup, not their leading slash.
        # This exact grammar cannot exempt an angle-delimited filesystem path
        # containing directory separators, drives, whitespace or backslashes.
        if re.fullmatch(r"</[A-Za-z_][A-Za-z0-9_.:-]*\s*>", original):
            return original
        # A lone slash is punctuation (or a placeholder separator), not a
        # machine location. Templates also describe "no leading `/`" literally.
        if original == "/":
            return original
        scheme = re.match(r"([A-Za-z][A-Za-z0-9+.-]*):", original)
        if scheme is not None and len(scheme[1]) != 1:
            # Consume the complete URI, not just its slashes. Only public web
            # references are prose, never file/unknown schemes or credentials.
            decoded = original
            for _ in range(8):
                expanded = unescape(decoded)
                if expanded == decoded:
                    break
                decoded = expanded
            else:
                raise RenderError("ambiguous encoded URI entities")
            uri = urlsplit(decoded)
            if (
                uri.scheme.lower() not in {"http", "https"}
                or not uri.netloc
                or not uri.hostname
                or uri.username is not None
                or uri.password is not None
                or "%" in uri.netloc
                or "\\" in decoded
            ):
                raise RenderError("unsupported URI reference")
            _check_url_credentials(uri.query, uri.fragment)
            return original
        if original.startswith(("~", "$HOME", "${HOME}", "%USERPROFILE%", "%HOMEPATH%")):
            raise RenderError("home-relative machine reference")
        portable = original.replace("\\", "/")
        normalized = posixpath.normpath(portable)
        # normpath preserves a POSIX double leading slash; checkout references do not.
        normalized = "/" + normalized.lstrip("/") if normalized.startswith("/") else normalized
        physical = Path(portable).resolve()
        if normalized == root or normalized.startswith(root + "/"):
            if re.search(r"[A-Za-z][A-Za-z0-9+.-]*:$", text[:match.start()]) is not None:
                raise RenderError("unsupported checkout URI")
            opening = text[match.start() - 1] if match.start() else ""
            closing = {"\"": "\"", "'": "'", "`": "`", "(": ")", "[": "]", "<": ">"}.get(opening)
            if closing is not None and text[match.end():match.end() + 1].isspace():
                end = text.find(closing, match.end())
                if end < 0 or text[match.end():end].strip():
                    raise RenderError("unrepresentable checkout reference")
            # Dot traversal through a symlink must not silently change target meaning.
            if physical.as_posix() != normalized:
                raise RenderError("ambiguous checkout reference")
            suffix = normalized[len(root):]
            return "." + suffix
        if physical.is_relative_to(project_root):
            raise RenderError("noncanonical checkout alias")
        if root in portable or (project_root.name in portable.split("/") and ".." in portable.split("/")):
            raise RenderError("unsafe checkout reference")
        raise RenderError("foreign machine reference")

    # Relative repository links (including placeholder-bound links) remain
    # usable. Absolute/home/drive tokens cannot fall through as arbitrary prose.
    # A delimiter-split foreign path rejects at its first fragment, before any
    # template/input identity or generation can be published.
    result = re.sub(
        r"</[A-Za-z_][A-Za-z0-9_.:-]*\s*>|"
        r"(?<![\w/\\}.*?+%-])(?P<marker>\*\*|__|\*|_|`+)"
        r"(?P<wrapped>[^\s]+?)(?P=marker)(?!\w)|"
        r"(?<![\w/\\}.*?+%-])(?P<incomplete>[*_`]+)"
        r"(?:(?P<marked_uri>[A-Za-z][A-Za-z0-9+.-]+:[/\\][^\s`\"'<>]*)|"
        rf"(?=[/\\~]|[A-Za-z]:|{home_prefix}))|"
        r"(?<![\w/\\}.*?+%-])(?:[A-Za-z][A-Za-z0-9+.-]+:[/\\][^\s`\"'<>]*|"
        r"(?:[A-Za-z]:|"
        rf"~[^\s/\\`\"'<>\[\](){{}};,]*[/\\]|{home_prefix}|"
        r"[/\\])[^\s`\"'<>\[\](){};,]*)",
        reference,
        text,
    )
    separators = r"[/\\]+(?:\.[/\\]+)*"
    root_pattern = separators.join(re.escape(part) for part in root.strip("/").split("/"))
    if root.startswith("/"):
        root_pattern = separators + root_pattern
    # A checkout spelling split by prose delimiters (for example spaces in a
    # directory name) is not a safely recognizable token: reject, do not guess.
    if re.search(root_pattern, result) is not None:
        raise RenderError("unrepresentable checkout reference")
    return result


def _relative_values(value: Any, project_root: Path) -> Any:
    if isinstance(value, str):
        return _relative_text(value, project_root)
    if isinstance(value, list):
        return [_relative_values(item, project_root) for item in value]
    if isinstance(value, dict):
        return {key: _relative_values(item, project_root) for key, item in value.items()}
    return value


def _find_config_values(data: Any, key: str, prefix: str = "") -> list[tuple[str, Any]]:
    matches: list[tuple[str, Any]] = []
    if not isinstance(data, dict):
        return matches
    for name, value in data.items():
        path = f"{prefix}.{name}" if prefix else name
        if name == key and not isinstance(value, (dict, list)):
            matches.append((path, value))
        matches.extend(_find_config_values(value, key, path))
    return matches


def _resolve_short_config(central: dict[str, Any], key: str, project_root: Path) -> tuple[str, str]:
    matches = _find_config_values(central, key)
    if not matches:
        raise RenderError(f"missing config value `{key}`")
    if len(matches) > 1:
        paths = ", ".join(path for path, _ in matches)
        raise RenderError(f"ambiguous config value `{key}` found at: {paths}")
    path, value = matches[0]
    return path, _resolve_config_value(value, f"config.{path}", project_root)


def _format_markdown_list(items: list[str]) -> str:
    if not items:
        return "_None._"
    rendered = []
    for item in items:
        lines = item.splitlines() or [""]
        rendered.append("- " + lines[0])
        rendered.extend("  " + line for line in lines[1:])
    return "\n".join(rendered)


def _format_review_layers(layers: list[dict[str, str]]) -> str:
    active = [layer for layer in layers if layer["instruction"].strip()]
    if not active:
        return "No active review layers. HALT with blocking condition `no active review layers`."
    sections = []
    for layer in active:
        section = [f"#### {layer['name']} (`{layer['id']}`)"]
        if layer.get("when"):
            section.extend(["", f"Run only when: {layer['when']}"])
        section.extend(["", layer["instruction"].strip()])
        sections.append("\n".join(section))
    return "\n\n".join(sections)


def _resolve_customization_value(value: Any, default: Any, label: str) -> Any:
    """Validate an effective customization leaf against the shape of its shipped default."""
    if isinstance(default, str):
        allow_empty = not default.strip()
        return _require_string(value, label, allow_empty=allow_empty)
    if isinstance(default, list):
        if default and all(isinstance(item, dict) for item in default):
            return _require_review_layers(value, label)
        return _require_string_list(value, label)
    if isinstance(default, (bool, int, float, date, time)):
        if type(value) is not type(default):
            raise RenderError(f"{label} must be {type(default).__name__}, got {type(value).__name__}")
        return value
    raise RenderError(f"{label} has unsupported default type {type(default).__name__}")


class _Text(str):
    """A customization string. Looping over one is a template mistake, not a walk over its characters."""

    def __new__(cls, value: str, label: str) -> _Text:
        text = super().__new__(cls, value)
        text.label = label
        return text

    def __iter__(self):
        raise RenderError(f"`{self.label}` is a string, not a list")


class _MarkdownList(list):
    """A string-list customization; inserted directly it renders as the Markdown list it always did."""

    def __str__(self) -> str:
        return _format_markdown_list(list(self))


class _LayerList(list):
    """A review-layer customization; inserted directly it renders as lens sections."""

    def __str__(self) -> str:
        return _format_review_layers(list(self))


def _bind_customization(value: Any, label: str, destination: Path) -> Any:
    """Bind `{skill-root}` in customization prose to the generation and wrap lists for insertion."""
    root = destination.as_posix()
    if isinstance(value, str):
        return _Text(value.replace("{skill-root}", root), label)
    if isinstance(value, list):
        if value and all(isinstance(item, dict) for item in value):
            return _LayerList(
                [{key: text.replace("{skill-root}", root) for key, text in layer.items()} for layer in value]
            )
        return _MarkdownList([item.replace("{skill-root}", root) for item in value])
    return value


class _Table:
    """A dotted namespace over a TOML table. Names never hit Python attributes, so `workflow.items` is a lookup."""

    def __init__(self, path: str) -> None:
        self._path = path

    def _child(self, name: str) -> str:
        return f"{self._path}.{name}"

    def _resolve(self, name: str) -> Any:
        raise NotImplementedError

    def __getattr__(self, name: str) -> Any:
        if name.startswith("_"):
            raise AttributeError(name)
        return self._resolve(name)

    def __getitem__(self, name: Any) -> Any:
        if not isinstance(name, str):
            raise RenderError(f"`{self._path}` is indexed by name, not {name!r}")
        return self._resolve(name)

    def __str__(self) -> str:
        raise RenderError(f"`{self._path}` is a table, not a value")


class _ConfigTable(_Table):
    """`config.key` is the short lookup of one scalar anywhere in the central config; `config.a.b.c` is a path."""

    def __init__(self, central: dict[str, Any], table: dict[str, Any], path: str, ctx: _RenderContext) -> None:
        super().__init__(path)
        self._central = central
        self._table = table
        self._ctx = ctx

    def _resolve(self, name: str) -> Any:
        if self._path == "config" and name not in self._table:
            path, resolved = _resolve_short_config(self._central, name, self._ctx.project_root)
            self._ctx.inputs[f"config.{path}"] = resolved
            return _Text(resolved, f"config.{path}")
        label = self._child(name)
        if name not in self._table:
            raise RenderError(f"missing config value `{label.removeprefix('config.')}`")
        value = self._table[name]
        if isinstance(value, dict):
            return _ConfigTable(self._central, value, label, self._ctx)
        resolved = _resolve_config_value(value, label, self._ctx.project_root)
        self._ctx.inputs[label] = resolved
        return _Text(resolved, label)


class _CustomizationTable(_Table):
    """The effective customization, each leaf validated against its `customize.toml` default."""

    def __init__(self, defaults: dict[str, Any] | None, values: dict[str, Any], path: str, ctx: _RenderContext) -> None:
        super().__init__(path)
        self._defaults = defaults
        self._values = values
        self._ctx = ctx

    def _resolve(self, name: str) -> Any:
        path = self._child(name)
        if self._defaults is None:
            raise RenderError(f"`{path}` requires customize.toml")
        if name not in self._defaults:
            raise RenderError(f"missing customization parameter `{path}`")
        if name not in self._values:
            raise RenderError(f"missing customization value `{path}`")
        default, value = self._defaults[name], self._values[name]
        label = f"customization.{path}"
        if isinstance(default, dict):
            if not isinstance(value, dict):
                raise RenderError(f"{label} must be a table, got {type(value).__name__}")
            return _CustomizationTable(default, value, path, self._ctx)
        resolved = _relative_values(_resolve_customization_value(value, default, label), self._ctx.project_root)
        self._ctx.inputs[label] = resolved
        return _bind_customization(resolved, label, self._ctx.destination)


class _RenderContext:
    """One rendering pass: the values it serves and the rendered() links each source makes."""

    def __init__(
        self,
        *,
        central: dict[str, Any],
        defaults: dict[str, Any] | None,
        customization: dict[str, Any],
        source_names: set[str],
        project_root: Path,
        destination: Path,
    ) -> None:
        self.project_root = project_root
        self.destination = destination.relative_to(project_root)
        self.inputs: dict[str, Any] = {}
        self.links: dict[str, set[str]] = {}
        self._source_names = source_names
        self.variables = {
            "config": _ConfigTable(central, central, "config", self),
            "workflow": _CustomizationTable(
                None if defaults is None else defaults.get("workflow", {}),
                customization.get("workflow", {}),
                "workflow",
                self,
            ),
            "rendered": self._rendered,
            "halt": self._halt,
        }

    @staticmethod
    def _halt(message: Any) -> str:
        """Let a template reject its inputs; the caller prefixes the source and line."""
        raise RenderError(str(message))

    @jinja2.pass_context
    def _rendered(self, context: jinja2.runtime.Context, target: Any) -> str:
        if not isinstance(target, str) or target not in self._source_names:
            raise RenderError(f"rendered() targets undeclared source: {target}")
        self.links.setdefault(context.name or "", set()).add(target)
        return (self.destination / target).as_posix()


class _SourceLoader(jinja2.BaseLoader):
    """Serve sources by name, and name them so template frames carry `source:line`."""

    def __init__(self, sources: dict[str, str]) -> None:
        self._sources = sources

    def get_source(self, environment: jinja2.Environment, template: str) -> tuple[str, str, Any]:
        if template not in self._sources:
            raise jinja2.TemplateNotFound(template)
        return self._sources[template], template, lambda: True


def _template_location(error: BaseException, source_names: set[str]) -> str | None:
    if isinstance(error, jinja2.TemplateSyntaxError):
        return f"{error.name}:{error.lineno}" if error.name else None
    location = None
    traceback = error.__traceback__
    while traceback is not None:
        filename = traceback.tb_frame.f_code.co_filename
        if filename in source_names:
            location = f"{filename}:{traceback.tb_lineno}"
        traceback = traceback.tb_next
    return location


def _render_sources(sources: dict[str, str], skill_dir: Path, context: _RenderContext) -> dict[str, str]:
    """Render every source as a Jinja2 template against the context; return the non-empty outputs."""
    # Skill sources name their bundled non-Markdown files (scripts, assets)
    # through {skill-root}; those stay in the installed skill directory.
    skill_reference = skill_dir.relative_to(context.project_root).as_posix()
    bound = {
        name: content.replace("{skill-root}", skill_reference)
        for name, content in sources.items()
    }
    environment = SandboxedEnvironment(
        loader=_SourceLoader(bound),
        undefined=jinja2.StrictUndefined,
        autoescape=False,
        keep_trailing_newline=True,
        trim_blocks=True,
        lstrip_blocks=True,
    )
    rendered: dict[str, str] = {}
    for name in sources:
        try:
            rendered[name] = environment.get_template(name).render(context.variables)
        except Exception as error:
            location = _template_location(error, set(sources))
            message = str(error) if isinstance(error, (RenderError, ConfigError, jinja2.TemplateError)) else repr(error)
            raise RenderError(f"{location or name}: {message}") from error
    # A source whose body renders to nothing is left out; links into it from survivors are broken.
    omitted = {name for name, text in rendered.items() if not text.strip()}
    if "workflow.md" in omitted:
        raise RenderError("workflow.md: rendered empty")
    for name in sorted(set(rendered) - omitted):
        for target in sorted(context.links.get(name, set()) & omitted):
            raise RenderError(f"{name}: rendered() targets omitted source: {target}")
    return {name: text for name, text in rendered.items() if name not in omitted}


def _verify_existing(destination: Path, manifest: dict[str, Any]) -> None:
    manifest_path = destination / "manifest.json"
    if manifest_path.is_symlink():
        raise RenderError("snapshot manifest is a symlink")
    try:
        existing = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise RenderError(f"corrupt existing generation {destination}: {error}") from error
    if existing != manifest:
        raise RenderError(f"generation collision or corruption at {destination}")
    # Only the manifest's own files are verified. Anything else in the folder (Thumbs.db,
    # editor swap files, sync conflict copies) is read by nobody and is left alone.
    missing = sorted(name for name in manifest["outputs"] if not (destination / name).is_file())
    if missing:
        raise RenderError(
            f"generation is missing rendered files: {', '.join(missing)} in {destination}; "
            "deleting that folder is safe because the next run renders it again"
        )
    for name, expected_hash in manifest["outputs"].items():
        output = destination / name
        if not output.resolve(strict=True).is_relative_to(destination):
            raise RenderError("snapshot output escapes generation")
        try:
            actual_hash = _hash_bytes(output.read_bytes())
        except OSError as error:
            raise RenderError(f"failed to verify {destination / name}: {error}") from error
        if actual_hash != expected_hash:
            raise RenderError(f"generation output hash mismatch: {destination / name}")


def _publish(destination: Path, outputs: dict[str, bytes], manifest: dict[str, Any]) -> None:
    project_root = Path(__file__).resolve(strict=True).parents[2]
    if not destination.is_relative_to(project_root / "_bmad" / "render"):
        raise RenderError("snapshot destination is outside runtime namespace")
    ancestor = destination
    while ancestor != project_root:
        if ancestor.is_symlink():
            raise RenderError("snapshot namespace contains a symlink")
        ancestor = ancestor.parent
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        _verify_existing(destination, manifest)
        return
    # One attempt, not mkdtemp: on Windows, older Pythons' mkdtemp takes "access denied"
    # for a name collision and tries the next name, some two billion times. The render
    # would hang in a folder it cannot write to instead of halting.
    staging = destination.parent / f".staging-{os.urandom(8).hex()}"
    staging.mkdir(mode=0o700)
    try:
        for name, content in outputs.items():
            path = staging / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
        (staging / "manifest.json").write_bytes(
            json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True, default=_json_scalar).encode("utf-8")
            + b"\n"
        )
        try:
            os.rename(staging, destination)
        except OSError:
            if destination.exists():
                _verify_existing(destination, manifest)
            else:
                raise
    finally:
        if staging.exists():
            shutil.rmtree(staging, ignore_errors=True)


def render(
    project_root: Path, skill_dir: Path, *, overrides: Path | None = None, assignments: list[str] | None = None
) -> Path:
    project_root = project_root.resolve(strict=True)
    repository_root = Path(__file__).resolve(strict=True).parents[2]
    if project_root != repository_root:
        raise RenderError("project root is not this runtime's repository")
    caller_cwd = Path.cwd().resolve(strict=True)
    if not caller_cwd.is_relative_to(project_root):
        raise RenderError("caller working directory is outside repository")
    allowed_skills = {
        project_root / "mydocs" / "skills" / name
        for name in ("bmad-build", "bmad-build-auto")
    }
    requested_skill = Path(os.path.abspath(skill_dir))
    if requested_skill not in allowed_skills:
        raise RenderError("skill is not a canonical BMAD entrypoint")
    skill_dir = requested_skill.resolve(strict=True)
    if (
        skill_dir != requested_skill
        or not skill_dir.is_relative_to(project_root)
        or not skill_dir.is_dir()
    ):
        raise RenderError("skill is not a canonical BMAD directory")

    sources = {name: _relative_text(content, project_root) for name, content in _load_sources(skill_dir).items()}
    for prompt in ("review-prompts/edge-case-hunter.md", "review-prompts/verification-gap.md"):
        if prompt not in sources or not sources[prompt].strip():
            raise RenderError("required review prompt is missing or empty")
    central = load_central_config(project_root)
    _validate_output_destination(central, project_root)
    customization_path = contained_source(skill_dir / "customize.toml", skill_dir)
    defaults = load_toml(customization_path, required=True)
    _check_persistent_layers(project_root, skill_dir, defaults)
    customization = load_customization(project_root, skill_dir)
    file_layer, command_layer = _invocation_customization(defaults, overrides, assignments or [])
    customization = structural_merge(structural_merge(customization, file_layer), command_layer)
    supplied = _leaf_paths(file_layer) | _leaf_paths(command_layer)

    # Bind public identity to the effective templates, before destination binding;
    # raw source hashes would fingerprint literal checkout references in inputs.
    template_hashes = {name: _hash_bytes(content.encode("utf-8")) for name, content in sources.items()}
    namespace = project_root / "_bmad" / "render" / skill_dir.name

    def render_pass(destination: Path) -> tuple[_RenderContext, dict[str, str]]:
        context = _RenderContext(
            central=central,
            defaults=defaults,
            customization=customization,
            source_names=set(sources),
            project_root=project_root,
            destination=destination,
        )
        return context, _render_sources(sources, skill_dir, context)

    # The generation path is keyed by the values the templates reach, and the
    # templates insert that path, so a first pass against a placeholder
    # destination collects the inputs and the real pass renders the output.
    probe, _ = render_pass(namespace / "pending")
    # An override may only name a key some template actually read; values are validated where consumed.
    unused = sorted(path for path in supplied if f"customization.{path}" not in probe.inputs)
    if unused:
        raise RenderError(f"invocation override not used by this render: {', '.join(unused)}")
    # Store TOML date/time inputs in the same JSON representation used on disk.
    input_values = json.loads(_canonical_json(probe.inputs))
    renderer_hash = _hash_bytes(Path(__file__).read_bytes())
    identity = {
        "project_root": ".",
        "skill_root": skill_dir.relative_to(project_root).as_posix(),
        "renderer_sha256": renderer_hash,
        "config_utils_sha256": _hash_bytes(_helper_bytes),
        "jinja2_version": jinja2.__version__,
        "resolved_values": input_values,
        "template_sha256": template_hashes,
    }
    generation_hash = _hash_bytes(_canonical_json(identity))[:20]
    destination = namespace / generation_hash
    _, rendered = render_pass(destination)
    for prompt in ("review-prompts/edge-case-hunter.md", "review-prompts/verification-gap.md"):
        if prompt not in rendered:
            raise RenderError("required review prompt rendered empty")
    outputs = {name: content.encode("utf-8") for name, content in rendered.items()}
    output_hashes = {name: _hash_bytes(content) for name, content in outputs.items()}
    manifest = {
        "schema_version": 3,
        "skill": skill_dir.name,
        "project_root": ".",
        "skill_root": skill_dir.relative_to(project_root).as_posix(),
        "generation_hash": generation_hash,
        "inputs": identity,
        "outputs": output_hashes,
    }
    entry = Path(os.path.relpath(destination / "workflow.md", caller_cwd))
    root_bytes = project_root.as_posix().encode("utf-8")
    public_text = [*rendered.values(), f"read and follow {entry}\n"]
    public_bytes = [*(text.encode("utf-8") for text in public_text), _canonical_json(manifest)]
    # Validate manifest strings before JSON encoding: its escaped newlines are
    # serialization, not native backslash filesystem references.
    if (
        any(root_bytes in content for content in public_bytes)
        or any(_relative_text(text, project_root) != text for text in public_text)
        or _relative_values(manifest, project_root) != manifest
    ):
        raise RenderError("checkout location remains in rendered snapshot")
    _validate_output_destination(central, project_root)
    _publish(destination, outputs, manifest)
    return entry


def main() -> int:
    global _last_failure
    try:
        parser = _ArgumentParser(description=__doc__)
        parser.add_argument("--project-root", required=True)
        parser.add_argument("--skill", required=True)
        parser.add_argument("--overrides", type=Path, help="invocation-only customization TOML file")
        parser.add_argument("--set", dest="assignments", action="append", default=[], metavar="KEY=VALUE")
        reconfigure = getattr(sys.stdout, "reconfigure", None)
        if reconfigure is not None:
            reconfigure(encoding="utf-8")
        args = parser.parse_args()
        entry = render(
            Path(args.project_root), Path(args.skill), overrides=args.overrides, assignments=args.assignments
        )
    except Exception as error:
        _last_failure = error
        sys.stdout.write(_HALT)
        return 1
    sys.stdout.write(f"read and follow {entry}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
