import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'

export default defineNuxtPlugin((nuxtApp) => {
  use([CanvasRenderer, LineChart, GridComponent, LegendComponent, TooltipComponent])
  nuxtApp.vueApp.component('VChart', VChart)
})
