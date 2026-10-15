// La fiche papier, case pour case :
//
//  Nom :            Date :                         Séance n ☑
//  Prénom :
//  Âge et année :
//  Père ☐ Mère ☐    Objectif : [      ]            T.I.M. [    ]
//                               ↑
//  Émotion Temps Présent        │     Émotion Temps Présent
//  [      |      ]              │     [      |      ]
//     [ ] ↓↑                    │           ↓↑
//     … 9 cases                 │     [          ]
//  [          ]                 │     3ième Génération : [ ][ ][ ][ ]
//  ·····························│     2ième Génération : [ ][ ][ ][ ]
//  Père [ ]  Naissance  [ ] Mère│     ┌──────── notes ────────┐
//  …                            │     └───────────────────────┘

import { EMOTIONS, LIGNEES, POSITION_MERE, POSITION_PERE, ZONES, ZONES_CROISEES } from '../config/referentiels';
import { ageA, LIBELLE_TYPE } from '../domaine/format';
import type { Client, FicheSeance, Lignee, Seance, ZoneFiche } from '../domaine/types';

interface Props {
  client: Client;
  seance: Seance;
  fiche: FicheSeance;
  maj: <K extends keyof FicheSeance>(cle: K, valeur: FicheSeance[K]) => void;
  valeurCase: (zone: ZoneFiche, position: number) => number | null;
  definirCase: (zone: ZoneFiche, position: number, emotionId: number | null) => void;
}

const libelleZone = (z: ZoneFiche) => ZONES.find((x) => x.zone === z)!.libelle;

