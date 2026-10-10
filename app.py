#!/usr/bin/env python3
"""Mentor Formal Languages Workbench — local web GUI for the Mentor CLI."""

from __future__ import annotations

import json
import os
import re
import subprocess
import tempfile
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

ROOT = Path(__file__).resolve().parent
STATIC = ROOT / "static"
EXAMPLES = ROOT / "examples"
MENTOR = ROOT / "mentor_app" / "mentor"
GUIDE = EXAMPLES / "user-guide.txt"
HOST = os.environ.get("MENTOR_HOST", "127.0.0.1")
PORT = int(os.environ.get("MENTOR_PORT", "8765"))

KINDS = ("dfa", "nfa", "re", "pda", "cfg", "tm", "htm")
COMMANDS = {
    "dfa": ("accept", "graph", "gen_words", "compare"),
    "nfa": ("accept", "graph", "gen_words", "compare"),
    "re": ("accept", "gen_words", "compare"),
    "cfg": ("accept", "gen_words", "gen_upto_length"),
    "pda": ("accept", "graph", "gen_words", "gen_upto_length"),
    "tm": ("accept", "trace", "accept_file"),
    "htm": ("accept", "trace", "accept_file"),
}
COMPARE_KINDS = ("dfa", "nfa", "re")
MAX_SOURCE = 512 * 1024
LINUX_PATH = "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

app = Flask(__name__, static_folder=str(STATIC), static_url_path="")
app.json.ensure_ascii = False
app.config["MAX_CONTENT_LENGTH"] = MAX_SOURCE * 3


def mentor_env() -> dict[str, str]:
    env = os.environ.copy()
    env["PATH"] = LINUX_PATH
    env["LANG"] = env.get("LANG") or "C.UTF-8"
    return env


def example_title(source: str, fallback: str) -> str:
    for line in source.splitlines():
        stripped = line.strip()
        if stripped.startswith("//"):
            title = stripped[2:].strip()
            return title or fallback
        if stripped:
            break
    return fallback


def list_examples() -> list[dict[str, str]]:
    items = []
    if not EXAMPLES.is_dir():
        return items
    for path in sorted(EXAMPLES.iterdir()):
        suffix = path.suffix.lstrip(".").lower()
        if suffix not in KINDS or not path.is_file():
            continue
        source = path.read_text(encoding="utf-8")
        items.append(
            {
                "id": path.name,
                "kind": suffix,
                "name": path.stem,
                "title": example_title(source, path.stem),
                "source": source,
            }
        )
    return items


def run_mentor(
    kind: str,
    source: str,
    command: str,
    *,
    input_string: str | None = None,
    number: int | None = None,
    steps: int | None = None,
    compare_kind: str | None = None,
    compare_source: str | None = None,
    accept_words: list[str] | None = None,
    reject_words: list[str] | None = None,
) -> dict[str, object]:
    if kind not in KINDS:
        return {"ok": False, "error": f"Unknown type: {kind}"}
    if command not in COMMANDS[kind]:
        return {"ok": False, "error": f"Command '{command}' is not available for .{kind} files."}
    if len(source) > MAX_SOURCE:
        return {"ok": False, "error": "Source is too large."}

    timeout = 20
    if kind in {"tm", "htm"}:
        timeout = 45

    with tempfile.TemporaryDirectory(prefix="mentor-web-") as tmp:
        work = Path(tmp)
        machine = work / f"machine.{kind}"
        machine.write_text(source, encoding="utf-8")
        argv = [str(MENTOR), str(machine), command]

        if command in {"accept", "trace"}:
            argv.append("" if input_string is None else str(input_string))
            if steps is not None:
                argv.append(str(int(steps)))
        elif command in {"gen_words", "gen_upto_length"}:
            if number is None:
                return {"ok": False, "error": "A positive number is required."}
            argv.append(str(int(number)))
        elif command == "graph":
            argv.append(str(work / "diagram"))
        elif command == "compare":
            if compare_kind not in COMPARE_KINDS:
                return {"ok": False, "error": "Compare requires a DFA, NFA, or RE."}
            if not compare_source:
                return {"ok": False, "error": "Provide a second regular language to compare."}
            other = work / f"other.{compare_kind}"
            other.write_text(compare_source, encoding="utf-8")
            argv.append(str(other))
        elif command == "accept_file":
            tests = work / "tests.txt"
            accept_block = "\n".join(accept_words or [])
            reject_block = "\n".join(reject_words or [])
            tests.write_text(
                f"## ACCEPT ##\n{accept_block}\n## REJECT ##\n{reject_block}\n",
                encoding="utf-8",
            )
            argv.append(str(tests))
            if steps is not None:
                argv.append(str(int(steps)))

        try:
            proc = subprocess.run(
                argv,
                cwd=work,
                capture_output=True,
                text=True,
                timeout=timeout,
                env=mentor_env(),
            )
        except subprocess.TimeoutExpired:
            return {
                "ok": False,
                "timed_out": True,
                "error": f"Mentor timed out after {timeout}s. For TM/HTM, lower the step limit.",
            }
        except FileNotFoundError:
            return {"ok": False, "error": f"Mentor executable not found at {MENTOR}"}

        stdout = proc.stdout or ""
        stderr = clean_stderr(proc.stderr or "")
        crashed = proc.returncode < 0 or "Check failure" in (proc.stderr or "")
        dot = None
        svg = None
        diagram_dot = work / "diagram.dot"
        if command == "graph" and diagram_dot.exists():
            dot = diagram_dot.read_text(encoding="utf-8")
            svg = render_svg(dot, work)
            stderr = strip_dot_noise(stderr)
            crashed = False

        ok = proc.returncode == 0 and not crashed
        result: dict[str, object] = {
            "ok": ok,
            "exit_code": proc.returncode,
            "stdout": stdout,
            "stderr": stderr,
            "crashed": crashed,
            "command": command,
            "kind": kind,
            "argv_preview": preview_argv(kind, command, input_string, number, steps),
        }
        if dot is not None:
            result["dot"] = dot
        if svg is not None:
            result["svg"] = svg
        if not ok and not stdout and not stderr:
            result["error"] = "Mentor failed without producing output."
        elif not ok and stderr and not stdout:
            result["error"] = stderr.splitlines()[0]
        return result


