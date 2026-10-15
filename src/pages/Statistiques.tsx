// Tableau de bord personnel (page d'accueil) et espace de groupe anonymisé :
// même vue, deux périmètres. Le groupe ne reçoit que des agrégats soumis aux
// seuils d'anonymat (calculés en SQL par statistiques()).

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Chargement, Erreur } from '../composants/Commun';
import {
  BarresHorizontales,
  BasculeVue,
  CarteThermique,
  ColonnesMensuelles,
  TopParTranche,
} from '../composants/Graphiques';
import { Icone } from '../composants/Icone';
import { donnees } from '../donnees';
import { nombre, pourcentage } from '../domaine/format';
import { resumeDuJour } from '../domaine/taches';
import { useTaches } from '../etat/tachesContexte';
import type { PeriodeStatistiques, Perimetre, StatistiquesDisponibles } from '../domaine/types';
import { useChargement } from '../etat/useChargement';

/** Période choisie, gardée le temps de l'onglet. */
const CLE_PERIODE = 'suivi-therapeutique:periode-tableau-de-bord';

const PERIODES: { valeur: PeriodeStatistiques; libelle: string }[] = [
  { valeur: '3mois', libelle: '3 derniers mois' },
  { valeur: '12mois', libelle: '12 derniers mois' },
  { valeur: 'tout', libelle: 'Depuis le début' },
];

/** Vue commune à l'espace individuel et à l'espace de groupe (toujours « depuis le début »). */
export function VueStatistiques({
  perimetre,
  periode = 'tout',
}: {
  perimetre: Perimetre;
  periode?: PeriodeStatistiques;
}) {
  const stats = useChargement(
    () => donnees.statistiques(perimetre, periode),
    [perimetre, periode],
    `statistiques:${perimetre}:${periode}`,
  );

  if (stats.chargement && !stats.donnees) return <Chargement texte="Calcul des statistiques…" />;
  if (stats.erreur) return <Erreur message={stats.erreur} reessayer={stats.recharger} />;
  const s = stats.donnees!;

  if (!s.disponible)
    return (
      <div className="carte">
        <div className="vide">
          <Icone nom="cadenas" taille={28} />
          <h2 style={{ color: 'var(--encre)' }}>L'espace de groupe n'est pas encore ouvert</h2>
          <p style={{ maxWidth: '52ch' }}>
            Pour garantir l'anonymat, les statistiques partagées ne sont publiées qu'à partir de {s.seuils.therapeutes}{' '}
            thérapeutes ayant enregistré des séances (actuellement : {s.kpis.nb_therapeutes}).
          </p>
        </div>
      </div>
    );

  if (s.kpis.nb_seances === 0 && periode !== 'tout')
    return (
      <div className="carte">
        <div className="vide">
          <Icone nom="horloge" taille={28} />
          <h2 style={{ color: 'var(--encre)' }}>Aucune séance sur cette période</h2>
          <p>Choisissez une période plus longue pour voir vos indicateurs.</p>
        </div>
      </div>
    );

  if (s.kpis.nb_seances === 0)
    return (
      <div className="carte">
        <div className="vide">
          <Icone nom="tableau" taille={28} />
          <h2 style={{ color: 'var(--encre)' }}>Pas encore de statistiques</h2>
          <p>Vos indicateurs apparaîtront dès la première séance enregistrée.</p>
          <Link to="/clients" className="bouton bouton-principal">
            <Icone nom="plus" /> Ajouter un client
          </Link>
        </div>
      </div>
    );

  return (
    <>
      {perimetre === 'groupe' && <BandeauGroupe s={s} />}
      <Indicateurs s={s} />
      <div className="grille-tableau-bord">
        <CarteEmotions s={s} />
        <div className="colonne">
          <CarteProblematiques s={s} />
          <CarteMois s={s} />
        </div>
        <CarteTranches s={s} />
      </div>
    </>
  );
}

function BandeauGroupe({ s }: { s: StatistiquesDisponibles }) {
  return (
    <div className="bandeau-groupe">
      <div className="bloc">
        <Icone nom="groupe" taille={20} />
        <span>
          <strong>{s.kpis.nb_therapeutes} thérapeutes</strong> contribuent · {s.kpis.nb_clients} clients anonymisés
        </span>
      </div>
      <div className="bloc">
        <Icone nom="bouclier" taille={20} />
        <span>
          Aucun nom, aucune note : uniquement des agrégats. Une case n'est publiée que si au moins{' '}
          <strong>{s.seuils.clients} clients d'autres thérapeutes</strong> y contribuent.
        </span>
      </div>
    </div>
  );
}

