# Extraits de code : paquet `m3pro_teacher_web`

Objectif : repérer les parties importantes du tableau de bord web qui
permet de surveiller et piloter le robot depuis un navigateur.

Chemin du paquet :

```text
src/m3pro_teacher_web/
├── m3pro_teacher_web/
│   └── web_server_node.py       # serveur HTTP + flux caméra MJPEG
├── web/
│   └── index.html               # UI (canvas carte + roslibjs)
└── launch/
    └── web_dashboard.launch.py  # lance rosbridge + web_server
```

Architecture :

```text
Navigateur (PC)                     Jetson (robot)
┌──────────────────┐       ┌──────────────────────┐
│  index.html      │←HTTP→ │  web_server_node     │
│  (roslibjs +     │       │  (port 8080)         │
│   canvas)        │← WS → │  rosbridge           │
│                  │       │  (port 9090)         │
└──────────────────┘       └───────┬──────────────┘
                                   │
                           ┌───────▼──────────┐
                           │  Topics ROS2     │
                           │  /map /odom ...  │
                           └──────────────────┘
```

---

## 1. `web_server_node.py` — Serveur HTTP + flux caméra

**Rôle** : servir les fichiers statiques (HTML/JS/CSS) sur le port 8080,
et fournir un flux MJPEG de la caméra à `http://IP:8080/camera/stream`.

### Partie importante 1 : double handler HTTP

```python
# fichier: web_server_node.py, ligne ~38
class CameraSnapshotHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/camera/snapshot":
            self.serve_snapshot()                # une image JPEG
        elif self.path == "/camera/stream":
            self.serve_mjpeg_stream()            # flux continu MJPEG
        else:
            super().do_GET()                     # fichiers statiques (index.html...)
```

### Partie importante 2 : flux MJPEG

```python
# fichier: web_server_node.py, méthode serve_mjpeg_stream, ligne ~59
self.send_response(200)
self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
self.end_headers()
while True:
    jpeg = self.jpeg_getter()
    if jpeg is not None:
        self.wfile.write(b"--frame\r\n")
        self.wfile.write(b"Content-Type: image/jpeg\r\n")
        self.wfile.write(f"Content-Length: {len(jpeg)}\r\n\r\n".encode())
        self.wfile.write(jpeg)
        self.wfile.write(b"\r\n")
    time.sleep(0.15)                             # ~6 FPS (bande passante)
```

> Le navigateur affiche ce flux comme une image `<img>` qui se rafraîchit
> toute seule. Pas besoin de JavaScript côté client.

### Partie importante 3 : conversion Image ROS → JPEG

```python
# fichier: web_server_node.py, méthode on_image, ligne ~114
if encoding in ("rgb8",):
    arr = np.frombuffer(data, dtype=np.uint8).reshape(h, w, 3)
    arr = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)  # OpenCV attend du BGR
# ...

# Downscale pour économiser la bande passante (max 320 px de large)
if w > 320:
    scale = 320.0 / w
    arr = cv2.resize(arr, (320, int(h * scale)))

_, jpeg_buf = cv2.imencode(".jpg", arr, [cv2.IMWRITE_JPEG_QUALITY, 60])
with self.jpeg_lock:
    self.latest_jpeg = jpeg_buf.tobytes()
```

> Côté robot, on encode en JPEG avec une qualité de 60 et on redimensionne
> à 320 px. Résultat : ~10-20 Ko par image au lieu de plusieurs Mo.

### Partie importante 4 : serveur HTTP dans un thread

```python
# fichier: web_server_node.py, ligne ~104
from ament_index_python.packages import get_package_share_directory
web_dir = str(Path(get_package_share_directory("m3pro_teacher_web")) / "web")

handler = partial(CameraSnapshotHandler,
                  jpeg_getter=self.get_jpeg,
                  directory=web_dir)
self.httpd = HTTPServer(("0.0.0.0", self.port), handler)
self.http_thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
self.http_thread.start()
```

