// Fiche client : prochains rendez-vous et bouton « Planifier ».

import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { categorie, couleursAgenda, STATUTS } from '../config/agenda';
import { donnees } from '../donnees';
import { decalerJour, heureLisible, horodatage, jourDe } from '../domaine/agenda';
import { dateDuJour } from '../domaine/format';
import type { RendezVous } from '../domaine/types';
import { useReglages } from '../etat/reglages';
import { useTaches } from '../etat/tachesContexte';
import { useChargement } from '../etat/useChargement';
import { DialogueRendezVous } from './DialogueRendezVous';
import { Icone } from './Icone';

export function RendezVousClient({ clientId }: { clientId: string }) {
  const { parametres } = useReglages();
  const { clients, recharger: rechargerTaches } = useTaches();
  const couleurs = couleursAgenda(parametres);
  const aujourdhui = dateDuJour();
  const charge = useChargement(
    () => donnees.listerRendezVous(horodatage(aujourdhui, '00:00'), horodatage(decalerJour(aujourdhui, 365), '00:00')),
    [aujourdhui],
  );
  const [edition, setEdition] = useState<{ rdv?: RendezVous } | null>(null);
  const tous = charge.donnees ?? [];
  const aVenir = tous.filter(
    (r) => r.client_id === clientId && r.statut !== 'annule' && Date.parse(r.fin) > Date.now(),
  );

  return (
    <section className="carte" aria-labelledby="t-rdv-client">
      <div className="carte-entete">
        <div>
          <h2 id="t-rdv-client" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Icone nom="calendrier" /> Rendez-vous
          </h2>
          <p className="aide">{aVenir.length ? `${aVenir.length} à venir.` : 'Aucun rendez-vous à venir.'}</p>
        </div>
        <button className="bouton bouton-petit bouton-principal" onClick={() => setEdition({})}>
          <Icone nom="plus" taille={14} /> Planifier
        </button>
      </div>
      {aVenir.length > 0 && (
        <div className="carte-corps" style={{ paddingTop: 4 }}>
          <ul className="liste-rdv-client">
            {aVenir.slice(0, 4).map((r) => {
              const cat = categorie(r.categorie);
              return (
                <li key={r.id}>
                  <button
                    className={`ligne-rdv-client pave-${r.categorie}`}
                    style={{ '--c': couleurs[r.categorie] } as CSSProperties}
                    onClick={() => setEdition({ rdv: r })}
                  >
                    <span className="legende-pastille" aria-hidden />
                    <Icone nom={cat.icone} taille={14} />
                    <span>
                      {new Date(`${jourDe(r.debut)}T12:00:00`).toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                      })}{' '}
                      à {heureLisible(r.debut)}
                    </span>
                    <span className="meta">
                      {cat.libelle}
                      {r.statut !== 'prevu' && ` · ${STATUTS[r.statut].libelle}`}
                      {r.rappel_envoye_le && ' · rappel envoyé'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {aVenir.length > 4 && (
            <Link to="/emploi-du-temps" className="meta">
              Voir l’emploi du temps →
            </Link>
          )}
        </div>
      )}
      {edition && (
        <DialogueRendezVous
          rdv={edition.rdv}
          initial={{ clientId, jour: decalerJour(aujourdhui, 7), heure: '10:00' }}
          clients={clients}
          existants={tous}
          fermer={(modifie) => {
            setEdition(null);
            if (modifie) {
              charge.recharger();
              rechargerTaches();
            }
          }}
        />
      )}
    </section>
  );
}
