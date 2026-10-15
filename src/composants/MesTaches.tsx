// « Mes tâches » (onglet Tâches) : ajout d'une tâche personnelle (échéance,
// client et récurrence facultatifs), tâches à venir et faites ces 7 derniers
// jours. Une tâche échue ou sans échéance s'affiche dans « À faire »
// (CartePerso).

import { useState, type FormEvent } from 'react';
import { useNotifier } from './Commun';
import { Icone } from './Icone';
import { donnees } from '../donnees';
import { decalerJour } from '../domaine/agenda';
import { dateLongue, jourLisible, messageErreur } from '../domaine/format';
import type { ClientResume, Recurrence, TachePerso } from '../domaine/types';
import { PuceRecurrence } from './CartesTaches';
import { RECURRENCES } from '../config/taches';

/** Tâches personnelles : ajout, à venir et faites récemment. */
export function MesTaches({
  taches,
  clients,
  aujourdhui,
  cocher,
  supprimer,
  ajoutee,
}: {
  taches: TachePerso[];
  clients: ClientResume[];
  aujourdhui: string;
  cocher: (x: TachePerso, faite: boolean) => void;
  supprimer: (x: TachePerso) => void;
  ajoutee: () => void;
}) {
  const notifier = useNotifier();
  const [titre, setTitre] = useState('');
  const [echeance, setEcheance] = useState('');
  const [clientId, setClientId] = useState('');
  const [recurrence, setRecurrence] = useState<Recurrence>('aucune');
  const [enCours, setEnCours] = useState(false);
  const parId = new Map(clients.map((c) => [c.id, c]));
  const aVenir = taches
    .filter((x) => !x.faite_le && x.echeance && x.echeance > aujourdhui)
    .sort((a, b) => a.echeance!.localeCompare(b.echeance!));
  const semaineDerniere = decalerJour(aujourdhui, -7);
  const faites = taches
    .filter((x) => x.faite_le && x.faite_le.slice(0, 10) >= semaineDerniere)
    .sort((a, b) => b.faite_le!.localeCompare(a.faite_le!));
  const tries = [...clients].sort((a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr'));

  async function ajouter(e: FormEvent) {
    e.preventDefault();
    if (!titre.trim()) return;
    setEnCours(true);
    try {
      await donnees.enregistrerTachePerso(null, {
        titre: titre.trim(),
        echeance: echeance || null,
        client_id: clientId || null,
        recurrence,
      });
      notifier(`« ${titre.trim()} » ajoutée.`);
      setTitre('');
      setEcheance('');
      setClientId('');
      setRecurrence('aucune');
      ajoutee();
    } catch (err) {
      notifier(messageErreur(err), true);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <section className="carte" aria-labelledby="t-miennes">
      <div className="carte-entete">
        <div>
          <h2 id="t-miennes" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Icone nom="crayon" /> Mes tâches
          </h2>
          <p className="aide">
            Vos propres choses à faire (commander des fiches, rappeler un confrère…). Une tâche avec échéance apparaît
            dans « À faire » le jour venu ; sans échéance, elle y reste jusqu'à ce que vous la cochiez.
          </p>
        </div>
      </div>
      <div className="carte-corps" style={{ display: 'grid', gap: 16 }}>
        <form className="ajout-tache" onSubmit={ajouter}>
          <div className="champ" style={{ flex: '2 1 260px' }}>
            <label htmlFor="tp-titre">Nouvelle tâche</label>
            <input
              id="tp-titre"
              value={titre}
              maxLength={200}
              required
              placeholder="Ex. : imprimer les fiches de respiration"
              onChange={(e) => setTitre(e.target.value)}
            />
          </div>
          <div className="champ" style={{ flex: '1 1 150px' }}>
            <label htmlFor="tp-echeance">Échéance (facultatif)</label>
            <input
              id="tp-echeance"
              type="date"
              value={echeance}
              min={aujourdhui}
              onChange={(e) => setEcheance(e.target.value)}
            />
          </div>
          <div className="champ" style={{ flex: '1 1 180px' }}>
            <label htmlFor="tp-client">Client (facultatif)</label>
            <select id="tp-client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Aucun</option>
              {tries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom} {c.prenom}
                </option>
              ))}
            </select>
          </div>
          <div className="champ" style={{ flex: '1 1 150px' }}>
            <label htmlFor="tp-recurrence">Répéter</label>
            <select id="tp-recurrence" value={recurrence} onChange={(e) => setRecurrence(e.target.value as Recurrence)}>
              {(Object.keys(RECURRENCES) as Recurrence[]).map((r) => (
                <option key={r} value={r}>
                  {RECURRENCES[r]}
                </option>
              ))}
            </select>
          </div>
          <button className="bouton bouton-principal" disabled={enCours || !titre.trim()}>
            <Icone nom="plus" taille={16} /> Ajouter
          </button>
        </form>

        {aVenir.length > 0 && (
          <div>
            <h3 className="sous-titre-section">À venir</h3>
            <ul className="liste-miennes">
              {aVenir.map((x) => (
                <LigneMienne
                  key={x.id}
                  tache={x}
                  client={parId.get(x.client_id ?? '')}
                  cocher={cocher}
                  supprimer={supprimer}
                />
              ))}
            </ul>
          </div>
        )}
        {faites.length > 0 && (
          <div>
            <h3 className="sous-titre-section">Faites ces 7 derniers jours</h3>
            <ul className="liste-miennes">
              {faites.map((x) => (
                <LigneMienne
                  key={x.id}
                  tache={x}
                  client={parId.get(x.client_id ?? '')}
                  cocher={cocher}
                  supprimer={supprimer}
                />
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function LigneMienne({
  tache: x,
  client,
  cocher,
  supprimer,
}: {
  tache: TachePerso;
  client?: ClientResume;
  cocher: (x: TachePerso, faite: boolean) => void;
  supprimer: (x: TachePerso) => void;
}) {
  const faite = !!x.faite_le;
  return (
    <li className={faite ? 'mienne-faite' : undefined}>
      <label className="case-a-cocher">
        <input type="checkbox" checked={faite} onChange={() => cocher(x, !faite)} />
        <span>
          <span className="mienne-titre">{x.titre}</span> <PuceRecurrence recurrence={x.recurrence} />
          <span className="meta">
            {client && ` · ${client.prenom} ${client.nom}`}
            {faite ? ` · faite le ${dateLongue(x.faite_le)}` : ` · ${jourLisible(x.echeance)}`}
          </span>
        </span>
      </label>
      <button className="bouton-lien" onClick={() => supprimer(x)} aria-label={`Supprimer « ${x.titre} »`}>
        <Icone nom="corbeille" taille={14} />
      </button>
    </li>
  );
}
