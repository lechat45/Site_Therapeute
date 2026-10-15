// Onglet « Tâches » : ce que l'application propose de faire aujourd'hui.
// Les tâches sont calculées (domaine/taches.ts, via etat/tachesContexte.tsx) ;
// cette page assemble le récapitulatif de la semaine, la journée, les filtres,
// les cartes (composants/CartesTaches.tsx), « Mes tâches » et l'historique des
// envois, et branche les actions (envoyer, reporter, clôturer…).

import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { MODELE_LECTURE_LOCALE } from '../../supabase/functions/_shared/questionnaire.ts';
import { ListeJour } from '../composants/Agenda';
import { Chargement, Erreur, useNotifier } from '../composants/Commun';
import { DialogueEnvoi } from '../composants/DialogueEnvoi';
import { DialogueRappel } from '../composants/DialogueRappel';
import { DialogueRappelExercice } from '../composants/DialogueRappelExercice';
import { DialogueRendezVous } from '../composants/DialogueRendezVous';
import { Icone, type NomIcone } from '../composants/Icone';
import { RecapSemaine } from '../composants/RecapSemaine';
import { DialogueReponsesExercice } from '../composants/ReponsesExercice';
import { StatutEnvoi } from '../composants/StatutEnvoi';
import { couleursAgenda } from '../config/agenda';
import { donnees } from '../donnees';
import { decalerJour, heureLisible, jourDe } from '../domaine/agenda';
import { dateCourte, dateDuJour, jourLisible, messageErreur } from '../domaine/format';
import {
  echeanceSuivante,
  familleTache,
  resumeDuJour,
  titreTache,
  type FamilleTache,
  type Tache,
} from '../domaine/taches';
import type { CanalEnvoi, ClientResume, Envoi, RendezVous, StatutRdv, TachePerso } from '../domaine/types';
import { useReglages } from '../etat/reglages';
import { useTaches } from '../etat/tachesContexte';
import {
  CartePerso,
  CarteExercice,
  CarteRappelExercice,
  CarteRendezVous,
  CarteTache,
  ListeReportees,
  PlusTard,
  type TacheExercice,
  type TacheRappelExercice,
  type TacheRdv,
} from '../composants/CartesTaches';
import { DialogueLecture } from '../composants/LectureQuestionnaire';
import { MesTaches } from '../composants/MesTaches';

type Filtre = 'tout' | FamilleTache | 'reportees';

/** Lignes d'historique affichées avant « Tout afficher ». */
const HISTORIQUE_COURT = 30;

const FILTRES: { cle: Filtre; libelle: string; icone: NomIcone }[] = [
  { cle: 'tout', libelle: 'Tout', icone: 'taches' },
  { cle: 'questionnaires', libelle: 'Questionnaires', icone: 'questionnaire' },
  { cle: 'exercices', libelle: 'Exercices', icone: 'document' },
  { cle: 'relances', libelle: 'Relances', icone: 'envoyer' },
  { cle: 'agenda', libelle: 'Rendez-vous', icone: 'calendrier' },
  { cle: 'perso', libelle: 'Mes tâches', icone: 'crayon' },
  { cle: 'reportees', libelle: 'Reportées', icone: 'horloge' },
];
const estFiltre = (x: string | null): x is Filtre => FILTRES.some((f) => f.cle === x);

