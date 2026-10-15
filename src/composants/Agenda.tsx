// Emploi du temps : grille de la semaine, vue du jour, légende.
//
// Lisible par tous, y compris les personnes daltoniennes : la couleur d'une
// catégorie n'est jamais seule. Chaque rendez-vous porte son pictogramme et
// son libellé ; les créneaux personnels sont hachurés ; un rendez-vous
// annulé est barré et en pointillés ; un absent porte un « ! » et le mot.

import type { CSSProperties, MouseEvent } from 'react';
import { categorie, MODALITES, STATUTS } from '../config/agenda';
import {
  conflits,
  disposer,
  dureeMinutes,
  heureDe,
  heureLisible,
  heuresAffichees,
  jourDe,
  minutesDe,
} from '../domaine/agenda';
import { dateDuJour } from '../domaine/format';
import type { CategorieRdv, ClientResume, RendezVous } from '../domaine/types';
import { Icone } from './Icone';

/** Hauteur d'une heure dans la grille (px). */
const HAUTEUR_HEURE = 56;

const formatJour = (jour: string, options: Intl.DateTimeFormatOptions) =>
  new Date(`${jour}T12:00:00`).toLocaleDateString('fr-FR', options);

/** Nom affiché d'un rendez-vous : le client, sinon l'intitulé. */
export function nomRendezVous(r: RendezVous, clients: Map<string, ClientResume>): string {
  const c = r.client_id ? clients.get(r.client_id) : undefined;
  if (c) return `${c.prenom} ${c.nom}`;
  return r.titre || categorie(r.categorie).libelle;
}

/** Phrase complète pour les lecteurs d'écran. */
export function descriptionRendezVous(r: RendezVous, clients: Map<string, ClientResume>): string {
  const jour = formatJour(jourDe(r.debut), { weekday: 'long', day: 'numeric', month: 'long' });
  return [
    `${jour}, de ${heureLisible(r.debut)} à ${heureLisible(r.fin)}`,
    categorie(r.categorie).libelle,
    nomRendezVous(r, clients),
    MODALITES[r.modalite].libelle.toLowerCase(),
    STATUTS[r.statut].libelle.toLowerCase(),
  ].join(', ');
}

const classesPave = (r: RendezVous) => ['pave', `pave-${r.categorie}`, `pave-${r.statut}`].join(' ');

/** Contenu d'un rendez-vous (grille et liste). */
function ContenuPave({
  r,
  clients,
  compact,
  detaille = false,
}: {
  r: RendezVous;
  clients: Map<string, ClientResume>;
  compact: boolean;
  /** Statut écrit en toutes lettres (listes) ; dans la grille, le pictogramme suffit (légende). */
  detaille?: boolean;
}) {
  const cat = categorie(r.categorie);
  const statut = STATUTS[r.statut];
  return (
    <>
      <span className="pave-tete">
        <Icone nom={cat.icone} taille={13} />
        <span className="pave-heure">{heureDe(r.debut)}</span>
        {statut.icone && r.statut !== 'prevu' && (
          <span className={`pave-statut statut-${r.statut}`}>
            <Icone nom={statut.icone} taille={11} />
            <span className={compact || !detaille ? 'visuellement-cache' : undefined}>{statut.libelle}</span>
          </span>
        )}
      </span>
      <span className="pave-nom">{nomRendezVous(r, clients)}</span>
      {!compact && (
        <span className="pave-meta">
          {cat.court}
          {r.modalite !== 'cabinet' && (
            <>
              {' · '}
              {r.modalite === 'visio' ? (
                <Icone nom="visio" taille={11} />
              ) : r.modalite === 'telephone' ? (
                <Icone nom="sms" taille={11} />
              ) : null}{' '}
              {MODALITES[r.modalite].libelle.replace(/^(Au|En|Par|À) /, '')}
            </>
          )}
        </span>
      )}
    </>
  );
}

const styleCouleur = (couleur: string) => ({ '--c': couleur }) as CSSProperties;

