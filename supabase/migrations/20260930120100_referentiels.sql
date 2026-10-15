-- =====================================================================
--  Référentiels — miroir de src/config/referentiels.ts
--  (vérifié par tests/sql.test.ts)
-- =====================================================================

-- ⚠ LISTE PROVISOIRE des 14 émotions clés : à remplacer par la liste
-- officielle via une nouvelle migration (update ... set libelle = ...),
-- en conservant les identifiants 1 à 14.
insert into public.emotions (id, libelle, ordre) values
  (1, 'Peur', 1),
  (2, 'Colère', 2),
  (3, 'Tristesse', 3),
  (4, 'Joie', 4),
  (5, 'Culpabilité', 5),
  (6, 'Honte', 6),
  (7, 'Abandon', 7),
  (8, 'Rejet', 8),
  (9, 'Injustice', 9),
  (10, 'Trahison', 10),
  (11, 'Humiliation', 11),
  (12, 'Impuissance', 12),
  (13, 'Dévalorisation', 13),
  (14, 'Solitude', 14);

insert into public.problematiques (id, code, libelle, ordre) values
  (1, 'anxiete_stress', 'Anxiété, stress', 1),
  (2, 'estime_de_soi', 'Confiance et estime de soi', 2),
  (3, 'couple', 'Relations de couple', 3),
  (4, 'famille', 'Relations familiales', 4),
  (5, 'deuil_separation', 'Deuil, séparation', 5),
  (6, 'sommeil', 'Troubles du sommeil', 6),
  (7, 'phobies', 'Phobies, peurs', 7),
  (8, 'dependances', 'Addictions, dépendances', 8),
  (9, 'alimentation', 'Comportement alimentaire', 9),
  (10, 'epuisement_professionnel', 'Épuisement professionnel', 10),
  (11, 'colere_impulsivite', 'Colère, impulsivité', 11),
  (12, 'traumatisme', 'Traumatisme, choc émotionnel', 12),
  (13, 'parentalite', 'Parentalité', 13),
  (14, 'scolarite', 'Difficultés scolaires', 14),
  (15, 'autre', 'Autre', 15);

insert into public.tranches_age (id, libelle, age_min, age_max) values
  (1, 'Moins de 12 ans', 0, 11),
  (2, '12 – 17 ans', 12, 17),
  (3, '18 – 25 ans', 18, 25),
  (4, '26 – 35 ans', 26, 35),
  (5, '36 – 45 ans', 36, 45),
  (6, '46 – 55 ans', 46, 55),
  (7, '56 – 65 ans', 56, 65),
  (8, '66 ans et plus', 66, null);
