#!/bin/bash
# Son du Mac pour Brume. Brume envoie ce script au Mac et le lance par SSH :
#   son.sh status | install | stream | stop
#
# macOS ne laisse pas un programme lancé par SSH écouter le son : c'est rangé avec le « micro ».
# Alors :
# - la sortie son du Mac va vers « BlackHole 2ch », une sortie virtuelle (gratuite, GPL-3.0) ;
# - un petit script lancé dans Terminal (qui, lui, peut demander l'accès au micro) l'enregistre
#   avec ffmpeg, le compresse en Opus et le pousse dans un tube ;
# - « stream » lit ce tube et l'envoie à Brume par la connexion SSH.
# « install » installe ce qu'il faut avec Homebrew : ffmpeg, SwitchAudioSource, BlackHole 2ch.
#
# Bash 3.2 (celui de macOS) : pas de tableaux associatifs ni de ${x,,}.
# Les lignes « @… » de la sortie d'erreur parlent à Brume : @step <étape>, @error <code>, @stream, @done.
# « status » écrit du JSON sur la sortie ; « stream » y écrit le son (Ogg Opus).

HAL="/Library/Audio/Plug-Ins/HAL"
if [ -n "${BRUME_SON_TEST:-}" ]; then
  # (tests de Brume, sur Linux : des outils simulés et un faux dossier des pilotes)
  export PATH="$BRUME_SON_TEST/bin:$BRUME_SON_TEST/sys"; HAL="$BRUME_SON_TEST/HAL"
else
  export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH:/usr/bin:/bin:/usr/sbin:/sbin"
fi
DEV="BlackHole 2ch"
BD="$HOME/Library/Application Support/Brume"
FIFO="$BD/son.fifo"
HELPER="$BD/brume-son.command"
mkdir -p "$BD" 2>/dev/null

say() { echo "$*" >&2; }
fail() { say "@error $1"; exit 3; }
step() { say "@step $1"; }
have() { command -v "$1" >/dev/null 2>&1; }
has_blackhole() { [ -d "$HAL/BlackHole2ch.driver" ]; }
in_gui() { [ "$(stat -f %Su /dev/console 2>/dev/null)" = "$(id -un)" ]; }
helper_running() { pgrep -f "brume-son.command" >/dev/null 2>&1; }
cur_output() { SwitchAudioSource -c -t output 2>/dev/null; }
json() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr -d '\n\r'; }

# La sortie son du Mac : BlackHole (l'ancienne est notée, pour la remettre ensuite)
set_output() {
  have SwitchAudioSource || return 1
  c=$(cur_output)
  if [ "$c" != "$DEV" ]; then
    [ -n "$c" ] && printf '%s' "$c" > "$BD/sortie-avant"
    SwitchAudioSource -t output -s "$DEV" >/dev/null 2>&1 || return 1
  fi
  SwitchAudioSource -t system -s "$DEV" >/dev/null 2>&1
  return 0
}
restore_output() {
  have SwitchAudioSource || return 0
  [ -s "$BD/sortie-avant" ] || return 0
  p=$(cat "$BD/sortie-avant")
  if [ "$(cur_output)" = "$DEV" ]; then
    SwitchAudioSource -t output -s "$p" >/dev/null 2>&1
    SwitchAudioSource -t system -s "$p" >/dev/null 2>&1
  fi
  rm -f "$BD/sortie-avant"
}

# Le script lancé dans Terminal. Écrit à côté puis renommé : une copie déjà lancée continue sans être dérangée.
write_helper() {
  cat > "$HELPER.new" <<'EOF'
#!/bin/bash
# Brume – son du Mac. Lancé dans Terminal par Brume : Terminal peut demander l'accès au « micro »,
# par lequel macOS laisse enregistrer la sortie « BlackHole 2ch ». Laissez cette fenêtre ouverte.
export PATH="${BRUME_SON_TEST:+$BRUME_SON_TEST/bin:}/opt/homebrew/bin:/usr/local/bin:$PATH"
BD="$HOME/Library/Application Support/Brume"
printf '\033]0;Brume – son du Mac\007'
echo "Brume – son du Mac. Laissez cette fenêtre ouverte (elle peut rester cachée)."
[ -p "$BD/son.fifo" ] || mkfifo "$BD/son.fifo"
while :; do
  [ "$(wc -c 2>/dev/null < "$BD/son.log" || echo 0)" -gt 200000 ] && : > "$BD/son.log"
  # Attend ici que Brume écoute ; s'arrête quand Brume n'écoute plus.
  ffmpeg -hide_banner -loglevel error -nostdin -f avfoundation -i ":BlackHole 2ch" \
    -ac 2 -ar 48000 -c:a libopus -b:a 96k -application lowdelay -frame_duration 20 \
    -f ogg -page_duration 20000 -flush_packets 1 - > "$BD/son.fifo" 2>> "$BD/son.log"
  sleep 0.3
done
EOF
  chmod 755 "$HELPER.new" && mv -f "$HELPER.new" "$HELPER"
}

