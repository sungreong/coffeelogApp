package com.srlee.coffeelog.widgets

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.RemoteViews
import com.srlee.coffeelog.MainActivity
import com.srlee.coffeelog.R

enum class CoffeeWidgetKind {
  QUICK,
  INVENTORY,
  BREW
}

object CoffeeWidgetRenderer {
  private const val PREFS_NAME = "CoffeeLogWidgetPrefs"
  private const val SNAPSHOT_KEY = "snapshot"

  fun saveSnapshot(context: Context, payload: String) {
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putString(SNAPSHOT_KEY, payload)
      .apply()
  }

  fun updateAll(context: Context) {
    val manager = AppWidgetManager.getInstance(context)
    listOf(
      CoffeeQuickActionsWidget::class.java,
      CoffeeInventoryWidget::class.java,
      CoffeeBrewWidget::class.java
    ).forEach { provider ->
      val ids = manager.getAppWidgetIds(ComponentName(context, provider))
      ids.forEach { id -> update(context, manager, id, kindForProvider(provider)) }
    }
  }

  fun update(context: Context, manager: AppWidgetManager, widgetId: Int, kind: CoffeeWidgetKind) {
    val data = readData(context)
    val views = when (kind) {
      CoffeeWidgetKind.QUICK -> quickViews(context, data, manager.getAppWidgetOptions(widgetId))
      CoffeeWidgetKind.INVENTORY -> inventoryViews(context, data, manager.getAppWidgetOptions(widgetId))
      CoffeeWidgetKind.BREW -> brewViews(context, data, manager.getAppWidgetOptions(widgetId))
    }
    manager.updateAppWidget(widgetId, views)
  }

  private fun readData(context: Context): CoffeeWidgetData {
    val raw = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getString(SNAPSHOT_KEY, null)
    return CoffeeWidgetData.fromJson(raw)
  }

  private fun kindForProvider(provider: Class<*>) = when (provider) {
    CoffeeInventoryWidget::class.java -> CoffeeWidgetKind.INVENTORY
    CoffeeBrewWidget::class.java -> CoffeeWidgetKind.BREW
    else -> CoffeeWidgetKind.QUICK
  }

