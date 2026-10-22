# RGPD — conformité du site

État au 22 octobre 2026 (version 0.13.0). **Ce document n'est pas un avis juridique** : il
décrit ce que l'application fait pour le RGPD et ce qu'il reste à faire hors du code. À
valider avec un juriste ou un délégué à la protection des données (DPO) avant d'ouvrir le
service à de vrais clients. La démonstration publique (GitHub Pages) ne contient que des
données fictives.

## 1. Le cadre

- L'application traite des **données de santé** : notes de séance, émotions, problématiques,
  réponses aux questionnaires (RGPD, **article 9** : catégorie particulière, interdite sauf
  exception).
- **Rôles** :
  - chaque **thérapeute** est **responsable de traitement** pour les données de ses clients ;
  - l'**éditeur** de la plateforme est **sous-traitant** des thérapeutes (article 28) pour ces
    données, et responsable de traitement pour les comptes des thérapeutes ;
  - l'**hébergeur** (Supabase ou un hébergeur certifié) et **Google** (Gemini, si l'IA est
    utilisée) sont des sous-traitants ultérieurs.
- **Base légale** retenue pour les données de suivi : le **consentement explicite** du client
  (article 9.2.a), recueilli par écrit par le thérapeute. Les thérapeutes comportementalistes
  ne sont pas des professionnels de santé réglementés : l'exception 9.2.h (soins par un
  professionnel tenu au secret) ne s'applique probablement pas. **À confirmer.**
- Être recontacté (relances, questionnaires) : accord distinct, noté sur la fiche
  (`accord_relance_le`).

## 2. Ce que fait l'application

| Exigence | Article | Dans l'application | Où |
|---|---|---|---|
| Information des personnes | 13, 14 | Page publique **Politique de confidentialité** (`/confidentialite`), liée depuis la connexion et depuis chaque page ouverte par un client (questionnaire, document, reçu) | `pages/Confidentialite.tsx`, `config/rgpd.ts`, `PiedPublic` |
| Consentement explicite | 7, 9.2.a | Date de consentement sur chaque fiche (`consentement_le`) ; case à la création ; **alerte « Consentement à recueillir »** tant qu'il manque ; retrait possible | migration `rgpd`, `composants/DonneesPersonnelles.tsx`, `pages/Clients.tsx` |
| Droit d'accès et de portabilité | 15, 20 | **« Exporter ses données »** sur la fiche : un fichier JSON lisible avec tout ce qui concerne le client (identité, consentements, séances avec les émotions en clair, questionnaires et réponses, rendez-vous, notes, documents, reçus), jamais de jeton ni d'identifiant interne | `domaine/rgpd.ts` (`exportClient`), `DonneesPersonnelles` |
| Portabilité du thérapeute | 20 | **« Télécharger toutes mes données »** (Paramètres › Confidentialité) | `exportComplet`, `pages/parametres/SectionRgpd.tsx` |
| Rectification | 16 | Fiche client « Modifier », fiche de séance modifiable | `FicheClient`, `FicheSeance` |
| Effacement | 17 | « Supprimer » : corbeille 30 jours, puis effacement définitif **en cascade** (séances, envois, rendez-vous, notes, documents) ; effacement immédiat possible depuis la corbeille | `purger_corbeille`, `supprimerClientDefinitivement` |
| Limitation des durées | 5.1.e | Fiche proposée à l'effacement **5 ans** après la dernière séance (Paramètres › Confidentialité, rien n'est effacé sans accord) ; journal des connexions **purgé à 12 mois** ; liens envoyés à durée limitée | `config/rgpd.ts`, `fichesARevoir`, `purger_journal_connexions` |
| Minimisation | 5.1.c | Année de naissance seulement ; coordonnées facultatives ; statistiques de groupe anonymes (seuils) ; noms retirés avant l'IA | — |
| Confidentialité, intégrité | 5.1.f, 32 | RLS « propriétaire uniquement » + RLS restrictive « double authentification » ; 2FA (TOTP) ; déconnexion après inactivité ; comptes créés par l'administrateur seulement ; jetons des liens stockés en empreinte SHA-256 ; aucune clé secrète dans le navigateur | `AGENTS.md` règles 1, 4, 7 |
| Protection dès la conception | 25 | IA facultative et sur clic seulement ; aucun envoi automatique ; aucun traceur ni cookie publicitaire ; polices non téléchargées | `AGENTS.md` règles 5, 6 |
| Pièces comptables | — | Les reçus survivent à l'effacement de la fiche (obligation de conservation comptable), sans lien vers le client | migration `journal_exercices_recus` |

## 3. Ce qu'il reste à faire (hors du code)

