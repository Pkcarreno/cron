package cron.foregroundservice

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class CronActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        val action = intent?.getStringExtra(CronForegroundService.EXTRA_ACTION) ?: return
        CronForegroundModule.notifyAction(action)
    }
}
