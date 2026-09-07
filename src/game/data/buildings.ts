// SpanishSettlers — datos originales inspirados en RTS clásicos de colonos.
// NO contiene assets ni código de The Settlers IV (Ubisoft/Blue Byte).
// Economía propia: cadenas madera/piedra/comida/herramientas/armas.

export type ResourceId =
  | 'madera'
  | 'tablon'
  | 'piedra'
  | 'grano'
  | 'harina'
  | 'pan'
  | 'agua'
  | 'pez'
  | 'carbon'
  | 'hierro'
  | 'lingoteHierro'
  | 'oro'
  | 'lingoteOro'
  | 'herramienta'
  | 'espada'
  | 'arco';

export type BuildingId =
  | 'almacen'
  | 'cabanaLenador'
  | 'aserradero'
  | 'cantera'
  | 'residenciaS'
  | 'residenciaM'
  | 'residenciaL'
  | 'granja'
  | 'molino'
  | 'panaderia'
  | 'pozo'
  | 'pesqueria'
  | 'minaCarbon'
  | 'minaHierro'
  | 'minaOro'
  | 'fundicion'
  | 'herreria'
  | 'armeria'
  | 'cuartel'
  | 'torre'
  | 'ornamento';

export interface BuildingDef {
  id: BuildingId;
  nombre: string;
  coste: Partial<Record<ResourceId, number>>;
  tiempoConstruccionMs: number;
  herramienta?: string;
  descripcion: string;
  categoria: 'base' | 'madera' | 'piedra' | 'comida' | 'mina' | 'industria' | 'militar' | 'decoracion';
}

export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  almacen: { id: 'almacen', nombre: 'Almacén', coste: {}, tiempoConstruccionMs: 4000, descripcion: 'Centro de tu colonia. Recoge y reparte mercancías.', categoria: 'base' },
  cabanaLenador: { id: 'cabanaLenador', nombre: 'Cabaña de leñador', coste: { madera: 2 }, tiempoConstruccionMs: 5000, descripcion: 'Un colono tala árboles cercanos y produce madera.', categoria: 'madera' },
  aserradero: { id: 'aserradero', nombre: 'Aserradero', coste: { madera: 2, piedra: 1 }, tiempoConstruccionMs: 6000, descripcion: 'Convierte 2 madera en 1 tablón.', categoria: 'madera' },
  cantera: { id: 'cantera', nombre: 'Cantera', coste: { madera: 2 }, tiempoConstruccionMs: 5000, descripcion: 'Extrae piedra de rocas cercanas.', categoria: 'piedra' },
  residenciaS: { id: 'residenciaS', nombre: 'Casa pequeña (+10)', coste: { madera: 2, piedra: 1 }, tiempoConstruccionMs: 5000, descripcion: 'Aloja 10 colonos.', categoria: 'base' },
  residenciaM: { id: 'residenciaM', nombre: 'Casa mediana (+20)', coste: { tablon: 3, piedra: 2 }, tiempoConstruccionMs: 8000, descripcion: 'Aloja 20 colonos.', categoria: 'base' },
  residenciaL: { id: 'residenciaL', nombre: 'Casa grande (+50)', coste: { tablon: 5, piedra: 4 }, tiempoConstruccionMs: 12000, descripcion: 'Aloja 50 colonos.', categoria: 'base' },
  granja: { id: 'granja', nombre: 'Granja de grano', coste: { madera: 2, piedra: 1 }, tiempoConstruccionMs: 6000, descripcion: 'Produce grano con guadaña.', categoria: 'comida' },
  molino: { id: 'molino', nombre: 'Molino', coste: { madera: 2, piedra: 2 }, tiempoConstruccionMs: 7000, descripcion: 'Convierte grano en harina.', categoria: 'comida' },
  panaderia: { id: 'panaderia', nombre: 'Panadería', coste: { madera: 2, piedra: 2 }, tiempoConstruccionMs: 7000, descripcion: 'Harina + agua = pan (comida de mineros).', categoria: 'comida' },
  pozo: { id: 'pozo', nombre: 'Pozo de agua', coste: { madera: 1, piedra: 1 }, tiempoConstruccionMs: 4000, descripcion: 'Produce agua.', categoria: 'comida' },
  pesqueria: { id: 'pesqueria', nombre: 'Pesquería', coste: { madera: 2 }, tiempoConstruccionMs: 5000, descripcion: 'Pesca junto al agua. Requiere caña (herramienta).', categoria: 'comida' },
  minaCarbon: { id: 'minaCarbon', nombre: 'Mina de carbón', coste: { madera: 3, piedra: 2 }, tiempoConstruccionMs: 8000, descripcion: 'Extrae carbón en montaña. Consume pan.', categoria: 'mina' },
  minaHierro: { id: 'minaHierro', nombre: 'Mina de hierro', coste: { madera: 3, piedra: 2 }, tiempoConstruccionMs: 8000, descripcion: 'Extrae hierro en montaña. Consume pan.', categoria: 'mina' },
  minaOro: { id: 'minaOro', nombre: 'Mina de oro', coste: { tablon: 3, piedra: 3 }, tiempoConstruccionMs: 10000, descripcion: 'Extrae oro. Mejora tropas N2/N3 y líderes.', categoria: 'mina' },
  fundicion: { id: 'fundicion', nombre: 'Fundición', coste: { tablon: 2, piedra: 2 }, tiempoConstruccionMs: 8000, descripcion: 'Hierro + carbón = lingote. Oro = lingote de oro.', categoria: 'industria' },
  herreria: { id: 'herreria', nombre: 'Herrería', coste: { tablon: 2, piedra: 2 }, tiempoConstruccionMs: 8000, descripcion: 'Lingote + carbón = herramientas.', categoria: 'industria' },
  armeria: { id: 'armeria', nombre: 'Armería', coste: { tablon: 3, piedra: 2 }, tiempoConstruccionMs: 9000, descripcion: 'Lingote + carbón = espadas y arcos.', categoria: 'industria' },
  cuartel: { id: 'cuartel', nombre: 'Cuartel', coste: { tablon: 4, piedra: 3 }, tiempoConstruccionMs: 10000, descripcion: 'Recluta espadachines y arqueros N1-N3.', categoria: 'militar' },
  torre: { id: 'torre', nombre: 'Torre vigía', coste: { tablon: 2, piedra: 3 }, tiempoConstruccionMs: 8000, descripcion: 'Expande territorio. Guarnécela con 1 soldado.', categoria: 'militar' },
  ornamento: { id: 'ornamento', nombre: 'Ornamento', coste: { madera: 1, piedra: 1 }, tiempoConstruccionMs: 3000, descripcion: 'Embellece y da +fuerza militar (doble de su coste).', categoria: 'decoracion' },
};

