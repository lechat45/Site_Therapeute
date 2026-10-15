// Note du journal : libre ou liée à un client, privée au thérapeute.

import { useState, type FormEvent } from 'react';
import { donnees } from '../donnees';
import { messageErreur } from '../domaine/format';
import type { ClientResume, Note } from '../domaine/types';
import { Dialogue, Erreur, useNotifier } from './Commun';
import { Icone } from './Icone';

export function DialogueNote({
  note,
  clients,
  clientImpose,
  fermer,
}: {
  /** `null` : nouvelle note. */
  note: Note | null;
  clients: Pick<ClientResume, 'id' | 'nom' | 'prenom'>[];
  /** Fiche client : la note y est rattachée d'office. */
  clientImpose?: string;
  fermer: (modifiee: boolean) => void;
}) {
  const notifier = useNotifier();
  const [titre, setTitre] = useState(note?.titre ?? '');
  const [contenu, setContenu] = useState(note?.contenu ?? '');
  const [clientId, setClientId] = useState(note?.client_id ?? clientImpose ?? '');
  const [epinglee, setEpinglee] = useState(note?.epinglee ?? false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const tries = [...clients].sort((a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr'));

  async function valider(e: FormEvent) {
    e.preventDefault();
    if (!titre.trim() && !contenu.trim()) return setErreur('La note est vide : écrivez au moins un titre ou un texte.');
    setEnvoi(true);
    try {
      await donnees.enregistrerNote(note?.id ?? null, {
        titre: titre.trim(),
        contenu: contenu.trim(),
        client_id: clientId || null,
        epinglee,
      });
      notifier(note ? 'Note enregistrée.' : 'Note ajoutée au journal.');
      fermer(true);
    } catch (err) {
      setErreur(messageErreur(err));
      setEnvoi(false);
    }
  }

  return (
    <Dialogue
      ouvert
      fermer={() => fermer(false)}
      titre={note ? 'Modifier la note' : 'Nouvelle note'}
      pied={
        <>
          <button className="bouton" onClick={() => fermer(false)}>
            Annuler
          </button>
          <button type="submit" form="form-note" className="bouton bouton-principal" disabled={envoi}>
            <Icone nom="enregistrer" taille={16} /> Enregistrer
          </button>
        </>
      }
    >
      <form id="form-note" onSubmit={valider} style={{ display: 'grid', gap: 14 }}>
        {erreur && <Erreur message={erreur} />}
        <div className="champ">
          <label htmlFor="note-titre">Titre (facultatif)</label>
          <input
            id="note-titre"
            maxLength={120}
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            placeholder="Ex. : supervision du 3 octobre"
          />
        </div>
        {!clientImpose && (
          <div className="champ">
            <label htmlFor="note-client">Client concerné (facultatif)</label>
            <select id="note-client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Aucun : note libre</option>
              {tries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom} {c.prenom}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="champ">
          <label htmlFor="note-contenu">Texte</label>
          <textarea
            id="note-contenu"
            rows={10}
            maxLength={20000}
            value={contenu}
            onChange={(e) => setContenu(e.target.value)}
            placeholder="Réflexions, idées, points à reprendre…"
          />
          <span className="indication">Privé : seul vous y avez accès. N'y notez que ce qui est utile au suivi.</span>
        </div>
        <label className="case-a-cocher">
          <input type="checkbox" checked={epinglee} onChange={(e) => setEpinglee(e.target.checked)} />
          <span>
            <Icone nom="epingle" taille={14} /> Épingler en haut du journal
          </span>
        </label>
      </form>
    </Dialogue>
  );
}
