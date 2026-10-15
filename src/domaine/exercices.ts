// Exercices rendus par un client, à reprendre en séance : ceux dont la
// réponse est arrivée après la séance précédente (et, pour une séance qui
// n'est pas la dernière, au plus tard le jour de cette séance).

import { jourDe } from './agenda';
import type { Remise } from './types';

export function exercicesRendus(remises: Remise[], depuis: string | null, jusqua: string | null): Remise[] {
  return remises
    .filter((r) => {
      if (!r.repondu_le) return false;
      const jour = jourDe(r.repondu_le);
      return (!depuis || jour > depuis) && (!jusqua || jour <= jusqua);
    })
    .sort((a, b) => a.repondu_le!.localeCompare(b.repondu_le!));
}
