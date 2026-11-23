"""Checksum discovery.

We do NOT know for certain which checksum the Fiido D11 puts on the end of a
frame. Rather than guess and risk sending an invalid frame to the controller,
this module takes real frames captured from the bike and works out which simple
checksum is consistent across all of them.

Assumption: the last byte of each frame is a checksum over the bytes before it.
That is the common case for these controllers, but verify it on your own capture
before trusting any write.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

# A checksum candidate: a name and a function body -> single byte.
Candidate = Callable[[bytes], int]


def _sum8(body: bytes) -> int:
    return sum(body) & 0xFF


def _xor8(body: bytes) -> int:
    x = 0
    for b in body:
        x ^= b
    return x


def _twos_complement_sum(body: bytes) -> int:
    return (-sum(body)) & 0xFF


def _crc8(poly: int, init: int = 0x00) -> Candidate:
    def fn(body: bytes) -> int:
        crc = init
        for b in body:
            crc ^= b
            for _ in range(8):
                if crc & 0x80:
                    crc = ((crc << 1) ^ poly) & 0xFF
                else:
                    crc = (crc << 1) & 0xFF
        return crc

    return fn


# Named candidates, cheapest/most-likely first.
CANDIDATES: dict[str, Candidate] = {
    "sum8 (add all bytes, mod 256)": _sum8,
    "xor8 (xor all bytes)": _xor8,
    "twos_complement_sum": _twos_complement_sum,
    "crc8 poly=0x07 init=0x00": _crc8(0x07, 0x00),
    "crc8 poly=0x07 init=0xFF": _crc8(0x07, 0xFF),
    "crc8 poly=0x31 init=0x00": _crc8(0x31, 0x00),
    "crc8 poly=0x1D init=0xFF": _crc8(0x1D, 0xFF),
    "crc8 poly=0x8C init=0x00 (Dallas/Maxim-like)": _crc8(0x8C, 0x00),
}


@dataclass
class CrcResult:
    name: str
    matched: int
    total: int

    @property
    def is_consistent(self) -> bool:
        return self.total > 0 and self.matched == self.total


def test_candidates(frames: list[bytes]) -> list[CrcResult]:
    """For each candidate, count how many frames it correctly explains.

    A frame is 'explained' when candidate(frame[:-1]) == frame[-1].
    Only frames of length >= 2 are considered.
    """
    usable = [f for f in frames if len(f) >= 2]
    results: list[CrcResult] = []
    for name, fn in CANDIDATES.items():
        matched = sum(1 for f in usable if fn(f[:-1]) == f[-1])
        results.append(CrcResult(name=name, matched=matched, total=len(usable)))
    results.sort(key=lambda r: -r.matched)
    return results


def best(frames: list[bytes]) -> CrcResult | None:
    """The single consistent candidate, or None if none explains every frame."""
    for result in test_candidates(frames):
        if result.is_consistent:
            return result
    return None
