// Reçu ouvert par le client depuis son lien personnel : aucun compte,
// seulement le reçu, à imprimer ou à enregistrer en PDF.

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Chargement, Erreur, PiedPublic } from '../composants/Commun';
import { FeuilleRecu } from '../composants/FeuilleRecu';
import { Icone } from '../composants/Icone';
import { donnees } from '../donnees';
import { dateLongue, messageErreur } from '../domaine/format';
import { numeroRecu } from '../domaine/texte';
import type { RecuPublic as Reponse } from '../domaine/types';
import { appliquerTheme } from '../etat/reglages';

export function RecuPublic() {
  const { jeton = '' } = useParams();
  const [r, setR] = useState<Reponse | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    donnees.recuPublic(jeton).then(
      (x) => {
        setR(x);
        if (x.couleur) appliquerTheme(x.couleur, x.nom_site ?? 'Reçu', false);
        if (x.valide) document.title = `Reçu n° ${numeroRecu(x.recu)}`;
      },
      (e) => setErreur(messageErreur(e)),
    );
  }, [jeton]);

  if (!r && !erreur) return <Chargement texte="Ouverture du reçu…" />;

  return (
    <div className="page-publique">
      {erreur && <Erreur message={erreur} />}
      {r && !r.valide && (
        <div className="carte carte-publique">
          <p className="marque-publique">
            <span className="marque-pastille" /> {r.nom_site ?? 'Reçu'}
          </p>
          <div className="vide" style={{ padding: '24px 0' }}>
            <Icone nom="cadenas" taille={30} />
            <h1 style={{ fontSize: '1.3rem', color: 'var(--encre)' }}>
              {r.raison === 'expire' ? 'Ce lien a expiré' : 'Lien introuvable'}
            </h1>
            <p>Demandez un nouveau lien à votre thérapeute.</p>
          </div>
        </div>
      )}
      {r?.valide && (
        <div className="recu-public">
          <div className="actions ne-pas-imprimer" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="meta">Lien personnel valable jusqu'au {dateLongue(r.expire_le)}</span>
            <button className="bouton bouton-principal" onClick={() => window.print()}>
              <Icone nom="imprimer" taille={16} /> Imprimer ou enregistrer en PDF
            </button>
          </div>
          <FeuilleRecu recu={r.recu} />
        </div>
      )}
      <PiedPublic />
    </div>
  );
}
