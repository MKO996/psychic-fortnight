# A sample first session (read-only)

This shows the shape of the output. Your addresses, handles and frames will
differ. Nothing here writes to the bike.

```
$ python -m fiido_d11 scan
Scanning for 8s ... (close the official Fiido app)

   -52 dBm  CE:59:04:22:D6:94  Fiido_D11  <-- looks like a Fiido bike
   -78 dBm  40:11:22:33:44:55  (no name)

Next: python -m fiido_d11 info --address CE:59:04:22:D6:94
```

(The address `CE:59:04:22:D6:94` is the one shown on your app's Device Name
screen, so it is a good sanity check that you found the right bike.)

```
$ python -m fiido_d11 info --address CE:59:04:22:D6:94
Connected. Services and characteristics:

service 0000ffe0-0000-1000-8000-00805f9b34fb  (Vendor specific)
  handle=0x12 uuid=0000ffe1-...  [read,write-without-response,notify]  ...

Characteristics that can notify (watch these with 'monitor'):
  handle=0x12 uuid=0000ffe1-0000-1000-8000-00805f9b34fb
```

```
$ python -m fiido_d11 monitor --address CE:59:04:22:D6:94 --log ride.log
Listening on 1 characteristic(s) -> ride.log. Ctrl+C to stop.
Ride, change assist level, toggle the light — make the bike talk.

08:41:12.004  0000ffe1-0000-1000-8000-00805f9b34fb   46 64 ...
```

While this runs, in the official app toggle **Three / Five** and open **Debug
Mode**. The frame that changes when you toggle gears is your gear-count field;
the one holding `19` (= 25) when Debug Mode shows 25 km/h is your speed limit.

```
$ python -m fiido_d11 calibrate-crc ride.log
Testing checksums against 214 captured frame(s)...

   214/214  sum8 (add all bytes, mod 256)  <-- matches ALL frames
     7/214  xor8 (xor all bytes)
   ...
Consistent checksum: sum8 (add all bytes, mod 256)
Saved to crc.txt. Writes can use this.
```

Now, and only now, is a write frame even constructible — and even then, confirm
the address and layout against what you saw in `monitor` first.
