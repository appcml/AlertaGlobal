# 🌍 Alerta Global

Alertas de desastres naturales y clima en tiempo real.

## 🌐 Ver en la web (GitHub Pages)
Se publica automáticamente en cada push:
```
https://TU-USUARIO.github.io/AlertaGlobal/
```

## 📦 Generar APK firmado
1. Ve a **Actions → Build Signed APK → Run workflow**
2. Ingresa la versión → el APK se descarga desde artifacts

### Secrets necesarios (Settings → Secrets → Actions):
| Secret | Valor |
|--------|-------|
| KEYSTORE_BASE64 | `base64 mis-juegos.keystore` |
| STORE_PASSWORD | cicgames2024 |
| KEY_ALIAS | cic |
| KEY_PASSWORD | cicgames2024 |

## ⚙️ Configurar
- **API clima**: en `js/app.js` cambia `TU_API_KEY` (gratis en openweathermap.org)
- **AdMob**: en `android/app/src/main/AndroidManifest.xml` cambia el App ID

## 📁 Estructura
```
AlertaGlobal/
├── index.html          ← Web app (GitHub Pages)
├── css/styles.css
├── js/app.js
├── img/icon.svg
├── manifest.json
├── android/            ← Proyecto Android completo
│   ├── app/
│   │   ├── build.gradle.kts
│   │   ├── src/main/
│   │   │   ├── AndroidManifest.xml
│   │   │   ├── java/com/alertaglobal/
│   │   │   │   ├── AlertaGlobalApp.kt
│   │   │   │   ├── MainActivity.kt
│   │   │   │   ├── service/AlertMonitorService.kt
│   │   │   │   ├── receiver/BootReceiver.kt
│   │   │   │   ├── model/Models.kt
│   │   │   │   └── data/api/
│   │   │   ├── res/ (layouts, drawables, values)
│   │   │   └── assets/www/ (web se copia aquí al compilar)
│   ├── build.gradle.kts
│   ├── settings.gradle.kts
│   └── gradle/
└── .github/workflows/
    ├── pages.yml       ← Publica web automático
    └── build-apk.yml   ← Genera APK (manual)
```
