// === Batch 11 Gaps & Frontend Mounts ===
import GapFeaturePage from '../../components/GapFeaturePage'
export default function GapMasterDataDedupePage() {
  return (
    <GapFeaturePage
      title="Master Data Deduplication"
      description="Master Data Deduplication"
      slug="master-data-dedupe"
      aiResultKey="duplicates"
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
