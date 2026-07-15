package com.alertaglobal.data.api

import com.alertaglobal.model.UsgsResponse
import com.alertaglobal.model.WeatherResponse
import retrofit2.http.GET
import retrofit2.http.Query

interface UsgsApiService {
    @GET("fdsnws/event/1/query?format=geojson&starttime=2024-01-01&minmagnitude=4.5")
    suspend fun getRecentEarthquakes(): UsgsResponse

    @GET("fdsnws/event/1/query?format=geojson")
    suspend fun getEarthquakesByParams(
        @Query("starttime") startTime: String,
        @Query("endtime") endTime: String,
        @Query("minmagnitude") minMagnitude: Double,
        @Query("latitude") lat: Double?,
        @Query("longitude") lon: Double?,
        @Query("maxradiuskm") radius: Int?
    ): UsgsResponse
}

interface WeatherApiService {
    @GET("data/2.5/weather")
    suspend fun getCurrentWeather(
        @Query("lat") lat: Double,
        @Query("lon") lon: Double,
        @Query("appid") apiKey: String,
        @Query("units") units: String = "metric",
        @Query("lang") lang: String = "es"
    ): WeatherResponse
}
