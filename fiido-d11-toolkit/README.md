# Fiido D11 Toolkit

Open-source, **read-first** Bluetooth diagnostics for Fiido e-bikes, with a
gated path to change documented settings once the protocol is verified on your
own bike.

It speaks the same BLE link the official Fiido app uses. It runs on your own
computer with a Bluetooth adapter — it reads telemetry, logs the raw frames so
you can learn the protocol, and (only after you opt in and calibrate the
checksum) can send a frame back.

> **Before anything else, read [SAFETY.md](SAFETY.md).** Raising the
> assisted-speed limit above 25 km/h is illegal on UK/EU roads and voids
> warranty and insurance. Sending a wrong frame can brick the controller. This
> tool is for your own bike and your own risk.

## What it does

| Command | What it does | Writes to bike? |
|---|---|---|
| `scan` | find nearby bikes (a `Fiido_*` name) | no |
| `info` | list every BLE service/characteristic with handles | no |
| `monitor` | subscribe to notifications, print + log every frame | no |
| `poll` | ask the bike for live state and decode it (assist, battery, …) | read-only\* |
| `decode` | annotate a saved log with a conservative decoder | no |
| `calibrate-crc` | work out the checksum from a real capture | no |
| `send-raw` | send one raw hex frame | yes — gated |
| `set-speed-limit` | build + send a speed-limit frame | yes — gated |

The write commands do nothing unless you pass `--unsafe-writes` and type a
confirmation, and `set-speed-limit` additionally needs a calibrated checksum.

\* `poll` transmits only the official app's own **read** requests (frame type
`0x55`), which ask the bike to report its state and change no setting. The
protocol it uses is confirmed on a real D11 — see [PROTOCOL.md](PROTOCOL.md).

## Install

Needs Python 3.10+ and a working Bluetooth adapter.

```bash
cd fiido-d11-toolkit
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

- **macOS:** grant your terminal Bluetooth permission (System Settings →
  Privacy & Security → Bluetooth) the first time.
- **Linux:** uses BlueZ; no extra driver needed on most distros.
- **Windows:** works on Windows 10/11 built-in Bluetooth.

## Use it (safe path)

```bash
# 1. Close the official Fiido app. Then find the bike:
python -m fiido_d11 scan

# 2. List its Bluetooth layout (note the notify + write handles):
python -m fiido_d11 info --address AA:BB:CC:DD:EE:FF

# 3. Record frames while you ride / toggle Three-Five / open Debug Mode:
python -m fiido_d11 monitor --address AA:BB:CC:DD:EE:FF --log ride.log

# 4. See what the frames might mean, and learn the checksum:
python -m fiido_d11 decode --log ride.log
python -m fiido_d11 calibrate-crc ride.log
```

Follow [PROTOCOL.md](PROTOCOL.md) to turn each guessed field into a confirmed
one for *your* D11. That confirmed table is the point of the exercise.

## Writes (only after the above)

Covered in SAFETY.md. In short: keep the wheel off the ground, change one thing,
watch `monitor`, and never raise the limit above the legal maximum on the road.

## How to use it as a Claude Code skill

`SKILL.md` makes this a Claude Code skill. To install it:

```bash
mkdir -p ~/.claude/skills/fiido-d11
cp -r fiido-d11-toolkit/* ~/.claude/skills/fiido-d11/
```

Then Claude can drive the safe workflow for you and keep the write rules.

## Credit

Protocol groundwork is public reverse-engineering of other Fiido models,
chiefly [`dzikus/esphome-fiido-bms`](https://github.com/dzikus/esphome-fiido-bms)
(tested on C11 Pro / M1 Pro). This project re-implements discovery from scratch
and treats those facts as hypotheses to verify on a D11. See PROTOCOL.md.

## Licence

MIT — see [LICENSE](LICENSE). No warranty. Use on your own bike at your own risk.
