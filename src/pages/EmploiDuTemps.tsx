// Emploi du temps : semaine (ordinateur, tablette) ou jour (téléphone).
// Cliquer sur un créneau libre crée un rendez-vous ; cliquer sur un
// rendez-vous l'ouvre (modifier, commencer la séance, rappel…).

import { useMemo, useState, type CSSProperties } from 'react';
import { GrilleSemaine, LegendeAgenda, ListeJour, nomRendezVous } from '../composants/Agenda';
import { Chargement, Erreur } from '../composants/Commun';
import { DialogueRendezVous } from '../composants/DialogueRendezVous';
import { BasculeVue } from '../composants/Graphiques';
import { Icone } from '../composants/Icone';
import { couleursAgenda } from '../config/agenda';
import { donnees } from '../donnees';
import { decalerJour, heureLisible, horodatage, jourDe, joursAffiches, lundiDe } from '../domaine/agenda';
import { dateDuJour } from '../domaine/format';
import type { CategorieRdv, RendezVous } from '../domaine/types';
import { useReglages } from '../etat/reglages';
import { useTaches } from '../etat/tachesContexte';
import { useChargement } from '../etat/useChargement';

type Vue = 'semaine' | 'jour';
const CLE_VUE = 'suivi-therapeutique:vue-agenda';

function vueInitiale(): Vue {
  try {
    const v = sessionStorage.getItem(CLE_VUE);
    if (v === 'semaine' || v === 'jour') return v;
  } catch {
    /* stockage indisponible */
  }
  return globalThis.matchMedia?.('(max-width: 700px)').matches ? 'jour' : 'semaine';
}

const format = (jour: string, o: Intl.DateTimeFormatOptions) =>
  new Date(`${jour}T12:00:00`).toLocaleDateString('fr-FR', o);

