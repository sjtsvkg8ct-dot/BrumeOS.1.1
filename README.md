# Brume OS

Un système de bureau imaginaire : fonds d'écran dessinés en direct qui suivent l'heure (ou tes propres images), Quai, fenêtres, le lanceur **Phare**, la boutique d'apps **Comptoir**, et des apps dont le navigateur **Vigie**, la messagerie **Courrier**, le lecteur de musique et de vidéos **Ressac**, une suite bureautique (**Plume**, **Abaque**, **Escale**) et une suite créative (**Reflet**, **Compas**, **Sillage**, **Folio**).

## Trois façons de l'utiliser

| | Version web | Application | Système Linux |
|---|---|---|---|
| Où | Tout appareil, téléphone compris | Windows, macOS, Linux | PC (sur une clé USB ou installé sur le disque), machine virtuelle |
| Sites du vrai Web dans Vigie | Seulement ceux qui acceptent d'apparaître dans une autre page | Tous | Tous |
| Apps du Comptoir (Apple Music, Netflix, Canal+, Prime Video, WhatsApp…) | Dans un onglet du navigateur | Dans leur propre fenêtre | Dans leur propre fenêtre |
| GeForce NOW (jeu en nuage) | Dans un onglet du navigateur | Dans sa propre fenêtre | En plein écran, avec une barre pour revenir à Brume |
| Courrier avec tes vrais comptes e-mail | Boîte de démonstration | Oui | Oui |
| AirDrop | Sur iPhone, iPad et Mac, par la feuille de partage de l'appareil | Sur un Mac, par le menu de partage de macOS | Expérimental, avec certaines cartes Wi-Fi (omdrop) |
| LocalSend (avec l'app LocalSend sur l'iPhone, Android…) | Non | Oui, envoi et réception | Oui, envoi et réception |
| Impression | Par la fenêtre d'impression du navigateur | Feuille « Imprimer » de Brume, PDF dans Documents | Pareil, plus l'ajout et le retrait des imprimantes |
| Ce qu'on télécharge | Rien, une adresse web | Un installateur | Une image ISO d'environ 2 Go |
| Place pour tes fichiers | Environ 5 Mo | Tout le disque | Tout le disque (ou la clé, avec une partition de conservation) |

## Fonds d'écran

