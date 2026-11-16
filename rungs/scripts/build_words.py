"""Build src/engine/data/words.json from the raw lists in wordlists/.

Run:  pip install -r wordlists/requirements.txt && npm run build:words

Three tiers per word length (each tier contains the one above it):
  endpoint  very common base words  -> can be a puzzle's START or TARGET
  path      common words            -> used to compute PAR (the fair shortest path)
  valid     real but less common    -> accepted as a move (lets clever players beat par)

The output is committed, so the app and tests never need Python.
"""

import json
import os

from wordfreq import zipf_frequency

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LISTS = os.path.join(ROOT, "wordlists")
OUT = os.path.join(ROOT, "src", "engine", "data", "words.json")

LENGTHS = (3, 4, 5)
VALID_MIN = 1.5     # below this ENABLE is mostly archaic/dialect ("jole", "corf")
PATH_MIN = 3.0      # words most adults know
ENDPOINT_MIN = 3.5  # words everyone knows


def read_list(name):
    with open(os.path.join(LISTS, name), encoding="utf-8") as f:
        return {
            line.strip().lower()
            for line in f
            if line.strip() and not line.startswith("#")
        }


def is_inflection(word, valid):
    """True for plurals / verb forms whose base word also exists (cats, boxes, baked)."""
    if word.endswith("ss"):
        return False
    if word.endswith("s") and word[:-1] in valid:
        return True
    if word.endswith("es") and word[:-2] in valid:
        return True
    if word.endswith("ed") and (word[:-2] in valid or word[:-1] in valid):
        return True
    return False


SUFFIXES = ("s", "es", "ed", "ing", "er", "ers", "y", "ty")


def is_blocked(word, blocked):
    """Blocks the word AND its inflections: the list has "shit", so "shits" must go too."""
    if word in blocked:
        return True
    return any(word.endswith(sfx) and word[: -len(sfx)] in blocked for sfx in SUFFIXES)


def main():
    enable = read_list("enable1.txt")
    blocked = {w for w in read_list("ldnoobw-en.txt") if " " not in w}
    blocked |= read_list("extra-blocklist.txt")
    path_exclude = read_list("path-exclude.txt")
    endpoint_exclude = read_list("endpoint-exclude.txt") | path_exclude
    # Base-word lookup must cover ALL lengths: "boats" (5) needs "boat" (4).
    known = {w for w in enable if zipf_frequency(w, "en") >= VALID_MIN}

    out = {"version": 1, "source": "ENABLE (public domain), filtered", "lengths": {}}
    for n in LENGTHS:
        words = sorted(w for w in enable if len(w) == n and w.isalpha() and not is_blocked(w, blocked))
        freq = {w: zipf_frequency(w, "en") for w in words}
        valid = {w for w in words if freq[w] >= VALID_MIN}
        path = {w for w in valid if freq[w] >= PATH_MIN and w not in path_exclude}
        endpoint = {
            w
            for w in path
            if freq[w] >= ENDPOINT_MIN
            and not is_inflection(w, known)
            and w not in endpoint_exclude
        }
        # Stored as three disjoint space-separated strings: small and fast to parse.
        out["lengths"][str(n)] = {
            "endpoint": " ".join(sorted(endpoint)),
            "path": " ".join(sorted(path - endpoint)),
            "valid": " ".join(sorted(valid - path)),
        }
        print(f"{n} letters: endpoint={len(endpoint)} path={len(path)} valid={len(valid)}")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"))
        f.write("\n")
    print(f"wrote {OUT} ({os.path.getsize(OUT)} bytes)")


if __name__ == "__main__":
    main()
