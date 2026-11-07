package com.winterarc.companion

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.TimeUnit

/**
 * Posts normalized metrics to the Go backend over Tailscale. Long-lived API
 * key auth via the X-API-Key header. HTTP 200 (ingested or duplicate) counts
 * as an acknowledgement; anything else triggers an automatic retry next pass.
 */
object ApiClient {

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    /** @return true when the server acknowledged the record. */
    fun postMetric(item: QueueStore.Pending): Boolean {
        val url = Prefs.serverUrl.trimEnd('/')
        if (url.isEmpty() || Prefs.apiKey.isEmpty()) return false

        val body = JSONObject().apply {
            put("source", item.source)
            put("sourceKey", item.sourceKey)
            put("metricType", item.metricType)
            if (item.value != null) put("value", item.value)
            put("unit", item.unit)
            put("start", isoUtc(item.tsStart))
            put("end", isoUtc(item.tsEnd))
        }
        val request = Request.Builder()
            .url("$url/api/v1/metrics")
            .header("X-API-Key", Prefs.apiKey)
            .header("Content-Type", "application/json")
            .post(body.toString().toRequestBody(JSON))
            .build()

        return try {
            client.newCall(request).execute().use { resp -> resp.code == 200 }
        } catch (e: Exception) {
            false
        }
    }

    private val JSON = "application/json; charset=utf-8".toMediaType()

    private fun isoUtc(epochMs: Long): String =
        SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
            .apply { timeZone = TimeZone.getTimeZone("UTC") }
            .format(Date(epochMs))
}