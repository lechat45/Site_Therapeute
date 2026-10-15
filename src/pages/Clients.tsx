// « Mes clients » : liste, recherche, filtre par problématique, création
// d'une fiche, corbeille (clients supprimés, restaurables 30 jours).

import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chargement, Dialogue, Erreur, useNotifier } from '../composants/Commun';
import { Icone } from '../composants/Icone';
import { NUMERO_BILAN, PROBLEMATIQUES, SEANCES_INITIALES } from '../config/referentiels';
import { donnees } from '../donnees';
import { ageA, dateCourte, dateDuJour, messageErreur, sansAccents } from '../domaine/format';
import type { ClientResume } from '../domaine/types';
import { useChargement } from '../etat/useChargement';

/** Jours restants avant l'effacement définitif d'un client de la corbeille. */
const joursRestants = (supprimeLe: string) =>
  Math.max(0, 30 - Math.floor((Date.now() - Date.parse(supprimeLe)) / 86_400_000));

const libelleProblematique = (id: number) => PROBLEMATIQUES.find((p) => p.id === id)?.libelle ?? '?';

/** Pastilles du parcours : 3 séances initiales, le bilan (losange), puis « +n ». */
export function ParcoursMini({ nb }: { nb: number }) {
  const etat =
    nb === 0
      ? 'Aucune séance'
      : nb < SEANCES_INITIALES
        ? `${nb} séance${nb > 1 ? 's' : ''} initiale${nb > 1 ? 's' : ''} sur ${SEANCES_INITIALES}`
        : nb === SEANCES_INITIALES
          ? 'Séances initiales terminées, bilan à faire'
          : nb === NUMERO_BILAN
            ? 'Bilan réalisé'
            : `Bilan réalisé et ${nb - NUMERO_BILAN} séance${nb - NUMERO_BILAN > 1 ? 's' : ''} supplémentaire${nb - NUMERO_BILAN > 1 ? 's' : ''}`;
  return (
    <span className="parcours-mini" title={etat}>
      <span className="visuellement-cache">{etat}</span>
      {Array.from({ length: SEANCES_INITIALES }, (_, i) => (
        <span key={i} className={i < nb ? 'fait' : ''} aria-hidden />
      ))}
      <span className={`bilan${nb >= NUMERO_BILAN ? ' fait' : ''}`} aria-hidden />
      {nb > NUMERO_BILAN && <em aria-hidden>+{nb - NUMERO_BILAN}</em>}
    </span>
  );
}

