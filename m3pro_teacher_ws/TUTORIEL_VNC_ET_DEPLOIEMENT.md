# Tutoriel: configurer VNC et deployer le workspace sur un robot

Ce tutoriel est pour l'enseignant. Les etudiants peuvent ensuite faire
l'exercice ROS2 sans utiliser les scripts automatiques.

Objectifs:

1. Activer VNC sur le Jetson pour voir RViz.
2. Deployer ce workspace sur un robot en specifiant son adresse IP.
3. Construire les packages ROS2 dans le conteneur Docker du robot.

Dans les exemples, remplacez l'IP si besoin:

```text
192.168.50.102
```

## 1. Verifier SSH

Depuis macOS, Linux ou WSL sur Windows:

```bash
ssh jetson@192.168.50.102 'hostname && whoami'
```

Resultat attendu:

```text
jetson-desktop
jetson
```

Si SSH demande encore un mot de passe, installez votre cle publique:

```bash
ssh-copy-id -i ~/.ssh/id_ed25519.pub jetson@192.168.50.102
```

Puis retestez:

```bash
ssh -o BatchMode=yes jetson@192.168.50.102 'hostname && whoami'
```

## 2. Configurer VNC sur le Jetson

Le Yahboom/Jetson utilise souvent `vino-server` pour le partage d'ecran GNOME.

### Methode rapide avec le script du workspace

Depuis macOS, Linux ou WSL sur Windows:

```bash
cd ~/m3pro_teacher_ws
chmod +x scripts/setup_vnc_on_robot.sh
./scripts/setup_vnc_on_robot.sh 192.168.50.102
```

Le script est idempotent: si VNC est deja configure avec mot de passe et ecoute
sur `5900`, il ne change rien.

Ouverture automatique du client VNC:

- macOS: utilise `open`.
- Linux: utilise `xdg-open` si disponible.
- WSL: utilise `powershell.exe` ou `cmd.exe` pour ouvrir le client Windows.

Pour ne pas ouvrir automatiquement le client VNC:

```bash
OPEN_VNC=0 ./scripts/setup_vnc_on_robot.sh 192.168.50.102
```

Sur Linux/WSL, le mot de passe est demande dans le terminal en saisie cachee.
Sur macOS, le script utilise une boite de dialogue AppleScript si disponible.

Pour forcer un nouveau mot de passe VNC:

```bash
RESET_VNC_PASSWORD=1 ./scripts/setup_vnc_on_robot.sh 192.168.50.102
```

Verifiez si Vino ecoute deja:

```bash
ssh jetson@192.168.50.102 'ps -ef | grep vino | grep -v grep || true; ss -ltnp 2>/dev/null | grep 5900 || true'
```

### Methode recommandee sur Mac: mot de passe cache

Cette commande demande le mot de passe VNC dans une boite macOS cachee, puis le
configure sur le Jetson.

```bash
ROBOT_IP=192.168.50.102
ROBOT_USER=jetson

VNC_PASSWORD="$(
  osascript \
    -e "display dialog \"Mot de passe VNC pour $ROBOT_USER@$ROBOT_IP\" default answer \"\" with hidden answer buttons {\"Cancel\", \"OK\"} default button \"OK\"" \
    -e 'text returned of result'
)"

VNC_B64="$(printf '%s' "$VNC_PASSWORD" | base64)"
unset VNC_PASSWORD

ssh "$ROBOT_USER@$ROBOT_IP" "
  gsettings set org.gnome.Vino require-encryption false
  gsettings set org.gnome.Vino authentication-methods \"['vnc']\"
  gsettings set org.gnome.Vino vnc-password '$VNC_B64'
  pkill vino-server 2>/dev/null || true
  DISPLAY=:0 /usr/lib/vino/vino-server >/home/$ROBOT_USER/vino.log 2>&1 &
  sleep 1
  gsettings get org.gnome.Vino authentication-methods
  gsettings get org.gnome.Vino require-encryption
  ss -ltnp 2>/dev/null | grep 5900 || true
"

unset VNC_B64
```

Pourquoi `require-encryption false` ?

```text
Vino utilise un ancien protocole VNC. Le client "Screen Sharing" de macOS se
connecte souvent plus facilement quand le chiffrement Vino est desactive.
Faites cela uniquement sur un reseau local de confiance.
```

## 3. Ouvrir VNC depuis le Mac

Depuis le Mac:

```bash
open vnc://192.168.50.102:5900
```

Ou dans Finder:

```text
Go > Connect to Server > vnc://192.168.50.102:5900
```

