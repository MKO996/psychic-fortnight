"""Frame logging and a best-effort decoder.

The decoder is deliberately conservative: it labels only fields that are
well-attested in public reverse-engineering of other Fiido models. Anything it
is unsure of, it leaves as raw hex. Treat every decoded field on a D11 as a
hypothesis until you confirm it against a known reading (e.g. the display's own
speed/battery while you watch the frame change).
"""

from __future__ import annotations

import re
import time
from dataclasses import dataclass


@dataclass
class LoggedFrame:
    monotonic: float
    wall_clock: str
    source: str  # which characteristic (uuid or handle)
    data: bytes

    def line(self) -> str:
        return f"{self.wall_clock}  {self.source:<40}  {self.data.hex(' ')}"


def now_line(source: str, data: bytes) -> LoggedFrame:
    return LoggedFrame(
        monotonic=time.monotonic(),
        wall_clock=time.strftime("%H:%M:%S") + f".{int(time.time() * 1000) % 1000:03d}",
        source=source,
        data=bytes(data),
    )


# Parse a hex blob out of a saved log line (the part after the last run of
# two-or-more spaces). Used by calibrate-crc to re-read a log file.
_HEX_RE = re.compile(r"([0-9a-fA-F]{2}(?:[ :][0-9a-fA-F]{2})+)\s*$")


def parse_log_frames(text: str) -> list[bytes]:
    """Pull byte frames out of a monitor log file."""
    frames: list[bytes] = []
    for raw in text.splitlines():
        match = _HEX_RE.search(raw.strip())
        if not match:
            continue
        hexpart = match.group(1).replace(":", " ")
        try:
            frames.append(bytes(int(b, 16) for b in hexpart.split()))
        except ValueError:
            continue
    return frames


# ---------------------------------------------------------------------------
# Candidate field map. Carried over from public work on the Fiido C11 Pro and
# M1 Pro 2025 (see PROTOCOL.md). NOT confirmed on the D11. Used only to annotate
# a decode so you have something to check against, never to build a write.
# ---------------------------------------------------------------------------

CANDIDATE_HEADER = bytes([0x46, 0x64])  # "Fd"-ish framing seen on other models


@dataclass
class Decoded:
    note: str
    fields: dict[str, str]


def decode(data: bytes) -> Decoded:
    """Best-effort, conservative annotation of one frame.

    Returns raw-hex fields unless the frame matches the candidate framing, and
    even then marks everything 'unverified'.
    """
    fields: dict[str, str] = {"raw": data.hex(" "), "length": str(len(data))}

    if len(data) >= 2 and data[:2] == CANDIDATE_HEADER:
        fields["header"] = data[:2].hex(" ") + " (matches other-model framing)"
        if len(data) >= 5:
            fields["type?"] = f"0x{data[2]:02x} (unverified)"
            fields["payload_len?"] = f"0x{data[3]:02x} (unverified)"
            fields["address?"] = f"0x{data[4]:02x} (unverified)"
        note = (
            "Framing resembles the Fiido C11 Pro / M1 Pro protocol. "
            "Confirm each field on your D11 before trusting it."
        )
    else:
        note = "No known framing matched. Raw bytes only."

    return Decoded(note=note, fields=fields)


# ---------------------------------------------------------------------------
# CONFIRMED on a real Fiido D11 (firmware V40) by capturing the official app.
# Frame:  46 64 <type> <register> <data...> <xor>
#   type 0x55 = read request (host -> bike), 0xFF = set (host -> bike),
#   0xAA = reply (bike -> host). The last byte is XOR of all bytes before it.
# ---------------------------------------------------------------------------

HEADER = bytes([0x46, 0x64])


def xor8(data: bytes) -> int:
    """Checksum used by the D11: XOR of every byte."""
    x = 0
    for b in data:
        x ^= b
    return x


def check_frame(data: bytes) -> bool:
    """True if the frame has the header and a valid trailing XOR checksum."""
    return len(data) >= 4 and data[:2] == HEADER and xor8(data[:-1]) == data[-1]


def split_reply(data: bytes):
    """Return (type, register, payload, crc_ok) for a 46 64 .. frame, else None."""
    if len(data) < 5 or data[:2] != HEADER:
        return None
    return data[2], data[3], data[4:-1], xor8(data[:-1]) == data[-1]


# Read-request frames captured verbatim from the official app. Type 0x55 is a
# read: replaying these asks the bike to report state and changes nothing. We
# replay the exact bytes the app sent rather than construct new ones.
KNOWN_READ_FRAMES = [
    bytes.fromhex("466455211c4a"),  # register 0x21 - main state block (~28 bytes)
    bytes.fromhex("46645506d4a5"),  # register 0x06 - serial/version string
    bytes.fromhex("466455040576"),  # register 0x04
    bytes.fromhex("46645508601f"),  # register 0x08
]


# Field map for register 0x21 (the main state block), worked out by watching the
# bytes change on a real D11 while pressing the assist button and spinning.
# Offsets are into the reply payload (the bytes split_reply returns).
#   [11] assist/PAS level 1..5      - CONFIRMED (tracked the M button)
#   [8]  live motion sensor         - moves when wheel/cranks turn, 0 at rest
#   [9]  battery %                   - candidate (0x32=50 at ~half charge)
def decode_state(reg: int, payload: bytes) -> dict:
    """Label the fields we have confirmed. Unconfirmed ones carry a '?'."""
    labels: dict[str, object] = {}
    if reg == 0x21 and len(payload) >= 12:
        labels["assist"] = payload[11]       # 1..5, confirmed
        labels["motion_raw"] = payload[8]    # speed/pedal signal
        labels["battery?"] = payload[9]      # candidate
    elif reg == 0x04 and len(payload) >= 1:
        labels["gear_count"] = payload[0]    # 5 for "Maximum Gear Mode: Five"
    return labels
