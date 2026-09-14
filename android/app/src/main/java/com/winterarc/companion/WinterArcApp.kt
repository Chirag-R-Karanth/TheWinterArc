package com.winterarc.companion

import android.app.Application

class WinterArcApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Prefs.init(this)
        SyncScheduler.schedule(this)
    }
}