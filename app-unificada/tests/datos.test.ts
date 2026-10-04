import { describe, expect, it } from "vitest";
import { EVENTOS } from "../src/datos/eventos";
import { fichasDelDia, minutosShow } from "../src/datos/consultas";
import { slug } from "../src/datos/slug";
import { totalesPorReferencia } from "../src/dominio";

const cordillera = EVENTOS.find(e => e.evento.id === "cordillera-2026")!;

describe("datos importados", () => {
  it("los tres eventos cargan y pasan la validación", () => {
    expect(EVENTOS.map(e => e.evento.id)).toEqual(["cordillera-2026", "vallenato-al-parque-2026", "simon-bolivar-2026"]);
  });
  it("Cordillera conserva los 337 ítems de la hoja ESC 2", () => {
    expect(cordillera.items).toHaveLength(337);
    expect(cordillera.items.filter(i => i.porConfirmar).length).toBeGreaterThan(0);
  });
  it("toda referencia cruzada apunta a algo que existe", () => {
    for (const p of EVENTOS) {
      const dias = new Set(p.dias.map(d => d.id)), artistas = new Set(p.artistas.map(a => a.id)), esc = new Set(p.escenarios.map(e => e.id));
      for (const it of p.items) { expect(dias).toContain(it.diaId); expect(artistas).toContain(it.artistaId); }
      for (const b of p.bloques) { expect(dias).toContain(b.diaId); expect(esc).toContain(b.escenarioId); if (b.artistaId) expect(artistas).toContain(b.artistaId); }
      for (const s of p.stagePlots) expect(artistas).toContain(s.artistaId);
      expect(new Set(p.items.map(i => i.id)).size).toBe(p.items.length);
    }
  });
  it("el mismo equipo del sábado y el domingo no se cuenta dos veces", () => {
    const t = totalesPorReferencia(cordillera.items).find(x => x.referencia === "Snare stand")!;
    expect(t.aTener).toBe(Math.max(...Object.values(t.porDia)));
  });
  it("las fichas del sábado van en orden de horario, con Sean Paul después de medianoche", () => {
    const nombres = fichasDelDia(cordillera, "cordillera-sab-12").map(f => f.nombre);
    expect(nombres).not.toContain("Changeover");
    expect(nombres.indexOf("Grupo Niche")).toBeLessThan(nombres.indexOf("Sean Paul"));
    expect(minutosShow("00:30")).toBeGreaterThan(minutosShow("23:45"));
  });
});

describe("slug", () => {
  it("quita tildes y símbolos", () => {
    expect(slug("Panteón Rococó")).toBe("panteon-rococo");
    expect(slug("Homenaje \"100 años de Rafael Escalona\"")).toBe("homenaje-100-anos-de-rafael-escalona");
  });
});
