// === Batch 11 Gaps & Frontend Mounts ===
import GapFeaturePage from '../../components/GapFeaturePage'
export default function GapOdataConnectorPage() {
  return (
    <GapFeaturePage
      title="OData/BAPI Connector"
      description="OData/BAPI Connector"
      slug="odata-connector"
      aiResultKey="endpoint"
      fields={[
  {
    "name": "odataUrl",
    "label": "OData URL",
    "required": true,
    "placeholder": ""
  },
  {
    "name": "entity",
    "label": "Entity",
    "required": false,
    "placeholder": ""
  }
]}
    />
  )
}
