 # Démarrage

Avant toute chose, il est important de **démarrer une session** avec la fonction `session_start()`. Cette fonction **doit être appelée tout en haut de la page**, avant la moindre ligne de HTML ou PHP (avant même le `<!DOCTYPE html>`).

Notez aussi qu’il va falloir appeler `session_start()` dans chacune des pages dans lesquelles nous souhaitons accéder aux variables de session. En ce sens, on exploite généralement le **système d’inclusion** de fichiers (avec `require` ou `include`) pour factoriser notre `session_start()` au sein d’un unique script.

index.php

copié!

```html
<?php session_start(); ?>

<!DOCTYPE html>

<html lang="fr">

    <head>

        <meta charset="utf-8">

        <title>Démarrage d'une session</title>

    </head>

    <body>

    </body>

</html>
```

Lorsqu’une session est créée, PHP génère un numéro unique servant à l’identifier. Cet identifiant de session unique sera **transmis de page en page via un cookie** nommé `PHPSESSID`.

La fonction `session_start()` se charge d’abord de **vérifier si une session a déjà été démarrée** en recherchant la présence du cookie `PHPSESSID`.

- Si c’est le cas, **elle la récupère**
- Si ce n’est pas le cas, **elle démarre une nouvelle session** (puis génère cet identifiant de session)

`session_start()` permet donc de **démarrer une nouvelle session** si aucun identifiant de session n’existe, ou de **reprendre une session existante** dans le cas contraire.