> Le noeud ROS et le serveur HTTP tournent dans le même processus, sur
> des threads différents. `0.0.0.0` = toutes les interfaces réseau.

---

## 2. `index.html` — Interface web avec roslibjs

**Rôle** : afficher la carte, la caméra, l'état du robot, et permettre
d'envoyer des objectifs en cliquant sur la carte.

### Partie importante 1 : connexion rosbridge

```javascript
// fichier: index.html, ligne ~115
const host = window.location.hostname || 'localhost';
const ros = new ROSLIB.Ros({ url: `ws://${host}:9090` });

ros.on('connection', () => {
    statusEl.textContent = 'CONNECTED';
    statusEl.className = 'connected';
});
ros.on('close',      () => { statusEl.textContent = 'DISCONNECTED'; });
ros.on('error',      (e) => { log('Connection error'); });
```

> roslibjs encapsule le WebSocket et parle le protocole rosbridge (JSON).
> Le `host` est deviné depuis l'URL actuelle : pas besoin de le coder en
> dur.

### Partie importante 2 : s'abonner à la carte

```javascript
// fichier: index.html, ligne ~138
const mapTopic = new ROSLIB.Topic({
    ros,
    name: '/map',
    messageType: 'nav_msgs/msg/OccupancyGrid'
});
mapTopic.subscribe((msg) => {
    mapData = msg;
    drawMap();
});
```

### Partie importante 3 : dessiner la carte sur canvas

```javascript
// fichier: index.html, fonction drawMap, ligne ~155
const imgData = ctx.createImageData(w, h);
for (let i = 0; i < mapData.data.length; i++) {
    const v = mapData.data[i];
    let r, g, b;
    if      (v === -1) { r = 40;  g = 42;  b = 50;  }    // inconnu (gris)
    else if (v === 0)  { r = 24;  g = 26;  b = 34;  }    // libre   (sombre)
    else               { r = 220; g = 220; b = 230; }    // obstacle (clair)
    imgData.data[i * 4]     = r;
    imgData.data[i * 4 + 1] = g;
    imgData.data[i * 4 + 2] = b;
    imgData.data[i * 4 + 3] = 255;
}
```

> Chaque cellule de `OccupancyGrid.data` devient un pixel. 3 couleurs :
> libre, obstacle, inconnu — exactement comme dans RViz.

### Partie importante 4 : convertir clic → coordonnées carte

```javascript
// fichier: index.html, ligne ~212
mapCanvas.addEventListener('click', (e) => {
    const rect = mapCanvas.getBoundingClientRect();
    const scaleX = mapCanvas.width / rect.width;
    const scaleY = mapCanvas.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top)  * scaleY;

    // Pixel → mètres avec origine et résolution de la carte
    const info  = mapData.info;
    const scale = Math.min(mapCanvas.width / info.width,
                           mapCanvas.height / info.height);
    const mapX  = px / scale * info.resolution + info.origin.position.x;
    const mapY  = (mapCanvas.height - py) / scale * info.resolution
                  + info.origin.position.y;

    clickedMapPoint = { x: mapX, y: mapY };
});
```

> Attention à l'axe Y inversé : pixel Y croît vers le bas, mais la carte
> croît vers le haut (convention ROS).

### Partie importante 5 : envoyer un objectif Nav2

```javascript
// fichier: index.html, ligne ~348
const goalPub = new ROSLIB.Topic({
    ros, name: '/goal_pose',
    messageType: 'geometry_msgs/msg/PoseStamped'
});