L'application donne les outils ; la conformité exige aussi des démarches.

**L'éditeur de la plateforme**
1. Remplir `EDITEUR` dans `src/config/rgpd.ts` (nom, adresse, contact, hébergeur) : la
   politique de confidentialité affiche « [à compléter] » tant que ce n'est pas fait.
2. **Hébergement certifié HDS** (données de santé hébergées pour le compte de tiers, article
   L.1111-8 du Code de la santé publique) : vérifier l'offre Supabase retenue, ou auto-héberger
   Supabase chez un hébergeur certifié HDS, en France ou dans l'Union européenne.
3. **Contrats de sous-traitance** (article 28) : avec chaque thérapeute (conditions
   d'utilisation + accord de traitement), et avec l'hébergeur.
4. **Gemini** : offre payante de l'API (l'offre gratuite autorise Google à exploiter les
   contenus), accord de traitement de Google, encadrement du transfert hors UE (clauses
   contractuelles types). Sinon, ne pas configurer `GEMINI_API_KEY` : tout fonctionne sans.
5. **Analyse d'impact (AIPD)** : très probablement obligatoire (données de santé, à grande
   échelle, avec de l'IA). Outil gratuit de la CNIL : « PIA ».
6. **Registre des traitements** de l'éditeur (modèle ci-dessous).
7. **Procédure en cas de violation de données** : notification à la CNIL sous 72 heures, et
   aux personnes si le risque est élevé (articles 33 et 34). Désigner qui fait quoi.
8. **Sauvegardes chiffrées** et test de restauration (voir `docs/IDEES.md`).
9. Purge quotidienne de toute la plateforme, même pour les comptes inactifs (`pg_cron`, voir
   `README.md`) : corbeille de plus de 30 jours, journal des connexions de plus de 12 mois.
10. Envisager la **double authentification obligatoire** (idée écartée pour l'instant par
    l'utilisateur, `docs/IDEES.md`) : fortement recommandée pour des données de santé.

**Chaque thérapeute**
1. Faire signer à chaque client un **formulaire de consentement** (modèle à rédiger avec un
   juriste) avant la première séance, puis le noter sur la fiche.
2. Informer ses clients (remettre ou indiquer la politique de confidentialité), notamment s'il
   utilise l'assistant IA.
3. Répondre aux demandes de droits sous **un mois** (export, rectification, effacement).
4. Tenir son propre registre des traitements (responsable de traitement).
5. Ne rien écrire dans les notes qui ne soit utile au suivi.

## 4. Modèle de registre des traitements (éditeur)

| Rubrique | Contenu |
|---|---|
| Traitement | Plateforme de suivi des clients de thérapeutes comportementalistes |
| Responsable / sous-traitant | Éditeur : responsable (comptes des thérapeutes), sous-traitant (données des clients) |
| Finalités | Tenue des fiches et séances ; agenda ; relances et questionnaires ; statistiques anonymes ; reçus |
| Personnes concernées | Thérapeutes (utilisateurs) ; leurs clients |
| Données | Identité, année de naissance, coordonnées ; données de santé (notes, émotions, problématiques, réponses) ; rendez-vous ; reçus ; journal des connexions |
| Base légale | Clients : consentement explicite (9.2.a) ; thérapeutes : contrat |
| Destinataires | Le thérapeute seul ; l'hébergeur ; Google (Gemini) si l'IA est activée, données pseudonymisées |
| Transferts hors UE | Gemini (Google) si utilisé : clauses contractuelles types |
| Durées | Fiche : suivi + 5 ans après la dernière séance ; corbeille : 30 jours ; journal des connexions : 12 mois ; liens : quelques semaines ; reçus : durée comptable légale |
| Sécurité | Voir la section 2 (RLS, 2FA, chiffrement en transit, empreintes des jetons, purge) |

## 5. Pour les développeurs (Codex, Claude, humains)

- Toute **nouvelle donnée sur un client** doit apparaître dans `exportClient`
  (`src/domaine/rgpd.ts`) et dans son test, et être effacée avec la fiche (clé étrangère
  `on delete cascade`, ou purge dans `effacer` de `demo.ts`).
- Toute nouvelle **durée de conservation** se règle dans `src/config/rgpd.ts` et doit être
  réellement appliquée (purge SQL + miroir démo + test) avant d'être annoncée dans la politique.
- Toute **nouvelle destination** de données (service tiers) se déclare dans la politique
  (`pages/Confidentialite.tsx`) et dans ce document, avant d'être branchée.
- Ne jamais ajouter de traceur, de mesure d'audience, de police ou de script d'un domaine tiers.
