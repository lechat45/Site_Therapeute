// Reçu tel qu'il s'imprime : page du thérapeute (/recus/:id) et page du
// client (/r/:jeton). Un reçu annulé porte un tampon, en toutes lettres.

import { MODES_REGLEMENT } from '../config/ressources';
import { dateCourte, dateLongue } from '../domaine/format';
import { euros } from '../domaine/rentabilite';
import { numeroRecu } from '../domaine/texte';
import type { RecuAffiche } from '../domaine/types';
import { Icone } from './Icone';

export function FeuilleRecu({ recu: r }: { recu: RecuAffiche }) {
  const e = r.emetteur;
  return (
    <article className={`feuille feuille-recu${r.annule_le ? ' feuille-annulee' : ''}`}>
      {r.annule_le && (
        <p className="tampon-annule" role="note">
          <Icone nom="croix" /> Reçu annulé le {dateLongue(r.annule_le)} : {r.motif_annulation}
        </p>
      )}
      <header className="feuille-entete">
        <div>
          <strong>{e.nom}</strong>
          {e.specialite && <div>{e.specialite}</div>}
          {e.adresse && <div style={{ whiteSpace: 'pre-line' }}>{e.adresse}</div>}
          {e.telephone && <div>Tél. {e.telephone}</div>}
          {e.siret && <div>SIRET {e.siret}</div>}
        </div>
        <div className="feuille-droite">
          <div className="feuille-numero">Reçu n° {numeroRecu(r)}</div>
          <div>Le {dateLongue(r.date_emission)}</div>
        </div>
      </header>
      <h1>Note d'honoraires</h1>
      <p>
        Reçu de <strong>{r.client_nom}</strong> la somme de <strong>{euros(r.montant, 2)}</strong>, réglée{' '}
        {MODES_REGLEMENT[r.mode_reglement]}.
      </p>
      <table className="tableau-recu">
        <thead>
          <tr>
            <th scope="col">Prestation</th>
            <th scope="col">Date</th>
            <th scope="col" className="num">
              Montant
            </th>
          </tr>
        </thead>
        <tbody>
          {(r.lignes.length ? r.lignes : [r]).map((l, i) => (
            <tr key={i}>
              <td>{l.prestation}</td>
              <td>{dateCourte(l.date_seance)}</td>
              <td className="num">{euros(l.montant, 2)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={2}>
              Total
            </th>
            <td className="num">
              <strong>{euros(r.montant, 2)}</strong>
            </td>
          </tr>
        </tfoot>
      </table>
      {e.mention && <p className="meta">{e.mention}</p>}
      <p className="feuille-signature">Signature :</p>
    </article>
  );
}
