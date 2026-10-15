// Contexte des tâches (badge du menu, onglet Tâches, tableau de bord) :
// charge clients, envois, rendez-vous (J-14 → J+8), tâches personnelles,
// reports et documents remis, puis calcule les tâches (domaine/taches.ts).
// Rechargé à chaque changement de page ou par `recharger()`.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { donnees } from '../donnees';
import { decalerJour, horodatage, jourDe } from '../domaine/agenda';
import { dateDuJour, messageErreur } from '../domaine/format';
import { useReglages } from './reglages';
import { calculerTaches, recapSemaine, separerReportees, type RecapSemaine, type Tache } from '../domaine/taches';
import type { ClientResume, Envoi, Remise, RendezVous, ReportTache, TachePerso } from '../domaine/types';

interface Donnees {
  clients: ClientResume[];
  envois: Envoi[];
  /** Rendez-vous des 14 derniers jours et des 8 prochains (rappels, à compléter, journée, semaine). */
  rendezVous: RendezVous[];
  tachesPerso: TachePerso[];
  reports: ReportTache[];
  /** Documents remis (exercices complétés par les clients). */
  remises: Remise[];
}

interface ContexteTaches extends Donnees {
  /** Tâches à faire, hors tâches reportées (« plus tard »). */
  taches: Tache[];
  reportees: { tache: Tache; jusqua: string }[];
  /** Rendez-vous d'aujourd'hui, hors annulés. */
  aujourdhui: RendezVous[];
  semaine: RecapSemaine;
  chargement: boolean;
  erreur: string | null;
  recharger: () => void;
}

const Contexte = createContext<ContexteTaches | null>(null);

/** Tâches recalculées à chaque changement de page (badge du menu, onglet Tâches). */
export function FournisseurTaches({ children }: { children: ReactNode }) {
  const { parametres } = useReglages();
  const { pathname } = useLocation();
  const [etat, setEtat] = useState<Donnees & { chargement: boolean; erreur: string | null }>({
    clients: [],
    envois: [],
    rendezVous: [],
    tachesPerso: [],
    reports: [],
    remises: [],
    chargement: true,
    erreur: null,
  });
  const [jeton, setJeton] = useState(0);

  useEffect(() => {
    let actif = true;
    const jour = dateDuJour();
    Promise.all([
      donnees.listerClients(),
      donnees.listerEnvois(),
      donnees.listerRendezVous(horodatage(decalerJour(jour, -14), '00:00'), horodatage(decalerJour(jour, 8), '00:00')),
      donnees.tachesPerso(),
      donnees.reportsTaches(),
      donnees.listerRemises(),
    ]).then(
      ([clients, envois, rendezVous, tachesPerso, reports, remises]) =>
        actif &&
        setEtat({ clients, envois, rendezVous, tachesPerso, reports, remises, chargement: false, erreur: null }),
      (e) => actif && setEtat((x) => ({ ...x, chargement: false, erreur: messageErreur(e) })),
    );
    return () => {
      actif = false;
    };
  }, [pathname, jeton]);

  const recharger = useCallback(() => setJeton((j) => j + 1), []);
  const jour = dateDuJour();
  const toutes = calculerTaches(
    etat.clients,
    etat.envois,
    parametres,
    jour,
    etat.rendezVous,
    new Date().toISOString(),
    etat.tachesPerso,
    etat.remises,
  );
  const { actives, reportees } = separerReportees(toutes, etat.reports, jour);
  const aujourdhui = etat.rendezVous.filter((r) => jourDe(r.debut) === jour && r.statut !== 'annule');
  const semaine = recapSemaine(jour, etat.clients, etat.envois, etat.rendezVous, etat.tachesPerso, parametres);
  return (
    <Contexte.Provider value={{ ...etat, taches: actives, reportees, aujourdhui, semaine, recharger }}>
      {children}
    </Contexte.Provider>
  );
}

export function useTaches() {
  const c = useContext(Contexte);
  if (!c) throw new Error('useTaches hors de FournisseurTaches');
  return c;
}