function sendGoalFromClick() {
    const goal = new ROSLIB.Message({
        header: { frame_id: 'map' },
        pose: {
            position:    { x: clickedMapPoint.x, y: clickedMapPoint.y, z: 0.0 },
            orientation: { x: 0, y: 0, z: 0, w: 1.0 }   // quaternion nul
        }
    });
    goalPub.publish(goal);
}
```

> C'est exactement ce que fait le bouton "2D Goal Pose" de RViz, mais
> depuis le navigateur.

### Partie importante 6 : décoder une image ROS en base64

```javascript
// fichier: index.html, fonction renderRosImage, ligne ~301
const raw = atob(msg.data);                  // rosbridge envoie en base64
const enc = msg.encoding.toLowerCase();
for (let i = 0; i < msg.width * msg.height; i++) {
    let r, g, b;
    if (enc === 'rgb8') {
        r = raw.charCodeAt(i * 3);
        g = raw.charCodeAt(i * 3 + 1);
        b = raw.charCodeAt(i * 3 + 2);
    } else if (enc === 'bgr8') {
        b = raw.charCodeAt(i * 3);
        g = raw.charCodeAt(i * 3 + 1);
        r = raw.charCodeAt(i * 3 + 2);
    }
    imgData.data[i * 4]     = r;
    imgData.data[i * 4 + 1] = g;
    imgData.data[i * 4 + 2] = b;
    imgData.data[i * 4 + 3] = 255;
}
```

> Utilisé pour les images annotées (détection, obstacles). Lent en
> pratique, d'où le MJPEG pour le flux live.

### Partie importante 7 : appel d'un service ROS (sauvegarde carte)

```javascript
// fichier: index.html, fonction saveMap, ligne ~369
const service = new ROSLIB.Service({
    ros,
    name: '/slam_toolbox/save_map',
    serviceType: 'slam_toolbox/srv/SaveMap'
});
const request = new ROSLIB.ServiceRequest({ name: { data: '/tmp/m3pro_map' } });
service.callService(request,
    (result) => { log('Map saved to /tmp/m3pro_map'); },
    (error)  => { log('Map save failed: ' + error); }
);
```

> rosbridge supporte aussi les services, pas seulement les topics.

### Partie importante 8 : extraction du yaw depuis un quaternion

```javascript
// fichier: index.html, ligne ~232
const q = msg.pose.pose.orientation;
const yaw = Math.atan2(
    2 * (q.w * q.z + q.x * q.y),
    1 - 2 * (q.y * q.y + q.z * q.z)
);
```

> Formule standard pour récupérer l'angle de lacet d'un quaternion (pour
> afficher une flèche de direction du robot).

---

## 3. `web_dashboard.launch.py` — Lancer le dashboard

### Partie importante : les deux serveurs

```python
# fichier: web_dashboard.launch.py, ligne ~30
# rosbridge WebSocket (port 9090) — inclusion du launch officiel
IncludeLaunchDescription(
    PythonLaunchDescriptionSource(
        PathJoinSubstitution([rosbridge_share, "launch",
                              "rosbridge_websocket_launch.xml"])
    ),
),

# Serveur HTTP + flux caméra (port 8080)
Node(
    package="m3pro_teacher_web",
    executable="web_server_node",
    parameters=[{
        "port": ParameterValue(LaunchConfiguration("port"), value_type=int),
        "camera_topic": LaunchConfiguration("camera_topic"),
    }],
    output="screen",
),
```

> **Port 8080** = fichiers HTML + flux caméra (HTTP).
> **Port 9090** = topics/services ROS (WebSocket rosbridge).
>
> Les deux sont nécessaires. Le navigateur ouvre d'abord le 8080 pour
> charger la page, puis la page ouvre une WebSocket vers le 9090.

---

## Résumé : quelle techno pour quoi ?

| Donnée                   | Transport                | Pourquoi                       |
| ------------------------ | ------------------------ | ------------------------------ |
| Fichiers HTML/JS/CSS     | HTTP (port 8080)         | standard, cacheable            |
| Flux caméra live         | HTTP MJPEG (port 8080)   | rapide, compressé côté robot   |
| Topics ROS (map, odom…)  | WebSocket rosbridge 9090 | bidirectionnel, JSON           |
| Services ROS (save map)  | WebSocket rosbridge 9090 | requête/réponse                |
| Images annotées détection| WebSocket (base64)       | déjà dans un topic ROS         |

Le tableau de bord est une démo de ce qu'on peut faire avec rosbridge +
roslibjs sans aucune installation côté ordinateur : un simple navigateur
suffit.
