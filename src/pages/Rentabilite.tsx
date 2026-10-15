// Rentabilité (si le suivi des tarifs est actif) : chiffre d'affaires
// indicatif par période, par mois et par client. Aucun paiement géré.

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Chargement, Erreur } from '../composants/Commun';
import { BasculeVue, ColonnesMensuelles } from '../composants/Graphiques';
import { Icone } from '../composants/Icone';
import { donnees } from '../donnees';
import { dateDuJour } from '../domaine/format';
import { calculerRentabilite, euros, type PeriodeRentabilite } from '../domaine/rentabilite';
import { useReglages } from '../etat/reglages';
import { useChargement } from '../etat/useChargement';

const PERIODES: { valeur: PeriodeRentabilite; libelle: string }[] = [
  { valeur: '12mois', libelle: '12 derniers mois' },
  { valeur: 'annee', libelle: 'Année en cours' },
  { valeur: 'tout', libelle: 'Depuis le début' },
];

export function Rentabilite() {
  const { parametres } = useReglages();
  const naviguer = useNavigate();
  const [periode, setPeriode] = useState<PeriodeRentabilite>('12mois');
  const charge = useChargement(
    () => Promise.all([donnees.listerSeancesTarifs(), donnees.listerClients()]),
    [],
    'rentabilite',
  );

  if (!parametres.tarifs_actifs)
    return (
      <div className="page page-etroite">
        <div className="carte vide">
          <Icone nom="euro" taille={28} />
          <p>Le suivi des tarifs est désactivé.</p>
          <Link to="/parametres?onglet=tarifs" className="bouton bouton-principal">
            L'activer dans les paramètres
          </Link>
        </div>
      </div>
    );
  if (charge.chargement && !charge.donnees) return <Chargement />;
  if (charge.erreur) return <Erreur message={charge.erreur} reessayer={charge.recharger} />;

  const [seances, clients] = charge.donnees!;
  const r = calculerRentabilite(seances, clients, periode, dateDuJour());

  return (
    <div className="page">
      <div className="entete-page">
        <div>
          <h1>Rentabilité</h1>
          <p className="sous-titre">
            Calculée à partir du tarif (facultatif) de chaque séance. Indicatif : aucun paiement n'est géré ici.
          </p>
        </div>
        <BasculeVue libelle="Période" valeur={periode} changer={setPeriode} options={PERIODES} />
      </div>

      <section className="indicateurs" aria-label="Indicateurs de rentabilité">
        <div className="carte indicateur indicateur-vedette">
          <div className="indicateur-libelle">Chiffre d'affaires</div>
          <div className="indicateur-valeur">{euros(r.ca_total)}</div>
          <div className="indicateur-detail">{PERIODES.find((p) => p.valeur === periode)!.libelle.toLowerCase()}</div>
        </div>
        <div className="carte indicateur">
          <div className="indicateur-libelle">Séances</div>
          <div className="indicateur-valeur">{r.nb_seances}</div>
          <div className="indicateur-detail">
            {r.nb_seances_sans_tarif > 0 ? `dont ${r.nb_seances_sans_tarif} sans tarif` : 'toutes tarifées'}
          </div>
        </div>
        <div className="carte indicateur">
          <div className="indicateur-libelle">Prix moyen d'une séance</div>
          <div className="indicateur-valeur">{euros(r.prix_moyen, 2)}</div>
          <div className="indicateur-detail">
            tarif par défaut : {parametres.prix_defaut === null ? 'non défini' : euros(parametres.prix_defaut, 2)}
          </div>
        </div>
        <div className="carte indicateur">
          <div className="indicateur-libelle">Par client</div>
          <div className="indicateur-valeur">{euros(r.ca_moyen_par_client)}</div>
          <div className="indicateur-detail">en moyenne, sur {r.nb_clients} clients</div>
        </div>
      </section>

      <div className="grille-tableau-bord">
        <section className="carte" aria-labelledby="t-ca-mois">
          <div className="carte-entete">
            <div>
              <h2 id="t-ca-mois">Chiffre d'affaires par mois</h2>
              <p className="aide">Les 12 derniers mois</p>
            </div>
          </div>
          <div className="carte-corps">
            <ColonnesMensuelles
              titre="Chiffre d'affaires par mois"
              donnees={r.par_mois.map((m) => ({ mois: m.mois, valeur: m.ca }))}
              formater={(v) => euros(v)}
            />
          </div>
        </section>

        <section className="carte" aria-labelledby="t-ca-client">
          <div className="carte-entete">
            <div>
              <h2 id="t-ca-client">Par client</h2>
              <p className="aide">Sur la période choisie, du plus au moins important</p>
            </div>
          </div>
          <div className="carte-corps" style={{ paddingTop: 6 }}>
            {r.par_client.length === 0 ? (
              <p className="meta">Aucune séance sur cette période.</p>
            ) : (
              <div className="tableau-conteneur" style={{ maxHeight: 420 }}>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Client</th>
                      <th scope="col" className="num">
                        Séances
                      </th>
                      <th scope="col" className="num">
                        Montant
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.par_client.map((l) => (
                      <tr
                        key={l.client.id}
                        className="ligne-cliquable"
                        onClick={() => naviguer(`/clients/${l.client.id}`)}
                      >
                        <td className="nom-client">
                          {l.client.nom.toUpperCase()} {l.client.prenom}
                        </td>
                        <td className="num">{l.nb_seances}</td>
                        <td className="num">{euros(l.ca)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