export function Clients() {
  const liste = useChargement(() => donnees.listerClients(), [], 'clients');
  const [recherche, setRecherche] = useState('');
  const [filtre, setFiltre] = useState('');
  const [tri, setTri] = useState<'recent' | 'nom'>('recent');
  const [creation, setCreation] = useState(false);
  const [corbeille, setCorbeille] = useState(false);
  const naviguer = useNavigate();

  const clients = useMemo(() => {
    const q = sansAccents(recherche.trim());
    return (liste.donnees ?? [])
      .filter((c) => !q || sansAccents(`${c.prenom} ${c.nom} ${c.nom} ${c.prenom}`).includes(q))
      .filter((c) => !filtre || c.problematiques.includes(Number(filtre)))
      .sort((a, b) =>
        tri === 'nom'
          ? a.nom.localeCompare(b.nom, 'fr') || a.prenom.localeCompare(b.prenom, 'fr')
          : (b.derniere_seance ?? b.cree_le).localeCompare(a.derniere_seance ?? a.cree_le),
      );
  }, [liste.donnees, recherche, filtre, tri]);

  return (
    <div className="page">
      <div className="entete-page">
        <div>
          <h1>Mes clients</h1>
          <p className="sous-titre" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Icone nom="cadenas" taille={14} /> Fiches strictement privées : vous seul(e) y avez accès.
          </p>
        </div>
        <div className="actions">
          <button className="bouton" onClick={() => setCorbeille(true)}>
            <Icone nom="corbeille" taille={16} /> Corbeille
          </button>
          <button className="bouton bouton-principal" onClick={() => setCreation(true)}>
            <Icone nom="plus" /> Nouveau client
          </button>
        </div>
      </div>

      <div className="carte">
        <div className="filtres">
          <div className="recherche">
            <Icone nom="recherche" taille={16} />
            <input
              type="search"
              placeholder="Rechercher par nom ou prénom…"
              aria-label="Rechercher un client"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
          </div>
          <select aria-label="Filtrer par problématique" value={filtre} onChange={(e) => setFiltre(e.target.value)}>
            <option value="">Toutes les problématiques</option>
            {PROBLEMATIQUES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.libelle}
              </option>
            ))}
          </select>
          <select
            aria-label="Trier"
            value={tri}
            onChange={(e) => setTri(e.target.value as 'recent' | 'nom')}
            style={{ flex: '0 1 200px' }}
          >
            <option value="recent">Séance la plus récente</option>
            <option value="nom">Ordre alphabétique</option>
          </select>
        </div>

        {liste.chargement && !liste.donnees ? (
          <Chargement />
        ) : liste.erreur ? (
          <div className="carte-corps">
            <Erreur message={liste.erreur} reessayer={liste.recharger} />
          </div>
        ) : clients.length === 0 ? (
          <div className="vide">
            <Icone nom="clients" taille={28} />
            {liste.donnees?.length ? (
              <p>Aucun client ne correspond à ces critères.</p>
            ) : (
              <>
                <p>Vous n'avez encore aucun client.</p>
                <button className="bouton bouton-principal" onClick={() => setCreation(true)}>
                  <Icone nom="plus" /> Créer la première fiche
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="tableau-conteneur">
            <table>
              <thead>
                <tr>
                  <th scope="col">Client</th>
                  <th scope="col" className="num">
                    Âge
                  </th>
                  <th scope="col">Parcours</th>
                  <th scope="col">Dernière séance</th>
                  <th scope="col">Problématiques</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id} className="ligne-cliquable" onClick={() => naviguer(`/clients/${c.id}`)}>
                    <td>
                      <a
                        href={`/clients/${c.id}`}
                        className="nom-client"
                        style={{ color: 'inherit', textDecoration: 'none' }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation(); // la ligne navigue déjà
                          naviguer(`/clients/${c.id}`);
                        }}
                      >
                        {c.nom.toUpperCase()} {c.prenom}
                        <small>né(e) en {c.annee_naissance}</small>
                      </a>
                    </td>
                    <td className="num">{ageA(c.annee_naissance)} ans</td>
                    <td>
                      <ParcoursMini nb={c.nb_seances} />
                    </td>
                    <td>{dateCourte(c.derniere_seance)}</td>
                    <td>
                      <div className="puces">
                        {c.problematiques.slice(0, 2).map((id) => (
                          <span key={id} className="puce">
                            {libelleProblematique(id)}
                          </span>
                        ))}
                        {c.problematiques.length > 2 && (
                          <span className="puce puce-neutre">+{c.problematiques.length - 2}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* monté à l'ouverture seulement : un formulaire annulé repart vide */}
      {creation && (
        <DialogueNouveauClient ouvert fermer={() => setCreation(false)} cree={(id) => naviguer(`/clients/${id}`)} />
      )}
      {corbeille && (
        <DialogueCorbeille
          fermer={(modifie) => {
            setCorbeille(false);
            if (modifie) liste.recharger();
          }}
        />
      )}
    </div>
  );
}

/** Clients supprimés : restaurables pendant 30 jours, puis effacés définitivement. */
function DialogueCorbeille({ fermer }: { fermer: (modifie: boolean) => void }) {
  const notifier = useNotifier();
  const charge = useChargement(() => donnees.listerCorbeille(), []);
  const [modifie, setModifie] = useState(false);
  const [aEffacer, setAEffacer] = useState<ClientResume | null>(null);

  async function agir(c: ClientResume, action: 'restaurer' | 'effacer') {
    try {
      if (action === 'restaurer') await donnees.restaurerClient(c.id);
      else await donnees.supprimerClientDefinitivement(c.id);
      notifier(
        action === 'restaurer'
          ? `${c.prenom} ${c.nom} est de retour dans vos clients.`
          : `${c.prenom} ${c.nom} et tout son parcours ont été effacés.`,
      );
      setModifie(true);
      setAEffacer(null);
      charge.recharger();
    } catch (e) {
      notifier(messageErreur(e), true);
    }
  }

  return (
    <Dialogue
      ouvert
      fermer={() => fermer(modifie)}
      titre="Corbeille"
      pied={
        <button className="bouton bouton-principal" onClick={() => fermer(modifie)}>
          Fermer
        </button>
      }
    >
      <p className="meta">
        Un client supprimé reste ici 30 jours, avec tout son parcours, puis il est effacé définitivement.
      </p>
      {charge.erreur && <Erreur message={charge.erreur} reessayer={charge.recharger} />}
      {!charge.donnees && !charge.erreur && <Chargement />}
      {charge.donnees?.length === 0 && <p>La corbeille est vide.</p>}
      {!!charge.donnees?.length && (
        <ul className="bibliotheque">
          {charge.donnees.map((c) => (
            <li key={c.id}>
              <div>
                <p>
                  {c.nom.toUpperCase()} {c.prenom}
                </p>
                <span className="meta">
                  Supprimé le {dateCourte(c.supprime_le)} · effacement dans {joursRestants(c.supprime_le!)} jour(s) ·{' '}
                  {c.nb_seances} séance{c.nb_seances > 1 ? 's' : ''}
                </span>
                {aEffacer?.id === c.id && (
                  <div className="alerte alerte-danger" role="alert" style={{ marginTop: 8 }}>
                    <span>
                      Effacer définitivement {c.prenom} {c.nom} ? Cette action est irréversible.{' '}
                      <button className="bouton bouton-petit bouton-danger" onClick={() => agir(c, 'effacer')}>
                        Effacer
                      </button>{' '}
                      <button className="bouton bouton-petit" onClick={() => setAEffacer(null)}>
                        Annuler
                      </button>
                    </span>
                  </div>
                )}
              </div>
              <div className="actions">
                <button className="bouton bouton-petit bouton-principal" onClick={() => agir(c, 'restaurer')}>
                  Restaurer
                </button>
                <button className="bouton bouton-petit bouton-danger" onClick={() => setAEffacer(c)}>
                  Effacer
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Dialogue>
  );
}

function DialogueNouveauClient({
  ouvert,
  fermer,
  cree,
}: {
  ouvert: boolean;
  fermer: () => void;
  cree: (id: string) => void;
}) {
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [annee, setAnnee] = useState('');
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [accord, setAccord] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const notifier = useNotifier();
  const anneeCourante = new Date().getFullYear();

  async function valider(e: FormEvent) {
    e.preventDefault();
    const a = Number(annee);
    if (!nom.trim() || !prenom.trim()) return setErreur('Le nom et le prénom sont obligatoires.');
    if (!Number.isInteger(a) || a < 1900 || a > anneeCourante)
      return setErreur(`L'année de naissance doit être comprise entre 1900 et ${anneeCourante}.`);
    setEnvoi(true);
    setErreur(null);
    try {
      const client = await donnees.creerClient({
        nom: nom.trim(),
        prenom: prenom.trim(),
        annee_naissance: a,
        email: email.trim() || null,
        telephone: telephone.trim() || null,
        accord_relance_le: accord ? dateDuJour() : null,
      });
      notifier(`Fiche de ${client.prenom} ${client.nom} créée.`);
      cree(client.id);
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Dialogue
      ouvert={ouvert}
      fermer={fermer}
      titre="Nouveau client"
      pied={
        <>
          <button type="button" className="bouton" onClick={fermer}>
            Annuler
          </button>
          <button type="submit" form="form-nouveau-client" className="bouton bouton-principal" disabled={envoi}>
            {envoi ? 'Création…' : 'Créer la fiche'}
          </button>
        </>
      }
    >
      <form id="form-nouveau-client" onSubmit={valider} style={{ display: 'grid', gap: 14 }} noValidate>
        <div className="grille-2">
          <div className="champ">
            <label htmlFor="nc-nom">Nom</label>
            <input id="nc-nom" value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="off" required />
          </div>
          <div className="champ">
            <label htmlFor="nc-prenom">Prénom</label>
            <input
              id="nc-prenom"
              value={prenom}
              onChange={(e) => setPrenom(e.target.value)}
              autoComplete="off"
              required
            />
          </div>
        </div>
        <div className="champ">
          <label htmlFor="nc-annee">Année de naissance</label>
          <input
            id="nc-annee"
            type="number"
            inputMode="numeric"
            min={1900}
            max={anneeCourante}
            placeholder={`ex. ${anneeCourante - 35}`}
            value={annee}
            onChange={(e) => setAnnee(e.target.value)}
            required
          />
          <span className="indication">L'âge est recalculé à chaque séance.</span>
        </div>
        <div className="grille-2">
          <div className="champ">
            <label htmlFor="nc-email">E-mail (facultatif)</label>
            <input
              id="nc-email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="champ">
            <label htmlFor="nc-tel">Téléphone (facultatif)</label>
            <input
              id="nc-tel"
              type="tel"
              autoComplete="off"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
            />
          </div>
        </div>
        <label className="case-a-cocher">
          <input type="checkbox" checked={accord} onChange={(e) => setAccord(e.target.checked)} />
          <span>
            Le client accepte d'être recontacté par e-mail ou SMS
            <span className="meta"> (relances et questionnaires de suivi)</span>
          </span>
        </label>
        {erreur && <Erreur message={erreur} />}
      </form>
    </Dialogue>
  );
}
