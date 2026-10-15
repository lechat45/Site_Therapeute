// Photo de profil du thérapeute, ou ses initiales.

import { initiales } from '../domaine/format';
import { useReglages } from '../etat/reglages';
import { useTherapeute } from '../etat/session';

/** Photo du profil, ou à défaut les initiales du thérapeute connecté. */
export function Avatar({ taille = 34 }: { taille?: number }) {
  const t = useTherapeute();
  const { parametres } = useReglages();
  return parametres.photo ? (
    <img className="avatar avatar-photo" src={parametres.photo} alt="" width={taille} height={taille} />
  ) : (
    <span className="avatar" aria-hidden style={{ width: taille, height: taille, fontSize: taille * 0.36 }}>
      {initiales(t.prenom, t.nom) || '?'}
    </span>
  );
}
