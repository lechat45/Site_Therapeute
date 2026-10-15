// Fiche client : notes du journal liées au client et documents remis.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { donnees } from '../donnees';
import { dateCourte } from '../domaine/format';
import type { ClientResume, Note, Remise } from '../domaine/types';
import { useChargement } from '../etat/useChargement';
import { DialogueNote } from './DialogueNote';
import { DialogueRemise } from './DialogueRemise';
import { DialogueReponsesExercice } from './ReponsesExercice';
import { Icone } from './Icone';

type ClientOutils = Pick<ClientResume, 'id' | 'nom' | 'prenom' | 'email' | 'telephone'>;

const EXTRAIT = 140;

export function NotesClient({ client }: { client: ClientOutils }) {
  const charge = useChargement(() => donnees.notes(), [client.id]);
  const [edition, setEdition] = useState<Note | 'nouvelle' | null>(null);
  const notes = (charge.donnees ?? []).filter((n) => n.client_id === client.id);

  return (
    <section className="carte" aria-labelledby="t-notes-client">
      <div className="carte-entete">
        <div>
          <h2 id="t-notes-client" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Icone nom="livre" /> Notes du journal
          </h2>
          <p className="aide">
            {notes.length
              ? `${notes.length} note${notes.length > 1 ? 's' : ''} sur ce client.`
              : 'Aucune note pour l’instant.'}
          </p>
        </div>
        <button className="bouton bouton-petit" onClick={() => setEdition('nouvelle')}>
          <Icone nom="plus" taille={14} /> Ajouter
        </button>
      </div>
      {notes.length > 0 && (
        <div className="carte-corps" style={{ paddingTop: 4, display: 'grid', gap: 8 }}>
          <ul className="notes-client">
            {notes.slice(0, 3).map((n) => (
              <li key={n.id}>
                <button className="note-mini" onClick={() => setEdition(n)}>
                  <strong>
                    {n.epinglee && <Icone nom="epingle" taille={12} titre="Épinglée" />} {n.titre || 'Note sans titre'}
                  </strong>
                  <span className="meta">
                    {dateCourte(n.maj_le)}
                    {n.contenu &&
                      ` · ${n.contenu.length > EXTRAIT ? `${n.contenu.slice(0, EXTRAIT).trimEnd()}…` : n.contenu}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Link to={`/journal?filtre=c:${client.id}`} className="meta">
            {notes.length > 3 ? `Voir les ${notes.length} notes dans le journal →` : 'Ouvrir le journal →'}
          </Link>
        </div>
      )}
      {edition && (
        <DialogueNote
          note={edition === 'nouvelle' ? null : edition}
          clients={[client]}
          clientImpose={client.id}
          fermer={(modifiee) => {
            setEdition(null);
            if (modifiee) charge.recharger();
          }}
        />
      )}
    </section>
  );
}

export function DocumentsClient({ client }: { client: ClientOutils }) {
  const charge = useChargement(
    () => Promise.all([donnees.listerRemises(client.id), donnees.ressources()]),
    [client.id],
  );
  const [remise, setRemise] = useState(false);
  const [lecture, setLecture] = useState<Remise | null>(null);
  const [remises, ressources] = charge.donnees ?? [[], []];
  const maintenant = new Date().toISOString();

  return (
    <section className="carte" aria-labelledby="t-docs-client">
      <div className="carte-entete">
        <div>
          <h2 id="t-docs-client" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Icone nom="document" /> Exercices remis
          </h2>
          <p className="aide">
            {remises.length
              ? `${remises.length} document${remises.length > 1 ? 's' : ''} remis.`
              : 'Aucun document remis pour l’instant.'}
          </p>
        </div>
        {ressources.length > 0 ? (
          <button className="bouton bouton-petit" onClick={() => setRemise(true)}>
            <Icone nom="envoyer" taille={14} /> Remettre
          </button>
        ) : (
          charge.donnees && (
            <Link className="bouton bouton-petit" to="/exercices">
              Bibliothèque →
            </Link>
          )
        )}
      </div>
      {remises.length > 0 && (
        <div className="carte-corps" style={{ paddingTop: 4 }}>
          <ul className="remises-client">
            {remises.slice(0, 5).map((r) => (
              <li key={r.id}>
                <Icone nom={r.mode === 'lien' ? 'lien' : 'imprimer'} taille={14} />
                <span>
                  <strong>{r.titre}</strong>
                  <span className="meta">
                    {' '}
                    · {r.mode === 'lien' ? 'par lien' : 'sur papier'} le {dateCourte(r.cree_le)}
                    {r.mode === 'lien' &&
                      (r.ouvert_le
                        ? ` · ouvert le ${dateCourte(r.ouvert_le)}`
                        : r.expire_le && r.expire_le < maintenant
                          ? ' · expiré'
                          : ' · pas encore ouvert')}
                  </span>
                  {r.repondu_le && (
                    <>
                      {' '}
                      <button className="puce puce-succes puce-bouton" onClick={() => setLecture(r)}>
                        <Icone nom={r.consulte_le ? 'valider' : 'cloche'} taille={12} />
                        {r.consulte_le ? 'Réponses lues' : 'Réponses reçues'} · voir
                      </button>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {lecture && (
        <DialogueReponsesExercice
          remise={lecture}
          client={client}
          fermer={(lues) => {
            setLecture(null);
            if (lues) charge.recharger();
          }}
        />
      )}
      {remise && (
        <DialogueRemise
          ressources={ressources}
          clients={[client]}
          clientInitial={client.id}
          fermer={(remis) => {
            setRemise(false);
            if (remis) charge.recharger();
          }}
        />
      )}
    </section>
  );
}
