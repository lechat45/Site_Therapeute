// Fiche d'un client : identité, parcours (3 séances, bilan, séances à
// l'unité), évolution, séances, rendez-vous, suivi (relances), exercices
// remis, notes du journal, synthèse IA, problématiques.

import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { CarteSuiviClient } from '../composants/CarteSuiviClient';
import { Chargement, Dialogue, Erreur, useNotifier } from '../composants/Commun';
import { EvolutionClient } from '../composants/EvolutionClient';
import { Icone } from '../composants/Icone';
import { DocumentsClient, NotesClient } from '../composants/OutilsClient';
import { RendezVousClient } from '../composants/RendezVousClient';
import { casesTempsPresent, EMOTIONS, NUMERO_BILAN, PROBLEMATIQUES, SEANCES_INITIALES } from '../config/referentiels';
import { donnees } from '../donnees';
import { ageA, dateCourte, dateHeure, dateLongue, LIBELLE_TYPE, messageErreur } from '../domaine/format';
import { useReglages } from '../etat/reglages';
import { euros } from '../domaine/rentabilite';
import type { Client, Seance } from '../domaine/types';
import { useChargement } from '../etat/useChargement';

const libelleEmotion = (id: number) => EMOTIONS.find((e) => e.id === id)?.libelle ?? '?';

/** Émotions de la colonne 1 « temps présent », de haut en bas. */
const resumeTempsPresent = (s: Seance) =>
  casesTempsPresent(s.cases)
    .filter((c) => c.zone.startsWith('present1'))
    .map((c) => libelleEmotion(c.emotion_id))
    .join(' → ');

/** Libellé de l'action « séance suivante » selon l'avancement du parcours. */
export function libelleSeanceSuivante(nb: number) {
  if (nb === 0) return 'Démarrer la séance 1';
  if (nb < SEANCES_INITIALES) return `Nouvelle séance (${nb + 1} / ${SEANCES_INITIALES})`;
  if (nb === SEANCES_INITIALES) return 'Réaliser le bilan';
  return 'Ajouter une séance supplémentaire';
}

