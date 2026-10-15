// Graphiques sans dépendance : barres horizontales (une seule série,
// donc pas de légende : le titre de la carte dit ce qui est tracé),
// synthèse par tranche d'âge et carte thermique en vue tableau.

import type { CSSProperties } from 'react';
import { EMOTIONS } from '../config/referentiels';
import { pourcentage } from '../domaine/format';
import type { StatTranche } from '../domaine/types';
import { Icone } from './Icone';

export interface LigneBarre {
  cle: string | number;
  libelle: string;
  valeur: number | null; // null = case masquée (anonymat)
  texte: string;
  detail?: string;
  infobulle: string;
}

export function BarresHorizontales({ lignes, max, titre }: { lignes: LigneBarre[]; max: number; titre: string }) {
  const echelle = max > 0 ? max : 1;
  return (
    <ul className="barres" aria-label={titre}>
      {lignes.map((l) => (
        <li
          key={l.cle}
          className={`barre${l.valeur === null ? ' barre-masquee' : ''}`}
          tabIndex={0}
          aria-label={l.infobulle}
        >
          <span className="barre-libelle">{l.libelle}</span>
          <span className="barre-piste" aria-hidden>
            {l.valeur !== null && (
              <span className="barre-remplissage" style={{ width: `${(l.valeur / echelle) * 100}%` }} />
            )}
          </span>
          <span className="barre-valeur" aria-hidden>
            {l.valeur === null ? (
              <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontWeight: 500 }}>
                <Icone nom="cadenas" taille={13} /> masqué
              </span>
            ) : (
              l.texte
            )}
            {l.detail && l.valeur !== null && <small>{l.detail}</small>}
          </span>
          <span className="infobulle" aria-hidden>
            {l.infobulle}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function TopParTranche({ tranches, seuil }: { tranches: StatTranche[]; seuil: number }) {
  const max = Math.max(0.0001, ...tranches.flatMap((t) => t.emotions.slice(0, 3).map((e) => e.part_seances)));
  return (
    <div className="tranches">
      {tranches.map((t) => (
        <div className="tranche" key={t.tranche_id}>
          <div className="tranche-titre">
            {t.libelle}
            <small>
              {t.masque
                ? 'effectif insuffisant'
                : `${t.nb_clients} client${t.nb_clients === 1 ? '' : 's'} · ${t.nb_seances} séance${t.nb_seances === 1 ? '' : 's'}`}
            </small>
          </div>
          {t.masque ? (
            <p className="meta" style={{ alignSelf: 'center', display: 'flex', gap: 6, alignItems: 'center' }}>
              <Icone nom="cadenas" taille={14} /> Masqué : moins de {seuil} clients d'autres thérapeutes dans cette
              tranche.
            </p>
          ) : t.emotions.length === 0 ? (
            <p className="meta" style={{ alignSelf: 'center' }}>
              Aucune séance dans cette tranche.
            </p>
          ) : (
            <ol className="tranche-top" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {t.emotions.slice(0, 3).map((e, i) => (
                <li
                  key={e.emotion_id}
                  className={`tranche-emotion${i === 0 ? ' rang-1' : ''}`}
                  title={`${e.libelle} : présente dans ${pourcentage(e.part_seances)} des séances de cette tranche`}
                >
                  <strong>
                    {i + 1}. {e.libelle} <span>{pourcentage(e.part_seances)}</span>
                  </strong>
                  <span className="mini-piste" aria-hidden>
                    <span style={{ width: `${(e.part_seances / max) * 100}%` }} />
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      ))}
    </div>
  );
}

// Rampe séquentielle (clair → foncé) dans la couleur du thème, pour la carte thermique.
const RAMPE = [50, 100, 200, 300, 400, 500, 600, 700, 800].map((n) => `var(--violet-${n})`);

/** Teinte de la rampe séquentielle pour une valeur (le nombre reste toujours écrit dans la case). */
export function couleurThermique(part: number, max: number) {
  const i = Math.min(RAMPE.length - 1, Math.round((part / max) * (RAMPE.length - 1)));
  return { background: RAMPE[i], color: i >= 5 ? '#fff' : 'var(--encre)' };
}

export function CarteThermique({ tranches }: { tranches: StatTranche[] }) {
  const max = Math.max(0.0001, ...tranches.flatMap((t) => t.emotions.map((e) => e.part_seances)));
  return (
    <div className="tableau-conteneur">
      <table className="thermique">
        <caption className="visuellement-cache">Part des séances où chaque émotion apparaît, par tranche d'âge</caption>
        <thead>
          <tr>
            <th scope="col">Tranche d'âge</th>
            {EMOTIONS.map((e) => (
              <th scope="col" key={e.id}>
                {e.libelle}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tranches.map((t) => (
            <tr key={t.tranche_id}>
              <th scope="row">{t.libelle}</th>
              {EMOTIONS.map((e) => {
                if (t.masque)
                  return (
                    <td key={e.id} className="cellule meta" aria-label="masqué">
                      ·
                    </td>
                  );
                const part = t.emotions.find((x) => x.emotion_id === e.id)?.part_seances ?? 0;
                return (
                  <td
                    key={e.id}
                    className="cellule"
                    style={part ? couleurThermique(part, max) : undefined}
                    title={`${t.libelle} · ${e.libelle} : ${pourcentage(part)} des séances`}
                  >
                    {part ? Math.round(part * 100) : '·'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="meta" style={{ marginTop: 8 }}>
        Valeurs en % des séances de la tranche. « · » : aucune apparition ou case masquée.
      </p>
    </div>
  );
}

const libelleMois = (mois: string, format: 'short' | 'long' = 'short') =>
  new Date(`${mois}-15T12:00:00`).toLocaleDateString('fr-FR', {
    month: format,
    ...(format === 'long' ? { year: 'numeric' } : {}),
  });

/**
 * Colonnes (une seule série). Valeur affichée sur la dernière colonne et
 * sur le maximum ; les autres au survol, au toucher ou au clavier.
 */
export function Colonnes({
  donnees,
  titre,
  formater,
}: {
  donnees: { cle: string; court: string; long: string; valeur: number }[];
  titre: string;
  formater: (v: number) => string;
}) {
  const max = Math.max(1, ...donnees.map((d) => d.valeur));
  const indiceMax = donnees.findIndex((d) => d.valeur === max);
  return (
    <ol className="colonnes" aria-label={titre} style={{ '--n': donnees.length } as CSSProperties}>
      {donnees.map((d, i) => {
        const etiquette = i === donnees.length - 1 || i === indiceMax;
        return (
          <li key={d.cle} className="colonne" tabIndex={0} aria-label={`${d.long} : ${formater(d.valeur)}`}>
            <span className="colonne-zone" aria-hidden>
              <span className="colonne-barre" style={{ height: `${(d.valeur / max) * 100}%` }}>
                {etiquette && d.valeur > 0 && <span className="colonne-valeur">{formater(d.valeur)}</span>}
              </span>
            </span>
            <span className="colonne-mois" aria-hidden>
              {d.court}
            </span>
            <span className="infobulle" aria-hidden>
              {d.long} : {formater(d.valeur)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Colonnes mensuelles : une par mois (AAAA-MM). */
export function ColonnesMensuelles({
  donnees,
  titre,
  formater,
}: {
  donnees: { mois: string; valeur: number }[];
  titre: string;
  formater: (v: number) => string;
}) {
  return (
    <Colonnes
      titre={titre}
      formater={formater}
      donnees={donnees.map((d) => ({
        cle: d.mois,
        court: libelleMois(d.mois),
        long: libelleMois(d.mois, 'long'),
        valeur: d.valeur,
      }))}
    />
  );
}

/** Petite courbe 0–max d'une question de questionnaire (une seule série). */
export function CourbeReponses({
  points,
  max,
  min = 0,
  titre,
}: {
  points: { date: string; valeur: number }[];
  max: number;
  min?: number;
  titre: string;
}) {
  const l = 260;
  const h = 96;
  const marge = { g: 22, d: 30, h: 10, b: 18 };
  const x = (i: number) =>
    marge.g + (points.length === 1 ? (l - marge.g - marge.d) / 2 : (i / (points.length - 1)) * (l - marge.g - marge.d));
  const y = (v: number) => marge.h + (1 - (v - min) / (max - min)) * (h - marge.h - marge.b);
  const dernier = points[points.length - 1];
  return (
    <svg
      viewBox={`0 0 ${l} ${h}`}
      className="courbe"
      role="img"
      aria-label={`${titre} : ${points.map((p) => p.valeur).join(', ')}`}
    >
      {[min, (min + max) / 2, max].map((v) => (
        <g key={v}>
          <line x1={marge.g} x2={l - marge.d} y1={y(v)} y2={y(v)} className="courbe-grille" />
          <text x={marge.g - 6} y={y(v) + 3.5} className="courbe-axe" textAnchor="end">
            {v}
          </text>
        </g>
      ))}
      {points.length > 1 && (
        <polyline
          points={points.map((p, i) => `${x(i)},${y(p.valeur)}`).join(' ')}
          className="courbe-ligne"
          fill="none"
        />
      )}
      {points.map((p, i) => (
        <circle key={p.date + i} cx={x(i)} cy={y(p.valeur)} r={4.5} className="courbe-point">
          <title>{`${new Date(p.date).toLocaleDateString('fr-FR')} : ${p.valeur}`}</title>
        </circle>
      ))}
      {dernier && (
        <text x={x(points.length - 1) + 9} y={y(dernier.valeur) + 4} className="courbe-derniere">
          {dernier.valeur}
        </text>
      )}
      {points.length > 0 && (
        <>
          <text x={x(0)} y={h - 3} className="courbe-axe" textAnchor={points.length === 1 ? 'middle' : 'start'}>
            {new Date(points[0].date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
          </text>
          {points.length > 1 && (
            <text x={x(points.length - 1)} y={h - 3} className="courbe-axe" textAnchor="end">
              {new Date(dernier.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
            </text>
          )}
        </>
      )}
    </svg>
  );
}

export function BasculeVue<T extends string>({
  valeur,
  options,
  changer,
  libelle,
}: {
  valeur: T;
  options: { valeur: T; libelle: string }[];
  changer: (v: T) => void;
  libelle: string;
}) {
  return (
    <div className="bascule-vue" role="group" aria-label={libelle}>
      {options.map((o) => (
        <button key={o.valeur} aria-pressed={valeur === o.valeur} onClick={() => changer(o.valeur)}>
          {o.libelle}
        </button>
      ))}
    </div>
  );
}
