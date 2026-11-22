"""Thin BLE helpers built on bleak.

Everything here is read-only except `write_frame`, which the higher-level
commands only call after the user has opted in. Nothing in this module sends
data on import or on connect.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass

try:
    from bleak import BleakClient, BleakScanner
    from bleak.backends.characteristic import BleakGATTCharacteristic
except ImportError as exc:  # pragma: no cover - friendly message
    raise SystemExit(
        "The 'bleak' package is required. Install it with:\n"
        "    pip install bleak\n"
        "(or: pip install -r requirements.txt)"
    ) from exc


# A Fiido e-bike advertises a BLE name that starts with this prefix,
# e.g. "Fiido_D11", "Fiido_C11Pro". The app scans for the same thing.
FIIDO_NAME_PREFIX = "Fiido_"


@dataclass
class Found:
    """One device seen during a scan."""

    name: str
    address: str
    rssi: int | None

    @property
    def looks_like_fiido(self) -> bool:
        return (self.name or "").startswith(FIIDO_NAME_PREFIX)


async def scan(timeout: float = 8.0) -> list[Found]:
    """List nearby BLE devices. Fiido bikes float to the top."""
    results: list[Found] = []
    discovered = await BleakScanner.discover(timeout=timeout, return_adv=True)
    for address, (device, adv) in discovered.items():
        results.append(
            Found(
                name=device.name or adv.local_name or "",
                address=address,
                rssi=getattr(adv, "rssi", None),
            )
        )
    # Fiido-looking devices first, then by signal strength (strongest first).
    results.sort(key=lambda d: (not d.looks_like_fiido, -(d.rssi or -999)))
    return results


def describe_char(char: BleakGATTCharacteristic) -> str:
    """One readable line describing a GATT characteristic."""
    props = ",".join(char.properties)
    return f"handle=0x{char.handle:02x} uuid={char.uuid} [{props}]"


async def dump_gatt(client: BleakClient) -> list[str]:
    """Return a human-readable listing of all services/characteristics.

    Reads the value of any characteristic marked 'read'. Never writes.
    """
    lines: list[str] = []
    for service in client.services:
        lines.append(f"service {service.uuid}  ({service.description})")
        for char in service.characteristics:
            line = "  " + describe_char(char)
            if "read" in char.properties:
                try:
                    value = await client.read_gatt_char(char)
                    line += f"  value={value.hex(' ')}"
                    text = _printable(value)
                    if text:
                        line += f"  ascii='{text}'"
                except Exception as err:  # noqa: BLE001 - report, keep going
                    line += f"  (read failed: {err})"
            lines.append(line)
    return lines


def _printable(data: bytes) -> str:
    """ASCII of the bytes that are printable, else empty."""
    if all(32 <= b < 127 for b in data) and data:
        return data.decode("ascii")
    return ""


async def notify_handles(client: BleakClient) -> list[BleakGATTCharacteristic]:
    """Every characteristic that can send notifications."""
    chars: list[BleakGATTCharacteristic] = []
    for service in client.services:
        for char in service.characteristics:
            if "notify" in char.properties or "indicate" in char.properties:
                chars.append(char)
    return chars


async def write_frame(
    client: BleakClient, handle: int, data: bytes, response: bool = False
) -> None:
    """Send raw bytes to a characteristic.

    Fiido writes are 'write without response' (response=False). This is the only
    function in the toolkit that transmits to the bike. Callers gate it behind
    explicit user opt-in; it does no checking of its own on purpose, so the
    safety lives in one obvious place (the CLI), not scattered here.
    """
    await client.write_gatt_char(handle, data, response=response)


class Link:
    """Convenience async context manager around a connected bike."""

    def __init__(self, address: str, timeout: float = 20.0):
        self.address = address
        self.timeout = timeout
        self._client: BleakClient | None = None

    async def __aenter__(self) -> BleakClient:
        self._client = BleakClient(self.address, timeout=self.timeout)
        await self._client.connect()
        return self._client

    async def __aexit__(self, *exc) -> None:
        if self._client is not None:
            try:
                await self._client.disconnect()
            except Exception:  # noqa: BLE001 - disconnect best-effort
                pass
