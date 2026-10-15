// Reçus (notes d'honoraires) : émis à partir d'une séance tarifée,
// numérotés par année sans trou ni doublon, jamais effacés (annulés avec
// un motif). Version à imprimer ou à enregistrer en PDF. Aucun paiement
// en ligne : le reçu atteste un règlement déjà fait.

import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Chargement, Dialogue, Erreur, useNotifier } from '../composants/Commun';
import { DialogueLienRecu } from '../composants/DialogueLienRecu';
import { FeuilleRecu } from '../composants/FeuilleRecu';
import { Icone } from '../composants/Icone';
import { MODES_REGLEMENT } from '../config/ressources';
import { donnees } from '../donnees';
import { dateCourte, dateDuJour, dateLongue, messageErreur } from '../domaine/format';
import { csvLivreRecettes, csvRecus, recapAnnuel, totauxTrimestres } from '../domaine/recus';
import { euros } from '../domaine/rentabilite';
import { numeroRecu } from '../domaine/texte';
import type { ClientResume, ModeReglement, Recu, SeanceTarif } from '../domaine/types';
import { useReglages } from '../etat/reglages';
import { useTaches } from '../etat/tachesContexte';
import { useChargement } from '../etat/useChargement';

/** Séances sans reçu proposées par défaut (les plus récentes). */
const SANS_RECU_COURT = 8;

const MOIS = Array.from({ length: 12 }, (_, i) => new Date(2026, i, 15).toLocaleDateString('fr-FR', { month: 'long' }));