export function EmploiDuTemps() {
  const { parametres } = useReglages();
  const { clients, recharger: rechargerTaches } = useTaches();
  const parId = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const couleurs = couleursAgenda(parametres);

  const [vue, setVue] = useState<Vue>(vueInitiale);
  const [jour, setJour] = useState(dateDuJour());
  const [masquees, setMasquees] = useState<Set<CategorieRdv>>(new Set());
  const [edition, setEdition] = useState<{ rdv?: RendezVous; initial?: { jour?: string; heure?: string } } | null>(
    null,
  );

  // toujours la semaine entière : la vue du jour affiche aussi le nombre de rendez-vous de chaque jour
  const lundi = lundiDe(jour);
  const [de, a] = [horodatage(lundi, '00:00'), horodatage(decalerJour(lundi, 7), '00:00')];
  const charge = useChargement(() => donnees.listerRendezVous(de, a), [de, a], `agenda:${de}:${a}`);

  const tous = charge.donnees ?? [];
  const visibles = tous.filter((r) => !masquees.has(r.categorie));
  const actifs = tous.filter((r) => r.statut !== 'annule' && (vue === 'semaine' || jourDe(r.debut) === jour));
  const prochain = actifs.find((r) => Date.parse(r.debut) > Date.now());

  function changerVue(v: Vue) {
    setVue(v);
    try {
      sessionStorage.setItem(CLE_VUE, v);
    } catch {
      /* stockage indisponible */
    }
  }
  const avancer = (n: number) => setJour(decalerJour(jour, vue === 'semaine' ? 7 * n : n));
  const titre =
    vue === 'semaine'
      ? `Semaine du ${format(lundi, { day: 'numeric', month: 'long' })} au ${format(decalerJour(lundi, 6), { day: 'numeric', month: 'long', year: 'numeric' })}`
      : format(jour, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="page">
      <div className="entete-page">
        <div>
          <h1>Emploi du temps</h1>
          <p className="sous-titre" aria-live="polite">
            {titre}
          </p>
        </div>
        <div className="actions">
          <BasculeVue
            libelle="Affichage"
            valeur={vue}
            changer={changerVue}
            options={[
              { valeur: 'semaine', libelle: 'Semaine' },
              { valeur: 'jour', libelle: 'Jour' },
            ]}
          />
          <button className="bouton bouton-principal" onClick={() => setEdition({ initial: { jour } })}>
            <Icone nom="plus" /> Nouveau rendez-vous
          </button>
        </div>
      </div>

      <div className="agenda-barre">
        <div className="actions">
          <button
            className="bouton bouton-icone"
            onClick={() => avancer(-1)}
            aria-label={vue === 'semaine' ? 'Semaine précédente' : 'Jour précédent'}
          >
            <Icone nom="precedent" />
          </button>
          <button className="bouton" onClick={() => setJour(dateDuJour())}>
            Aujourd’hui
          </button>
          <button
            className="bouton bouton-icone"
            onClick={() => avancer(1)}
            aria-label={vue === 'semaine' ? 'Semaine suivante' : 'Jour suivant'}
          >
            <Icone nom="chevron" />
          </button>
          <input
            type="date"
            aria-label="Aller à la date"
            value={jour}
            onChange={(e) => e.target.value && setJour(e.target.value)}
            style={{ width: 'auto' }}
          />
        </div>
        <p className="meta">
          {actifs.length} rendez-vous {vue === 'semaine' ? 'cette semaine' : 'ce jour-là'}
          {prochain && (
            <>
              {' '}
              · prochain : {format(jourDe(prochain.debut), { weekday: 'long' })} à {heureLisible(prochain.debut)},{' '}
              {nomRendezVous(prochain, parId)}
            </>
          )}
        </p>
      </div>

      <LegendeAgenda
        couleurs={couleurs}
        masquees={masquees}
        basculer={(c) =>
          setMasquees((m) => {
            const s = new Set(m);
            if (s.has(c)) s.delete(c);
            else s.add(c);
            return s;
          })
        }
      />

      {vue === 'jour' && (
        <nav className="agenda-bande-jours" aria-label="Jours de la semaine">
          {Array.from({ length: 7 }, (_, i) => decalerJour(lundi, i)).map((j) => {
            const n = tous.filter((r) => jourDe(r.debut) === j && r.statut !== 'annule').length;
            return (
              <button
                key={j}
                className="agenda-bande-jour"
                aria-current={j === jour ? 'date' : undefined}
                onClick={() => setJour(j)}
                aria-label={`${format(j, { weekday: 'long', day: 'numeric' })} : ${n} rendez-vous`}
              >
                <span>{format(j, { weekday: 'short' })}</span>
                <strong>{format(j, { day: 'numeric' })}</strong>
                <small>{n || '·'}</small>
              </button>
            );
          })}
        </nav>
      )}

      {charge.erreur && !charge.donnees ? (
        <Erreur message={charge.erreur} reessayer={charge.recharger} />
      ) : !charge.donnees ? (
        <Chargement />
      ) : (
        <section className="carte agenda-carte" style={{ '--marque-agenda': couleurs.seance } as CSSProperties}>
          {vue === 'semaine' ? (
            <GrilleSemaine
              jours={joursAffiches(lundi, parametres.agenda_jours, visibles)}
              rdv={visibles}
              clients={parId}
              couleurs={couleurs}
              heureDebut={parametres.agenda_heure_debut}
              heureFin={parametres.agenda_heure_fin}
              ouvrir={(r) => setEdition({ rdv: r })}
              creer={(j, h) => setEdition({ initial: { jour: j, heure: h } })}
            />
          ) : (
            <ListeJour
              rdv={visibles.filter((r) => jourDe(r.debut) === jour)}
              clients={parId}
              couleurs={couleurs}
              ouvrir={(r) => setEdition({ rdv: r })}
            />
          )}
        </section>
      )}
      <p className="meta">
        Astuce : cliquez sur un créneau libre de la semaine pour y placer un rendez-vous. Les couleurs se règlent dans
        Paramètres &gt; Emploi du temps ; chaque type garde aussi son pictogramme et son nom.
      </p>

      {edition && (
        <DialogueRendezVous
          rdv={edition.rdv}
          initial={edition.initial}
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
    </div>
  );
}
