"""
CTD batch-query client that transparently solves the ALTCHA proof-of-work
captcha CTD added in front of https://ctdbase.org/tools/batchQuery.go.

ALTCHA is hashcash-style PoW: given {salt, challenge, maxnumber}, find an
integer n in [0, maxnumber] with SHA256(salt + str(n)).hexdigest() == challenge.
The solution payload (base64 JSON incl. the server's signature) is POSTed back
to the protected URL together with the `origin` field; the server then sets a
cookie and serves the real download. We keep the cookie in a jar so later
requests in the same session skip the wall.
"""
import base64
import hashlib
import http.cookiejar
import json
import time
import urllib.parse
import urllib.request

BASE = "https://ctdbase.org"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) EtioMap-research/1.0"

_jar = http.cookiejar.CookieJar()
_opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(_jar))
_opener.addheaders = [("User-Agent", UA)]


def _solve_altcha(ch):
    salt = ch["salt"]
    target = ch["challenge"]
    maxnum = ch.get("maxnumber", 1_000_000)
    for n in range(maxnum + 1):
        if hashlib.sha256((salt + str(n)).encode()).hexdigest() == target:
            payload = {
                "algorithm": ch["algorithm"],
                "challenge": ch["challenge"],
                "number": n,
                "salt": ch["salt"],
                "signature": ch["signature"],
            }
            return base64.b64encode(json.dumps(payload).encode()).decode()
    raise RuntimeError("ALTCHA solution not found within maxnumber")


def _pass_wall(origin_path):
    """Solve the captcha for the given protected path and submit it."""
    ch = json.loads(
        _opener.open(f"{BASE}/captcha.go?altcha=yes", timeout=60).read().decode()
    )
    sol = _solve_altcha(ch)
    body = urllib.parse.urlencode({"origin": origin_path, "altcha": sol}).encode()
    req = urllib.request.Request(
        BASE + origin_path,
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    return _opener.open(req, timeout=300).read()


def _looks_like_wall(text):
    return "altcha-widget" in text or "verify you are a human" in text


def fetch(params, retries=3):
    """Fetch a batchQuery TSV as text, transparently clearing the captcha."""
    path = "/tools/batchQuery.go?" + urllib.parse.urlencode(params)
    last = ""
    for attempt in range(retries):
        try:
            raw = _opener.open(BASE + path, timeout=300).read()
        except Exception as e:  # noqa
            last = str(e)
            time.sleep(3)
            continue
        text = raw.decode("utf-8", "replace")
        if not _looks_like_wall(text):
            return text
        # hit the wall -> solve and submit, then the POST response IS the data
        raw2 = _pass_wall(path)
        text2 = raw2.decode("utf-8", "replace")
        if not _looks_like_wall(text2):
            return text2
        last = "still walled after solving"
        time.sleep(2)
    raise RuntimeError(f"CTD fetch failed for {params}: {last}")


if __name__ == "__main__":
    t = fetch(
        {
            "inputType": "disease",
            "inputTerms": "D001249",
            "report": "chems",
            "format": "tsv",
            "action": "Download",
        }
    )
    lines = t.splitlines()
    print("lines:", len(lines))
    print("HEADER:", lines[0])
    for l in lines[1:3]:
        print("ROW:", l)
