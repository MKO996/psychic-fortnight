"""Command-line entry point.

    python -m fiido_d11 <command> [options]

Commands, safest first:
    scan            find nearby bikes
    info            connect and list GATT services/characteristics (read-only)
    monitor         subscribe to notifications and log every frame (read-only)
    decode          annotate a saved log with the conservative decoder
    calibrate-crc   work out the checksum from a captured log
    send-raw        send one raw hex frame   (needs --unsafe-writes)
    set-speed-limit build+send a speed-limit frame (needs --unsafe-writes + CRC)

All write paths are off unless --unsafe-writes is given and you type the
confirmation. See SAFETY.md.
"""

from __future__ import annotations

import argparse
import asyncio
import sys

from . import __version__, crc, frames
from .ble import Link, dump_gatt, find_control_chars, notify_handles, scan, write_frame

LEGAL_LIMIT_KMH = 25  # UK / EU assisted-speed limit for a legal e-bike.


# --------------------------------------------------------------------------- #
# Read-only commands
# --------------------------------------------------------------------------- #

async def cmd_scan(args: argparse.Namespace) -> int:
    print(f"Scanning for {args.timeout:.0f}s ... (close the official Fiido app)")
    found = await scan(timeout=args.timeout)
    if not found:
        print("No BLE devices seen. Is Bluetooth on? Is the bike awake?")
        return 1
    print()
    for d in found:
        star = "  <-- looks like a Fiido bike" if d.looks_like_fiido else ""
        rssi = f"{d.rssi} dBm" if d.rssi is not None else "   ?   "
        name = d.name or "(no name)"
        print(f"  {rssi:>8}  {d.address}  {name}{star}")
    print()
    print("Next: python -m fiido_d11 info --address <address>")
    return 0


async def cmd_info(args: argparse.Namespace) -> int:
    print(f"Connecting to {args.address} ...")
    async with Link(args.address) as client:
        print("Connected. Services and characteristics:\n")
        for line in await dump_gatt(client):
            print(line)
        chars = await notify_handles(client)
        print("\nCharacteristics that can notify (watch these with 'monitor'):")
        for c in chars:
            print(f"  handle=0x{c.handle:02x} uuid={c.uuid}")
    print("\nNext: python -m fiido_d11 monitor --address <address> --log ride.log")
    return 0


async def cmd_monitor(args: argparse.Namespace) -> int:
    logfile = open(args.log, "a", encoding="utf-8") if args.log else None
    seen = 0

    def handle(sender, data: bytearray) -> None:
        nonlocal seen
        seen += 1
        source = getattr(sender, "uuid", str(sender))
        frame = frames.now_line(str(source), bytes(data))
        print(frame.line())
        if logfile:
            logfile.write(frame.line() + "\n")
            logfile.flush()

    print(f"Connecting to {args.address} ...")
    async with Link(args.address) as client:
        chars = await notify_handles(client)
        if not chars:
            print("No notify characteristics found. Run 'info' first.")
            return 1
        for c in chars:
            await client.start_notify(c, handle)
        where = f" -> {args.log}" if args.log else ""
        print(f"Listening on {len(chars)} characteristic(s){where}. Ctrl+C to stop.")
        print("Ride, change assist level, toggle the light — make the bike talk.\n")
        try:
            while True:
                await asyncio.sleep(1.0)
        except (KeyboardInterrupt, asyncio.CancelledError):
            print(f"\nStopped. {seen} frame(s) captured.")
        finally:
            if logfile:
                logfile.close()
    return 0


async def cmd_poll(args: argparse.Namespace) -> int:
    """Ask the bike for live state by replaying the app's own read requests.

    Read-only in effect: every frame sent is type 0x55 (a read). None of them
    changes a setting. This is the 'access the bike' path.
    """
    print(f"Connecting to {args.address} ...")
    async with Link(args.address) as client:
        write_c, notify_c = await find_control_chars(client)
        if write_c is None or notify_c is None:
            print("Could not find the ffe2/ffe1 control characteristics. Run 'info'.")
            return 1

        def handle(sender, data: bytearray) -> None:
            parsed = frames.split_reply(bytes(data))
            if parsed is None:
                print(f"  frame      {bytes(data).hex(' ')}")
                return
            typ, reg, payload, ok = parsed
            flag = "ok " if ok else "BAD"
            print(f"  type=0x{typ:02x} reg=0x{reg:02x} [{flag}]  {payload.hex(' ')}")

        await client.start_notify(notify_c, handle)
        print("Sending the app's own read requests (type 0x55, read-only). Ctrl+C to stop.\n")
        try:
            while True:
                for frame in frames.KNOWN_READ_FRAMES:
                    # response=True matches the app's "Write Request".
                    await write_frame(client, write_c, frame, response=True)
                    await asyncio.sleep(0.25)
                if not args.loop:
                    await asyncio.sleep(0.6)
                    break
                await asyncio.sleep(0.5)
        except (KeyboardInterrupt, asyncio.CancelledError):
            print("\nStopped.")
    return 0


