// Paramètres > Tarifs : activer le suivi des tarifs et le tarif par défaut
// (le tarif d'un client se règle sur sa fiche).

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Erreur, useNotifier } from '../../composants/Commun';
import { Icone } from '../../composants/Icone';
import { messageErreur } from '../../domaine/format';
import { useReglages } from '../../etat/reglages';

export function OngletTarifs() {
  const { parametres, enregistrer } = useReglages();
  const notifier = useNotifier();
  const [actifs, setActifs] = useState(parametres.tarifs_actifs);
  const [prix, setPrix] = useState(parametres.prix_defaut === null ? '' : String(parametres.prix_defaut));
  const [erreur, setErreur] = useState<string | null>(null);

  async function valider() {
    setErreur(null);
    const valeur = prix.trim() === '' ? null : Number(prix.replace(',', '.'));
    if (valeur !== null && !(valeur >= 0 && valeur < 1_000_000)) return setErreur('Tarif invalide.');
    try {
      await enregistrer({ tarifs_actifs: actifs, prix_defaut: valeur });
      notifier('Tarifs enregistrés.');
    } catch (err) {
      setErreur(messageErreur(err));
    }
  }

  return (
    <section className="carte" aria-labelledby="t-tarifs">
      <div className="carte-entete">
        <div>
          <h2 id="t-tarifs" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Icone nom="euro" /> Tarifs et rentabilité
          </h2>
          <p className="aide">
            Facultatif. Chaque séance peut porter un tarif : celui du client s'il en a un, sinon le tarif par défaut.
            Vous pouvez le modifier séance par séance.
          </p>
        </div>
        {/* Accès au budget : « Rentabilité » et « Reçus » ne sont plus dans le menu (choix de
            l'utilisateur, 0.9.3) ; on y accède d'ici quand les tarifs sont suivis. */}
        {parametres.tarifs_actifs && (
          <div className="actions">
            <Link to="/rentabilite" className="bouton bouton-petit">
              <Icone nom="activite" taille={15} /> Voir la rentabilité
            </Link>
            <Link to="/recus" className="bouton bouton-petit">
              <Icone nom="recu" taille={15} /> Mes reçus
            </Link>
          </div>
        )}
      </div>
      <div className="carte-corps" style={{ display: 'grid', gap: 18 }}>
        <label className="interrupteur">
          <input type="checkbox" checked={actifs} onChange={(e) => setActifs(e.target.checked)} />
          <span>Suivre les tarifs et afficher la rentabilité</span>
        </label>
        <div className="champ" style={{ maxWidth: 260 }}>
          <label htmlFor="t-prix">Tarif par défaut d'une séance</label>
          <div className="champ-unite">
            <input
              id="t-prix"
              inputMode="decimal"
              placeholder="non défini"
              value={prix}
              onChange={(e) => setPrix(e.target.value.replace(/[^\d.,]/g, ''))}
              disabled={!actifs}
            />
            <span>€</span>
          </div>
          <span className="indication">Laissez vide pour ne rien pré-remplir.</span>
        </div>
        {erreur && <Erreur message={erreur} />}
        <div>
          <button className="bouton bouton-principal" onClick={valider}>
            Enregistrer
          </button>
        </div>
      </div>
    </section>
  );
}
