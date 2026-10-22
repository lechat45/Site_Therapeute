// Présentation du site en diapositives (contenu : config/presentation.ts). Ouverte par
// « Découvrir le site » (page de connexion) ou « Présentation du site » (menu).
// Flèches gauche/droite pour avancer, Échap pour fermer ; « Ouvrir cet écran » quand
// on est connecté (`ouvrirEcran` fourni).

import { useEffect, useState } from 'react';
import { ARGENT_VISIBLE, EXERCICES_VISIBLES } from '../config/fonctions';
import { diapositivesVisibles } from '../config/presentation';
import { Dialogue } from './Commun';
import { Icone } from './Icone';

export function Presentation({
  fermer,
  ouvrirEcran,
}: {
  fermer: () => void;
  /** Connecté : mène à l'écran présenté (et ferme la présentation). */
  ouvrirEcran?: (chemin: string) => void;
}) {
  const diapositives = diapositivesVisibles({ exercices: EXERCICES_VISIBLES, argent: ARGENT_VISIBLE });
  const [i, setI] = useState(0);
  const d = diapositives[i];
  const derniere = i === diapositives.length - 1;
  const aller = (n: number) => setI(Math.max(0, Math.min(diapositives.length - 1, n)));
  const total = diapositives.length;
  // Flèches du clavier, où que soit le focus dans la présentation (pas dans un champ).
  useEffect(() => {
    const clavier = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight') setI((x) => Math.min(total - 1, x + 1));
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener('keydown', clavier);
    return () => window.removeEventListener('keydown', clavier);
  }, [total]);

  return (
    <Dialogue
      ouvert
      classe="presentation"
      fermer={fermer}
      titre="Présentation du site"
      pied={
        <>
          <button type="button" className="bouton" onClick={() => aller(i - 1)} disabled={i === 0}>
            <Icone nom="precedent" taille={15} /> Précédent
          </button>
          <span className="presentation-compteur" aria-hidden>
            {i + 1} / {diapositives.length}
          </span>
          {derniere ? (
            <button type="button" className="bouton bouton-principal" onClick={fermer}>
              <Icone nom="valider" taille={15} /> Terminer
            </button>
          ) : (
            // focus de départ sur « Suivant » : Entrée fait avancer (sinon il tombait sur le 1er point)
            <button type="button" className="bouton bouton-principal" onClick={() => aller(i + 1)} autoFocus>
              Suivant <Icone nom="chevron" taille={15} />
            </button>
          )}
        </>
      }
    >
      <div className="presentation-corps">
        <nav className="presentation-etapes" aria-label="Parties de la présentation">
          {diapositives.map((x, n) => (
            <button
              key={x.cle}
              type="button"
              className="presentation-point"
              aria-current={n === i ? 'step' : undefined}
              aria-label={`${n + 1}. ${x.titre}`}
              title={x.titre}
              onClick={() => aller(n)}
            />
          ))}
        </nav>

        {/* aria-live : un lecteur d'écran annonce chaque nouvelle diapositive */}
        <article className="diapositive" aria-live="polite" aria-roledescription="diapositive">
          <span className="diapositive-icone" aria-hidden>
            <Icone nom={d.icone} taille={28} />
          </span>
          <p className="diapositive-etape">
            Partie {i + 1} sur {diapositives.length}
          </p>
          <h3 className="diapositive-titre">{d.titre}</h3>
          <p className="diapositive-resume">{d.resume}</p>
          <ul className="diapositive-points">
            {d.points.map((p) => (
              <li key={p}>
                <Icone nom="valider" taille={14} />
                <span>{p}</span>
              </li>
            ))}
          </ul>
          {ouvrirEcran && d.ecran && (
            <button type="button" className="bouton bouton-doux" onClick={() => ouvrirEcran(d.ecran!)}>
              Ouvrir cet écran <Icone nom="chevron" taille={14} />
            </button>
          )}
        </article>
      </div>
    </Dialogue>
  );
}
