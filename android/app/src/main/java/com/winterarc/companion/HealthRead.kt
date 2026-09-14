package com.winterarc.companion

import android.content.Context
import android.util.Log
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.aggregate.Aggregate
import androidx.health.connect.client.aggregate.AggregateRequest
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateRequest.Companion.between
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import java.time.Instant

/**
 * Reads continuous biometrics from Health Connect: steps, heart rate, sleep.
 * The desktop backend is offline-tolerant: if the server was unreachable for a
 * while, [fromMs] backs up to the last successful sync so nothing is missed.
 */
object HealthRead {

    private const val TAG = "HealthRead"

    val permissionSet = setOf(
        androidx.health.connect.client.permission.health.PermissionId(StepsRecord::class),
        androidx.health.connect.client.permission.health.PermissionId(HeartRateRecord::class),
        androidx.health.connect.client.permission.health.PermissionId(SleepSessionRecord::class),
    )

    fun sdkStatus(ctx: Context): Int =
        HealthConnectClient.getSdkStatus(ctx, "com.google.android.apps.healthdata")

    fun permissionRequest(): androidx.activity.result.ActivityResultContract<Set<String>, Set<String>> =
        PermissionController.createRequestPermissionResultContract()

    suspend fun read(ctx: Context, fromMs: Long, toMs: Long): List<QueueStore.Pending> {
        val client = HealthConnectClient.getOrCreate(ctx)
        val out = mutableListOf<QueueStore.Pending>()
        val from = Instant.ofEpochMilli(fromMs)
        val to = Instant.ofEpochMilli(toMs)

        // Steps: single aggregated total for the window (keeps payloads small).
        val agg = client.aggregate(
            AggregateRequest.between(
                metrics = setOf(Aggregate.STEPS_TOTAL),
                recordTypes = setOf(StepsRecord::class),
                timeRangeFilter = TimeRangeFilter.between(from, to),
            )
        )
        agg[Aggregate.STEPS_TOTAL]?.let { total ->
            out += QueueStore.Pending(
                id = 0,
                source = "healthconnect",
                sourceKey = "hc_steps_${from.toEpochMilli()}_${to.toEpochMilli()}",
                metricType = "steps",
                value = total.toDouble(), // Long count
                unit = "steps",
                tsStart = fromMs,
                tsEnd = toMs,
            )
        }

        val hr = client.readRecords(
            ReadRecordsRequest(
                recordType = HeartRateRecord::class,
                timeRangeFilter = TimeRangeFilter.between(from, to),
            )
        )
        for (rec in hr.records) {
            val bpm = rec.samples.map { it.beatsPerMinute.toDouble() }.average().takeIf { v -> v.isFinite() }
            out += QueueStore.Pending(
                id = 0,
                source = "healthconnect",
                sourceKey = "hc_hr_${rec.metadata.id}",
                metricType = "heart_rate",
                value = bpm,
                unit = "bpm",
                tsStart = rec.startTime.toEpochMilli(),
                tsEnd = rec.endTime.toEpochMilli(),
            )
        }

        val sleep = client.readRecords(
            ReadRecordsRequest(
                recordType = SleepSessionRecord::class,
                timeRangeFilter = TimeRangeFilter.between(from, to),
            )
        )
        for (rec in sleep.records) {
            val totalSeconds = rec.stages.sumOf { it.duration.toMillis() }.toDouble() / 1000.0
            out += QueueStore.Pending(
                id = 0,
                source = "healthconnect",
                sourceKey = "hc_sleep_${rec.metadata.id}",
                metricType = "sleep",
                value = totalSeconds / 3600.0,
                unit = "h",
                tsStart = rec.startTime.toEpochMilli(),
                tsEnd = rec.endTime.toEpochMilli(),
            )
        }

        Log.i(TAG, "read ${out.size} normalized records from ${Instant.ofEpochMilli(fromMs)}")
        return out
    }
}