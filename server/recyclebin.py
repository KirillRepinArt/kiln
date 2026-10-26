"""The Windows Recycle Bin: send a file there (never a hard delete), and find a file in it by its original path."""

from __future__ import annotations

import os
import struct
from pathlib import Path


def recycle(path: Path) -> bool:
    """Send a file to the Recycle Bin (Windows). Elsewhere — or in tests — it stays where it is (data/trash)."""
    if os.name != "nt" or os.environ.get("KILN_NO_RECYCLE"):  # tests: never fill the real Recycle Bin
        return False
    import ctypes
    from ctypes import wintypes

    class SHFILEOPSTRUCTW(ctypes.Structure):
        _fields_ = [  # ctypes reads this class attribute as the C struct's layout
            ("hwnd", wintypes.HWND),
            ("wFunc", wintypes.UINT),
            ("pFrom", wintypes.LPCWSTR),
            ("pTo", wintypes.LPCWSTR),
            ("fFlags", ctypes.c_uint16),
            ("fAnyOperationsAborted", wintypes.BOOL),
            ("hNameMappings", ctypes.c_void_p),
            ("lpszProgressTitle", wintypes.LPCWSTR),
        ]

    fo_delete = 3
    flags = 0x40 | 0x10 | 0x04 | 0x400  # ALLOWUNDO | NOCONFIRMATION | SILENT | NOERRORUI
    op = SHFILEOPSTRUCTW(None, fo_delete, str(path) + "\0", None, flags, False, None, None)
    return bool(ctypes.windll.shell32.SHFileOperationW(ctypes.byref(op)) == 0)


def find(dest: Path) -> tuple[Path, Path] | None:
    """Find a file in the Recycle Bin by its original path: ($I info file, $R data file), or None.
    Each deleted item is a pair in <drive>:\\$Recycle.Bin\\<user SID>\\ — $Ixxxx holds the original path
    (Windows 10+: version 2 header, then the path length and the UTF-16 path), $Rxxxx the file itself."""
    root = Path(os.environ.get("KILN_RECYCLE_ROOT") or (Path(dest).anchor + "$Recycle.Bin"))  # env: tests
    want = str(Path(dest)).lower()
    try:
        bins = [d for d in root.iterdir() if d.is_dir()]
    except OSError:
        return None
    for b in bins:
        try:
            infos = list(b.glob("$I*"))
        except OSError:
            continue
        for i in infos:
            try:
                raw = i.read_bytes()
                ver = struct.unpack("<q", raw[:8])[0]
                path = raw[28 : 28 + 2 * struct.unpack("<i", raw[24:28])[0]] if ver == 2 else raw[24:544]
                orig = path.decode("utf-16-le").split("\0")[0]
            except (OSError, struct.error, UnicodeDecodeError):
                continue
            r = i.with_name("$R" + i.name[2:])
            if orig.lower() == want and r.exists():
                return i, r
    return None
