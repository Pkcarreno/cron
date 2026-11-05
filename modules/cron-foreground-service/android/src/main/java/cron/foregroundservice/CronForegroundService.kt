package cron.foregroundservice

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat


class CronForegroundService : Service() {
    companion object {
        const val CHANNEL_ID = "cron_workout_channel"
        const val CHANNEL_NAME = "Active Workout"
        const val NOTIFICATION_ID = 42001

        const val ACTION_START = "cron.foregroundservice.START"
        const val ACTION_UPDATE = "cron.foregroundservice.UPDATE"
        const val ACTION_STOP = "cron.foregroundservice.STOP"
        const val ACTION_NOTIFICATION_ACTION = "cron.foregroundservice.NOTIFICATION_ACTION"

        const val EXTRA_HEADLINE = "headline"
        const val EXTRA_SUBTITLE = "subtitle"
        const val EXTRA_TARGET_TIMESTAMP_MS = "targetTimestampMs"
        const val EXTRA_IS_PAUSED = "isPaused"
        const val EXTRA_IS_COUNT_DOWN = "isCountDown"
        const val EXTRA_COLOR = "color"
        const val EXTRA_SECONDARY_LABEL = "secondaryLabel"
        const val EXTRA_ACTION = "action"

        var isRunning: Boolean = false
            private set
    }

