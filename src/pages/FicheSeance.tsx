// Fiche de séance : la fiche papier numérisée (voir FeuilleSeance),
// suivie de l'assistant IA (catégorisation et synthèse évolutive).

import { useEffect, useRef, useState } from 'react';
import { Link, useBlocker, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Chargement, Dialogue, Erreur, useNotifier } from '../composants/Commun';
import { ExercicesRendus } from '../composants/ExercicesRendus';
import { FeuilleSeance } from '../composants/FeuilleSeance';
import { Icone } from '../composants/Icone';
import { PROBLEMATIQUES, trierCases } from '../config/referentiels';
import { donnees } from '../donnees';
import { cleGeminiDemo } from '../donnees/cleDemo';
import { useReglages } from '../etat/reglages';
import { dateHeure, LIBELLE_TYPE, messageErreur, pourcentage } from '../domaine/format';
import type { AnalyseIA, Client, ClientProblematique, FicheSeance as Fiche, Seance, ZoneFiche } from '../domaine/types';
import { useChargement } from '../etat/useChargement';
import { ARGENT_VISIBLE, EXERCICES_VISIBLES } from '../config/fonctions';

/** Forme canonique de la fiche (pour détecter les modifications de façon fiable). */
function normaliser(f: Fiche): Fiche {
  return {
    date_seance: f.date_seance,
    lignee: f.lignee,
    objectif: f.objectif,
    tim: f.tim,
    notes: f.notes,
    cases: trierCases(f.cases).map(({ zone, position, emotion_id }) => ({ zone, position, emotion_id })),
    prix: f.prix === null || f.prix === undefined ? null : Number(f.prix),
  };
}

export function FicheSeance() {
  const { clientId = '', seanceId = '' } = useParams();
  const charge = useChargement(
    () =>
      Promise.all([
        donnees.lireClient(clientId),
        donnees.listerSeances(clientId),
        donnees.listerProblematiquesClient(clientId),
      ]),
    [clientId, seanceId],
  );

  if (charge.chargement && !charge.donnees) return <Chargement texte="Ouverture de la fiche…" />;
  if (charge.erreur) return <Erreur message={charge.erreur} reessayer={charge.recharger} />;
  const [client, seances, problematiques] = charge.donnees!;
  const seance = seances.find((s) => s.id === seanceId);
  if (!seance)
    return (
      <div className="page page-etroite">
        <Erreur message="Séance introuvable." />
        <Link to={`/clients/${clientId}`}>← Retour à la fiche client</Link>
      </div>
    );
  return (
    <Formulaire
      key={seance.id}
      client={client}
      seance={seance}
      estDerniere={seance.numero === seances.length}
      precedente={seances.find((s) => s.numero === seance.numero - 1)?.date_seance ?? null}
      problematiquesInitiales={problematiques}
    />
  );
}

