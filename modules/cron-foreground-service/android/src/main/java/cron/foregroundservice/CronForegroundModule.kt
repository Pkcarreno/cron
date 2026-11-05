package cron.foregroundservice

import android.content.Intent
import android.util.Log
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class CronForegroundModule : Module() {
    companion object {
        private var instance: CronForegroundModule? = null

        fun notifyAction(action: String) {
            instance?.sendEvent("onNotificationAction", mapOf("action" to action))
        }
    }

    override fun definition() = ModuleDefinition {
        Name("CronForegroundService")

        Events("onNotificationAction")

        OnCreate {
            instance = this@CronForegroundModule
        }

        OnDestroy {
            if (instance === this@CronForegroundModule) {
                instance = null
            }
        }

        AsyncFunction("start") { payload: Map<String, Any?> ->
            val context = appContext.reactContext ?: return@AsyncFunction false
            val intent = Intent(context, CronForegroundService::class.java).apply {
                action = CronForegroundService.ACTION_START
                putPayload(this, payload)
            }
            try {
                ContextCompat.startForegroundService(context, intent)
                true
            } catch (e: Exception) {
                Log.e("CronForegroundModule", "Failed to start foreground service: ${e.message}", e)
                false
            }
        }

        AsyncFunction("update") { payload: Map<String, Any?> ->
            val context = appContext.reactContext ?: return@AsyncFunction false
            val intent = Intent(context, CronForegroundService::class.java).apply {
                action = CronForegroundService.ACTION_UPDATE
                putPayload(this, payload)
            }
            try {
                ContextCompat.startForegroundService(context, intent)
                true
            } catch (e: Exception) {
                Log.e("CronForegroundModule", "Failed to update foreground service: ${e.message}", e)
                false
            }
        }

        AsyncFunction("stop") {
            val context = appContext.reactContext ?: return@AsyncFunction false
            val intent = Intent(context, CronForegroundService::class.java).apply {
                action = CronForegroundService.ACTION_STOP
            }
            try {
                context.stopService(intent)
                true
            } catch (e: Exception) {
                Log.e("CronForegroundModule", "Failed to stop foreground service: ${e.message}", e)
                false
            }
        }

        AsyncFunction("isServiceRunning") {
            CronForegroundService.isRunning
        }
    }

    private fun putPayload(intent: Intent, payload: Map<String, Any?>) {
        (payload["headline"] as? String)?.let { intent.putExtra(CronForegroundService.EXTRA_HEADLINE, it) }
        (payload["subtitle"] as? String)?.let { intent.putExtra(CronForegroundService.EXTRA_SUBTITLE, it) }
        (payload["color"] as? String)?.let { intent.putExtra(CronForegroundService.EXTRA_COLOR, it) }
        (payload["secondaryLabel"] as? String)?.let { intent.putExtra(CronForegroundService.EXTRA_SECONDARY_LABEL, it) }
        (payload["isPaused"] as? Boolean)?.let { intent.putExtra(CronForegroundService.EXTRA_IS_PAUSED, it) }

        val targetTimestamp = (payload["targetTimestampMs"] as? Number)?.toLong()
        if (targetTimestamp != null) {
            intent.putExtra(CronForegroundService.EXTRA_TARGET_TIMESTAMP_MS, targetTimestamp)
        }
    }
}
