package com.alertaglobal.data.api
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
object RetrofitClient {
    private val client = OkHttpClient.Builder().addInterceptor(HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BODY }).build()
    val usgsApi: UsgsApiService by lazy { Retrofit.Builder().baseUrl("https://earthquake.usgs.gov/").client(client).addConverterFactory(GsonConverterFactory.create()).build().create(UsgsApiService::class.java) }
    val weatherApi: WeatherApiService by lazy { Retrofit.Builder().baseUrl("https://api.openweathermap.org/").client(client).addConverterFactory(GsonConverterFactory.create()).build().create(WeatherApiService::class.java) }
}