function Formulaire({
  client,
  seance,
  estDerniere,
  precedente,
  problematiquesInitiales,
}: {
  client: Client;
  seance: Seance;
  estDerniere: boolean;
  /** Date de la séance précédente, pour les exercices rendus entre-temps. */
  precedente: string | null;
  problematiquesInitiales: ClientProblematique[];
}) {
  const naviguer = useNavigate();
  const notifier = useNotifier();
  const { hash } = useLocation();

  const [fiche, setFiche] = useState<Fiche>(() => normaliser(seance));
  const [reference, setReference] = useState(() => JSON.stringify(normaliser(seance)));
  const modifie = JSON.stringify(fiche) !== reference;
  const [enregistrement, setEnregistrement] = useState(false);
  const [analyse, setAnalyse] = useState<AnalyseIA | null>(seance.analyse_ia);
  const [analyseLe, setAnalyseLe] = useState(seance.analyse_ia_le);
  const [analyseEnCours, setAnalyseEnCours] = useState(false);
  const [erreurIA, setErreurIA] = useState<string | null>(null);
  const [problematiques, setProblematiques] = useState(problematiquesInitiales);
  const [suppression, setSuppression] = useState(false);
  const [prixTexte, setPrixTexte] = useState(seance.prix === null ? '' : String(seance.prix).replace('.', ','));
  const { parametres } = useReglages();
  const sortieAutorisee = useRef(false);

  const maj = <K extends keyof Fiche>(cle: K, valeur: Fiche[K]) => setFiche((f) => ({ ...f, [cle]: valeur }));
  const valeurCase = (zone: ZoneFiche, position: number) =>
    fiche.cases.find((c) => c.zone === zone && c.position === position)?.emotion_id ?? null;
  const definirCase = (zone: ZoneFiche, position: number, emotion_id: number | null) =>
    setFiche((f) =>
      normaliser({
        ...f,
        cases: [
          ...f.cases.filter((c) => !(c.zone === zone && c.position === position)),
          ...(emotion_id !== null ? [{ zone, position, emotion_id }] : []),
        ],
      }),
    );

  // --- enregistrement ------------------------------------------------
  const [autoEnregistreeA, setAutoEnregistreeA] = useState<string | null>(null);
  const [echecAuto, setEchecAuto] = useState(false);
  const enCours = useRef(false);

  /** `silencieux` : enregistrement automatique (ni message de confirmation, ni message d'erreur répété). */
  async function enregistrer(silencieux = false): Promise<boolean> {
    if (!fiche.date_seance) {
      if (!silencieux) notifier('La date de séance est obligatoire.', true);
      return false;
    }
    if (enCours.current) return false;
    enCours.current = true;
    setEnregistrement(true);
    const instantane = fiche; // la saisie peut continuer pendant l'envoi
    try {
      await donnees.enregistrerSeance(seance.id, instantane);
      setReference(JSON.stringify(instantane));
      setEchecAuto(false);
      if (silencieux)
        setAutoEnregistreeA(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
      else notifier('Séance enregistrée.');
      return true;
    } catch (e) {
      if (silencieux) setEchecAuto(true);
      else notifier(messageErreur(e), true);
      return false;
    } finally {
      enCours.current = false;
      setEnregistrement(false);
    }
  }
  const enregistrerRef = useRef(enregistrer);
  enregistrerRef.current = enregistrer;

  // Enregistrement automatique 3 s après la dernière saisie, et dès que
  // l'application passe en arrière-plan (tablette, changement d'onglet) :
  // une déconnexion pour inactivité ne fait plus perdre de notes.
  useEffect(() => {
    if (!modifie) return;
    const minuterie = setTimeout(() => void enregistrerRef.current(true), 3_000);
    return () => clearTimeout(minuterie);
  }, [fiche, modifie]);
  useEffect(() => {
    const h = () => {
      if (document.visibilityState === 'hidden') void enregistrerRef.current(true);
    };
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, []);

  // Ctrl/Cmd + S
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void enregistrerRef.current();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  // Garde-fous contre la perte de saisie
  useEffect(() => {
    if (!modifie) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [modifie]);
  const blocage = useBlocker(
    ({ currentLocation, nextLocation }) =>
      modifie && !sortieAutorisee.current && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (hash === '#ia') document.getElementById('ia')?.scrollIntoView({ block: 'start' });
  }, [hash]);

  // --- IA --------------------------------------------------------------
  const montrerIA = () => document.getElementById('ia')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  async function analyser() {
    if (!fiche.notes.trim() && !fiche.objectif.trim()) {
      setErreurIA("Rédigez d'abord vos notes de séance : l'analyse s'appuie sur elles.");
      montrerIA();
      return;
    }
    if (modifie && !(await enregistrer())) return;
    setAnalyseEnCours(true);
    setErreurIA(null);
    try {
      const r = await donnees.analyserSeance(seance.id);
      setAnalyse(r);
      setAnalyseLe(new Date().toISOString());
      notifier('Analyse terminée, synthèse du client mise à jour.');
      montrerIA();
    } catch (e) {
      setErreurIA(messageErreur(e));
      montrerIA();
    } finally {
      setAnalyseEnCours(false);
    }
  }

  async function retenir(code: string) {
    const p = PROBLEMATIQUES.find((x) => x.code === code);
    if (!p) return;
    try {
      await donnees.ajouterProblematique(client.id, p.id, 'ia');
      setProblematiques(await donnees.listerProblematiquesClient(client.id));
      notifier(`« ${p.libelle} » ajoutée à la fiche client.`);
    } catch (e) {
      notifier(messageErreur(e), true);
    }
  }

  async function supprimer() {
    try {
      await donnees.supprimerSeance(seance.id);
      sortieAutorisee.current = true;
      notifier(`Séance ${seance.numero} supprimée.`);
      naviguer(`/clients/${client.id}`);
    } catch (e) {
      notifier(messageErreur(e), true);
      setSuppression(false);
    }
  }

  const moteurIA =
    donnees.mode === 'supabase' ? 'Gemini' : cleGeminiDemo.lire() ? 'Gemini (clé de démo)' : 'Simulation locale';

  return (
    <div className="page">
      <div className="barre-actions">
        <div style={{ display: 'grid', gap: 4 }}>
          <nav className="fil" aria-label="Fil d'Ariane">
            <Link to="/clients">Mes clients</Link>
            <Icone nom="chevron" taille={14} />
            <Link to={`/clients/${client.id}`}>
              {client.prenom} {client.nom}
            </Link>
          </nav>
          <div className="titre-seance">
            <h1 style={{ fontSize: '1.3rem' }}>Séance {seance.numero}</h1>
            <span className={`puce${seance.type === 'bilan' ? '' : ' puce-neutre'}`}>{LIBELLE_TYPE[seance.type]}</span>
            <span className={`etat-enregistrement${modifie ? ' modifie' : ''}`} aria-live="polite">
              {enregistrement
                ? 'Enregistrement…'
                : echecAuto && modifie
                  ? '● Enregistrement automatique impossible : cliquez sur Enregistrer'
                  : modifie
                    ? '● Modifications en cours'
                    : autoEnregistreeA
                      ? `Enregistrée automatiquement à ${autoEnregistreeA}`
                      : 'Enregistrée'}
            </span>
          </div>
        </div>
        <div className="actions">
          {ARGENT_VISIBLE && parametres.tarifs_actifs && (
            <label className="tarif-seance" title="Tarif de cette séance (facultatif)">
              <span>Tarif</span>
              <input
                inputMode="decimal"
                value={prixTexte}
                placeholder="—"
                aria-label="Tarif de la séance en euros"
                onChange={(e) => {
                  const v = e.target.value.replace(/[^\d.,]/g, '');
                  setPrixTexte(v);
                  const n = Number(v.replace(',', '.'));
                  maj('prix', v === '' || Number.isNaN(n) ? null : n);
                }}
              />
              <span>€</span>
            </label>
          )}
          {estDerniere && (
            <button
              className="bouton bouton-danger bouton-icone"
              onClick={() => setSuppression(true)}
              aria-label="Supprimer la séance"
              title="Supprimer la séance"
            >
              <Icone nom="corbeille" taille={16} />
            </button>
          )}
          <button className="bouton bouton-doux" onClick={analyser} disabled={analyseEnCours}>
            <Icone nom="etincelles" taille={16} /> {analyseEnCours ? 'Analyse…' : "Analyser avec l'IA"}
          </button>
          <button
            className="bouton bouton-principal"
            onClick={() => enregistrer()}
            disabled={!modifie || enregistrement}
            aria-keyshortcuts="Control+S"
          >
            <Icone nom="enregistrer" taille={16} /> Enregistrer
          </button>
        </div>
      </div>

      {EXERCICES_VISIBLES && (
        <ExercicesRendus clientId={client.id} depuis={precedente} jusqua={estDerniere ? null : seance.date_seance} />
      )}

      <FeuilleSeance
        client={client}
        seance={seance}
        fiche={fiche}
        maj={maj}
        valeurCase={valeurCase}
        definirCase={definirCase}
      />

      {/* Assistant IA ------------------------------------------------ */}
      <section className="carte panneau-ia" id="ia" aria-labelledby="t-ia" style={{ scrollMarginTop: 90 }}>
        <div className="carte-entete">
          <div>
            <h2 id="t-ia" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Icone nom="etincelles" /> Assistant IA
            </h2>
            <p className="aide">
              Catégorise la problématique et met à jour la synthèse évolutive du client à partir de cette fiche. Le nom
              et le prénom sont retirés du texte avant l'envoi.
            </p>
          </div>
          <span className="puce puce-ia">{moteurIA}</span>
        </div>
        <div className="carte-corps ia-grille">
          <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
            <button className="bouton bouton-principal" onClick={analyser} disabled={analyseEnCours}>
              <Icone nom="etincelles" taille={16} />
              {analyseEnCours ? 'Analyse en cours…' : analyse ? "Relancer l'analyse" : 'Analyser la séance'}
            </button>
            {erreurIA && <Erreur message={erreurIA} />}
            {analyse && (
              <p className="meta">
                Analyse du {dateHeure(analyseLe)} · {analyse.modele}
              </p>
            )}
            <p className="meta" style={{ display: 'flex', gap: 6 }}>
              <Icone nom="info" taille={14} /> Suggestions à valider : l'IA ne pose aucun diagnostic.
            </p>
          </div>

          {analyse ? (
            <div className="ia-resultats">
              <div>
                <h3>Problématiques suggérées</h3>
                {analyse.problematiques.length === 0 && <p className="meta">Aucune catégorie proposée.</p>}
                {analyse.problematiques.map((s) => {
                  const p = PROBLEMATIQUES.find((x) => x.code === s.code);
                  const retenue = problematiques.some((x) => x.problematique_id === p?.id);
                  return (
                    <div className="suggestion" key={s.code}>
                      <div className="suggestion-tete">
                        <strong style={{ fontSize: '0.9rem' }}>{p?.libelle ?? s.code}</strong>
                        {retenue ? (
                          <span className="puce puce-succes">
                            <Icone nom="valider" taille={12} /> Retenue
                          </span>
                        ) : (
                          <button className="bouton bouton-petit" onClick={() => retenir(s.code)}>
                            Retenir
                          </button>
                        )}
                      </div>
                      <div className="confiance">
                        <span className="mini-piste" aria-hidden>
                          <span style={{ width: `${s.confiance * 100}%` }} />
                        </span>
                        confiance {pourcentage(s.confiance)}
                      </div>
                      <p>{s.justification}</p>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
                {analyse.emotions_reperees.length > 0 && (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <h3>Émotions repérées</h3>
                    <div className="puces">
                      {analyse.emotions_reperees.map((e) => (
                        <span key={e} className="puce">
                          {e}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {analyse.points_attention.length > 0 && (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <h3>Points d'attention</h3>
                    <ul className="liste-points">
                      {analyse.points_attention.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <details>
                  <summary style={{ cursor: 'pointer', fontWeight: 650, fontSize: '0.9rem' }}>
                    Synthèse évolutive produite
                  </summary>
                  <p className="synthese" style={{ marginTop: 8 }}>
                    {analyse.synthese}
                  </p>
                </details>
              </div>
            </div>
          ) : (
            <p className="meta" style={{ alignSelf: 'center' }}>
              Pas encore d'analyse pour cette séance.
            </p>
          )}
        </div>
      </section>

      <Dialogue
        ouvert={blocage.state === 'blocked'}
        fermer={() => blocage.reset?.()}
        titre="Modifications non enregistrées"
        pied={
          <>
            <button className="bouton" onClick={() => blocage.reset?.()}>
              Rester sur la fiche
            </button>
            <button className="bouton bouton-danger" onClick={() => blocage.proceed?.()}>
              Quitter sans enregistrer
            </button>
            <button
              className="bouton bouton-principal"
              onClick={async () => ((await enregistrer()) ? blocage.proceed?.() : blocage.reset?.())}
            >
              Enregistrer et quitter
            </button>
          </>
        }
      >
        <p>Cette fiche de séance contient des modifications qui n'ont pas été enregistrées.</p>
      </Dialogue>

      <Dialogue
        ouvert={suppression}
        fermer={() => setSuppression(false)}
        titre={`Supprimer la séance ${seance.numero} ?`}
        pied={
          <>
            <button className="bouton" onClick={() => setSuppression(false)}>
              Annuler
            </button>
            <button
              className="bouton bouton-principal"
              style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
              onClick={supprimer}
            >
              Supprimer
            </button>
          </>
        }
      >
        <p>La fiche de cette séance (toutes les cases, objectif, T.I.M., notes) sera définitivement effacée.</p>
      </Dialogue>
    </div>
  );
}
