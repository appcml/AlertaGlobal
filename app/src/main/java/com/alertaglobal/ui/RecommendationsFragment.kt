package com.alertaglobal.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import com.alertaglobal.adapter.RecommendationAdapter
import com.alertaglobal.databinding.FragmentRecommendationsBinding
import com.alertaglobal.model.Recommendation

class RecommendationsFragment : Fragment() {

    private var _binding: FragmentRecommendationsBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentRecommendationsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val recommendations = listOf(
            Recommendation(
                "☀\uFE0F Radiación UV Alta",
                "El índice UV es alto. Usa protector solar SPF 30+, gafas de sol y sombrero. Evita el sol entre 10:00 y 16:00.",
                "PREVENCIÓN",
                "#FF9800"
            ),
            Recommendation(
                "\uD83C\uDF0A Alerta de Tsunami",
                "Si sientes un sismo fuerte cerca de la costa, dirígete inmediatamente a zonas altas. Sigue las instrucciones oficiales.",
                "EMERGENCIA",
                "#F44336"
            ),
            Recommendation(
                "\uD83D\uDD25 Incendio Forestal",
                "Mantén la calma. Si estás en zona de evacuación, sigue las rutas designadas. Cubre boca y nariz con paño húmedo.",
                "EMERGENCIA",
                "#F44336"
            ),
            Recommendation(
                "\uD83C\uDF2A\uFE0F Tormenta Severa",
                "Refúgiate en el interior de un edificio. Evita ventanas. Desconecta aparatos eléctricos. No uses teléfono fijo.",
                "PRECAUCIÓN",
                "#FFEB3B"
            ),
            Recommendation(
                "\uD83C\uDF27\uFE0F Lluvias Intensas",
                "Evita cruzar zonas inundadas. No conduzcas por calles con agua acumulada. Mantente informado por canales oficiales.",
                "PRECAUCIÓN",
                "#2196F3"
            ),
            Recommendation(
                "❄\uFE0F Ola de Frío",
                "Abrígate en capas. Consume alimentos calientes. Evita la exposición prolongada. Revisa a personas mayores y niños.",
                "PREVENCIÓN",
                "#03A9F4"
            ),
            Recommendation(
                "\uD83C\uDF0B Erupción Volcánica",
                "Usa mascarilla N95. Si hay caída de ceniza, mantén puertas y ventanas cerradas. Limpia techos para evitar colapso.",
                "EMERGENCIA",
                "#F44336"
            ),
            Recommendation(
                "\uD83C\uDFDC\uFE0F Sequía",
                "Raciona el agua. No la desperdicies. Reporta fugas. Sigue las restricciones municipales de uso de agua.",
                "PREVENCIÓN",
                "#795548"
            )
        )

        val adapter = RecommendationAdapter()
        binding.recyclerRecommendations.apply {
            layoutManager = LinearLayoutManager(context)
            this.adapter = adapter
        }
        adapter.submitList(recommendations)
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
