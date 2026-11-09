package cron.foregroundservice

import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.Looper
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

        fun notifyMilestone(type: String, secondRemaining: Int) {
            instance?.sendEvent(
                "onMilestone",
                mapOf(
                    "type" to type,
                    "secondRemaining" to secondRemaining
                )
            )
        }

        fun clearMilestones() {
            instance?.clearScheduledMilestones()
        }
    }

    private val handler = Handler(Looper.getMainLooper())
    private val scheduledRunnables = mutableListOf<Runnable>()

    internal fun clearScheduledMilestones() {
        synchronized(scheduledRunnables) {
            for (runnable in scheduledRunnables) {
                handler.removeCallbacks(runnable)
            }
            scheduledRunnables.clear()
        }
    }

    override fun definition() = ModuleDefinition {
        Name("CronForegroundService")

        Events("onNotificationAction", "onMilestone")

        OnCreate {
            instance = this@CronForegroundModule
        }

        OnDestroy {
            clearScheduledMilestones()
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
            clearScheduledMilestones()
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

        AsyncFunction("hasNotificationPermission") {
            val context = appContext.reactContext ?: return@AsyncFunction false
            androidx.core.app.NotificationManagerCompat.from(context).areNotificationsEnabled()
        }

        AsyncFunction("hasNotificationChronometerSupport") {
            // Android NotificationCompat supports hardware chronometers on all supported OS versions (API 26+)
            true
        }

        AsyncFunction("areLiveUpdatesSupported") {
            if (Build.VERSION.SDK_INT < 36) {
                return@AsyncFunction false
            }
            val context = appContext.reactContext ?: return@AsyncFunction false
            val notificationManager = androidx.core.app.NotificationManagerCompat.from(context)
            if (!notificationManager.areNotificationsEnabled()) {
                return@AsyncFunction false
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channel = notificationManager.getNotificationChannel(CronForegroundService.CHANNEL_ID)
                if (channel != null && channel.importance == android.app.NotificationManager.IMPORTANCE_NONE) {
                    return@AsyncFunction false
                }
            }
            true
        }

        AsyncFunction("scheduleMilestones") { payload: Map<String, Any?> ->
            clearScheduledMilestones()

            val warmupDelayMs = (payload["warmupDelayMs"] as? Number)?.toLong()
            val transitionDelayMs = (payload["transitionDelayMs"] as? Number)?.toLong()
            @Suppress("UNCHECKED_CAST")
            val beeps = payload["countdownBeeps"] as? List<Map<String, Any?>>

            synchronized(scheduledRunnables) {
                if (warmupDelayMs != null && warmupDelayMs > 0) {
                    val runnable = Runnable {
                        notifyMilestone("warmup", 0)
                    }
                    scheduledRunnables.add(runnable)
                    handler.postDelayed(runnable, warmupDelayMs)
                }

                if (beeps != null) {
                    for (beep in beeps) {
                        val delayMs = (beep["delayMs"] as? Number)?.toLong() ?: continue
                        val second = (beep["secondRemaining"] as? Number)?.toInt() ?: continue
                        val runnable = Runnable {
                            notifyMilestone("beep", second)
                        }
                        scheduledRunnables.add(runnable)
                        handler.postDelayed(runnable, delayMs)
                    }
                }

                if (transitionDelayMs != null && transitionDelayMs >= 0) {
                    val runnable = Runnable {
                        notifyMilestone("transition", 0)
                    }
                    scheduledRunnables.add(runnable)
                    handler.postDelayed(runnable, transitionDelayMs)
                }
            }
            true
        }

        AsyncFunction("clearMilestones") {
            clearScheduledMilestones()
            true
        }
    }

    private fun putPayload(intent: Intent, payload: Map<String, Any?>) {
        (payload["headline"] as? String)?.let { intent.putExtra(CronForegroundService.EXTRA_HEADLINE, it) }
        (payload["subtitle"] as? String)?.let { intent.putExtra(CronForegroundService.EXTRA_SUBTITLE, it) }
        (payload["subText"] as? String)?.let { intent.putExtra(CronForegroundService.EXTRA_SUB_TEXT, it) }
        (payload["color"] as? String)?.let { intent.putExtra(CronForegroundService.EXTRA_COLOR, it) }
        if (payload.containsKey("secondaryLabel")) {
            intent.putExtra(CronForegroundService.EXTRA_SECONDARY_LABEL, payload["secondaryLabel"] as? String)
        }
        (payload["isPaused"] as? Boolean)?.let { intent.putExtra(CronForegroundService.EXTRA_IS_PAUSED, it) }
        (payload["isCountDown"] as? Boolean)?.let { intent.putExtra(CronForegroundService.EXTRA_IS_COUNT_DOWN, it) }
        (payload["supportsLiveUpdates"] as? Boolean)?.let { intent.putExtra(CronForegroundService.EXTRA_SUPPORTS_LIVE_UPDATES, it) }
        (payload["useChronometer"] as? Boolean)?.let { intent.putExtra(CronForegroundService.EXTRA_USE_CHRONOMETER, it) }

        val targetTimestamp = (payload["targetTimestampMs"] as? Number)?.toLong()
        if (targetTimestamp != null) {
            intent.putExtra(CronForegroundService.EXTRA_TARGET_TIMESTAMP_MS, targetTimestamp)
        }
    }
}
