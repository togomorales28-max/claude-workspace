#!/usr/bin/env python3
"""CraftCode: merge, dedupe, score and export prospect leads.

Deterministic scoring so every run ranks leads the same way.

Usage:
  python3 craftcode_leads.py build <out_dir> <rows.json> [<rows2.json> ...]
      rows.json = JSON array of lead objects (see COLUMNS). Writes:
        <out_dir>/leads.csv        all leads, best first (UTF-8 BOM, opens in Excel)
        <out_dir>/oportunidades.csv only Caliente + Tibio
        <out_dir>/tabla.md          markdown table of the top 25
  python3 craftcode_leads.py score <rows.json>    print score per lead (dry run)
  python3 craftcode_leads.py selftest
"""
import csv, json, os, re, sys, unicodedata
from datetime import date

COLUMNS = [
    "score", "tier", "business", "niche", "area", "address", "website_status",
    "website_url", "website_issues", "phone", "whatsapp", "email", "facebook",
    "instagram", "tiktok", "google_maps_url", "rating", "reviews",
    "last_activity", "sources", "confidence", "why_prospect", "pitch_angle",
    "message_draft", "notes",
]

# website_status values (exactly one per lead)
STATUS_POINTS = {
    "sin_web": 35,            # no website anywhere
    "web_rota": 35,           # domain dead / 4xx / 5xx / SSL expired
    "solo_redes": 30,         # only Facebook / Instagram / TikTok / Linktree / WhatsApp
    "web_antigua": 30,        # not mobile, no HTTPS, old copyright, slow, dated design
    "solo_directorio": 25,    # only Seccion Amarilla / Doctoralia / Fresha / Booksy etc.
    "web_basica": 15,         # works but thin: one page, no booking, no contact CTA
    "web_moderna": 0,         # modern, mobile, HTTPS: hard sell
    "sin_verificar": 5,
}
PRIORITY_NICHES = {"barberia", "estetica", "salon de belleza", "dentista", "unas",
                   "salon de unas", "gimnasio", "salon de eventos"}
TIERS = [(70, "Caliente"), (50, "Tibio"), (30, "Frio"), (0, "Descartar")]


def fold(s: str) -> str:
    s = "".join(c for c in unicodedata.normalize("NFKD", str(s or "")) if not unicodedata.combining(c))
    return s.lower().strip()


def key(lead: dict) -> str:
    digits = re.sub(r"\D", "", str(lead.get("phone") or lead.get("whatsapp") or ""))
    if digits.startswith("52") and len(digits) == 12:
        digits = digits[2:]
    if len(digits) == 13 and digits.startswith("521"):
        digits = digits[3:]
    if len(digits) >= 10:
        return "tel:" + digits[-10:]
    name = re.sub(r"[^a-z0-9]+", " ", fold(lead.get("business", ""))).strip()
    return "nom:" + name + "|" + fold(lead.get("area", ""))


def _int(v) -> int:
    try:
        return int(float(str(v).replace(",", "").strip()))
    except (TypeError, ValueError):
        return 0


def score(lead: dict) -> int:
    pts = STATUS_POINTS.get(fold(lead.get("website_status")), 5)
    reviews = _int(lead.get("reviews"))
    pts += 20 if reviews >= 100 else 15 if reviews >= 30 else 8 if reviews >= 10 else 3 if reviews > 0 else 0
    if (lead.get("last_activity") or "").strip():
        pts += 10
    if lead.get("whatsapp") or lead.get("phone"):
        pts += 15
    if lead.get("email"):
        pts += 5
    if fold(lead.get("niche")) in PRIORITY_NICHES:
        pts += 10
    conf = fold(lead.get("confidence"))
    if conf == "baja":
        pts -= 15
    if not (lead.get("whatsapp") or lead.get("phone") or lead.get("email")
            or lead.get("facebook") or lead.get("instagram")):
        pts = min(pts, 29)  # no way to contact them: never above Descartar
    return max(0, min(100, pts))


def tier(pts: int) -> str:
    return next(name for floor, name in TIERS if pts >= floor)


