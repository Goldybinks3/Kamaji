1 — Coquille. 
Quatre onglets, cartes verte et violette, feuille Demande, feuille d’un membre, données en dur. Manifeste, icônes 192 et 512, apple-touch-icon 180. Tu installes l’icône et tu vérifies que la barre du bas n’est pas coupée.

2 — Foyer. 
Tu colles le SQL du jalon 2. Connexion par lien e-mail. La première personne crée la maison, les trois autres entrent le code à 6 lettres. Les quatre pastilles s’affichent sur les quatre téléphones. Tu génères src/types/database.ts avec la CLI Supabase.

3 — Tâches en direct.
Bouton Fait, détail, trois prochaines tâches. Abonnement temps réel : un Fait sur un téléphone retire la carte sur l’autre sans recharger.

4 — Demandes. 
La feuille branche create_request et accept_assignment. Depuis une pastille, Qui est prérempli. Tu testes l’offre à tout le monde, la demande nommée, et le refus quand tu te la destines.

5 — Semaine. 
Modèles (jours, effort, heure), sélecteur d’énergie sur le profil, bouton « Tirer la semaine » qui appelle generate_week avec le lundi. Tu vérifies trois choses : une énergie basse ne reçoit pas de tâche lourde, un coup de main fait sauter un créneau, lancer le tirage deux fois échoue. La planification automatique vient seulement quand le bouton donne le bon résultat.

6 — Repas. 
Menu, cuisinier, courses. L’accueil montre le prochain repas. « Lait » ajouté sur un téléphone apparaît sur l’autre.

7 — Présence. 
Fonction notify, clés VAPID, abonnement push. Rappel en fin d’après-midi, ping avec un court texte depuis la feuille d’un membre, close_day à 23 h 59 heure de Paris, bouton Merci. Sur iPhone, tu n’attends une notification qu’après l’installation depuis Safari.

Ensuite, quand le quotidien tourne : page profil plus complète, mémoire des prix entre deux personnes, lien vers une recette, et le cron du dimanche sans bouton.