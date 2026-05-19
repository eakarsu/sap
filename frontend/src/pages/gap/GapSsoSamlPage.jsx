// === Batch 11 Gaps & Frontend Mounts ===
import GapFeaturePage from '../../components/GapFeaturePage'
export default function GapSsoSamlPage() {
  return (
    <GapFeaturePage
      title="SSO/SAML Auth"
      description="SSO/SAML Auth"
      slug="sso-saml"
      aiResultKey="config"
      fields={[
  {
    "name": "idpUrl",
    "label": "IdP URL",
    "required": true,
    "placeholder": ""
  },
  {
    "name": "entityId",
    "label": "Entity ID",
    "required": false,
    "placeholder": ""
  }
]}
    />
  )
}