def merge(rows: list) -> list:
    out: dict = {}
    for r in rows:
        k = key(r)
        if k in out:  # keep the first value, fill blanks from the duplicate
            for c, v in r.items():
                if v and not out[k].get(c):
                    out[k][c] = v
        else:
            out[k] = dict(r)
    leads = list(out.values())
    for l in leads:
        l["score"] = score(l)
        l["tier"] = tier(l["score"])
    leads.sort(key=lambda l: (-l["score"], -_int(l.get("reviews")), fold(l.get("business"))))
    return leads


def write_csv(path: str, leads: list) -> None:
    extras = sorted({k for l in leads for k in l} - set(COLUMNS))
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS + extras, quoting=csv.QUOTE_ALL, extrasaction="ignore")
        w.writeheader()
        for l in leads:
            w.writerow({c: "" if l.get(c) is None else l.get(c) for c in COLUMNS + extras})


def write_table(path: str, leads: list, n: int = 25) -> None:
    cols = ["score", "tier", "business", "niche", "website_status", "whatsapp", "phone", "reviews", "why_prospect"]
    esc = lambda v: str(v or "").replace("|", "/").replace("\n", " ")
    lines = ["| " + " | ".join(cols) + " |", "|" + "---|" * len(cols)]
    lines += ["| " + " | ".join(esc(l.get(c)) for c in cols) + " |" for l in leads[:n]]
    counts = {t: sum(1 for l in leads if l["tier"] == t) for _, t in TIERS}
    head = f"# Prospectos CraftCode ({date.today().isoformat()})\n\nTotal: {len(leads)} | " + \
           " | ".join(f"{t}: {c}" for t, c in counts.items()) + "\n\n"
    with open(path, "w", encoding="utf-8") as f:
        f.write(head + "\n".join(lines) + "\n")


def build(out_dir: str, files: list) -> None:
    rows = []
    for p in files:
        with open(p, encoding="utf-8") as f:
            rows += json.load(f)
    leads = merge(rows)
    os.makedirs(out_dir, exist_ok=True)
    write_csv(os.path.join(out_dir, "leads.csv"), leads)
    write_csv(os.path.join(out_dir, "oportunidades.csv"), [l for l in leads if l["tier"] in ("Caliente", "Tibio")])
    write_table(os.path.join(out_dir, "tabla.md"), leads)
    print(f"{len(rows)} filas -> {len(leads)} leads unicos en {out_dir}")


def selftest() -> None:
    rows = [
        {"business": "Barbería Prueba", "niche": "barbería", "website_status": "solo_redes",
         "whatsapp": "+52 1 631 000 0000", "reviews": "120", "last_activity": "2026-11-01", "confidence": "alta"},
        {"business": "Barberia Prueba", "niche": "barberia", "phone": "631 000 0000", "email": "a@b.mx"},
        {"business": "Clínica Moderna", "niche": "dentista", "website_status": "web_moderna", "phone": "6310000001", "reviews": "5"},
        {"business": "Sin Contacto", "niche": "gimnasio", "website_status": "sin_web", "reviews": "300"},
    ]
    leads = merge(rows)
    assert len(leads) == 3, leads
    top = leads[0]
    assert top["business"] == "Barbería Prueba" and top["email"] == "a@b.mx", top
    assert top["score"] == 30 + 20 + 10 + 15 + 5 + 10 and top["tier"] == "Caliente", top
    sc = {l["business"]: l for l in leads}
    assert sc["Sin Contacto"]["tier"] == "Descartar", sc["Sin Contacto"]
    assert sc["Clínica Moderna"]["tier"] in ("Frio", "Descartar"), sc["Clínica Moderna"]
    print("selftest OK")


if __name__ == "__main__":
    a = sys.argv[1:]
    if a[:1] == ["build"] and len(a) >= 3:
        build(a[1], a[2:])
    elif a[:1] == ["score"] and len(a) == 2:
        for l in merge(json.load(open(a[1], encoding="utf-8"))):
            print(l["score"], l["tier"], l.get("business"))
    elif a[:1] == ["selftest"]:
        selftest()
    else:
        print(__doc__)
        sys.exit(1)
