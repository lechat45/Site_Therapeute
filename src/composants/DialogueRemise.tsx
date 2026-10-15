// Remettre un exercice ou un document à un client : lien personnel
// (90 jours, envoyé depuis la messagerie du thérapeute) ou impression.
// La remise garde une copie figée : modifier ensuite le document ne
// change pas ce que le client a reçu.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { donnees } from '../donnees';
import { dateLongue, messageErreur } from '../domaine/format';
import { lienDocument, lienMailto, lienSms } from '../domaine/messages';
import type { ClientResume, RemisePreparee, Ressource } from '../domaine/types';
import { useReglages } from '../etat/reglages';
import { useTherapeute } from '../etat/session';
import { Dialogue, Erreur, useNotifier } from './Commun';
import { Icone } from './Icone';

type ClientRemise = Pick<ClientResume, 'id' | 'nom' | 'prenom' | 'email' | 'telephone'>;

export function DialogueRemise({
  ressources,
  ressourceInitiale,
  clients,
  clientInitial,
  fermer,
}: {
  ressources: Ressource[];
  ressourceInitiale?: string;
  clients: ClientRemise[];
  clientInitial?: string;
  /** `true` si une remise a été enregistrée. */
  fermer: (remis: boolean) => void;
}) {
  const t = useTherapeute();
  const { parametres: p } = useReglages();
  const notifier = useNotifier();
  const naviguer = useNavigate();
  const [ressourceId, setRessourceId] = useState(ressourceInitiale ?? ressources[0]?.id ?? '');
  const [clientId, setClientId] = useState(clientInitial ?? '');
  const [mode, setMode] = useState<'lien' | 'imprime'>('lien');
  const [prep, setPrep] = useState<RemisePreparee | null>(null);
  const [message, setMessage] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const tries = [...clients].sort((a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr'));
  const client = clients.find((c) => c.id === clientId);
  const ressource = ressources.find((r) => r.id === ressourceId);
  const lien = prep?.jeton ? lienDocument(prep.jeton) : '';

  async function preparer() {
    if (!client || !ressource) return setErreur('Choisissez un document et un client.');
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await donnees.preparerRemise(ressource.id, client.id, mode);
      if (mode === 'imprime') {
        notifier(`Remise de « ${ressource.titre} » à ${client.prenom} notée.`);
        fermer(true);
        naviguer(`/exercices/${ressource.id}/imprimer?client=${client.id}`);
        return;
      }
      setPrep(r);
      const signature = p.signature || `${t.prenom} ${t.nom}`.trim();
      setMessage(
        [
          `Bonjour ${client.prenom},`,
          '',
          `Comme convenu, voici « ${ressource.titre} » :`,
          lienDocument(r.jeton!),
          '',
          `Ce lien est personnel et valable jusqu'au ${dateLongue(r.expire_le)}.`,
          '',
          signature,
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

  return (
    <Dialogue
      ouvert
      fermer={() => fermer(!!prep)}
      titre={prep && client ? `Lien pour ${client.prenom} ${client.nom}` : 'Remettre à un client'}
      pied={
        prep ? (
          <button className="bouton bouton-principal" onClick={() => fermer(true)}>
            <Icone nom="valider" taille={16} /> Terminé
          </button>
        ) : (
          <>
            <button className="bouton" onClick={() => fermer(false)}>
              Annuler
            </button>
            <button className="bouton bouton-principal" onClick={preparer} disabled={envoi || !client || !ressource}>
              {mode === 'lien' ? (
                <>
                  <Icone nom="lien" taille={16} /> Créer le lien
                </>
              ) : (
                <>
                  <Icone nom="imprimer" taille={16} /> Imprimer
                </>
              )}
            </button>
          </>
        )
      }
    >
      {erreur && <Erreur message={erreur} />}
      {!prep ? (
        <div style={{ display: 'grid', gap: 14 }}>
          <div className="champ">
            <label htmlFor="rem-doc">Document</label>
            <select id="rem-doc" value={ressourceId} onChange={(e) => setRessourceId(e.target.value)}>
              {ressources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.titre}
                </option>
              ))}
            </select>
          </div>
          <div className="champ">
            <label htmlFor="rem-client">Client</label>
            <select id="rem-client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">— Choisir —</option>
              {tries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom} {c.prenom}
                </option>
              ))}
            </select>
          </div>
          <fieldset className="segments-champ">
            <legend className="etiquette" style={{ marginBottom: 6 }}>
              Comment le remettre ?
            </legend>
            <div className="choix-remise">
              <label className={`choix${mode === 'lien' ? ' choisi' : ''}`}>
                <input type="radio" name="mode" checked={mode === 'lien'} onChange={() => setMode('lien')} />
                <Icone nom="lien" />
                <span>
                  <strong>Par lien personnel</strong>
                  <span className="meta">À envoyer par e-mail ou SMS ; valable 90 jours, sans compte.</span>
                </span>
              </label>
              <label className={`choix${mode === 'imprime' ? ' choisi' : ''}`}>
                <input type="radio" name="mode" checked={mode === 'imprime'} onChange={() => setMode('imprime')} />
                <Icone nom="imprimer" />
                <span>
                  <strong>Sur papier</strong>
                  <span className="meta">Ouvre la version à imprimer (ou à enregistrer en PDF).</span>
                </span>
              </label>
            </div>
          </fieldset>
          <p className="meta">
            Le client reçoit une copie du document tel qu'il est aujourd'hui : vos modifications ultérieures ne la
            changent pas.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          <p className="meta">
            Lien valable jusqu'au {dateLongue(prep.expire_le)}. Il ne montre que le document, aucune autre information.
          </p>
          <div className="champ">
            <label htmlFor="rem-message">Message</label>
            <textarea id="rem-message" rows={9} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <div className="actions">
            {client?.email && (
              <a
                className="bouton bouton-doux"
                href={lienMailto(client.email, ressource ? ressource.titre : 'Document', message)}
              >
                <Icone nom="courriel" taille={16} /> Ouvrir dans ma messagerie
              </a>
            )}
            {client?.telephone && (
              <a className="bouton bouton-doux" href={lienSms(client.telephone, message)}>
                <Icone nom="sms" taille={16} /> Ouvrir dans Messages
              </a>
            )}
            <button className="bouton" onClick={() => copier(message, 'Message')}>
              <Icone nom="copier" taille={16} /> Copier le message
            </button>
            <button className="bouton" onClick={() => copier(lien, 'Lien')}>
              <Icone nom="lien" taille={16} /> Copier le lien seul
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
