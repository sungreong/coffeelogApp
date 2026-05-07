package com.srlee.coffeelog.widgets

import org.json.JSONObject

data class ActiveBeanData(
  val name: String,
  val roastery: String,
  val status: String,
  val freshness: String,
  val freshnessDetail: String,
  val remaining: String,
  val estimatedCups: String,
  val logCount: Int
)

data class RecentBrewData(
  val beanName: String,
  val drinkType: String,
  val brewSeconds: String,
  val yieldGram: String,
  val doseGram: String,
  val rating: String
)

data class RecentBrewLine(
  val beanName: String,
  val line: String
)

data class CoffeeWidgetData(
  val productCount: Int,
  val lotCount: Int,
  val brewCount: Int,
  val activeBean: ActiveBeanData?,
  val recentBrew: RecentBrewData?,
  val recentBrews: List<RecentBrewLine>
) {
  companion object {
    fun empty() = CoffeeWidgetData(
      productCount = 0,
      lotCount = 0,
      brewCount = 0,
      activeBean = null,
      recentBrew = null,
      recentBrews = emptyList()
    )

    fun fromJson(raw: String?): CoffeeWidgetData {
      if (raw.isNullOrBlank()) return empty()
      return try {
        val root = JSONObject(raw)
        val counts = root.optJSONObject("counts")
        val active = root.optJSONObject("activeBean")
        val recent = root.optJSONObject("recentBrew")
        val recentArray = root.optJSONArray("recentBrews")
        CoffeeWidgetData(
          productCount = counts?.optInt("products") ?: 0,
          lotCount = counts?.optInt("lots") ?: 0,
          brewCount = counts?.optInt("brews") ?: 0,
          activeBean = active?.let {
            ActiveBeanData(
              name = it.optString("name", "원두 없음"),
              roastery = it.optString("roastery", ""),
              status = it.optString("status", "-"),
              freshness = it.optString("freshness", "로스팅일 미입력"),
              freshnessDetail = it.optString("freshnessDetail", ""),
              remaining = it.optString("remaining", "-"),
              estimatedCups = it.optString("estimatedCups", "-"),
              logCount = it.optInt("logCount", 0)
            )
          },
          recentBrew = recent?.let {
            RecentBrewData(
              beanName = it.optString("beanName", "원두"),
              drinkType = it.optString("drinkType", "추출"),
              brewSeconds = it.optString("brewSeconds", "-"),
              yieldGram = it.optString("yieldGram", "-"),
              doseGram = it.optString("doseGram", "-"),
              rating = it.optString("rating", "-")
            )
          },
          recentBrews = List(recentArray?.length() ?: 0) { index ->
            val item = recentArray!!.optJSONObject(index)
            RecentBrewLine(
              beanName = item?.optString("beanName", "원두") ?: "원두",
              line = item?.optString("line", "추출 기록") ?: "추출 기록"
            )
          }
        )
      } catch (_: Exception) {
        empty()
      }
    }
  }
}
