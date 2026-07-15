package com.alertaglobal.adapter

import android.graphics.Color
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.alertaglobal.databinding.ItemRecommendationBinding
import com.alertaglobal.model.Recommendation

class RecommendationAdapter : ListAdapter<Recommendation, RecommendationAdapter.ViewHolder>(DiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemRecommendationBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    class ViewHolder(private val binding: ItemRecommendationBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(item: Recommendation) {
            binding.apply {
                tvRecTitle.text = item.title
                tvRecDescription.text = item.description
                tvRecCategory.text = item.category
                cardRecommendation.setCardBackgroundColor(Color.parseColor(item.color + "15"))
                tvRecCategory.setTextColor(Color.parseColor(item.color))
            }
        }
    }

    class DiffCallback : DiffUtil.ItemCallback<Recommendation>() {
        override fun areItemsTheSame(oldItem: Recommendation, newItem: Recommendation) =
            oldItem.title == newItem.title
        override fun areContentsTheSame(oldItem: Recommendation, newItem: Recommendation) =
            oldItem == newItem
    }
}
