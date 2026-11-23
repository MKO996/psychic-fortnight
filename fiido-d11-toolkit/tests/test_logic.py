"""Offline tests — no Bluetooth radio needed.

Run with:  python -m pytest   (or: python tests/test_logic.py)
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fiido_d11 import crc, frames  # noqa: E402


def _sum8_frame(body: bytes) -> bytes:
    return body + bytes([sum(body) & 0xFF])


def test_crc_finds_sum8():
    bodies = [b"\x46\x64\xaa\x01\x3c\x19", b"\x46\x64\x10\x01\x96\x40"]
    captured = [_sum8_frame(b) for b in bodies]
    result = crc.best(captured)
    assert result is not None
    assert "sum8" in result.name


def test_crc_none_when_inconsistent():
    # Last byte is random noise, not a checksum -> nothing explains all frames.
    noisy = [b"\x46\x64\xaa\x01\x3c\x19\x00", b"\x46\x64\x10\x01\x96\x40\x01"]
    assert crc.best(noisy) is None


def test_parse_log_roundtrip():
    frame = _sum8_frame(b"\x46\x64\xaa\x01\x3c\x19")
    line = "08:41:12.004  ffe1  " + frame.hex(" ")
    parsed = frames.parse_log_frames(line)
    assert parsed == [frame]


def test_decode_marks_unverified():
    d = frames.decode(b"\x46\x64\xaa\x01\x3c\x19\xaa")
    assert "address?" in d.fields
    assert "unverified" in d.fields["address?"]


def test_decode_unknown_framing():
    d = frames.decode(b"\x01\x02\x03")
    assert "No known framing" in d.note


def test_xor_checksum_on_real_d11_frames():
    # Frames captured from the official app on a real Fiido D11 (firmware V40).
    for hexstr in [
        "466455211c4a", "46645506d4a5", "466455040576", "46645508601f",
        "4664ff012550a9", "4664aa012550fc", "4664aa0405010203048d",
    ]:
        assert frames.check_frame(bytes.fromhex(hexstr)), hexstr


def test_known_read_frames_are_valid():
    assert all(frames.check_frame(f) for f in frames.KNOWN_READ_FRAMES)


def test_split_reply():
    typ, reg, payload, ok = frames.split_reply(bytes.fromhex("4664aa0405010203048d"))
    assert typ == 0xAA and reg == 0x04 and ok
    assert payload == bytes.fromhex("0501020304")


if __name__ == "__main__":
    passed = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print(f"ok  {name}")
            passed += 1
    print(f"\n{passed} test(s) passed.")
