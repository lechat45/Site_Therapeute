// Journal du thérapeute : notes libres (supervision, idées, lectures) ou
// liées à un client. Privées : seul le thérapeute y a accès.

import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Chargement, Confirmation, Erreur, useNotifier } from '../composants/Commun';
import { DialogueNote } from '../composants/DialogueNote';
import { Icone } from '../composants/Icone';
import { donnees } from '../donnees';
import { dateHeure, messageErreur, sansAccents } from '../domaine/format';
import type { ClientResume, Note } from '../domaine/types';
import { useTaches } from '../etat/tachesContexte';
import { useChargement } from '../etat/useChargement';

const APERCU = 400;

export function Journal() {
  const notes = useChargement(() => donnees.notes(), [], 'notes');
  const { clients } = useTaches();
  const notifier = useNotifier();
  const [params, setParams] = useSearchParams();
  const [recherche, setRecherche] = useState('');
  const filtre = params.get('filtre') ?? '';
  const [edition, setEdition] = useState<Note | 'nouvelle' | null>(null);
  const [suppression, setSuppression] = useState<Note | null>(null);
  const [deplies, setDeplies] = useState<Set<string>>(new Set());

  const parId = new Map(clients.map((c) => [c.id, c]));
  const liste = notes.donnees ?? [];
  const avecNotes = clients.filter((c) => liste.some((n) => n.client_id === c.id));
  const mots = sansAccents(recherche).split(/\s+/).filter(Boolean);
  const visibles = liste.filter((n) => {
    if (filtre === 'epinglees' && !n.epinglee) return false;
    if (filtre === 'libres' && n.client_id) return false;
    if (filtre.startsWith('c:') && n.client_id !== filtre.slice(2)) return false;
    if (!mots.length) return true;
    const c = n.client_id ? parId.get(n.client_id) : undefined;
    const texte = sansAccents(`${n.titre} ${n.contenu} ${c ? `${c.prenom} ${c.nom}` : ''}`);
    return mots.every((m) => texte.includes(m));
  });

  function choisirFiltre(f: string) {
    setParams(
      (p) => {
        if (f) p.set('filtre', f);
        else p.delete('filtre');
        return p;
      },
      { replace: true },
    );
  }

  async function epingler(n: Note) {
    try {
      await donnees.enregistrerNote(n.id, { ...n, epinglee: !n.epinglee });
      notes.recharger();
    } catch (e) {
      notifier(messageErreur(e), true);
    }
  }
  async function supprimer(n: Note) {
    setSuppression(null);
    try {
      await donnees.supprimerNote(n.id);
      notifier('Note supprimée.');
      notes.recharger();
    } catch (e) {
      notifier(messageErreur(e), true);
    }
  }

  return (
    <div className="page page-etroite">
      <div className="entete-page">
        <div>
          <h1>Journal</h1>
          <p className="sous-titre">
            Vos notes de travail : supervision, idées, lectures, points à reprendre. Libres ou liées à un client, elles
            restent privées.
          </p>
        </div>
        <button className="bouton bouton-principal" onClick={() => setEdition('nouvelle')}>
          <Icone nom="plus" /> Nouvelle note
        </button>
      </div>

      <div className="carte">
        <div className="filtres">
          <div className="recherche">
            <Icone nom="recherche" taille={16} />
            <input
              type="search"
              placeholder="Rechercher dans les notes…"
              aria-label="Rechercher dans les notes"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
          </div>
          <select aria-label="Afficher" value={filtre} onChange={(e) => choisirFiltre(e.target.value)}>
            <option value="">Toutes les notes ({liste.length})</option>
            <option value="epinglees">Épinglées ({liste.filter((n) => n.epinglee).length})</option>
            <option value="libres">Notes libres ({liste.filter((n) => !n.client_id).length})</option>
            {avecNotes.length > 0 && (
              <optgroup label="Liées à un client">
                {avecNotes.map((c) => (
                  <option key={c.id} value={`c:${c.id}`}>
                    {c.prenom} {c.nom} ({liste.filter((n) => n.client_id === c.id).length})
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
      </div>

      {notes.erreur && <Erreur message={notes.erreur} reessayer={notes.recharger} />}
      {!notes.donnees && notes.chargement ? (
        <Chargement />
      ) : visibles.length === 0 ? (
        <div className="carte vide">
          <Icone nom="livre" taille={28} />
          <p>
            {liste.length === 0
              ? 'Votre journal est vide. « Nouvelle note » pour écrire la première.'
              : 'Aucune note ne correspond à cette recherche.'}
          </p>
        </div>
      ) : (
        <div className="liste-notes">
          {visibles.map((n) => (
            <CarteNote
              key={n.id}
              note={n}
              client={n.client_id ? parId.get(n.client_id) : undefined}
              deplie={deplies.has(n.id)}
              basculer={() =>
                setDeplies((d) => {
                  const s = new Set(d);
                  if (s.has(n.id)) s.delete(n.id);
                  else s.add(n.id);
                  return s;
                })
              }
              modifier={() => setEdition(n)}
              epingler={() => epingler(n)}
              supprimer={() => setSuppression(n)}
            />
          ))}
        </div>
      )}

      {edition && (
        <DialogueNote
          note={edition === 'nouvelle' ? null : edition}
          clients={clients}
          clientImpose={edition === 'nouvelle' && filtre.startsWith('c:') ? filtre.slice(2) : undefined}
          fermer={(modifiee) => {
            setEdition(null);
            if (modifiee) notes.recharger();
          }}
        />
      )}
      {suppression && (
        <Confirmation
          titre="Supprimer cette note ?"
          action="Supprimer la note"
          confirmer={() => supprimer(suppression)}
          fermer={() => setSuppression(null)}
        >
          <p>
            « {suppression.titre || 'Note sans titre'} » sera effacée définitivement. Cette action ne peut pas être
            annulée.
          </p>
        </Confirmation>
      )}
    </div>
  );
}

export function CarteNote({
  note: n,
  client,
  deplie,
  basculer,
  modifier,
  epingler,
  supprimer,
}: {
  note: Note;
  client?: Pick<ClientResume, 'id' | 'nom' | 'prenom'>;
  deplie: boolean;
  basculer: () => void;
  modifier: () => void;
  epingler?: () => void;
  supprimer: () => void;
}) {
  const long = n.contenu.length > APERCU;
  return (
    <article className={`carte note${n.epinglee ? ' note-epinglee' : ''}`}>
      <div className="note-entete">
        <h2>{n.titre || 'Note sans titre'}</h2>
        <div className="puces">
          {n.epinglee && (
            <span className="puce puce-neutre">
              <Icone nom="epingle" taille={12} /> Épinglée
            </span>
          )}
          {client ? (
            <Link className="puce puce-neutre" to={`/clients/${client.id}`}>
              <Icone nom="utilisateur" taille={12} /> {client.prenom} {client.nom}
            </Link>
          ) : (
            <span className="puce puce-neutre">
              <Icone nom="livre" taille={12} /> Note libre
            </span>
          )}
        </div>
      </div>
      {n.contenu && (
        <p className="note-texte">{long && !deplie ? `${n.contenu.slice(0, APERCU).trimEnd()}…` : n.contenu}</p>
      )}
      {long && (
        <button className="bouton-lien" onClick={basculer} aria-expanded={deplie}>
          {deplie ? 'Réduire' : 'Lire la suite'}
        </button>
      )}
      <div className="note-pied">
        <span className="meta">
          {n.maj_le !== n.cree_le ? `Modifiée le ${dateHeure(n.maj_le)}` : `Écrite le ${dateHeure(n.cree_le)}`}
        </span>
        <div className="actions">
          <button className="bouton bouton-petit" onClick={modifier}>
            <Icone nom="crayon" taille={14} /> Modifier
          </button>
          {epingler && (
            <button className="bouton bouton-petit" onClick={epingler}>
              <Icone nom="epingle" taille={14} /> {n.epinglee ? 'Désépingler' : 'Épingler'}
            </button>
          )}
          <button className="bouton bouton-petit bouton-danger" onClick={supprimer}>
            <Icone nom="corbeille" taille={14} /> Supprimer
          </button>
        </div>
      </div>
    </article>
  );
}