def cmd_decode(args: argparse.Namespace) -> int:
    text = open(args.log, encoding="utf-8").read()
    parsed = frames.parse_log_frames(text)
    if not parsed:
        print("No frames found in that log.")
        return 1
    # Show each distinct frame once, with its decode.
    seen: set[bytes] = set()
    for f in parsed:
        if f in seen:
            continue
        seen.add(f)
        d = frames.decode(f)
        print(f"\n{f.hex(' ')}")
        print(f"  {d.note}")
        for k, v in d.fields.items():
            print(f"    {k}: {v}")
    print(f"\n{len(seen)} distinct frame(s) of {len(parsed)} total.")
    return 0


def cmd_calibrate_crc(args: argparse.Namespace) -> int:
    text = open(args.log, encoding="utf-8").read()
    parsed = frames.parse_log_frames(text)
    if len(parsed) < 3:
        print("Need at least a few captured frames. Run 'monitor' longer first.")
        return 1
    print(f"Testing checksums against {len(parsed)} captured frame(s)...\n")
    for r in crc.test_candidates(parsed):
        mark = "  <-- matches ALL frames" if r.is_consistent else ""
        print(f"  {r.matched:>4}/{r.total}  {r.name}{mark}")
    winner = crc.best(parsed)
    print()
    if winner:
        with open(args.out, "w", encoding="utf-8") as fh:
            fh.write(winner.name + "\n")
        print(f"Consistent checksum: {winner.name}")
        print(f"Saved to {args.out}. Writes can use this.")
    else:
        print("No single checksum explained every frame.")
        print("The last byte may not be a plain checksum, or the capture mixes")
        print("frames with different layouts. Do NOT attempt writes yet.")
    return 0


# --------------------------------------------------------------------------- #
# Write commands (gated)
# --------------------------------------------------------------------------- #

def _require_optin(args: argparse.Namespace) -> bool:
    if not args.unsafe_writes:
        print("Refusing: this command writes to the bike.")
        print("Re-run with --unsafe-writes once you understand SAFETY.md.")
        return False
    print("!! This will TRANSMIT to your bike's controller.")
    print("!! A wrong frame can brick it. This is your own bike, your risk.")
    reply = input("Type exactly  I UNDERSTAND  to continue: ").strip()
    if reply != "I UNDERSTAND":
        print("Not confirmed. Nothing sent.")
        return False
    return True


async def cmd_send_raw(args: argparse.Namespace) -> int:
    if not _require_optin(args):
        return 1
    try:
        data = bytes.fromhex(args.hex.replace(":", " "))
    except ValueError:
        print("Could not parse --hex. Give bytes like '46 64 aa 01 3c 19'.")
        return 1
    print(f"Sending {data.hex(' ')} to handle 0x{args.handle:02x} ...")
    async with Link(args.address) as client:
        await write_frame(client, args.handle, data, response=False)
    print("Sent (write-without-response: the bike sends no acknowledgement).")
    print("Watch 'monitor' in another terminal to see if anything changed.")
    return 0


def _load_crc(path: str):
    try:
        name = open(path, encoding="utf-8").read().strip()
    except FileNotFoundError:
        return None
    return crc.CANDIDATES.get(name), name


