package com.winterarc.companion

import android.content.Context
import android.util.Log
import androidx.activity.result.contract.ActivityResultContract
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
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

    val permissionSet: Set<String> = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(HeartRateRecord::class),
        HealthPermission.getReadPermission(SleepSessionRecord::class),
    )

    fun sdkStatus(ctx: Context): Int = HealthConnectClient.sdkStatus(ctx)

    fun permissionRequest(): ActivityResultContract<Set<String>, Set<String>> =
        PermissionController.createRequestPermissionResultContract()

    suspend fun read(ctx: Context, fromMs: Long, toMs: Long): List<QueueStore.Pending> {
        val client = HealthConnectClient.getOrCreate(ctx)
        val out = mutableListOf<QueueStore.Pending>()
        val from = Instant.ofEpochMilli(fromMs)
        val to = Instant.ofEpochMilli(toMs)
        val window = TimeRangeFilter.between(from, to)

        // Steps: raw records summed in-app (1.0.0-alpha11 ships no aggregate/metric constants).
        val steps = client.readRecords(
            ReadRecordsRequest(recordType = StepsRecord::class, timeRangeFilter = window)
        )
        val total = steps.records.sumOf { it.count }
        if (total > 0) {
            out += QueueStore.Pending(
                id = 0,
                source = "healthconnect",
                sourceKey = "hc_steps_${fromMs}_${toMs}",
                metricType = "steps",
                value = total.toDouble(),
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
            val hours = (rec.endTime.toEpochMilli() - rec.startTime.toEpochMilli()) / 3600_000.0
            out += QueueStore.Pending(
                id = 0,
                source = "healthconnect",
                sourceKey = "hc_sleep_${rec.metadata.id}",
                metricType = "sleep",
                value = hours,
                unit = "h",
                tsStart = rec.startTime.toEpochMilli(),
                tsEnd = rec.endTime.toEpochMilli(),
            )
        }

        Log.i(TAG, "read ${out.size} normalized records from ${Instant.ofEpochMilli(fromMs)}")
        return out
    }
}