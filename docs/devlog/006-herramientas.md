# Devlog 006 — Fase 0: herramientas y material verificados (2026-09-07)

## Editores
- **LibreSprite 1.1-dev portable OK**: `Temp/opencode/tools/libresprite/libresprite.exe`
  (`--version` responde). Sin instalación, sin coste.
- **Tiled 1.12.2 pendiente de instalación manual**: el MSI
  (`Temp/opencode/tools/tiled.msi`, 22 MB) exige elevación y este entorno no
  tiene permisos (winget y `msiexec /a` fallan silenciosamente). Acción para el
  usuario: doble clic al MSI. **No bloquea**: el mapa `.json` compatible-Tiled
  se genera por script y Tiled lo abrirá/editará cuando esté instalado.

## Packs Kenney CC0 (7 zips, `Temp/opencode/kenney/`, fuera del repo)
| Pack | Bytes | Uso previsto |
|---|---|---|
| isometric-landscape | 1 141 541 | Terreno base proto A |
| isometric-buildings | 1 706 949 | Referencia proporciones |
| isometric-city | 990 594 | Referencia ciudad |
| medieval-rts | 1 831 847 | Referencia RTS cenital |
| rpg-audio / interface-sounds / impact-sounds | ~2,6 MB | Audio proto A |
- `License.txt` verificado: **CC0 explícito**. Tiles iso 132×83 + spritesheet
  con XML. Solo entrarán al repo los PNG seleccionados (+ mención en
  `docs/ATRIBUCION-A.md` por cortesía, aunque CC0 no la exige).

## Widelands (referencia fuera del repo, `Temp/opencode/widelands/`)
- Sparse-checkout OK (tribu bárbara): `buildings/productionsites/barbarians`
  (40 edificios), `warehouses`, `militarysites`, `workers/barbarians`,
  `wares`, `immovables`. Estructura actual es por **tipo**, no por tribu.
- Formato portable documentado: `idle_00.png` (~80×69) + `hotspot` en
  `init.lua`, `build_1.png` spritesheet 2×2, `menu.png` 30×30 (= iconos HUD),
  workers con frames (`walk/hack/idle`) + máscara `_pc` de color de jugador.

## Mapeo preliminar Fase 2B (nuestros 21 → bárbaros)
almacen→warehouse · cabanaLenador→lumberjacks_hut · aserradero→(sawmill empire,
o adaptar) · cantera→quarry · residencias→(barbarians_house, verificar nombre) ·
granja→farm · molino→warmill · panaderia→bakery · pozo→well ·
pesqueria→fishers_hut · minaCarbon→coalmine · minaHierro→ironmine ·
minaOro→goldmine · fundicion→smelting_works · herreria→ax_workshop ·
armeria→helmsmithy · cuartel→barracks · torre→(militarysites, verificar) ·
ornamento→(sin equivalente: original o estatua empire).

## Checkpoint
- Ramas y tags en remoto: `proto-a-hibrida` (`proto-a-fase0`),
  `proto-b-widelands` (`proto-b-fase0`). Siguiente: Fase 1 (mapa Tiled + loader).
