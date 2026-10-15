// Rappeler un exercice à compléter resté sans réponse : un nouveau lien
// remplace l'ancien (90 jours), message préparé, envoyé par le thérapeute
// depuis sa messagerie. Rien ne part tout seul.

import { useState } from 'react';
import { donnees } from '../donnees';
import { dateLongue, messageErreur } from '../domaine/format';
import { lienDocument, lienMailto, lienSms } from '../domaine/messages';
import type { ClientResume, Remise } from '../domaine/types';
import { useReglages } from '../etat/reglages';
import { useTherapeute } from '../etat/session';
import { Dialogue, Erreur, useNotifier } from './Commun';
import { Icone } from './Icone';

export function DialogueRappelExercice({
  remise: r,
  client,
  fermer,
}: {
  remise: Remise;
  client: Pick<ClientResume, 'prenom' | 'nom' | 'email' | 'telephone'>;
  /** `true` si le nouveau lien a été créé (le rappel est noté). */
  fermer: (cree: boolean) => void;
}) {
  const t = useTherapeute();
  const { parametres: p } = useReglages();
  const notifier = useNotifier();
  const [lien, setLien] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function creer() {
    setEnvoi(true);
    setErreur(null);
    try {
      const { jeton, expire_le } = await donnees.relancerRemise(r.id);
      const url = lienDocument(jeton);
      setLien(url);
      setMessage(
        [
          `Bonjour ${client.prenom},`,
          '',
          `Petit rappel : je vous ai proposé « ${r.titre} » le ${dateLongue(r.cree_le)}. Vous pouvez y répondre quand vous le souhaitez, depuis ce lien :`,
          url,
          '',
          `Ce lien est personnel et valable jusqu'au ${dateLongue(expire_le)}.`,
          '',
          p.signature || `${t.prenom} ${t.nom}`.trim(),
        ].join('\n'),
      );
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnvoi(false);
    }
  }

  async function copier() {
    try {
      await navigator.clipboard.writeText(message);
      notifier('Message copié.');
    } catch {
      setErreur('Copie impossible : sélectionnez le texte à la main.');
    }
  }

  return (
    <Dialogue
      ouvert
      fermer={() => fermer(!!lien)}
      titre={`Rappeler « ${r.titre} » à ${client.prenom} ${client.nom}`}
      pied={
        lien ? (
          <button className="bouton bouton-principal" onClick={() => fermer(true)}>
            <Icone nom="valider" taille={16} /> Terminé
          </button>
        ) : (
          <>
            <button className="bouton" onClick={() => fermer(false)}>
              Annuler
            </button>
            <button className="bouton bouton-principal" onClick={creer} disabled={envoi}>
              <Icone nom="lien" taille={16} /> Préparer le rappel
            </button>
          </>
        )
      }
    >
      {erreur && <Erreur message={erreur} />}
      {!lien ? (
        <p>
          Exercice remis le {dateLongue(r.cree_le)}
          {r.ouvert_le ? `, ouvert le ${dateLongue(r.ouvert_le)}` : ', jamais ouvert'}, toujours sans réponse. Un
          nouveau lien remplace l'ancien (90 jours) ; vous envoyez le message depuis votre messagerie.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          <div className="champ">
            <label htmlFor="rappel-exercice">Message</label>
            <textarea id="rappel-exercice" rows={9} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <div className="actions">
            {client.email && (
              <a className="bouton bouton-doux" href={lienMailto(client.email, `Rappel : ${r.titre}`, message)}>
                <Icone nom="courriel" taille={16} /> Ouvrir dans ma messagerie
              </a>
            )}
            {client.telephone && (
              <a className="bouton bouton-doux" href={lienSms(client.telephone, message)}>
                <Icone nom="sms" taille={16} /> Ouvrir dans Messages
              </a>
            )}
            <button className="bouton" onClick={copier}>
              <Icone nom="copier" taille={16} /> Copier le message
            </button>
            {donnees.mode === 'demo' && (
              <a className="bouton" href={lien} target="_blank" rel="noopener noreferrer">
                <Icone nom="document" taille={16} /> Voir comme le client
              </a>
            )}
          </div>
        </div>
      )}
    </Dialogue>
  );
}
