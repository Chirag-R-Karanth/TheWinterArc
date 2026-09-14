package com.winterarc.companion

import android.content.Context
import android.content.SharedPreferences

object Prefs {
    private lateinit var sp: SharedPreferences

    fun init(ctx: Context) {
        sp = ctx.getSharedPreferences("winterarc", Context.MODE_PRIVATE)
    }

    var serverUrl: String
        get() = sp.getString("serverUrl", "http://192.168.1.10:8080") ?: ""
        set(v) = sp.edit().putString("serverUrl", v).apply()

    var apiKey: String
        get() = sp.getString("apiKey", "") ?: ""
        set(v) = sp.edit().putString("apiKey", v).apply()

    // Last successful sync timestamp (epoch millis, UTC). Drives backfill.
    var lastSyncMs: Long
        get() = sp.getLong("lastSyncMs", System.currentTimeMillis() - 24 * 3600_000L)
        set(v) = sp.edit().putLong("lastSyncMs", v).apply()

    var serverLabel: String
        get() = sp.getString("serverLabel", "") ?: ""
        set(v) = sp.edit().putString("serverLabel", v).apply()
}