#!/bin/bash
# Construit l'image ISO de Brume OS avec live-build (Debian 13 « trixie »).
# À lancer en root sur Debian, ou dans un conteneur debian:trixie --privileged.
# Avant de lancer : placer le paquet brume-os_*.deb dans config/packages.chroot/.
#
# L'image démarre directement sur Brume depuis une clé USB. Elle contient aussi
# l'installateur (Calamares) qui copie Brume sur le disque de l'ordinateur.
set -euo pipefail
cd "$(dirname "$0")"

if ! ls config/packages.chroot/brume-os_*.deb >/dev/null 2>&1; then
  echo "Paquet brume-os_*.deb introuvable dans config/packages.chroot/." >&2
  echo "Lancez « npx electron-builder --linux deb » puis copiez dist/*.deb à cet endroit." >&2
  exit 1
fi

# Les fichiers envoyés par l'interface web de GitHub perdent leur bit exécutable.
chmod +x config/hooks/normal/*.hook.chroot \
         config/includes.chroot/usr/local/bin/* \
         config/includes.chroot/usr/local/sbin/*

# - non-free-firmware : pilotes Wi-Fi, cartes graphiques et son des vrais PC.
# - persistence : si la clé a une partition « persistence » (option de Rufus),
#   les fichiers y sont gardés d'un démarrage à l'autre. Sans elle, rien ne change.
# - splash : écran de démarrage (Plymouth, thème « brume ») ; plymouth.use-simpledrm l'affiche dès le début
#   sur les PC récents (UEFI), sans attendre le pilote de la carte graphique ; loglevel=3 : pas de messages du noyau.
lb config \
  --distribution trixie \
  --archive-areas "main non-free-firmware" \
  --firmware-chroot false \
  --debian-installer none \
  --binary-images iso-hybrid \
  --iso-application "Brume OS" \
  --iso-publisher "Brume OS" \
  --iso-volume "BRUME_OS" \
  --memtest none \
  --bootappend-live "boot=live components persistence quiet splash loglevel=3 plymouth.use-simpledrm username=user hostname=brume locales=fr_FR.UTF-8 keyboard-layouts=fr timezone=Europe/Paris"

lb build

mv live-image-amd64.hybrid.iso brume-os-amd64.iso
echo "Image prête : linux/brume-os-amd64.iso"
