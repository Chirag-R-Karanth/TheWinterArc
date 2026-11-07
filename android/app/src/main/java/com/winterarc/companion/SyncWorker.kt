package com.winterarc.companion

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

/**
 * Hourly job: read Health Connect → queue locally → POST to backend over
 * Tailscale. Queued items are only cleared after the server acknowledges; the
 * work will simply fail/reschedule if the desktop was off.
 */
class SyncWorker(
    ctx: Context,
    params: WorkerParameters,
) : CoroutineWorker(ctx, params) {

    override suspend fun doWork(): Result {
        val queue = QueueStore(applicationContext)

        // Health Connect is the on-device source of truth for continuous
        // biometrics. Backfill starts from the last successful sync so nothing
        // is lost when the desktop was unreachable.
        val fromMs = Prefs.lastSyncMs
        val now = System.currentTimeMillis()

        if (HealthRead.sdkStatus(applicationContext) != HealthConnectClient.SDK_AVAILABLE) {
            return Result.retry()
        }

        val records = HealthRead.read(applicationContext, fromMs, now)
        for (r in records) queue.insert(r)

        val acked = mutableListOf<Long>()
        var anyFail = false
        for (item in queue.all()) {
            if (ApiClient.postMetric(item)) {
                acked += item.id
            } else {
                anyFail = true
            }
        }
        if (acked.isNotEmpty()) {
            queue.clear(acked)
            Prefs.lastSyncMs = now
        }
        return if (anyFail) Result.retry() else Result.success()
    }

    companion object {
        private const val unique = "winterarc-sync"

        fun schedule(ctx: Context) {
            val request = PeriodicWorkRequestBuilder<SyncWorker>(1, TimeUnit.HOURS)
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build()
                )
                .build()
            WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(
                unique, ExistingPeriodicWorkPolicy.KEEP, request,
            )
        }

        fun runNow(ctx: Context) {
            WorkManager.getInstance(ctx)
                .enqueueUniqueWork(unique + "-now", ExistingWorkPolicy.KEEP,
                    OneTimeWorkRequestBuilder<SyncWorker>().build())
        }
    }
}