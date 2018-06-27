// Paramètres
var colonnesCSV = ["titreCours", "inscription", "progression", "moyenneDeClasse", "duree", "difficulte", "nbChapitres", "ratioQuizEvaluation", "nbEvaluations", "derniereMiseAJour", "idCours"], // Nom des colonnes dans le CSV à créer
    tempsEntreRequetes = 1000; // en ms

// Variables relatives au DOM :
var colonnesADetecter = {
        titreCours: "Cours",
        inscription: "Inscription",
        progression: "Progression",
        score: "Score"
    }, // Doivent correspondre aux colonnes du tableau des cours visible sur la page dashboard
    idTableau = 'list-course-followed', // identifiant DOM du tableau des cours
    selecteurCssColonnesTableau = 'thead>tr>th', // selecteur css pour acceder aux colonnes du tableau
    selecteurCssListeCours = 'tbody>tr', // selecteur css pour acceder a la liste des cours
    selecteurCssLignesTableau = 'td', // sélecteur css pour accéder à chaque ligne du tableau
    selecteurCssInfoHeader = ".course-header__detailsGroup--info >> li", // sélecteur css pour accéder à la durée et à la diffulté, contenues dans le header de la page d'accueil d'un cours donné
    selecteurCssMiseAJour = ".course-header__updatedTime";

var titresColonnes = [], // contiendra le titre des colonnes du tableau des cours tel qu'affiche sur le site
    cptCours = 0, // compte les cours dont les informations ont été extraites
    data = []; // contiendra les données extraites puis ajoutées au csv

var tableau = $('#' + idTableau),
    colonnesDuTableau = tableau.find(selecteurCssColonnesTableau),
    listeDeCours = tableau.find(selecteurCssListeCours);

// extrait les noms des colonnes du tableau des cours
function extraireTitresColonnes(index, colonne) {
    titreColonne = $(colonne).text().trim()
    titresColonnes.push(titreColonne)
}

// contrôle que toutes les colonnes requises ont ete trouvées dans la page
function controlerColonnes() {
    for (c in colonnesADetecter) {
        if (titresColonnes.indexOf(colonnesADetecter[c]) == -1) {
            throw Error("La colonne '" + colonnesADetecter[c] + "' n'a pas été trouvée dans la page html");
        }
    }
}

function detecterCellules(ligne) {
    return ($(ligne).find(selecteurCssLignesTableau));
}

function extraireTitreUrl(cellule) {
    titreCours = $(cellule).text().trim().split(' ').join('_').replace(',', '_'); // on remplace la virgule en anticipation de la ofmration du fichier CSV
    urlDuCours = $(cellule).find('a').first().attr('href');
    urlDuCours = urlDuCours.replace("next-page-to-do", "");
    return ([titreCours, urlDuCours])
}

function extraireInscription(cellule) {
    var dateInscription = $(cellule).text().trim();
    parties = dateInscription.split("/");
    dateInscription = new Date(parties[2], parties[1] - 1, parties[0]);
    var diff = new Date() - dateInscription;
    return (Math.round(diff / (1000 * 60 * 60 * 24)));
}

function extraireProgression(cellule, ignorerCours) {
    progression = $(cellule).text().trim();
    var pourcentage = progression.match(/[0-9]{1,3} ?%/);
    if (pourcentage === null) {
        ignorerCours = true
    } else {
        pourcentage = pourcentage[0].match(/[0-9]{1,3}/)[0];
        progression = 1 * pourcentage // convertion de string vers integer
    }
    return ([progression, ignorerCours])
}

function extraireMoyenneClasse(cellule) {
    var score = $(cellule).text().trim();
    var pourcentage = score.match(/la\sclasse\s[0-9]{1,3}\s?%/);

    if (pourcentage === null) {
        moyenneClasse = null;
    } else {
        pourcentage = pourcentage[0].match(/[0-9]{1,3}/);
        moyenneClasse = 1 * pourcentage // convertion de string vers integer
    }
    return (moyenneClasse)
}

function extraireIdCours(urlDuCours) {
    return (urlDuCours.match(/courses\/(\d{2,10})/i)[1] * 1);
}

function extraireMain(result) {
    return (result.match(/<main[\s\S]*?<\/main>/i)[0])
}

