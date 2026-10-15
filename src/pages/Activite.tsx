// Activité : statistiques de l'emploi du temps (espace personnel).
// Une seule série par graphique, valeurs toujours écrites : rien ne
// repose sur la couleur seule.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Chargement, Erreur } from '../composants/Commun';
import { BarresHorizontales, BasculeVue, Colonnes, couleurThermique } from '../composants/Graphiques';
import { Icone } from '../composants/Icone';
import { CATEGORIES, JOURS, MODALITES } from '../config/agenda';
import { donnees } from '../donnees';
import { statistiquesAgenda } from '../domaine/activite';
import { decalerJour, horodatage, lundiDe } from '../domaine/agenda';
import { dateDuJour, nombre, pourcentage } from '../domaine/format';
import { useReglages } from '../etat/reglages';
import { useChargement } from '../etat/useChargement';

type Periode = '4' | '12' | '52';
const PERIODES: { valeur: Periode; libelle: string }[] = [
  { valeur: '4', libelle: '4 semaines' },
  { valeur: '12', libelle: '12 semaines' },
  { valeur: '52', libelle: '12 mois' },
];

const heures = (h: number) => `${nombre(h)} h`;
const jourCourt = (jour: string, format: 'short' | 'long' = 'short') =>
  new Date(`${jour}T12:00:00`).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: format,
    ...(format === 'long' ? { year: 'numeric' } : {}),
  });

