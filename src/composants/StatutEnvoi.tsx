// État d'un envoi de questionnaire (rempli, lien expiré, en attente).

import { dateCourte } from '../domaine/format';
import type { Envoi } from '../domaine/types';
import { Icone } from './Icone';

/** État d'un envoi : pictogramme + libellé (jamais la seule couleur). */
export function StatutEnvoi({ envoi: e }: { envoi: Envoi }) {
  if (e.repondu_le)
    return (
      <span className="puce puce-succes">
        <Icone nom="valider" taille={12} /> Rempli le {dateCourte(e.repondu_le)}
      </span>
    );
  if (e.expire_le < new Date().toISOString())
    return (
      <span className="puce puce-neutre">
        <Icone nom="croix" taille={12} /> Lien expiré
      </span>
    );
  return (
    <span className="puce puce-alerte">
      <Icone nom="horloge" taille={12} /> En attente
    </span>
  );
}