    private var currentHeadline: String = "Workout Active"
    private var currentSubtitle: String = ""
    private var currentTargetTimestampMs: Long = 0L
    private var currentIsPaused: Boolean = false
    private var currentIsCountDown: Boolean = true
    private var currentColorHex: String = "#008153"
    private var currentSecondaryLabel: String? = null
    private var wakeLock: PowerManager.WakeLock? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        isRunning = true
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent == null) {
            return START_NOT_STICKY
        }

        when (intent.action) {
            ACTION_STOP -> {
                stopForegroundNotification()
                return START_NOT_STICKY
            }
            ACTION_START, ACTION_UPDATE -> {
                acquireWakeLock()
                extractPayload(intent)
                try {
                    val notification = buildNotification()

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                            startForeground(
                                NOTIFICATION_ID,
                                notification,
                                ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH
                            )
                        } else {
                            startForeground(NOTIFICATION_ID, notification)
                        }
                    } else {
                        startForeground(NOTIFICATION_ID, notification)
                    }

                    if (intent.action == ACTION_UPDATE) {
                        NotificationManagerCompat.from(this).notify(NOTIFICATION_ID, notification)
                    }
                } catch (e: SecurityException) {
                    Log.e("CronForegroundService", "SecurityException in startForeground: ${e.message}", e)
                } catch (e: Exception) {
                    Log.e("CronForegroundService", "Exception in startForeground: ${e.message}", e)
                }
            }
        }

        return START_NOT_STICKY
    }

    private fun acquireWakeLock() {
        if (wakeLock == null) {
            try {
                val powerManager = getSystemService(Context.POWER_SERVICE) as? PowerManager
                wakeLock = powerManager?.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK,
                    "cron:foreground_service_wakelock"
                )?.apply {
                    setReferenceCounted(false)
                    acquire()
                }
            } catch (e: Exception) {
                Log.e("CronForegroundService", "Error acquiring wakelock: ${e.message}", e)
            }
        }
    }

    private fun releaseWakeLock() {
        try {
            if (wakeLock?.isHeld == true) {
                wakeLock?.release()
            }
        } catch (e: Exception) {
            Log.e("CronForegroundService", "Error releasing wakelock: ${e.message}", e)
        } finally {
            wakeLock = null
        }
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        stopForegroundNotification()
    }

    override fun onDestroy() {
        isRunning = false
        releaseWakeLock()
        CronForegroundModule.clearMilestones()
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
        manager?.cancel(NOTIFICATION_ID)
        super.onDestroy()
    }

    private fun extractPayload(intent: Intent) {
        intent.getStringExtra(EXTRA_HEADLINE)?.let { currentHeadline = it }
        intent.getStringExtra(EXTRA_SUBTITLE)?.let { currentSubtitle = it }
        intent.getStringExtra(EXTRA_COLOR)?.let { currentColorHex = it }
        currentSecondaryLabel = intent.getStringExtra(EXTRA_SECONDARY_LABEL)
        if (intent.hasExtra(EXTRA_IS_PAUSED)) {
            currentIsPaused = intent.getBooleanExtra(EXTRA_IS_PAUSED, false)
            if (currentIsPaused) {
                CronForegroundModule.clearMilestones()
            }
        }
        if (intent.hasExtra(EXTRA_IS_COUNT_DOWN)) {
            currentIsCountDown = intent.getBooleanExtra(EXTRA_IS_COUNT_DOWN, true)
        }
        if (intent.hasExtra(EXTRA_TARGET_TIMESTAMP_MS)) {
            currentTargetTimestampMs = intent.getLongExtra(EXTRA_TARGET_TIMESTAMP_MS, 0L)
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows live workout countdown and controls"
                setShowBadge(false)
                setSound(null, null)
                enableVibration(false)
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): android.app.Notification {
        val parsedColor = try {
            Color.parseColor(currentColorHex)
        } catch (_: Exception) {
            Color.parseColor("#008153")
        }

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(currentHeadline)
            .setContentText(currentSubtitle)
            .setSmallIcon(getSmallIconResId())
            .setColor(parsedColor)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_WORKOUT)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setStyle(NotificationCompat.BigTextStyle().bigText(currentSubtitle))

        // Launch app on notification body tap
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        if (launchIntent != null) {
            val pendingIntent = PendingIntent.getActivity(
                this,
                0,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            builder.setContentIntent(pendingIntent)
        }

        // Hardware chronometer
        if (currentIsPaused || currentTargetTimestampMs <= 0L) {
            builder.setUsesChronometer(false)
            builder.setShowWhen(false)
        } else {
            builder.setWhen(currentTargetTimestampMs)
            builder.setShowWhen(true)
            builder.setUsesChronometer(true)
            builder.setChronometerCountDown(currentIsCountDown)
        }

        // Request Live Update promotion (Android 16+ Promoted Ongoing / Status Bar Chip)
        // 1. EXTRA_REQUEST_PROMOTED_ONGOING ("android.requestPromotedOngoing") for Android 16 (API 36+)
        builder.extras.putBoolean("android.requestPromotedOngoing", true)

        // 2. Also invoke setRequestPromotedOngoing via reflection if available on newer AndroidX or platform builder
        try {
            val method = builder.javaClass.getMethod("setRequestPromotedOngoing", Boolean::class.javaPrimitiveType)
            method.invoke(builder, true)
        } catch (_: Exception) {
            // Fallback handled by extras bundle above
        }

        // Primary Action: Pause / Resume
        val primaryActionIntent = Intent(this, CronActionReceiver::class.java).apply {
            action = ACTION_NOTIFICATION_ACTION
            putExtra(EXTRA_ACTION, if (currentIsPaused) "resume" else "pause")
        }
        val primaryPendingIntent = PendingIntent.getBroadcast(
            this,
            1,
            primaryActionIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        builder.addAction(0, if (currentIsPaused) "Resume" else "Pause", primaryPendingIntent)

        // Secondary Action: Lap / Record Round (AMRAP & Stopwatch)
        val secondary = currentSecondaryLabel
        if (!secondary.isNullOrBlank()) {
            val secondaryActionIntent = Intent(this, CronActionReceiver::class.java).apply {
                action = ACTION_NOTIFICATION_ACTION
                putExtra(EXTRA_ACTION, "checkpoint")
            }
            val secondaryPendingIntent = PendingIntent.getBroadcast(
                this,
                2,
                secondaryActionIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            builder.addAction(0, secondary, secondaryPendingIntent)
        }

        return builder.build()
    }

    private fun getSmallIconResId(): Int {
        val customIcon = resources.getIdentifier("notification_icon", "drawable", packageName)
        if (customIcon != 0) return customIcon
        val customIcon2 = resources.getIdentifier("ic_notification", "drawable", packageName)
        if (customIcon2 != 0) return customIcon2
        return android.R.drawable.ic_media_play
    }

    private fun stopForegroundNotification() {
        isRunning = false
        releaseWakeLock()
        CronForegroundModule.clearMilestones()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
        stopSelf()
    }
}
