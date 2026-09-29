/* Referencias equivalentes: la misma pieza de equipo escrita de varias formas
   en los riders ("base de redoblante" = "snare stand"). Se prueban en orden:
   lo específico primero para que no lo capture una regla general.
   Tabla heredada de la lista de chequeo de Cordillera 2026. */
export const ALIAS_REFERENCIAS: ReadonlyArray<readonly [RegExp, string]> = [
  // --- lo específico primero, para que no lo capture una regla general ---
  [/mesa plegable/, "Mesa plegable + silla playback"],
  [/x hat/, "X-hat + clamp"],
  [/yamaha es7/, "Yamaha ES7"],
  [/spd.?sx pro/, "Roland SPD-SX Pro"],
  [/spd stand|stand spd/, "Stand SPD"],
  [/pad roland pdx/, "Pad Roland PDX-8"],
  // --- bases de teclado ---
  [/ks120b/, "Keyboard stand sencillo Hercules KS120B"],
  [/ks210b/, "Keyboard stand doble Hercules KS210B"],
  [/ks410b/, "Keyboard stand doble Hercules KS410B"],
  [/ultimate ax-48/, "Ultimate AX-48 double stand"],
  [/ultimate ax90b/, "Ultimate AX90B keyboard stand"],
  [/stand de teclado tipo z/, "Stand de teclado tipo Z"],
  // --- hardware de batería ---
  [/tall snare stand/, "Tall snare stand"],
  [/snare stand|base de redoblante/, "Snare stand"],
  [/boom cymbal|base de platillo tipo boom/, "Boom cymbal stand"],
  [/hit hat stand|hi.?hat stand|base de hi-hat/, "Hi-hat stand"],
  [/drum throne gibraltar/, "Drum throne Gibraltar"],
  [/porter.*davies/, "Porter & Davies BC2 (+ throne)"],
  [/drum throne|silla de bater/, "Drum throne"],
  [/drum carpet|tapete de bater/, "Drum carpet"],
  [/double kick pedal|twin pedal/, "Double kick pedal"],
  [/single kick pedal|pedal de bombo sencillo|dw 9000 single kick/, "Single kick pedal"],
  [/tom stand/, "Tom stand"],
  [/clamp/, "Clamps"],
  [/plexiglass/, "Plexiglass"],
  [/drum heads|set de parches|new heads/, "Parches (drum heads)"],
  // --- redoblantes que se repiten entre bandas ---
  [/snare dw satin oil/, "Snare DW Satin Oil 14\""],
  [/ludwig supraphonic/, "Snare Ludwig Supraphonic 14\""],
  [/ludwig black magic/, "Snare Ludwig Black Magic 14\""],
  // --- mesas, atriles, sillas ---
  [/magician percu|mesa (de percusi[oó]n )?tipo mago/, "Magician percussion table"],
  [/lp 760a|mesa de percusi[oó]n lp 760a/, "LP 760A percussion table"],
  [/lp aspire/, "LP Aspire percussion table"],
  [/guitar boat|guitarrero/, "Guitar boat / guitarrero"],
  [/hercules guitar stand|single hercules guitar stand/, "Hercules single guitar stand"],
  [/bar stool|music stool/, "Bar stool / music stool"],
  [/silla(s)? (negra|para m[uú]sicos)/, "Sillas para músicos"],
  [/music stand|atril de partitura|partiture/, "Music stand (atril)"],
  [/laptop stand/, "Laptop stand"],
  [/stage fan/, "Stage fan"],
  [/sand bags/, "Sand bags"],
  [/fald[oó]n/, "Faldón"],
  // --- bajo ---
  [/ampeg svt classic/, "Ampeg SVT Classic"],
  [/ampeg svt 4 pro/, "Ampeg SVT 4 Pro"],
  [/ampeg (svt )?cabinet 8x10|ampeg 8x10e cabinet/, "Ampeg cabinet 8x10"],
  [/ampeg 4x10/, "Ampeg 4x10 cabinet"],
  [/aguilar tone hammer 500/, "Aguilar Tone Hammer 500"],
  [/aguilar db 410/, "Aguilar DB 410 cabinet"],
  [/aguilar db 751/, "Aguilar DB 751 bass head"],
  [/fender jazz bass/, "Fender Jazz Bass 4 string"],
  // --- guitarra ---
  [/fender twin reverb/, "Fender Twin Reverb"],
  [/blues deville/, "Fender Blues DeVille 4x10"],
  [/jazz chorus/, "Roland Jazz Chorus JC-120"],
  [/vox ac30/, "Vox AC30"],
  [/taylor 412/, "Taylor 412 CE"],
  [/taylor 414/, "Taylor 414 CE"],
  [/telecaster/, "Guitar Telecaster Mex"],
  [/less? paul/, "Gibson Les Paul Standard"],
  [/yamaha cx40/, "Yamaha CX40"],
  // --- teclados ---
  [/nord stage 2/, "Nord Stage 2 88"],
  [/nord stage 3/, "Nord Stage 3"],
  [/nord stage 4/, "Nord Stage 4"],
  [/korg kronos/, "Korg Kronos II"],
  [/motif xf7/, "Yamaha Motif XF7"],
  [/motif xf6/, "Yamaha Motif XF6"],
  [/motif xf8|montage/, "Yamaha Motif XF8 / Montage 8"],
  [/dumm(ie|y) de piano|piano vertical/, "Dummy de piano"],
  [/fc7/, "Yamaha FC7 pedal de volumen"],
  [/sustain pedal|fc4|dp-10/, "Sustain pedal"],
  // --- percusión ---
  [/giovanni.*congas|congas.*giovanni|set de congas/, "LP Congas Galaxy Giovanni Hidalgo"],
  [/bongo/, "LP Bongo + stand"],
  [/timbal(es)? tito puente/, "Timbales Tito Puente + stand"],
  [/timbal (hi )?(lp )?matador|lp timbal matador/, "LP Timbal Matador"],
  [/cradle 636|636 cradles/, "LP Cradle 636 (base de conga)"],
  [/base de conga doble/, "Base de conga doble"],
  [/cencerro|lp cowbell/, "Cencerro / cowbell"],
  [/shekere/, "Shekere LP"],
  [/set de toys/, "Set de toys"],
  [/^clave$/, "Clave"],
  [/lp chimes/, "LP Chimes"],
  [/surdo/, "Surdo Meinl 20\""],
  // --- cables y energía ---
  [/speakers cables/, "Speaker cables"],
  [/cable jack/, "Cable jack 1/4"],
  [/cuerdas/, "Cuerdas"],
  [/transformador/, "Transformadores 110/220 V"],
  [/convertidor/, "Convertidor AC"],
  [/ups 700/, "UPS 700 W"],
];

function sinTildes(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function limpiar(desc: string): string {
  return desc.replace(/\s*\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
}

/** Nombre canónico de la referencia de un ítem. Dos ítems con la misma
 *  referencia son la misma pieza de equipo y se suman en los totales. */
export function referenciaDe(descripcion: string): string {
  const d = sinTildes(limpiar(descripcion).toLowerCase());
  for (const [re, nombre] of ALIAS_REFERENCIAS) if (re.test(d)) return nombre;
  const c = limpiar(descripcion);
  return c.charAt(0).toUpperCase() + c.slice(1);
}
