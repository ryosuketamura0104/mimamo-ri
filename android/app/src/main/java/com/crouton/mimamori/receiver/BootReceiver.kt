package com.crouton.mimamori.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.crouton.mimamori.work.scheduleUsageSyncWorker

/**
 * 端末再起動後に定期ワーカーを再スケジュールする。
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            scheduleUsageSyncWorker(context)
        }
    }
}
