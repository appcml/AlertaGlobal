package com.alertaglobal

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.webkit.*
import android.widget.FrameLayout
import android.widget.LinearLayout
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.alertaglobal.service.AlertMonitorService
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.AdSize
import com.google.android.gms.ads.AdView

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var adView: AdView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Layout vertical: WebView arriba, AdMob abajo
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }

        webView = WebView(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f
            )
        }

        val adContainer = FrameLayout(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }

        layout.addView(webView)
        layout.addView(adContainer)
        setContentView(layout)

        // Solicitar permisos
        requestPermissions()

        // Configurar WebView
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            setGeolocationEnabled(true)
            allowFileAccess = true
            allowContentAccess = true
            // Permite mixed content para APIs HTTP
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            // Cache para modo offline
            cacheMode = WebSettings.LOAD_DEFAULT
            databaseEnabled = true
            // User Agent personalizado para identificar APK
            userAgentString = "$userAgentString AlertaGlobal-APK/2.0"
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                // Abrir links externos en browser
                val url = request?.url?.toString() ?: return false
                if (url.startsWith("file://") || url.contains("appcml.github.io")) return false
                // URLs externas → abrir en browser
                val intent = android.content.Intent(android.content.Intent.ACTION_VIEW,
                    android.net.Uri.parse(url))
                startActivity(intent)
                return true
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            // Geolocalización: auto-permitir (el APK ya tiene el permiso)
            override fun onGeolocationPermissionsShowPrompt(
                origin: String,
                callback: GeolocationPermissions.Callback
            ) {
                callback.invoke(origin, true, false)
            }

            // Consola JavaScript visible en LogCat
            override fun onConsoleMessage(msg: ConsoleMessage?): Boolean {
                android.util.Log.d("AlertaGlobal-JS",
                    "[${msg?.sourceId()}:${msg?.lineNumber()}] ${msg?.message()}")
                return true
            }
        }

        // Cargar la app web desde assets
        webView.loadUrl("file:///android_asset/www/index.html")

        // AdMob Banner
        adView = AdView(this).apply {
            adUnitId = "ca-app-pub-3940256099942544/6300978111" // Test ID
            setAdSize(AdSize.BANNER)
        }
        adContainer.addView(adView)
        adView.loadAd(AdRequest.Builder().build())

        // Iniciar servicio de monitoreo en background
        AlertMonitorService.start(this)
    }

    private fun requestPermissions() {
        val perms = mutableListOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            perms.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        val missing = perms.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, missing.toTypedArray(), 1001)
        }
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack()
        else super.onBackPressed()
    }

    override fun onResume() {
        super.onResume()
        adView.resume()
        webView.onResume()
    }

    override fun onPause() {
        adView.pause()
        webView.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        adView.destroy()
        webView.destroy()
        super.onDestroy()
    }
}
