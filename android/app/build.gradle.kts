plugins {
    id("com.android.application")
}

android {
    namespace = "atclaude.android"
    compileSdk = 35

    defaultConfig {
        applicationId = "fr.arcanetable.app"
        minSdk = 26
        targetSdk = 35
        versionCode = (project.findProperty("versionCode") as String?)?.toInt() ?: 1
        versionName = (project.findProperty("versionName") as String?) ?: "0.2.0"
    }

    signingConfigs {
        // Clé de test versionnée : chaque APK a la même signature, on peut donc installer
        // une nouvelle version par-dessus l'ancienne sans perdre ses decks.
        create("shared") {
            storeFile = file("arcane-debug.keystore")
            storePassword = "android"
            keyAlias = "arcane"
            keyPassword = "android"
        }
    }

    buildTypes {
        getByName("debug") {
            signingConfig = signingConfigs.getByName("shared")
        }
        getByName("release") {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("shared")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    androidResources {
        // res.zip est lu directement depuis l'APK : inutile de le recompresser.
        noCompress += "zip"
    }

    packaging {
        resources {
            merges += "META-INF/services/**"
            excludes += listOf(
                "META-INF/*.md", "META-INF/LICENSE*", "META-INF/NOTICE*", "META-INF/DEPENDENCIES",
                "META-INF/INDEX.LIST", "META-INF/*.SF", "META-INF/*.DSA", "META-INF/*.RSA",
                "META-INF/versions/**", "META-INF/maven/**", "module-info.class",
                "META-INF/io.netty.versions.properties", "META-INF/*.kotlin_module",
                "**/*.dylib", "**/*.dll", "**/*.so", "**/*.jnilib",
            )
            pickFirsts += listOf("**/*.properties", "**/*.txt", "**/*.xml", "**/*.json")
        }
    }

    lint {
        abortOnError = false
        checkReleaseBuilds = false
    }
}

dependencies {
    implementation("atclaude:bridge:0.1.0")
}
