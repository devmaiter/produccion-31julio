#!/usr/bin/env python3
"""Arma las copias de los reels con otra marca a partir de lab-reels/index.html.

Cada copia es la misma app (las mejoras le llegan al volver a armar el sitio), pero:
- trae window.MARCA (su logo en el arranque y en la presentación, sin Circuito);
- guarda sus datos aparte en el celular (otras claves de localStorage e IndexedDB), así
  no se mezclan con los de Circuito aunque se abran los dos links en el mismo teléfono.

Uso: python3 lab-reels/hacer-marcas.py   (lo corre construir-sitio.sh)
"""
import json, pathlib

AQUI = pathlib.Path(__file__).parent
MARCAS = [
    {"archivo": "backstage.html", "prefijo": "backstage", "titulo": "Backstage Company · Backline",
     "marca": {"nombre": "Backstage Company", "logo": "marca/backstage.png"}},
]

base = (AQUI / "index.html").read_text(encoding="utf-8")
for m in MARCAS:
    p = m["prefijo"]
    s = base
    cambios = [
        ("(lab-reels|cronograma|planilla)", f"({p}|{p}-cronograma|planilla)"),
        ('"cronograma:eventos"', f'"{p}-cronograma:eventos"'),
        ("lab-reels:", f"{p}:"),
        ('"backline-fotos"', f'"{p}-fotos"'),
        ('"backline-riders"', f'"{p}-riders"'),
        ("<title>Backline en reels</title>", f"<title>{m['titulo']}</title>"),
        ('<meta charset="utf-8">', '<meta charset="utf-8">\n<!-- Copia armada por hacer-marcas.py desde index.html: no editar a mano. -->\n'
                                   f"<script>window.MARCA = {json.dumps(m['marca'], ensure_ascii=False)};</script>"),
    ]
    for viejo, nuevo in cambios:
        if viejo not in s:
            raise SystemExit(f"{m['archivo']}: no encontré {viejo!r} en index.html")
        s = s.replace(viejo, nuevo)
    if "lab-reels:" in s or '"backline-fotos"' in s:
        raise SystemExit(f"{m['archivo']}: quedaron claves de Circuito")
    (AQUI / m["archivo"]).write_text(s, encoding="utf-8")
    print("listo:", m["archivo"])
