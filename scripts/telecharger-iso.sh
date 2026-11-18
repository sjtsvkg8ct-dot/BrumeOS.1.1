#!/usr/bin/env bash
# Télécharge l'image ISO de Brume OS depuis les releases GitHub de ton dépôt (macOS et Linux).
#
#   bash telecharger-iso.sh <ton-nom-github> [nom-du-dépôt] [dossier]
#   ex. : bash telecharger-iso.sh camille-roy
#
# - Prend l'ISO de la release la plus récente qui en a une.
# - Reprend là où il s'était arrêté si la connexion coupe : relance simplement la même commande.
# - Vérifie le fichier (empreinte SHA-256 donnée par GitHub) avant de le déclarer prêt.
# - Dépôt privé : crée un jeton sur github.com/settings/tokens, puis
#     GITHUB_TOKEN=ton_jeton bash telecharger-iso.sh camille-roy
set -euo pipefail

OWNER="${1:-}"
REPO="${2:-brume-os}"
DEST="${3:-}"
API="${BRUME_API:-https://api.github.com}"
TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-}}"

die() { printf '\n%s\n' "$*" >&2; exit 1; }
go() { awk -v b="$1" 'BEGIN{ g=b/1e9; if(g>=1) s=sprintf("%.2f Go",g); else s=sprintf("%.0f Mo",b/1e6); gsub(/\./,",",s); print s }'; }

[ -n "$OWNER" ] || die "Indique ton nom GitHub : bash $0 <ton-nom-github> [nom-du-dépôt]"
command -v curl >/dev/null 2>&1 || die "curl est introuvable sur cet ordinateur."
if [ -z "$DEST" ]; then
  for d in "$HOME/Downloads" "$HOME/Téléchargements"; do [ -d "$d" ] && { DEST="$d"; break; }; done
  [ -n "$DEST" ] || DEST="$PWD"
fi
[ -d "$DEST" ] || die "Le dossier « $DEST » n'existe pas."

HDR=(-H "Accept: application/vnd.github+json" -H "User-Agent: brume-os-iso")
[ -n "$TOKEN" ] && HDR+=(-H "Authorization: Bearer $TOKEN")

printf 'Recherche de l’image dans %s/%s…\n' "$OWNER" "$REPO"
TMP="$(mktemp)"; trap 'rm -f "$TMP"' EXIT
CODE="$(curl -sS -L -o "$TMP" -w '%{http_code}' "${HDR[@]}" "$API/repos/$OWNER/$REPO/releases?per_page=20")" || die "Impossible de joindre GitHub. Vérifie ta connexion à Internet."
case "$CODE" in
  200) ;;
  404) die "Dépôt « $OWNER/$REPO » introuvable. Vérifie ton nom GitHub et le nom du dépôt (s'il est privé, ajoute un jeton : voir en tête de ce fichier)." ;;
  401) die "Le jeton GitHub est refusé (GITHUB_TOKEN)." ;;
  403|429) die "GitHub limite les demandes pour le moment. Réessaie dans une heure, ou ajoute un jeton." ;;
  *) die "GitHub a répondu avec l'erreur $CODE." ;;
esac

