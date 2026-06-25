# Health Robot

Ce contexte décrit le langage métier des missions de livraison opérées par le robot en établissement de soins. Il sert à distinguer clairement les demandes humaines, les trajets robot, les points métier et les validations de livraison.

## Language

**Aide-soignant**:
Utilisateur opérationnel qui crée des demandes de mission pour faire livrer des fournitures à sa chambre ou à sa zone de travail.
_Avoid_: utilisateur simple, soignant, client

**Administrateur**:
Utilisateur autorisé à tester, vérifier, maintenir et exécuter les actions sensibles du robot en plus des actions opérationnelles.
_Avoid_: super utilisateur, technicien, owner

**Fourniture**:
Objet consommable ou matériel courant que le robot peut transporter pour l'équipe soignante, limité pour l'instant aux serviettes, papier toilette, gants, protections et linge.
_Avoid_: matériel médical, médicament, colis

**Demande de mission**:
Demande créée par un aide-soignant ou un administrateur pour faire récupérer une fourniture à un point de stock et la livrer à une chambre.
_Avoid_: commande, ordre, ticket

**Mission de livraison**:
Exécution robot d'une demande de mission, depuis la base vers un point de stock, puis vers la chambre de livraison.
_Avoid_: navigation libre, trajet, course

**Mission enchaînée**:
Mission de livraison exécutée après une autre mission sans retour préalable à la base. Le robot repart depuis sa position courante, généralement une chambre de livraison.
_Avoid_: tournée automatique, boucle, multi-trajet

**File de missions**:
Ensemble ordonné des missions de livraison en attente d'exécution par le robot. La file permet de créer de nouvelles demandes pendant qu'une mission est déjà en cours.
_Avoid_: tournée optimisée, backlog technique, liste personnelle

**Mission active**:
Unique mission de livraison actuellement exécutée ou attendue par le robot. Une mission active peut être en navigation, en attente de récupération ou en attente de confirmation de livraison.
_Avoid_: toutes les missions ouvertes, commande robot active, tâche courante

**Point annoté**:
Point nommé et réutilisable sur la carte, représentant un lieu métier tel qu'un stock, une chambre de livraison ou une base robot.
_Avoid_: waypoint brut, pin, marqueur temporaire

**Point de stock**:
Point annoté où une fourniture peut être récupérée par le robot. Il peut exister plusieurs points de stock.
_Avoid_: base, réserve unique, entrepôt

**Règle de stock**:
Règle qui associe une fourniture au point de stock que le robot doit rejoindre pour la récupérer.
_Avoid_: choix manuel du stock, routage libre, mapping technique

**Chambre de livraison**:
Chambre associée à la demande de mission, où la fourniture doit être livrée à l'aide-soignant.
_Avoid_: destination libre, client, point final

**Base robot**:
Point annoté où le robot attend ses missions et où il peut être renvoyé après une livraison.
_Avoid_: origine carte, station, maison

**Récupération de fourniture**:
Étape pendant laquelle le robot obtient la fourniture au point de stock. Cette étape est une vraie action métier, même si sa détection automatique sera implémentée plus tard.
_Avoid_: chargement manuel, pick technique, scan

**Attente de récupération**:
État temporaire d'une mission lorsque le robot est arrivé au point de stock et attend que la récupération de fourniture soit confirmée ou automatisée.
_Avoid_: pause, blocage, chargement manuel

**Confirmation de livraison**:
Validation humaine effectuée après l'arrivée du robot à la chambre de livraison pour confirmer que la fourniture a été remise.
_Avoid_: arrivée robot, mission terminée automatiquement

**Annulation de mission**:
Décision humaine d'arrêter une mission de livraison avant sa fin. Elle ne signifie pas automatiquement que le robot retourne à la base.
_Avoid_: retour base, échec technique, arrêt d'urgence

**Retour base**:
Action qui renvoie le robot à sa base après une livraison ou entre deux missions, à la décision de l'utilisateur.
_Avoid_: retour maison, reset, annulation

**Écran robot**:
Interface visible sur l'écran embarqué du robot, destinée aux personnes proches du robot. Elle affiche l'état courant du robot et revient à une identité simple CareBot lorsque le robot est à la base et inactif.
_Avoid_: dashboard admin, écran technique, console robot
