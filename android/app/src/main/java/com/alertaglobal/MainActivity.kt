package com.alertaglobal

import android.Manifest
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.webkit.*
import android.widget.FrameLayout
import android.widget.LinearLayout
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.alertaglobal.service.AlertMonitorService
import com.google.android.gms.ads.*
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var adView: AdView
    private var interstitialAd: InterstitialAd? = null
    private var tabChangeCount = 0
    private var locationManager: LocationManager? = null

    companion object {
        const val ADMOB_BANNER_ID       = "ca-app-pub-6387207876125603/4351581614"
        const val ADMOB_INTERSTITIAL_ID = "ca-app-pub-6387207876125603/2283977006"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        MobileAds.initialize(this) {}

        val layout = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        webView = WebView(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f)
        }
        val adContainer = FrameLayout(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT)
        }
        layout.addView(webView)
        layout.addView(adContainer)
        setContentView(layout)

        requestPermissions()
        setupWebView()

        adView = AdView(this).apply { adUnitId = ADMOB_BANNER_ID; setAdSize(AdSize.BANNER) }
        adContainer.addView(adView)
        adView.loadAd(AdRequest.Builder().build())
        loadInterstitial()

        // Puente JS → Android
        webView.addJavascriptInterface(object {

            // Cambio de tab → intersticial
            @android.webkit.JavascriptInterface
            fun onTabChange(tabName: String) {
                tabChangeCount++
                if (tabChangeCount % 6 == 0 && tabName != "sos" && tabName != "alertas") {
                    runOnUiThread { showInterstitial() }
                }
            }

            // Copiar al portapapeles (clipboard nativo Android)
            @android.webkit.JavascriptInterface
            fun copyToClipboard(text: String) {
                runOnUiThread {
                    val clipboard = getSystemService(CLIPBOARD_SERVICE) as android.content.ClipboardManager
                    clipboard.setPrimaryClip(android.content.ClipData.newPlainText("AlertaGlobal", text))
                }
            }

            // Obtener GPS preciso directamente desde Android
            @android.webkit.JavascriptInterface
            fun requestNativeGPS() {
                runOnUiThread { startNativeGPS() }
            }

        }, "AndroidBridge")

        AlertMonitorService.start(this)
    }

    // ── GPS nativo Android — mucho más preciso que WebView geolocation ──
    private fun startNativeGPS() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED) return

        locationManager = getSystemService(LOCATION_SERVICE) as LocationManager

        val listener = object : LocationListener {
            override fun onLocationChanged(loc: Location) {
                // Enviar coordenadas precisas al WebView via JavaScript
                val js = "window.receiveNativeGPS(${loc.latitude}, ${loc.longitude}, ${loc.accuracy});"
                webView.post { webView.evaluateJavascript(js, null) }
                // Una vez obtenida buena precisión, detener
                if (loc.accuracy < 50f) {
                    locationManager?.removeUpdates(this)
                }
            }
            override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
            override fun onProviderEnabled(provider: String) {}
            override fun onProviderDisabled(provider: String) {}
        }

        // Intentar GPS primero, luego red
        try {
            if (locationManager?.isProviderEnabled(LocationManager.GPS_PROVIDER) == true) {
                locationManager?.requestLocationUpdates(
                    LocationManager.GPS_PROVIDER, 5000L, 10f, listener)
                // También última ubicación conocida inmediatamente
                locationManager?.getLastKnownLocation(LocationManager.GPS_PROVIDER)?.let { loc ->
                    val js = "window.receiveNativeGPS(${loc.latitude}, ${loc.longitude}, ${loc.accuracy});"
                    webView.post { webView.evaluateJavascript(js, null) }
                }
            }
            if (locationManager?.isProviderEnabled(LocationManager.NETWORK_PROVIDER) == true) {
                locationManager?.requestLocationUpdates(
                    LocationManager.NETWORK_PROVIDER, 5000L, 10f, listener)
            }
        } catch (e: Exception) {
            android.util.Log.e("AlertaGlobal", "GPS error: ${e.message}")
        }
    }

    private fun setupWebView() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            setGeolocationEnabled(true)
            allowFileAccess = true
            allowContentAccess = true
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            cacheMode = WebSettings.LOAD_DEFAULT
            databaseEnabled = true
            userAgentString = "$userAgentString AlertaGlobal-APK/2.0"
        }

        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                // Iniciar GPS nativo cuando la página cargue
                startNativeGPS()
                // Inyectar función receptora de GPS en el JS
                val injectJS = """
                    window.receiveNativeGPS = function(lat, lon, acc) {
                        console.log('📱 GPS Nativo Android: ' + lat + ', ' + lon + ' ±' + Math.round(acc) + 'm');
                        if (typeof applyDeviceLocation === 'function') {
                            applyDeviceLocation(lat, lon, acc, 'GPS Nativo ±' + Math.round(acc) + 'm');
                        } else if (typeof applyIfBetter === 'function') {
                            applyIfBetter(lat, lon, acc, 'GPS Nativo');
                        }
                        if (typeof window.updateSWLocation === 'function') {
                            window.updateSWLocation(lat, lon, null, null);
                        }
                    };
                    // Sobrescribir clipboard para APK
                    window._nativeCopy = function(text) {
                        if (window.AndroidBridge && window.AndroidBridge.copyToClipboard) {
                            window.AndroidBridge.copyToClipboard(text);
                            return true;
                        }
                        return false;
                    };
                """.trimIndent()
                view?.evaluateJavascript(injectJS, null)
            }

            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false
                if (url.startsWith("tel:")) {
                    startActivity(android.content.Intent(android.content.Intent.ACTION_DIAL,
                        android.net.Uri.parse(url)))
                    return true
                }
                if (url.startsWith("file://") || url.contains("appcml.github.io")) return false
                startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW,
                    android.net.Uri.parse(url)))
                return true
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onGeolocationPermissionsShowPrompt(origin: String,
                callback: GeolocationPermissions.Callback) {
                callback.invoke(origin, true, false)
            }
            override fun onConsoleMessage(msg: ConsoleMessage?): Boolean {
                android.util.Log.d("AlertaGlobal-JS",
                    "[${msg?.lineNumber()}] ${msg?.message()}")
                return true
            }
            override fun onPermissionRequest(request: android.webkit.PermissionRequest?) {
                request?.grant(request.resources)
            }
            // Alert nativo más amigable
            override fun onJsAlert(view: WebView?, url: String?, message: String?,
                result: JsResult?): Boolean {
                android.app.AlertDialog.Builder(this@MainActivity)
                    .setMessage(message)
                    .setPositiveButton("Aceptar") { _, _ -> result?.confirm() }
                    .setCancelable(false)
                    .show()
                return true
            }
            override fun onJsConfirm(view: WebView?, url: String?, message: String?,
                result: JsResult?): Boolean {
                android.app.AlertDialog.Builder(this@MainActivity)
                    .setMessage(message)
                    .setPositiveButton("Aceptar") { _, _ -> result?.confirm() }
                    .setNegativeButton("Cancelar") { _, _ -> result?.cancel() }
                    .show()
                return true
            }
        }

        webView.loadUrl("file:///android_asset/www/index.html")
    }

    private fun loadInterstitial() {
        InterstitialAd.load(this, ADMOB_INTERSTITIAL_ID, AdRequest.Builder().build(),
            object : InterstitialAdLoadCallback() {
                override fun onAdLoaded(ad: InterstitialAd) { interstitialAd = ad }
                override fun onAdFailedToLoad(error: LoadAdError) { interstitialAd = null }
            })
    }

    private fun showInterstitial() {
        interstitialAd?.let { ad ->
            ad.fullScreenContentCallback = object : com.google.android.gms.ads.FullScreenContentCallback() {
                override fun onAdDismissedFullScreenContent() {
                    interstitialAd = null
                    loadInterstitial()
                }
            }
            ad.show(this)
        }
    }

    private fun requestPermissions() {
        val perms = mutableListOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION,
            Manifest.permission.CAMERA
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
            perms.add(Manifest.permission.POST_NOTIFICATIONS)
        val missing = perms.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isNotEmpty())
            ActivityCompat.requestPermissions(this, missing.toTypedArray(), 1001)
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    override fun onResume()  { super.onResume();  adView.resume();  webView.onResume() }
    override fun onPause()   { adView.pause();    webView.onPause(); super.onPause() }
    override fun onDestroy() {
        locationManager?.removeUpdates({})
        adView.destroy()
        webView.destroy()
        super.onDestroy()
    }
}