export function Taches() {
  const { taches, reportees, tachesPerso, clients, envois, rendezVous, aujourdhui, chargement, erreur, recharger } =
    useTaches();
  const { parametres } = useReglages();
  const couleurs = couleursAgenda(parametres);
  const notifier = useNotifier();
  const naviguer = useNavigate();
  const [recherche, setRecherche] = useSearchParams();
  const demande = recherche.get('filtre');
  const filtre: Filtre = estFiltre(demande) ? demande : 'tout';
  const [envoi, setEnvoi] = useState<{ client: ClientResume; canal: CanalEnvoi } | null>(null);
  const [rappel, setRappel] = useState<{ tache: TacheRdv; canal: CanalEnvoi } | null>(null);
  const [rdvOuvert, setRdvOuvert] = useState<RendezVous | null>(null);
  const [lecture, setLecture] = useState<Envoi | null>(null);
  const [toutHistorique, setToutHistorique] = useState(false);
  const [lectureIAEnCours, setLectureIAEnCours] = useState<string | null>(null);
  const [exercice, setExercice] = useState<TacheExercice | null>(null);
  const [rappelExercice, setRappelExercice] = useState<TacheRappelExercice | null>(null);

  const jour = dateDuJour();
  const parId = new Map(clients.map((c) => [c.id, c]));
  const historique = envois.filter((e) => e.envoye_le);
  const visibles = toutHistorique ? historique : historique.slice(0, HISTORIQUE_COURT);
  const compte = (f: Filtre) =>
    f === 'tout'
      ? taches.length
      : f === 'reportees'
        ? reportees.length
        : taches.filter((t) => familleTache(t) === f).length;
  const affichees = filtre === 'tout' ? taches : taches.filter((t) => familleTache(t) === filtre);

  function choisirFiltre(f: Filtre) {
    setRecherche(
      (r) => {
        if (f === 'tout') r.delete('filtre');
        else r.set('filtre', f);
        return r;
      },
      { replace: true },
    );
  }

  async function agir(action: () => Promise<unknown>, message: string) {
    try {
      await action();
      notifier(message);
      recharger();
    } catch (e) {
      notifier(messageErreur(e), true);
    }
  }
  /** Une tâche personnelle change d'échéance ; les autres sont masquées jusqu'à la date. */
  function plusTard(t: Tache, jours: number) {
    const jusqua = decalerJour(jour, jours);
    const quand = jours === 1 ? 'demain' : jourLisible(jusqua);
    void agir(
      () =>
        t.type === 'perso'
          ? donnees.enregistrerTachePerso(t.tache.id, { echeance: jusqua })
          : donnees.reporterTache(t.cle, jusqua),
      `« ${titreTache(t)} » reviendra ${quand}.`,
    );
  }
  const retablir = (t: Tache) =>
    agir(() => donnees.reporterTache(t.cle, null), `« ${titreTache(t)} » est de retour dans la liste.`);
  const arreter = (c: ClientResume) =>
    agir(
      () => donnees.modifierClient(c.id, { relances_actives: false }),
      `Plus de relance pour ${c.prenom} ${c.nom} (réactivable sur sa fiche).`,
    );
  const noterAccord = (c: ClientResume) =>
    agir(
      () => donnees.modifierClient(c.id, { accord_relance_le: dateDuJour() }),
      `Accord de ${c.prenom} ${c.nom} noté à la date du jour.`,
    );
  function cocher(x: TachePerso, faite: boolean) {
    const suivante = faite ? echeanceSuivante(x.echeance, x.recurrence, jour) : null;
    void agir(
      () => donnees.enregistrerTachePerso(x.id, { faite_le: faite ? new Date().toISOString() : null }),
      !faite
        ? `« ${x.titre} » est de nouveau à faire.`
        : suivante
          ? `« ${x.titre} » : c'est fait. Prochaine fois : ${jourLisible(suivante)}.`
          : `« ${x.titre} » : c'est fait.`,
    );
  }
  const supprimer = (x: TachePerso) => agir(() => donnees.supprimerTachePerso(x.id), `« ${x.titre} » supprimée.`);

  /** Rendez-vous passé : séance faite (fiche datée du jour du rendez-vous), absent ou annulé. */
  async function cloturer(t: TacheRdv, statut: StatutRdv) {
    try {
      if (statut === 'honore') {
        const s = await donnees.creerSeance(t.client.id, jourDe(t.rdv.debut));
        await donnees.modifierRendezVous(t.rdv.id, { seance_id: s.id, statut: 'honore' });
        naviguer(`/clients/${t.client.id}/seances/${s.id}`);
        return;
      }
      await donnees.modifierRendezVous(t.rdv.id, { statut });
      notifier(statut === 'absent' ? `Absence de ${t.client.prenom} notée.` : 'Rendez-vous noté comme annulé.');
      recharger();
    } catch (e) {
      notifier(messageErreur(e), true);
    }
  }
  async function vu(e: Envoi) {
    await donnees.marquerConsulte(e.id).catch(() => {});
    recharger();
  }
  /** Gemini n'est appelé qu'ici, à la demande ; sinon la lecture locale reste affichée. */
  async function lireAvecIA(e: Envoi) {
    setLectureIAEnCours(e.id);
    try {
      const r = await donnees.lireQuestionnaireIA(e.id);
      if (r.modele === MODELE_LECTURE_LOCALE)
        notifier(
          "Gemini n'est pas disponible (pas de clé, quota du jour atteint ou panne) : la lecture locale reste affichée.",
        );
      else notifier('Lecture IA ajoutée.');
      recharger();
    } catch (err) {
      notifier(messageErreur(err), true);
    } finally {
      setLectureIAEnCours(null);
    }
  }

  function carte(t: Tache) {
    const report = <PlusTard titre={titreTache(t)} reporter={(n) => plusTard(t, n)} />;
    if (t.type === 'perso')
      return (
        <CartePerso
          key={t.cle}
          tache={t}
          cocher={() => cocher(t.tache, true)}
          supprimer={() => supprimer(t.tache)}
          plusTard={report}
        />
      );
    if (t.type === 'exercice')
      return (
        <CarteExercice
          key={t.cle}
          tache={t}
          voir={() => setExercice(t)}
          ouvrirFiche={() => naviguer(`/clients/${t.client.id}`)}
          plusTard={report}
        />
      );
    if (t.type === 'rappel_exercice')
      return (
        <CarteRappelExercice
          key={t.cle}
          tache={t}
          rappeler={() => setRappelExercice(t)}
          ouvrirFiche={() => naviguer(`/clients/${t.client.id}`)}
          plusTard={report}
        />
      );
    if (t.type === 'rappel' || t.type === 'cloture')
      return (
        <CarteRendezVous
          key={t.cle}
          tache={t}
          couleur={couleurs[t.rdv.categorie]}
          rappeler={(canal) => setRappel({ tache: t, canal })}
          cloturer={(statut) => cloturer(t, statut)}
          ouvrir={() => setRdvOuvert(t.rdv)}
          plusTard={report}
        />
      );
    return (
      <CarteTache
        key={t.cle}
        tache={t}
        iaProposee={parametres.ia_taches}
        iaEnCours={t.type === 'questionnaire' && lectureIAEnCours === t.envoi.id}
        preparer={(canal) => setEnvoi({ client: t.client, canal })}
        arreter={() => arreter(t.client)}
        noterAccord={() => noterAccord(t.client)}
        voir={() => {
          if (t.type !== 'questionnaire') return;
          setLecture(t.envoi);
          void vu(t.envoi);
        }}
        lireAvecIA={() => t.type === 'questionnaire' && lireAvecIA(t.envoi)}
        ouvrirFiche={() => naviguer(`/clients/${t.client.id}`)}
        plusTard={report}
      />
    );
  }

  return (
    <div className="page page-etroite">
      <div className="entete-page">
        <div>
          <h1>Tâches</h1>
          <p className="sous-titre">
            Ce que l'application vous propose aujourd'hui. Rien ne part tout seul : chaque message est préparé, vous
            l'envoyez depuis votre messagerie.
          </p>
        </div>
        <Link to="/parametres?onglet=relances" className="bouton">
          <Icone nom="reglages" taille={16} /> Régler les relances
        </Link>
      </div>

      {!parametres.relances_actives && (
        <div className="alerte">
          <Icone nom="info" />
          <span>
            Les relances automatiques sont désactivées : seuls les questionnaires reçus apparaissent ici.{' '}
            <Link to="/parametres?onglet=relances">Les réactiver</Link>
          </span>
        </div>
      )}

      <RecapSemaine />

      <section className="carte" aria-labelledby="t-journee">
        <div className="carte-entete">
          <div>
            <h2 id="t-journee" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Icone nom="calendrier" /> Aujourd’hui
            </h2>
            <p className="aide">
              {aujourdhui.length
                ? `${aujourdhui.length} rendez-vous, de ${heureLisible(aujourdhui[0].debut)} à ${heureLisible(aujourdhui[aujourdhui.length - 1].fin)}.`
                : 'Aucun rendez-vous prévu aujourd’hui.'}
            </p>
          </div>
          <Link to="/emploi-du-temps" className="bouton bouton-petit">
            Emploi du temps →
          </Link>
        </div>
        {aujourdhui.length > 0 && (
          <div className="carte-corps" style={{ paddingTop: 4 }}>
            <ListeJour
              rdv={rendezVous.filter((r) => jourDe(r.debut) === jour)}
              clients={parId}
              couleurs={couleurs}
              ouvrir={setRdvOuvert}
            />
          </div>
        )}
      </section>

      <section aria-labelledby="t-afaire" style={{ display: 'grid', gap: 12 }}>
        <div>
          <h2 id="t-afaire">
            À faire <span className="puce puce-neutre">{taches.length}</span>
          </h2>
          {taches.length > 0 && <p className="meta">{resumeDuJour(taches)}</p>}
        </div>
        <div className="segments filtres-taches" role="group" aria-label="Afficher">
          {FILTRES.map((f) => (
            <button
              key={f.cle}
              type="button"
              className="segment"
              aria-pressed={filtre === f.cle}
              onClick={() => choisirFiltre(f.cle)}
            >
              <Icone nom={f.icone} taille={14} /> {f.libelle} <span className="compteur">{compte(f.cle)}</span>
            </button>
          ))}
        </div>
        {chargement && !clients.length ? (
          <Chargement />
        ) : erreur ? (
          <Erreur message={erreur} reessayer={recharger} />
        ) : filtre === 'reportees' ? (
          <ListeReportees reportees={reportees} retablir={retablir} />
        ) : affichees.length === 0 ? (
          <div className="carte vide">
            <Icone nom="valider" taille={28} />
            <p>{filtre === 'tout' ? "Rien à faire pour l'instant." : 'Rien dans cette catégorie pour l’instant.'}</p>
          </div>
        ) : (
          affichees.map(carte)
        )}
      </section>

      <MesTaches
        taches={tachesPerso}
        clients={clients}
        aujourdhui={jour}
        cocher={cocher}
        supprimer={supprimer}
        ajoutee={recharger}
      />

      {rappelExercice && (
        <DialogueRappelExercice
          remise={rappelExercice.remise}
          client={rappelExercice.client}
          fermer={(cree) => {
            setRappelExercice(null);
            if (cree) recharger();
          }}
        />
      )}
      {exercice && (
        <DialogueReponsesExercice
          remise={exercice.remise}
          client={exercice.client}
          fermer={(lues) => {
            setExercice(null);
            if (lues) recharger();
          }}
        />
      )}
      {rappel && (
        <DialogueRappel
          rdv={rappel.tache.rdv}
          client={rappel.tache.client}
          canal={rappel.canal}
          fermer={(envoye) => {
            setRappel(null);
            if (envoye) recharger();
          }}
        />
      )}
      {rdvOuvert && (
        <DialogueRendezVous
          rdv={rdvOuvert}
          clients={clients}
          existants={rendezVous}
          fermer={(modifie) => {
            setRdvOuvert(null);
            if (modifie) recharger();
          }}
        />
      )}

      <section className="carte" aria-labelledby="t-historique">
        <div className="carte-entete">
          <div>
            <h2 id="t-historique">Historique des envois</h2>
            <p className="aide">Les messages que vous avez confirmés, tels qu'envoyés (lien personnel masqué).</p>
          </div>
        </div>
        <div className="carte-corps" style={{ paddingTop: 8 }}>
          {historique.length === 0 ? (
            <p className="meta">Aucun envoi pour l'instant.</p>
          ) : (
            <div className="tableau-conteneur">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Client</th>
                    <th scope="col">Canal</th>
                    <th scope="col">Questionnaire</th>
                    <th scope="col">
                      <span className="visuellement-cache">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((e) => {
                    const c = parId.get(e.client_id);
                    return (
                      <tr key={e.id}>
                        <td>{dateCourte(e.envoye_le)}</td>
                        <td>
                          {c ? (
                            <Link to={`/clients/${c.id}`}>
                              {c.prenom} {c.nom}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          <span className="puce puce-neutre">
                            <Icone nom={e.canal === 'email' ? 'courriel' : 'sms'} taille={12} />
                            {e.canal === 'email' ? 'E-mail' : 'SMS'}
                          </span>
                        </td>
                        <td>
                          <StatutEnvoi envoi={e} />
                        </td>
                        <td className="num">
                          <button className="bouton bouton-petit" onClick={() => setLecture(e)}>
                            Voir
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {historique.length > HISTORIQUE_COURT && (
            <button className="bouton-lien" style={{ marginTop: 10 }} onClick={() => setToutHistorique((x) => !x)}>
              {toutHistorique ? 'Afficher moins' : `Tout afficher (${historique.length} envois)`}
            </button>
          )}
        </div>
      </section>

      {envoi && (
        <DialogueEnvoi
          client={envoi.client}
          canal={envoi.canal}
          fermer={(envoye) => {
            setEnvoi(null);
            if (envoye) recharger();
          }}
        />
      )}
      {lecture && (
        <DialogueLecture
          envoi={lecture}
          envois={envois}
          client={parId.get(lecture.client_id)}
          fermer={() => setLecture(null)}
        />
      )}
    </div>
  );
}
