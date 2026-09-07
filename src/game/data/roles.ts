// Oficios con animación de marcha (frames <rol>-f0..f2 en public/assets/people/).
export const PEOPLE_ROLES = ['settler', 'woodcutter', 'carrier', 'soldier', 'archer', 'miner', 'fisher', 'baker'] as const;
export type PeopleRole = (typeof PEOPLE_ROLES)[number];
