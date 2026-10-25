"""Proof that reformatting an HTML file changed nothing the browser renders.

Compares the element tree, every attribute, all text, and — between elements — whether whitespace is present at all
(its amount collapses to one space; its presence can add a gap between inline elements). Inside <pre>, <textarea>,
<script> and <style> text must match exactly.
    python tools/dev/html-same.py . HEAD index.html
"""

import re
import subprocess
import sys
from html.parser import HTMLParser

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}
RAW = {"pre", "textarea", "script", "style"}


def norm(k, v):
    """attribute values the browser reads the same: class lists by their words, inline styles without layout spaces"""
    v = v or ""
    if k == "class":
        return " ".join(v.split())
    if k == "style":
        return re.sub(r"\s*([:;,])\s*", r"\1", v.strip()).rstrip(";")
    return v


class Tree(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out, self.stack = [], []

    def handle_starttag(self, tag, attrs):
        self.out.append(("<", tag, tuple(sorted((k, norm(k, v)) for k, v in attrs))))
        if tag not in VOID:
            self.stack.append(tag)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID and self.stack and self.stack[-1] == tag:
            self.stack.pop()
            self.out.append((">", tag))

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        while self.stack and self.stack.pop() != tag:
            pass
        self.out.append((">", tag))

    def handle_data(self, data):
        if any(t in RAW for t in self.stack):
            self.out.append(("raw", data))
        elif data.strip():
            # text: inner runs of whitespace collapse; whitespace at its edges is a whitespace position like any other
            if data[:1].isspace():
                self.out.append(("ws",))
            self.out.append(("text", " ".join(data.split())))
            if data[-1:].isspace():
                self.out.append(("ws",))
        else:
            self.out.append(("ws",))

    def handle_comment(self, data):
        pass


def tree(src):
    t = Tree()
    t.feed(src)
    t.close()
    # merge neighbouring text/whitespace items, as the browser does
    merged = []
    for item in t.out:
        if merged and item[0] == "ws" and merged[-1][0] == "ws":
            continue
        merged.append(item)
    return merged


repo, rev, f = sys.argv[1:4]
old = subprocess.run(["git", "show", f"{rev}:{f}"], cwd=repo, capture_output=True, encoding="utf-8").stdout
new = open(f"{repo}/{f}", encoding="utf-8").read()
a, b = tree(old), tree(new)
if a == b:
    print(f"same  {f}  ({old.count(chr(10))} → {new.count(chr(10))} lines, {len(a)} nodes)")
    sys.exit(0)
for i, (x, y) in enumerate(zip(a, b)):
    if x != y:
        print(f"DIFFERENT at node {i}:\n  before: {a[max(0, i - 2) : i + 3]}\n  after:  {b[max(0, i - 2) : i + 3]}")
        break
else:
    print(f"DIFFERENT: {len(a)} vs {len(b)} nodes")
sys.exit(1)
