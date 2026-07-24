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
import com.google.android.gms.ads.*
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var adView: AdView
    private var interstitialAd: InterstitialAd? = null
    private var tabChangeCount = 0

    companion object {
        const val ADMOB_BANNER_ID       = "ca-app-pub-6387207876125603/4351581614"
        const val ADMOB_INTERSTITIAL_ID = "ca-app-pub-6387207876125603/2283977006"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Inicializar AdMob SDK
        MobileAds.initialize(this) {}

        // Layout: WebView arriba, Banner abajo
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

        requestPermissions()
        setupWebView()

        // Banner AdMob
        adView = AdView(this).apply { adUnitId = ADMOB_BANNER_ID; setAdSize(AdSize.BANNER) }
        adContainer.addView(adView)
        adView.loadAd(AdRequest.Builder().build())

        // Precargar intersticial
        loadInterstitial()

        // Puente JS → Android para detectar cambio de tab y mostrar intersticial
        webView.addJavascriptInterface(object {
            @android.webkit.JavascriptInterface
            fun onTabChange(tabName: String) {
                tabChangeCount++
                // Mostrar intersticial cada 6 cambios de tab (no en Kit SOS ni Alertas)
                if (tabChangeCount % 6 == 0 && tabName != "sos" && tabName != "alertas") {
                    runOnUiThread { showInterstitial() }
                }
            }
        }, "AndroidBridge")

        AlertMonitorService.start(this)
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
                    "[${msg?.sourceId()}:${msg?.lineNumber()}] ${msg?.message()}")
                return true
            }
            override fun onPermissionRequest(request: android.webkit.PermissionRequest?) {
                request?.grant(request.resources)
            }
        }

        webView.loadUrl("file:///android_asset/www/index.html")
    }

    private fun loadInterstitial() {
        InterstitialAd.load(this, ADMOB_INTERSTITIAL_ID, AdRequest.Builder().build(),
            object : InterstitialAdLoadCallback() {
                override fun onAdLoaded(ad: InterstitialAd) {
                    interstitialAd = ad
                }
                override fun onAdFailedToLoad(error: LoadAdError) {
                    interstitialAd = null
                }
            })
    }

    private fun showInterstitial() {
        interstitialAd?.let { ad ->
            ad.fullScreenContentCallback = object : com.google.android.gms.ads.FullScreenContentCallback() {
                override fun onAdDismissedFullScreenContent() {
                    interstitialAd = null
                    loadInterstitial() // precargar el siguiente
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
    override fun onDestroy() { adView.destroy();  webView.destroy(); super.onDestroy() }
}
