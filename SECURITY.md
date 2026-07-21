# Security policy

Never commit credentials, provider tokens, customer records, or production exports. Use a deployment secret manager and `.env.example` as the configuration contract. Rotate any credential that may have been exposed.

Report vulnerabilities privately to the repository owner with affected versions and reproduction steps, without live personal data or secrets. Operators should revoke exposed credentials immediately, preserve incident evidence, document containment and recovery, and review access, backup, retention, and notification requirements before deployment.

This project is an independent CRM workbench prototype. It is not SAP software and does not establish SAP certification, integration compatibility, or production ERP controls.