export interface Recipe {
  id: string;
  edificio: BuildingId;
  entradas: Partial<Record<ResourceId, number>>;
  salidas: Partial<Record<ResourceId, number>>;
  tiempoMs: number;
}

export const RECIPES: Recipe[] = [
  { id: 'tablon', edificio: 'aserradero', entradas: { madera: 2 }, salidas: { tablon: 1 }, tiempoMs: 8000 },
  { id: 'harina', edificio: 'molino', entradas: { grano: 2 }, salidas: { harina: 1 }, tiempoMs: 8000 },
  { id: 'pan', edificio: 'panaderia', entradas: { harina: 1, agua: 1 }, salidas: { pan: 1 }, tiempoMs: 9000 },
  { id: 'lingote-hierro', edificio: 'fundicion', entradas: { hierro: 2, carbon: 1 }, salidas: { lingoteHierro: 1 }, tiempoMs: 10000 },
  { id: 'lingote-oro', edificio: 'fundicion', entradas: { oro: 2, carbon: 1 }, salidas: { lingoteOro: 1 }, tiempoMs: 12000 },
  { id: 'herramienta', edificio: 'herreria', entradas: { lingoteHierro: 1, carbon: 1 }, salidas: { herramienta: 1 }, tiempoMs: 10000 },
  { id: 'espada', edificio: 'armeria', entradas: { lingoteHierro: 1, carbon: 1 }, salidas: { espada: 1 }, tiempoMs: 11000 },
  { id: 'arco', edificio: 'armeria', entradas: { tablon: 1, lingoteHierro: 1 }, salidas: { arco: 1 }, tiempoMs: 11000 },
];

export const INITIAL_STOCK: Record<ResourceId, number> = {
  madera: 12, tablon: 6, piedra: 10,
  grano: 4, harina: 2, pan: 4, agua: 4, pez: 0,
  carbon: 2, hierro: 2, lingoteHierro: 0,
  oro: 0, lingoteOro: 0,
  herramienta: 4, espada: 1, arco: 1,
};