export function Activite() {
  const { parametres: p } = useReglages();
  const [periode, setPeriode] = useState<Periode>('12');
  // une seule lecture sur 52 semaines : changer de période ne recharge rien
  const charge = useChargement(
    () => {
      const lundi = lundiDe(dateDuJour());
      return donnees.listerRendezVous(
        horodatage(decalerJour(lundi, -7 * 51), '00:00'),
        horodatage(decalerJour(lundi, 7), '00:00'),
      );
    },
    [],
    'activite',
  );

  if (charge.chargement && !charge.donnees) return <Chargement />;
  if (charge.erreur && !charge.donnees) return <Erreur message={charge.erreur} reessayer={charge.recharger} />;

  const nb = Number(periode);
  const s = statistiquesAgenda(charge.donnees!, new Date(), nb);
  const moyenne = s.heuresConsultation / nb;
  const tenus = s.nbRendezVous - s.nbAbsences;

  // 12 mois : regroupement par mois (52 colonnes seraient illisibles)
  const colonnes =
    nb > 12
      ? [
          ...s.semaines.reduce(
            (m, x) => m.set(x.lundi.slice(0, 7), (m.get(x.lundi.slice(0, 7)) ?? 0) + x.heures),
            new Map<string, number>(),
          ),
        ].map(([mois, h]) => {
          const d = new Date(`${mois}-15T12:00:00`);
          return {
            cle: mois,
            court: d.toLocaleDateString('fr-FR', { month: 'short' }),
            long: d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
            valeur: Math.round(h * 10) / 10,
          };
        })
      : s.semaines.map((x) => ({
          cle: x.lundi,
          court: jourCourt(x.lundi),
          long: `Semaine du ${jourCourt(x.lundi, 'long')}`,
          valeur: x.heures,
        }));

  const maxCat = Math.max(1, ...s.parCategorie.map((c) => c.nb));
  const maxMod = Math.max(1, ...s.parModalite.map((m) => m.nb));
  const joursGrille = [...p.agenda_jours].sort();
  for (const c of s.creneaux) if (!joursGrille.includes(c.jour)) joursGrille.push(c.jour);
  joursGrille.sort();
  const heuresCreneaux = s.creneaux.map((c) => c.heure);
  const hMin = Math.min(p.agenda_heure_debut, ...heuresCreneaux);
  const hMax = Math.max(p.agenda_heure_fin - 1, ...heuresCreneaux);
  const heuresGrille = Array.from({ length: hMax - hMin + 1 }, (_, i) => hMin + i);
  const maxCreneau = Math.max(1, ...s.creneaux.map((c) => c.nb));
  const top = [...s.creneaux].sort((a, b) => b.nb - a.nb || a.jour - b.jour || a.heure - b.heure).slice(0, 3);
  const nbCreneau = (jour: number, heure: number) =>
    s.creneaux.find((c) => c.jour === jour && c.heure === heure)?.nb ?? 0;

  return (
    <div className="page">
      <div className="entete-page">
        <div>
          <h1>Activité</h1>
          <p className="sous-titre">
            Ce que dit votre emploi du temps : heures de consultation, absences, annulations, créneaux les plus
            demandés. Calculé à partir des rendez-vous, pour vous seul.
          </p>
        </div>
        <BasculeVue libelle="Période" valeur={periode} changer={setPeriode} options={PERIODES} />
      </div>

      <section className="indicateurs" aria-label="Indicateurs d'activité">
        <div className="carte indicateur indicateur-vedette">
          <div className="indicateur-libelle">Heures de consultation</div>
          <div className="indicateur-valeur">{heures(s.heuresConsultation)}</div>
          <div className="indicateur-detail">soit {heures(moyenne)} par semaine en moyenne</div>
        </div>
        <div className="carte indicateur">
          <div className="indicateur-libelle">Rendez-vous tenus</div>
          <div className="indicateur-valeur">{tenus}</div>
          <div className="indicateur-detail">sur {s.nbRendezVous} rendez-vous passés avec un client</div>
        </div>
        <div className="carte indicateur">
          <div className="indicateur-libelle">Taux d'absence</div>
          <div className="indicateur-valeur">{pourcentage(s.tauxAbsence)}</div>
          <div className="indicateur-detail">
            {s.nbAbsences} absence{s.nbAbsences > 1 ? 's' : ''} non prévenue{s.nbAbsences > 1 ? 's' : ''}
          </div>
        </div>
        <div className="carte indicateur">
          <div className="indicateur-libelle">Annulations</div>
          <div className="indicateur-valeur">{pourcentage(s.tauxAnnulation)}</div>
          <div className="indicateur-detail">
            {s.nbAnnulations} rendez-vous annulé{s.nbAnnulations > 1 ? 's' : ''}
          </div>
        </div>
      </section>

      <div className="grille-tableau-bord">
        <section className="carte" aria-labelledby="a-heures">
          <div className="carte-entete">
            <div>
              <h2 id="a-heures">Heures de consultation {nb > 12 ? 'par mois' : 'par semaine'}</h2>
              <p className="aide">Rendez-vous avec un client, passés et non annulés, hors absences.</p>
            </div>
          </div>
          <div className="carte-corps">
            <Colonnes
              titre={`Heures de consultation ${nb > 12 ? 'par mois' : 'par semaine'}`}
              donnees={colonnes}
              formater={heures}
            />
          </div>
        </section>

        <section className="carte" aria-labelledby="a-types">
          <div className="carte-entete">
            <div>
              <h2 id="a-types">Répartition par type</h2>
              <p className="aide">Rendez-vous passés, hors annulés.</p>
            </div>
          </div>
          <div className="carte-corps">
            <BarresHorizontales
              titre="Rendez-vous par type"
              max={maxCat}
              lignes={CATEGORIES.map((c) => {
                const x = s.parCategorie.find((y) => y.categorie === c.cle)!;
                return {
                  cle: c.cle,
                  libelle: c.libelle,
                  valeur: x.nb,
                  texte: String(x.nb),
                  detail: heures(x.heures),
                  infobulle: `${c.libelle} : ${x.nb} rendez-vous, ${heures(x.heures)}`,
                };
              })}
            />
          </div>
        </section>

        <section className="carte" aria-labelledby="a-modalites">
          <div className="carte-entete">
            <div>
              <h2 id="a-modalites">Où se passent les séances</h2>
              <p className="aide">Rendez-vous passés avec un client.</p>
            </div>
          </div>
          <div className="carte-corps">
            <BarresHorizontales
              titre="Rendez-vous par modalité"
              max={maxMod}
              lignes={s.parModalite.map((m) => ({
                cle: m.modalite,
                libelle: MODALITES[m.modalite].libelle,
                valeur: m.nb,
                texte: String(m.nb),
                infobulle: `${MODALITES[m.modalite].libelle} : ${m.nb} rendez-vous`,
              }))}
            />
          </div>
        </section>

        <section className="carte" aria-labelledby="a-creneaux" style={{ gridColumn: '1 / -1' }}>
          <div className="carte-entete">
            <div>
              <h2 id="a-creneaux">Créneaux les plus demandés</h2>
              <p className="aide">
                Nombre de rendez-vous avec un client (hors annulés) selon le jour et l'heure de début.
                {top.length > 0 &&
                  ` En tête : ${top.map((c) => `${JOURS[c.jour - 1].toLowerCase()} ${c.heure} h (${c.nb})`).join(', ')}.`}
              </p>
            </div>
            <Link to="/emploi-du-temps" className="bouton bouton-petit">
              Emploi du temps →
            </Link>
          </div>
          <div className="carte-corps">
            {s.creneaux.length === 0 ? (
              <p className="meta">Aucun rendez-vous sur cette période.</p>
            ) : (
              <div className="tableau-conteneur">
                <table className="thermique thermique-horaire">
                  <caption className="visuellement-cache">Rendez-vous par jour de la semaine et heure de début</caption>
                  <thead>
                    <tr>
                      <th scope="col">Jour</th>
                      {heuresGrille.map((h) => (
                        <th scope="col" key={h}>
                          {h} h
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {joursGrille.map((j) => (
                      <tr key={j}>
                        <th scope="row">{JOURS[j - 1]}</th>
                        {heuresGrille.map((h) => {
                          const n = nbCreneau(j, h);
                          return (
                            <td
                              key={h}
                              className="cellule"
                              style={n ? couleurThermique(n, maxCreneau) : undefined}
                              title={`${JOURS[j - 1]} ${h} h : ${n} rendez-vous`}
                            >
                              {n || '·'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="meta" style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
              <Icone nom="info" taille={14} /> Le nombre est écrit dans chaque case ; plus la case est foncée, plus le
              créneau est demandé. « · » : aucun rendez-vous.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
