#!/usr/bin/env python3
"""Render tracked BMAD sources into private, immutable local snapshots.

Requires Python >=3.11 and Jinja2 >=3.1, provisioned by the caller. No installer,
network access, or dependency installation is performed. Snapshots are local
loading artifacts, never public reports or exports.
"""

from __future__ import annotations

import argparse
import ast
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
from typing import Any, Callable
from urllib.parse import quote, unquote, urlsplit
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

# Recognizable opaque credential formats, not entropy-based arbitrary-secret
# inference. Public keys, identifiers and explicit symbolic examples are not
# secret formats. Payloads in tests are generated synthetic sentinels.
_SELF_IDENTIFYING_CREDENTIAL = re.compile(
    r"gh[pou]_[A-Za-z0-9]{36}|ghs_[A-Za-z0-9]{36}|ghr_[A-Za-z0-9]{76}|"
    r"ghs_[A-Za-z0-9]+_eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|"
    r"github_pat_[A-Za-z0-9]{22}_[A-Za-z0-9]{59}|"
    r"glpat-[A-Za-z0-9_-]{20,}|npm_[A-Za-z0-9]{36}|"
    r"pypi-AgEIcHlwaS5vcmc[A-Za-z0-9_-]{50,}|"
    r"sk-[A-Za-z0-9]{20}T3BlbkFJ[A-Za-z0-9]{20}|"
    r"sk-(?:proj|svcacct)-[A-Za-z0-9_-]{32,}|"
    r"sk-ant-(?:api|sid)[0-9]{2}-[A-Za-z0-9_-]{32,}|"
    r"[sr]k_(?:live|test)_[A-Za-z0-9]{24,}|"
    r"xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[A-Za-z0-9-]{20,}|"
    r"AIza[A-Za-z0-9_-]{35}"
)


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


def _relative_sources(sources: dict[str, str], project_root: Path, skill_dir: Path) -> dict[str, str]:
    """Preflight rendered() literals as source names, not project-root prose.

    Only string tokens in actual Jinja expressions are given this origin.
    Validation temporarily uses their fully bound repository-relative spelling;
    effective templates retain the exact original literal bytes for identity.
    """
    environment = SandboxedEnvironment(keep_trailing_newline=True)
    source_root = skill_dir.relative_to(project_root)

    def source_text(text: str) -> str:
        replacements: dict[str, str] = {}

        def expression(match: re.Match[str], *, restore: bool = False) -> str:
            expression_text = match[0]
            if expression_text.startswith("{#") or re.match(r"\{%-?\s*raw\b", expression_text):
                return expression_text
            tokens = list(environment.lex(expression_text))
            significant = [token for token in tokens if token[1] != "whitespace"]
            string_indices = [index for index, token in enumerate(significant) if token[1] == "string"]
            literals: dict[int, str] = {}
            for index, (_, kind, spelling) in enumerate(significant):
                if kind != "name" or spelling != "rendered":
                    continue
                if index and significant[index - 1][2] == ".":
                    continue
                following = significant[index + 1:index + 4]
                if len(following) != 3 or following[0][2] != "(" or following[1][1] != "string" or following[2][2] != ")":
                    continue
                literal = following[1][2]
                ordinal = string_indices.index(index + 2)
                if restore:
                    if literal in replacements:
                        literals[ordinal] = replacements[literal]
                    continue
                target = ast.literal_eval(literal)
                if target not in sources:
                    raise RenderError("rendered() targets undeclared source")
                if _relative_text(target, project_root, reference_root=skill_dir) != target:
                    raise RenderError("noncanonical rendered source name")
                bound = literal[0] + source_root.as_posix() + "/" + literal[1:]
                replacements[bound] = literal
                literals[ordinal] = bound
            # Lexer values retain literal spelling, but may normalize newlines.
            # Replace string tokens in the original expression, never reserialize
            # its other tokens or the surrounding source body.
            ordinal = -1

            def replace_literal(literal: re.Match[str]) -> str:
                nonlocal ordinal
                ordinal += 1
                return literals.get(ordinal, literal[0])

            return re.sub(
                r'''"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*' ''',
                replace_literal,
                expression_text,
                flags=re.VERBOSE,
            )

        quoted = r'''"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*' '''.strip()
        pattern = (
            r"\{#[\s\S]*?#\}|\{%-?\s*raw\s*-?%\}[\s\S]*?\{%-?\s*endraw\s*-?%\}|"
            rf"\{{\{{(?:{quoted}|(?!\}}\}})[\s\S])*?\}}\}}|"
            rf"\{{%(?:{quoted}|(?!%\}})[\s\S])*?%\}}"
        )
        validation = re.sub(pattern, expression, text)
        normalized = _relative_text(validation, project_root, skill_root=skill_dir)
        return re.sub(pattern, lambda match: expression(match, restore=True), normalized)

    for name in sources:
        _check_credential_value(name, sources[name])
        if _relative_text(name, project_root, reference_root=skill_dir) != name:
            raise RenderError("noncanonical source name")
    return {name: source_text(text) for name, text in sources.items()}


