package com.srlee.coffeelog.widgets

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.os.Bundle

class CoffeeBrewWidget : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    ids.forEach { CoffeeWidgetRenderer.update(context, manager, it, CoffeeWidgetKind.BREW) }
  }

  override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) {
    CoffeeWidgetRenderer.update(context, manager, id, CoffeeWidgetKind.BREW)
  }
}
