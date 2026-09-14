package com.winterarc.companion

import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : AppCompatActivity() {

    private lateinit var statusText: TextView
    private lateinit var queue: QueueStore

    private val permissionLauncher = registerForActivityResult(
        HealthRead.permissionRequest()
    ) { granted ->
        statusText.text = if (granted.size == HealthRead.permissionSet.size)
            "Health Connect access granted."
        else "Health Connect access incomplete: ${granted.size}/${HealthRead.permissionSet.size}"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        queue = QueueStore(this)
        statusText = findViewById(R.id.statusText)
        val serverUrl = findViewById<EditText>(R.id.serverUrl)
        val apiKey = findViewById<EditText>(R.id.apiKey)
        findViewById<Button>(R.id.saveBtn).setOnClickListener {
            Prefs.serverUrl = serverUrl.text.toString().trim()
            Prefs.apiKey = apiKey.text.toString().trim()
            refresh()
            SyncWorker.runNow(this)
        }
        findViewById<Button>(R.id.permissionBtn).setOnClickListener {
            when (HealthRead.sdkStatus(this)) {
                2 -> permissionLauncher.launch(HealthRead.permissionSet)
                else -> statusText.text =
                    "Health Connect not installed on this device. Install " +
                    "com.google.android.apps.healthdata."
            }
        }
        refresh()
    }

    private fun refresh() {
        serverUrlPref()
        apiKeyPref()
        val last = Prefs.lastSyncMs
        val fmt = SimpleDateFormat("MMM d, HH:mm", Locale.getDefault())
        statusText.text = buildString {
            append("Server: ").append(Prefs.serverUrl.ifEmpty { "(unset)" }).append('\n')
            append("Queued: ").append(queue.count()).append(" records\n")
            append("Last sync: ").append(fmt.format(Date(last)))
        }
    }

    private fun serverUrlPref() {
        (findViewById<EditText>(R.id.serverUrl)).setText(Prefs.serverUrl)
    }

    private fun apiKeyPref() {
        (findViewById<EditText>(R.id.apiKey)).setText(Prefs.apiKey)
    }

    override fun onResume() {
        super.onResume()
        refresh()
    }
}