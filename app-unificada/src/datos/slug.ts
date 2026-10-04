/** "Panteón Rococó" → "panteon-rococo". Es el id estable de artistas y escenarios. */
export function slug(texto: string): string {
  return texto
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