Ce que vous devez voir:

- le bureau du Jetson;
- les fenetres lancees avec `DISPLAY=:0`;
- RViz quand un launch le demarre.

Si la connexion echoue:

```bash
ssh jetson@192.168.50.102 'ss -ltnp 2>/dev/null | grep 5900 || true'
```

Si rien n'ecoute sur `5900`, relancez Vino:

```bash
ssh jetson@192.168.50.102 'DISPLAY=:0 /usr/lib/vino/vino-server >/home/jetson/vino.log 2>&1 &'
```

## 4. Deployer le workspace en specifiant l'IP

Depuis le Mac, placez-vous dans le workspace:

```bash
cd ~/m3pro_teacher_ws
```

Rendez le script executable:

```bash
chmod +x scripts/deploy_workspace_to_robot.sh
```

Deploiement standard:

```bash
./scripts/deploy_workspace_to_robot.sh 192.168.50.102
```

Ce que fait le script:

1. copie le workspace local vers le Jetson avec `rsync`;
2. detecte le conteneur Docker Yahboom/M3Pro;
3. copie le workspace dans Docker sous `/root/m3pro_teacher_ws`;
4. lance `colcon build --symlink-install`.

Resultat attendu:

```text
Summary: 2 packages finished
Deploy complete.
```

## 5. Options utiles du script de deploiement

Changer l'utilisateur SSH:

```bash
ROBOT_USER=jetson ./scripts/deploy_workspace_to_robot.sh 192.168.50.102
```

Forcer un nom de conteneur Docker:

```bash
CONTAINER=vibrant_lehmann ./scripts/deploy_workspace_to_robot.sh 192.168.50.102
```

Copier seulement sur le Jetson host, sans toucher au conteneur Docker:

```bash
BUILD=0 ./scripts/deploy_workspace_to_robot.sh 192.168.50.102
```

Utilisez cette option pour synchroniser des documents. Pour modifier des
packages ROS2, gardez `BUILD=1`, qui est la valeur par defaut.

Deployer un autre dossier workspace:

```bash
./scripts/deploy_workspace_to_robot.sh 192.168.50.102 ~/m3pro_teacher_ws
```

Deployer vers un autre robot:

```bash
./scripts/deploy_workspace_to_robot.sh 192.168.50.103
```

## 6. Tester apres deploiement

Connectez-vous au robot:

```bash
ssh jetson@192.168.50.102
```

Trouvez le conteneur:

```bash
docker ps --format '{{.Names}}  {{.Image}}'
```

Entrez dans Docker:

```bash
docker exec -it \
  -e ROS_DOMAIN_ID=30 \
  -e FASTDDS_BUILTIN_TRANSPORTS=UDPv4 \
  -e DISPLAY=:0 \
  NOM_CONTENEUR \
  bash
```

Sourcez les workspaces:

```bash
source /opt/ros/humble/setup.bash
source /root/yahboomcar_ws/install/setup.bash 2>/dev/null || true
source /root/M3Pro_ws/install/setup.bash 2>/dev/null || true
source /root/m3pro_teacher_ws/install/setup.bash
```

Verifiez les packages:

```bash
ros2 pkg list | grep m3pro_teacher
```

Resultat attendu:

```text
m3pro_teacher_demos
m3pro_teacher_description
```

Verifiez les arguments du launch live:

```bash
ros2 launch m3pro_teacher_demos live_showcase.launch.py --show-args
```

Vous devez voir:

```text
rviz
camera_topic
danger_distance_m
caution_distance_m
enable_beep
```

## 7. Lancer RViz apres deploiement

Dans Docker, avec VNC ouvert:

```bash
ros2 launch m3pro_teacher_demos live_showcase.launch.py \
  rviz:=true \
  camera_topic:=/camera/color/image_raw \
  enable_beep:=false
```

Ce que vous devez voir:

- RViz sur l'ecran du Jetson via VNC;
- le modele URDF du robot;
- les frames TF;
- `/teacher/scan_merged`;
- la LED RGB qui reagit;
- pas de buzzer.

## 8. Commande d'urgence pour couper le buzzer

Dans Docker:

```bash
ros2 topic pub --once -w 0 /beep std_msgs/msg/UInt16 "{data: 0}"
```

## 9. Resume

Pour un nouveau robot:

```bash
cd ~/m3pro_teacher_ws
./scripts/deploy_workspace_to_robot.sh IP_DU_ROBOT
open vnc://IP_DU_ROBOT:5900
```

Puis faites l'exercice et la demonstration normalement.