def _resolve_config_value(value: Any, label: str, project_root: Path, *, key: str) -> str:
    _check_credential_value(key, value)
    text = _require_string(value, label, allow_empty=label == "config.core.active_initiative")
    _check_text_credentials(text)
    decoded = _decode_privacy_text(text)
    if decoded != text:
        _relative_text(text, project_root)
        if key in {"output_folder", "active_initiative"} and ".." in decoded.replace("\\", "/").split("/"):
            raise RenderError("encoded config parent traversal")
    expanded = text.replace("{project-root}", project_root.as_posix())
    portable = expanded.replace("\\", "/")
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
    output = _resolve_config_value(core.get("output_folder"), "config.core.output_folder", project_root, key="output_folder")
    initiative = _resolve_config_value(core.get("active_initiative"), "config.core.active_initiative", project_root, key="active_initiative")
    if not (project_root / output / initiative).resolve().is_relative_to(project_root):
        raise RenderError("composed initiative destination is outside repository")


def _credential_key(key: str, *, url: bool = False) -> bool:
    decoded = _decode_privacy_text(key)
    normalized = "".join(character for character in decoded.casefold() if character.isalnum())
    components = re.findall(r"[a-z0-9]+", re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", decoded).casefold())
    plain_keys = {
        "auth", "authorization", "authentication", "apikey", "accesskey", "privatekey",
        "jwt", "session", "sessionid", "cookie", "setcookie", "credential", "credentials",
        "password", "passwd", "pwd", "token", "secret", "oauth", "oauth2", "pat",
    }
    return (
        normalized in plain_keys
        or (bool(components) and components[-1] in {"oauth", "oauth2", "pat"})
        or normalized.endswith(("token", "secret", "password", "signature", "credential", "credentials", "apikey", "accesskey", "authorization", "authentication"))
        or (url and (normalized in {"key", "code", "sig", "policy", "keypairid"} or normalized.startswith(("xamz", "xgoog"))))
    )


def _credential_placeholder(value: Any) -> bool:
    if isinstance(value, dict):
        return all(_credential_placeholder(item) for item in value.values())
    if isinstance(value, list):
        return all(_credential_placeholder(item) for item in value)
    if value is None or isinstance(value, bool):
        return True
    if not isinstance(value, str):
        return False
    text = _decode_privacy_text(value).strip()
    for quote in ('"""', "'''", '"', "'", '`'):
        if len(text) >= 2 * len(quote) and text.startswith(quote) and text.endswith(quote):
            text = text[len(quote):-len(quote)].strip()
            break
    text = re.sub(r"^(?:Bearer|Basic)\s+", "", text, flags=re.IGNORECASE)
    return text.casefold() in {"", "<redacted>", "<placeholder>", "..."} or re.fullmatch(r"\$?\{[A-Za-z_][A-Za-z0-9_.]*\}", text) is not None


def _check_credential_value(key: str, value: Any) -> None:
    if _credential_key(key) and not _credential_placeholder(value):
        raise RenderError("credential-bearing value")


def _check_uri_authorities(text: str) -> None:
    for authority in re.finditer(r"([A-Za-z0-9+.%\-]+)://([^/\s?#]+)", text):
        scheme = authority[1]
        for _ in range(8):
            expanded = _expand_privacy_text(unquote(scheme))
            if expanded == scheme:
                break
            scheme = expanded
        else:
            raise RenderError("ambiguous encoded URI scheme")
        if re.fullmatch(r"[A-Za-z][A-Za-z0-9+.-]*", scheme) is None:
            continue
        if "@" in authority[2] or "%" in authority[2]:
            raise RenderError("credential-bearing or ambiguous URI authority")


def _expand_privacy_text(text: str) -> str:
    expanded = unicodedata.normalize("NFKC", unescape(text))
    return re.sub(r"\\u([0-9A-Fa-f]{4})", lambda match: chr(int(match[1], 16)), expanded)


def _decode_privacy_text(text: str, *, validate: Callable[[str], None] | None = None) -> str:
    decoded = text
    for _ in range(8):
        # A later decode can turn userinfo data into a slash or markup boundary.
        # Reveal entity/Unicode schemes before percent-decoding authority data.
        authority_view = decoded
        for _ in range(8):
            _check_uri_authorities(authority_view)
            if validate is not None:
                validate(authority_view)
            expanded = _expand_privacy_text(authority_view)
            if expanded == authority_view:
                break
            authority_view = expanded
        else:
            raise RenderError("ambiguous encoded authority text")
        expanded = _expand_privacy_text(unquote(decoded))
        if expanded == decoded:
            break
        decoded = expanded
    else:
        raise RenderError("ambiguous encoded privacy text")
    return decoded


def _check_text_credentials(text: str) -> None:
    _decode_privacy_text(text, validate=_check_credential_text_view)

    def carrier(view: str) -> None:
        # Decoding a key/operator and its value's whitespace together must not
        # turn an attached payload into unrelated prose after a placeholder.
        # Only whitespace absent from the original raw carrier is protected;
        # this view is validation-only and never becomes persisted text.
        protected = re.sub(r"\s", "%20", view)
        _check_credential_text_view(protected)

    parts: list[str] = []
    start = 0
    for match in re.finditer(r"\S+", text):
        word = match[0]
        if "%" in word or "&" in word or "\\u" in word or (not word.isascii() and unicodedata.normalize("NFKC", word) != word):
            decoded = _decode_privacy_text(word, validate=carrier)
            protected = re.sub(r"\s", "%20", decoded)
            if protected != word:
                parts.extend((text[start:match.start()], protected))
                start = match.end()
    if parts:
        parts.append(text[start:])
        _check_credential_text_view("".join(parts))


def _check_credential_text_view(text: str) -> None:
    decoded = text.replace("\r\n", "\n").replace("\r", "\n")
    if _SELF_IDENTIFYING_CREDENTIAL.search(decoded):
        raise RenderError("recognizable standalone credential")
    if re.search(r"-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----", decoded):
        raise RenderError("private key material")
    # Capture the complete adjacent shell/quoted value, not an empty or
    # placeholder prefix that can be followed by credential bytes.
    value_pattern = r'''(?:"""[\s\S]*?"""|''' + "'''[\\s\\S]*?'''" + r'''|\$?\{[A-Za-z_][A-Za-z0-9_.]*\}|"[^"\r\n]*"|'[^'\r\n]*'|&(?:\#[xX][0-9A-Fa-f]+|\#[0-9]+|[A-Za-z][A-Za-z0-9]+);|[^\s,;}\]"'&]++|&)++'''
    assignments = r'''(?<!\w)(?:"(?P<double>[^"\r\n]+)"|'(?P<single>[^'\r\n]+)'|`(?P<code>[^`\r\n]+)`|(?P<bare>[A-Za-z][A-Za-z0-9_.\[\]-]*))(?:\s|%20)*(?P<operator>[:=])(?:\s|%20)*''' + f"(?P<value>{value_pattern})"
    # Overlap so a nonsensitive enclosing literal cannot hide a supported
    # assignment inside it. Possessive value runs avoid partition backtracking.
    for match in re.finditer(f"(?={assignments})", decoded):
        key = next(match[name] for name in ("double", "single", "code", "bare") if match[name] is not None)
        value = match["value"]
        if match["bare"] is not None and match["operator"] == "=":
            # JSON delimiters are ordinary bytes inside a shell assignment
            # word. Do not accept an empty/placeholder prefix of that word.
            value += re.match(r"[^\s;]*", decoded[match.end("value"):])[0]
        header = "".join(character for character in key.casefold() if character.isalnum())
        if header.endswith(("auth", "authorization", "authentication")) and value.casefold() in {"bearer", "basic"}:
            credential = re.match(r"(?:[ \t]+|\r?\n[ \t]+)(" + value_pattern + ")", decoded[match.end("value"):])
            if credential is None:
                continue
            value = credential[1]
        _check_credential_value(key, value)
    for match in re.finditer(r"(?im)^[ \t`]*(?:Bearer|Basic)[ \t]+(" + value_pattern + r")[ \t`]*$", decoded):
        _check_credential_value("authorization", match[1])


def _check_url_credentials(query: str, fragment: str) -> None:
    for component in (query, fragment):
        decoded = _decode_privacy_text(component)
        if "\\" in decoded:
            raise RenderError("ambiguous structured URI escape")
        # Include router fragments, HTML/semicolon separators and nested URL or
        # JSON parameters. Inspect decoded keys, never retain a credential value.
        for match in re.finditer(r"(?:^|[?&#;/{,])([^?&#;/{,=:]+)[=:]", decoded):
            if _credential_key(match[1], url=True):
                raise RenderError("credential-bearing URI parameters")


def _unique_json_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise RenderError("duplicate structured key")
        result[key] = value
    return result


def _check_url_machine_references(path: str, query: str, fragment: str, project_root: Path) -> None:
    native_keys = {
        "path", "file", "filepath", "filename", "directory", "folder", "dir", "cwd",
        "workdir", "root", "homedir", "localpath", "sourcepath", "configpath",
        "outputfolder", "activeinitiative",
    }
    decoder = json.JSONDecoder(object_pairs_hook=_unique_json_object)

    def native_value(value: Any) -> None:
        if isinstance(value, dict):
            for key, item in value.items():
                native_value(key)
                native_value(item)
        elif isinstance(value, list):
            for item in value:
                native_value(item)
        elif isinstance(value, str):
            native = _decode_privacy_text(value).strip()
            if native.startswith(('"', "[", "{")):
                try:
                    parsed, end = decoder.raw_decode(native)
                except json.JSONDecodeError:
                    pass
                else:
                    if end == len(native) and isinstance(parsed, (str, dict, list)):
                        native_value(parsed)
                        return
            # In an explicit path field, angle brackets wrap a reference; a
            # one-component absolute path must not become an XML closing tag.
            if native.startswith("<") and native.endswith(">"):
                native = native.lstrip("<").rstrip(">")
            # Nested URI syntax is checked by the bounded component scans,
            # not recursive parsing of attacker-controlled URI depth.
            if re.match(r"[A-Za-z][A-Za-z0-9+.-]+://", native):
                return
            if _relative_text(native, project_root) != native:
                raise RenderError("noncanonical machine reference in URI")

    def check(view: str) -> None:
        # A web route is not automatically a filesystem path. Explicit native
        # syntax, native-path parameters and host filesystem namespaces are.
        if re.search(
            r"(?i)(?<!\w)(?:file:|[A-Za-z]:[/\\]|~[^/\s]*[/\\]|"
            r"(?:\$HOME|\$\{HOME\}|%USERPROFILE%|%HOMEPATH%)[/\\])",
            view,
        ) or "\\" in view:
            raise RenderError("machine reference in URI")
        def web_authority(match: re.Match[str]) -> str:
            scheme = _decode_privacy_text(match[1])
            return " " if re.fullmatch(r"[A-Za-z][A-Za-z0-9+.-]+", scheme) else match[0]

        portable = re.sub(r"([A-Za-z0-9+.%\-]+)://[^/\s?#]*", web_authority, view)
        for match in re.finditer(r'''(?:^|[=:\s"'`<>,\[({?&#;])(/[^\s"'`<>&,;}\]]*)''', portable):
            for candidate in (match[1], posixpath.normpath(match[1])):
                if re.match(
                    r"(?i)^/(?:/(?!$)|(?:home|users)/[^/]+(?:/|$)|"
                    r"(?:root|private|var|tmp|etc|opt|srv|mnt|media|volumes|run|proc|sys|dev|usr)(?:/|$))",
                    candidate,
                ):
                    raise RenderError("machine reference in URI")
        for match in re.finditer(r"(?:^|[?&#;/{,])([^?&#;/{,=:]+)[=:]", view):
            key = "".join(character for character in _decode_privacy_text(match[1]).casefold() if character.isalnum())
            if key not in native_keys:
                continue
            # JSON strings/containers end at their actual boundary, not at a
            # sibling field or the first quote/markup token inside the value.
            tail = view[match.end():].lstrip()
            field = re.split(r"[&#;]", tail, maxsplit=1)[0].strip()
            member = view[match.end() - 1] == ":" and _decode_privacy_text(match[1]).strip().startswith('"') and match[0][0] in "{,"
            value: Any = field
            for encoded in (False, True):
                candidate = _decode_privacy_text(field) if encoded else tail
                try:
                    parsed, end = decoder.raw_decode(candidate)
                except json.JSONDecodeError:
                    continue
                rest = candidate[end:].lstrip()
                allowed = (",}]" if member else "") + ("" if encoded else "&#;")
                if isinstance(parsed, (str, dict, list)) and (not rest or rest[0] in allowed):
                    value = parsed
                    break
            native_value(value)

    for component in (path, query, fragment):
        _decode_privacy_text(component, validate=check)


def _check_web_reference(text: str, project_root: Path) -> str:
    uri = urlsplit(text)
    if (
        uri.scheme.lower() not in {"http", "https"}
        or not uri.netloc
        or not uri.hostname
        or uri.username is not None
        or uri.password is not None
        or "%" in uri.netloc
        or "\\" in text
    ):
        raise RenderError("unsupported URI reference")
    _check_url_credentials(uri.query, uri.fragment)
    _check_url_machine_references(uri.path, uri.query, uri.fragment, project_root)
    return uri.geturl()


# Explicit file carriers retain native filename punctuation through the whole
# whitespace/quote-delimited payload, unlike generic prose/assignment tokens.
_FILE_CARRIER = r'''(?<![\w/\\.*?%+-])(?i:file:)(?P<file_payload>[^\s`"'<>]+)'''


def _check_file_carrier(payload: str) -> None:
    def check(view: str) -> None:
        portable = view.replace("\\", "/")
        if (
            portable.startswith(("/", "~", "$HOME", "${HOME}", "%USERPROFILE%", "%HOMEPATH%"))
            or re.match(r"^[A-Za-z][A-Za-z0-9+.-]*:", portable)
        ):
            raise RenderError("unsupported native file carrier")

    _decode_privacy_text(payload, validate=check)


def _check_relative_references(
    text: str, project_root: Path, skill_root: Path | None = None, reference_root: Path | None = None
) -> None:
    """Validate operational references without rewriting their public spelling.

    Ordinary relative references use the project root, not cwd or the document
    directory. A skill placeholder is checked only with its actual binding;
    callers consuming source/customization provide that origin before capture.
    Public URI routes and wildcard prose are not native filesystem targets;
    operational globs validate only the literal directory before a wildcard.
    """
    def contained(reference: str) -> None:
        reference = reference.replace("\\", "/")
        if reference.startswith("{skill-root}"):
            if skill_root is None:
                return
            base = skill_root
            reference = reference[len("{skill-root}"):].lstrip("/")
        else:
            base = reference_root if reference_root is not None else project_root
        wildcard = re.search(r"[*?]", reference)
        if wildcard is not None:
            prefix = reference[:wildcard.start()]
            reference = prefix.rsplit("/", 1)[0] if "/" in prefix else "."
        # Follow existing and dangling symlink prefixes, without requiring a
        # referenced file to exist or creating any filesystem target.
        if not (base / reference).resolve().is_relative_to(project_root):
            raise RenderError("relative reference escapes repository")

    def check(view: str) -> None:
        view = re.sub(
            r"(?<![\w/\\}.*?+%-])(?P<marker>\*\*|__|\*|_|`+)"
            r"(?P<wrapped>[^\s]+?)(?P=marker)(?!\w)",
            lambda match: " " + match["wrapped"] + " ",
            view,
        )
        # Mask complete web carriers before looking for relative path segments.
        # Native path parameters are checked separately by the URI policy.
        view = re.sub(r'''https?://[^\s`"'<>]+''', ' ', view, flags=re.IGNORECASE)

        def file_carrier(match: re.Match[str]) -> str:
            # file: is an explicit operational carrier, not an assignment.
            # Equals, commas, semicolons and native filename brackets belong
            # to its payload. Check the full raw spelling before considering
            # a surrounding Markdown/structured wrapper interpretation.
            reference = match["file_payload"]
            _check_file_carrier(reference)
            contained(reference)
            prefix = view[:match.start()]
            wrappers = {"(": ")", "[": "]", "{": "}"}
            while prefix and prefix[-1] in wrappers and reference.endswith(wrappers[prefix[-1]]):
                reference = reference[:-1]
                contained(reference)
                prefix = prefix[:-1]
            # Do not reclassify fragments of an already checked explicit
            # carrier using the more restrictive generic prose delimiters.
            return " " * len(match[0])

        view = re.sub(
            _FILE_CARRIER,
            file_carrier,
            view,
            flags=re.IGNORECASE,
        )
        for match in re.finditer(
            r'''(?<![\w/\\.*?%+-])(?:\{skill-root\}|[^\s/\\`"'<>\[\](){};,:=]+)(?:[/\\][^\s`"'<>\[\](){};,]*)+''',
            view,
            flags=re.IGNORECASE,
        ):
            contained(match[0])

    def web_carrier(match: re.Match[str]) -> str:
        # Recognize a web carrier before decoding can turn its encoded scheme
        # or query delimiters into separate apparent filesystem references.
        decoded = _decode_privacy_text(match[0])
        opening = re.match(r"(?:\*\*|__|\*|_)", decoded)
        if opening is not None:
            decoded = decoded[len(opening[0]):]
        return " " if re.match(r"https?://", decoded, flags=re.IGNORECASE) else match[0]

    native_text = re.sub(
        r'''https?://[^\s`"'<>]+|[^\s`"'<>()[\]{}]+''',
        web_carrier,
        text,
        flags=re.IGNORECASE,
    )
    _decode_privacy_text(native_text, validate=check)


def _relative_text(
    text: str, project_root: Path, *, skill_root: Path | None = None, reference_root: Path | None = None
) -> str:
    """Normalize canonical checkout tokens; reject machine paths, preserve public web links."""
    _check_text_credentials(text)
    _check_relative_references(text, project_root, skill_root, reference_root)
    normalized = _relative_reference_text(text, project_root, reference_root=reference_root)
    decoded = _decoded_reference_text(normalized, project_root, reference_root=reference_root)
    if decoded != normalized and _relative_reference_text(decoded, project_root, reference_root=reference_root) != decoded:
        raise RenderError("encoded checkout reference")
    return normalized


def _checkout_reference_pattern(project_root: Path) -> str:
    root = project_root.as_posix()
    separators = r"[/\\]+(?:\.[/\\]+)*"
    patterns = []
    for spelling in {root, unicodedata.normalize("NFKC", root)}:
        pattern = separators.join(re.escape(part) for part in spelling.strip("/").split("/"))
        patterns.append(separators + pattern if spelling.startswith("/") else pattern)
    return "(?:" + "|".join(sorted(patterns)) + ")"


def _decoded_reference_text(text: str, project_root: Path, *, reference_root: Path | None = None) -> str:
    def validate_uri(uri: str) -> None:
        parsed = _check_web_reference(uri, project_root)
        if any(re.search(_checkout_reference_pattern(project_root), value) for value in (uri, parsed)):
            raise RenderError("checkout reference in URI")

    def token(match: re.Match[str]) -> str:
        decoded = _decode_privacy_text(match[0])

        def uri_span(uri: re.Match[str]) -> str:
            validate_uri(uri[0])
            return re.sub(r'''[\s`"'<>]''', lambda delimiter: quote(delimiter[0], safe=""), uri[0])

        return re.sub(r"https?://.*", uri_span, decoded, flags=re.IGNORECASE | re.DOTALL)

    def carrier(match: re.Match[str]) -> str:
        # Check the full carrier before markup segmentation so mixed raw and
        # encoded quotes cannot hide a credential query after a quoted value.
        decoded = _decode_privacy_text(match[0])
        uri = re.search(r"https?://.*", decoded, flags=re.IGNORECASE | re.DOTALL)
        if uri is not None:
            validate_uri(uri[0])
        return re.sub(r'''[^\s`"'<>]+''', token, match[0])

    # Valid JSON containers have their own string boundaries. Do not append a
    # URL's public sibling fields to its query merely because spaces are absent.
    decoder = json.JSONDecoder(object_pairs_hook=_unique_json_object)
    parts: list[str] = []
    start = 0
    for match in re.finditer(r"[\[{]", text):
        if match.start() < start or (match.start() and not text[match.start() - 1].isspace()):
            continue
        try:
            value, end = decoder.raw_decode(text, match.start())
        except json.JSONDecodeError:
            continue
        if not isinstance(value, (dict, list)):
            continue
        if _relative_values(value, project_root, reference_root=reference_root) != value:
            raise RenderError("noncanonical structured reference")
        parts.extend((re.sub(r"[^\s]+", carrier, text[start:match.start()]), text[match.start():end]))
        start = end
    parts.append(re.sub(r"[^\s]+", carrier, text[start:]))
    return "".join(parts)


def _relative_reference_text(text: str, project_root: Path, *, reference_root: Path | None = None) -> str:
    root = project_root.as_posix()
    home_prefix = r"(?:\$HOME|\$\{HOME\}|%USERPROFILE%|%HOMEPATH%)[/\\]"

    def reference(match: re.Match[str]) -> str:
        original = match.group()
        if match.group("file_payload") is not None:
            # Consume the same complete carrier used by containment preflight;
            # punctuation inside a legal relative filename must not expose a
            # suffix slash as a new absolute reference. Keep original bytes.
            _check_file_carrier(match["file_payload"])
            _check_relative_references(original, project_root, reference_root=reference_root)
            return original
        marker = match.group("marker")
        if marker is not None:
            # Classify complete emphasis/code contents, not a slash after a
            # glob-like delimiter. Keep markup and normalize only its contents.
            # A wrapper cannot span whitespace-separated references: otherwise
            # the literal `_bmad/` binding can capture a later emphasis marker.
            return marker + _relative_text(match.group("wrapped"), project_root, reference_root=reference_root) + marker
        if match.group("incomplete") is not None:
            marked_uri = match.group("marked_uri")
            if marked_uri is not None:
                # Multiword emphasis still contains a complete URI token. Run
                # the ordinary URI policy, including credential rejection,
                # without interpreting later words as part of its location.
                return match.group("incomplete") + _relative_text(marked_uri, project_root, reference_root=reference_root)
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
            _check_web_reference(decoded, project_root)
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
        _FILE_CARRIER + r"|</[A-Za-z_][A-Za-z0-9_.:-]*\s*>|"
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
    # A checkout spelling split by prose delimiters (for example spaces in a
    # directory name) is not a safely recognizable token: reject, do not guess.
    if re.search(_checkout_reference_pattern(project_root), result) is not None:
        raise RenderError("unrepresentable checkout reference")
    return result


def _relative_values(
    value: Any, project_root: Path, *, skill_root: Path | None = None,
    reference_root: Path | None = None, key_root: Path | None = None,
) -> Any:
    if isinstance(value, str):
        return _relative_text(value, project_root, skill_root=skill_root, reference_root=reference_root)
    if isinstance(value, list):
        return [_relative_values(item, project_root, skill_root=skill_root, reference_root=reference_root) for item in value]
    if isinstance(value, dict):
        for key, item in value.items():
            _check_credential_value(key, item)
            if _relative_text(key, project_root, skill_root=skill_root, reference_root=key_root or reference_root) != key:
                raise RenderError("noncanonical mapping key")
        return {key: _relative_values(item, project_root, skill_root=skill_root, reference_root=reference_root) for key, item in value.items()}
    return value


def _find_config_values(data: Any, key: str, project_root: Path, prefix: str = "") -> list[tuple[str, Any]]:
    matches: list[tuple[str, Any]] = []
    if not isinstance(data, dict):
        return matches
    for name, value in data.items():
        path = f"{prefix}.{name}" if prefix else name
        if name == key and not isinstance(value, (dict, list)):
            if _relative_text(name, project_root) != name:
                raise RenderError("noncanonical config name")
            matches.append((path, value))
        nested = _find_config_values(value, key, project_root, path)
        if nested:
            _check_credential_value(name, value)
            if _relative_text(name, project_root) != name:
                raise RenderError("noncanonical config ancestor")
        matches.extend(nested)
    return matches


def _resolve_short_config(central: dict[str, Any], key: str, project_root: Path) -> tuple[str, str]:
    matches = _find_config_values(central, key, project_root)
    if not matches:
        raise RenderError(f"missing config value `{key}`")
    if len(matches) > 1:
        paths = ", ".join(path for path, _ in matches)
        raise RenderError(f"ambiguous config value `{key}` found at: {paths}")
    path, value = matches[0]
    return path, _resolve_config_value(value, f"config.{path}", project_root, key=key)


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


def _check_customization_capture(value: Any, default: Any, path: str, project_root: Path) -> None:
    """Do not classify arbitrary caller prose as safe from absent secret signatures.

    Tracked defaults are reviewed workflow source. Caller changes may select a
    finite mode, disable an instruction, or name a contained Markdown file; its
    body is never read, copied or hashed by the renderer. Consumers still own
    authorization/privacy preflight before reading a referenced file.
    """
    choices = {
        "workflow.route": {"auto", "full", "oneshot"},
        "workflow.review": {"auto", "none", "quick", "thorough"},
    }
    if path in choices:
        if not isinstance(value, str) or value not in choices[path]:
            raise RenderError("unsupported customization selection")
        return
    if value == default:
        return
    if isinstance(value, list):
        if default and all(isinstance(item, dict) for item in default):
            declared = {item["id"]: item for item in default}
            for layer in value:
                original = declared.get(layer["id"])
                if original is None or layer["name"] != original["name"]:
                    raise RenderError("undeclared review identity")
                for key, text in layer.items():
                    _check_customization_capture(text, original.get(key, ""), f"{path}.{key}", project_root)
        else:
            for item in value:
                if item not in default:
                    _check_customization_capture(item, "", path, project_root)
        return
    if isinstance(value, str):
        if not value:
            return
        # One literal reference only: no labels, glob, encoding, URL, placeholders
        # or trailing prose can smuggle a body into the manifest. Existing path
        # guards also check credential signatures and realpath containment.
        if re.fullmatch(r"file:(?:[A-Za-z0-9_-]+/)*[A-Za-z0-9_.-]+\.md", value) is not None:
            reference = Path(value.removeprefix("file:"))
            target = (project_root / reference).resolve(strict=True)
            if target.is_relative_to(project_root) and target.is_file():
                return
        raise RenderError("free-form customization cannot be captured")
    # Custom scalar declarations retain their exact type validation.
    if not isinstance(value, (bool, int, float, date, time)):
        raise RenderError("unsupported customization capture")


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
        if _relative_text(name, self._ctx.project_root) != name:
            raise RenderError("noncanonical config name")
        if self._path == "config" and name not in self._table:
            path, resolved = _resolve_short_config(self._central, name, self._ctx.project_root)
            self._ctx.inputs[f"config.{path}"] = resolved
            return _Text(resolved, f"config.{path}")
        label = self._child(name)
        if name not in self._table:
            raise RenderError(f"missing config value `{label.removeprefix('config.')}`")
        value = self._table[name]
        _check_credential_value(name, value)
        if isinstance(value, dict):
            return _ConfigTable(self._central, value, label, self._ctx)
        resolved = _resolve_config_value(value, label, self._ctx.project_root, key=name)
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
        if _relative_text(name, self._ctx.project_root) != name:
            raise RenderError("noncanonical customization name")
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
        if path == "workflow.implementation_handoff":
            instruction = _require_string(value, label, allow_empty=True)
            if re.search(r"\{\s*(?:plan_file|plan_path|verbatim_intent|claims_file|diff_file|project-root|skill-root)\s*\}", _decode_privacy_text(instruction)):
                raise RenderError("private implementation placeholder")
        resolved = _relative_values(
            _resolve_customization_value(value, default, label), self._ctx.project_root,
            skill_root=self._ctx.project_root / self._ctx.destination,
        )
        _check_customization_capture(resolved, default, path, self._ctx.project_root)
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

    sources = _relative_sources(_load_sources(skill_dir), project_root, skill_dir)
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
    # The loading instruction alone is caller-relative; operational references
    # in snapshots and captured inputs remain project-relative.
    if not (caller_cwd / entry).resolve().is_relative_to(project_root):
        raise RenderError("loading reference escapes repository")
    root_bytes = project_root.as_posix().encode("utf-8")
    public_text = [*rendered.values()]
    public_bytes = [*(text.encode("utf-8") for text in public_text), _canonical_json(manifest)]
    # These mapping keys are structural filenames, not project-root prose.
    # Validate them against the actual source/output origin without letting an
    # unrelated root-level symlink redefine a bundled name's target.
    checked_manifest = dict(manifest)
    checked_inputs = dict(identity)
    checked_inputs.pop("template_sha256")
    checked_manifest["inputs"] = checked_inputs
    checked_manifest.pop("outputs")
    # Validate manifest strings before JSON encoding: its escaped newlines are
    # serialization, not native backslash filesystem references.
    if (
        any(root_bytes in content for content in public_bytes)
        or root_bytes in f"read and follow {entry}\n".encode("utf-8")
        or any(_relative_text(text, project_root) != text for text in public_text)
        or _relative_values(checked_manifest, project_root) != checked_manifest
        or _relative_values(template_hashes, project_root, key_root=skill_dir) != template_hashes
        or _relative_values(output_hashes, project_root, key_root=destination) != output_hashes
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
