pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositories {
        // Le pont et les modules Forge sont installés dans le dépôt Maven local
        // par scripts/build-forge.sh puis « mvn install » à la racine du projet.
        mavenLocal()
        google()
        mavenCentral()
    }
}

rootProject.name = "ArcaneTable"
include(":app")
