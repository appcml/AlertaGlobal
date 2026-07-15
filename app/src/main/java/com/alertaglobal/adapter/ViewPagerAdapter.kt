package com.alertaglobal.adapter

import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentActivity
import androidx.viewpager2.adapter.FragmentStateAdapter
import com.alertaglobal.ui.AlertsFragment
import com.alertaglobal.ui.WeatherFragment
import com.alertaglobal.ui.MapFragment
import com.alertaglobal.ui.RecommendationsFragment

class ViewPagerAdapter(activity: FragmentActivity) : FragmentStateAdapter(activity) {

    override fun getItemCount(): Int = 4

    override fun createFragment(position: Int): Fragment {
        return when (position) {
            0 -> AlertsFragment()
            1 -> WeatherFragment()
            2 -> MapFragment()
            3 -> RecommendationsFragment()
            else -> throw IllegalArgumentException("Invalid position")
        }
    }
}
