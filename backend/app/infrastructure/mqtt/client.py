from __future__ import annotations

import json
import logging
from typing import Any, Callable

import paho.mqtt.client as mqtt

from app.core.config import Settings
from app.domain.entities.mqtt_topics import SUBSCRIPTION_TOPICS

logger = logging.getLogger(__name__)

MessageHandler = Callable[[str, dict[str, Any]], None]


class MQTTService:
    def __init__(self, settings: Settings, on_message: MessageHandler | None = None) -> None:
        self._settings = settings
        self._on_message = on_message
        self._client = mqtt.Client(client_id=settings.mqtt_client_id, protocol=mqtt.MQTTv311)
        if settings.mqtt_username:
            self._client.username_pw_set(settings.mqtt_username, settings.mqtt_password)

        self._client.on_connect = self._handle_connect
        self._client.on_message = self._handle_message
        self._client.on_disconnect = self._handle_disconnect

    def set_message_handler(self, on_message: MessageHandler) -> None:
        self._on_message = on_message

    def start(self) -> None:
        try:
            self._client.connect(
                self._settings.mqtt_host,
                self._settings.mqtt_port,
                self._settings.mqtt_keepalive,
            )
            self._client.loop_start()
            logger.info("MQTT connecte sur %s:%s", self._settings.mqtt_host, self._settings.mqtt_port)
        except OSError as exc:
            logger.warning("MQTT indisponible au demarrage: %s", exc)

    def stop(self) -> None:
        self._client.loop_stop()
        try:
            self._client.disconnect()
        except OSError:
            logger.debug("Deconnexion MQTT ignoree car le client etait deja hors ligne")

    def publish_json(self, topic: str, payload: dict[str, Any], qos: int = 1, retain: bool = False) -> None:
        result = self._client.publish(topic, json.dumps(payload), qos=qos, retain=retain)
        if result.rc != mqtt.MQTT_ERR_SUCCESS:
            logger.warning("Echec de publication MQTT sur le topic %s avec le code %s", topic, result.rc)

    def _handle_connect(self, client: mqtt.Client, userdata: Any, flags: dict[str, Any], rc: int) -> None:
        if rc != 0:
            logger.warning("La connexion MQTT a retourne rc=%s", rc)
            return

        for topic, qos in SUBSCRIPTION_TOPICS:
            client.subscribe(topic, qos=qos)
        logger.info("Abonnements MQTT enregistres")

    def _handle_disconnect(self, client: mqtt.Client, userdata: Any, rc: int) -> None:
        if rc != 0:
            logger.warning("MQTT s'est deconnecte de facon inattendue rc=%s", rc)

    def _handle_message(self, client: mqtt.Client, userdata: Any, message: mqtt.MQTTMessage) -> None:
        if self._on_message is None:
            return

        try:
            payload = json.loads(message.payload.decode("utf-8"))
        except json.JSONDecodeError:
            logger.warning("Payload MQTT invalide recu sur le topic %s", message.topic)
            return

        self._on_message(message.topic, payload)
