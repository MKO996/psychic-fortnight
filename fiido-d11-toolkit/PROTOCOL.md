# Fiido BLE protocol — what is known, and what to verify

**Status for the D11: unverified.** Everything here is carried over from public
reverse-engineering of *other* Fiido models. Treat it as a starting hypothesis
and confirm each line against your own captured frames before trusting it.

## Confirmed on a real D11 (firmware V40, macOS + Python 3.14 + bleak 3.1.0)

Verified by running this toolkit's `scan` and `info` against an actual
`Fiido_D11`, and by `monitor` capturing zero frames while idle.

**GATT layout (differs from the C11 Pro / M1 Pro):**

- Control service `00010203-0405-0607-0809-0a0b0c0dffe0`
  - **notify**: handle `0x11`, characteristic `…ffe1` — the bike talks out here.
  - **write / write-without-response**: handle `0x0f`, characteristic `…ffe2`
    — the app sends in here.
  - The C11 Pro / M1 Pro used a single handle `0x12` for both. The D11 splits
    notify and write onto two handles. This is why the other models' handle
    numbers must not be trusted blind.
- Nordic Secure DFU service `0000fe59-0000-1000-8000-00805f9b34fb`
  - buttonless DFU characteristic `8ec90003-f315-4f60-9fb8-838830daea50` at
    handle `0x15` `[indicate, write]`.
  - The BLE module is a Nordic nRF chip. Firmware (e.g. **V40**) is delivered
    over BLE through this service — **not** over the handlebar USB port, which
    is a 5 V charging output only (confirmed: a USB cable to a Mac enumerates no
    device).
  - **Never write to handle `0x15`.** A write here can jump the module into its
    firmware bootloader. Listening (indicate) is harmless; writing is not.

**Behaviour: the D11 is poll-based.**

- Subscribing to the notify handle and sitting idle yields **no frames**, even
  with the bike powered on and buttons pressed. Confirmed twice.
- The host must send a request on the write handle (`0x0f`); the bike then
  replies on the notify handle (`0x11`). The public "burst poll" description of
  other models fits.
- Consequence: passive `monitor` alone cannot learn this bike's protocol. You
  need the exact poll bytes first.

**Frame format (CONFIRMED — captured from the official app on a D11, V40):**

```
46 64 <type> <register> <data...> <xor>
```

- `46 64` — fixed header.
- `<type>` — `0x55` read request (host→bike), `0xFF` set (host→bike),
  `0xAA` reply (bike→host).
- `<register>` — which value, e.g. `0x21` main state block, `0x06` serial/version
  string, `0x04`, `0x08`, `0x01`.
- `<xor>` — **checksum = XOR of every byte before it.** Verified on many frames,
  reads and replies alike. (The toolkit's `calibrate-crc` also lands on `xor8`.)

ATT value handles in the app's own traffic: writes go to **`0x0010`**, the bike
notifies on **`0x0012`** — which are the value handles of the `ffe2` (write) and
`ffe1` (notify) characteristics `info` lists. bleak addresses these by
characteristic, so it targets them correctly.

**Reads are a request/reply pair.** Host writes a `0x55` frame to `ffe2`; bike
answers with a matching `0xAA` frame on `ffe1`. The bike does not stream
unsolicited — no poll, no reply.

Read requests captured verbatim from the app (safe to replay — they change
nothing; this is what `poll` sends):

| Host read request | Bike reply (example) | Meaning |
|---|---|---|
| `46 64 55 21 1C 4A` | `46 64 AA 21 1C 00 00 07 CB …` | main state block (~28 bytes) |
| `46 64 55 06 D4 A5` | `46 64 AA 06 D4 30 31 32 33 34 35 5B` | serial/version (`30 31 32 33 34 35` = "012345") |
| `46 64 55 04 05 76` | `46 64 AA 04 05 01 02 03 04 8D` | register 0x04 |
| `46 64 55 08 60 1F` | `46 64 AA 08 60 20 28 00 00 00 00 00 34 DC` | register 0x08 |

**Set (write) commands** use type `0xFF` and the bike echoes the value back:

| Host set | Bike echo |
|---|---|
| `46 64 FF 01 25 50 A9` | `46 64 AA 01 25 50 FC` |

Set `0x01` here carried value `25 50`. The meaning of each register's bytes
(which is speed, battery, assist level, the speed-limit setting) still has to be
read off by correlating `poll` output with known readings — that is the next
decode step, and it is read-only.

**How this was obtained:** by capturing the official iOS app with Apple's
PacketLogger (iOS trace), filtering to the bike's address, and reading the
plaintext ATT writes/notifications. No bytes were guessed at the controller.

## Where this comes from

The most complete public description of the Fiido app's BLE protocol is the
`dzikus/esphome-fiido-bms` project, which documents it in its `PROTOCOL.md` and
states it was "developed and verified empirically on a Fiido C11 Pro and a Fiido
M1 Pro 2025." It also warns the K1/Kidz line uses a different layout, and that
other adult models are "likely compatible but untested." The D11 is one of those
untested models.

- https://github.com/dzikus/esphome-fiido-bms

This toolkit does not copy that project's code. It re-implements discovery from
scratch and keeps the protocol facts as hypotheses to check, with credit above.

## Candidate facts to test on a D11

| Thing | Value on C11 Pro / M1 Pro (public RE) | How to confirm on your D11 |
|---|---|---|
| BLE name | starts `Fiido_` | `scan` — you saw `Fiido_D11` |
| Notify handle | `0x12` | `info` — look for a `notify` characteristic |
| Write handle | `0x12`, write-without-response | `info` — a `write-without-response` characteristic |
| Frame header | `46 64` | `monitor`, then `decode` — see if frames start `46 64` |
| Write frame | `46 64 <type> <len> <addr> <payload> <crc>` | build nothing until checksum is calibrated |
| Write type byte | `AA` (one path), `FF` (another) | unknown on D11 |
| Speed-limit address | `0x3C`, value in km/h | watch the frame while you read the app's 25 km/h |
| Gear count address | `0x25` (3 vs 5 as a nibble pair) | toggle Three/Five in the app, watch which byte flips |
| Motor info address | `0x96` (version, wheel, temp, rated power) | compare to the app's info screen |
| Checksum | not stated — **you must calibrate it** | `calibrate-crc` on your captured log |

## Method to verify (safe, read-only)

1. `monitor --log ride.log`, then in the app toggle **Maximum Gear Mode** between
   Three and Five. Find the byte that changes. That is your gear-count field.
2. With `monitor` still running, open **Debug Mode** (it shows 25 km/h). The
   speed-limit value should appear as `0x19` (= 25) somewhere. That is your
   speed-limit field and address.
3. Ride a short distance watching `monitor`: the bytes that track your speed and
   battery are your live telemetry fields.
4. `calibrate-crc ride.log` to learn the checksum. Only now is a write frame
   even constructible.

Record what you confirm back into this table. That turned-from-hypothesis-into-
fact table is the real deliverable — and it is specific to your bike.

## Open questions for the D11 specifically

- Is the handlebar **USB** port only a 5 V charging output, or does it expose any
  data? (The manuals call it a charging/output port. No data use is documented.)
- Does firmware **V40** change any address or add a field versus older firmware?
- Does **Maximum Gear Mode: Five** touch the cutoff, or only the number of assist
  levels? (On other models, gear count and speed limit are separate settings.)