  private fun quickViews(context: Context, data: CoffeeWidgetData, options: Bundle): RemoteViews {
    val wide = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0) >= 220
    return if (wide) {
      RemoteViews(context.packageName, R.layout.widget_quick_actions).apply {
        setTextViewText(R.id.widget_title, "CoffeeLog")
        setTextViewText(R.id.widget_subtitle, summaryText(data))
        setOnClickPendingIntent(R.id.widget_root, openIntent(context, "coffeelog://beans"))
        setOnClickPendingIntent(R.id.action_product, openIntent(context, "coffeelog://beans?action=newProduct"))
        setOnClickPendingIntent(R.id.action_lot, openIntent(context, "coffeelog://beans?action=newLot"))
        setOnClickPendingIntent(R.id.action_brew, openIntent(context, "coffeelog://log?action=newBrew"))
      }
    } else {
      RemoteViews(context.packageName, R.layout.widget_quick_brew).apply {
        val beanName = data.activeBean?.name ?: "원두 등록 필요"
        setTextViewText(R.id.widget_title, beanName)
        setTextViewText(R.id.widget_subtitle, data.activeBean?.roastery?.ifBlank { "빠른 추출 기록" } ?: "빠른 추출 기록")
        setOnClickPendingIntent(R.id.widget_root, openIntent(context, "coffeelog://log?action=newBrew"))
        setOnClickPendingIntent(R.id.action_primary, openIntent(context, "coffeelog://log?action=newBrew"))
      }
    }
  }

  private fun inventoryViews(context: Context, data: CoffeeWidgetData, options: Bundle): RemoteViews {
    val wide = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0) >= 220
    val bean = data.activeBean
    return if (wide) {
      RemoteViews(context.packageName, R.layout.widget_dashboard).apply {
        setTextViewText(R.id.widget_title, bean?.name ?: "원두를 등록해보세요")
        setTextViewText(R.id.widget_subtitle, bean?.roastery?.ifBlank { bean.status } ?: summaryText(data))
        setTextViewText(R.id.metric_one, "상태 ${bean?.status ?: "-"}")
        setTextViewText(R.id.metric_two, bean?.freshness ?: "로스팅일 미입력")
        setTextViewText(R.id.metric_three, "남은 양 ${bean?.remaining ?: "-"}")
        setTextViewText(R.id.recent_line, data.recentBrew?.let { "최근 ${it.drinkType} · ${it.brewSeconds} · ${it.rating}" } ?: "최근 추출 기록 없음")
        setOnClickPendingIntent(R.id.widget_root, openIntent(context, "coffeelog://beans"))
        setOnClickPendingIntent(R.id.action_product, openIntent(context, "coffeelog://beans?action=newProduct"))
        setOnClickPendingIntent(R.id.action_lot, openIntent(context, "coffeelog://beans?action=newLot"))
        setOnClickPendingIntent(R.id.action_brew, openIntent(context, "coffeelog://log?action=newBrew"))
      }
    } else {
      RemoteViews(context.packageName, R.layout.widget_inventory).apply {
        setTextViewText(R.id.widget_title, bean?.name ?: "원두 없음")
        setTextViewText(R.id.widget_subtitle, bean?.roastery?.ifBlank { bean.status } ?: "원두를 먼저 등록하세요")
        setTextViewText(R.id.metric_one, bean?.freshness ?: "로스팅일 미입력")
        setTextViewText(R.id.metric_two, "남은 양 ${bean?.remaining ?: "-"}")
        setTextViewText(R.id.metric_three, "예상 ${bean?.estimatedCups ?: "-"}")
        setOnClickPendingIntent(R.id.widget_root, openIntent(context, "coffeelog://beans"))
      }
    }
  }

  private fun brewViews(context: Context, data: CoffeeWidgetData, options: Bundle): RemoteViews {
    val tall = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0) >= 220
    return if (tall) {
      RemoteViews(context.packageName, R.layout.widget_brew_history).apply {
        val bean = data.activeBean
        setTextViewText(R.id.widget_title, bean?.name ?: "추출 기록")
        setTextViewText(R.id.widget_subtitle, bean?.let { "${it.status} · ${it.remaining} · ${it.logCount}회" } ?: "아직 기록 없음")
        setHistoryLine(this, R.id.history_one, data.recentBrews.getOrNull(0))
        setHistoryLine(this, R.id.history_two, data.recentBrews.getOrNull(1))
        setHistoryLine(this, R.id.history_three, data.recentBrews.getOrNull(2))
        setOnClickPendingIntent(R.id.widget_root, openIntent(context, "coffeelog://log"))
        setOnClickPendingIntent(R.id.action_brew, openIntent(context, "coffeelog://log?action=newBrew"))
        setOnClickPendingIntent(R.id.action_lot, openIntent(context, "coffeelog://beans?action=newLot"))
      }
    } else {
      RemoteViews(context.packageName, R.layout.widget_dashboard).apply {
        val brew = data.recentBrew
        setTextViewText(R.id.widget_title, brew?.beanName ?: "추출 기록")
        setTextViewText(R.id.widget_subtitle, brew?.drinkType ?: "새 추출을 기록하세요")
        setTextViewText(R.id.metric_one, "도징 ${brew?.doseGram ?: "-"}")
        setTextViewText(R.id.metric_two, "수율 ${brew?.yieldGram ?: "-"}")
        setTextViewText(R.id.metric_three, "시간 ${brew?.brewSeconds ?: "-"}")
        setTextViewText(R.id.recent_line, "평점 ${brew?.rating ?: "-"}")
        setOnClickPendingIntent(R.id.widget_root, openIntent(context, "coffeelog://log"))
        setOnClickPendingIntent(R.id.action_product, openIntent(context, "coffeelog://beans?action=newProduct"))
        setOnClickPendingIntent(R.id.action_lot, openIntent(context, "coffeelog://beans?action=newLot"))
        setOnClickPendingIntent(R.id.action_brew, openIntent(context, "coffeelog://log?action=newBrew"))
      }
    }
  }

  private fun setHistoryLine(views: RemoteViews, viewId: Int, line: RecentBrewLine?) {
    if (line == null) {
      views.setViewVisibility(viewId, View.GONE)
    } else {
      views.setViewVisibility(viewId, View.VISIBLE)
      views.setTextViewText(viewId, "${line.beanName} · ${line.line}")
    }
  }

  private fun summaryText(data: CoffeeWidgetData) = "원두 ${data.productCount} · 구매 ${data.lotCount} · 추출 ${data.brewCount}"

  private fun openIntent(context: Context, uri: String): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(uri), context, MainActivity::class.java).apply {
      addCategory(Intent.CATEGORY_BROWSABLE)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    }
    return PendingIntent.getActivity(
      context,
      uri.hashCode(),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }
}
