# Publication du site

Deux façons de mettre le site en ligne. Aujourd'hui, seule la première est en place.

## 1. GitHub Pages — démonstration (en place)

- **Dépôt** : <https://github.com/lechat45/Site_Therapeute> (branche `main`).
  Le dossier local s'appelle `Site therapeute` ; GitHub n'accepte pas les accents dans les
  noms de dépôt (un ancien lien `Site_Thérapeutique` n'existe pas).
- **Adresse** : <https://lechat45.github.io/Site_Therapeute/> — en **mode démo** (aucune
  variable `VITE_SUPABASE_*` à la construction) : données fictives dans le navigateur,
  connexion `demo@exemple.fr` / `demo`.
- **Publication automatique** à chaque envoi sur `main` :
  `.github/workflows/github-pages.yml` construit (`npm run build`) puis publie `dist/`.
  Le workflow `verifier.yml` lance en parallèle tous les tests (il ne bloque pas la
  publication).
- **Réglage du dépôt, déjà fait** : Settings › Pages › Source = « GitHub Actions ».
  Avec « Deploy from a branch », GitHub publierait les fichiers bruts : `index.html` chargerait
  `/src/main.tsx` et la page resterait **blanche** (c'était la panne d'origine).

### Pourquoi le site sait vivre dans un sous-dossier

Le site n'est pas à la racine du domaine mais dans `/Site_Therapeute/`. Trois endroits en
tiennent compte, tous pilotés par la variable `CHEMIN_BASE`, donnée au moment de la
construction (le workflow passe `/<nom du dépôt>/`) :

| Endroit | Rôle |
|---|---|
| `vite.config.ts` → `base` | adresses des fichiers JS/CSS construits (`/Site_Therapeute/assets/…`) |
| `src/App.tsx` → `basename: import.meta.env.BASE_URL` | le routeur ignore le sous-dossier |
| `src/domaine/messages.ts` → `racineSite()` | les liens envoyés aux clients (`/q/`, `/d/`, `/r/`) incluent le sous-dossier |

Conséquences pour le code :
- Toujours naviguer avec `<Link to="/…">`, `useNavigate()` ou `<Navigate>` du routeur : ils
  ajoutent le sous-dossier. Jamais `<a href="/…">` ni `window.location = '/…'`.
- Un lien envoyé hors de l'application se construit avec `lienQuestionnaire`, `lienDocument`
  ou `lienRecu` (`domaine/messages.ts`), jamais avec `location.origin + '/…'`.
- GitHub Pages ne connaît pas les routes de l'application : le workflow copie `index.html`
  en `404.html`, pour que `/clients`, `/q/<jeton>`… ouvrent l'application quand on recharge
  la page.
- Sans `CHEMIN_BASE` (développement, Netlify…), la base vaut `/` et rien ne change.

Essayer la construction GitHub Pages en local (Git Bash : `MSYS_NO_PATHCONV=1` empêche Git
Bash de transformer `/Site_Therapeute/` en chemin Windows) :

```bash
MSYS_NO_PATHCONV=1 CHEMIN_BASE=/Site_Therapeute/ npm run build
```

### Limites de GitHub Pages

- Pas d'en-têtes de sécurité : `public/_headers` (CSP, HSTS…) est ignoré par GitHub Pages.
- Site public : **jamais de vraies données de clients** sur cette version (mode démo seulement).

## 2. Production avec Supabase (à faire)

Pour de vraies données : projet Supabase, migrations, fonction Edge, comptes créés par
l'administrateur, puis hébergement de `dist/` chez un hébergeur qui applique `_headers`
(Netlify, Cloudflare Pages) et renvoie toutes les adresses vers `index.html`. Étapes
détaillées : `README.md`, section « Brancher Supabase (production) ». Données de santé : voir
`docs/ARCHITECTURE.md`, section 6 (hébergeur certifié HDS).

## Poste de développement (Windows)

- Node.js 24 est installé dans `C:\Program Files\nodejs`. Si une application ne le trouve pas
  (PATH chargé avant son installation), la relancer. `.claude/launch.json` sert seulement à
  l'outil Claude pour lancer `npm run dev` ; le site ne l'utilise pas.
- Git Bash convertit les arguments et variables qui commencent par `/` en chemins Windows :
  préfixer la commande de `MSYS_NO_PATHCONV=1` (voir plus haut).
