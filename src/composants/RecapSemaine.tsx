// « Votre semaine » : rendez-vous, relances prévues, questionnaires en
// attente et tâches personnelles du lundi au dimanche. Déplié le lundi.

import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { CATEGORIES, couleursAgenda } from '../config/agenda';
import { jourSemaine } from '../domaine/agenda';
import { dateDuJour, jourLisible as jourCourt } from '../domaine/format';
import { useReglages } from '../etat/reglages';
import { useTaches } from '../etat/tachesContexte';
import { Icone } from './Icone';

export function RecapSemaine({ toujoursOuvert = false }: { toujoursOuvert?: boolean }) {
  const { semaine: s } = useTaches();
  const { parametres } = useReglages();
  const couleurs = couleursAgenda(parametres);
  const aujourdhui = dateDuJour();
  const lundi = jourSemaine(aujourdhui) === 1;
  const resume = [
    `${s.rdv.total} rendez-vous`,
    `${s.relances.length} relance${s.relances.length > 1 ? 's' : ''} prévue${s.relances.length > 1 ? 's' : ''}`,
    `${s.questionnairesEnAttente} questionnaire${s.questionnairesEnAttente > 1 ? 's' : ''} en attente`,
    `${s.tachesPerso.length} tâche${s.tachesPerso.length > 1 ? 's' : ''} à échéance`,
  ].join(' · ');

  return (
    <details className="carte recap-semaine" open={toujoursOuvert || lundi}>
      <summary>
        <span className="recap-titre">
          <Icone nom="calendrier" /> Votre semaine
          <span className="meta">
            du {jourCourt(s.lundi)} au {jourCourt(s.dimanche)}
          </span>
        </span>
        <span className="meta">{resume}</span>
        <span className="recap-bascule" aria-hidden>
          <Icone nom="chevron" taille={18} />
        </span>
      </summary>
      <div className="recap-grille">
        <div>
          <h3>Rendez-vous</h3>
          <p className="meta">
            {s.rdv.total} rendez-vous, {String(s.rdv.heures).replace('.', ',')} h planifiées
          </p>
          <ul className="recap-liste">
            {CATEGORIES.filter((c) => s.rdv.parCategorie[c.cle] > 0).map((c) => (
              <li key={c.cle} className={`pave-${c.cle}`} style={{ '--c': couleurs[c.cle] } as CSSProperties}>
                <span className="legende-pastille" aria-hidden />
                <Icone nom={c.icone} taille={13} /> {c.libelle} : <strong>{s.rdv.parCategorie[c.cle]}</strong>
              </li>
            ))}
          </ul>
          <Link to="/emploi-du-temps" className="meta">
            Ouvrir l’emploi du temps →
          </Link>
        </div>
        <div>
          <h3>Relances prévues</h3>
          {s.relances.length === 0 ? (
            <p className="meta">Aucune cette semaine.</p>
          ) : (
            <ul className="recap-liste">
              {s.relances.slice(0, 6).map((r) => (
                <li key={r.client.id}>
                  <Icone nom="envoyer" taille={13} />{' '}
                  <Link to={`/clients/${r.client.id}`}>
                    {r.client.prenom} {r.client.nom}
                  </Link>{' '}
                  <span className="meta">
                    {r.echeance < aujourdhui ? '(en retard)' : `(${jourCourt(r.echeance).split(' ')[0]})`}
                  </span>
                </li>
              ))}
              {s.relances.length > 6 && <li className="meta">et {s.relances.length - 6} autres</li>}
            </ul>
          )}
        </div>
        <div>
          <h3>En attente</h3>
          <p>
            <Icone nom="horloge" taille={13} /> {s.questionnairesEnAttente} questionnaire
            {s.questionnairesEnAttente > 1 ? 's' : ''} envoyé{s.questionnairesEnAttente > 1 ? 's' : ''}, sans réponse
            pour l’instant.
          </p>
        </div>
        <div>
          <h3>Mes tâches de la semaine</h3>
          {s.tachesPerso.length === 0 ? (
            <p className="meta">Rien d’inscrit.</p>
          ) : (
            <ul className="recap-liste">
              {s.tachesPerso.map((t) => (
                <li key={t.id} className="recap-ligne">
                  <Icone nom="taches" taille={13} />
                  <span>
                    {t.titre}{' '}
                    <span className="meta">
                      ({t.echeance! < aujourdhui ? 'en retard' : jourCourt(t.echeance!).split(' ')[0]})
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </details>
  );
}
