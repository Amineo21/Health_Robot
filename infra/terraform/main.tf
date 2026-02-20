terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
  }

  required_version = ">= 1.6.0"
}

provider "docker" {}

# Réseau docker pour l'application Health Robot
resource "docker_network" "health_robot_network" {
  name = "health_robot_network"
}

# Volume docker pour les données Mosquitto (équivalent à ./mosquitto/data)
resource "docker_volume" "mosquitto_data" {
  name = "mosquitto_data"
}

# Volume docker pour la config Mosquitto (équivalent à ./mosquitto/config)
resource "docker_volume" "mosquitto_config" {
  name = "mosquitto_config"
}

# TODO plus tard :
# - VM cloud avec Docker pré-installé
# - Déploiement automatisé des containers (ou déclenché par GitHub Actions)
