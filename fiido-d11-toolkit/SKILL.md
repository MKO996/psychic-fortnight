---
name: fiido-d11
description: >
  Connect to a Fiido D11 (or other Fiido_* BLE e-bike) over Bluetooth to read
  diagnostics and, once the protocol is verified on that exact bike, change
  documented settings. Use when the user wants to scan, connect to, read
  telemetry from, log frames from, reverse-engineer, or reprogram their own
  Fiido e-bike. Read-only by default; writes are gated and never automatic.
---

# Fiido D11 toolkit

This skill drives `fiido_d11`, a Python command-line tool that talks to a Fiido
e-bike over Bluetooth Low Energy (BLE). It runs on the user's own computer with
a Bluetooth adapter. It does NOT run in a cloud container — a cloud session has
no radio and cannot see the bike.

## Hard rules (do not break these)

1. **Read first, always.** Start with `scan`, `info`, and `monitor`. Never send
   a write until the user has captured frames from their own bike and the
   protocol is verified for that hardware.
2. **Writes are off by default.** Any write needs the explicit `--unsafe-writes`
   flag and a typed confirmation. Never add that flag on the user's behalf to
   "save a step." Ask the user to confirm each write themselves.
3. **No blind frames.** The tool refuses to build a write frame unless a CRC has
   been calibrated from that bike's real captured frames (`calibrate-crc`).
   Do not work around this. A wrong frame can brick the controller.
4. **Legal limit.** Do not help raise the assisted-speed cutoff above the legal
   limit (25 km/h / 15.5 mph in the UK and EU). If the user asks, state the law
   and the warranty/insurance consequence once, plainly, and let them decide. Do
   not build or run a "derestrict" command.
5. **One bike at a time.** The bike accepts a single BLE connection. Tell the
   user to close the official Fiido app before connecting.

## Normal workflow

1. `python -m fiido_d11 scan` — find the bike. Look for a name starting
   `Fiido_`. Note its address.
2. `python -m fiido_d11 info --address <addr>` — list every GATT service and
   characteristic, with handles and properties. This identifies the notify and
   write handles for this specific bike.
3. `python -m fiido_d11 monitor --address <addr> --log ride.log` — subscribe to
   all notify characteristics and record every frame while the user rides,
   changes assist level, toggles the light, etc. The log is how the protocol is
   learned.
4. `python -m fiido_d11 calibrate-crc ride.log` — work out which checksum the
   bike uses from the captured frames, before any write is possible.
5. Decode: read `PROTOCOL.md` with the user, match captured frames to the
   candidate field map, and confirm each field on their bike.

Only after all of that, and only if the user insists, discuss writes.

## What to tell the user

- This is for their own bike, for diagnostics and learning.
- The D11 protocol here is a *hypothesis* carried over from public work on the
  Fiido C11 Pro and M1 Pro. It must be confirmed on their D11.
- Keep the first full battery of testing read-only.

See `README.md` for install and `SAFETY.md` for the full safety and legal note.
