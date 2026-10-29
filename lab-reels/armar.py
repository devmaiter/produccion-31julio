#!/usr/bin/env python3
"""Arma lab-reels/app.js juntando los archivos de lab-reels/src/ en orden (00-base.js, 01-…, …).

El código de la pantalla vive partido por tema en src/ (subir, modo normal, show, notas, fotos, respaldo…). El
navegador carga un solo app.js, como si fuera un solo script: el orden y el alcance de todo quedan como siempre.
Se edita en src/ y se corre esto (lo corre construir-sitio.sh). app.js no se edita a mano.

Uso: python3 lab-reels/armar.py
"""
import pathlib

AQUI = pathlib.Path(__file__).parent
partes = sorted((AQUI / "src").glob("[0-9][0-9]-*.js"))
salida = ["/* Armado por lab-reels/armar.py desde lab-reels/src/: no editar a mano. */"]
for p in partes:
    salida.append(f"\n/* ═══ src/{p.name} ═══ */\n")
    salida.append(p.read_text(encoding="utf-8"))
(AQUI / "app.js").write_text("".join(salida), encoding="utf-8")
print("listo: app.js con", len(partes), "partes")
