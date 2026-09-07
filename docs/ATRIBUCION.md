# ATRIBUCIÓN — rama `proto-b-widelands`

## Licencia de ESTA RAMA: GPL-2.0-or-later (`COPYING`)

Desde el momento en que esta rama incorpore material de Widelands, todo su
contenido (código + assets) queda bajo **GNU General Public License v2 o
posterior**. Consecuencias aceptadas por el titular del repositorio:

* Todo lo que se publique desde esta rama (incluido el deploy de Vercel que
  se genere desde ella) debe ofrecer el código fuente correspondiente
  (este mismo repositorio público lo cumple).
* Esta rama **NO podrá fusionarse a `main` ni relicenciarse** a una licencia
  propietaria sin eliminar antes TODO el material derivado de Widelands.
* Si el prototipo B pierde la comparativa de Fase 3, se archiva como tag
  y `main` sigue limpio.

## Material reutilizado

* **Widelands** — clon libre de estrategia inspirado en Settlers II.
  Autores: Widelands Development Team (2002–2026).
  Origen: `https://github.com/widelands/widelands` (espejo; principal en Codeberg).
  Licencia: **GPL-2.0-or-later** (código y `data/`; ver su `COPYING` y
  `debian/copyright`). Algunos assets sueltos indican CC en sus carpetas:
  antes de importar cada PNG se verifica su cabecera de licencia y se anota
  abajo; ante la duda, rige GPL-2.0+.
* Edificios/trabajadores usados (tribu bárbara; se completará en Fase 2B):
  *pendiente de tabla de equivalencias.*

## Material CC0 (compatible con GPL, se cita por cortesía)

* Packs **Kenney** (`kenney.nl`, CC0 1.0, sin atribución obligatoria):
  terreno isométrico y audio que se listen en `docs/devlog/`.
* `public/assets/terrain-sheet.png` y `foam-*.png`: generados por
  `scripts/make-terrain.mjs` (obra propia, port de la rama A para comparativa
  justa). Terreno común en ambas ramas: en B solo cambian edificios/personajes.
