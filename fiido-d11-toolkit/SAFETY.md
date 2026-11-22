# Safety and legal

Read this before you send anything to the bike.

## The law (UK and EU)

A bike counts as a legal e-bike (EAPC / pedelec) only if motor assistance cuts
off at **25 km/h (15.5 mph)** and the motor is 250 W continuous. Raise the
assisted-speed cutoff above that and, on a public road, the machine is legally a
moped or motorcycle: it needs registration, insurance, a licence and a helmet,
and riding it without them is an offence. It almost certainly voids your
warranty and your insurance too.

This toolkit therefore **refuses to raise the speed limit above 25 km/h** unless
you pass an explicit flag that acknowledges all of the above. That choice, and
its consequences, are yours.

## The hardware risk

- The write protocol here is a **hypothesis** carried over from public work on
  the Fiido C11 Pro and M1 Pro 2025. **No one has verified it on a D11.**
- Sending a malformed or wrong-address frame to the motor controller or BMS can
  put it in a bad state. In the worst case the controller stops working and
  needs replacing. There is no undo.
- Because of that, the tool will not build a write frame until you have
  **calibrated the checksum from your own bike's real frames** (`calibrate-crc`).
  It still cannot guarantee the address or layout is right — only you can, by
  watching frames change on your hardware.

## The rules the tool enforces

1. Every write needs `--unsafe-writes` **and** you typing `I UNDERSTAND`.
2. `set-speed-limit` needs a calibrated checksum file to exist.
3. `set-speed-limit` above 25 km/h needs `--i-accept-illegal` on top of that.
4. Nothing is sent on connect, on scan, or on import.

## Sensible practice

- Close the official Fiido app first — the bike takes one connection at a time.
- Do all of your first session **read-only**: `scan`, `info`, `monitor`.
- Keep the bike on a stand, wheel off the ground, when you first test a write.
- Change one thing at a time and watch `monitor` to confirm the effect.
- Keep a copy of the original settings (photograph the app screens) so you can
  put them back.
