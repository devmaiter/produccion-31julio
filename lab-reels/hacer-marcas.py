#!/usr/bin/env python3
"""Arma las copias de los reels con otra marca a partir de lab-reels/index.html.

Cada copia es la misma app (las mejoras le llegan al volver a armar el sitio). Solo cambia la configuración:
window.MARCA (nombre, logo y prefijo) va antes de entorno.js, y entorno.js saca de ahí las claves y bases propias
de la marca ("backstage:", "backstage-cronograma:", "backstage-fotos", "backstage-riders"), así sus datos no se
mezclan con los de Circuito aunque se abran los dos links en el mismo teléfono. Ya no se reemplaza texto en el código.

Uso: python3 lab-reels/hacer-marcas.py   (lo corre construir-sitio.sh)
"""
import json, pathlib

AQUI = pathlib.Path(__file__).parent
MARCAS = [
    {"archivo": "backstage.html", "titulo": "Backstage Company · Backline",
     "marca": {"nombre": "Backstage Company", "logo": "marca/backstage.png", "prefijo": "backstage"}},
]

base = (AQUI / "index.html").read_text(encoding="utf-8")
for m in MARCAS:
    s = base
    cambios = [
        ("<title>Backline en reels</title>", f"<title>{m['titulo']}</title>"),
        ('<script src="entorno.js"></script>',
         "<!-- Copia armada por hacer-marcas.py desde index.html: no editar a mano. -->\n"
         f"<script>window.MARCA = {json.dumps(m['marca'], ensure_ascii=False)};</script>\n"
         '<script src="entorno.js"></script>'),
    ]
    for viejo, nuevo in cambios:
        if s.count(viejo) != 1:
            raise SystemExit(f"{m['archivo']}: no encontré una sola vez {viejo!r} en index.html")
        s = s.replace(viejo, nuevo)
    (AQUI / m["archivo"]).write_text(s, encoding="utf-8")
    print("listo:", m["archivo"])
