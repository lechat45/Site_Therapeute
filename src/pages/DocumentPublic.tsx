// Exercice ou document ouvert par le client depuis son lien personnel :
// aucun compte, seulement le document et le nom du thérapeute. Un exercice
// à compléter (lignes « ? ») propose une zone de réponse par question ;
// les réponses partent une seule fois.

import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { Chargement, Erreur, PiedPublic } from '../composants/Commun';
import { DocumentTexte } from '../composants/DocumentTexte';
import { Icone } from '../composants/Icone';
import { donnees } from '../donnees';
import { dateHeure, dateLongue, messageErreur } from '../domaine/format';
import { questionsDocument, REPONSE_MAX, validerReponsesDocument } from '../domaine/texte';
import type { DocumentPublic as Document } from '../domaine/types';
import { appliquerTheme } from '../etat/reglages';

export function DocumentPublic() {
  const { jeton = '' } = useParams();
  const [doc, setDoc] = useState<Document | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [reponses, setReponses] = useState<string[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const [envoye, setEnvoye] = useState(false);

  useEffect(() => {
    donnees.documentPublic(jeton).then(
      (r) => {
        setDoc(r);
        if (r.couleur) appliquerTheme(r.couleur, r.nom_site ?? 'Document', false);
        if (r.valide) {
          document.title = r.titre;
          setReponses(questionsDocument(r.contenu).map(() => ''));
        }
      },
      (e) => setErreur(messageErreur(e)),
    );
  }, [jeton]);

  if (!doc && !erreur) return <Chargement texte="Ouverture du document…" />;

  const questions = doc?.valide ? questionsDocument(doc.contenu) : [];
  const aCompleter = questions.length > 0 && doc?.valide && !doc.repondu_le && !envoye;

  async function envoyer(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    try {
      // mêmes règles que le serveur : on prévient tout de suite
      validerReponsesDocument(questions, reponses);
    } catch (err) {
      setErreur((err as Error).message);
      return;
    }
    setEnvoi(true);
    try {
      await donnees.repondreDocument(jeton, reponses);
      setEnvoye(true);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="page-publique">
      <div className="carte carte-publique document-public">
        <p className="marque-publique">
          <span className="marque-pastille" /> {doc?.nom_site ?? 'Document'}
        </p>
        {erreur && !doc?.valide && <Erreur message={erreur} />}
        {doc && !doc.valide && (
          <div className="vide" style={{ padding: '24px 0' }}>
            <Icone nom="cadenas" taille={30} />
            <h1 style={{ fontSize: '1.3rem', color: 'var(--encre)' }}>
              {doc.raison === 'expire' ? 'Ce lien a expiré' : 'Lien introuvable'}
            </h1>
            <p>Demandez un nouveau lien à votre thérapeute.</p>
          </div>
        )}
        {doc?.valide && (
          <article>
            <h1 style={{ fontSize: '1.5rem' }}>{doc.titre}</h1>
            <p className="meta" style={{ marginTop: 6 }}>
              Proposé par <strong style={{ color: 'var(--encre)' }}>{doc.therapeute}</strong> · lien personnel valable
              jusqu'au {dateLongue(doc.expire_le)}
            </p>
            {(envoye || doc.repondu_le) && questions.length > 0 && (
              <div className="alerte alerte-succes" role="status" style={{ marginTop: 14 }}>
                <Icone nom="valider" />
                <span>
                  {envoye
                    ? `Merci, vos réponses ont été transmises à ${doc.therapeute}.`
                    : `Vos réponses ont été envoyées le ${dateHeure(doc.repondu_le)}.`}
                </span>
              </div>
            )}
            {aCompleter ? (
              <form onSubmit={envoyer} noValidate>
                <DocumentTexte
                  contenu={doc.contenu}
                  champ={(i, question) => (
                    <div className="champ">
                      <label htmlFor={`reponse-${i}`} className="document-question-texte">
                        {question}
                      </label>
                      <textarea
                        id={`reponse-${i}`}
                        rows={3}
                        maxLength={REPONSE_MAX}
                        value={reponses[i] ?? ''}
                        onChange={(e) => setReponses((r) => r.map((x, j) => (j === i ? e.target.value : x)))}
                      />
                    </div>
                  )}
                />
                {erreur && <Erreur message={erreur} />}
                <p className="meta" style={{ marginTop: 14 }}>
                  Vous pouvez laisser une question sans réponse. Une fois envoyées, les réponses ne se modifient plus.
                </p>
                <div className="actions" style={{ marginTop: 12 }}>
                  <button className="bouton bouton-principal" disabled={envoi}>
                    <Icone nom="envoyer" taille={16} /> {envoi ? 'Envoi…' : 'Envoyer mes réponses'}
                  </button>
                </div>
              </form>
            ) : (
              <DocumentTexte contenu={doc.contenu} />
            )}
            <div className="actions ne-pas-imprimer" style={{ marginTop: 20 }}>
              <button className="bouton" onClick={() => window.print()}>
                <Icone nom="imprimer" taille={16} /> Imprimer ou enregistrer en PDF
              </button>
            </div>
          </article>
        )}
      </div>
      <PiedPublic />
    </div>
  );
}
