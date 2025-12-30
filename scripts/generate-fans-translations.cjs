const fs = require("fs");
const path = require("path");

const translations = {
  de: {
    nav: { home: "Startseite", liveNow: "Live", fans: "Fans", themes: "Themen", myFaves: "Meine Favoriten", signIn: "Anmelden", logout: "Abmelden", admin: "Admin" },
    home: { title: "Premium Gay Kreative", subtitle: "Entdecke {{count}}+ handverlesene Darsteller von {{platforms}} Plattformen", liveNow: "Live", themes: "Themen", galleries: "Galerien", watchLive: "Live ansehen", browseAll: "Alle ansehen", viewAll: "Alle ansehen", dragToFave: "Ziehe Darsteller hierher um sie zu favorisieren" },
    faves: { title: "Meine Favoriten", hot: "Hot", notHot: "Nicht", total: "Gesamt bewertet", skip: "Überspringen", nextPerformer: "Nächster Darsteller", undo: "Rückgängig", refresh: "Aktualisierungsrate", classifyTheme: "Welches Thema passt?", typeTheme: "Thema eingeben oder wählen...", suggestedThemes: "Vorgeschlagene Themen", yourThemes: "Deine Themen", allCaughtUp: "Alles erledigt!", noMorePerformers: "Keine weiteren Darsteller", signInRequired: "Anmelden um zu speichern", followers: "Follower" },
    performers: { title: "Alle Darsteller", filters: "Filter", platform: "Plattform", allPlatforms: "Alle Plattformen", sortBy: "Sortieren", popular: "Beliebt", newest: "Neueste", mostFollowers: "Meiste Follower", onlineOnly: "Nur Online", search: "Suchen...", page: "Seite", of: "von", previous: "Zurück", next: "Weiter", loading: "Laden...", live: "LIVE" },
    footer: { ageNotice: "Alle Models 18+. RTA gekennzeichnet.", copyright: "Affiliate Content Aggregator" },
    login: { title: "Anmelden", continueWith: "Weiter mit", orEmail: "Oder mit E-Mail", email: "E-Mail", password: "Passwort", signIn: "Anmelden", register: "Registrieren", noAccount: "Kein Konto?", hasAccount: "Bereits registriert?" },
    seo: { homeTitle: "Premium Gay Cam Models", homeDesc: "Entdecke die heißesten Gay Cam Models.", performersTitle: "Gay Darsteller", performersDesc: "Unsere Auswahl an Gay Darstellern.", favesTitle: "Meine Favoriten", favesDesc: "Deine persönliche Sammlung." }
  },
  fr: {
    nav: { home: "Accueil", liveNow: "En Direct", fans: "Fans", themes: "Thèmes", myFaves: "Mes Favoris", signIn: "Connexion", logout: "Déconnexion", admin: "Admin" },
    home: { title: "Créateurs Gay Premium", subtitle: "Découvrez {{count}}+ modèles de {{platforms}} plateformes", liveNow: "En Direct", themes: "Thèmes", galleries: "Galeries", watchLive: "Regarder en Direct", browseAll: "Voir Tout", viewAll: "Voir Tout", dragToFave: "Glissez ici pour ajouter aux favoris" },
    faves: { title: "Mes Favoris", hot: "Hot", notHot: "Non", total: "Total Évalué", skip: "Passer", nextPerformer: "Modèle suivant", undo: "Annuler", refresh: "Taux de rafraîchissement", classifyTheme: "Quel thème correspond?", typeTheme: "Tapez un thème...", suggestedThemes: "Thèmes suggérés", yourThemes: "Vos thèmes", allCaughtUp: "Tout à jour!", noMorePerformers: "Plus de modèles", signInRequired: "Connectez-vous pour sauvegarder", followers: "abonnés" },
    performers: { title: "Tous les Modèles", filters: "Filtres", platform: "Plateforme", allPlatforms: "Toutes", sortBy: "Trier par", popular: "Populaire", newest: "Récent", mostFollowers: "Plus d abonnés", onlineOnly: "En ligne", search: "Rechercher...", page: "Page", of: "sur", previous: "Précédent", next: "Suivant", loading: "Chargement...", live: "DIRECT" },
    footer: { ageNotice: "Tous les modèles ont 18+. Label RTA.", copyright: "Agrégateur de contenu affilié" },
    login: { title: "Connexion", continueWith: "Continuer avec", orEmail: "Ou par email", email: "Email", password: "Mot de passe", signIn: "Connexion", register: "Inscription", noAccount: "Pas de compte?", hasAccount: "Déjà inscrit?" },
    seo: { homeTitle: "Modèles Cam Gay Premium", homeDesc: "Découvrez les modèles cam gay.", performersTitle: "Modèles Gay", performersDesc: "Notre sélection de modèles gay.", favesTitle: "Mes Favoris", favesDesc: "Votre collection personnelle." }
  },
  pt: {
    nav: { home: "Início", liveNow: "Ao Vivo", fans: "Fãs", themes: "Temas", myFaves: "Meus Favoritos", signIn: "Entrar", logout: "Sair", admin: "Admin" },
    home: { title: "Criadores Gay Premium", subtitle: "Descubra {{count}}+ modelos de {{platforms}} plataformas", liveNow: "Ao Vivo", themes: "Temas", galleries: "Galerias", watchLive: "Assistir Ao Vivo", browseAll: "Ver Todos", viewAll: "Ver Todos", dragToFave: "Arraste modelos aqui para favoritar" },
    faves: { title: "Meus Favoritos", hot: "Hot", notHot: "Não", total: "Total Avaliado", skip: "Pular", nextPerformer: "Próximo modelo", undo: "Desfazer", refresh: "Taxa de atualização", classifyTheme: "Qual tema combina?", typeTheme: "Digite um tema...", suggestedThemes: "Temas sugeridos", yourThemes: "Seus temas", allCaughtUp: "Tudo em dia!", noMorePerformers: "Sem mais modelos", signInRequired: "Entre para salvar", followers: "seguidores" },
    performers: { title: "Todos os Modelos", filters: "Filtros", platform: "Plataforma", allPlatforms: "Todas", sortBy: "Ordenar", popular: "Popular", newest: "Recente", mostFollowers: "Mais Seguidores", onlineOnly: "Online", search: "Buscar...", page: "Página", of: "de", previous: "Anterior", next: "Próximo", loading: "Carregando...", live: "AO VIVO" },
    footer: { ageNotice: "Todos os modelos 18+. Rotulado RTA.", copyright: "Agregador de conteúdo afiliado" },
    login: { title: "Entrar", continueWith: "Continuar com", orEmail: "Ou por email", email: "Email", password: "Senha", signIn: "Entrar", register: "Registrar", noAccount: "Sem conta?", hasAccount: "Já tem conta?" },
    seo: { homeTitle: "Modelos Cam Gay Premium", homeDesc: "Descubra os modelos cam gay mais quentes.", performersTitle: "Modelos Gay", performersDesc: "Nossa seleção de modelos gay.", favesTitle: "Meus Favoritos", favesDesc: "Sua coleção pessoal." }
  },
  it: {
    nav: { home: "Home", liveNow: "In Diretta", fans: "Fan", themes: "Temi", myFaves: "Preferiti", signIn: "Accedi", logout: "Esci", admin: "Admin" },
    home: { title: "Creatori Gay Premium", subtitle: "Scopri {{count}}+ modelli da {{platforms}} piattaforme", liveNow: "In Diretta", themes: "Temi", galleries: "Gallerie", watchLive: "Guarda Live", browseAll: "Vedi Tutti", viewAll: "Vedi Tutti", dragToFave: "Trascina qui per aggiungere ai preferiti" },
    faves: { title: "I Miei Preferiti", hot: "Hot", notHot: "No", total: "Totale Valutati", skip: "Salta", nextPerformer: "Prossimo modello", undo: "Annulla", refresh: "Frequenza aggiornamento", classifyTheme: "Quale tema?", typeTheme: "Scrivi un tema...", suggestedThemes: "Temi suggeriti", yourThemes: "I tuoi temi", allCaughtUp: "Tutto fatto!", noMorePerformers: "Nessun altro modello", signInRequired: "Accedi per salvare", followers: "follower" },
    performers: { title: "Tutti i Modelli", filters: "Filtri", platform: "Piattaforma", allPlatforms: "Tutte", sortBy: "Ordina", popular: "Popolare", newest: "Recente", mostFollowers: "Più Follower", onlineOnly: "Solo Online", search: "Cerca...", page: "Pagina", of: "di", previous: "Precedente", next: "Successivo", loading: "Caricamento...", live: "LIVE" },
    footer: { ageNotice: "Tutti i modelli 18+. Etichetta RTA.", copyright: "Aggregatore contenuti affiliati" },
    login: { title: "Accedi", continueWith: "Continua con", orEmail: "O con email", email: "Email", password: "Password", signIn: "Accedi", register: "Registrati", noAccount: "Non hai un account?", hasAccount: "Hai già un account?" },
    seo: { homeTitle: "Modelli Cam Gay Premium", homeDesc: "Scopri i modelli cam gay più hot.", performersTitle: "Modelli Gay", performersDesc: "La nostra selezione di modelli gay.", favesTitle: "I Miei Preferiti", favesDesc: "La tua collezione personale." }
  }
};

// Add remaining languages with English as base (for now)
const en = JSON.parse(fs.readFileSync(path.join(__dirname, "../src-creatives/i18n/locales/en.json")));
const langs = ["nl","pl","ru","ja","ko","zh","ar","tr","th","vi","id","hu","cs","el"];
langs.forEach(lang => {
  if (!translations[lang]) translations[lang] = en;
});

// Write all files
Object.entries(translations).forEach(([lang, data]) => {
  fs.writeFileSync(
    path.join(__dirname, `../src-creatives/i18n/locales/${lang}.json`),
    JSON.stringify(data, null, 2)
  );
  console.log(`Created ${lang}.json`);
});
console.log("Done!");