// ---------------------------------------------------------------------
export function GrilleSemaine({
  jours,
  rdv,
  clients,
  couleurs,
  heureDebut,
  heureFin,
  ouvrir,
  creer,
}: {
  jours: string[];
  rdv: RendezVous[];
  clients: Map<string, ClientResume>;
  couleurs: Record<CategorieRdv, string>;
  heureDebut: number;
  heureFin: number;
  ouvrir: (r: RendezVous) => void;
  /** Clic sur un créneau libre : jour et heure « HH:MM » (au quart d'heure). */
  creer: (jour: string, heure: string) => void;
}) {
  const aujourdhui = dateDuJour();
  const plage = heuresAffichees(heureDebut, heureFin, rdv);
  const heures = Array.from({ length: plage.fin - plage.debut }, (_, i) => plage.debut + i);
  const hauteur = heures.length * HAUTEUR_HEURE;
  const maintenant = new Date();
  const minutesMaintenant = maintenant.getHours() * 60 + maintenant.getMinutes();

  function clicCreneau(jour: string, e: MouseEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return; // clic sur un rendez-vous
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const minutes = plage.debut * 60 + Math.floor((y / HAUTEUR_HEURE) * 4) * 15;
    creer(jour, `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`);
  }

  return (
    <div
      className="agenda-grille"
      style={{ '--colonnes': jours.length } as CSSProperties}
      role="region"
      aria-label="Semaine"
    >
      <div className="agenda-coin" aria-hidden />
      {jours.map((j) => (
        <div key={j} className={`agenda-entete-jour${j === aujourdhui ? ' aujourdhui' : ''}`}>
          <span className="agenda-nom-jour">{formatJour(j, { weekday: 'short' })}</span>
          <span className="agenda-num-jour">{formatJour(j, { day: 'numeric' })}</span>
          {j === aujourdhui && <span className="visuellement-cache">(aujourd'hui)</span>}
        </div>
      ))}

      <div className="agenda-heures" style={{ height: hauteur }} aria-hidden>
        {heures.map((h) => (
          <span key={h} style={{ top: (h - plage.debut) * HAUTEUR_HEURE }}>
            {h} h
          </span>
        ))}
      </div>

      {jours.map((j) => {
        const duJour = rdv.filter((r) => jourDe(r.debut) === j);
        const place = disposer(duJour);
        return (
          <div
            key={j}
            className={`agenda-colonne${j === aujourdhui ? ' aujourdhui' : ''}`}
            style={{ height: hauteur, '--h-heure': `${HAUTEUR_HEURE}px` } as CSSProperties}
            onClick={(e) => clicCreneau(j, e)}
            role="group"
            aria-label={`${formatJour(j, { weekday: 'long', day: 'numeric', month: 'long' })} : ${duJour.length} rendez-vous`}
          >
            {j === aujourdhui && minutesMaintenant >= plage.debut * 60 && minutesMaintenant <= plage.fin * 60 && (
              <span
                className="agenda-maintenant"
                style={{ top: ((minutesMaintenant - plage.debut * 60) / 60) * HAUTEUR_HEURE }}
                aria-hidden
              />
            )}
            {duJour.map((r) => {
              const p = place.get(r.id) ?? { colonne: 0, colonnes: 1 };
              const haut = ((minutesDe(r.debut) - plage.debut * 60) / 60) * HAUTEUR_HEURE;
              const duree = Math.max(dureeMinutes(r), 20);
              const hauteurPave = Math.max((duree / 60) * HAUTEUR_HEURE - 2, 22);
              return (
                <button
                  key={r.id}
                  type="button"
                  className={classesPave(r)}
                  style={{
                    ...styleCouleur(couleurs[r.categorie]),
                    top: haut,
                    height: hauteurPave,
                    left: `calc(${(p.colonne * 100) / p.colonnes}% + 2px)`,
                    width: `calc(${100 / p.colonnes}% - 4px)`,
                  }}
                  onClick={() => ouvrir(r)}
                  aria-label={descriptionRendezVous(r, clients)}
                  title={descriptionRendezVous(r, clients)}
                >
                  <ContenuPave r={r} clients={clients} compact={hauteurPave < 44} />
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------
/** Vue d'une journée : liste chronologique (téléphone, ou au choix). */
export function ListeJour({
  rdv,
  clients,
  couleurs,
  ouvrir,
}: {
  rdv: RendezVous[];
  clients: Map<string, ClientResume>;
  couleurs: Record<CategorieRdv, string>;
  ouvrir: (r: RendezVous) => void;
}) {
  if (!rdv.length)
    return (
      <div className="vide">
        <Icone nom="calendrier" taille={28} />
        <p>Aucun rendez-vous ce jour-là.</p>
      </div>
    );
  return (
    <ol className="agenda-liste">
      {rdv.map((r) => {
        const chevauche = conflits(r, rdv).length > 0;
        return (
          <li key={r.id}>
            <span className="agenda-liste-heures">
              {heureDe(r.debut)}
              <small>{heureDe(r.fin)}</small>
            </span>
            <button
              type="button"
              className={`${classesPave(r)} pave-ligne`}
              style={styleCouleur(couleurs[r.categorie])}
              onClick={() => ouvrir(r)}
              aria-label={descriptionRendezVous(r, clients)}
            >
              <ContenuPave r={r} clients={clients} compact={false} detaille />
              {chevauche && r.statut !== 'annule' && (
                <span className="pave-conflit">
                  <Icone nom="info" taille={11} /> chevauche un autre rendez-vous
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------
/** Légende : couleur + pictogramme + libellé ; un clic masque ou affiche la catégorie. */
export function LegendeAgenda({
  couleurs,
  masquees,
  basculer,
}: {
  couleurs: Record<CategorieRdv, string>;
  masquees: Set<CategorieRdv>;
  basculer: (c: CategorieRdv) => void;
}) {
  return (
    <div className="agenda-legende" role="group" aria-label="Catégories affichées">
      {(['premier', 'seance', 'bilan', 'administratif', 'personnel'] as CategorieRdv[]).map((cle) => {
        const c = categorie(cle);
        const visible = !masquees.has(cle);
        return (
          <button
            key={cle}
            type="button"
            className={`legende-categorie pave-${cle}`}
            style={styleCouleur(couleurs[cle])}
            aria-pressed={visible}
            onClick={() => basculer(cle)}
            title={visible ? `Masquer : ${c.libelle}` : `Afficher : ${c.libelle}`}
          >
            <span className="legende-pastille" aria-hidden />
            <Icone nom={c.icone} taille={14} />
            {c.libelle}
            {!visible && <span className="meta"> (masqué)</span>}
          </button>
        );
      })}
      <span className="legende-statuts meta">
        <Icone nom="valider" taille={12} /> honoré · <Icone nom="info" taille={12} /> absent · <s>annulé</s>
      </span>
    </div>
  );
}
