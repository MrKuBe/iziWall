# 📌 Mur Collaboratif - Widget Grist Amélioré

> **Langues disponibles** : [🇫🇷 Français](./README.md) | [🇺🇸 English](./README.en.md)

Un widget personnalisé Grist pour créer un **mur collaboratif** avec système Kanban, modération, et collaboration en temps réel.

> 🎮 **Démo en ligne** : [Tester iziWall](https://grist.numerique.gouv.fr/o/iziwall-demo/dVQtFTVwGDgH/iziWall-Demo)  
> Lors de la connexion, si une adresse email vous est demandée, cliquez simplement sur le bouton **👻 Anonyme** pour accéder au mur de démonstration.

![Vue principale - Thème clair](screenshots/Mainboard-day-theme.png)

## ✨ Nouvelles Fonctionnalités
### 📊 Statistiques Interactives (v2.7)
- **Cliquer pour filtrer** : Chaque élément du panneau statistiques est cliquable et filtre instantanément le board
  - **Stat-cards** : Total, Approuvées, En attente, En retard, Échéance aujourd'hui, Proches échéance → appliquent le filtre correspondant
  - **Barres catégories** : Clic pour scroller vers la colonne correspondante
  - **Barres auteurs / responsables** : Filtrent par auteur ou responsable
  - **Priorités** : Filtrent par priorité (Critique, Haute, Moyenne, Basse)
  - **Tags** : Filtrent par tag
  - **Badges Assignées / Non assignées** : Filtrent les cartes avec ou sans responsable
  - **Archives & CODIR** : Ouvrent directement leur panneau respectif
- **Bouton Réinitialiser filtres** dans l'en-tête du panneau statistiques
- **Responsables actifs uniquement** : Les stats responsables excluent les cartes terminées et archivées
- **Effets visuels** : Hover avec translation, ombre et bordure accent sur les éléments cliquables
### � Envoi & Partage de Fiches par Email (v2.6)
- **Copier une fiche** : Bouton 📋 dans la vue détail pour copier le contenu complet de la fiche dans le presse-papiers (titre, catégorie, priorité, échéance, auteur, responsable, tags, description, commentaires)
- **Envoyer par email** : Bouton 📧 dans la vue détail ouvrant une modale dédiée
  - **Sélection du destinataire** :
    - Clic rapide sur le responsable de la carte (si un email est connu)
    - Liste déroulante des responsables avec email
    - Saisie libre d'une adresse email
  - **Message personnalisé** : Ajoutez un message additionnel au corps de l'email
  - **Aperçu** : Visualisez le contenu qui sera envoyé avant d'envoyer
  - **Client mail** : Ouvre le client email du navigateur (mailto:) avec sujet et corps pré-remplis
  - Compatible Outlook, Thunderbird, Gmail, etc.
- **Aucun serveur requis** : Fonctionne entièrement côté client

### �🔍 Recherche/Filtrage Avancé
- **Barre de recherche en temps réel** : Recherchez des cartes par titre, contenu ou auteur
- **Filtrage par auteur** : Voyez uniquement les cartes d'une personne spécifique
- **Filtrage par responsable** : Affichez les cartes assignées à un responsable précis, ou celles non assignées
- **Filtrage par priorité** : Affichez uniquement les cartes urgentes, importantes, etc.
- **Filtrage par tag** : Sélectionnez un tag dans le dropdown pour afficher les cartes correspondantes
- Les filtres se combinent pour affiner vos recherches

### 🎯 Drag & Drop Entre Colonnes
- **Déplacement fluide** : Glissez les cartes d'une colonne à l'autre
- **Feedback visuel** : Voir en temps réel la zone de dépôt
- **Animations lisses** : Transitions élégantes lors du déplacement
- Les colonnes se mettent à jour immédiatement

### 🏷️ Badges de Statut Personnalisés
- **Badge d'approbation** : Les cartes en attente d'approbation sont clairement marquées (⏳)
- **Badges de priorité** : Chaque carte affiche sa priorité avec une couleur distincte
  - ⬇️ **Basse** (vert) : Pas urgent
  - ➡️ **Moyenne** (orange) : Normal
  - ⬆️ **Haute** (rouge) : Important
  - 🔴 **Urgente** (rouge foncé) : Critique avec animation de pulsation

### 📅 Indicateurs de Date Limite
- **Affichage intelligent des deadlines** :
  - ⚠️ **Dépassée** : Affichée en rouge
  - ⏰ **Aujourd'hui** : Affichée en orange
  - 📅 **Demain** : Affichée en bleu ciel
  - 📆 **Prochains jours** : Compte à rebours visible
- Les dates limites apparaissent sur chaque carte
- Animations d'apparition fluides

### ✨ Animations Améliorées
- **Au survol des cartes** : Élévation et ombre augmentée
- **Drag & Drop** : Cartes transparentes et rotation légère
- **Badges** : Apparition avec slide de gauche à droite
- **Deadlines** : Apparition slide de bas en haut
- **Priorité Urgente** : Pulsation continue pour attirer l'attention
- **Transitions de thème** : Changement doux clair ↔ sombre

## 📊 Nouvelles Fonctionnalités (v2.7)

### 📊 Statistiques Interactives
- **Tous les éléments du panneau stats sont cliquables** : filtrent le board ou ouvrent le panneau correspondant
- **Bouton Réinitialiser filtres** ajouté dans l'en-tête des stats
- **Responsables actifs uniquement** : exclut les cartes terminées et archivées
- **Effets visuels hover** sur tous les éléments cliquables

## 📊 Nouvelles Fonctionnalités (v2.6)

### 📧 Envoi & Partage de Fiches par Email
- **📋 Copier** : Copie le contenu formaté de la fiche dans le presse-papiers
- **📧 Envoyer** : Modale de sélection du destinataire (responsable, liste, ou saisie libre) avec aperçu et message personnalisé
- Ouvre le client email natif via `mailto:` — aucun serveur requis

## 📊 Nouvelles Fonctionnalités (v2.5)

### ⚠️ Alerte cartes en retard
- **Popup automatique** : À la connexion (email ou auto-login), si des cartes assignées à l'utilisateur (auteur ou responsable) ont une échéance dépassée, une alerte modale s'affiche
- **Liste détaillée** : Chaque carte en retard est affichée avec son titre, sa catégorie, la date d'échéance et le nombre de jours de retard
- **Accès rapide** : Cliquer sur une carte dans l'alerte ouvre directement son détail
- **Lien vers le calendrier** : Bouton "📅 Voir mon calendrier" pour basculer vers le calendrier
- **Une seule fois** : L'alerte ne s'affiche qu'une seule fois par session

### 🚪 Déconnexion
- **Bouton de déconnexion** : Icône 🚪 dans le header pour se déconnecter et passer en mode anonyme
- **Bouton de connexion** : Icône 🔑 affichée en mode anonyme pour se connecter rapidement

## 📊 Nouvelles Fonctionnalités (v2.4)

### 📅 Calendrier : connexion requise & correspondance robuste
- **Mode anonyme** : Le panneau Calendrier affiche désormais un écran d'invitation à se connecter (🔒) avec un bouton "Se connecter" au lieu d'un calendrier vide
- **Correspondance insensible à la casse** : La détection auteur/responsable ignore désormais les différences de majuscules/minuscules
- **Multi-identités** : Le calendrier matche sur le pseudo, le prénom+nom, l'email, et le nom dans la table Responsables pour une correspondance robuste
- **Détection "Terminé" corrigée** : Détection stricte par nom exact pour éviter les faux positifs

## 📊 Nouvelles Fonctionnalités (v2.3)

### 📋 Duplication de Cartes
- **Dupliquer rapidement** : Bouton 📋 au survol de chaque carte (entre Archiver et Modifier)
- **Même catégorie** : La copie est créée dans la même colonne que l'originale
- **Titre automatique** : Le suffixe " - Copy" est ajouté au titre
- **Traçabilité** : L'historique mentionne la duplication avec référence à la carte originale
- **Propriétés copiées** : Contenu, priorité, deadline, tags, responsable, images et liens
- **CODIR et Archive réinitialisés** à false sur la copie

## 📊 Nouvelles Fonctionnalités (v2.2)

### 🖥️ Panneaux Exclusifs
- **Fermeture automatique** : Ouvrir un panneau (Statistiques, Archives, CODIR, Calendrier) ferme automatiquement les autres
- **Expérience unifiée** : Plus besoin de fermer manuellement chaque panneau

### 🏛️ CODIR Amélioré
- **Contenu des cartes** : Le panneau CODIR et l'export affichent désormais le contenu des cartes (aperçu texte)
- **Deadline affichée** : La date d'échéance apparaît dans le panneau et dans l'export
- **Cartes terminées** : Les cartes dans la dernière colonne n'affichent plus de notion d'échéance dépassée (✅ Terminé à la place)

### 📅 Calendrier Amélioré
- **Détection élargie** des responsabilités : la correspondance se fait aussi par le nom complet (table Responsables), pas seulement par le pseudo

## 📊 Nouvelles Fonctionnalités (v2.0+)

### 📈 Statistiques du Tableau

![Dashboard de statistiques](screenshots/statistics.png)

- **Dashboard interactif** : Voyez d'un coup d'œil :
  - 📌 Total de cartes
  - ✅ Cartes approuvées
  - ⏳ En attente d'approbation
  - ⚠️ Cartes en retard (deadline dépassée)
  - ⏰ Échéances du jour
  - 📅 Échéances sous 3 jours
  - 💬 Nombre total de commentaires
  - ❤️ Nombre total de likes
- **Graphiques de répartition** :
  - Cartes par catégorie (barres horizontales colorées)
  - Répartition par priorité avec pourcentages
  - Top contributeurs (auteurs les plus actifs)
  - Répartition par responsable (assignées vs non assignées)
  - Top 8 des tags les plus utilisés (cliquables)
  - Contenu des cartes (images, liens, pièces jointes, tags distincts)
- **Toggle** : Afficher/masquer le dashboard avec le bouton 📊 dans le header

### 🏷️ Gestion des Tags/Couleurs
- **Tags personnalisés** : Ajoutez plusieurs tags à chaque carte
  - Format : `urgent, client, feedback`
  - Séparés par virgules
- **Couleurs automatiques** : Chaque tag a une couleur distincte
  - Couleurs déterminées automatiquement
  - Cohérentes à travers toutes les cartes
- **Filtrage par tag** : Cliquez sur un tag pour voir toutes les cartes avec ce tag
- **Affichage** :
  - Tags visibles sur chaque carte (🏷️ Libellé)
  - Tags cliquables pour filtrer instantanément
  - Tags dans la vue détail

### 📝 Historique & Commentaires Amélioré
- **Historique automatique** :
  - Suivez chaque modification de carte
  - **Suivi des changements d'état** : chaque déplacement entre colonnes est enregistré (ex: `"À faire" → "En cours"`)
  - Suivi des approbations par les administrateurs
  - Affiche qui a modifié, quoi et quand
  - Format : `[Date/Heure] Auteur - Action: Détails`
  - Visible dans la vue détail (dernières 5 entrées)
- **Commentaires enrichis** :
  - Ajoutez des discussions sur chaque carte
  - Affichage du timestamp
  - Possibilité d'éditer ses propres commentaires (prochaine version)
  - Suppression des commentaires par auteur ou admin
- **Traçabilité** :
  - Sachez qui a créé, modifié, déplacé, approuvé chaque carte
  - Historique complet des passages entre états (colonnes)
  - Référence complète des changements

### 📦 Archivage

![Mode archivage](screenshots/archive_mode.png)

- **Archiver les cartes terminées** :
  - Bouton 📦 en survol sur chaque carte ou dans la vue détail
  - Les cartes archivées disparaissent du tableau principal
  - Historique automatique (date/auteur de l'archivage)
- **Désarchiver** :
  - Panneau d'archives accessible via le bouton 📦 dans le header
  - Bouton ♻️ Restaurer pour remettre une carte sur le tableau
  - Affichage groupé par catégorie
- **Export** :
  - Les cartes archivées sont incluses dans l'export CSV avec la colonne "Archivée"

### 🏛️ CODIR (Comité de Direction)

![Mode CODIR](screenshots/codir-mode.png)

- **Marquer les cartes pour le CODIR** :
  - Toggle slider en haut à gauche de chaque carte
  - Visible au survol, reste affiché si activé
  - Icône 🏛️ sur les cartes marquées
  - Bouton CODIR également dans la vue détail
  - Historique automatique des ajouts/retraits
- **Ordre du jour CODIR** :
  - Panneau dédié accessible via le bouton 🏛️ dans le header
  - Cartes groupées par catégorie et triées par priorité
  - Date du jour affichée
  - Export HTML imprimable (ordre du jour formatté)
  - Retrait rapide de cartes depuis le panneau
- **Export** :
  - Colonne "CODIR" dans l'export CSV
  - Compteur CODIR dans les statistiques

### � Calendrier Personnel
- **Vue d'ensemble de vos tâches** :
  - 📅 Bouton dans le header pour voir toutes vos cartes
  - Affiche les cartes où vous êtes **auteur** ou **responsable**
  - Regroupement par urgence : En retard, Aujourd'hui, Demain, Cette semaine, Semaine prochaine, Plus tard, Sans échéance
  - Badges de résumé rapide (nombre en retard, à faire aujourd'hui)
- **Détails par carte** :
  - Priorité, catégorie, deadline avec indicateur visuel
  - Rôle affiché (auteur ou responsable)
  - Clic pour ouvrir le détail de la carte
  - Marquage CODIR visible

### �📤 Export & Partage
- **Export en CSV** :
  - 📥 Bouton d'export dans le header
  - Format complet : Titre, Catégorie, Auteur, Priorité, Deadline, Tags, Statut
  - Inclut les statistiques : nombre de likes et commentaires
  - Compatible Excel/Google Sheets
  - Fichier nommé `mur-collaboratif-YYYY-MM-DD.csv`
- **Partage de vue** :
  - 🔗 Génère un URL avec les filtres actuels
  - Copie automatiquement dans le presse-papiers
  - Partagez une vue filtrée (ex: par auteur, priorité, tags)
  - Les destinataires voient la même vue

## 📊 Fonctionnalités Existantes

### 👥 Gestion des Utilisateurs
- **Connexion simplifiée en 2 étapes** :
  1. Saisie de l'email uniquement
  2. Si l'email existe → connexion automatique ; sinon → création du profil
- **Détection automatique Grist** : Si l'utilisateur est connecté à une session Grist (DINUM), son email est détecté automatiquement
- **Mode anonyme** : Possibilité de continuer sans compte (👻)
- **Session persistante** : L'email est sauvé localement pour les visites suivantes
- **Permissions intelligentes** :
  - Les modérateurs peuvent approuver/rejeter
  - Les utilisateurs normaux peuvent modifier leurs propres cartes
  - Mode admin pour la gestion complète

### 👤 Attribution de Responsables

![Gestion des responsables](screenshots/authors-managment.png)

- **Assigner un responsable** : Chaque carte peut avoir un responsable
- **Gestion des responsables** (👥 dans le header) :
  - Ajouter de nouveaux responsables (nom, email, fonction)
  - Modifier les responsables existants
  - Supprimer des responsables (avec mise à jour automatique des cartes)
  - Renommage propagé : le changement de nom met à jour toutes les cartes assigns
- **Table dédiée** : Table Grist `Responsables` (avec fallback sur Users)
- **Affichage du responsable** :
  - Avatar avec initiales (couleur primaire)
  - Nom affiché sous forme de badge 👤
  - Fonction affichée dans le sélecteur
  - Visible sur les cartes et en vue détail
- **Historique** : Les changements de responsable sont enregistrés
- **Export** : Le responsable est inclus dans l'export CSV

### 🎨 Thème Clair/Sombre

![Vue principale - Thème sombre](screenshots/Mainboard-dark-theme.png)

- **Toggle de thème** : Basculez entre mode clair et sombre
- **Persistance** : Votre préférence est sauvegardée
- **Design responsive** : Fonctionne parfaitement sur tous les appareils

### 📁 Gestion des Catégories

![Gestion des catégories](screenshots/categories-managment.png)

- **Colonnes personnalisées** : Créez autant de colonnes que nécessaire
- **Personnalisation** :
  - Emoji personnalisé
  - Couleur distincte
  - Nom configurable
- **Ordre drag & drop** : Réorganisez les colonnes (futurs)

### ✔️ Système de Modération

![Vue détaillée d'une carte](screenshots/card-view.png)

- **Mode modération activable** : Admin peut activer/désactiver la modération
- **Approbation nécessaire** : Les nouvelles cartes sont en attente d'approbation
- **Visibility intelligente** :
  - Admins voient tout
  - Utilisateurs voient cartes approuvées + leurs propres cartes
- **Boutons d'approbation/rejet** : Contrôle rapide pour les modérateurs

### 💬 Interactions Sociales
- **Likes/Votes** : ❤️ Les utilisateurs peuvent marquer les cartes préférées
- **Commentaires** : Discutez directement sur chaque carte
- **Compteurs** : Affichez les likes et commentaires sur chaque carte
- **Animations** : ❤️ Animation heartbeat au like

### 📎 Pièces Jointes & Liens
- **Consultation des pièces jointes** : Les images et fichiers joints s'affichent et se téléchargent directement depuis le widget
- **Ajout de pièces jointes** : L'ajout de fichiers doit se faire directement dans la colonne `PieceJointe` de la table `Cartes` dans l'interface Grist (limitation CORS des widgets iframe)
- **Liens externes** : Ajoutez des URLs vers des ressources depuis le widget
- **Prévisualisation** : Icônes distinctes par type de fichier

### 🔄 Champs Maintenant Supportés

| Champ | Type | Description |
|-------|------|-------------|
| **Titre** | Text | Titre principal de la carte |
| **Contenu** | Long Text / Rich Text | Description détaillée |
| **Auteur** | Text | Nom de l'auteur |
| **Auteur_Pseudo** | Text | Pseudo de l'utilisateur |
| **Session_ID** | Text | ID unique de la session |
| **Categorie** | Link | Lien vers la catégorie |
| **Approuve** | Boolean | Statut d'approbation |
| **DateCreation** | Date | Date de création |
| **Priorite** | Select | basse / moyenne / haute / urgente |
| **Deadline** | Date | Date limite |
| **ImageURL** | Text | URL d'une image |
| **LienExterne** | Text | URL d'un lien externe |
| **PieceJointe** | Attachments | Fichiers attachés |
| **Tags** | Text | Tags séparés par virgules |
| **Responsable** | Text | Pseudo du responsable assigné |
| **Archive** | Boolean | Carte archivée (true/false) |
| **Historique** | LongText | Historique des modifications |
| **Ordre** | Number | Ordre d'affichage |

## 🚀 Installation & Configuration

### 1. Structure Grist Requise

```
📊 Document Grist
├── Categories (table)
│   ├── id
│   ├── Nom
│   ├── Couleur (text hex)
│   ├── Icone (emoji)
│   └── Ordre
├── Cartes (table)
│   ├── id
│   ├── Titre
│   ├── Contenu
│   ├── Auteur
│   ├── Auteur_Pseudo
│   ├── Session_ID
│   ├── Categorie (Link to Categories)
│   ├── Approuve (checkbox)
│   ├── DateCreation
│   ├── Priorite (select: basse, moyenne, haute, urgente)
│   ├── Deadline (date)
│   ├── ImageURL
│   ├── LienExterne
│   ├── PieceJointe (attachments)
│   ├── Tags (text)
│   ├── Responsable (text)
│   ├── Archive (boolean)
│   ├── Codir (boolean)
│   ├── Historique (longtext)
│   └── Ordre
├── Likes (table)
│   ├── id
│   ├── Carte (Link to Cartes)
│   ├── Pseudo
│   └── DateLike
├── Commentaires (table)
│   ├── id
│   ├── Carte (Link to Cartes)
│   ├── Pseudo
│   ├── Contenu
│   └── DateCommentaire
└── Configuration (table)
    ├── id
    ├── Cle
    ├── Valeur
    └── Valeur_Text
├── Responsables (table, optionnelle)
│   ├── id
│   ├── Nom (text)
│   ├── Email (text)
│   └── Fonction (text)
```

### 2. Déployer le Widget

1. Copiez les fichiers :
   - `index.html`
   - `index.js`

2. Dans Grist, créez un **Custom Widget** :
   - Allez à votre tableau
   - Insérez un widget personnalisé
   - Pointez vers `index.html`

### 3. Configuration Initiale

Dans la table **Configuration**, ajoutez ces lignes (optionnel) :

```
Cle                    | Valeur_Text
wall_emoji             | 📌
wall_title             | Mur Collaboratif
wall_slogan            | Partagez vos idées !
moderation_active      | false (ou true)
```

## 🎮 Guide Utilisateur

### Pour les Utilisateurs Normaux

1. **Ajouter une carte** :
   - Cliquez sur "➕ Nouvelle carte"
   - Remplissez titre, contenu, priorité, deadline
   - Cliquez "Publier"

2. **Modifier une carte** :
   - Cliquez sur la carte
   - Cliquez "✏️ Modifier"
   - Mettez à jour les champs
   - Cliquez "Enregistrer"

3. **Déplacer une carte** :
   - Glissez-déposez entre colonnes
   - OU cliquez sur les flèches ← → rapides
   - La carte se déplace instantanément

4. **Interagir** :
   - ❤️ Likez une carte
   - 💬 Ajoutez un commentaire

5. **Filtrer** :
   - Utilisez la **barre de recherche** pour chercher par titre/contenu/auteur
   - Utilisez les **dropdowns** pour filtrer par auteur, responsable, priorité ou tag

### Pour les Administrateurs

1. **Activer/Désactiver la modération** :
   - Cliquez "🔓 Activer Admin"
   - Cliquez "🔒 Modération ON/OFF"
   - La nouvelle modération prend effet immédiatement

2. **Approuver les cartes** :
   - Les cartes en attente affichent "⏳ En attente"
   - Cliquez "✓ Approuver" pour valider
   - Cliquez "✕ Rejeter" pour supprimer

3. **Gérer les catégories** :
   - Cliquez "⚙️" (gear icon)
   - Ajoutez, modifiez ou supprimez les catégories
   - Choisissez l'emoji et la couleur

## 🎨 Personnalisation

### Changer les Couleurs des Badges

Modifiez dans `index.js` la constante `PRIORITY_LEVELS` :

```javascript
const PRIORITY_LEVELS = {
  'basse': { icon: '⬇️', color: '#10b981', label: 'Basse' },
  'moyenne': { icon: '➡️', color: '#f59e0b', label: 'Moyenne' },
  'haute': { icon: '⬆️', color: '#ef4444', label: 'Haute' },
  'urgente': { icon: '🔴', color: '#dc2626', label: 'Urgente' }
};
```

### Personnaliser les Animations

Les animations sont définies dans la section CSS de `index.html` :
- `badgeSlideIn` : Animation des badges
- `slideUp` : Animation des deadlines
- `urgentePulse` : Pulsation des priorités urgentes
- `cardAppear` : Apparition des cartes

## 🔒 Sécurité & Permissions

- **Grist API Full** : Le widget génère l'ID de session automatiquement
- **Validation côté client** : Les inputs sont échappées en HTML
- **Filtrage côté serveur** : Grist valide toutes les modifications
- **Respect des permissions** : Les utilisateurs ne peuvent que modifier leurs propres cartes

## 🌍 Support Multi-Langue

Le widget est actuellement en **français**. Pour passer en autre langue, modifiez :
- Les labels internes
- Les messages toast
- Les placeholders des formulaires

## 📝 Notes Techniques

### Performance
- **Chargement optimisé** : Données chargées une seule fois au démarrage
- **Mise en cache** : Les images sont cachées localement
- **Rafraîchissement intelligent** : Ne perturbe pas les modales ouvertes
- **Drag & drop efficace** : Utilise les événements natifs

### Compatibilité
- ✅ Chrome/Chromium
- ✅ Firefox
- ✅ Safari
- ✅ Edge
- ✅ Mobile (responsive)

## 🐛 Dépannage

**Les cartes n'apparaissent pas ?**
- Vérifiez que la table "Cartes" existe
- Vérifiez que le lien "Categorie" est correct
- Vérifiez que vous avez des catégories

**La modération ne fonctionne pas ?**
- Activez d'abord le mode admin
- Ensuite activez la modération
- Rechargez la page

**Les images ne s'affichent pas ?**
- Vérifiez que le champ "ImageURL" est rempli
- Ou ajoutez une pièce jointe image au champ "PieceJointe"

## 📞 Support

Pour toute question ou bug report, consultez la documentation Grist :
https://docs.getgrist.com/

---

## 🎬 Inspiration

Ce widget s'inspire du concept de **mur collaboratif** présenté dans cette vidéo pédagogique :
👉 [Découvrir le mur collaboratif Grist](https://podeduc.apps.education.fr/video/132080-grist-mur-collaboratif/)

---

## 👨‍💻 Crédit

**Vibe codé par [Bertrand Kuzbinski](https://github.com/MrKuBe) avec Claude**

**Dernière mise à jour** : Mars 2026  
**Version** : 2.6.20260305 (Envoi & partage de fiches par email + Copier dans le presse-papiers)
