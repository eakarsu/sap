// === Batch 11 Gaps & Frontend Mounts ===
import GapFeaturePage from '../../components/GapFeaturePage'
export default function GapTransactionAnomalyPage() {
  return (
    <GapFeaturePage
      title="Transaction Anomaly Detector"
      description="Transaction Anomaly Detector"
      slug="transaction-anomaly"
      aiResultKey="flags"
      fields={[
  {
    "name": "transactions",
    "label": "Transactions (JSON)",
    "type": "json"
  }
]}
    />
  )
}
