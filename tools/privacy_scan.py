"""Privacy scan: stops personal things from reaching this public repository.

Kiln is used with real prompts, LoRAs and folders, and the repo is public, so every commit is checked for:
  - paths into a personal folder (a Windows user folder, a Linux / macOS home folder)
  - e-mail addresses (except GitHub's noreply ones)
  - PNG pictures that carry generation text (a prompt, parameters, Kiln's name chunk) — i.e. someone's real render
  - your own private words: one regular expression per line in a file that is never committed, found at
    $KILN_PRIVATE_PATTERNS or .git/info/private-patterns (lines starting with # are comments). Matched ignoring case.

    python tools/privacy_scan.py --staged        # what's about to be committed (the pre-commit hook runs this)
    python tools/privacy_scan.py --message FILE  # a commit message (the commit-msg hook)
    python tools/privacy_scan.py --all           # every tracked file (before a release, and in CI)

Exit code 1 and a list of findings if anything matches. Standard library only.
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

GENERIC = [
    ("a path into a personal folder", re.compile(r"(?<![A-Za-z])[A-Za-z]:[\\/]+Users[\\/]+[^\\/\s\"']+", re.I)),
    ("a path into a home folder", re.compile(r"(?<![\w.])/(?:home|Users)/(?!Shared\b)[A-Za-z0-9_.-]+")),
    (
        "an e-mail address",
        re.compile(
            r"\b[A-Za-z0-9._%+-]+@(?!users\.noreply\.github\.com|anthropic\.com\b)[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b"
        ),
    ),
]
# text chunks a generator writes into a picture; any of them means the PNG is a real render with its prompt inside
PNG_TEXT_KEYS = {b"parameters", b"prompt", b"workflow", b"kiln_name", b"kiln_id", b"Comment", b"Description"}
# other people's files kept as they are (licences name their authors): only the private words apply there
THIRD_PARTY = ("app/vendor/", "app/fonts/licenses/")
BINARY = {".woff2", ".woff", ".ttf", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pyc"}


def git(*args: str) -> bytes:
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, check=True).stdout


def private_patterns() -> list[tuple[str, re.Pattern[str]]]:
    path = os.environ.get("KILN_PRIVATE_PATTERNS") or ROOT / ".git" / "info" / "private-patterns"
    try:
        lines = Path(path).read_text(encoding="utf-8").splitlines()
    except OSError:
        return []
    return [
        ("a private word", re.compile(x.strip(), re.I)) for x in lines if x.strip() and not x.lstrip().startswith("#")
    ]


def png_text_keys(data: bytes) -> set[bytes]:
    """The keys of a PNG's text chunks (tEXt / iTXt / zTXt)."""
    found, i = set(), 8
    while i + 8 <= len(data):
        n, kind = int.from_bytes(data[i : i + 4], "big"), data[i + 4 : i + 8]
        if kind in (b"tEXt", b"iTXt", b"zTXt"):
            found.add(data[i + 8 : i + 8 + min(n, 80)].split(b"\0", 1)[0])
        if kind == b"IEND":
            break
        i += 12 + n
    return found


def check_text(where: str, text: str, rules, first_line: int = 1) -> list[str]:
    if where.startswith(THIRD_PARTY):
        rules = [r for r in rules if r[0] == "a private word"]
    hits = []
    for lineno, line in enumerate(text.splitlines(), first_line):
        for what, rx in rules:
            m = rx.search(line)
            if m:
                hits.append(f"{where}:{lineno}: {what}: {m.group(0)[:60]}")
    return hits


def check_png(where: str, data: bytes) -> list[str]:
    keys = png_text_keys(data) & PNG_TEXT_KEYS
    return (
        [f"{where}: a picture with generation text inside ({', '.join(k.decode() for k in sorted(keys))})"]
        if keys
        else []
    )


def scan_staged(rules) -> list[str]:
    hits = []
    names = git("diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z").decode().split("\0")
    for name in filter(None, names):
        hits += check_text("file name", name, rules)
        if Path(name).suffix.lower() == ".png":
            hits += check_png(name, git("show", f":{name}"))
    # only the lines this commit adds — what's already in the repo was checked when it went in
    diff = git("diff", "--cached", "-U0", "--no-color", "--diff-filter=ACMR", "--", ".").decode("utf-8", "replace")
    current, lineno = "?", 0
    for line in diff.splitlines():
        if line.startswith("+++ "):
            current = line[6:] if line.startswith("+++ b/") else line[4:]
        elif line.startswith("@@"):
            m = re.search(r"\+(\d+)", line)
            lineno = int(m.group(1)) - 1 if m else 0
        elif line.startswith("+") and Path(current).suffix.lower() not in BINARY | {".png"}:
            lineno += 1
            hits += check_text(current, line[1:], rules, lineno)
    return hits


def scan_all(rules) -> list[str]:
    hits = []
    for name in filter(None, git("ls-files", "-z").decode().split("\0")):
        path, suffix = ROOT / name, Path(name).suffix.lower()
        if not path.is_file() or suffix in BINARY:
            continue
        data = path.read_bytes()
        hits += check_text("file name", name, rules)
        hits += check_png(name, data) if suffix == ".png" else check_text(name, data.decode("utf-8", "replace"), rules)
    return hits


def main(argv: list[str]) -> int:
    rules = GENERIC + private_patterns()
    if argv[:1] == ["--staged"]:
        hits = scan_staged(rules)
    elif argv[:1] == ["--all"]:
        hits = scan_all(rules)
    elif argv[:1] == ["--message"] and len(argv) == 2:
        text = Path(argv[1]).read_text(encoding="utf-8", errors="replace")
        hits = check_text("commit message", "\n".join(x for x in text.splitlines() if not x.startswith("#")), rules)
    else:
        print(__doc__)
        return 2
    if hits:
        print("Privacy scan: found something that shouldn't go into the public repo:\n  " + "\n  ".join(hits))
        print("\nIf a hit is a false alarm, reword it; never commit the real thing.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
