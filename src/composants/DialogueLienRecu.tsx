// Envoyer un reçu au client : lien personnel (90 jours, sans compte) vers
// la version à imprimer ou à enregistrer en PDF ; message prêt pour la
// messagerie ou les SMS du thérapeute. Un nouveau lien remplace l'ancien.

import { useState } from 'react';
import { donnees } from '../donnees';
import { dateLongue, messageErreur } from '../domaine/format';
import { lienMailto, lienRecu, lienSms } from '../domaine/messages';
import { numeroRecu } from '../domaine/texte';
import type { ClientResume, Recu } from '../domaine/types';
import { useReglages } from '../etat/reglages';
import { useTherapeute } from '../etat/session';
import { Dialogue, Erreur, useNotifier } from './Commun';
import { Icone } from './Icone';

export function DialogueLienRecu({
  recu: r,
  client,
  fermer,
}: {
  recu: Recu;
  client: Pick<ClientResume, 'prenom' | 'nom' | 'email' | 'telephone'>;
  /** `true` si un lien a été créé. */
  fermer: (cree: boolean) => void;
}) {
  const t = useTherapeute();
  const { parametres: p } = useReglages();
  const notifier = useNotifier();
  const [lien, setLien] = useState<{ url: string; expire_le: string } | null>(null);
  const [message, setMessage] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const actif = r.lien_expire_le !== null && r.lien_expire_le > new Date().toISOString();

  async function creer() {
    setEnvoi(true);
    setErreur(null);
    try {
      const { jeton, expire_le } = await donnees.preparerLienRecu(r.id);
      const url = lienRecu(jeton);
      setLien({ url, expire_le });
      setMessage(
        [
          `Bonjour ${client.prenom},`,
          '',
          `Voici votre reçu n° ${numeroRecu(r)} pour la séance du ${dateLongue(r.date_seance)} :`,
          url,
          '',
          `Vous pouvez l'imprimer ou l'enregistrer en PDF depuis cette page, par exemple pour votre mutuelle. Ce lien est personnel et valable jusqu'au ${dateLongue(expire_le)}.`,
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

  async function copier(texte: string, quoi: string) {
    try {
      await navigator.clipboard.writeText(texte);
      notifier(`${quoi} copié.`);
    } catch {
      setErreur('Copie impossible : sélectionnez le texte à la main.');
    }
  }

  const objet = `Votre reçu n° ${numeroRecu(r)}`;
  return (
    <Dialogue
      ouvert
      fermer={() => fermer(!!lien)}
      titre={`Envoyer le reçu n° ${numeroRecu(r)}`}
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
              <Icone nom="lien" taille={16} /> Créer le lien
            </button>
          </>
        )
      }
    >
      {erreur && <Erreur message={erreur} />}
      {!lien ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <p>
            {client.prenom} {client.nom} recevra un lien personnel vers son reçu, à imprimer ou à enregistrer en PDF.
            Rien ne part tout seul : vous envoyez le message depuis votre messagerie.
          </p>
          {actif && (
            <div className="alerte" role="note">
              <Icone nom="info" />
              <span>
                Un lien est déjà actif (jusqu'au {dateLongue(r.lien_expire_le)}
                {r.lien_ouvert_le ? `, ouvert le ${dateLongue(r.lien_ouvert_le)}` : ''}) : en créer un nouveau désactive
                l'ancien.
              </span>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          <div className="champ">
            <label htmlFor="recu-message">Message</label>
            <textarea id="recu-message" rows={9} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <div className="actions">
            {client.email && (
              <a className="bouton bouton-doux" href={lienMailto(client.email, objet, message)}>
                <Icone nom="courriel" taille={16} /> Ouvrir dans ma messagerie
              </a>
            )}
            {client.telephone && (
              <a className="bouton bouton-doux" href={lienSms(client.telephone, message)}>
                <Icone nom="sms" taille={16} /> Ouvrir dans Messages
              </a>
            )}
            <button className="bouton" onClick={() => copier(message, 'Message')}>
              <Icone nom="copier" taille={16} /> Copier le message
            </button>
            <button className="bouton" onClick={() => copier(lien.url, 'Lien')}>
              <Icone nom="lien" taille={16} /> Copier le lien seul
            </button>
            {donnees.mode === 'demo' && (
              <a className="bouton" href={lien.url} target="_blank" rel="noopener noreferrer">
                <Icone nom="recu" taille={16} /> Voir comme le client
              </a>
            )}
          </div>
        </div>
      )}
    </Dialogue>
  );
}