function extraireNav(htmlMain) {
    var nav = htmlMain.match(/<section[\s\S]*?\/section>[\s\S]*?<nav[\s\S]*?\/nav>/i)[0];
    return (nav.match(/<nav[\s\S]*?\/nav>/i)[0]);
}

function extraireHeader(htmlMain) {
    return (htmlMain.match(/<header[\s\S]*?<\/header>/i)[0]);
}

function extraireInfoHeader(htmlHeader) {
    return ($(htmlHeader).find(selecteurCssInfoHeader));
}

function extraireDureeDifficulte(htmlHeader) {
    var duree, difficulte;
    var informations = extraireInfoHeader(htmlHeader);

    informations.each(function(index, element) {
        var texte = $(element).text().trim();
        // Detection éventuelle de la duree
        reg = texte.match(/[0-9]{1,10} *[Hh]eure/i);

        if (reg !== null) {
            // cas où une durée a été trouvée
            duree = 1 * texte.match(/[0-9]{1,10}/i);
        } else {
            // si element ne contient pas la durée, c'est qu'elle contient la difficulté
            if (texte == "Difficile") difficulte = 3;
            if (texte == "Moyenne") difficulte = 2;
            if (texte == "Facile") difficulte = 1;
        }
    });
    return ([duree, difficulte]);
}

function extraireMiseAJour(htmlHeader) {
    var miseAJour = $(htmlHeader).find(selecteurCssMiseAJour).first().text().trim();
    miseAJour = miseAJour.match(/[0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4}/i)[0];
    parties = miseAJour.split("/");
    miseAJour = new Date(parties[2], parties[1] - 1, parties[0]);
    var diff = new Date() - miseAJour;
    return (Math.round(diff / (1000 * 60 * 60 * 24)));
}

// Les liens peuvent être des liens vers des chapitres, quiz, activités, ou autres.
function determinerTypeDeLien(chapitre) {
    var url = $(chapitre).attr("href");

    if (url === undefined) {
        return ("autre4")
    };

    if (url.indexOf("/courses/") == -1) {
        return ("autre1")
    };

    if (url.indexOf("/certificate_example") != -1) {
        return ("autre2")
    };
    if (url.indexOf("/course-certificates/") != -1) {
        return ("autre3")
    };

    if (url.indexOf("/exercises/") != -1) {
        var titre = $(chapitre).text().trim();
        if (titre.match(/^Quiz/i) !== null) {
            return ("quiz")
        };
        if (titre.match(/^Acti/i) !== null) {
            return ("activite")
        };
    }

    return ("chapitre");
}

function compterChapitres(htmlNav) {

    var nbChapitres = 0,
        nbQuiz = 0,
        nbActivites = 0;

    var liens = $(htmlNav).find("a"); // On détecte tous les liens contenus à l'intérieur de la balise NAV

    liens.each(function(index, lien) {
        var typeDeLien = determinerTypeDeLien(lien);

        if (typeDeLien == "quiz") {
            nbQuiz = nbQuiz + 1
        }
        if (typeDeLien == "activite") {
            nbActivites = nbActivites + 1
        }
        if (typeDeLien == "chapitre") {
            nbChapitres = nbChapitres + 1
        }
    });

    return ([nbChapitres, nbQuiz, nbActivites])
}

function ajouterDonnees(titreCours, inscription, progression, moyenneClasse, duree,
    difficulte, nbChapitres, nbQuiz, nbActivites, miseAJour, idCours) {

    var dataLigne = [];
    var dataLigneTemp = [titreCours, inscription, progression, moyenneClasse, duree,
        difficulte, nbChapitres, nbQuiz / (nbActivites + nbQuiz), nbActivites + nbQuiz, miseAJour, idCours
    ];

    for (i in dataLigneTemp) {
        var element = dataLigneTemp[i];
        if (element + "" == "NaN") {
            dataLigne.push(undefined);
        } else {
            dataLigne.push(element);
        }
    }

    data.push(dataLigne);

    cptCours = cptCours + 1;

    if (listeDeCours.length == cptCours) {
        afficherResultat()
    }
}

