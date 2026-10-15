// Évolution d'un client : réponses au questionnaire de suivi (une petite
// courbe par question) et émotions au temps présent, séance par séance.

import { casesTempsPresent, EMOTIONS } from '../config/referentiels';
import type { Envoi, Seance } from '../domaine/types';
import { CourbeReponses } from './Graphiques';

export function EvolutionClient({ seances, envois }: { seances: Seance[]; envois: Envoi[] }) {
  // --- questionnaire : une série par question chiffrée ----------------------
  // Une même question posée dans plusieurs questionnaires (même intitulé,
  // même échelle) forme une seule courbe.
  const remplis = envois
    .filter((e) => e.reponses && e.repondu_le)
    .sort((a, b) => a.repondu_le!.localeCompare(b.repondu_le!));
  const series = new Map<
    string,
    { libelle: string; min: number; max: number; points: { date: string; valeur: number }[] }
  >();
  for (const e of remplis)
    for (const r of e.reponses!) {
      if (typeof r.valeur !== 'number' || (r.type !== 'curseur' && r.type !== 'etoiles')) continue;
      const q = e.questions.find((x) => x.id === r.question_id);
      const min = r.type === 'etoiles' ? 1 : (q?.minimum ?? 0);
      const max = q?.maximum ?? (r.type === 'etoiles' ? 5 : 10);
      const cle = `${r.libelle}|${min}|${max}`;
      const s = series.get(cle) ?? { libelle: r.libelle, min, max, points: [] };
      s.points.push({ date: e.repondu_le!, valeur: r.valeur });
      series.set(cle, s);
    }

  // --- émotions au temps présent, séance par séance ----------------------------
  const parSeance = seances.map((s) => {
    const compte = new Map<number, number>();
    for (const c of casesTempsPresent(s.cases)) compte.set(c.emotion_id, (compte.get(c.emotion_id) ?? 0) + 1);
    return { seance: s, compte };
  });
  const totaux = new Map<number, number>();
  for (const { compte } of parSeance) for (const [id, n] of compte) totaux.set(id, (totaux.get(id) ?? 0) + n);
  const lignes = EMOTIONS.filter((e) => totaux.has(e.id)).sort(
    (a, b) => totaux.get(b.id)! - totaux.get(a.id)! || a.id - b.id,
  );

  if (!series.size && !lignes.length)
    return <p className="meta">Pas encore de données : remplissez des séances et envoyez le questionnaire de suivi.</p>;

  return (
    <div style={{ display: 'grid', gap: 22 }}>
      {series.size > 0 && (
        <div>
          <h3 style={{ marginBottom: 10 }}>Réponses au questionnaire de suivi</h3>
          <div className="courbes">
            {[...series].map(([cle, s]) => (
              <figure key={cle} className="courbe-carte">
                <figcaption>{s.libelle}</figcaption>
                <CourbeReponses titre={s.libelle} points={s.points} min={s.min} max={s.max} />
              </figure>
            ))}
          </div>
        </div>
      )}

      {lignes.length > 0 && (
        <div>
          <h3 style={{ marginBottom: 4 }}>Émotions au temps présent, séance par séance</h3>
          <p className="meta" style={{ marginBottom: 10 }}>
            Un point par séance où l'émotion figure ; plus il est gros, plus elle occupe de cases.
          </p>
          <div className="tableau-conteneur">
            <table className="matrice">
              <thead>
                <tr>
                  <th scope="col">Émotion</th>
                  {parSeance.map(({ seance }) => (
                    <th scope="col" key={seance.id} title={seance.date_seance}>
                      {seance.type === 'bilan' ? 'Bilan' : `S${seance.numero}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lignes.map((e) => (
                  <tr key={e.id}>
                    <th scope="row">{e.libelle}</th>
                    {parSeance.map(({ seance, compte }) => {
                      const n = compte.get(e.id) ?? 0;
                      return (
                        <td key={seance.id} aria-label={n ? `${n} case${n > 1 ? 's' : ''}` : 'absente'}>
                          {n > 0 && (
                            <span
                              className={`point point-${Math.min(n, 3)}`}
                              title={`${e.libelle}, séance ${seance.numero} : ${n}`}
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
