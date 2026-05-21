# Lancer le front-end :
  1.  Aller dans le dossier du projet :
      - cd carebot-control
  2. Installer les dépendances : 
      - pnpm install
  3. Lancer l'interface : 
      - pnpm dev

## Variables d'environnement (Docker)

Copier `infra/.env.example` vers `infra/.env` (ne pas committer `infra/.env`).

Variables attendues dans `infra/.env`:

```env
MQTT_BROKER=
DB_HOST=
DB_PORT=
MYSQL_USER=
MYSQL_DATABASE=
MYSQL_PASSWORD=
MYSQL_ROOT_PASSWORD=
MQTT_HOST=
MQTT_PORT=
```

Membre du groupe :
- OUARDI Ahmed-Amine
- EHOUARA Christ-Yvann
- KOMOE Daniel
- SACKO Ousmane
- DRAME Baboye