export function FeuilleSeance({ client, seance, fiche, maj, valeurCase, definirCase }: Props) {
  // Une case = un menu déroulant des 14 émotions.
  const boite = (zone: ZoneFiche, position: number, nom: string, variante = '') => {
    const v = valeurCase(zone, position);
    return (
      <span key={`${zone}-${position}`} className={`boite ${variante}${v !== null ? ' boite-remplie' : ''}`}>
        <select
          aria-label={nom}
          title={nom}
          value={v ?? ''}
          onChange={(e) => definirCase(zone, position, e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">—</option>
          {EMOTIONS.map((e) => (
            <option key={e.id} value={e.id}>
              {e.libelle}
            </option>
          ))}
        </select>
      </span>
    );
  };

  const barreDouble = (zone: ZoneFiche) => (
    <div className="barre-double">
      {boite(zone, 1, `${libelleZone(zone)}, moitié gauche`)}
      {boite(zone, 2, `${libelleZone(zone)}, moitié droite`)}
    </div>
  );

  const doubleFleche = (classe = '') => (
    <span className={`double-fleche ${classe}`} aria-hidden>
      <span className="fleche-bas" />
      <span className="fleche-haut" />
    </span>
  );

  const cocherLignee = (l: Lignee, coche: boolean) =>
    maj('lignee', coche ? l : fiche.lignee === l ? null : fiche.lignee);
  const age = fiche.date_seance ? ageA(client.annee_naissance, fiche.date_seance) : null;

  return (
    <section className="feuille" aria-label={`Fiche de la séance ${seance.numero}`}>
      {/* ---------------- En-tête ---------------- */}
      <div className="feuille-haut">
        <div className="haut-gauche">
          <p className="ligne-feuille">
            <span className="etiquette-feuille">Nom :</span>
            <span className="valeur-feuille">{client.nom}</span>
          </p>
          <p className="ligne-feuille">
            <span className="etiquette-feuille">Prénom :</span>
            <span className="valeur-feuille">{client.prenom}</span>
          </p>
          <p className="ligne-feuille">
            <span className="etiquette-feuille">Âge et année :</span>
            <span className="valeur-feuille">
              {age === null ? '—' : `${age} ans`} · {client.annee_naissance}
            </span>
          </p>
          <div className="ligne-feuille lignees" role="group" aria-label="Lignée">
            {LIGNEES.map((l) => (
              <label key={l.valeur} className="coche-feuille">
                <span className="etiquette-feuille">{l.libelle}</span>
                <input
                  type="checkbox"
                  checked={fiche.lignee === l.valeur}
                  onChange={(e) => cocherLignee(l.valeur, e.target.checked)}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="haut-centre">
          <label className="ligne-feuille">
            <span className="etiquette-feuille">Date :</span>
            <input
              type="date"
              className="date-feuille"
              value={fiche.date_seance}
              onChange={(e) => maj('date_seance', e.target.value)}
              required
            />
          </label>
          <label className="objectif-feuille">
            <span className="etiquette-feuille etiquette-objectif">Objectif :</span>
            <textarea
              className="boite-texte"
              value={fiche.objectif}
              onChange={(e) => maj('objectif', e.target.value)}
              aria-label="Objectif"
            />
          </label>
        </div>

        <div className="haut-droite">
          <p className="ligne-feuille seance-feuille">
            <span className="etiquette-feuille">Séance {seance.numero}</span>
            <span className="coche-lecture" aria-hidden>
              ✓
            </span>
          </p>
          <p className="type-feuille">{LIBELLE_TYPE[seance.type]}</p>
          <label className="tim-feuille">
            <span className="etiquette-feuille">T.I.M.</span>
            <textarea
              className="boite-texte boite-tim"
              value={fiche.tim}
              onChange={(e) => maj('tim', e.target.value)}
              aria-label="T.I.M."
            />
          </label>
        </div>
      </div>

      {/* ---------------- Corps ---------------- */}
      <div className="feuille-corps">
        <div className="corps-gauche">
          <h3 className="titre-feuille">Émotion Temps Présent</h3>
          {barreDouble('present1_haut')}
          <div className="pile-feuille">
            <div className="pile-cases">
              {Array.from({ length: 9 }, (_, i) =>
                boite('present1_pile', i + 1, `Émotion temps présent, empilement, case ${i + 1}`, 'boite-pile'),
              )}
            </div>
            {doubleFleche()}
          </div>
          <div className="centre-feuille">{boite('present1_bas', 1, libelleZone('present1_bas'), 'boite-large')}</div>

          <hr className="pointilles" />
          {ZONES_CROISEES.map((z, i) => (
            <div key={z}>
              <div className="rangee-croisee">
                <div className="croise-case">
                  <span className="etiquette-feuille">Père</span>
                  {boite(z, POSITION_PERE, `${libelleZone(z)}, Père`, 'boite-croisee')}
                </div>
                <span className="etiquette-feuille niveau-feuille">{libelleZone(z)}</span>
                <div className="croise-case">
                  <span className="etiquette-feuille">Mère</span>
                  {boite(z, POSITION_MERE, `${libelleZone(z)}, Mère`, 'boite-croisee')}
                </div>
              </div>
              {i === 1 && <hr className="pointilles" />}
            </div>
          ))}
        </div>

        <div className="corps-fleche" aria-hidden />

        <div className="corps-droite">
          <h3 className="titre-feuille">Émotion Temps Présent</h3>
          {barreDouble('present2_haut')}
          <div className="centre-feuille">{doubleFleche('fleche-courte')}</div>
          <div className="centre-feuille">{boite('present2_bas', 1, libelleZone('present2_bas'), 'boite-large')}</div>

          {(['grille_generation_3', 'grille_generation_2'] as const).map((z) => (
            <div key={z} className="grille-feuille">
              <h4 className="etiquette-feuille">
                {z === 'grille_generation_3' ? '3ième Génération :' : '2ième Génération :'}
              </h4>
              <div className="rangee-4">
                {[1, 2, 3, 4].map((p) => boite(z, p, `${libelleZone(z)}, case ${p}`, 'boite-grille'))}
              </div>
            </div>
          ))}

          <label className="notes-feuille">
            <span className="visuellement-cache">Notes de séance</span>
            <textarea
              value={fiche.notes}
              onChange={(e) => maj('notes', e.target.value)}
              placeholder="Notes de séance : observations, déroulé de la consultation…"
            />
          </label>
          <p className="meta" style={{ textAlign: 'right' }}>
            {fiche.notes.length.toLocaleString('fr-FR')} caractères
          </p>
        </div>
      </div>
    </section>
  );
}