def preview_argv(
    kind: str,
    command: str,
    input_string: str | None,
    number: int | None,
    steps: int | None,
) -> str:
    parts = [f"mentor machine.{kind}", command]
    if command in {"accept", "trace"}:
        parts.append('""' if not input_string else json.dumps(input_string))
        if steps is not None:
            parts.append(str(int(steps)))
    elif command in {"gen_words", "gen_upto_length"} and number is not None:
        parts.append(str(int(number)))
    elif command == "graph":
        parts.append("diagram")
    elif command == "compare":
        parts.append("other.{dfa,nfa,re}")
    elif command == "accept_file":
        parts.append("tests.txt")
        if steps is not None:
            parts.append(str(int(steps)))
    return " ".join(parts)


def strip_dot_noise(text: str) -> str:
    lines = [
        line
        for line in text.splitlines()
        if "dot:" not in line.lower() and "graphviz" not in line.lower()
    ]
    return "\n".join(lines).strip()


def clean_stderr(text: str) -> str:
    lines = []
    skip_prefixes = (
        "WARNING: Logging before InitGoogleLogging",
        "*** Check failure stack trace",
    )
    for line in text.splitlines():
        if any(line.startswith(prefix) for prefix in skip_prefixes):
            continue
        if re.match(r"^\s*@\s+0x", line):
            continue
        lines.append(line)
    return "\n".join(lines).strip()


def render_svg(dot: str, work: Path) -> str | None:
    try:
        proc = subprocess.run(
            ["dot", "-Tsvg"],
            input=dot,
            capture_output=True,
            text=True,
            timeout=10,
            env=mentor_env(),
            cwd=work,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        return None
    if proc.returncode != 0 or not proc.stdout:
        return None
    return proc.stdout


@app.after_request
def no_store(response):
    response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/")
def index():
    return send_from_directory(STATIC, "index.html")


@app.get("/api/meta")
def meta():
    return jsonify({"kinds": KINDS, "commands": COMMANDS})


@app.get("/api/examples")
def examples():
    return jsonify(list_examples())


@app.get("/api/guide")
def guide():
    if not GUIDE.exists():
        return jsonify({"error": "User guide not found."}), 404
    return jsonify({"text": GUIDE.read_text(encoding="utf-8")})


@app.post("/api/run")
def run():
    payload = request.get_json(force=True, silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "Invalid JSON."}), 400
    try:
        result = run_mentor(
            str(payload.get("kind", "")).lower(),
            str(payload.get("source", "")),
            str(payload.get("command", "")),
            input_string=payload.get("string"),
            number=_optional_int(payload.get("number")),
            steps=_optional_int(payload.get("steps")),
            compare_kind=_optional_str(payload.get("compare_kind")),
            compare_source=_optional_str(payload.get("compare_source")),
            accept_words=_optional_list(payload.get("accept_words")),
            reject_words=_optional_list(payload.get("reject_words")),
        )
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid number."}), 400
    return jsonify(result)


@app.errorhandler(404)
def not_found(_err):
    return jsonify({"error": "Not found."}), 404


@app.errorhandler(413)
def too_large(_err):
    return jsonify({"error": "Request too large."}), 413


def _optional_int(value: object) -> int | None:
    if value is None or value == "":
        return None
    return int(value)


def _optional_str(value: object) -> str | None:
    if value is None:
        return None
    return str(value)


def _optional_list(value: object) -> list[str] | None:
    if value is None:
        return None
    if isinstance(value, list):
        return [str(item) for item in value]
    return [line for line in str(value).splitlines()]


def main() -> None:
    if not MENTOR.exists():
        raise SystemExit(f"Mentor CLI not found at {MENTOR}")
    print(f"Mentor workbench running at http://{HOST}:{PORT}")
    app.run(host=HOST, port=PORT, threaded=True)


if __name__ == "__main__":
    main()
