#!/usr/bin/env python3
"""Generate placeholder icon assets if the real ones are missing.

The 6 icon PNGs (icon, splash, favicon, adaptive foreground/background/
monochrome) are referenced by app.json, and `expo prebuild` is strict about
missing icon/splash assets — so plain solid-colour PNGs are created for any
that are missing. Pure Python stdlib, no Pillow needed.

Same logic as the GitHub Actions workflow (build-native-apk.yml), which is
where this was proven. Used by F-Droid's build (see the prebuild step in
com.ahdora.app.yml) and by CI. The real icons live in icon-assets/ and
native/assets/ locally; until they are committed to the repo, this keeps
the build working. The APK installs and runs fine; the launcher icon is
just a plain teal square until the real icon is committed.
"""
import os
import struct
import zlib


def solid_png(path, w, h, rgb=(13, 92, 92)):
    def chunk(t, data):
        c = t + data
        return struct.pack(">I", len(data)) + c + struct.pack(
            ">I", zlib.crc32(c) & 0xFFFFFFFF
        )

    raw = b"".join(b"\x00" + bytes(rgb) * w for _ in range(h))
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw))
    png += chunk(b"IEND", b"")
    open(path, "wb").write(png)


def main():
    wanted = {
        "assets/icon.png": 1024,
        "assets/splash-icon.png": 1024,
        "assets/android-icon-foreground.png": 512,
        "assets/android-icon-background.png": 512,
        "assets/android-icon-monochrome.png": 512,
        "assets/favicon.png": 48,
    }
    os.makedirs("assets", exist_ok=True)
    for path, size in wanted.items():
        if not os.path.exists(path):
            solid_png(path, size, size)
            print(f"created placeholder {path} ({size}x{size})")
        else:
            print(f"kept existing {path}")


if __name__ == "__main__":
    main()