function Indicateurs({ s }: { s: StatistiquesDisponibles }) {
  const k = s.kpis;
  const jours = k.duree_moyenne_suivi_jours;
  return (
    <section className="indicateurs" aria-label="Indicateurs clés">
      <div className="carte indicateur indicateur-vedette">
        <div className="indicateur-libelle">Séances par client (moyenne)</div>
        <div className="indicateur-valeur">
          {nombre(k.moyenne_seances_par_client)}
          <small>séances</small>
        </div>
        <div className="indicateur-detail">
          {k.nb_seances} séances pour {k.nb_clients} clients
        </div>
      </div>
      <div className="carte indicateur">
        <div className="indicateur-libelle">Clients suivis</div>
        <div className="indicateur-valeur">{k.nb_clients}</div>
        <div className="indicateur-detail">ayant au moins une séance</div>
      </div>
      <div className="carte indicateur">
        <div className="indicateur-libelle">Durée moyenne de suivi</div>
        <div className="indicateur-valeur">
          {jours === null ? '—' : nombre(jours / 7)}
          <small>semaines</small>
        </div>
        <div className="indicateur-detail">de la première à la dernière séance</div>
      </div>
      <div className="carte indicateur">
        <div className="indicateur-libelle">Parcours menés jusqu'au bilan</div>
        <div className="indicateur-valeur">{pourcentage(k.part_clients_bilan)}</div>
        <div className="indicateur-detail">des clients ont atteint la 4e séance</div>
      </div>
    </section>
  );
}

function CarteEmotions({ s }: { s: StatistiquesDisponibles }) {
  const [tri, setTri] = useState<'frequence' | 'liste'>('frequence');
  const lignes = [...s.emotions]
    .sort((a, b) =>
      tri === 'liste' ? 0 : Number(a.masque) - Number(b.masque) || (b.part_seances ?? 0) - (a.part_seances ?? 0),
    )
    .map((e) => ({
      cle: e.emotion_id,
      libelle: e.libelle,
      valeur: e.masque ? null : e.part_seances,
      texte: pourcentage(e.part_seances),
      detail: `${nombre(e.moyenne_par_client, 2)} / client`,
      infobulle: e.masque
        ? `${e.libelle} : masqué (effectif insuffisant)`
        : `${e.libelle} : présente dans ${pourcentage(e.part_seances)} des séances, ${e.occurrences} apparitions, soit ${nombre(e.moyenne_par_client, 2)} par client en moyenne`,
    }));
  return (
    <section className="carte" aria-labelledby="titre-emotions">
      <div className="carte-entete">
        <div>
          <h2 id="titre-emotions">Apparition des 14 émotions clés</h2>
          <p className="aide">
            Part des séances où l'émotion figure au temps présent · moyenne d'apparitions par client
          </p>
        </div>
        <BasculeVue
          libelle="Ordre des émotions"
          valeur={tri}
          changer={setTri}
          options={[
            { valeur: 'frequence', libelle: 'Par fréquence' },
            { valeur: 'liste', libelle: 'Ordre de la liste' },
          ]}
        />
      </div>
      <div className="carte-corps">
        <BarresHorizontales
          titre="Apparition des émotions"
          lignes={lignes}
          max={Math.max(...lignes.map((l) => l.valeur ?? 0))}
        />
      </div>
    </section>
  );
}

function CarteProblematiques({ s }: { s: StatistiquesDisponibles }) {
  const [tout, setTout] = useState(false);
  const presentes = s.problematiques.filter((p) => p.masque || (p.nb_clients ?? 0) > 0);
  const lignes = presentes.slice(0, tout ? undefined : 8).map((p) => ({
    cle: p.problematique_id,
    libelle: p.libelle,
    valeur: p.masque ? null : p.part_clients,
    texte: pourcentage(p.part_clients),
    detail: `${p.nb_clients} client${p.nb_clients === 1 ? '' : 's'}`,
    infobulle: p.masque
      ? `${p.libelle} : masqué (effectif insuffisant)`
      : `${p.libelle} : ${p.nb_clients} clients, soit ${pourcentage(p.part_clients)} des clients suivis`,
  }));
  return (
    <section className="carte" aria-labelledby="titre-problematiques">
      <div className="carte-entete">
        <div>
          <h2 id="titre-problematiques">Problématiques les plus fréquentes</h2>
          <p className="aide">Motifs de consultation retenus sur les fiches · part des clients</p>
        </div>
      </div>
      <div className="carte-corps">
        {lignes.length ? (
          <BarresHorizontales
            titre="Problématiques"
            lignes={lignes}
            max={Math.max(...lignes.map((l) => l.valeur ?? 0))}
          />
        ) : (
          <p className="meta">Aucune problématique renseignée pour l'instant.</p>
        )}
        {presentes.length > 8 && (
          <button className="bouton-lien" style={{ marginTop: 10 }} onClick={() => setTout(!tout)}>
            {tout ? 'Afficher les 8 premières' : `Afficher les ${presentes.length} problématiques`}
          </button>
        )}
      </div>
    </section>
  );
}

