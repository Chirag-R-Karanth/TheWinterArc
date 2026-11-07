package com.winterarc.companion

import android.content.Context

object SyncScheduler {
    fun schedule(ctx: Context) {
        SyncWorker.schedule(ctx)
    }
}