async def cmd_set_speed_limit(args: argparse.Namespace) -> int:
    # Legal gate, stated plainly, before anything else.
    if args.kmh > LEGAL_LIMIT_KMH and not args.i_accept_illegal:
        print(f"Refusing: {args.kmh} km/h is above the {LEGAL_LIMIT_KMH} km/h legal")
        print("limit for an e-bike in the UK and EU. Above it the bike is no longer")
        print("road-legal, and this likely voids warranty and insurance.")
        print("This tool will not help with that by default.")
        return 2

    loaded = _load_crc(args.crc_file)
    if not loaded or loaded[0] is None:
        print("No calibrated checksum. Run 'calibrate-crc' on a real capture first.")
        print("Without the correct checksum, any frame sent would be invalid and")
        print("could be rejected or mishandled by the controller.")
        return 1
    crc_fn, crc_name = loaded

    # Build a CANDIDATE frame from the public C11/M1 layout. This is a hypothesis
    # for the D11: 46 64 <type> <len> <addr=0x3c SPEEDLIM> <value> <crc>.
    body = bytes([0x46, 0x64, 0xAA, 0x01, 0x3C, args.kmh & 0xFF])
    frame = body + bytes([crc_fn(body)])

    print("CANDIDATE speed-limit frame (verify before trusting):")
    print(f"  {frame.hex(' ')}")
    print(f"  checksum used: {crc_name}")
    print("  layout assumed: header 46 64 | type aa | len 01 | addr 3c | "
          f"value {args.kmh:#04x} | crc")
    print("  This layout is from other Fiido models, NOT confirmed on the D11.")
    print()

    if not _require_optin(args):
        return 1

    async with Link(args.address) as client:
        await write_frame(client, args.handle, frame, response=False)
    print("Sent. The bike sends no acknowledgement for a write.")
    print("Check the result with the in-app Debug Mode speed readout and a GPS test.")
    return 0


# --------------------------------------------------------------------------- #
# Arg parsing
# --------------------------------------------------------------------------- #

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="fiido_d11", description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--version", action="version", version=f"fiido_d11 {__version__}")
    sub = p.add_subparsers(dest="command", required=True)

    s = sub.add_parser("scan", help="find nearby bikes")
    s.add_argument("--timeout", type=float, default=8.0)
    s.set_defaults(func=cmd_scan, is_async=True)

    s = sub.add_parser("info", help="list GATT services (read-only)")
    s.add_argument("--address", required=True)
    s.set_defaults(func=cmd_info, is_async=True)

    s = sub.add_parser("monitor", help="log notifications (read-only)")
    s.add_argument("--address", required=True)
    s.add_argument("--log", default=None, help="append frames to this file")
    s.set_defaults(func=cmd_monitor, is_async=True)

    s = sub.add_parser("poll", help="ask the bike for live state (read-only, type 0x55)")
    s.add_argument("--address", required=True)
    s.add_argument("--once", dest="loop", action="store_false",
                   help="send one round of reads instead of looping")
    s.set_defaults(func=cmd_poll, is_async=True, loop=True)

    s = sub.add_parser("decode", help="annotate a saved log")
    s.add_argument("--log", required=True)
    s.set_defaults(func=cmd_decode, is_async=False)

    s = sub.add_parser("calibrate-crc", help="find the checksum from a log")
    s.add_argument("log", help="a monitor log file")
    s.add_argument("--out", default="crc.txt", help="where to save the result")
    s.set_defaults(func=cmd_calibrate_crc, is_async=False)

    s = sub.add_parser("send-raw", help="send one raw hex frame (gated)")
    s.add_argument("--address", required=True)
    s.add_argument("--handle", required=True, type=lambda x: int(x, 0),
                   help="write handle, e.g. 0x12 (from 'info')")
    s.add_argument("--hex", required=True, help="bytes, e.g. '46 64 aa 01 3c 19'")
    s.add_argument("--unsafe-writes", action="store_true")
    s.set_defaults(func=cmd_send_raw, is_async=True)

    s = sub.add_parser("set-speed-limit", help="build+send a speed-limit frame (gated)")
    s.add_argument("--address", required=True)
    s.add_argument("--handle", required=True, type=lambda x: int(x, 0))
    s.add_argument("--kmh", required=True, type=int)
    s.add_argument("--crc-file", default="crc.txt")
    s.add_argument("--unsafe-writes", action="store_true")
    s.add_argument("--i-accept-illegal", action="store_true",
                   help="acknowledge raising the limit above the legal maximum")
    s.set_defaults(func=cmd_set_speed_limit, is_async=True)

    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        if args.is_async:
            return asyncio.run(args.func(args))
        return args.func(args)
    except KeyboardInterrupt:
        print("\nInterrupted.")
        return 130


if __name__ == "__main__":
    sys.exit(main())