**Réglages → Bureau** (ou clic droit sur le bureau → **Changer le fond d'écran…**) propose :

- **Cinq fonds dessinés en direct** : Crêtes, Estran, Dunes, Voiles et Lignes. Leur lumière suit l'heure (aube, jour, crépuscule, nuit), ou reste sur le moment choisi.
- **Ton image** : **Importer…** prend une photo de ton appareil, la range dans le dossier Images et la met en fond ; **Choisir…** reprend une image déjà dans Brume. Dans Fichiers (clic droit sur une image) et dans Aperçu, **Utiliser comme fond d'écran** fait la même chose. **Remplir** couvre tout l'écran, **Ajuster** montre l'image entière.

Le texte du bureau (horloge, date) passe en clair ou en foncé selon l'image. Chaque utilisateur a son propre fond. Dans la version web, les photos importées sont réduites (1920 pixels au plus sur leur grand côté) pour tenir dans l'espace du navigateur.

## L'écran

**Réglages → Écran** :

- **Sur le système Linux** : choisis la **résolution**, la **fréquence** (quand l'écran en propose plusieurs) et la **taille des éléments** (de 100 à 200 %), puis **Appliquer**. Le changement est immédiat, et Brume demande **Garder cet affichage ?** Sans réponse au bout de 15 secondes (écran noir, moniteur qui refuse le mode…), l'ancien affichage revient tout seul. Le réglage gardé est repris à chaque démarrage, écran par écran. **Réglages recommandés** revient à la résolution prévue par l'écran, à 100 %.
- **Dans l'application** : sur Windows et macOS, **Ouvrir les réglages d'affichage** ouvre ceux du système ; sur un Linux de bureau, la résolution se règle dans ce système.
- **Dans la version web** : Brume prend la taille de la fenêtre du navigateur. Ctrl et + ou Ctrl et − (Cmd sur Mac) agrandissent ou réduisent tout, Ctrl et 0 revient à la normale.

Une résolution plus basse ou une taille plus grande agrandissent tout ; l'image la plus nette reste celle de la résolution recommandée, avec la taille des éléments pour grossir.

## Cet appareil

**Réglages → Cet appareil** décrit l'ordinateur sur lequel Brume tourne, détecté tout seul :

- **le modèle** (par exemple « Lenovo ThinkPad T480 », « Machine virtuelle VirtualBox ») et le type (portable, bureau) ;
- **le processeur** (nom, cœurs et fils, fréquence maximale, 64 bits ou ARM), **la mémoire** (totale et disponible, avec une jauge) ;
- **la carte graphique** et son pilote ; quand il n'y a pas d'accélération graphique, Brume le dit et, dans VirtualBox, indique la case à cocher ;
- **les écrans** (définition, fréquence, échelle), **les disques** (SSD NVMe, SSD, disque dur, clé USB, carte SD, disque virtuel) et l'espace libre ;
- **la batterie** (charge, état, santé, cycles), **le réseau** (Wi-Fi ou Ethernet, carte, adresse), **le Bluetooth**, **le son** ;
- **le système** (version, noyau), depuis quand l'ordinateur est allumé, son nom, et la version de Brume (clé USB ou installé).

**Copier les informations** met la fiche dans le presse-papiers, pratique pour demander de l'aide. **À propos** affiche aussi le processeur et la mémoire, avec un bouton **Cet appareil…**.

Sur le système Linux, tout est lu dans le matériel (DMI, `/proc`, `/sys`, `lsblk`). Dans l'application, Windows (PowerShell) et macOS (`system_profiler`) donnent le modèle, le processeur, la mémoire et les disques. Dans la version web, le navigateur ne laisse voir qu'une partie : le nombre de cœurs, la mémoire arrondie, la carte graphique, l'écran, le système et, sur téléphone, le modèle.

## Les sons

Comme macOS et Windows, Brume a ses effets sonores. Ils sont à elle : aucun son d'Apple ni de Microsoft. Brume les fabrique elle-même au moment de les jouer, sans fichier son à télécharger.

- **Démarrage** : un accord qui s'ouvre lentement, quand l'écran de démarrage s'efface.
- **Ouverture de session**, **verrouillage** et **déverrouillage**.
- **Avis** : deux notes claires. Pas de son en mode Ne pas déranger, ni juste après un autre son (mettre à la corbeille fait son propre bruit, pas un son d'avis en plus).
- **Alerte** : avant une action qu'on ne peut pas défaire (« Vider la corbeille ? »), ou quand le mot de passe est refusé.
- **Corbeille** : un souffle pour **Mettre à la corbeille**, un froissement pour **Vider la corbeille** ou supprimer pour de bon.
- **Appareil connecté** ou **déconnecté** (Bluetooth : casque, souris…), **Fichier reçu** (AirDrop, LocalSend) et **Extinction**.
- **Capture d'écran** : un déclic d'obturateur. **Changement de volume** : une petite note, jouée au nouveau volume quand tu appuies sur une touche de volume.

**Réglages → Sons** :
- **Volume** : le volume général (voir plus bas).
- **Effets sonores** : les couper pour ton compte.
- **Volume des effets sonores** : le régler.
- **Son au démarrage** : le couper sur cet appareil.
- **Écouter les sons** : les entendre un par un.

Dans la version web, le navigateur n'autorise le son qu'après un premier clic ou une première touche. Avant, Brume reste silencieuse, et le son du démarrage ne s'y entend donc souvent pas. Dans l'application et sur le système Linux, il se joue toujours.

## Le volume

Le haut-parleur de la barre des menus (à gauche du Panneau rapide) montre le volume : barré quand le son est coupé, avec une à trois ondes selon le niveau.

- **Un clic** ouvre la fenêtre **Son** : un curseur, un bouton pour couper ou rétablir le son, la sortie utilisée, et **Réglages du son…**. Le même curseur est dans le **Panneau rapide** et dans **Réglages → Sons**.
- **La molette** sur le haut-parleur monte ou baisse le son, un cran à la fois.
- **L'indicateur** : quand le volume change par les touches du clavier ou la molette, un carré apparaît au-dessus du Quai, comme sur un Mac, avec le haut-parleur et 16 crans, puis s'efface tout seul au bout d'une seconde et demie. Il ne s'affiche pas quand tu fais glisser un curseur, qui suffit à voir le volume.

Selon la version :
- **Système Linux** : c'est le vrai volume de l'ordinateur (PipeWire). Les **touches de volume du clavier** (souvent **Fn** + une touche) le montent, le baissent ou coupent le son, même quand une page de Vigie ou GeForce NOW a le clavier : 16 crans, ou 64 avec **Alt + Maj** pour un réglage fin. Monter ou baisser le volume remet le son s'il était coupé, et une petite note se joue au nouveau volume. Si un casque ou une enceinte Bluetooth prend la main, le haut-parleur suit, et la fenêtre **Son** indique la sortie (« Sortie : Casque Bluetooth »).
- **Application et version web** : c'est le volume de Brume, qui règle Ressac et les sons de Brume. L'ordinateur garde son propre volume, et ses touches de volume restent à lui (il affiche alors son propre indicateur).

## L'écran de démarrage

Comme sur un Mac ou un PC, Brume s'ouvre sur un écran sombre avec son logo et une barre de progression, puis passe en fondu à l'écran de connexion (ou au bureau).

- **Version web et application** : l'écran paraît dès l'ouverture de la page ou de la fenêtre. La barre avance pendant le chargement de Brume (sur Internet, celui de la page elle-même), puis se remplit quand tout est prêt.
- **Système Linux** : l'écran de démarrage commence dès l'allumage du PC, avant même Brume. C'est le thème `brume` de Plymouth, l'outil d'écran de démarrage de Debian. Même logo, même place, même barre : Brume prend la suite sans saut, sans texte entre les deux. À l'extinction et au redémarrage, voir plus bas. Si le disque est chiffré, l'écran de démarrage demande le mot de passe (un point par caractère).
- **Réglages → Apparence → Écran de démarrage** : **Aperçu** le rejoue, l'interrupteur le désactive. C'est un réglage de l'appareil, pas du compte, puisque l'écran paraît avant la connexion. Sur le système Linux, il ne concerne que la partie Brume ; l'écran du système reste.

Sur les PC récents (UEFI), l'écran du système paraît dès les premières secondes. Sur les plus anciens (BIOS), il peut n'apparaître qu'une fois la carte graphique prête, après quelques secondes d'écran noir.

## Éteindre et redémarrer

**Éteindre…** et **Redémarrer…** sont dans le menu Phare (le logo en haut à gauche) et en bas de l'écran de connexion, dans toutes les versions de Brume.

- **Le message** : « Voulez-vous vraiment éteindre l'ordinateur maintenant ? », avec **Annuler** et **Éteindre**. Entrée confirme, Échap annule. Sans réponse, l'arrêt se fait tout seul au bout de 60 secondes (le message compte les secondes), comme sur un Mac.
- **Un document pas enregistré** (une note, un fichier de Plume, Abaque ou Escale) : le message le dit, le bouton passe au rouge, et rien ne se fait sans toi.
- **L'écran d'arrêt** : « Arrêt en cours » (ou « Redémarrage en cours ») à la place du logo de l'écran de démarrage, dans la police du logo de Vigie, avec la même barre et le son d'extinction. La musique et les vidéos se taisent tout de suite, la session se ferme : au retour, c'est l'écran de connexion.

Selon la version :
- **Système Linux** : l'ordinateur s'éteint (ou redémarre). L'écran d'arrêt du système (Plymouth) prend la suite avec le même texte, à la même place, dans la langue de Brume, et la barre repart d'où Brume l'a laissée. Si l'ordinateur ne répond pas au bout de 20 secondes, Brume revient avec un avis.
- **Application** (Mac, Windows, Linux) : **Éteindre** ferme Brume ; **Redémarrer** le relance.
- **Version web** : **Éteindre** laisse un écran noir avec un bouton **Allumer Brume**, même si tu recharges la page ; **Redémarrer** relance Brume, écran de démarrage compris.

La police est [Young Serif](https://github.com/noirblancrouge/YoungSerif) (© The Young Serif Project Authors, licence SIL Open Font License 1.1). Réduite aux lettres latines, elle est incluse dans `index.html` pour s'afficher même sans Internet.

## Le plein écran

Chaque fenêtre peut occuper tout l'écran : le bouton **Plein écran** (les quatre coins, à gauche de **Réduire**), **Fenêtre → Plein écran** ou **F11**.

- **La barre des menus reste en haut**, et la fenêtre garde sa barre de titre, avec **Quitter le plein écran**.
- **Le Quai se cache.** Amène la souris tout en bas de l'écran : il remonte. Il repart quand la souris revient sur l'app. Sur un écran tactile, touche le bas de l'écran.
- **En sortir** : **F11**, le bouton **Quitter le plein écran**, ou **Fenêtre → Quitter le plein écran**. Dans la version web et l'application, **Échap** en sort aussi.
- **Pour que l'app prenne vraiment tout l'écran**, désactive **Réglages → Quai et alertes → Barre des menus en plein écran**. La barre des menus et la barre de titre se cachent alors aussi. La barre de titre revient quand la souris touche le haut de l'écran.
- **Version web et application** : l'écran entier passe aussi en plein écran (sans le navigateur, ou sans les bords de la fenêtre de l'application).
- **Vigie et les apps du Comptoir** (Netflix, YouTube, Canal+…) : en plein écran, les onglets et la barre d'adresse se cachent aussi. Quand un site met sa vidéo en plein écran, elle prend tout l'écran, sans la barre des menus, puis revient quand la vidéo en sort.
- Une seule fenêtre en plein écran à la fois. Une app ouverte depuis le Quai passe devant, et la fenêtre en plein écran le reste. La réduire, l'agrandir ou la fermer quitte le plein écran.

## La capture d'écran

Comme sur un Mac ou sous Windows :

- **Impr. écran** (ou **Alt + Maj + 3**) : tout l'écran.
- **Maj + Impr. écran** (ou **Alt + Maj + 4**) : une zone. Fais glisser pour la choisir, ses dimensions s'affichent. **Espace** passe aux fenêtres : un clic sur l'une d'elles la prend seule, avec ses coins arrondis et une ombre, sur fond transparent. **Échap** annule.
- **Alt + Impr. écran** : la fenêtre active, de la même façon.
- **Alt + Maj + 5**, ou l'app **Capture d'écran** (dans Phare) : l'outil, avec **Écran entier**, **Fenêtre**, **Zone** et des **Options** : où ranger la capture (**Images**, le **Bureau**, ou seulement le **presse-papiers**) et un **minuteur** de 5 ou 10 secondes, que **Échap** annule. Ces choix restent ceux de ton compte.

Un déclic, un éclair blanc, puis la vignette de la capture passe en bas à droite quelques secondes. Un clic l'ouvre dans Aperçu ; un clic droit propose de la modifier dans Reflet, de la copier, de l'afficher dans Fichiers ou de la mettre à la corbeille. Le fichier s'appelle « Capture d'écran 2026-11-15 à 14.32.08.png ». Le son s'écoute dans **Réglages → Sons**, et les raccourcis sont rappelés dans **Aide → Raccourcis clavier**.

Selon la version :
- **Système Linux et application** : l'image vient du moteur de Brume, au pixel près, pages de Vigie et apps du Comptoir comprises. La copie va dans le presse-papiers de l'ordinateur. GeForce NOW et le Mac distant, qui ont leur propre fenêtre, n'y apparaissent pas.
- **Version web** : Brume redessine son écran lui-même, sans rien demander au navigateur. Les pages d'autres sites n'y apparaissent pas (le navigateur l'interdit) : elles restent blanches. Sous Windows, le navigateur ne transmet **Impr. écran** qu'au relâchement de la touche, et Windows peut ouvrir son propre outil en même temps : **Alt + Maj + 3** marche partout. Comme le navigateur ne garde qu'environ 5 Mo pour tout Brume, une très grosse capture est enregistrée en JPEG, bien plus léger.

Les polices de Brume (Onest, Young Serif et JetBrains Mono, licence SIL Open Font License 1.1) sont incluses dans `index.html`, en lettres latines : Brume les a sans Internet, à l'écran, à l'impression et sur les captures.

## Le Quai

Le Quai, en bas de l'écran, garde tes apps à gauche du trait et montre les apps ouvertes à droite. Pour choisir celles qui y restent et les ranger dans l'ordre que tu veux :

- **À la souris** : fais glisser une icône le long du Quai ; les autres s'écartent pour lui faire de la place. Échap annule.
- **Au doigt** : appui long sur l'icône, puis glisse. Un appui long sans bouger ouvre le menu.
- **Clic droit** sur une icône (ou Maj+F10 au clavier) : **Déplacer vers la gauche**, **Déplacer vers la droite**, **Retirer du Quai**. L'avis qui s'affiche propose **Annuler**, et l'app reste dans Phare.
- **Garder dans le Quai** : clic droit sur une app ouverte à droite du trait, ou sur une app dans Phare. Elle se range au bout de tes apps.
- **Rétablir le Quai d'origine** (clic droit sur une icône) remet toutes les apps de départ, dans leur ordre.

Chaque utilisateur a son propre Quai, gardé d'une session à l'autre. **Réglages → Quai et alertes → Icônes du Quai → Réinitialiser** revient aussi au Quai d'origine. Phare reste toujours au bout.

Le Quai tient toujours dans l'écran : sur un petit écran (une machine virtuelle en 1024×768, par exemple), ses icônes rétrécissent juste assez, jusqu'à 30 px. Si l'écran est encore plus étroit, le Quai défile à la molette ou au doigt, et un fondu sur le bord indique qu'il reste des icônes de ce côté. La taille choisie dans **Réglages → Quai et alertes** revient dès que la place le permet.

## Les widgets du bureau

En haut à gauche du bureau, trois widgets : **l'heure**, **la date**, et **le moment de la journée** (aube, jour, crépuscule ou nuit, avec le nombre de fenêtres ouvertes).

- **Retirer un widget** : clic droit dessus, puis **Retirer le widget**.
- **Le remettre** : clic droit sur le fond du bureau, puis **Remettre le widget « … »**. Le menu ne propose que les widgets retirés.
- **Réglages → Bureau → Widgets du bureau** : un interrupteur pour chacun.

Chaque utilisateur garde ses widgets.

## Les icônes du bureau

Documents, Images, Bienvenue, la Corbeille et ce que contient le dossier **Bureau** se placent où tu veux sur le bureau :

- **À la souris ou au doigt** : fais glisser l'icône ; un cadre en pointillés montre la case où elle va se poser. Les icônes se calent sur une grille, et si la case est prise, les deux icônes échangent leur place. Échap annule.
- **Au clavier** : Alt+flèches déplace l'icône sélectionnée d'une case.
- **Clic droit sur le bureau → Ranger les icônes** les remet en colonne à droite.

Chaque utilisateur garde ses places. Si l'écran devient plus petit, les icônes restent visibles et reprennent leur place quand il s'agrandit.

## Sélectionner plusieurs éléments

Comme sur Windows et macOS, sur le bureau comme dans Fichiers :

- **Rectangle de sélection** : clique sur le fond (pas sur une icône) et fais glisser. Un rectangle de couleur apparaît, et tout ce qu'il touche est sélectionné. Dans Fichiers, la liste défile quand on approche du bord.
- **Ctrl+clic** ajoute ou retire un élément. **Maj+clic** sélectionne toute une plage (dans Fichiers). **Ctrl+A** sélectionne tout. **Échap** (sur le bureau) ou un clic sur le fond désélectionne. Ctrl ou Maj en commençant un rectangle ajoute à ce qui est déjà sélectionné.
- **Sur plusieurs éléments** : **Entrée** les ouvre, **Suppr** les met à la corbeille (**Maj+Suppr** les supprime pour de bon dans Fichiers, après confirmation), **Ctrl+C** et **Ctrl+X** les copient ou les coupent, à coller ailleurs avec **Ctrl+V**. Le clic droit propose **Ouvrir**, **Couper**, **Copier**, **Partager…** (fichiers) et **Mettre à la corbeille**.
- **Sur le bureau**, faire glisser une des icônes sélectionnées les déplace toutes ensemble, en gardant leur disposition.

La sélection au rectangle se fait à la souris (ou au pavé tactile). Sur un écran tactile, glisser fait défiler.

## Le clic droit sur les fichiers et dossiers

Un clic droit sur un fichier ou un dossier ouvre le même menu partout : sur le bureau, dans Fichiers (et sa barre latérale) et dans les résultats de Phare.

- **Ouvrir**, **Ouvrir dans une nouvelle fenêtre** (dossiers, dans Fichiers), **Modifier dans Reflet** (images), **Afficher dans Fichiers**, **Ouvrir dans la Console** (dossiers).
- **Couper** (Ctrl+X), **Copier** (Ctrl+C), **Coller** (Ctrl+V), **Dupliquer** (Ctrl+D), **Renommer…** (F2). Un élément coupé apparaît estompé jusqu'à ce qu'il soit collé. Les morceaux, vidéos et documents sont vraiment copiés : modifier la copie ne touche pas l'original.
- **Utiliser comme fond d'écran** (images), **Exporter une copie…** (le fichier est téléchargé sur l'appareil ; pour Plume, Abaque et Escale, au format .docx, .xlsx ou .pptx), **Lire les informations** (Ctrl+I : taille, emplacement, contenu, dimensions d'une image, durée d'un morceau…), **Mettre à la corbeille** (Suppr).

Un clic droit sur le fond d'un dossier propose **Nouveau dossier…**, **Nouvelle note**, **Coller**, **Lire les informations** et **Ouvrir la Console ici**. Sur le fond du bureau : **Nouveau dossier…** et **Coller**, en plus du reste.

Le bureau est maintenant un vrai dossier : **Bureau**, en tête de la barre latérale de Fichiers. Ce que tu y crées ou y colles apparaît sur le bureau.

Les dossiers du système (Documents, Images, Musique, Vidéos, Bureau) ne se renomment pas et ne partent pas à la corbeille. Une note ou un document ouvert suit son fichier s'il est renommé ou déplacé.

## Partager : AirDrop et LocalSend

**Partager…**, dans le menu d'un fichier (clic droit), ouvre une feuille qui propose ce que l'appareil sait faire :

- **AirDrop**
  - **Application sur un Mac** : le menu de partage de macOS, avec AirDrop, Messages, Mail… C'est le vrai AirDrop d'Apple. Les fichiers reçus par AirDrop arrivent dans le Finder.
  - **Version web** dans Safari sur iPhone, iPad et Mac : la feuille de partage de l'appareil, avec AirDrop. Dans un navigateur qui ne la propose pas, Brume l'explique et propose **Exporter une copie…**.
  - **Système Linux** (expérimental) : avec [omdrop](https://github.com/netmojo-systems/omdrop-plugin) et [omdrop-owl](https://github.com/t4t5/omdrop-owl), deux projets libres récents, Brume voit les iPhone et les Mac proches et leur envoie des fichiers ; **Réglages → Partage → Être visible 10 minutes** le fait apparaître dans la liste AirDrop des iPhone, pour recevoir. Rien à installer sur l'iPhone, mais il doit être déverrouillé, avec AirDrop sur « Tout le monde pendant 10 minutes ». Seules certaines cartes Wi-Fi le permettent (Brume indique la vôtre) : MediaTek MT7925 (le Wi-Fi reste connecté), Intel AX200, AX201, AX211 et 9560, Realtek RTL8822BE (le Wi-Fi est coupé pendant que l'ordinateur est visible). Les transferts sont lents (de l'ordre de 0,5 à 1,3 Mo/s).
  - **Application sur Windows ou Linux** : pas d'AirDrop (le protocole d'Apple a besoin d'un Wi-Fi spécial) ; LocalSend le remplace.
- **LocalSend** (application et système Linux) : les appareils où l'app gratuite [LocalSend](https://localsend.org) est ouverte, sur le même réseau : iPhone, Android, Windows, Mac, Linux. Un clic envoie ; l'autre appareil accepte.

Recevoir :

- **Réglages → Partage → Recevoir avec LocalSend** rend Brume visible dans LocalSend sous le nom choisi (**Nom de l'ordinateur**). Chaque envoi est demandé (« « iPhone de Camille » veut vous envoyer 2 fichiers ») et n'arrive qu'après **Accepter** ; un message texte s'affiche dans la demande.
- Les fichiers reçus par LocalSend ou AirDrop sont rangés dans **Téléchargements** (les morceaux et les vidéos dans Musique et Vidéos), avec un avis pour les ouvrir. Une copie reste dans le dossier `Partage à proximité` des téléchargements de l'ordinateur.
- LocalSend utilise le port 53317 (UDP et TCP) : sous Windows, autorise Brume quand le pare-feu le demande.
- **Panneau rapide** (le centre de contrôle, en haut à droite) : les tuiles **AirDrop** et **LocalSend** allument ou coupent la réception en un clic, comme sur un Mac. AirDrop est alors visible 10 minutes (« Jusqu'à 15:38 »). Un clic droit sur une tuile ouvre **Réglages → Partage**. La tuile AirDrop n'apparaît que sur le système Linux avec omdrop ; dans la version web, aucune des deux n'apparaît, puisque le partage n'y fonctionne pas.

Dans l'image Linux, omdrop est ajouté par la construction (étape « Préparer AirDrop » de `.github/workflows/iso.yml`) : si cette étape échoue, l'image se construit quand même, sans AirDrop. Pour figer la version d'omdrop-owl, remplace `main` par un commit dans `OMDROP_OWL_REF`.

## La corbeille

Ce que tu supprimes ne disparaît plus tout de suite : il part dans la **Corbeille**, sur le bureau et dans les emplacements de Fichiers.

- **Supprimer** : touche Suppr, bouton corbeille ou clic droit → **Mettre à la corbeille** (dans Fichiers, sur le bureau ou dans Phare), `rm` dans la Console, bouton corbeille dans Ressac. L'avis qui s'affiche propose **Annuler**. Maj+Suppr dans Fichiers supprime pour de bon, après confirmation.
- **Restaurer** : dans la corbeille, sélectionne l'élément puis **Restaurer** (ou double-clic). Il retourne dans son dossier d'origine, recréé s'il a été supprimé entre-temps.
- **Supprimer pour de bon** : **Supprimer** sur un élément de la corbeille, ou **Vider la corbeille** (bouton dans Fichiers, clic droit sur la corbeille du bureau, ou **Réglages → Stockage**). Ça, c'est définitif.

Tant qu'ils sont dans la corbeille, les fichiers comptent dans la place utilisée, mais Phare, Ressac et la Console ne les voient plus. Les morceaux et les vidéos restent sur l'appareil jusqu'à ce que la corbeille soit vidée. Chaque utilisateur a sa propre corbeille.

## Vigie, le navigateur

Dans l'application et le système Linux, **Vigie** est un navigateur complet, avec le moteur de Chrome :

- **Onglets** : icône de chaque site, chargement, son (un clic sur le haut-parleur coupe le site), onglets **épinglés**, à **glisser** pour les ranger, clic droit (**Dupliquer**, **Fermer les autres onglets**…). Un lien « nouvel onglet » s'ouvre dans un onglet ; **Ctrl+Maj+T** rouvre le dernier onglet fermé.
- **Barre d'adresse** : suggestions tirées de l'historique et des favoris, recherche avec le moteur choisi (Google au départ ; DuckDuckGo, Bing, Qwant, Ecosia ou Brave dans **⋮ → Paramètres**), cadenas avec les informations du site, étoile des favoris, zoom.
- **Favoris** (Ctrl+D) et leur barre (Ctrl+Maj+B), **Historique** (Ctrl+H) classé par jour, **Téléchargements** (Ctrl+J) avec leur progression, **Rechercher dans la page** (Ctrl+F), **zoom** retenu pour chaque site (Ctrl+ +, Ctrl+ −, Ctrl+0), **plein écran** (F11), **code source** (Ctrl+U) et **outils de développement** (F12).
- **Navigation privée** (Ctrl+Maj+N) : une fenêtre sombre qui ne garde ni historique, ni cookies, ni données des sites.
- **Clic droit dans une page** : ouvrir un lien dans un nouvel onglet ou une fenêtre privée, copier son adresse, enregistrer ou copier une image, rechercher le texte sélectionné, couper/copier/coller, corriger l'orthographe, inspecter.
- **Autorisations** : un site doit demander avant d'utiliser la caméra, le micro ou ta position (**Bloquer**, **Autoriser cette fois**, **Toujours autoriser**) ; le cadenas et **⋮ → Paramètres** permettent de changer d'avis.
- **Effacer les données de navigation** (Ctrl+Maj+Suppr) : historique, cookies, cache. Les données de Brume elles-mêmes ne sont jamais touchées.
- **Au démarrage** : la page Nouvel onglet (recherche et sites les plus visités), ou les onglets de la dernière fois.
- Les fichiers téléchargés vont dans le dossier Téléchargements ; sur le système Linux, ils arrivent aussi dans **Fichiers → Téléchargements** (ou dans Musique et Vidéos).

Ce que Vigie ne fait pas : les extensions, la synchronisation avec un compte, la traduction des pages et l'enregistrement des mots de passe. Dans la version web, Brume tourne dans une page protégée : les sites s'ouvrent dans un onglet de ton navigateur, et Vigie garde favoris, historique et recherche. Le petit Taquin reste à l'adresse `brume://jeu`.

## Ressac, la musique et les vidéos

- **Ajouter** : bouton « Ajouter… » ou glisser des fichiers dans la fenêtre. Les morceaux arrivent dans le dossier Musique, les vidéos dans Vidéos, et apparaissent aussi dans Fichiers. Ressac lit la pochette, le titre, l'artiste et l'album intégrés aux fichiers (MP3, M4A, FLAC, Ogg, Opus et WAV). Sans étiquettes, un nom comme `Artiste - Titre.mp3` donne l'artiste et le titre ; sans pochette, Ressac en dessine une.
- **Parcourir** : dans Morceaux, des onglets rangent la musique par **Titres** (ordre alphabétique, avec un index A–Z pour sauter à une lettre), **Albums**, **Artistes**, **Genres**, **Années** et **Récents** (derniers ajouts en premier). Un album s'ouvre sur ses morceaux dans l'ordre des pistes, avec Lire et Aléatoire ; un artiste montre ses albums et ses morceaux. Le champ **Rechercher** cherche dans les titres, artistes, albums, genres et années, sans tenir compte des accents (« ecume » trouve « Écume »). Ressac retient le dernier onglet choisi.
- **Étiquettes lues** : titre, artiste, album, artiste de l'album, genre, année, numéro de piste et de disque, dans les MP3 (ID3), M4A, FLAC, Ogg, Opus et WAV. Les morceaux importés avec une version précédente sont relus automatiquement à l'ouverture de Ressac.
- **Pochettes** : en grand pendant la lecture, et en petit dans la liste, la barre de lecture et le Panneau rapide. Un clic sur n'importe quelle pochette l'affiche en grand, en pleine définition et dans son format d'origine, avec le titre, l'artiste et l'album, puis la barre de commandes : position, lecture aléatoire, précédent, lecture ou pause, suivant, répétition. Lancé depuis cette vue, un morceau joue dans sa liste et la vue suit les morceaux suivants. Au clavier : Espace pour lire ou mettre en pause, flèches pour reculer ou avancer de 5 secondes. Échap, le bouton de fermeture ou un clic à côté des commandes la referme, et la musique continue. Les morceaux importés avant cette version récupèrent leur pochette à la prochaine ouverture de Ressac.
- **Écouter** : file de lecture, lecture aléatoire, répétition, volume. La musique continue quand la fenêtre est réduite ; elle se pilote aussi depuis la barre d'état et le Panneau rapide.
- **Visualiseur** : les crêtes du fond se soulèvent avec la musique, les graves au premier plan et les aigus au loin.
- **Vidéos** : lecture dans la fenêtre ou en plein écran (double-clic sur l'image).
- **Sons de Brume** : trois morceaux d'ambiance générés par le navigateur, pour essayer sans fichier. Le bouton « Créer un film de démonstration » filme aussi une journée de Brume en 8 secondes.
- **Clavier** : Espace pour lire ou mettre en pause, flèches gauche et droite pour reculer ou avancer de 5 secondes.

Les fichiers sont rangés dans IndexedDB, séparément pour chaque utilisateur. Il y a bien plus de place que pour les notes, mais tout reste sur l'appareil. Les formats lus dépendent du navigateur : MP3, M4A, WAV, OGG, FLAC, MP4 et WebM passent presque partout. L'application de bureau et le système Linux lisent les mêmes formats que Chrome.

## Ce qui joue, dans le Panneau rapide

Le Panneau rapide (le centre de contrôle, en haut à droite) montre un lecteur pour chaque app qui joue de la musique ou une vidéo : titre, artiste, pochette, **Lecture / Pause**, **Précédent** et **Suivant**, et **Ouvrir…** pour revenir à l'app. La barre d'état affiche le titre en cours ; un clic ramène son app.

- **Ressac** : partout, comme avant.
- **Application et système Linux** : aussi les apps du Comptoir (Apple Music, Spotify, Deezer, YouTube, Netflix, Canal+, Crunchyroll…) et les onglets de Vigie. Titre, artiste et pochette sont ceux que le site publie pour les commandes multimédias du système (« Media Session »). Sinon, Brume affiche le titre de la page. **Précédent** et **Suivant** n'apparaissent que si le site les propose. Une vidéo muette (bande-annonce, aperçu au survol) ne compte pas. Le lecteur disparaît quand on change de page ou qu'on ferme la fenêtre.
- **Version web** : Ressac seulement. Les apps du Comptoir s'y ouvrent dans un onglet du navigateur, que Brume ne voit pas ; le navigateur a ses propres commandes de lecture.

Jusqu'à trois lecteurs à la fois, ceux qui jouent en premier.

## Comptoir, la boutique d'apps

**Comptoir** (dans le Quai, juste avant Réglages ; « boutique » ou « app store » dans Phare) rassemble 127 apps du vrai Web, rangées en rayons. Le catalogue change selon le pays (voir plus bas). En France :

- **Musique** : Apple Music, Spotify, Deezer, YouTube Music, SoundCloud, Radio France.
- **Vidéo et télé** : YouTube, Netflix, Canal+, Prime Video, Disney+, Apple TV, HBO Max, Paramount+, france.tv, ARTE, TF1+, M6+, Twitch, Crunchyroll (anime), DAZN (sport).
- **Messages et appels** : WhatsApp, Messenger, Telegram, Discord, Microsoft Teams, Zoom, Google Meet.
- **Réseaux sociaux** : Instagram, Facebook, X, TikTok, LinkedIn, Pinterest, Reddit, Bluesky.
- **Travail** : Gmail, Outlook, Google Drive, Google Agenda, Microsoft 365, Notion, Trello, Slack.
- **Création** : Canva (visuels, affiches), Adobe Express (affiches, publications, vidéos courtes), CapCut (montage vidéo), Photopea (retouche photo, ouvre les fichiers Photoshop) et Pixlr (retouche photo rapide). Toutes sont gratuites, avec une offre payante.
- **Jeux** : GeForce NOW, Xbox Cloud Gaming, Chess.com, Lichess.
- **Pratique** : Claude, ChatGPT, Google Maps, Google Traduction, Doctolib, SNCF Connect, leboncoin, Météo-France, Amazon, Vinted.

Selon le pays :

- **Le pays** se choisit dans **Réglages → Langue et région → Pays ou région**, ou en bas du Comptoir. Au départ, Brume le devine d'après le fuseau horaire, puis la langue du navigateur ou du système (« Automatique (France) »). Le choix est propre à chaque compte.
- **Dix pays** : France, Belgique, Suisse, Canada, États-Unis, Royaume-Uni, Espagne, Allemagne, Italie et Portugal. **Autre pays** ne garde que les apps proposées partout.
- **Les incontournables** : l'accueil commence par les apps du pays (télévision, radio, trains, petites annonces, météo officielle) :
  - Belgique : RTBF Auvio, RTL play, VRT MAX, TF1+, SNCB, 2ememain, meteo.be ;
  - Suisse : Play Suisse, Play RTS, Play SRF, Canal+, TF1+, CFF, Ricardo, MétéoSuisse, Galaxus ;
  - Canada : ICI TOU.TV, CBC Gem, Crave, Tubi, VIA Rail, Kijiji, MétéoCAN ;
  - États-Unis : Hulu, Peacock, YouTube TV, Tubi, Pandora, Amtrak, craigslist, National Weather Service ;
  - Royaume-Uni : BBC iPlayer, BBC Sounds, ITVX, Channel 4, Tubi, Trainline, Gumtree, Met Office ;
  - Espagne : RTVE Play, atresplayer, Mitele, Movistar Plus+, SkyShowtime, Filmin, Renfe, Wallapop, AEMET ;
  - Allemagne : ARD Mediathek, ZDF, Joyn, RTL+, WOW, Deutsche Bahn, Kleinanzeigen, DWD, Doctolib ;
  - Italie : RaiPlay, RaiPlay Sound, Mediaset Infinity, NOW, Trenitalia, Subito, Doctolib ;
  - Portugal : RTP Play, OPTO, TVI Player, SkyShowtime, Filmin, CP, OLX, IPMA.
- **Les services absents d'un pays** n'y sont pas proposés : Canal+ en France et en Suisse, Paramount+ hors d'Espagne, du Portugal et de Belgique, HBO Max partout sauf au Canada, etc. La fiche de chaque app indique ses pays.
- **La bonne adresse** : Amazon s'ouvre sur amazon.fr, amazon.de, amazon.com…, Vinted, Doctolib et Filmin sur le site du pays.
- **Changer de pays ne supprime rien** : les apps déjà installées restent dans le Quai et dans Phare ; **Mes apps** signale celles qui ne sont pas proposées dans le nouveau pays.

Comment ça marche :

- **Obtenir** ajoute l'app au Quai (après tes autres apps du Comptoir) et à Phare ; rien n'est téléchargé. **Ouvrir** la lance : dans l'application et le système Linux, dans sa propre fenêtre sans barre d'adresse (flèches **Précédent**, **Suivant** et **Actualiser**, comme Apple Music ou Netflix) ; dans la version web, dans un nouvel onglet.
- Chaque app a sa **fiche** : ce qu'elle fait, son prix (gratuit, gratuit avec une offre payante, ou abonnement), son site, la lecture protégée pour les services de vidéo et de musique, et les autres apps du même rayon.
- **Mes apps** liste les apps installées. **Supprimer** (ou clic droit sur la tuile du Quai ou dans Phare → **Supprimer l'app…**) la retire du Quai et de Phare, sans toucher à ton compte sur le site ; **Annuler**, dans l'avis, la remet. Apple Music, Spotify, YouTube, Netflix, GeForce NOW, WhatsApp et Messenger sont installées au départ et se suppriment de la même façon.
- **Incluses dans Brume** présente les apps de Brume (Fichiers, Vigie, Plume…), toujours là.
- La recherche trouve une app par son nom ou par ce qu'elle fait (« trains », « dessins animés », « visio »). Phare aussi : une app pas encore installée apparaît sous **Dans le Comptoir**, et un clic ouvre sa fiche.
- Les apps installées sont propres à chaque compte Brume. **Rétablir le Quai d'origine** remet le Quai par défaut ; les apps installées restent dans Phare.
- Ce sont des sites : il faut Internet, et pour beaucoup un compte chez le service (Canal+, Prime Video, Disney+… demandent leur abonnement).

Les icônes :

- **Des sites** (au départ) : chaque app du Comptoir prend l'icône que son site publie lui-même, comme quand Chrome installe un site en application : l'icône Apple du site, celle de son manifeste d'application web ou celle déclarée dans la page, la plus grande. Une icône aux coins transparents (un logo seul) se pose sur un fond blanc. Aucune icône n'est livrée avec Brume : elles sont lues sur Internet la première fois, puis gardées sur l'ordinateur (dossier `site-icons` des données de Brume) et relues tous les 30 jours. Sans connexion, ou si un site n'a pas d'icône d'au moins 64 pixels, l'app garde l'icône de Brume.
- **Dans la version web**, le navigateur ne peut lire que l'icône Apple du site (`/apple-touch-icon.png`) ; certaines pages, comme l'artefact, bloquent les images venues d'autres sites : les icônes de Brume restent alors affichées.
- **De Brume** : **Réglages → Apparence → Icônes des apps du Comptoir** remet les icônes dessinées pour Brume ; **Recharger** relit les icônes sur les sites. Les apps de Brume (Fichiers, Vigie, Plume…) gardent toujours leurs propres icônes.

## Apple Music, Spotify, YouTube, Netflix et la lecture protégée

Quatre tuiles du Quai, juste après Ressac, ouvrent ces sites (Phare les trouve aussi : « music », « podcasts », « vidéo », « films », « séries »…). Canal+, Prime Video, Disney+ et les autres s'ajoutent depuis le [Comptoir](#comptoir-la-boutique-dapps) et marchent de la même façon :

- **Application et système Linux** : chacun dans sa propre fenêtre, sans barre d'adresse : seulement les flèches **Précédent** et **Suivant** et le bouton **Actualiser**, à côté de l'onglet (Alt+←, Alt+→ et F5 marchent aussi). Pour te connecter à ton compte, la fenêtre de connexion s'ouvre au-dessus de Brume et se ferme d'elle-même. Le bouton plein écran des vidéos occupe tout l'écran, et Échap ramène la fenêtre.
- **Version web** : dans un onglet de ton navigateur, car la page de Brume n'a pas le droit d'afficher d'autres sites.

Selon le site :

- **YouTube** : les vidéos se regardent sans rien de plus. La connexion à un compte Google peut être refusée (« Ce navigateur ou cette application ne sont peut-être pas sécurisés ») : Google bloque les navigateurs intégrés à une application qu'il ne reconnaît pas, et Brume ne peut pas l'empêcher. YouTube reste utilisable sans compte.
- **Spotify** : il a besoin du module de lecture protégée (ci-dessous). Un compte gratuit suffit pour écouter, avec des publicités ; Spotify Premium les retire.
- **Apple Music et Netflix** : ils ont besoin du module de lecture protégée (ci-dessous) et de ton abonnement. Sur Linux, Netflix annonce jusqu'à 1080p dans Chrome, mais précise qu'il ne garantit pas le fonctionnement sur Linux. Sur Windows et macOS, Netflix demande la signature Widevine décrite plus bas.

Apple Music, comme Netflix ou Spotify, protège ses morceaux avec Widevine, le module de lecture protégée de Google. Brume est construit sur [l'Electron de castlabs](https://github.com/castlabs/electron-releases) (licence MIT), une version d'Electron qui sait utiliser ce module. Le module lui-même n'est pas inclus : Brume le télécharge au premier lancement connecté à Internet, puis le tient à jour. Hors ligne, Brume démarre normalement et réessaie quand le réseau revient.

- **Système Linux et application Linux** : un module tout juste installé ne sert qu'après un redémarrage de Brume. L'avis **Lecture protégée installée** propose **Redémarrer Brume**, et le même bouton s'affiche en haut des fenêtres de Vigie. Ensuite, il n'y a plus rien à faire. Sur une clé USB sans partition de conservation, le téléchargement et le redémarrage reviennent à chaque démarrage de la clé.
- **Windows et macOS** : le module sert tout de suite. Ces deux systèmes demandent en plus que l'application soit signée pour Widevine (signature VMP), sans quoi certains services refusent la lecture. castlabs fournit cette signature gratuitement avec son service EVS :
  1. Sur ton ordinateur, dans un terminal avec Python 3 : `python3 -m pip install castlabs-evs`, puis `python3 -m castlabs_evs.account signup` (nom de compte, mot de passe, puis le code reçu par e-mail).
  2. Sur la page du dépôt GitHub : **Settings → Secrets and variables → Actions → New repository secret**. Ajoute `EVS_ACCOUNT_NAME` (ton nom de compte EVS) et `EVS_PASSWD` (ton mot de passe).
  3. Les constructions suivantes de l'application signent les versions Windows et macOS. Sans ces secrets, tout se construit quand même, sans cette signature.

Pour être accepté par les sites qui n'ouvrent leurs portes qu'aux navigateurs connus, Vigie se présente comme Chrome.

## GeForce NOW, le jeu en nuage

La tuile **GeForce NOW** (après Netflix, ou « jeux » dans Phare) ouvre le service de jeu en nuage de NVIDIA : les jeux tournent sur ses serveurs et l'image arrive en vidéo. On s'y connecte avec son compte NVIDIA, et on y joue aux jeux qu'on possède sur Steam, Epic Games, Ubisoft Connect, Xbox… Il faut une connexion rapide : 15 Mbit/s pour la HD, 25 Mbit/s pour la Full HD à 60 images par seconde, de préférence par câble ou en Wi-Fi 5 GHz.

- **Application** : GeForce NOW s'ouvre dans **sa propre fenêtre**, pas dans Vigie. En plein écran, le site verrouille le clavier comme dans Chrome : **Échap** va au jeu (pour ouvrir son menu), et un **appui long sur Échap** quitte le plein écran. La souris est capturée dans les jeux de tir, et les manettes Xbox, PlayStation ou celle de NVIDIA marchent. Re-cliquer sur la tuile ramène la fenêtre.
- **Système Linux** : la fenêtre occupe tout l'écran, avec une fine barre en haut : **Revenir à Brume** cache le jeu sans l'arrêter (la tuile le ramène), **Quitter GeForce NOW** le ferme. La barre disparaît pendant le jeu en plein écran. Verrouiller Brume cache aussi le jeu.
- **Version web** : dans un onglet de ton navigateur. NVIDIA y prend en charge Chrome et Edge, Firefox (Windows) et Safari (macOS).

Brume ne se verrouille pas tout seul pendant une partie, même à la manette. NVIDIA ne garantit le site que sur Windows, macOS et ChromeOS : sur Linux (l'application ou le système), il s'utilise en général sans souci, mais sans garantie de sa part, et la fluidité dépend du processeur, qui décode la vidéo. Pour GeForce NOW sur un autre Linux, NVIDIA propose aussi sa propre application (Ubuntu 24.04 et plus récent), que Brume n'intègre pas.

## Mac distant : passer sur macOS (Scaleway)

**Phare → Mac distant**, ou menu Brume (en haut à gauche) → **Passer sur macOS…** : le bureau d'un Mac mini loué chez Scaleway (rubrique Apple silicon de la [console](https://console.scaleway.com/apple-silicon/servers)) s'ouvre dans Brume.

- **Relier mon compte Scaleway…** : colle une clé d'API (console Scaleway → Identité et accès → Clés d'API) qui a la permission **AppleSiliconReadOnly**, ou **AppleSiliconFullAccess** pour pouvoir aussi redémarrer le Mac depuis Brume. Brume retrouve tes Mac mini avec leur adresse, leur port et leurs identifiants ; **Actualiser** relit la liste.
- Ou **Ajouter un Mac…** à la main : adresse IP, port du partage d'écran (VNC), utilisateur et mot de passe, tels qu'ils s'affichent dans la vue d'ensemble du Mac mini dans la console.
- **Basculer sur ce Mac** : le bureau macOS s'ouvre dans sa fenêtre, en plein écran sur le système Linux. La barre du haut (cachée en plein écran, elle revient quand la souris touche le haut de l'écran) propose **Revenir à Brume** (ou Ctrl+Alt+B) sans couper la connexion : **Passer sur macOS…** y ramène aussitôt. **Déconnecter** coupe la connexion.
- **Ctrl = ⌘** (activé au départ) : sur un clavier de PC, Ctrl sert de touche Commande, donc Ctrl+C et Ctrl+V copient et collent comme sur un Mac, et Alt sert de Ctrl. Un clic sur le bouton garde les touches telles quelles. Depuis l'application sur un Mac, le bouton n'apparaît pas.
- Le texte copié passe dans les deux sens. Verrouiller Brume cache le Mac ; se déconnecter de Brume coupe la connexion.
- **Son** (bouton de la barre) : le partage d'écran d'Apple ne transmet pas le son, alors Brume le fait passer à côté, par une connexion **SSH** au Mac (même utilisateur, même mot de passe).
  - La première fois, Brume installe sur le Mac, avec [Homebrew](https://brew.sh) : [BlackHole](https://github.com/ExistentialAudio/BlackHole) (une sortie son virtuelle, GPL-3.0), ffmpeg et SwitchAudioSource. Compte 5 à 15 minutes ; le mot de passe du Mac sert à l'installation.
  - Brume règle la sortie son du Mac sur « BlackHole 2ch » et ouvre, cachée, une petite fenêtre Terminal qui enregistre le son. **La première fois, le Mac demande si Terminal peut utiliser le micro : clique sur Autoriser** (macOS range l'enregistrement du son avec le micro).
  - Le son arrive en Opus (96 kbit/s), avec un léger retard sur l'image (de l'ordre d'un quart de seconde). Le panneau règle le volume. Le son reprend tout seul à la connexion suivante ; **Couper le son** remet la sortie son d'avant sur le Mac.
- La clé d'API et les mots de passe restent sur l'appareil, chiffrés par le système quand il le permet.

À savoir :

- Choisis sur le Mac la même disposition de clavier que la tienne (AZERTY…).
- Pour le son, la **Session à distance** (SSH) doit être activée sur le Mac : c'est le cas des Mac mini de Scaleway ; sur ton propre Mac, **Réglages Système → Général → Partage → Session à distance**. Le port SSH est 22, modifiable dans **Ajouter un Mac…**. Brume retient la clé du Mac à la première connexion et prévient si elle change. Il faut aussi une session ouverte sur le Mac (pas l'écran de connexion).
- La version web ne peut pas ouvrir de connexion directe vers un Mac : il faut l'application ou le système Brume.
- Après plusieurs mots de passe faux, le Mac bloque l'adresse pendant un moment ; un redémarrage (depuis la console, ou **…** → **Redémarrer le Mac…** dans Brume) le débloque. Si FileVault est activé sur le Mac, les connexions à distance sont bloquées jusqu'à ce que le disque soit déverrouillé sur place.
- L'affichage utilise [noVNC](https://github.com/novnc/noVNC) (licence MPL 2.0, voir `mac/NOVNC-LICENSE.txt`).

## Courrier, WhatsApp et Messenger

**Courrier** (juste après Vigie dans le Quai, ou « mail » dans Phare) lit et envoie tes e-mails :

- **Ajouter un compte** (menu **Comptes**, dans l'application et le système Linux) : ton nom, ton adresse et ton mot de passe. Courrier reconnaît Gmail, iCloud, Yahoo, Orange, Free, SFR et La Poste, cherche les réglages des autres messageries dans la base de Thunderbird, et laisse tout régler à la main dans **Réglages des serveurs** (IMAP pour recevoir, SMTP pour envoyer). Gmail, iCloud et Yahoo demandent un **mot de passe d'application**, à créer dans les réglages de sécurité du compte (Courrier propose le lien). Outlook et Hotmail n'acceptent plus de mot de passe dans les logiciels de messagerie : pour eux, utilise Outlook sur le Web dans Vigie.
- **Lire** : dossiers (réception, envoyés, archives, corbeille, et les tiens), recherche, messages non lus en gras et pastille rouge sur la tuile du Quai. Les messages HTML s'affichent dans un cadre isolé, sans scripts, et les **images venues d'Internet restent masquées** tant que tu ne cliques pas sur **Afficher les images** : un expéditeur ne sait pas quand tu lis son message. Une pièce jointe s'ouvre dans Brume (images dans Aperçu, PDF dans Folio, textes dans Notes) et se range dans Images ou Documents ; les autres types se téléchargent.
- **Écrire** : nouveau message (**Ctrl+N**), répondre (**Ctrl+R**), répondre à tous, transférer (avec les pièces jointes), Cc et Cci, adresses déjà vues proposées, pièces jointes depuis Fichiers ou depuis l'appareil (20 Mo au plus). **Ctrl+Entrée** envoie. Une copie va dans Envoyés.
- **Ranger** : archiver, supprimer (la corbeille, puis définitivement), marquer comme non lu, suivre (étoile).
- **Nouveaux messages** : Courrier relève la boîte de réception toutes les deux minutes et affiche un avis pour chaque nouveau message.
- Un lien dans un e-mail s'ouvre dans Vigie ; une adresse `mailto:` ouvre un nouveau message.

Le mot de passe ne quitte pas le processus principal de l'application : la page de Brume ne le voit jamais. Il est enregistré dans `courrier/` (dossier de Brume), chiffré par le trousseau du système quand il y en a un (Windows, macOS, bureau Linux). Sur le système Brume, sans trousseau, il est seulement brouillé : c'est une raison de plus d'utiliser un mot de passe d'application, que tu peux révoquer à tout moment.

**Dans la version web**, Courrier ouvre une **boîte de démonstration** avec quelques messages : tout y fonctionne, mais rien ne sort de Brume. Entre les personnes d'un même PC, les adresses en `@brume.local` (par exemple `camille.roy@brume.local`) reçoivent vraiment les messages. Dans l'application, cette boîte reste disponible depuis le menu **Comptes**.

**WhatsApp** et **Messenger** ont aussi leur tuile, après Netflix : comme Apple Music, chacun s'ouvre dans sa propre fenêtre, sans barre d'adresse, avec seulement les flèches **Précédent** et **Suivant** et le bouton **Actualiser** (dans un onglet du navigateur pour la version web). Leurs notifications deviennent des avis de Brume, et le nombre de messages non lus s'affiche en pastille sur leur tuile.

Courrier s'appuie sur trois bibliothèques libres, utilisées seulement par l'application : [imapflow](https://github.com/postalsys/imapflow) (licence MIT), [Nodemailer](https://nodemailer.com) (MIT-0) et [mailparser](https://github.com/nodemailer/mailparser) (MIT).

## Calendrier

**Calendrier** (juste après Courrier dans le Quai, ou « agenda » dans Phare) garde tes rendez-vous. Sa tuile affiche la date du jour.

- **Jour, Semaine, Mois** : les flèches ‹ › (ou ← et → au clavier) changent de période, **Aujourd'hui** (ou **T**) y revient. Le petit mois de la barre latérale mène à n'importe quel jour. La semaine commence le lundi, ou le dimanche aux États-Unis et au Canada.
- **Créer** : **Nouvel événement** (**Ctrl+N**), un double-clic sur un jour ou une heure, ou glisser dans la grille de la semaine sur la plage voulue. La fiche donne le titre, le lieu, la journée entière, le début et la fin, la répétition (chaque jour, semaine, deux semaines, mois ou année, jusqu'à une date), le rappel, le calendrier et des notes.
- **Modifier** : un clic montre l'événement, un double-clic le modifie. Dans la semaine, on le **glisse** à une autre heure ou un autre jour et on l'**allonge** par le bas, au quart d'heure ; dans le mois, on le glisse à un autre jour. Pour un événement qui se répète, Brume demande s'il faut changer **celui-ci seulement** ou **tous**. **Suppr** efface l'événement choisi.
- **Rappels** : un avis de Brume à l'heure dite (avant l'événement, ou à 9 h pour une journée entière), avec **Ouvrir**. Ils fonctionnent tant que Brume est ouvert.
- **Jours fériés** : ceux du pays choisi dans Réglages (France, Belgique, Suisse, Canada, États-Unis, Royaume-Uni, Espagne, Allemagne, Italie, Portugal), dans la langue de Brume. On peut les masquer en décochant leur calendrier.
- **Calendriers** : **Personnel** au départ, d'autres avec **Nouveau calendrier** ; le clic droit change la couleur, renomme, exporte ou supprime. Décocher un calendrier le masque.
- **Fichiers .ics** : **Fichier › Importer un fichier .ics…**, ou double-clic sur un `.ics` dans Fichiers, ou une invitation reçue en pièce jointe dans Courrier. Importer deux fois le même fichier ne crée pas de doublon. Le clic droit sur un calendrier l'**exporte** dans Documents (lisible par Google Agenda, Outlook, le Calendrier d'Apple, Thunderbird…).

**Synchroniser avec ta boîte mail** (application et système Linux) : **Ajouter un compte…** en bas de la barre latérale propose :

- **le compte de Courrier** : le calendrier de la même adresse, avec le même mot de passe, sans rien retaper. Marche avec iCloud, Yahoo, Fastmail, GMX, WEB.DE, mailbox.org, Posteo, Zoho et les serveurs qui annoncent leur calendrier (CalDAV). Si Brume ne trouve pas le serveur tout seul, indique son adresse.
- **un autre compte CalDAV** : Nextcloud, un serveur à toi, etc. (adresse, identifiant, mot de passe) ;
- **un abonnement** : une adresse `.ics` ou `webcal://`, en lecture seule, relue toutes les 30 minutes.

Ce qui est créé, modifié, déplacé ou supprimé dans Brume l'est aussi sur le serveur, et Brume relève les changements toutes les 5 minutes (ou tout de suite avec ⟳ **Actualiser**). Si le même événement a été modifié ailleurs entre-temps, Brume garde la version du serveur et le dit. Les événements restent visibles hors connexion.

- **Gmail et Google Agenda** : Google refuse le plus souvent la synchronisation par mot de passe. Abonne-toi plutôt à ton agenda : dans Google Agenda sur le Web, **Paramètres › ton agenda › Adresse secrète au format iCal**.
- **Outlook et Hotmail** : pas de synchronisation par mot de passe non plus. Dans Outlook sur le Web, **Paramètres › Calendrier › Calendriers partagés › Publier un calendrier**, puis abonne-toi à l'adresse `.ics`.
- **Orange, Free, SFR, La Poste** : leurs agendas ne se synchronisent pas avec d'autres logiciels ; tes événements restent sur ce PC.
- iCloud, Gmail et Yahoo demandent un **mot de passe d'application**, comme pour Courrier.

Comme pour Courrier, les mots de passe ne quittent pas le processus principal (dossier `calendrier/` de Brume) et l'adresse d'un serveur doit être en `https://`, sauf sur ton réseau local. **Dans la version web**, le navigateur empêche de joindre les serveurs de calendrier : les événements restent dans le navigateur, et l'import et l'export de `.ics` fonctionnent.

## Imprimer

**Fichier → Imprimer…** (ou **Ctrl+P**) imprime depuis Plume, Abaque, Escale, Notes, Aperçu, Courrier, Folio, Reflet, Compas et Vigie (la page web ouverte, dans l'application et le système Linux). Abaque imprime la feuille active réduite à la largeur de la page, Escale une diapositive par page en paysage, Courrier le message ouvert avec son en-tête, Folio le PDF avec ses annotations.

- **Dans l'application et le système Linux**, la feuille **Imprimer** de Brume choisit l'imprimante, le nombre de copies, les pages (toutes, ou de… à…), l'orientation, la couleur ou le noir et blanc, le recto verso et le papier (A4, A3, A5, Letter, Legal). Brume retient tes derniers choix. Le choix **Enregistrer en PDF dans Documents** range un PDF dans Fichiers, qui s'ouvre ensuite dans Folio.
- **Réglages → Imprimantes** liste les imprimantes, leur état (prête, en cours d'impression, arrêtée), la file d'attente (avec **Annuler**), et permet de choisir l'imprimante par défaut et d'imprimer une page de test.
- **Dans la version web**, Brume prépare le document et la fenêtre d'impression du navigateur prend le relais (choix de l'imprimante, ou « Enregistrer au format PDF »).

Sur le **système Linux**, Brume règle lui-même les imprimantes avec CUPS : **Ajouter une imprimante…** cherche celles branchées en USB ou présentes sur le réseau, et accepte aussi une adresse IP (affichée sur l'écran de l'imprimante ou sur sa page de configuration). Les imprimantes récentes (« AirPrint », « Mopria », « IPP Everywhere », c'est-à-dire presque toutes depuis 2015, Wi-Fi comprises) marchent sans pilote, et apparaissent souvent toutes seules. Pour les plus anciennes, l'image contient les pilotes HP (hpcups), Gutenprint (Epson, Canon…), Brother et Samsung. **Retirer** oublie une imprimante.

Dans l'application sur Windows et macOS, Brume imprime sur les imprimantes déjà installées dans le système ; on les ajoute dans les réglages de Windows ou de macOS. Sur un autre Linux, l'ajout depuis Brume demande que ton compte fasse partie du groupe `lpadmin` (`sudo usermod -aG lpadmin $USER`, puis reconnecte-toi).

## La bureautique : Plume, Abaque, Escale

Trois apps pour écrire, compter et présenter. Leurs documents s'enregistrent dans Fichiers (dossier Documents) et s'ouvrent d'un double-clic. Le menu **Fichier** de chaque app propose aussi **Importer** et **Exporter** au format Office : `.docx`, `.xlsx` et `.pptx`. Glisser un fichier Office sur la fenêtre l'importe aussi.

- **Plume, le traitement de texte** : une page A4, des styles (titres, citation, code), la police, la taille, le gras, l'italique, le soulignement, le barré, la couleur et le surlignage, l'alignement, les listes à puces ou numérotées, les tableaux (Tab passe à la cellule suivante), les images (redimensionnables), les liens, les sauts de page, Rechercher et remplacer (Ctrl+F) et le nombre de mots. **Fichier → Imprimer…** imprime le document ou l'enregistre en PDF (voir [Imprimer](#imprimer)).
- **Abaque, le tableur** : plusieurs feuilles, formules en français (`=SOMME(A1:A3;2,5)`) ou en anglais (`=SUM(A1:A3,2.5)`). Les fonctions disponibles sont SOMME, MOYENNE, MIN, MAX, NB, NBVAL, PRODUIT, MEDIANE, SI, SIERREUR, ET, OU, NON, ARRONDI, ARRONDI.SUP, ARRONDI.INF, ABS, RACINE, PUISSANCE, MOD, ENT, PI, CONCATENER, CONCAT, MAJUSCULE, MINUSCULE, NBCAR, GAUCHE, DROITE, SUPPRESPACE, AUJOURDHUI, MAINTENANT, ANNEE, MOIS, JOUR, DATE, SOMME.SI, NB.SI, MOYENNE.SI et RECHERCHEV. Un clic sur une cellule pendant la saisie d'une formule insère sa référence. On trouve aussi les formats (nombre, pourcentage, monétaire, date), le gras, les couleurs, l'alignement, la recopie (poignée, Ctrl+D, Ctrl+R), le copier-coller qui décale les références, l'insertion et la suppression de lignes et de colonnes (clic droit), le tri, la somme automatique, la somme et la moyenne de la sélection en bas de la fenêtre, et un graphique en barres, en courbes ou en secteurs.
- **Escale, les présentations** : des dispositions (titre, titre et contenu, deux colonnes, section…), six thèmes, des zones de texte, des formes et des images à déplacer et à redimensionner, les notes de l'orateur, la réorganisation des diapositives par glisser-déposer, et le mode **Présenter** en plein écran (flèches, clic, Échap).

Ce qui passe d'un format à l'autre : le texte et sa mise en forme, les titres, les listes, les tableaux et les images de Plume ; les valeurs, les formules, les feuilles, les formats de nombre, le gras, les couleurs et la largeur des colonnes d'Abaque ; les zones de texte, les puces, les formes, les images et les fonds d'Escale. Le reste est ignoré à l'import : en-têtes et pieds de page, notes de bas de page, cellules fusionnées, tableaux et graphiques dans les présentations (Escale indique combien d'éléments n'ont pas été importés). Le graphique d'Abaque et les notes de l'orateur d'Escale restent dans Brume et ne sont pas exportés. Dans Abaque, une formule qui utilise une fonction inconnue garde la dernière valeur calculée par le tableur d'origine.

## La suite créative

Des apps inspirées des grands logiciels de création, avec leurs propres noms. Leurs documents s'enregistrent dans Fichiers avec un aperçu, et leur contenu (photos à calques, vidéos, PDF) est rangé dans le stockage du navigateur ou de l'application, comme la musique de Ressac.

- **Reflet, la retouche photo** : des calques (image ou texte) avec leur opacité et leur mode de fusion (produit, superposition, incrustation, lumière tamisée…), un pinceau et une gomme à taille, dureté et opacité réglables, une pipette, du texte, le recadrage avec proportions (libre, carré, 4:3, 16:9…), la rotation et le miroir, la taille de l'image. Les réglages façon chambre noire s'appliquent sans abîmer la photo : exposition, contraste, hautes lumières, ombres, blancs, noirs, température, teinte, vibrance, saturation, vignettage et grain, avec un histogramme, huit préréglages (Brume, Noir et blanc, Rétro, Crépuscule…) et le bouton **Avant** pour comparer. Le menu **Filtre** propose flou, netteté, noir et blanc, sépia et négatif. Les projets gardent leurs calques (fichiers `.reflet`) ; **Fichier → Enregistrer une copie dans Images** crée une image aplatie, et l'export en PNG ou JPEG la télécharge. Dans Fichiers et dans Aperçu, **Modifier dans Reflet** ouvre une image.
- **Compas, le dessin vectoriel** : un plan de travail à la taille choisie, les outils sélection et sélection directe (déplacer les points et leurs poignées), plume (clic pour un angle, clic-glisser pour une courbe de Bézier), crayon lissé, rectangle arrondi, ellipse, étoile et polygone, segment, texte et pipette. Fond, contour, épaisseur, pointillés et opacité ; position, taille et rotation au pixel près ; alignement, premier plan et arrière-plan, groupes, miroir, dupliquer, copier-coller, grille et magnétisme. Les dessins s'enregistrent en SVG (ils s'ouvrent dans n'importe quel logiciel, et de nouveau dans Compas avec tous leurs réglages) ; **Ouvrir un SVG…** importe les formes, tracés et textes d'un fichier SVG quelconque, et l'export en PNG ou **Enregistrer une copie dans Images** donne une image.
- **Sillage, le montage vidéo** : une timeline à trois pistes (vidéo, titres, son) avec le moniteur au-dessus. Les médias viennent de Ressac (vidéos et musique), de Fichiers (images), des paysages de Brume et des Sons de Brume ; **Importer…** en ajoute depuis l'appareil. On ajoute un clip avec **+** ou en le glissant sur la timeline, on le déplace, on le raccourcit par ses bords, on le coupe au curseur (**S**). Chaque clip a son volume, ses fondus d'entrée et de sortie et, pour les images, un zoom lent (effet Ken Burns) ; un fondu enchaîné relie deux clips. Les titres s'affichent au centre ou en bandeau en bas. Quatre formats : 16:9 (1280 × 720 ou 1920 × 1080), carré et vertical. **Exporter la vidéo…** enregistre le film pendant sa lecture (comptez sa durée) et le range dans Ressac › Vidéos, en MP4 ou en WebM selon ce que sait faire le navigateur ; on peut aussi le télécharger. Le montage lui-même s'enregistre dans Vidéos (fichier `.sillage`).
- **Folio, les PDF** : lire un PDF (miniatures des pages, zoom, pleine largeur, texte sélectionnable), y chercher un mot (**Ctrl+F**), et l'annoter : surligner un passage (on sélectionne le texte), poser une note dans la marge, écrire, dessiner à main levée, encadrer, signer. La signature se trace une fois à la souris ou au doigt (ou s'écrit), puis se pose d'un clic sur chaque document. Les champs des formulaires PDF se remplissent directement sur la page. Le panneau de droite liste les annotations et les champs. Les annotations restent modifiables dans Brume ; **Exporter en PDF** les dessine dans le fichier, qui s'ouvre partout (les notes deviennent des commentaires PDF et les formulaires restent remplissables). **Enregistrer une copie annotée dans Documents** garde aussi l'original. Pour essayer, Folio propose un document d'exemple avec une fiche d'inscription à remplir et signer.

Folio s'appuie sur deux bibliothèques libres, incluses dans `index.html` et chargées seulement à l'ouverture d'un PDF : [pdf.js](https://github.com/mozilla/pdf.js) (© Mozilla, licence Apache 2.0) pour l'affichage, et [pdf-lib](https://github.com/Hopding/pdf-lib) (© Andrew Dillon, licence MIT) pour l'écriture.

## Utilisateurs

Au premier lancement, Brume demande la langue puis crée le premier compte, qui est administrateur. Chaque utilisateur a ses propres fichiers, réglages (thème, accent, fond, langue) et historique de Vigie.

- **Écran de connexion** : il liste les comptes. Chaque compte a un mot de passe obligatoire (au moins 4 caractères), demandé à chaque connexion et pour déverrouiller l'écran. Un compte créé avec une version précédente sans mot de passe doit en choisir un à sa prochaine connexion.
- **Réglages → Utilisateurs** : renommer son compte, changer sa couleur, changer son mot de passe. Un administrateur peut aussi ajouter des utilisateurs (avec leur mot de passe), en supprimer, donner les droits d'administration, et choisir un **nouveau mot de passe** pour quelqu'un qui a oublié le sien.
- **Verrouiller l'écran et se déconnecter** : depuis le menu Brume, le bouton du compte dans la barre d'état, ou le Panneau rapide.
- **Verrouillage automatique** : l'écran se verrouille après 5 minutes sans activité (délai réglable dans **Réglages → Utilisateurs**, de 1 minute à 1 heure, ou jamais). **Ctrl+Alt+L** le verrouille tout de suite ; dans le système Linux, **Super+L** aussi. Une vidéo en cours empêche le verrouillage. Dans l'application et le système Linux, Brume se verrouille aussi quand l'ordinateur se met en veille.

Le mot de passe protège l'accès à une session dans Brume. Les données restent enregistrées sur l'appareil, dans le navigateur ou l'application, sans chiffrement.

## Langues

Brume parle français, anglais, espagnol, allemand, italien et portugais. Au premier lancement, il propose la langue de l'appareil. On la change ensuite dans **Réglages → Langue et région**, où les dates, heures et nombres suivent la langue choisie. Dans le système Linux, ce même réglage choisit aussi la disposition du clavier.


Pour ajouter une langue, ajoute-la à `LANGS`, `LANG_GO` et `LOCALES` au début du script de `index.html`, puis son dictionnaire dans le bloc `<script id="brume-i18n">` (les clés sont les textes français). Pour l'application et le système Linux, ajoute aussi son code à `LANG_OK` dans `main.js`.

## 1. Mettre Brume sur GitHub

1. Sur [github.com](https://github.com), crée un dépôt **public** nommé `brume-os` (bouton **New**).
2. Envoie le contenu du dossier : **Add file → Upload files**, dépose tous les fichiers et dossiers (`index.html`, `main.js`, `preload.js`, `system.js`, `mail.js`, `printing.js`, `game.js`, `display.js`, `mac.js`, `web.js`, `hardware.js`, `siteicons.js`, `nearby.js`, `security.js`, `volume.js`, `calendar.js`, le dossier `mac`, `webview-preload.js`, `package.json`, `README.md`, `.gitignore`, `.github`, `linux`, `scripts`), puis **Commit changes**.
   - Les noms qui commencent par un point (`.github`, `.gitignore`) sont cachés sur certains ordinateurs, et le dépôt de GitHub les ignore parfois. Si le dossier `.github` n'apparaît pas dans ton dépôt, crée ses quatre fichiers sur le site : **Add file → Create new file**, tape le nom complet (`.github/workflows/iso.yml`, puis `app.yml`, `pages.yml` et `moteur.yml`) et colle leur contenu.
3. Active GitHub Pages : **Settings → Pages → Source : GitHub Actions**.
4. Dans l'onglet **Actions**, ouvre « Publier sur GitHub Pages » et clique **Run workflow**. Une minute plus tard, Brume est en ligne à l'adresse `https://TON-PSEUDO.github.io/brume-os/`.

## 2. Obtenir l'application et l'image Linux

1. Sur la page du dépôt : **Releases → Create a new release**.
2. **Choose a tag**, tape `v1.0.0`, puis **Create new tag**. Titre : `Brume OS 1.0`. Clique **Publish release**.
3. GitHub construit tout et ajoute les fichiers à la release. L'application arrive en 10 à 15 minutes, l'image Linux en 30 à 60 minutes :
   - **Windows** : le fichier `.exe`.
   - **macOS** : le `.dmg` qui contient `arm64` pour un Mac Apple Silicon (M1 et suivants), l'autre pour un Mac Intel.
   - **Linux (application)** : le `.AppImage`, ou le `.deb` pour Ubuntu, Debian et Mint.
   - **Système Linux** : `brume-os-v1.0.0-amd64.iso`.

Pour l'image Linux (environ 2 Go), un petit script la télécharge à ta place : il prend l'ISO de la release la plus récente, reprend tout seul si la connexion coupe, et vérifie le fichier avec l'empreinte SHA-256 que donne GitHub. Il l'enregistre dans ton dossier Téléchargements. Remplace `TON-PSEUDO` par ton nom GitHub :

- **Windows** : télécharge `scripts/telecharger-iso.ps1` depuis ton dépôt, puis dans PowerShell, depuis le dossier où il se trouve :
  `powershell -ExecutionPolicy Bypass -File .\telecharger-iso.ps1 -Owner TON-PSEUDO`
- **macOS et Linux** : télécharge `scripts/telecharger-iso.sh`, puis dans le Terminal :
  `bash telecharger-iso.sh TON-PSEUDO`

Si la connexion coupe, relance la même commande : le téléchargement reprend où il en était. Pour un dépôt privé, crée un jeton sur [github.com/settings/tokens](https://github.com/settings/tokens) et mets-le dans la variable `GITHUB_TOKEN` avant de lancer le script.

L'application n'est pas signée, donc ton système demandera une confirmation la première fois :

- **Windows** : sur l'écran SmartScreen, clique **Informations complémentaires**, puis **Exécuter quand même**.
- **macOS** : si l'ouverture est bloquée, va dans **Réglages Système → Confidentialité et sécurité** et clique **Ouvrir quand même**. Si macOS indique que l'app est endommagée, ouvre le Terminal et tape :
  `xattr -cr "/Applications/Brume OS.app"`
- **Linux** : rends l'AppImage exécutable (clic droit → Propriétés → Autoriser l'exécution), puis double-clique dessus.

### Les mises à jour

Le numéro de la release devient la version de Brume (`v1.0.1` → 1.0.1). Pour publier une nouvelle version, crée une release avec un numéro plus grand que la précédente (`v1.0.1`, `v1.1.0`…).

- **Système Linux installé** : il cherche une nouvelle version toutes les 6 heures, la télécharge, vérifie qu'elle vient bien de ton dépôt (empreinte SHA-256 donnée par GitHub), puis l'installe tout seul. Un avis propose de redémarrer Brume pour l'utiliser. **Réglages → Sécurité** montre où il en est et a un bouton **Rechercher**.
- **Application** (Windows, Mac, Linux) : un avis signale la nouvelle version ; **Télécharger** ouvre la release.
- **Moteur web** : chaque release prend la dernière version corrective de Chromium (le moteur de Vigie et des apps du Comptoir). De plus, le workflow **Moteur web à jour** regarde chaque lundi si une version corrective est sortie ; si oui, il publie tout seul la release suivante (`v1.0.4` après `v1.0.3`), et les ordinateurs installés la reçoivent. Il ne fait rien tant que tu n'as pas publié ta première release.

Le dépôt doit rester **public** : sinon, Brume ne voit pas les releases. Passer à une nouvelle version majeure d'Electron (de 45 à 46, par exemple) se fait à la main dans `package.json`, car elle peut demander des retouches ; Electron ne corrige une version majeure que pendant environ six mois.

## 3. Brume OS, le système Linux

L'image ISO est une Debian 13 qui démarre directement sur Brume, en plein écran. Il n'y a pas d'autre bureau derrière : Brume est l'interface du système. Vigie y est un vrai navigateur, le menu Brume (en haut à gauche) propose **Redémarrer** et **Éteindre**, et les Réglages règlent le **Wi-Fi** et le **Bluetooth**.

Elle sert de trois façons : l'essayer depuis une clé USB sans rien toucher, la garder sur la clé avec tes fichiers, ou **installer Brume sur l'ordinateur**, à côté de Windows ou à sa place.

### Essayer dans une machine virtuelle (conseillé pour commencer)

Avec [VirtualBox](https://www.virtualbox.org) sur Windows, Linux ou un Mac Intel :

1. **Nouvelle** machine. Image ISO : le fichier `brume-os-…-amd64.iso`. Type : Linux, version : Debian (64-bit).
2. Mémoire : 4 Go. Processeurs : 2. Pour essayer aussi l'installation, crée un disque dur virtuel de 25 Go ; sinon, aucun disque n'est nécessaire.
3. Clique **Démarrer**. Brume s'ouvre au bout d'une trentaine de secondes.
4. Si l'écran reste noir, éteins la machine et coche **Activer l'accélération 3D** dans **Configuration → Affichage**. **Réglages → Cet appareil** indique aussi quand l'accélération manque.
5. Si l'image est trop petite ou trop grande, choisis une autre résolution dans **Réglages → Écran** : la liste est celle de l'écran virtuel.

Installer dans la machine virtuelle est la meilleure répétition avant ton PC : même installateur, sans risque. Pour imiter un PC récent, coche **Activer EFI** dans **Configuration → Système**.

Sur Linux, GNOME Boxes fonctionne aussi : ouvre simplement le fichier ISO. Sur un Mac Apple Silicon, l'image doit être émulée (avec UTM), ce qui est très lent.

### Démarrer un vrai PC depuis une clé USB

1. Copie l'ISO sur une clé USB d'au moins 4 Go (8 Go ou plus pour garder tes fichiers dessus). Le contenu de la clé est effacé.
   - Sur Windows, avec [Rufus](https://rufus.ie) : choisis la clé et l'ISO. Pour garder tes fichiers sur la clé, règle **Taille de la partition persistante** (4 Go, par exemple). Si Rufus demande un mode d'écriture, choisis **ISO**. Pour un PC d'avant 2011 environ (BIOS classique, sans UEFI), règle **Schéma de partition** sur **MBR**.
   - Sinon, avec [balenaEtcher](https://etcher.balena.io) (sans partition de conservation).
2. Redémarre le PC sur la clé : appuie sur F12, F9, F11 ou Échap au démarrage, selon la marque.
3. Si le PC refuse de démarrer sur la clé, désactive **Secure Boot** dans les réglages du BIOS. Sur les Acer et Packard Bell, le menu F12 est souvent désactivé : appuie sur F2 au démarrage, mets **F12 Boot Menu** sur **Enabled** (onglet **Main**), puis F10 pour enregistrer.

Sans partition de conservation, rien n'est gardé : tout ce que tu crées disparaît à l'extinction, comptes compris. Avec la partition créée par Rufus, Brume garde tes comptes, fichiers, réglages et réseaux Wi-Fi sur la clé, d'un démarrage à l'autre. **Réglages → Stockage** indique dans quel cas tu es.

### Installer Brume sur l'ordinateur

Une fois installé, Brume démarre sans la clé, garde tout sur le disque, reçoit chaque jour les correctifs de sécurité de Debian et installe tout seul les nouvelles versions de Brume (voir [Les mises à jour](#les-mises-à-jour) et [La sécurité](#la-sécurité)).

> **Avant de toucher à ton PC, fais l'installation une fois dans une machine virtuelle**, puis sauvegarde tes fichiers importants sur un disque externe ou en ligne. Une erreur de partitionnement peut effacer des données.

**À côté de Windows** (tu choisis Brume ou Windows à chaque démarrage) — prépare la place dans Windows d'abord :

1. Clic droit sur **Démarrer → Gestion des disques**. Clic droit sur **C:** → **Réduire le volume**. Indique au moins `30000` Mo et valide : un « Espace non alloué » apparaît.
2. Désactive le démarrage rapide : **Panneau de configuration → Options d'alimentation → Choisir l'action des boutons d'alimentation → Modifier des paramètres actuellement non disponibles**, décoche **Activer le démarrage rapide**.
3. Si Windows est chiffré (BitLocker ou « Chiffrement de l'appareil »), note ta clé de récupération (sur [account.microsoft.com/devices/recoverykey](https://account.microsoft.com/devices/recoverykey)) : Windows peut la demander au premier démarrage après l'installation.
4. Démarre sur la clé USB, puis dans Brume : **Réglages → Installation → Ouvrir l'installateur** (ou **Installer Brume…** dans le menu Brume).
5. À l'étape **Partitions**, choisis **Remplacer une partition**, puis clique sur l'**Espace libre** créé à l'étape 1. (L'option **Installer à côté** sait aussi réduire Windows elle-même, avec un curseur, si le démarrage rapide est désactivé et le disque non chiffré.)

**À la place de Windows** (Windows et tous ses fichiers sont effacés) : démarre sur la clé, ouvre l'installateur et, à l'étape **Partitions**, choisis **Effacer le disque**.

**Chiffrer le disque** (conseillé pour un ordinateur portable) : à l'étape **Partitions**, coche **Chiffrer le système** et choisis une phrase de passe. Sans elle, personne ne peut lire tes fichiers, même en retirant le disque.

- Elle est demandée à chaque démarrage, sur l'écran de démarrage de Brume, avec ton clavier (AZERTY). Ensuite, tout se passe comme d'habitude.
- Note-la quelque part en lieu sûr : **perdue, elle ne se récupère pas**, et tes fichiers non plus.
- Seul le dossier de démarrage (`/boot`, 1 Go) reste en clair : il ne contient que le système, pas tes fichiers.
- Sur un vieux processeur sans accélération du chiffrement (comme le Core 2 Duo), le disque est un peu plus lent, surtout pendant les grosses copies.

Dans l'installateur :

- **Utilisateurs** : c'est le compte de l'ordinateur (son mot de passe, de 8 caractères au moins, sert pour l'écran de secours et les tâches d'administration). Laisse **Démarrer la session sans demander de mot de passe** coché pour arriver directement dans Brume, qui garde ses propres comptes et mots de passe.
- Sur un ordinateur ancien, l'écran peut rester noir jusqu'à une minute avant que l'installateur apparaisse. S'il s'arrête sur une erreur, Brume revient tout seul et **Réglages → Installation** montre ce qu'il a dit.
- Rien n'est écrit sur le disque avant la dernière confirmation. Ensuite, la copie prend 5 à 15 minutes.
- Par défaut, ce que tu as fait dans Brume pendant la session sur la clé (utilisateurs, fichiers, réglages, réseaux Wi-Fi) est copié sur le disque. Décoche la case dans **Réglages → Installation** pour repartir de zéro.
- À la fin, retire la clé et redémarre. Avec Windows à côté, un menu au démarrage propose **Brume OS GNU/Linux** ou **Windows Boot Manager**.

### Le Wi-Fi

L'icône réseau, en haut à droite, ouvre **Réglages → Réseau** : allumer ou couper le Wi-Fi, choisir un réseau, taper son mot de passe, oublier un réseau, rejoindre un réseau masqué. Les réseaux d'entreprise (identifiant et mot de passe, comme eduroam) ne sont pas pris en charge. Le câble Ethernet fonctionne sans réglage.

L'image contient les pilotes non libres (« firmware ») des cartes Wi-Fi et graphiques courantes : Intel, Realtek, Atheros, Broadcom, MediaTek, AMD, NVIDIA. Si Brume indique **Aucune carte Wi-Fi trouvée** sur un PC qui en a une, branche un câble ou une clé Wi-Fi USB.

### Le Bluetooth

Dans le Panneau rapide (en haut à droite), la tuile **Bluetooth** ouvre **Réglages → Bluetooth** : allumer ou couper le Bluetooth, chercher les appareils à proximité, les associer, les connecter, les déconnecter ou les oublier. Ça marche pour les casques, écouteurs, enceintes, claviers, souris et manettes.

1. Mets l'appareil en mode association, souvent par un appui long sur son bouton Bluetooth.
2. Il apparaît dans **Appareils à proximité** : clique **Associer**.
3. Si un code s'affiche, Brume demande de vérifier qu'il est le même sur l'appareil (téléphone), de le taper sur l'appareil (clavier) ou de saisir son code PIN (anciens appareils, souvent `0000`).

Un appareil associé se reconnecte ensuite tout seul quand il est allumé. Dès qu'un casque ou une enceinte se connecte, le son de Brume passe dessus ; il revient sur les haut-parleurs quand on le déconnecte. Quand un appareil est connecté, une icône Bluetooth apparaît dans la barre du haut, et Réglages affiche sa batterie s'il la donne.

Pas encore pris en charge : envoyer des fichiers, partager la connexion d'un téléphone, et rendre Brume visible depuis un autre appareil (c'est toujours Brume qui cherche). L'image contient les pilotes Bluetooth des puces Intel, Realtek, Qualcomm Atheros et MediaTek ; certaines puces Broadcom n'en ont pas sous Debian. Si Brume indique **Aucun adaptateur Bluetooth trouvé**, un petit adaptateur Bluetooth USB fait l'affaire.

### Les imprimantes

**Réglages → Imprimantes → Ajouter une imprimante…** : branche l'imprimante en USB ou mets-la sur le même réseau (Wi-Fi ou câble), puis clique **Ajouter** à côté de son nom. Si elle n'apparaît pas, tape son adresse IP. Voir [Imprimer](#imprimer) pour le reste.

### L'écran

**Réglages → Écran** change la résolution, la fréquence et la taille des éléments, avec un retour automatique si le nouvel affichage n'est pas confirmé. Voir [L'écran](#lécran).

### À savoir

- Brume n'exécute pas les logiciels Windows (jeux, Office, logiciels d'imprimante). Il n'y a pas encore de numérisation (scanner).
- Avec Windows à côté, l'heure de Windows peut être décalée d'une ou deux heures après un passage par Brume ; elle se corrige quand Windows se remet à l'heure par Internet.
- Le clavier démarre en AZERTY et l'heure est celle de Paris. Le clavier se change dans **Réglages → Langue et région**, ou dans l'installateur.
- Pour voir les messages du démarrage (en cas de souci), appuie sur Échap pendant l'écran de démarrage.
- Écran texte de secours : Ctrl+Alt+F2. Sur la clé : identifiant `user`, mot de passe `live`. Une fois installé : le compte créé dans l'installateur. Retour à Brume : Ctrl+Alt+F1.
- Les correctifs de Debian et les nouvelles versions de Brume s'installent tout seuls (voir [La sécurité](#la-sécurité)).

### La sécurité

**Réglages → Sécurité** montre l'état de chaque protection :

- **Mises à jour de Brume** : installées toutes seules (voir [Les mises à jour](#les-mises-à-jour)), avec le moteur web, la principale porte d'entrée des attaques. Rien n'est accepté d'autre que ton dépôt GitHub. Le service `brume-maj` vérifie la taille, l'empreinte SHA-256, le nom et la version du paquet, puis l'installe avec `apt`.
- **Correctifs de sécurité de Debian** : chaque jour, pour tout le reste du système.
- **Pare-feu** (nftables) : tout ce qui arrive d'un autre appareil est refusé, sauf le partage à proximité (LocalSend, AirDrop) et la découverte des imprimantes. Brume ne répond pas au ping, et aucun service d'accès à distance (SSH…) n'est installé. Il est actif aussi sur la clé USB, utile sur un Wi-Fi public.
- **Chiffrement du disque** : activé ou non à l'installation (voir plus haut).

Le seul réglage sans mot de passe administrateur est **Rechercher** (il démarre `brume-maj`, rien d'autre). Pas besoin d'antivirus : les logiciels Windows ne fonctionnent pas sous Linux, et Brume n'installe pas de logiciels venus du Web. Restent, comme partout, les arnaques en ligne (faux sites, faux mails).

### Construire l'image soi-même

Sur un ordinateur Linux avec Docker et [Node.js](https://nodejs.org) 22 ou plus récent :

```
npm install
npx electron-builder --linux deb --x64
mkdir -p linux/config/packages.chroot
cp dist/*.deb linux/config/packages.chroot/
sudo docker run --rm --privileged -v "$PWD/linux:/build" -w /build debian:trixie \
  bash -c "apt-get update && apt-get install -y live-build && bash ./build.sh"
```

L'image apparaît dans `linux/brume-os-amd64.iso`.

## Lancer l'application depuis le code

```
npm install
npm start
```

`npm run dist` fabrique l'installateur pour ton système dans le dossier `dist`.

## Contenu du dépôt

| Fichier | Rôle |
|---|---|
| `index.html` | Tout Brume : interface, apps, Vigie, Courrier, Calendrier, Ressac, le Comptoir, la bureautique et la suite créative |
| `main.js`, `preload.js` | Fenêtre de l'application, vues web et fenêtres de connexion, lecture protégée (Widevine), Éteindre / Redémarrer, lancement de l'installateur |
| `system.js` | Stockage des fichiers sur le disque, Wi-Fi (NetworkManager), Bluetooth (BlueZ), détection de la clé USB |
| `mail.js` | Courrier : comptes, IMAP et SMTP, relève (les mots de passe restent ici) |
| `calendar.js` | Calendrier : comptes CalDAV (celui de Courrier ou un autre) et abonnements `.ics`, requêtes signées vers le serveur du compte (les mots de passe restent ici) |
| `printing.js` | Impression : imprimantes, impression sans fenêtre, PDF, et sur Linux réglage des imprimantes avec CUPS |
| `game.js` | GeForce NOW : sa fenêtre à part (clavier et souris verrouillés en plein écran), sa barre sur le système Linux |
| `mac.js` | Mac distant : la connexion au Mac (réseau), le compte Scaleway (API Apple silicon), la fenêtre du Mac, le son par SSH (bibliothèque ssh2) |
| `mac/` | La fenêtre du Mac : son interface, noVNC (affichage du partage d'écran d'Apple), la lecture du son (`son.js`) et le script déposé sur le Mac pour le son (`son.sh`) |
| `display.js` | Écran : résolution, fréquence et taille des éléments sur le système Linux (avec wlr-randr), confirmation et retour automatique, réglage repris au démarrage |
| `web.js` | Vigie : téléchargements, autorisations des sites, raccourcis du navigateur dans les pages, effacer les données |
| `nearby.js` | Partager : LocalSend (découverte, envoi, réception), AirDrop par omdrop sur le système Linux, menu de partage de macOS |
| `volume.js` | Système Linux : le volume de l'ordinateur (PipeWire, par `pactl` ou `wpctl`), les touches de volume du clavier, la sortie utilisée |
| `security.js` | Réglages → Sécurité : état des mises à jour de Brume (système Linux) ou nouvelle version sur GitHub (application), pare-feu, chiffrement du disque |
| `siteicons.js` | Comptoir : lit l'icône que chaque site publie (icône Apple, manifeste, icône de la page) et la garde sur le disque |
| `hardware.js` | Cet appareil : détection du modèle, du processeur, de la mémoire, de la carte graphique, des écrans, des disques, de la batterie, du réseau, du Bluetooth et du son (Linux, Windows, macOS) |
| `webview-preload.js` | Onglets de Vigie : relais des notifications des sites vers les avis de Brume, et de ce qu'ils jouent (titre, pochette, lecture) vers le Panneau rapide |
| `package.json` | Dépendances (dont l'Electron de castlabs) et réglages de construction |
| `scripts/` | `version.js` (version d'après l'étiquette de la release, dépôt des mises à jour) et `moteur.js` (dernière version corrective du moteur web), signature Widevine facultative des versions Windows et macOS (service EVS de castlabs), et `telecharger-iso` pour récupérer l'image Linux d'une release |
| `linux/` | Image Debian : session plein écran, ouverture automatique, écrans de démarrage et d'arrêt (thème Plymouth dans `linux/config/includes.chroot/usr/share/plymouth/themes/brume` ; `brume-arret` met « Arrêt en cours » dans la langue de Brume), pilotes (dont ceux des imprimantes), installateur (Calamares, dans `linux/config/includes.chroot/etc/calamares`) ; sécurité : pare-feu (`usr/share/brume/pare-feu.nft`), mises à jour de Brume (`brume-maj` et `brume-maj.timer`), chiffrement proposé par l'installateur |
| `.github/workflows/pages.yml` | Publication de la version web |
| `.github/workflows/app.yml` | Construction de l'application pour les trois systèmes |
| `.github/workflows/iso.yml` | Construction de l'image Linux |
| `.github/workflows/moteur.yml` | Chaque lundi : si le moteur web a une version corrective, publie la release suivante |

## Tes données

Les fichiers et réglages de Brume restent sur ton appareil.

- **Version web** : dans le navigateur. Les documents de Plume, Abaque et Escale (images comprises, réduites si elles sont très grandes) partagent avec les notes environ 5 Mo : pour garder un gros document ailleurs, exporte-le en `.docx`, `.xlsx` ou `.pptx`.
- **Application et système Linux installé** : dans des fichiers sur le disque (dossier `donnees` de Brume, dans `~/.config/Brume OS` sur Linux, `%APPDATA%\Brume OS` sur Windows), sans limite de taille autre que le disque. Au premier lancement de cette version, Brume y reprend ce qu'il gardait avant.
- **Système Linux sur clé USB** : en mémoire jusqu'à l'extinction, ou sur la clé si elle a une partition de conservation.
