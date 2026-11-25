"""Build the installable web app (PWA) from index.html.

Usage: python3 build_pwa.py   -> writes pwa/index.html (manifest, icons and sw.js live in pwa/)
Host the pwa/ folder on any HTTPS static host (GitHub Pages, Netlify...) to install it on phones.
"""
import pathlib, re
root = pathlib.Path(__file__).parent
src = (root / "index.html").read_text(encoding="utf-8")
title = re.search(r"<title>(.*?)</title>", src).group(1)
head = f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#1B2B45">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="{title}">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="icon-192.png">
<style>:root{{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}}body{{margin:0}}img{{max-width:100%}}[hidden]{{display:none!important}}</style>
</head>
<body>
"""
(root / "pwa" / "index.html").write_text(head + src + "\n</body>\n</html>\n", encoding="utf-8")
print("pwa/index.html written")