/** Fichier créé dans le navigateur (rien ne passe par un serveur). */
function telecharger(nom: string, contenu: string, type: string) {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Recus() {
  const { parametres: p } = useReglages();
  const { clients } = useTaches();
  const naviguer = useNavigate();
  const charge = useChargement(() => Promise.all([donnees.listerRecus(), donnees.listerSeancesTarifs()]), [], 'recus');
  const [annee, setAnnee] = useState(Number(dateDuJour().slice(0, 4)));
  const [aEmettre, setAEmettre] = useState<SeanceTarif[] | null>(null);
  /** Séances cochées pour un reçu groupé (un seul client). */
  const [selection, setSelection] = useState<string[]>([]);
  const [annulation, setAnnulation] = useState<Recu | null>(null);
  const [envoi, setEnvoi] = useState<Recu | null>(null);
  const [toutes, setToutes] = useState(false);

  if (!p.tarifs_actifs)
    return (
      <div className="page page-etroite">
        <div className="carte vide">
          <Icone nom="recu" taille={28} />
          <p>Les reçus s'appuient sur le tarif des séances : activez d'abord le suivi des tarifs.</p>
          <Link to="/parametres?onglet=tarifs" className="bouton bouton-principal">
            L'activer dans les paramètres
          </Link>
        </div>
      </div>
    );
  if (charge.chargement && !charge.donnees) return <Chargement />;
  if (charge.erreur && !charge.donnees) return <Erreur message={charge.erreur} reessayer={charge.recharger} />;

  const [recus, seances] = charge.donnees!;
  const parId = new Map(clients.map((c) => [c.id, c]));
  const avecRecu = new Set(recus.filter((r) => !r.annule_le).flatMap((r) => r.lignes.map((l) => l.seance_id)));
  const sansRecu = seances
    .filter((s) => s.prix !== null && !avecRecu.has(s.id) && parId.has(s.client_id))
    .sort((a, b) => b.date_seance.localeCompare(a.date_seance));
  const annees = [...new Set([annee, ...recus.map((r) => r.annee)])].sort((a, b) => b - a);
  const del = recus.filter((r) => r.annee === annee).sort((a, b) => b.numero - a.numero);
  const recap = recapAnnuel(recus, annee);
  const trimestres = totauxTrimestres(recus).filter((t) => t.annee === annee);
  const choisies = sansRecu.filter((s) => selection.includes(s.id));
  const clientChoisi = choisies[0]?.client_id ?? null;
  const basculer = (id: string) => setSelection((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));

  return (
    <div className="page">
      <div className="entete-page">
        <div>
          <h1>Reçus</h1>
          <p className="sous-titre">
            Notes d'honoraires à remettre au client (mutuelle, justificatif). Numérotées automatiquement ; un reçu ne
            s'efface pas, il s'annule. Aucun paiement n'est géré ici.
          </p>
        </div>
      </div>

      {!p.adresse_pro.trim() && (
        <div className="alerte">
          <Icone nom="info" />
          <span>
            Votre adresse professionnelle n'est pas renseignée : elle doit figurer sur les reçus.{' '}
            <Link to="/parametres?onglet=profil">Compléter mon profil</Link> (adresse, SIRET, mention).
          </span>
        </div>
      )}

      <section className="carte" aria-labelledby="r-sans">
        <div className="carte-entete">
          <div>
            <h2 id="r-sans">Séances sans reçu</h2>
            <p className="aide">
              Séances tarifées des clients actifs, les plus récentes d'abord. Émettez un reçu quand le client le demande
              ; cochez plusieurs séances d'un même client pour un seul reçu groupé.
            </p>
          </div>
        </div>
        {choisies.length > 0 && (
          <div className="barre-selection" role="status">
            <span>
              <Icone nom="valider" taille={14} /> {choisies.length} séance{choisies.length > 1 ? 's' : ''} de{' '}
              <strong>
                {parId.get(clientChoisi!)?.prenom} {parId.get(clientChoisi!)?.nom}
              </strong>{' '}
              · {euros(choisies.reduce((t, x) => t + Math.round((x.prix ?? 0) * 100), 0) / 100, 2)}
              {choisies.length === 1 && (
                <span className="meta"> · cochez au moins une autre séance de ce client (les autres sont grisées)</span>
              )}
            </span>
            <div className="actions">
              <button className="bouton bouton-petit" onClick={() => setSelection([])}>
                Tout décocher
              </button>
              <button
                className="bouton bouton-petit bouton-principal"
                disabled={choisies.length < 2}
                onClick={() => setAEmettre(choisies)}
              >
                <Icone nom="recu" taille={14} /> Émettre un reçu groupé
              </button>
            </div>
          </div>
        )}
        <div className="carte-corps" style={{ paddingTop: 8 }}>
          {sansRecu.length === 0 ? (
            <p className="meta">Toutes les séances tarifées ont leur reçu.</p>
          ) : (
            <>
              <ul className="liste-a-emettre">
                {(toutes ? sansRecu : sansRecu.slice(0, SANS_RECU_COURT)).map((s) => {
                  const c = parId.get(s.client_id)!;
                  const autreClient = clientChoisi !== null && clientChoisi !== s.client_id;
                  return (
                    <li key={s.id}>
                      <label
                        className="case-a-cocher"
                        title={autreClient ? 'Un reçu groupé concerne un seul client' : undefined}
                      >
                        <input
                          type="checkbox"
                          checked={selection.includes(s.id)}
                          disabled={autreClient}
                          onChange={() => basculer(s.id)}
                          aria-label={`Ajouter la séance du ${dateLongue(s.date_seance)} de ${c.prenom} ${c.nom} au reçu groupé`}
                        />
                        <span>
                          <strong>
                            {c.prenom} {c.nom}
                          </strong>
                          <span className="meta">
                            {' '}
                            · séance du {dateLongue(s.date_seance)} · {euros(s.prix, 2)}
                          </span>
                        </span>
                      </label>
                      <button className="bouton bouton-petit" onClick={() => setAEmettre([s])}>
                        <Icone nom="recu" taille={14} /> Émettre un reçu
                      </button>
                    </li>
                  );
                })}
              </ul>
              {sansRecu.length > SANS_RECU_COURT && (
                <button className="bouton-lien" style={{ marginTop: 10 }} onClick={() => setToutes((x) => !x)}>
                  {toutes ? 'Afficher moins' : `Tout afficher (${sansRecu.length} séances)`}
                </button>
              )}
            </>
          )}
        </div>
      </section>

      <section className="carte" aria-labelledby="r-emis">
        <div className="carte-entete">
          <div>
            <h2 id="r-emis">Reçus émis en {annee}</h2>
            <p className="aide">
              {recap.nb} reçu{recap.nb > 1 ? 's' : ''} valide{recap.nb > 1 ? 's' : ''} · total{' '}
              <strong>{euros(recap.total, 2)}</strong>
              {recap.nbAnnules > 0 && ` · ${recap.nbAnnules} annulé${recap.nbAnnules > 1 ? 's' : ''}`}
            </p>
          </div>
          {annees.length > 1 && (
            <select
              aria-label="Année"
              value={annee}
              onChange={(e) => setAnnee(Number(e.target.value))}
              style={{ width: 'auto' }}
            >
              {annees.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="carte-corps" style={{ paddingTop: 8 }}>
          {del.length === 0 ? (
            <p className="meta">Aucun reçu émis en {annee}.</p>
          ) : (
            <div className="tableau-conteneur">
              <table>
                <thead>
                  <tr>
                    <th scope="col">N°</th>
                    <th scope="col">Émis le</th>
                    <th scope="col">Client</th>
                    <th scope="col">Séance du</th>
                    <th scope="col" className="num">
                      Montant
                    </th>
                    <th scope="col">Règlement</th>
                    <th scope="col">État</th>
                    <th scope="col">
                      <span className="visuellement-cache">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {del.map((r) => (
                    <tr key={r.id} className={r.annule_le ? 'recu-annule' : undefined}>
                      <td className="nom-client">{numeroRecu(r)}</td>
                      <td>{dateCourte(r.date_emission)}</td>
                      <td>{r.client_nom}</td>
                      <td
                        title={
                          r.lignes.length > 1 ? r.lignes.map((l) => dateCourte(l.date_seance)).join(', ') : undefined
                        }
                      >
                        {r.lignes.length > 1 ? `${r.lignes.length} séances` : dateCourte(r.date_seance)}
                      </td>
                      <td className="num">{euros(r.montant, 2)}</td>
                      <td>{MODES_REGLEMENT[r.mode_reglement]}</td>
                      <td>
                        {r.annule_le ? (
                          <span className="puce puce-danger" title={r.motif_annulation}>
                            <Icone nom="croix" taille={12} /> Annulé
                          </span>
                        ) : (
                          <span className="puce puce-succes">
                            <Icone nom="valider" taille={12} /> Valide
                          </span>
                        )}
                        {!r.annule_le && r.lien_expire_le && (
                          <div className="meta recu-lien">
                            <Icone nom="lien" taille={12} />
                            {r.lien_ouvert_le
                              ? `lien ouvert le ${dateCourte(r.lien_ouvert_le)}`
                              : r.lien_expire_le < new Date().toISOString()
                                ? 'lien expiré'
                                : 'lien envoyé, pas encore ouvert'}
                          </div>
                        )}
                      </td>
                      <td className="num" style={{ whiteSpace: 'nowrap' }}>
                        <Link className="bouton bouton-petit" to={`/recus/${r.id}`}>
                          <Icone nom="imprimer" taille={14} /> Voir
                        </Link>{' '}
                        {!r.annule_le && r.client_id && parId.has(r.client_id) && (
                          <>
                            <button className="bouton bouton-petit" onClick={() => setEnvoi(r)}>
                              <Icone nom="envoyer" taille={14} /> Envoyer
                            </button>{' '}
                          </>
                        )}
                        {!r.annule_le && (
                          <button className="bouton bouton-petit" onClick={() => setAnnulation(r)}>
                            Annuler
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="carte" aria-labelledby="r-recap">
        <div className="carte-entete">
          <div>
            <h2 id="r-recap">Récapitulatif {annee}</h2>
            <p className="aide">
              Reçus valides par mois, par trimestre et par mode de règlement (les annulés ne comptent pas). Les reçus de
              l'année s'exportent pour le tableur (annulés compris) ; le livre des recettes reprend toutes les années,
              avec les totaux par trimestre.
            </p>
          </div>
          <div className="actions">
            <button
              className="bouton bouton-petit"
              disabled={!del.length}
              onClick={() => telecharger(`recus-${annee}.csv`, csvRecus(recus, annee), 'text/csv;charset=utf-8')}
            >
              <Icone nom="enregistrer" taille={14} /> Exporter pour le tableur (CSV)
            </button>
            <button
              className="bouton bouton-petit"
              disabled={!recus.some((r) => !r.annule_le)}
              onClick={() => telecharger('livre-des-recettes.csv', csvLivreRecettes(recus), 'text/csv;charset=utf-8')}
            >
              <Icone nom="livre" taille={14} /> Livre des recettes, toutes les années (CSV)
            </button>
          </div>
        </div>
        <div className="carte-corps recap-recus" style={{ paddingTop: 8 }}>
          <div className="tableau-conteneur">
            <table>
              <caption className="visuellement-cache">Reçus valides de {annee} par mois</caption>
              <thead>
                <tr>
                  <th scope="col">Mois</th>
                  <th scope="col" className="num">
                    Reçus
                  </th>
                  <th scope="col" className="num">
                    Montant
                  </th>
                </tr>
              </thead>
              <tbody>
                {recap.parMois.map((m) => (
                  <tr key={m.mois} className={m.nb ? undefined : 'ligne-vide'}>
                    <th scope="row">{MOIS[m.mois - 1]}</th>
                    <td className="num">{m.nb || '—'}</td>
                    <td className="num">{m.nb ? euros(m.total, 2) : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Total</th>
                  <td className="num">{recap.nb}</td>
                  <td className="num">
                    <strong>{euros(recap.total, 2)}</strong>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div style={{ display: 'grid', gap: 18 }}>
            <div>
              <h3 className="sous-titre-section">Par trimestre</h3>
              <ul className="liste-modes">
                {[1, 2, 3, 4].map((n) => {
                  const t = trimestres.find((x) => x.trimestre === n);
                  return (
                    <li key={n}>
                      <span>{['1er', '2e', '3e', '4e'][n - 1]} trimestre</span>
                      <span className="meta">{t ? `${t.nb} reçu${t.nb > 1 ? 's' : ''}` : '—'}</span>
                      <strong>{t ? euros(t.total, 2) : '—'}</strong>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div>
              <h3 className="sous-titre-section">Par mode de règlement</h3>
              {recap.parMode.length === 0 ? (
                <p className="meta">Aucun reçu valide en {annee}.</p>
              ) : (
                <ul className="liste-modes">
                  {recap.parMode.map((m) => (
                    <li key={m.mode}>
                      <span>{MODES_REGLEMENT[m.mode].replace(/^(par|en) /, '')}</span>
                      <span className="meta">
                        {m.nb} reçu{m.nb > 1 ? 's' : ''}
                      </span>
                      <strong>{euros(m.total, 2)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </section>

      {envoi && (
        <DialogueLienRecu
          recu={envoi}
          client={parId.get(envoi.client_id!)!}
          fermer={(cree) => {
            setEnvoi(null);
            if (cree) charge.recharger();
          }}
        />
      )}
      {aEmettre && (
        <DialogueEmission
          seances={aEmettre}
          client={parId.get(aEmettre[0].client_id)!}
          fermer={(recu) => {
            setAEmettre(null);
            if (recu) {
              setSelection([]);
              naviguer(`/recus/${recu.id}`);
            }
          }}
        />
      )}
      {annulation && (
        <DialogueAnnulation
          recu={annulation}
          fermer={(annule) => {
            setAnnulation(null);
            if (annule) charge.recharger();
          }}
        />
      )}
    </div>
  );
}

function DialogueEmission({
  seances,
  client: c,
  fermer,
}: {
  /** Une séance, ou plusieurs du même client pour un reçu groupé. */
  seances: SeanceTarif[];
  client: Pick<ClientResume, 'prenom' | 'nom'>;
  fermer: (recu: Recu | null) => void;
}) {
  const triees = [...seances].sort((a, b) => a.date_seance.localeCompare(b.date_seance));
  const derniere = triees[triees.length - 1].date_seance;
  const total = triees.reduce((t, x) => t + Math.round((x.prix ?? 0) * 100), 0) / 100;
  const groupe = triees.length > 1;
  const notifier = useNotifier();
  const [mode, setMode] = useState<ModeReglement>('virement');
  const [date, setDate] = useState(dateDuJour());
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function emettre() {
    setEnvoi(true);
    try {
      const r = groupe
        ? await donnees.emettreRecuGroupe(
            triees.map((x) => x.id),
            mode,
            date,
          )
        : await donnees.emettreRecu(triees[0].id, mode, date);
      notifier(`Reçu n° ${numeroRecu(r)} émis.`);
      fermer(r);
    } catch (e) {
      setErreur(messageErreur(e));
      setEnvoi(false);
    }
  }

  return (
    <Dialogue
      ouvert
      fermer={() => fermer(null)}
      titre={groupe ? `Reçu groupé pour ${c.prenom} ${c.nom}` : `Reçu pour ${c.prenom} ${c.nom}`}
      pied={
        <>
          <button className="bouton" onClick={() => fermer(null)}>
            Annuler
          </button>
          <button className="bouton bouton-principal" onClick={emettre} disabled={envoi || !date}>
            <Icone nom="recu" taille={16} /> Émettre le reçu
          </button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 14 }}>
        {erreur && <Erreur message={erreur} />}
        {groupe ? (
          <div>
            <ul className="liste-modes">
              {triees.map((x) => (
                <li key={x.id}>
                  <span>Séance du {dateLongue(x.date_seance)}</span>
                  <span />
                  <span>{euros(x.prix, 2)}</span>
                </li>
              ))}
            </ul>
            <p style={{ marginTop: 8 }}>
              {triees.length} séances · total <strong>{euros(total, 2)}</strong>
            </p>
          </div>
        ) : (
          <p>
            Séance du <strong>{dateLongue(derniere)}</strong> · <strong>{euros(total, 2)}</strong>
          </p>
        )}
        <div className="champ">
          <label htmlFor="recu-mode">Réglé</label>
          <select id="recu-mode" value={mode} onChange={(e) => setMode(e.target.value as ModeReglement)}>
            {(Object.keys(MODES_REGLEMENT) as ModeReglement[]).map((m) => (
              <option key={m} value={m}>
                {MODES_REGLEMENT[m]}
              </option>
            ))}
          </select>
        </div>
        <div className="champ">
          <label htmlFor="recu-date">Date du reçu</label>
          <input
            id="recu-date"
            type="date"
            value={date}
            min={derniere}
            max={dateDuJour()}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <p className="meta">
          Le numéro est attribué automatiquement. Une fois émis, le reçu n'est plus modifiable : en cas d'erreur,
          annulez-le (il reste visible, barré) et émettez-en un nouveau.
        </p>
      </div>
    </Dialogue>
  );
}

function DialogueAnnulation({ recu: r, fermer }: { recu: Recu; fermer: (annule: boolean) => void }) {
  const notifier = useNotifier();
  const [motif, setMotif] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function annuler() {
    if (!motif.trim()) return setErreur("Indiquez le motif de l'annulation.");
    setEnvoi(true);
    try {
      await donnees.annulerRecu(r.id, motif.trim());
      notifier(`Reçu n° ${numeroRecu(r)} annulé.`);
      fermer(true);
    } catch (e) {
      setErreur(messageErreur(e));
      setEnvoi(false);
    }
  }

  return (
    <Dialogue
      ouvert
      fermer={() => fermer(false)}
      titre={`Annuler le reçu n° ${numeroRecu(r)} ?`}
      pied={
        <>
          <button className="bouton" onClick={() => fermer(false)}>
            Retour
          </button>
          <button className="bouton bouton-danger" onClick={annuler} disabled={envoi}>
            Annuler le reçu
          </button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 12 }}>
        {erreur && <Erreur message={erreur} />}
        <p>
          {r.client_nom} · {euros(r.montant, 2)} · émis le {dateLongue(r.date_emission)}. Le reçu restera dans la liste,
          marqué « Annulé », et son numéro ne sera pas réutilisé.
        </p>
        <div className="champ">
          <label htmlFor="recu-motif">Motif</label>
          <input
            id="recu-motif"
            maxLength={300}
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Ex. : erreur sur le mode de règlement"
          />
        </div>
      </div>
    </Dialogue>
  );
}

/** Reçu à imprimer ou à enregistrer en PDF. */
export function ImpressionRecu() {
  const { recuId = '' } = useParams();
  const { clients } = useTaches();
  const charge = useChargement(() => donnees.listerRecus(), [], 'liste-recus');
  const [envoi, setEnvoi] = useState(false);
  if (!charge.donnees) return charge.erreur ? <Erreur message={charge.erreur} /> : <Chargement />;
  const r = charge.donnees.find((x) => x.id === recuId);
  if (!r) return charge.chargement ? <Chargement /> : <Erreur message="Reçu introuvable." />;
  const client = clients.find((c) => c.id === r.client_id);
  return (
    <div className="page page-etroite">
      <div className="entete-page ne-pas-imprimer">
        <Link to="/recus" className="bouton">
          <Icone nom="precedent" taille={16} /> Reçus
        </Link>
        <div className="actions">
          {client && !r.annule_le && (
            <button className="bouton" onClick={() => setEnvoi(true)}>
              <Icone nom="envoyer" taille={16} /> Envoyer au client
            </button>
          )}
          <button className="bouton bouton-principal" onClick={() => window.print()}>
            <Icone nom="imprimer" taille={16} /> Imprimer ou enregistrer en PDF
          </button>
        </div>
      </div>
      <FeuilleRecu recu={r} />
      {envoi && client && (
        <DialogueLienRecu
          recu={r}
          client={client}
          fermer={(cree) => {
            setEnvoi(false);
            if (cree) charge.recharger();
          }}
        />
      )}
    </div>
  );
}