function extraireInfoPageCours(result, urlDuCours, titreCours, inscription, progression, moyenneClasse) {
    var duree, difficulte, miseAJour, nbQuiz, nbActivites, nbChapitres;

    // extraction du contenu de la balise html MAIN
    var htmlMain = extraireMain(result);
    // extraction du contenu de la balise html NAV
    var htmlNav = extraireNav(htmlMain);
    // extraction du contenu de la balise html HEADER
    var htmlHeader = extraireHeader(htmlMain)

    // extrction de l'identifiant du cours
    var idCours = extraireIdCours(urlDuCours);

    // extraction de la durée et de la difficulté, contenues dans le header de la page
    [duree, difficulte] = extraireDureeDifficulte(htmlHeader);

    // extraction de la duree depuis la derniere mise à jour
    miseAJour = extraireMiseAJour(htmlHeader);

    //extraction du nombre de chapitres
    [nbChapitres, nbQuiz, nbActivites] = compterChapitres(htmlNav);

    ajouterDonnees(titreCours, inscription, progression, moyenneClasse, duree,
        difficulte, nbChapitres, nbQuiz, nbActivites, miseAJour, idCours);
};

function afficherInfo(titreCours) {
    console.log("Récupération des informations sur le cours '" + titreCours + "'");
}

function extraireInfosCours() {

    listeDeCours.each(function(index, ligne) {

        var cellules; // vontiendra les cellules qui conposent la ligne
        var urlDuCours, titreCours, inscription, progression, moyenneClasse;

        cellules = detecterCellules(ligne);

        var ignorerCours = false;

        cellules.each(
            // extrait les infos d'une ligne du tableau, qui sont les caractéristiques du cours correspondant à la ligne en question 
            function(index, cellule) {

                var titreColonne = titresColonnes[index];

                // Detection du titre et de l'url du cours
                if (titreColonne == colonnesADetecter['titreCours']) {
                    [titreCours, urlDuCours] = extraireTitreUrl(cellule);
                }

                // Detection du nombre de jours depuis inscription
                if (titreColonne == colonnesADetecter['inscription']) {
                    inscription = extraireInscription(cellule);
                }

                // Detection du pourcentage de progression
                if (titreColonne == colonnesADetecter['progression']) {
                    // Si la progression est de 0%, alors on ignore le cours : la variable ignorerCours est alors à true. Autrement, elle reste inchangée.
                    [progression, ignorerCours] = extraireProgression(cellule, ignorerCours);
                }

                // Detection de la moyenne de classe
                if (titreColonne == colonnesADetecter['score']) {
                    moyenneClasse = extraireMoyenneClasse(cellule);
                }
            }
        );

        // Compte le nombre de cours traités pour savoir quand générer le fichier CSV (à la fin du traitement)
        if (ignorerCours == true) {
            cptCours = cptCours + 1;
        } else {
            // A intervalle de temps régulier, on va chercher plus d'infos sur les cours en allant directement sur la première page de chaque cours.
            setTimeout(function() {
                    $.ajax({
                        url: urlDuCours,
                        beforeSend: function() {
                            afficherInfo(titreCours)
                        },
                        success: function(result) {
                            extraireInfoPageCours(result, urlDuCours, titreCours, inscription, progression, moyenneClasse)
                        },
                        error: function(a, b, err) {
                            cptCours = cptCours + 1;
                            console.log("\n\nERREUR dans la récupération du cours '" + titreCours + "' : " + err)
                        }
                    })
                },
                index * tempsEntreRequetes
            );
        }
    });
}

function genererCsv(data) {
    var CHARACTERE_VIRGULE = '%2C',
        CHARACTERE_SAUT_DE_LIGNE = '%0A';

    var csvBrut = [colonnesCSV.join(CHARACTERE_VIRGULE)];
    for (ligne in data) {
        csvBrut.push(data[ligne].join(CHARACTERE_VIRGULE));
    }
    csvBrut = csvBrut.join(CHARACTERE_SAUT_DE_LIGNE);
    return (csvBrut)
}

function afficherResultat() {
    csvBrut = genererCsv(data)
    $('html').html('Téléchargez les données ici :<br><a download="my_courses.csv" href="data:application/csv;charset=utf-8,' + csvBrut + '">my_courses.csv</a>');
}

colonnesDuTableau.each(extraireTitresColonnes); // Detecte le nom des colonnes du tableau des cours tel qu'affiché sur le site
controlerColonnes();
extraireInfosCours(); // Extrait les informations sur les cours