status() {
  b=0; f=0; s=0; h=0; g=0; r=0; o=""
  have brew && b=1
  have ffmpeg && f=1
  have SwitchAudioSource && s=1
  has_blackhole && h=1
  in_gui && g=1
  helper_running && r=1
  [ $s = 1 ] && o=$(cur_output)
  v=$(sw_vers -productVersion 2>/dev/null)
  printf '{"brew":%s,"ffmpeg":%s,"switch":%s,"blackhole":%s,"gui":%s,"helper":%s,"output":"%s","macos":"%s","arch":"%s"}\n' \
    $b $f $s $h $g $r "$(json "$o")" "$(json "$v")" "$(json "$(uname -m)")"
}

# Installation : le mot de passe du Mac arrive sur la première ligne de l'entrée (jamais dans la commande).
install() {
  IFS= read -r PW || PW=""
  [ -n "$PW" ] || fail nopass
  umask 077
  PWF="$BD/.pw.$$"; ASK="$BD/.ask.$$"
  trap 'rm -f "$PWF" "$ASK"' EXIT
  printf '%s\n' "$PW" > "$PWF"; PW=""
  printf '#!/bin/sh\ncat "%s"\n' "$PWF" > "$ASK"; chmod 700 "$ASK"
  export SUDO_ASKPASS="$ASK"
  step check
  sudo -A -k -v >/dev/null 2>&1 || fail sudo
  export NONINTERACTIVE=1 HOMEBREW_NO_AUTO_UPDATE=1 HOMEBREW_NO_ANALYTICS=1 HOMEBREW_NO_ENV_HINTS=1 HOMEBREW_NO_INSTALL_CLEANUP=1
  if ! have brew; then
    step brew
    curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh -o "$BD/brew-install.sh" || fail net
    /bin/bash "$BD/brew-install.sh" < /dev/null >&2 || fail brew
    rm -f "$BD/brew-install.sh"
    for b in /opt/homebrew/bin/brew /usr/local/bin/brew; do
      if [ -x "$b" ]; then eval "$("$b" shellenv)"; break; fi
    done
    have brew || fail brew
  fi
  if ! have ffmpeg || ! have SwitchAudioSource; then
    step ffmpeg
    brew install ffmpeg switchaudio-osx < /dev/null >&2 || fail ffmpeg
  fi
  if ! has_blackhole; then
    step blackhole
    if ! brew install --cask blackhole-2ch < /dev/null >&2; then
      # Si Homebrew n'a pas pu l'installer lui-même : son paquet est déjà téléchargé
      pkg=$(brew --cache --cask blackhole-2ch 2>/dev/null)
      [ -f "$pkg" ] && sudo -A installer -pkg "$pkg" -target / >&2
    fi
    has_blackhole || fail blackhole
    # macOS relance son service audio : BlackHole apparaît sans redémarrer le Mac
    sudo -A killall coreaudiod >/dev/null 2>&1
    sleep 3
  fi
  step output
  set_output || fail output
  write_helper
  say "@done"
}

stream() {
  in_gui || fail gui
  { have ffmpeg && have SwitchAudioSource && has_blackhole; } || fail missing
  write_helper
  set_output || fail output
  [ -p "$FIFO" ] || { rm -f "$FIFO"; mkfifo "$FIFO" || fail fifo; }
  if ! helper_running; then
    open -g -j -a Terminal "$HELPER" >/dev/null 2>&1 || fail open
  fi
  say "@stream"
  exec cat "$FIFO"
}

stop() {
  pkill -f "cat $FIFO" >/dev/null 2>&1
  restore_output
  say "@done"
}

case "${1:-}" in
  status) status ;;
  install) install ;;
  stream) stream ;;
  stop) stop ;;
  *) fail usage ;;
esac
