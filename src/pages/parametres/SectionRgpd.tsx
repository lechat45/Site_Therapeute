// Paramètres › Confidentialité : « Données personnelles (RGPD) », 0.13.0.
//  - télécharger toutes ses données (portabilité ; fichier JSON créé dans le navigateur) ;
//  - fiches au-delà de la durée de conservation (config/rgpd.ts), à mettre à la corbeille ;
//  - lien vers la politique de confidentialité et docs/RGPD.md pour l'éditeur.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { telecharger, useNotifier } from '../../composants/Commun';
import { Icone } from '../../composants/Icone';
import { DUREE_CONSERVATION_ANS } from '../../config/rgpd';
import { donnees } from '../../donnees';
import { dateCourte, dateDuJour, messageErreur } from '../../domaine/format';
import { exportComplet, fichesARevoir, type DonneesClient } from '../../domaine/rgpd';
import { useTherapeute } from '../../etat/session';
import { useChargement } from '../../etat/useChargement';

export function SectionRgpd() {
  const t = useTherapeute();
  const notifier = useNotifier();
  const [export_, setExport] = useState(false);
  const liste = useChargement(() => donnees.listerClients(), []);
  const aRevoir = liste.donnees ? fichesARevoir(liste.donnees, dateDuJour(), DUREE_CONSERVATION_ANS) : [];

  async function exporterTout() {
    setExport(true);
    try {
      const [parametres, questionnaires, actifs, corbeille, envois, rendezVous, notes, remises, recus] =
        await Promise.all([
          donnees.parametres(),
          donnees.questionnaires(),
          donnees.listerClients(),
          donnees.listerCorbeille(),
          donnees.listerEnvois(),
          donnees.listerRendezVous('1970-01-01T00:00:00.000Z', '2100-01-01T00:00:00.000Z'),
          donnees.notes(),
          donnees.listerRemises(),
          donnees.listerRecus(),
        ]);
      const [ressources, tachesPerso, connexions] = await Promise.all([
        donnees.ressources(),
        donnees.tachesPerso(),
        donnees.journalConnexions(),
      ]);
      const clients: DonneesClient[] = [];
      for (const resume of [...actifs, ...corbeille]) {
        const [client, seances, problematiques] = await Promise.all([
          donnees.lireClient(resume.id),
          donnees.listerSeances(resume.id),
          donnees.listerProblematiquesClient(resume.id),
        ]);
        clients.push({ client, seances, problematiques, envois, rendezVous, notes, remises, recus });
      }
      const contenu = exportComplet(
        {
          therapeute: { prenom: t.prenom, nom: t.nom, email: t.email },
          parametres,
          questionnaires,
          clients,
          notes,
          rendezVous,
          ressources,
          tachesPerso,
          connexions,
        },
        new Date().toISOString(),
      );
      telecharger(
        `mes-donnees-${dateDuJour()}.json`,
        JSON.stringify(contenu, null, 2),
        'application/json;charset=utf-8',
      );
      notifier(`Export prêt : ${clients.length} fiches. Gardez ce fichier en lieu sûr (données de santé).`);
    } catch (e) {
      notifier(messageErreur(e), true);
    } finally {
      setExport(false);
    }
  }

  async function corbeille(id: string, nom: string) {
    try {
      await donnees.supprimerClient(id);
      notifier(`Fiche de ${nom} mise à la corbeille (effacée définitivement dans 30 jours).`);
      liste.recharger();
    } catch (e) {
      notifier(messageErreur(e), true);
    }
  }

  return (
    <section className="carte" aria-labelledby="t-rgpd">
      <div className="carte-entete">
        <div>
          <h2 id="t-rgpd" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Icone nom="cle" /> Données personnelles (RGPD)
          </h2>
          <p className="aide">
            Vous êtes responsable des données de vos clients ; l’application vous donne les outils pour respecter leurs
            droits. <Link to="/confidentialite">Politique de confidentialité</Link>
          </p>
        </div>
      </div>
      <div className="carte-corps" style={{ display: 'grid', gap: 20 }}>
        <div className="rgpd-bloc">
          <h3>Pour chaque client</h3>
          <ul className="liste-points">
            <li>
              <strong>Consentement</strong> : notez-le sur sa fiche (Vue d’ensemble › Données personnelles) ; une alerte
              le rappelle tant qu’il manque.
            </li>
            <li>
              <strong>Accès et portabilité</strong> : « Exporter ses données » sur sa fiche (fichier complet et
              lisible).
            </li>
            <li>
              <strong>Rectification</strong> : « Modifier » ; <strong>effacement</strong> : « Supprimer » (corbeille 30
              jours, ou effacement immédiat depuis la corbeille).
            </li>
          </ul>
        </div>

        <div className="rgpd-bloc">
          <h3>Toutes vos données</h3>
          <p className="meta">
            Compte, réglages, questionnaires, toutes les fiches (corbeille comprise), notes, agenda, bibliothèque,
            tâches et journal des connexions, dans un seul fichier.
          </p>
          <div>
            <button className="bouton" onClick={exporterTout} disabled={export_}>
              <Icone nom="enregistrer" taille={16} /> {export_ ? 'Préparation…' : 'Télécharger toutes mes données'}
            </button>
          </div>
        </div>

        <div className="rgpd-bloc">
          <h3>Durée de conservation</h3>
          <p className="meta">
            Une fiche est conservée {DUREE_CONSERVATION_ANS} ans après la dernière séance (ou sa création), puis
            proposée ici à l’effacement. Rien n’est effacé sans votre accord.
          </p>
          {liste.chargement && !liste.donnees ? (
            <p className="meta">Recherche…</p>
          ) : aRevoir.length === 0 ? (
            <p className="consentement">
              <span className="puce puce-succes">
                <Icone nom="valider" taille={12} /> Aucune fiche à revoir
              </span>
            </p>
          ) : (
            <ul className="liste-a-revoir">
              {aRevoir.map((c) => (
                <li key={c.id}>
                  <Link to={`/clients/${c.id}`}>
                    {c.prenom} {c.nom}
                  </Link>
                  <span className="meta">
                    {c.derniere_seance
                      ? `dernière séance le ${dateCourte(c.derniere_seance)}`
                      : `fiche créée le ${dateCourte(c.cree_le)}`}
                  </span>
                  <button
                    className="bouton bouton-petit bouton-danger"
                    onClick={() => corbeille(c.id, `${c.prenom} ${c.nom}`)}
                  >
                    <Icone nom="corbeille" taille={14} /> Mettre à la corbeille
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
