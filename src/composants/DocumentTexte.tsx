// Affichage d'un exercice ou document : texte simple → titres, listes,
// paragraphes, questions. Aucun HTML interprété (voir domaine/texte.ts).

import type { ReactNode } from 'react';
import { blocsTexte } from '../domaine/texte';

/**
 * `champ` : ce qui s'affiche sous chaque question (zone de saisie sur la page
 * du client, réponse reçue…). Par défaut, des lignes pour écrire à la main.
 */
export function DocumentTexte({
  contenu,
  champ,
}: {
  contenu: string;
  champ?: (indice: number, question: string) => ReactNode;
}) {
  return (
    <div className="document-texte">
      {blocsTexte(contenu).map((b, i) =>
        b.type === 'titre' ? (
          <h2 key={i}>{b.texte}</h2>
        ) : b.type === 'liste' ? (
          <ul key={i}>
            {b.elements.map((e, j) => (
              <li key={j}>{e}</li>
            ))}
          </ul>
        ) : b.type === 'question' ? (
          <div key={i} className="document-question">
            {champ ? (
              champ(b.indice, b.texte)
            ) : (
              <>
                <p className="document-question-texte">{b.texte}</p>
                <div className="lignes-ecriture" aria-hidden />
              </>
            )}
          </div>
        ) : (
          <p key={i}>{b.texte}</p>
        ),
      )}
    </div>
  );
}
