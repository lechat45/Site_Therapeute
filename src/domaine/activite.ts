// Statistiques de l'emploi du temps (espace personnel uniquement) :
// heures de consultation par semaine, absences, annulations, répartition
// par type et par modalité, créneaux les plus demandés.

import { decalerJour, dureeMinutes, horodatage, jourDe, jourSemaine, lundiDe, minutesDe } from './agenda';
import type { CategorieRdv, ModaliteRdv, RendezVous } from './types';

export interface StatistiquesActivite {
  /** Une entrée par semaine, de la plus ancienne à la courante. */
  semaines: { lundi: string; heures: number }[];
  heuresConsultation: number;
  /** Rendez-vous avec un client, passés, non annulés (absences comprises). */
  nbRendezVous: number;
  nbAbsences: number;
  /** absences ÷ rendez-vous passés non annulés ; `null` sans rendez-vous. */
  tauxAbsence: number | null;
  nbAnnulations: number;
  /** annulations ÷ tous les rendez-vous avec client de la période. */
  tauxAnnulation: number | null;
  parCategorie: { categorie: CategorieRdv; nb: number; heures: number }[];
  parModalite: { modalite: ModaliteRdv; nb: number }[];
  /** Rendez-vous avec client non annulés, par jour (1 = lundi) et heure de début. */
  creneaux: { jour: number; heure: number; nb: number }[];
}

const arrondi = (x: number) => Math.round(x * 10) / 10;

export function statistiquesAgenda(rdv: RendezVous[], maintenant: Date, nbSemaines: number): StatistiquesActivite {
  const t = maintenant.getTime();
  const lundiCourant = lundiDe(jourDe(maintenant.toISOString()));
  const premierLundi = decalerJour(lundiCourant, -7 * (nbSemaines - 1));
  const [de, a] = [horodatage(premierLundi, '00:00'), horodatage(decalerJour(lundiCourant, 7), '00:00')];
  const periode = rdv.filter((r) => r.debut >= de && r.debut < a);
  const avecClient = periode.filter((r) => r.client_id);
  const passes = avecClient.filter((r) => Date.parse(r.fin) <= t && r.statut !== 'annule');
  // consultation : rendez-vous avec client tenus (ou pas encore complétés), passés
  const tenus = passes.filter((r) => r.statut !== 'absent');
  const heures = (liste: RendezVous[]) => arrondi(liste.reduce((s, r) => s + dureeMinutes(r), 0) / 60);

  const semaines = Array.from({ length: nbSemaines }, (_, i) => {
    const lundi = decalerJour(premierLundi, 7 * i);
    const [d, f] = [horodatage(lundi, '00:00'), horodatage(decalerJour(lundi, 7), '00:00')];
    return { lundi, heures: heures(tenus.filter((r) => r.debut >= d && r.debut < f)) };
  });

  const nbAbsences = passes.filter((r) => r.statut === 'absent').length;
  const nbAnnulations = avecClient.filter((r) => r.statut === 'annule').length;
  const nonAnnules = periode.filter((r) => r.statut !== 'annule' && Date.parse(r.fin) <= t);

  const categories: CategorieRdv[] = ['premier', 'seance', 'bilan', 'administratif', 'personnel'];
  const modalites: ModaliteRdv[] = ['cabinet', 'visio', 'telephone', 'domicile'];
  const comptes = new Map<string, number>();
  for (const r of avecClient.filter((x) => x.statut !== 'annule')) {
    const cle = `${jourSemaine(jourDe(r.debut))}:${Math.floor(minutesDe(r.debut) / 60)}`;
    comptes.set(cle, (comptes.get(cle) ?? 0) + 1);
  }

  return {
    semaines,
    heuresConsultation: heures(tenus),
    nbRendezVous: passes.length,
    nbAbsences,
    tauxAbsence: passes.length ? nbAbsences / passes.length : null,
    nbAnnulations,
    tauxAnnulation: avecClient.length ? nbAnnulations / avecClient.length : null,
    parCategorie: categories.map((categorie) => {
      const liste = nonAnnules.filter((r) => r.categorie === categorie);
      return { categorie, nb: liste.length, heures: heures(liste) };
    }),
    parModalite: modalites.map((modalite) => ({
      modalite,
      nb: passes.filter((r) => r.modalite === modalite).length,
    })),
    creneaux: [...comptes].map(([cle, nb]) => {
      const [jour, heure] = cle.split(':').map(Number);
      return { jour, heure, nb };
    }),
  };
}
