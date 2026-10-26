"""Text inside PNG files (where generators keep a picture's parameters), and telling image types apart."""

from __future__ import annotations

import struct
import zlib

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def is_png(data: bytes) -> bool:
    return data[:8] == PNG_SIGNATURE


def has_text(data: bytes, key: str) -> bool:
    """Does the PNG have a tEXt / iTXt chunk named `key`?"""
    i = 8
    while i < len(data):
        n = struct.unpack(">I", data[i : i + 4])[0]
        tag = data[i + 4 : i + 8]
        if tag in (b"tEXt", b"iTXt") and data[i + 8 : i + 8 + n].split(b"\0", 1)[0] == key.encode():
            return True
        if tag == b"IEND":
            break
        i += 12 + n
    return False


def add_text(data: bytes, key: str, text: str) -> bytes:
    """Insert an iTXt chunk (UTF-8) before IEND — Forge/A1111 'parameters' format."""
    payload = key.encode() + b"\0\0\0\0\0" + text.encode("utf-8")
    chunk = (
        struct.pack(">I", len(payload))
        + b"iTXt"
        + payload
        + struct.pack(">I", zlib.crc32(b"iTXt" + payload) & 0xFFFFFFFF)
    )
    end = data.rfind(b"IEND") - 4
    return data[:end] + chunk + data[end:]


def drop_text(data: bytes, key: str) -> bytes:
    """The PNG without its text chunk(s) named `key` (to replace one)."""
    out, i = data[:8], 8
    while i < len(data):
        n = struct.unpack(">I", data[i : i + 4])[0]
        tag = data[i + 4 : i + 8]
        if not (tag in (b"tEXt", b"iTXt") and data[i + 8 : i + 8 + n].split(b"\0", 1)[0] == key.encode()):
            out += data[i : i + 12 + n]
        if tag == b"IEND":
            break
        i += 12 + n
    return out


def image_type(data: bytes) -> str:
    """The media type of a picture, from its first bytes."""
    if data[:4] == b"\x89PNG":
        return "image/png"
    if data[:2] == b"\xff\xd8":
        return "image/jpeg"
    if data[8:12] == b"WEBP":
        return "image/webp"
    return "application/octet-stream"
