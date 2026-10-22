// Paramètres > Mon profil : nom, photo, spécialité, téléphone, signature des
// messages, et coordonnées recopiées sur les reçus (adresse, SIRET, mention).

import { useRef, useState, type FormEvent } from 'react';
import { Avatar } from '../../composants/Avatar';
import { Erreur, useNotifier } from '../../composants/Commun';
import { Icone } from '../../composants/Icone';
import { donnees } from '../../donnees';
import { messageErreur } from '../../domaine/format';
import { useReglages } from '../../etat/reglages';
import { useSession, useTherapeute } from '../../etat/session';
import { ARGENT_VISIBLE } from '../../config/fonctions';

/** Réduit une image à 160 × 160 px (JPEG) : la photo reste légère. */
function reduireImage(fichier: File): Promise<string> {
  return new Promise((resoudre, rejeter) => {
    if (!fichier.type.startsWith('image/')) return rejeter(new Error('Choisissez une image (JPEG, PNG…).'));
    const img = new Image();
    const url = URL.createObjectURL(fichier);
    img.onload = () => {
      const cote = 160;
      const toile = document.createElement('canvas');
      toile.width = cote;
      toile.height = cote;
      const ctx = toile.getContext('2d')!;
      // recadrage carré centré
      const c = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - c) / 2, (img.height - c) / 2, c, c, 0, 0, cote, cote);
      URL.revokeObjectURL(url);
      resoudre(toile.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      rejeter(new Error('Image illisible.'));
    };
    img.src = url;
  });
}

export function OngletProfil() {
  const t = useTherapeute();
  const { ouvrir } = useSession();
  const { parametres, enregistrer } = useReglages();
  const notifier = useNotifier();
  const [prenom, setPrenom] = useState(t.prenom);
  const [nom, setNom] = useState(t.nom);
  const [specialite, setSpecialite] = useState(parametres.specialite);
  const [telephone, setTelephone] = useState(parametres.telephone_pro);
  const [signature, setSignature] = useState(parametres.signature);
  const [adresse, setAdresse] = useState(parametres.adresse_pro);
  const [siret, setSiret] = useState(parametres.siret);
  const [mention, setMention] = useState(parametres.mention_recu);
  const [erreur, setErreur] = useState<string | null>(null);
  const champFichier = useRef<HTMLInputElement>(null);

  const modifie =
    prenom !== t.prenom ||
    nom !== t.nom ||
    specialite !== parametres.specialite ||
    telephone !== parametres.telephone_pro ||
    signature !== parametres.signature ||
    adresse !== parametres.adresse_pro ||
    siret !== parametres.siret ||
    mention !== parametres.mention_recu;

  async function valider(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    try {
      if (prenom !== t.prenom || nom !== t.nom) ouvrir(await donnees.modifierProfil(prenom, nom));
      await enregistrer({
        specialite: specialite.trim(),
        telephone_pro: telephone.trim(),
        signature: signature.trim(),
        adresse_pro: adresse.trim(),
        siret: siret.trim(),
        mention_recu: mention.trim(),
      });
      notifier('Profil mis à jour.');
    } catch (err) {
      setErreur(messageErreur(err));
    }
  }

  async function changerPhoto(fichier: File | undefined) {
    if (!fichier) return;
    try {
      await enregistrer({ photo: await reduireImage(fichier) });
      notifier('Photo enregistrée.');
    } catch (err) {
      notifier(messageErreur(err), true);
    }
  }

  return (
    <form className="carte" onSubmit={valider} aria-labelledby="t-profil">
      <div className="carte-entete">
        <div>
          <h2 id="t-profil">Mon profil</h2>
          <p className="aide">
            Votre nom et votre signature apparaissent dans les messages de relance et sur le questionnaire.
          </p>
        </div>
      </div>
      <div className="carte-corps" style={{ display: 'grid', gap: 16 }}>
        <div className="profil-photo">
          <Avatar taille={72} />
          <div className="actions">
            <button type="button" className="bouton" onClick={() => champFichier.current?.click()}>
              <Icone nom="utilisateur" taille={16} /> {parametres.photo ? 'Changer la photo' : 'Ajouter une photo'}
            </button>
            {parametres.photo && (
              <button type="button" className="bouton bouton-danger" onClick={() => enregistrer({ photo: null })}>
                Retirer
              </button>
            )}
            <input
              ref={champFichier}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                void changerPhoto(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>
        </div>

        <div className="grille-2">
          <div className="champ">
            <label htmlFor="p-prenom">Prénom</label>
            <input id="p-prenom" value={prenom} onChange={(e) => setPrenom(e.target.value)} autoComplete="given-name" />
          </div>
          <div className="champ">
            <label htmlFor="p-nom">Nom</label>
            <input id="p-nom" value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="family-name" />
          </div>
        </div>
        <div className="grille-2">
          <div className="champ">
            <label htmlFor="p-specialite">Spécialité</label>
            <input
              id="p-specialite"
              maxLength={80}
              placeholder="ex. Thérapeute comportementaliste émotionnel(le)"
              value={specialite}
              onChange={(e) => setSpecialite(e.target.value)}
            />
          </div>
          <div className="champ">
            <label htmlFor="p-tel">Téléphone professionnel</label>
            <input
              id="p-tel"
              type="tel"
              maxLength={30}
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
            />
          </div>
        </div>
        <div className="champ">
          <label htmlFor="p-signature">Signature des messages</label>
          <textarea
            id="p-signature"
            rows={3}
            maxLength={500}
            placeholder={`${t.prenom} ${t.nom}`}
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
          />
          <span className="indication">
            Utilisée par la variable {'{signature}'} des modèles de messages (Paramètres &gt; Relances). Vide : votre
            nom.
          </span>
        </div>
        {/* Coordonnées des reçus : partie « argent », masquée (config/fonctions.ts). */}
        {ARGENT_VISIBLE && (
          <fieldset className="groupe-champs">
            <legend>Pour les reçus (notes d'honoraires)</legend>
            <div className="champ">
              <label htmlFor="p-adresse">Adresse professionnelle</label>
              <textarea
                id="p-adresse"
                rows={2}
                maxLength={300}
                placeholder={'12 rue des Lilas\n75000 Paris'}
                value={adresse}
                onChange={(e) => setAdresse(e.target.value)}
                autoComplete="street-address"
              />
            </div>
            <div className="grille-2" style={{ alignItems: 'start' }}>
              <div className="champ">
                <label htmlFor="p-siret">SIRET</label>
                <input
                  id="p-siret"
                  inputMode="numeric"
                  maxLength={17}
                  placeholder="14 chiffres"
                  value={siret}
                  onChange={(e) => setSiret(e.target.value)}
                />
              </div>
              <div className="champ">
                <label htmlFor="p-mention">Mention en bas du reçu</label>
                <input id="p-mention" maxLength={300} value={mention} onChange={(e) => setMention(e.target.value)} />
                <span className="indication">Ex. : « TVA non applicable, article 293 B du CGI. »</span>
              </div>
            </div>
            <p className="meta">
              Recopiées sur chaque reçu au moment où vous l'émettez : les reçus déjà émis ne changent pas.
            </p>
          </fieldset>
        )}
        <div className="champ">
          <label htmlFor="p-email">Adresse de connexion</label>
          <input id="p-email" value={t.email} readOnly />
          <span className="indication">Pour la changer, adressez-vous à l'administrateur de la plateforme.</span>
        </div>
        {erreur && <Erreur message={erreur} />}
        <div>
          <button className="bouton bouton-principal" type="submit" disabled={!modifie}>
            Enregistrer
          </button>
        </div>
      </div>
    </form>
  );
}
