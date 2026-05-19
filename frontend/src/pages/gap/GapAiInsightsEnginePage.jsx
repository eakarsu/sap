// === Batch 11 Gaps & Frontend Mounts ===
import GapFeaturePage from '../../components/GapFeaturePage'
export default function GapAiInsightsEnginePage() {
  return (
    <GapFeaturePage
      title="AI Insights Engine over SAP Data"
      description="AI Insights Engine over SAP Data"
      slug="ai-insights-engine"
      aiResultKey="insights"
      fields={[
  {
    "name": "records",
    "label": "Records (JSON)",
    "type": "json"
  }
]}
    />
  )
}