function CarteMois({ s }: { s: StatistiquesDisponibles }) {
  return (
    <section className="carte" aria-labelledby="titre-mois">
      <div className="carte-entete">
        <div>
          <h2 id="titre-mois">Séances par mois</h2>
          <p className="aide">Les 12 derniers mois</p>
        </div>
      </div>
      <div className="carte-corps">
        <ColonnesMensuelles
          titre="Séances par mois"
          donnees={s.par_mois.map((m) => ({ mois: m.mois, valeur: m.nb_seances }))}
          formater={(v) => `${v} séance${v > 1 ? 's' : ''}`}
        />
      </div>
    </section>
  );
}

function BandeauTaches() {
  const { taches, aujourdhui } = useTaches();
  if (!taches.length && !aujourdhui.length) return null;
  return (
    <Link to="/taches" className="bandeau-taches">
      <Icone nom="cloche" />
      <span>{resumeDuJour(taches, aujourdhui.length)}</span>
      <span className="bandeau-taches-lien">Voir les tâches →</span>
    </Link>
  );
}

function CarteTranches({ s }: { s: StatistiquesDisponibles }) {
  const [vue, setVue] = useState<'top' | 'thermique'>('top');
  return (
    <section className="carte pleine-largeur" aria-labelledby="titre-tranches">
      <div className="carte-entete">
        <div>
          <h2 id="titre-tranches">Émotions les plus ressenties par tranche d'âge</h2>
          <p className="aide">Âge au moment de la séance · part des séances de la tranche où l'émotion apparaît</p>
        </div>
        <BasculeVue
          libelle="Présentation"
          valeur={vue}
          changer={setVue}
          options={[
            { valeur: 'top', libelle: 'Les 3 premières' },
            { valeur: 'thermique', libelle: 'Tableau complet' },
          ]}
        />
      </div>
      <div className="carte-corps">
        {vue === 'top' ? (
          <TopParTranche tranches={s.tranches} seuil={s.seuils.clients} />
        ) : (
          <CarteThermique tranches={s.tranches} />
        )}
      </div>
    </section>
  );
}

export function TableauDeBord() {
  const [periode, setPeriode] = useState<PeriodeStatistiques>(() => {
    try {
      const p = sessionStorage.getItem(CLE_PERIODE);
      return PERIODES.some((x) => x.valeur === p) ? (p as PeriodeStatistiques) : 'tout';
    } catch {
      return 'tout';
    }
  });
  const choisir = (p: PeriodeStatistiques) => {
    setPeriode(p);
    try {
      sessionStorage.setItem(CLE_PERIODE, p);
    } catch {
      /* stockage indisponible */
    }
  };
  return (
    <div className="page">
      <div className="entete-page">
        <div>
          <h1>Mon tableau de bord</h1>
          <p className="sous-titre">Statistiques calculées sur vos seuls clients. Personne d'autre n'y a accès.</p>
        </div>
        <div className="actions">
          <BasculeVue libelle="Période" valeur={periode} changer={choisir} options={PERIODES} />
          <Link to="/clients" className="bouton">
            <Icone nom="clients" /> Mes clients
          </Link>
        </div>
      </div>
      <BandeauTaches />
      <VueStatistiques perimetre="personnel" periode={periode} />
    </div>
  );
}

export function EspaceGroupe() {
  return (
    <div className="page">
      <div className="entete-page">
        <div>
          <h1>Espace de groupe</h1>
          <p className="sous-titre">
            Les mêmes indicateurs, agrégés anonymement sur l'ensemble des thérapeutes de la plateforme.
          </p>
        </div>
      </div>
      <VueStatistiques perimetre="groupe" />
    </div>
  );
}
