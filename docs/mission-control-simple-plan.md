# Plan Simple Mission Control

## Objectif

Remplacer le contrôle libre actuel par une vraie interface de mission pour CareBot.

Le MVP doit permettre de faire une mission complète:

1. Créer une mission.
2. Envoyer le robot au stock.
3. Confirmer la récupération.
4. Envoyer le robot à la chambre.
5. Confirmer la livraison.
6. Terminer la mission.
7. Lancer automatiquement la mission suivante si elle existe.

## Plan

1. **Créer le modèle backend**
   Ajouter les notions de mission, point annoté, point de stock, chambre de livraison, fourniture et file de missions. Le backend devient la source de vérité.

2. **Persister en base**
   Ajouter les tables avec Alembic pour les missions, les points annotés et les fournitures disponibles dans chaque stock.

3. **Ajouter l'orchestrateur mission**
   Créer la logique qui fait avancer une mission: en attente, vers le stock, attente récupération, vers la chambre, attente confirmation, terminée.

4. **Ajouter les APIs**
   Ajouter les endpoints pour créer/listing les missions, confirmer la récupération, confirmer la livraison, annuler une mission, gérer les points annotés et alimenter l'écran robot.

5. **Brancher la détection d'arrivée**
   À chaque mise à jour de position robot, le backend vérifie si le robot est assez proche du stock ou de la chambre.

6. **Mettre à jour `/map`**
   Permettre aux admins de créer et modifier les points annotés: stock, chambre de livraison et base robot. Les admins configurent aussi les fournitures disponibles dans chaque stock.

7. **Remplacer `/control`**
   Retirer la navigation libre du flux principal. Ajouter la création de mission, la file active, la mission courante, les boutons de confirmation et l'annulation.

8. **Ajouter `/robot-screen`**
   Créer un écran plein écran en français pour le robot. Il affiche l'état courant via polling backend et ne contient aucun bouton de commande.

9. **Ajouter Foxglove en visualisation**
   Essayer l'intégration Foxglove dans `/control`. Si ce n'est pas fiable rapidement, afficher un bouton pour ouvrir Foxglove dans un nouvel onglet.

10. **Tester le vertical slice**
    Tester les transitions de mission, la sélection du stock, la file FIFO, les confirmations, les annulations, les permissions et la détection d'arrivée.

## Règles MVP

- Le backend possède l'état mission.
- Les missions sont persistées.
- Les missions en attente sont traitées en FIFO.
- Une seule mission est active à la fois.
- Les aides-soignants voient toutes les missions actives.
- Les points annotés sont créés par les admins sur `/map`.
- Le stock est choisi automatiquement selon la fourniture.
- La récupération et la livraison demandent une confirmation humaine.
- Il n'y a pas de timeout automatique MVP.
- Le retour base reste une action explicite.
- Foxglove est seulement une visualisation.
- L'écran robot affiche les états en français.

## Hors Scope MVP

- Scan automatique de récupération.
- Optimisation par priorité ou proximité.
- Override manuel du stock.
- SSE/WebSocket.
- Retour base automatique.
- Reprise automatique après arrêt d'urgence.
- Commandes depuis Foxglove.
