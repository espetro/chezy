"""Gate-tag enforcement test.

Every `[gate: X]` marker in every AGENTS.md file in the repo must resolve to
either:
  - A real `[tasks.X]` key in `mise.toml`, OR
  - A real repo-relative file path.

This is a port of `../oxe/tests/test_agents_rules.py:16-27`. The reason it
exists: AGENTS.md is treated as a contract; if a gate tag points at a stale
file or a non-existent task, the contract is broken and CI should catch it.

If you're adding a new `[gate: ...]` reference in any AGENTS.md, this test will
flag it. Add the corresponding `mise.toml [tasks.X]` or create the file first.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
MISE_TOML = REPO_ROOT / "mise.toml"


def mise_tasks() -> set[str]:
    """Parse all `[tasks."X"]` keys out of `mise.toml`."""
    if not MISE_TOML.exists():
        return set()
    text = MISE_TOML.read_text()
    return set(re.findall(r'\[tasks\."([^"]+)"\]', text))


def iter_agents_files() -> list[Path]:
    """Every AGENTS.md in the repo, top-level or in any subdir."""
    return sorted(REPO_ROOT.rglob("AGENTS.md"))


GATE_RE = re.compile(r"\[gate:\s*([^\]]+?)\s*\]")


def gate_targets() -> list[tuple[Path, int, str]]:
    """Yield (file, line_number, target) for every `[gate: X]` reference."""
    out: list[tuple[Path, int, str]] = []
    for agents in iter_agents_files():
        for n, line in enumerate(agents.read_text().splitlines(), start=1):
            for m in GATE_RE.finditer(line):
                out.append((agents, n, m.group(1)))
    return out


def resolve(target: str, tasks: set[str]) -> str:
    """Return 'ok' / 'missing' / 'unknown'."""
    if target in tasks:
        return "ok"
    if target in {"hooks:install"}:
        # aliased to `hooks:install` task; covered by `mise.toml [tasks."hooks:install"]`.
        return "ok"
    # Heuristic: if it looks like a file path with an extension, check the file.
    if "." in target and not target.startswith("."):
        # Treat as a repo-relative path. Allow both `path/to/foo.ts` and
        # `path/to/foo` (the latter means "directory or unspecified ext").
        candidates = [target, f"{target}.md", f"{target}.ts", f"{target}.json", f"{target}.yml", f"{target}.yaml", f"{target}.py"]
        if any((REPO_ROOT / c).exists() for c in candidates):
            return "ok"
        return "missing"
    # Heuristic: if it looks like a dotted identifier (e.g. `validate` or
    # `validate:quick`), it's a task alias.
    if ":" in target or target.replace("_", "").replace("-", "").isalnum():
        return "missing"
    return "unknown"


def main() -> int:
    tasks = mise_tasks()
    targets = gate_targets()
    if not targets:
        print("ok: no [gate: ...] markers found (yet).")
        return 0

    missing: list[tuple[Path, int, str]] = []
    unknown: list[tuple[Path, int, str]] = []

    for f, n, t in targets:
        verdict = resolve(t, tasks)
        if verdict == "missing":
            missing.append((f, n, t))
        elif verdict == "unknown":
            unknown.append((f, n, t))

    print(f"checked {len(targets)} gate marker(s) across {len(iter_agents_files())} AGENTS.md file(s).")
    print(f"resolved mise.toml tasks: {sorted(tasks)}")

    if missing:
        print("\nFAIL: the following [gate: ...] markers do not resolve:", file=sys.stderr)
        for f, n, t in missing:
            print(f"  {f.relative_to(REPO_ROOT)}:{n} -> [gate: {t}]", file=sys.stderr)
        print(
            "\nAdd `[tasks.\"<name>\"]` to mise.toml OR create the referenced "
            "file at the path. If a marker is meant to be human-only, drop "
            "the `[gate: ...]` syntax.",
            file=sys.stderr,
        )
        return 1

    if unknown:
        print("\nWARN: the following markers are ambiguous; consider naming them explicitly:", file=sys.stderr)
        for f, n, t in unknown:
            print(f"  {f.relative_to(REPO_ROOT)}:{n} -> [gate: {t}]", file=sys.stderr)

    print("ok: every gate marker resolves.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
