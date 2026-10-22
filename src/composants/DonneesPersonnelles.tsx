// Fiche client › Vue d'ensemble : « Données personnelles » (RGPD, 0.13.0).
//  - consentement du client au traitement de ses données (données de santé, art. 9) :
//    date notée ou alerte « à recueillir » ;
//  - export de toutes ses données (droit d'accès et de portabilité) : fichier JSON créé
//    dans le navigateur (domaine/rgpd.ts), rien ne passe par un serveur ;
//  - rappel : rectifier = « Modifier », effacer = « Supprimer » (corbeille, puis définitif).

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { donnees } from '../donnees';
import { dateCourte, dateDuJour, messageErreur } from '../domaine/format';
import { exportClient, nomFichierExport } from '../domaine/rgpd';
import type { Client, ClientProblematique, Envoi, Seance } from '../domaine/types';
import { telecharger, useNotifier } from './Commun';
import { Icone } from './Icone';

export function DonneesPersonnelles({
  client,
  seances,
  problematiques,
  envois,
  recharger,
}: {
  client: Client;
  seances: Seance[];
  problematiques: ClientProblematique[];
  envois: Envoi[];
  recharger: () => void;
}) {
  const notifier = useNotifier();
  const [export_, setExport] = useState(false);

  async function noterConsentement(oui: boolean) {
    try {
      await donnees.modifierClient(client.id, { consentement_le: oui ? dateDuJour() : null });
      notifier(
        oui
          ? `Consentement de ${client.prenom} ${client.nom} noté à la date du jour.`
          : 'Consentement retiré : la fiche ne doit plus être utilisée ; pensez à la supprimer si le client le demande.',
      );
      recharger();
    } catch (e) {
      notifier(messageErreur(e), true);
    }
  }

  async function exporter() {
    setExport(true);
    try {
      const [rendezVous, notes, remises, recus] = await Promise.all([
        donnees.listerRendezVous('1970-01-01T00:00:00.000Z', '2100-01-01T00:00:00.000Z'),
        donnees.notes(),
        donnees.listerRemises(client.id),
        donnees.listerRecus(),
      ]);
      const jour = dateDuJour();
      const contenu = exportClient(
        { client, seances, problematiques, envois, rendezVous, notes, remises, recus },
        new Date().toISOString(),
      );
      telecharger(
        nomFichierExport(client.prenom, client.nom, jour),
        JSON.stringify(contenu, null, 2),
        'application/json;charset=utf-8',
      );
      notifier('Export prêt : remettez le fichier au client par un moyen sûr.');
    } catch (e) {
      notifier(messageErreur(e), true);
    } finally {
      setExport(false);
    }
  }

  return (
    <section className="carte" aria-labelledby="titre-rgpd">
      <div className="carte-entete">
        <div>
          <h2 id="titre-rgpd" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Icone nom="bouclier" /> Données personnelles
          </h2>
          <p className="aide">
            Ses droits (RGPD) : accès, rectification, effacement, portabilité, retrait du consentement.{' '}
            <Link to="/confidentialite">Politique de confidentialité</Link>
          </p>
        </div>
      </div>
      <div className="carte-corps" style={{ display: 'grid', gap: 12 }}>
        {client.consentement_le ? (
          <p className="consentement consentement-ok">
            <span className="puce puce-succes">
              <Icone nom="valider" taille={12} /> Consentement noté
            </span>{' '}
            le {dateCourte(client.consentement_le)}.{' '}
            <button className="bouton-lien" onClick={() => noterConsentement(false)}>
              Le client le retire
            </button>
          </p>
        ) : (
          <div className="alerte" role="status">
            <Icone nom="info" />
            <span>
              <strong>Consentement à recueillir.</strong> Ses notes de séance sont des données de santé : faites-lui
              signer votre formulaire de consentement, puis notez-le ici.{' '}
              <button className="bouton bouton-petit" onClick={() => noterConsentement(true)}>
                <Icone nom="valider" taille={14} /> Noter le consentement (aujourd’hui)
              </button>
            </span>
          </div>
        )}
        <div className="actions">
          <button className="bouton bouton-petit" onClick={exporter} disabled={export_}>
            <Icone nom="enregistrer" taille={15} /> {export_ ? 'Préparation…' : 'Exporter ses données'}
          </button>
          <span className="meta">Fichier lisible (JSON) : tout ce que la fiche contient.</span>
        </div>
      </div>
    </section>
  );
}
