package com.winterarc.companion

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

/**
 * Local queue of normalized metrics waiting for the backend to ack them.
 * Nothing is dropped until the server confirms (ingested or duplicate).
 */
class QueueStore(ctx: Context) : SQLiteOpenHelper(ctx, "pending.db", null, 1) {

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE pending (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                source     TEXT NOT NULL,
                source_key TEXT NOT NULL,
                metric_type TEXT NOT NULL,
                value      REAL,
                unit       TEXT NOT NULL DEFAULT '',
                ts_start   INTEGER NOT NULL,
                ts_end     INTEGER NOT NULL,
                created_at INTEGER NOT NULL
            )
            """.trimIndent()
        )
    }

    override fun onUpgrade(db: SQLiteDatabase, old: Int, new: Int) {}

    data class Pending(
        val id: Long,
        val source: String,
        val sourceKey: String,
        val metricType: String,
        val value: Double?,
        val unit: String,
        val tsStart: Long,
        val tsEnd: Long,
    )

    fun insert(item: Pending): Long {
        val db = writableDatabase
        val values = android.content.ContentValues().apply {
            put("source", item.source)
            put("source_key", item.sourceKey)
            put("metric_type", item.metricType)
            put("value", item.value)
            put("unit", item.unit)
            put("ts_start", item.tsStart)
            put("ts_end", item.tsEnd)
            put("created_at", System.currentTimeMillis())
        }
        return db.insert("pending", null, values)
    }

    fun all(): List<Pending> {
        val out = mutableListOf<Pending>()
        readableDatabase.query(
            "pending", null, null, null, null, null, "ts_start ASC"
        ).use { c ->
            while (c.moveToNext()) {
                out += fromCursor(c)
            }
        }
        return out
    }

    fun count(): Int = all().size

    fun clear(ids: Collection<Long>) {
        if (ids.isEmpty()) return
        val db = writableDatabase
        val placeholders = ids.joinToString(",") { "?" }
        db.execSQL("DELETE FROM pending WHERE id IN ($placeholders)", ids.toTypedArray())
    }

    private fun fromCursor(c: android.database.Cursor): Pending {
        val vi = c.getColumnIndexOrThrow("value")
        return Pending(
            id = c.getLong(c.getColumnIndexOrThrow("id")),
            source = c.getString(c.getColumnIndexOrThrow("source")),
            sourceKey = c.getString(c.getColumnIndexOrThrow("source_key")),
            metricType = c.getString(c.getColumnIndexOrThrow("metric_type")),
            value = if (c.isNull(vi)) null else c.getDouble(vi),
            unit = c.getString(c.getColumnIndexOrThrow("unit")),
            tsStart = c.getLong(c.getColumnIndexOrThrow("ts_start")),
            tsEnd = c.getLong(c.getColumnIndexOrThrow("ts_end")),
        )
    }
}