package com.srlee.coffeelog.widgets

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class WidgetBridgeModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  override fun getName() = "WidgetBridge"

  @ReactMethod
  fun updateWidgets(payload: String, promise: Promise) {
    try {
      CoffeeWidgetRenderer.saveSnapshot(reactContext, payload)
      CoffeeWidgetRenderer.updateAll(reactContext)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("WIDGET_UPDATE_FAILED", error)
    }
  }
}
