# Projet : Robot intelligent d’assistance pour EHPAD

## Robot : ROSMASTER M3 Pro — ROS2 — Jetson Nano / Orin NX

---

# 1. Vision

 Un robot autonome basé sur ROS2 capable d’assister les infirmiers en EHPAD en livrant de manière sécurisée les médicaments et les plateaux-repas aux patients, afin d’optimiser le temps du personnel et améliorer la qualité des soins.

---

# 2. Objectifs et périmètre

## Objectifs

1. Permettre la livraison autonome de médicaments et de repas
2. Permettre à l’infirmier de commander le robot via une interface web (tablette ou telephone mobile)
3. Permettre une communication temps réel le suivi du robot
4. Suivi de la position du robot en temps réel et de sa navigation
---
## Objectifs secondaires

1. Sortie des poubelles (fonctionnalité optionnelle)
---

## Non-objectifs

1. Remplacer le personnel soignant
2. Transporter des charges supérieures à 5kg
3. Utilisation en extérieur

---

## Personas

### Persona 1 — Personnel soignant

Nom : Marie  
Age : 34 ans

Objectifs :

- Livrer médicaments rapidement
- Réduire déplacements

Utilise :

- Interface web pour commander robot

---

### Persona 2 — Personnel EHPAD

Nom : Paul  
Age : 45 ans

Objectifs :

- Livrer repas efficacement
- Surveiller robot

---

# 3. Use Cases

## Tableau des Use Cases

|ID|Nom|Acteur|Description|
|---|---|---|---|
|UC-01|Livrer médicament|Infirmier|Robot livre médicament|
|UC-02|Livrer repas|Personnel|Robot livre repas|
|UC-03|Navigation autonome|Robot|Robot se déplace seul|
|UC-04|Éviter obstacles|Robot|Robot évite obstacles|
|UC-05|Retour base|Robot|Robot retourne base|
|UC-06|Sortie poubelle|Personnel|Robot transporte déchets|

---

## UC-01 : Livrer médicament (détaillé)

Acteur : Infirmier

Préconditions :

- Robot connecté

- Carte navigation chargée


Scénario nominal :

1. Infirmier sélectionne chambre

2. Interface envoie commande

3. Serveur MQTT transmet commande

4. Robot navigue

5. Robot livre médicament

6. Robot envoie confirmation


Postconditions :

- Livraison terminée


---

## UC-02 : Livrer repas (détaillé)

Processus identique au UC-01.

---

# 4. Architecture technique

Architecture globale :

```
Infirmier
   │
   ▼
Interface Web
   │ WebSocket
   ▼
Serveur MQTT
   │ MQTT
   ▼
Robot ROSMASTER M3 Pro
   │
   ├── Navigation (ROS2 Nav2)
   ├── Vision (OpenCV)
   ├── Lidar Dual ToF
   └── Capteurs sécurité
```

---

# 5. Diagrammes UML :


![Diagramme d’architecture](Images/Pasted%20image%2020260217150427.png)

![Diagramme de séquence](images/Pasted%20image%2020260217152148.png)

---

# 6. Stack technique

|Composant|Technologie|Justification|
|---|---|---|
|Robot OS|ROS2|Standard robotique|
|Robot compute|Jetson Nano / Orin NX|IA embarquée|
|Langage|Python|Compatible ROS2|
|Vision|OpenCV|Vision ordinateur|
|Communication|MQTT|Communication robot fiable|
|Communication|WebSocket|Communication temps réel|
|Interface|React|Interface moderne|
|Navigation|Nav2|Navigation autonome|

---

## Alternatives écartées

| Technologie | Raison                 |
| ----------- | ---------------------- |
| Socket.io   | trop lourd             |
| Arduino     | puissance insuffisante |

---

# 7. Risques et contraintes

## Risques

| Risque              | Probabilité | Impact   | Mitigation           |
| ------------------- | ----------- | -------- | -------------------- |
| Collision           | Moyen       | Critique | Lidar + Vision       |
| Perte connexion     | Moyen       | Moyen    | Reconnexion MQTT     |
| Bug ROS2            | Faible      | Moyen    | Tests                |
| Erreur de livraison | Moyen       | Critique | Révisions régulières |

---

## Contraintes

Hardware :

- ROSMASTER M3 Pro obligatoire


Software :

- ROS2 obligatoire


Environnement :

- Utilisation intérieure uniquement


---

# 8. Sécurité

Mesures :

- Détection obstacles

- Arrêt urgence

- Surveillance capteurs

- Vision OpenCV

---

# 9. Conventions équipe

Git :

Branches :

```
feature/navigation
feature/mqtt
feature/interface
```

Commits :

```
[FEAT]:
[FIX]:
[DOCS]:
```
- Conflits : rebase sur main, resolution en binome
- Review obligatoire avant merge

---

# 10. Architecture ROS2

Nodes :

```
navigation_node
delivery_node
vision_node
obstacle_avoidance_node
mqtt_node
interface_node
safety_node
trash_node
```

---

# 11. Roadmap

|Phase|Objectif|
|---|---|
|Phase 1|Installation ROS2|
|Phase 2|Navigation autonome|
|Phase 3|Communication MQTT|
|Phase 4|Interface|
|Phase 5|Livraison|
|Phase 6|Sortie poubelles|

---

# 12. Questions ouvertes

-  Faut-il ajouter reconnaissance QR code ?
-  Faut-il ajouter IA détection personnes ?
-  Faut-il ajouter multi-robots ?

---

# 13. Résultat attendu

Robot capable de :

- recevoir commandes

- naviguer autonome

- éviter obstacles

- livrer médicaments

- livrer repas

- communiquer temps réel

- sortir poubelles (optionnel)