# Lecture de la réponse (JSON) sans outil supplémentaire : une valeur par ligne, puis on suit les releases
# (de la plus récente à la plus ancienne) et leurs fichiers. Première ISO trouvée : celle qu'on prend.
FOUND="$(tr '{}[],' '\n\n\n\n\n' < "$TMP" | sed 's/^[[:space:]]*//' | awk '
  function str(l){ sub(/^"[^"]*"[[:space:]]*:[[:space:]]*"/,"",l); sub(/"[[:space:]]*$/,"",l); return l }
  function num(l){ sub(/^"[^"]*"[[:space:]]*:[[:space:]]*/,"",l); sub(/[[:space:]]*$/,"",l); return l }
  /^"tag_name"[[:space:]]*:/ { tag=str($0) }
  /^"draft"[[:space:]]*:/ { draft=(num($0)=="true"); if(!draft && first=="") first=tag }
  /^"url"[[:space:]]*:/ { u=str($0); if(u ~ /\/releases\/assets\/[0-9]+$/){ aurl=u; name=""; size=""; dig="" } }
  /^"name"[[:space:]]*:/ { name=str($0) }
  /^"size"[[:space:]]*:/ { size=num($0) }
  /^"digest"[[:space:]]*:/ { dig=str($0) }
  /^"browser_download_url"[[:space:]]*:/ { b=str($0); if(b ~ /\.iso$/ && !draft && out==""){ out=tag "\t" name "\t" size "\t" dig "\t" aurl "\t" b } }
  END { if(out!="") print first "\t" out; else if(first!="") print first }')"

LATEST="$(printf '%s' "$FOUND" | cut -f1)"
[ -n "$LATEST" ] || die "Ce dépôt n'a pas encore de release. Crée-en une (Releases → Draft a new release) : GitHub fabrique alors l'ISO, en 30 à 60 minutes."
TAG="$(printf '%s' "$FOUND" | cut -s -f2)"
[ -n "$TAG" ] || die "La release $LATEST n'a pas encore d'ISO : sa fabrication est peut-être en cours (onglet Actions du dépôt). Réessaie quand elle est terminée."
NAME="$(printf '%s' "$FOUND" | cut -s -f3)"
SIZE="$(printf '%s' "$FOUND" | cut -s -f4)"
DIGEST="$(printf '%s' "$FOUND" | cut -s -f5)"
AURL="$(printf '%s' "$FOUND" | cut -s -f6)"
BURL="$(printf '%s' "$FOUND" | cut -s -f7)"
case "$NAME" in */*|..*|'') die "Nom de fichier inattendu dans la release : « $NAME »." ;; esac

[ "$TAG" = "$LATEST" ] || printf 'La release %s n’a pas encore son ISO (fabrication en cours ?) : je prends celle de %s.\n' "$LATEST" "$TAG"
printf 'Image : %s (%s), release %s\n' "$NAME" "$(go "$SIZE")" "$TAG"

FILE="$DEST/$NAME"; PART="$FILE.part"
have() { [ -f "$1" ] && wc -c < "$1" | tr -d ' ' || echo 0; }

if [ "$(have "$FILE")" = "$SIZE" ]; then
  printf 'Déjà téléchargée : %s\n' "$FILE"
elif [ "$(have "$PART")" = "$SIZE" ]; then
  mv -f "$PART" "$FILE"
else
  # Place libre (en Ko) dans le dossier de destination
  FREE="$(df -Pk "$DEST" | awk 'NR==2{print $4}')"
  NEED=$(( (SIZE - $(have "$PART")) / 1024 + 102400 ))
  [ -z "$FREE" ] || [ "$FREE" -ge "$NEED" ] || die "Pas assez de place dans « $DEST » : il faut $(go $((NEED*1024))) de libre."
  [ "$(have "$PART")" -gt 0 ] && printf 'Reprise du téléchargement à %s.\n' "$(go "$(have "$PART")")"
  printf 'Téléchargement vers %s\n' "$DEST"
  # Si la connexion coupe, curl reprend où il en était (-C -), jusqu'à 5 fois
  if [ -n "$TOKEN" ]; then GET=(-H "Authorization: Bearer $TOKEN" -H "Accept: application/octet-stream" "$AURL"); else GET=("$BURL"); fi
  n=0
  until curl -L --fail --retry 3 --retry-delay 3 -C - -# -o "$PART" -H "User-Agent: brume-os-iso" "${GET[@]}"; do
    n=$((n+1))
    [ "$n" -lt 5 ] || die "Le téléchargement s'est arrêté. Relance la même commande : il reprendra où il en était."
    printf 'Connexion interrompue : reprise dans 3 secondes (essai %d sur 4)…\n' "$n"; sleep 3
  done
  [ "$(have "$PART")" = "$SIZE" ] || die "Le fichier reçu n'a pas la bonne taille. Supprime « $PART » et relance la commande."
  mv -f "$PART" "$FILE"
fi

# Vérification : l'empreinte SHA-256 que GitHub calcule pour chaque fichier de release
case "$DIGEST" in
  sha256:*)
    printf 'Vérification du fichier…\n'
    if command -v sha256sum >/dev/null 2>&1; then SUM="$(sha256sum "$FILE" | cut -d' ' -f1)"
    else SUM="$(shasum -a 256 "$FILE" | cut -d' ' -f1)"; fi
    if [ "$SUM" != "${DIGEST#sha256:}" ]; then
      mv -f "$FILE" "$FILE.abime"
      die "Le fichier est abîmé (empreinte différente) : je l'ai renommé « $NAME.abime ». Supprime-le et relance la commande."
    fi
    printf 'Fichier vérifié (SHA-256).\n' ;;
  *) printf 'GitHub ne donne pas d’empreinte pour ce fichier : taille vérifiée seulement.\n' ;;
esac

printf '\nImage prête : %s\n' "$FILE"
printf 'Pour la mettre sur une clé USB : balenaEtcher (etcher.balena.io), ou Rufus sous Windows.\n'
printf 'Pour l’essayer sans rien toucher : une machine virtuelle VirtualBox (Linux, Debian 64-bit).\n'
