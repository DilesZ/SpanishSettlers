# GUIA-ESTILO — SpanishSettlers, rama `proto-a-hibrida`

Arte 100% original (LibreSprite + Tiled + Kenney CC0 solo para terreno base).
Nada copiado de The Settlers IV ni de ningún juego. Licencia del proyecto:
ver `package.json`/`README.md` (NO GPL en esta rama).

## 1. Paleta fija "terracota ibérica" (no salir de aquí sin registrarlo)

| Uso | Color | Hex |
|---|---|---|
| Encalado muros | Blanco cálido | `#F5EAD2` |
| Entramado/madera oscura | Roble | `#6B4A2A` |
| Madera media | Pino | `#8B5A2B` |
| Madera clara | Haya | `#D9B36A` |
| Tejado principal | Terracota | `#B3402E` |
| Tejado secundario | Terracota oscura | `#7F1D1D` |
| Piedra clara / oscura | Arenisca | `#9AA0AA` / `#5B6068` |
| Hierba base | Esmeralda | `#4D9240` |
| Agua | Azul profundo | `#2F6FB4` |
| Metal | Acero | `#B9BEC7` |
| Oro/detalle noble | Dorado | `#FDE047` / `#FBBF24` |
| Luz cálida (ventanas/farol) | bombilla | `#FFC861` |
| Piel colonos | Piel | `#F2C89B` |

## 2. Formato de sprites

* Edificios: canvas **128×128**, vista isométrica 2:1, línea de suelo a y=120,
  sombra elipse alfa 0.22 bajo la base. Punto de ancla en Phaser: `(0.5, 1)`
  sobre la baldosa.
* Personajes: canvas **26×28**, 4 frames de marcha (contacto–apoyo–paso–apoyo),
  paleta de túnica por oficio (leñador `#8B5A2B`, portador `#3F7D33`,
  soldado `#B91C1C`, minero `#4B5563`, pescador `#0284C7`, panadero `#F5EAD2`).
* Terreno: tiles **64×32** diamante, borde 1px más claro arriba-izquierda,
  moteado de 3-4 px para romper el plano.
* Exportar: PNG-32, spritesheet con **padding 2px + extrude 1px**
  (evita halos con filtrado lineal), un atlas por categoría
  (`terrain`, `buildings`, `people`, `fx`).

## 3. Mapa Tiled (`assets/maps/isla-01.tmx` → exportado a `.json`)

* Orientación isométrica, tile 64×32, capas: `Suelo`, `Decoracion`,
  `Caminos`; capa de objetos `Logica` (almacén inicial, spawns,
  yacimientos, triggers) con propiedades (`edificio`, `oficio`, `recurso`).
* Formato de capa: CSV. Tilesets embebidos. Todo bajo `public/assets/`.

## 4. Audio

* Base: packs Kenney CC0 (`RPG Audio`, `Interface Sounds`, `Impact Sounds`).
* SFX propios (pico, hacha, moneda, espada, construcción): jsfxr/ChipTone,
  exportar WAV 44.1kHz, normalizar en Audacity. Música: bucle propio o
  Kenney Music Jingles (CC0). Nada de melodías reconocibles de S4.

## 5. Prohibido en esta rama

* PNGs, OGGs o código de Widelands (GPL) o de cualquier juego comercial.
* Si un asset externo entra, debe ser CC0 y registrarse en
  `docs/ATRIBUCION-A.md` con URL y licencia.
