# Devlog 020 — Acabado gráfico: suelo vivo, ghost, minimapa, partículas (rama B)

## Cambios
- **Suelo vivo**: matas WL (grass1-3) densas en pradera, setas en bosque,
  robles otoñales teñidos (15%).
- **Ghost de construcción**: previsualización semitransparente que sigue el
  cursor, verde/rojo según validez (`canPlace`: agua, montaña, ocupado,
  adyacencia y coste).
- **Anillo de selección** pulsante en el edificio inspeccionado.
- **Viewport en minimapa**: marco ámbar dibujado solo en la cámara del
  minimapa (`main.ignore`), actualizado por frame.
- **Partículas**: hojas que caen, brasas en fraguas, salpicaduras en orilla.

## Verificación
- `npm test`: 49/49. `npm run build`: OK. Captura con marco y matas.
