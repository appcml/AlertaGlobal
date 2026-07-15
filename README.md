# 🌍 Alerta Global

App de alertas de desastres naturales y clima en tiempo real.

## Configuración antes de compilar

### 1. Copia tu keystore
Copia tu archivo `mis-juegos.keystore` dentro de la carpeta `app/`.

La firma ya está configurada en `app/build.gradle.kts` con:
- Alias: `cic`
- Contraseña: `cicgames2024`

### 2. Configura tu AdMob App ID
En `app/src/main/AndroidManifest.xml`, reemplaza:
```
ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX
```
con tu ID real de AdMob.

En `MainActivity.kt`, reemplaza el ID del banner de prueba por el tuyo.

### 3. Configura tu API Key de OpenWeatherMap
En `WeatherFragment.kt`, reemplaza `"TU_API_KEY"` con tu API Key.
Obtén una gratis en: https://openweathermap.org/api

## Compilar y firmar

### Opción A: Android Studio
1. Abre el proyecto en Android Studio
2. Build → Generate Signed Bundle / APK
3. Selecciona APK → tu keystore → release → Finish

### Opción B: Línea de comandos
```bash
./gradlew assembleRelease
```

El APK firmado quedará en:
```
app/build/outputs/apk/release/app-release.apk
```

## Funcionalidades
- Alertas de sismos en tiempo real (USGS)
- Clima actual con geolocalización
- Mapa interactivo de alertas sísmicas
- Recomendaciones según clima y emergencias
- Notificaciones push de alertas críticas
- Monetización con AdMob
- Soporte multi-país
