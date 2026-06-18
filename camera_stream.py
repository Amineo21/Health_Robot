import time
import threading
import numpy as np
import cv2
from flask import Flask, Response
import rclpy
from rclpy.node import Node
from sensor_msgs.msg import CompressedImage

app = Flask(__name__)
latest_frame = None
lock = threading.Lock()

class CameraNode(Node):
    def __init__(self):
        super().__init__("camera_stream")
        self.create_subscription(
            CompressedImage,
            "/camera/color/image_raw/compressed",
            self.cb, 10
        )

    def cb(self, msg):
        global latest_frame
        buf = np.frombuffer(bytes(msg.data), dtype=np.uint8)
        img = cv2.imdecode(buf, cv2.IMREAD_COLOR)
        img = cv2.flip(img, -1)
        _, encoded = cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, 80])
        with lock:
            latest_frame = encoded.tobytes()

def gen():
    while True:
        time.sleep(0.09)
        with lock:
            frame = latest_frame
        if frame:
            yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + frame + b"\r\n")

@app.route("/stream")
def stream():
    return Response(gen(), mimetype="multipart/x-mixed-replace; boundary=frame")

@app.route("/health")
def health():
    return {"status": "ok"}

rclpy.init()
node = CameraNode()
t = threading.Thread(target=lambda: rclpy.spin(node), daemon=True)
t.start()
app.run(host="0.0.0.0", port=8080, threaded=True)