export function FicheClient() {
  const { clientId = '' } = useParams();
  const naviguer = useNavigate();
  const notifier = useNotifier();
  const fiche = useChargement(
    () =>
      Promise.all([
        donnees.lireClient(clientId),
        donnees.listerSeances(clientId),
        donnees.listerProblematiquesClient(clientId),
        donnees.listerEnvois(clientId),
      ]),
    [clientId],
  );
  const { parametres } = useReglages();
  const [creationEnCours, setCreationEnCours] = useState(false);
  const [edition, setEdition] = useState(false);
  const [suppression, setSuppression] = useState(false);
  const { hash } = useLocation();
  useEffect(() => {
    if (hash && fiche.donnees) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [hash, fiche.donnees]);

  if (fiche.chargement && !fiche.donnees) return <Chargement />;
  if (fiche.erreur)
    return (
      <div className="page page-etroite">
        <Erreur message={fiche.erreur} reessayer={fiche.recharger} />
        <Link to="/clients">← Retour à la liste</Link>
      </div>
    );
  const [client, seances, problematiques, envois] = fiche.donnees!;

  async function nouvelleSeance() {
    setCreationEnCours(true);
    try {
      const s = await donnees.creerSeance(client.id);
      naviguer(`/clients/${client.id}/seances/${s.id}`);
    } catch (e) {
      notifier(messageErreur(e), true);
      setCreationEnCours(false);
    }
  }

  async function ajouterProblematique(id: number) {
    try {
      await donnees.ajouterProblematique(client.id, id, 'therapeute');
      fiche.recharger();
    } catch (e) {
      notifier(messageErreur(e), true);
    }
  }
  async function retirerProblematique(id: number) {
    try {
      await donnees.retirerProblematique(client.id, id);
      fiche.recharger();
    } catch (e) {
      notifier(messageErreur(e), true);
    }
  }

  const derniere = seances[seances.length - 1];
  const analysee = [...seances].reverse().find((s) => s.analyse_ia);
  const disponibles = PROBLEMATIQUES.filter((p) => !problematiques.some((x) => x.problematique_id === p.id));

  return (
    <div className="page">
      <nav className="fil" aria-label="Fil d'Ariane">
        <Link to="/clients">Mes clients</Link>
        <Icone nom="chevron" taille={14} />
        <span aria-current="page">
          {client.prenom} {client.nom}
        </span>
      </nav>

      <div className="entete-page">
        <div>
          <h1>
            {client.prenom} {client.nom.toUpperCase()}
          </h1>
          <p className="sous-titre">
            Né(e) en {client.annee_naissance} · {ageA(client.annee_naissance)} ans
            {seances.length > 0 && <> · suivi(e) depuis le {dateLongue(seances[0].date_seance)}</>}
          </p>
          <p className="coordonnees">
            {client.email && (
              <a href={`mailto:${client.email}`}>
                <Icone nom="courriel" taille={14} /> {client.email}
              </a>
            )}
            {client.telephone && (
              <a href={`tel:${client.telephone.replace(/[^\d+]/g, '')}`}>
                <Icone nom="sms" taille={14} /> {client.telephone}
              </a>
            )}
            {!client.email && !client.telephone && <span>Aucune coordonnée</span>}
            {parametres.tarifs_actifs && (
              <span>
                <Icone nom="euro" taille={14} />{' '}
                {client.prix_seance !== null
                  ? `${euros(client.prix_seance, 2)} la séance`
                  : parametres.prix_defaut !== null
                    ? `${euros(parametres.prix_defaut, 2)} la séance (tarif par défaut)`
                    : 'pas de tarif'}
              </span>
            )}
          </p>
        </div>
        <div className="actions">
          <button className="bouton" onClick={() => setEdition(true)}>
            <Icone nom="crayon" taille={16} /> Modifier
          </button>
          {!client.supprime_le && (
            <button className="bouton bouton-danger" onClick={() => setSuppression(true)}>
              <Icone nom="corbeille" taille={16} /> Supprimer
            </button>
          )}
          <button className="bouton bouton-principal" onClick={nouvelleSeance} disabled={creationEnCours}>
            <Icone nom="plus" /> {libelleSeanceSuivante(seances.length)}
          </button>
        </div>
      </div>

      {client.supprime_le && (
        <div className="alerte alerte-danger" role="status">
          <Icone nom="corbeille" />
          <span>
            Ce client est dans la corbeille depuis le {dateCourte(client.supprime_le)} : il sera effacé définitivement
            30 jours après.{' '}
            <button
              className="bouton bouton-petit"
              onClick={async () => {
                try {
                  await donnees.restaurerClient(client.id);
                  notifier('Fiche restaurée.');
                  fiche.recharger();
                } catch (e) {
                  notifier(messageErreur(e), true);
                }
              }}
            >
              Restaurer
            </button>
          </span>
        </div>
      )}

      <div className="grille-fiche">
        <div className="colonne">
          <section className="carte" aria-labelledby="titre-parcours">
            <div className="carte-entete">
              <div>
                <h2 id="titre-parcours">Parcours</h2>
                <p className="aide">
                  {SEANCES_INITIALES} séances initiales, un bilan, puis des séances supplémentaires à l'unité.
                </p>
              </div>
            </div>
            <div className="carte-corps">
              <Parcours client={client} seances={seances} ajouter={nouvelleSeance} occupe={creationEnCours} />
            </div>
          </section>

          <section className="carte" aria-labelledby="titre-evolution" id="evolution">
            <div className="carte-entete">
              <div>
                <h2 id="titre-evolution" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Icone nom="evolution" /> Évolution
                </h2>
                <p className="aide">Ce que disent le questionnaire de suivi et les fiches, au fil du temps.</p>
              </div>
            </div>
            <div className="carte-corps">
              <EvolutionClient seances={seances} envois={envois} />
            </div>
          </section>

          <section className="carte" aria-labelledby="titre-seances">
            <div className="carte-entete">
              <h2 id="titre-seances">Historique des séances</h2>
            </div>
            <div className="carte-corps" style={{ paddingTop: 8 }}>
              {seances.length === 0 ? (
                <p className="meta">Aucune séance pour l'instant.</p>
              ) : (
                <div className="tableau-conteneur">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Séance</th>
                        <th scope="col">Date</th>
                        <th scope="col">Émotions au temps présent</th>
                        <th scope="col">Analyse IA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...seances].reverse().map((s) => (
                        <tr
                          key={s.id}
                          className="ligne-cliquable"
                          onClick={() => naviguer(`/clients/${client.id}/seances/${s.id}`)}
                        >
                          <td>
                            <Link
                              to={`/clients/${client.id}/seances/${s.id}`}
                              style={{ fontWeight: 650 }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              Séance {s.numero}
                            </Link>{' '}
                            <span className={`puce ${s.type === 'bilan' ? '' : 'puce-neutre'}`}>
                              {LIBELLE_TYPE[s.type]}
                            </span>
                          </td>
                          <td>{dateCourte(s.date_seance)}</td>
                          <td>{resumeTempsPresent(s) || '—'}</td>
                          <td>
                            {s.analyse_ia ? (
                              <span className="puce puce-succes">
                                <Icone nom="valider" taille={12} /> Analysée
                              </span>
                            ) : (
                              <span className="puce puce-alerte">
                                <Icone nom="horloge" taille={12} /> À analyser
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="colonne">
          {!client.supprime_le && <RendezVousClient clientId={client.id} />}
          <CarteSuiviClient client={client} seances={seances} envois={envois} recharger={fiche.recharger} />
          {!client.supprime_le && <DocumentsClient client={client} />}
          {!client.supprime_le && <NotesClient client={client} />}

          <section className="carte panneau-ia" aria-labelledby="titre-synthese">
            <div className="carte-entete">
              <div>
                <h2 id="titre-synthese" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Icone nom="etincelles" /> Synthèse évolutive
                </h2>
                <p className="aide">Rédigée par l'IA à partir des notes de chaque séance, à relire.</p>
              </div>
            </div>
            <div className="carte-corps" style={{ display: 'grid', gap: 12 }}>
              {client.synthese_ia ? (
                <>
                  <p className="synthese">{client.synthese_ia}</p>
                  <p className="meta">
                    Mise à jour le {dateHeure(client.synthese_ia_maj_le)}
                    {analysee && <> · jusqu'à la séance {analysee.numero}</>}
                    {analysee?.analyse_ia?.modele && <> · {analysee.analyse_ia.modele}</>}
                  </p>
                </>
              ) : (
                <p className="meta">
                  Aucune synthèse pour l'instant. Lancez l'analyse IA depuis une fiche de séance après avoir rédigé vos
                  notes.
                </p>
              )}
              {derniere && !derniere.analyse_ia && (
                <Link className="bouton bouton-doux" to={`/clients/${client.id}/seances/${derniere.id}#ia`}>
                  <Icone nom="etincelles" taille={16} /> Analyser la séance {derniere.numero}
                </Link>
              )}
            </div>
          </section>

          <section className="carte" aria-labelledby="titre-problematiques-client">
            <div className="carte-entete">
              <div>
                <h2 id="titre-problematiques-client">Problématiques</h2>
                <p className="aide">Motifs de consultation retenus (alimentent les statistiques).</p>
              </div>
            </div>
            <div className="carte-corps" style={{ display: 'grid', gap: 12 }}>
              {problematiques.length ? (
                <div className="puces">
                  {problematiques.map((p) => (
                    <span key={p.problematique_id} className={`puce${p.source === 'ia' ? ' puce-ia' : ''}`}>
                      {p.source === 'ia' && <Icone nom="etincelles" taille={12} titre="Suggérée par l'IA" />}
                      {PROBLEMATIQUES.find((x) => x.id === p.problematique_id)?.libelle}
                      <button
                        aria-label={`Retirer ${PROBLEMATIQUES.find((x) => x.id === p.problematique_id)?.libelle}`}
                        onClick={() => retirerProblematique(p.problematique_id)}
                      >
                        <Icone nom="croix" taille={12} />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="meta">Aucune problématique retenue.</p>
              )}
              {disponibles.length > 0 && (
                <select
                  aria-label="Ajouter une problématique"
                  value=""
                  onChange={(e) => e.target.value && ajouterProblematique(Number(e.target.value))}
                >
                  <option value="">+ Ajouter une problématique…</option>
                  {disponibles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.libelle}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </section>
        </div>
      </div>

      {edition && (
        <DialogueIdentite client={client} ouvert fermer={() => setEdition(false)} enregistre={fiche.recharger} />
      )}
      <Dialogue
        ouvert={suppression}
        fermer={() => setSuppression(false)}
        titre="Supprimer ce client ?"
        pied={
          <>
            <button className="bouton" onClick={() => setSuppression(false)}>
              Annuler
            </button>
            <button
              className="bouton bouton-principal"
              style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
              onClick={async () => {
                try {
                  await donnees.supprimerClient(client.id);
                  notifier('Fiche placée dans la corbeille (restaurable pendant 30 jours).');
                  naviguer('/clients');
                } catch (e) {
                  notifier(messageErreur(e), true);
                }
              }}
            >
              Mettre à la corbeille
            </button>
          </>
        }
      >
        <p>
          La fiche de{' '}
          <strong>
            {client.prenom} {client.nom}
          </strong>
          , ses {seances.length} séance
          {seances.length > 1 ? 's' : ''} et sa synthèse vont dans la corbeille (page Mes clients). Vous pourrez la
          restaurer pendant 30 jours ; ensuite, tout est effacé définitivement (droit à l'effacement).
        </p>
      </Dialogue>
    </div>
  );
}

function Parcours({
  client,
  seances,
  ajouter,
  occupe,
}: {
  client: Client;
  seances: Seance[];
  ajouter: () => void;
  occupe: boolean;
}) {
  const etapes = Math.max(NUMERO_BILAN, seances.length);
  return (
    <ol className="parcours">
      {Array.from({ length: etapes }, (_, i) => {
        const numero = i + 1;
        const s = seances[i];
        const titre = numero === NUMERO_BILAN ? 'Bilan' : `Séance ${numero}`;
        const sous =
          numero > NUMERO_BILAN ? 'supplémentaire' : numero === NUMERO_BILAN ? `séance ${numero}` : 'initiale';
        const classes = `etape${s ? ' etape-faite' : ' etape-a-venir'}${numero === NUMERO_BILAN ? ' etape-bilan' : ''}`;
        return (
          <li key={numero} style={{ display: 'contents' }}>
            {s ? (
              <Link to={`/clients/${client.id}/seances/${s.id}`} className={classes}>
                <span className="etape-titre">{titre}</span>
                <span className="etape-date">
                  {sous} · {dateCourte(s.date_seance)}
                </span>
              </Link>
            ) : (
              <div className={classes}>
                <span className="etape-titre">{titre}</span>
                <span className="etape-date">{sous} · à venir</span>
              </div>
            )}
          </li>
        );
      })}
      {seances.length >= NUMERO_BILAN && (
        <li style={{ display: 'contents' }}>
          <button
            className="etape etape-a-venir"
            onClick={ajouter}
            disabled={occupe}
            style={{ cursor: 'pointer', font: 'inherit' }}
          >
            <span
              className="etape-titre"
              style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--accent)' }}
            >
              <Icone nom="plus" taille={16} /> Séance {seances.length + 1}
            </span>
            <span className="etape-date">supplémentaire</span>
          </button>
        </li>
      )}
    </ol>
  );
}

function DialogueIdentite({
  client,
  ouvert,
  fermer,
  enregistre,
}: {
  client: Client;
  ouvert: boolean;
  fermer: () => void;
  enregistre: () => void;
}) {
  const { parametres } = useReglages();
  const [nom, setNom] = useState(client.nom);
  const [prenom, setPrenom] = useState(client.prenom);
  const [annee, setAnnee] = useState(String(client.annee_naissance));
  const [email, setEmail] = useState(client.email ?? '');
  const [telephone, setTelephone] = useState(client.telephone ?? '');
  const [prix, setPrix] = useState(client.prix_seance === null ? '' : String(client.prix_seance));
  const [erreur, setErreur] = useState<string | null>(null);
  const notifier = useNotifier();

  async function valider(e: FormEvent) {
    e.preventDefault();
    const a = Number(annee);
    const p = prix.trim() === '' ? null : Number(prix.replace(',', '.'));
    if (!nom.trim() || !prenom.trim()) return setErreur('Le nom et le prénom sont obligatoires.');
    if (!Number.isInteger(a) || a < 1900 || a > new Date().getFullYear())
      return setErreur('Année de naissance invalide.');
    if (p !== null && !(p >= 0)) return setErreur('Tarif invalide.');
    try {
      await donnees.modifierClient(client.id, {
        nom: nom.trim(),
        prenom: prenom.trim(),
        annee_naissance: a,
        email: email.trim() || null,
        telephone: telephone.trim() || null,
        prix_seance: p,
      });
      notifier('Fiche mise à jour.');
      fermer();
      enregistre();
    } catch (err) {
      setErreur(messageErreur(err));
    }
  }

  return (
    <Dialogue
      ouvert={ouvert}
      fermer={fermer}
      titre="Modifier la fiche"
      pied={
        <>
          <button className="bouton" onClick={fermer}>
            Annuler
          </button>
          <button type="submit" form="form-identite" className="bouton bouton-principal">
            Enregistrer
          </button>
        </>
      }
    >
      <form id="form-identite" onSubmit={valider} style={{ display: 'grid', gap: 14 }} noValidate>
        <div className="grille-2">
          <div className="champ">
            <label htmlFor="id-nom">Nom</label>
            <input id="id-nom" value={nom} onChange={(e) => setNom(e.target.value)} />
          </div>
          <div className="champ">
            <label htmlFor="id-prenom">Prénom</label>
            <input id="id-prenom" value={prenom} onChange={(e) => setPrenom(e.target.value)} />
          </div>
        </div>
        <div className="champ">
          <label htmlFor="id-annee">Année de naissance</label>
          <input
            id="id-annee"
            type="number"
            inputMode="numeric"
            value={annee}
            onChange={(e) => setAnnee(e.target.value)}
          />
        </div>
        <div className="grille-2">
          <div className="champ">
            <label htmlFor="id-email">E-mail</label>
            <input
              id="id-email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="champ">
            <label htmlFor="id-tel">Téléphone</label>
            <input
              id="id-tel"
              type="tel"
              autoComplete="off"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
            />
          </div>
        </div>
        <span className="indication" style={{ marginTop: -8 }}>
          Facultatifs : ils servent à préparer les relances et le questionnaire de suivi.
        </span>
        {parametres.tarifs_actifs && (
          <div className="champ" style={{ maxWidth: 260 }}>
            <label htmlFor="id-prix">Tarif d'une séance pour ce client</label>
            <div className="champ-unite">
              <input
                id="id-prix"
                inputMode="decimal"
                placeholder={parametres.prix_defaut === null ? 'non défini' : `${parametres.prix_defaut} (défaut)`}
                value={prix}
                onChange={(e) => setPrix(e.target.value.replace(/[^\d.,]/g, ''))}
              />
              <span>€</span>
            </div>
            <span className="indication">Vide : le tarif par défaut s'applique.</span>
          </div>
        )}
        {erreur && <Erreur message={erreur} />}
      </form>
    </Dialogue>
  );
}
