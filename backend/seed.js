const pool = require('./db');
const bcrypt = require('bcryptjs');

const extendedSapTables = [
  'ewm_warehouse_tasks', 'ewm_wave_picks',
  'transportation_freight_orders', 'transportation_planning',
  'project_system_wbs', 'project_system_networks',
  'treasury_cash_positions', 'treasury_deals',
  'grc_access_risks', 'grc_controls',
  'fieldglass_workers', 'fieldglass_work_orders',
  'commerce_catalogs', 'commerce_carts',
  'analytics_stories', 'datasphere_data_flows',
  'subscription_contracts', 'group_reporting',
  'ehs_incidents', 'real_estate_contracts', 'plm_change_records',
  'advanced_atp_checks', 'settlement_rebates', 'localization_tax_rules',
  'basis_system_jobs', 'payroll_runs', 'time_sheets',
  'mdg_change_requests', 'mdg_data_quality',
  'central_finance_documents', 'central_finance_mappings',
  'credit_management_cases', 'dispute_management_cases', 'collections_worklists', 'cash_application_items',
  'integration_suite_flows', 'btp_subaccounts', 'event_mesh_topics', 'api_management_products',
  'ilm_retention_policies', 'document_management_files', 'variant_config_models', 'product_compliance_specs',
  'service_management_orders', 'field_service_assignments', 'customer_identity_profiles', 'customer_data_segments',
  'industry_utilities_devices', 'industry_utilities_billing', 'industry_retail_assortments', 'industry_retail_promotions',
  'industry_oil_gas_nominations', 'industry_banking_loans', 'industry_insurance_claims', 'industry_public_sector_grants',
  'industry_healthcare_cases', 'industry_higher_ed_students', 'industry_defense_contracts', 'industry_aerospace_programs',
  'sustainability_esg_metrics', 'green_ledger_entries', 'signavio_process_models', 'process_mining_cases',
  'cloud_alm_projects', 'cloud_alm_operations', 'solution_manager_changes', 'solution_manager_test_plans',
  'leanix_applications', 'walkme_guidance', 'joule_skills', 'ai_core_deployments',
  'build_apps_projects', 'build_process_automations', 'build_work_zone_sites',
  'identity_authentication_apps', 'identity_provisioning_jobs', 'btp_abap_environments',
  'btp_kyma_workloads', 'cap_services', 'hana_cloud_databases', 'bw4hana_queries',
  'data_intelligence_pipelines',
  'successfactors_employee_central', 'successfactors_learning', 'successfactors_goals',
  'successfactors_workforce_analytics', 'sales_cloud_opportunities', 'service_cloud_cases',
  'cpq_quotes', 'emarsys_campaigns', 'customer_checkout_pos', 'digital_payments',
  'digital_manufacturing_orders', 'manufacturing_execution_operations', 'manufacturing_insights',
  'asset_performance_models', 'asset_network_collaboration', 'yard_logistics_appointments',
  'logistics_business_network_shipments',
  'advanced_financial_close_tasks', 'revenue_accounting_contracts', 'profitability_performance_models',
  'document_reporting_compliance', 'contract_accounts_receivable_payable', 'funds_management_budget',
  'joint_venture_accounting', 'commodity_management_deals', 'trade_promotion_management',
  'sales_performance_management', 'territory_quota_plans', 'enterprise_portfolio_initiatives',
  'innovation_management_ideas', 'sourcing_supplier_network', 'supplier_risk_assessments',
  'quality_issue_resolution', 'audit_management_plans', 'environment_management_permits',
  'waste_management_records', 'mobile_start_cards', 'fiori_launchpad_spaces', 'enable_now_content',
  'business_network_assets', 'business_network_material_traceability',
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // DROP ALL TABLES
    await client.query(`
      DROP TABLE IF EXISTS ${extendedSapTables.join(', ')}, supply_plans, demand_plans, travel_bookings, travel_requests, succession_planning, compensation, onboarding, recruiting, procurement_contracts, sourcing_events, stock_transfers, warehouse_orders, storage_bins, quality_plans, quality_notifications, inspection_lots, functional_locations, maintenance_plans, maintenance_orders, equipment, routings, work_centers, mrp_runs, production_orders, bill_of_materials, inventory, goods_receipts, purchase_requisitions, purchase_orders, profitability_analysis, internal_orders, profit_centers, cost_centers, bank_accounting, asset_accounting, accounts_receivable, accounts_payable, general_ledger, material_master, returns, billing_documents, shipments, deliveries, notifications, audit_logs, forecasts, competitors, territories, vendors, goals, activities, tasks, projects, training_courses, leave_requests, performance_reviews, departments, employees, expense_reports, payments, invoices, price_lists, products, customer_segments, email_templates, campaigns, sla_policies, work_orders, knowledge_base, tickets, contracts, orders, quotes, opportunities, leads, contacts, accounts, users CASCADE
    `);

    // Helper to bulk insert
    async function ins(table, cols, rows) {
      for (const r of rows) {
        const placeholders = r.map((_, i) => `$${i + 1}`).join(', ');
        await client.query(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`, r);
      }
    }

    // CREATE TABLES
    await client.query(`
      CREATE TABLE users (id SERIAL PRIMARY KEY, email VARCHAR(255) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL, full_name VARCHAR(255), role VARCHAR(50) DEFAULT 'user', created_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE accounts (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, industry VARCHAR(100), website VARCHAR(255), phone VARCHAR(50), email VARCHAR(255), address TEXT, city VARCHAR(100), state VARCHAR(100), country VARCHAR(100), annual_revenue DECIMAL(15,2), employee_count INT, account_type VARCHAR(100), status VARCHAR(50) DEFAULT 'Active', notes TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE contacts (id SERIAL PRIMARY KEY, first_name VARCHAR(100), last_name VARCHAR(100), email VARCHAR(255), phone VARCHAR(50), mobile VARCHAR(50), company VARCHAR(255), job_title VARCHAR(255), department VARCHAR(100), address TEXT, city VARCHAR(100), country VARCHAR(100), status VARCHAR(50) DEFAULT 'Active', notes TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE leads (id SERIAL PRIMARY KEY, first_name VARCHAR(100), last_name VARCHAR(100), email VARCHAR(255), phone VARCHAR(50), company VARCHAR(255), job_title VARCHAR(255), source VARCHAR(100), qualification VARCHAR(50), estimated_value DECIMAL(15,2), status VARCHAR(50) DEFAULT 'New', notes TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE opportunities (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, account_name VARCHAR(255), contact_name VARCHAR(255), amount DECIMAL(15,2), phase VARCHAR(100), probability INT, close_date DATE, source VARCHAR(100), competitor VARCHAR(255), status VARCHAR(50) DEFAULT 'Open', notes TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE quotes (id SERIAL PRIMARY KEY, quote_number VARCHAR(50), name VARCHAR(255), account_name VARCHAR(255), contact_name VARCHAR(255), amount DECIMAL(15,2), discount DECIMAL(5,2), tax DECIMAL(15,2), total DECIMAL(15,2), valid_until DATE, status VARCHAR(50) DEFAULT 'Draft', notes TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE orders (id SERIAL PRIMARY KEY, order_number VARCHAR(50), account_name VARCHAR(255), contact_name VARCHAR(255), amount DECIMAL(15,2), tax DECIMAL(15,2), total DECIMAL(15,2), status VARCHAR(50) DEFAULT 'Confirmed', order_date DATE, delivery_date DATE, shipping_address TEXT, notes TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE contracts (id SERIAL PRIMARY KEY, contract_number VARCHAR(50), name VARCHAR(255) NOT NULL, account_name VARCHAR(255), contact_name VARCHAR(255), type VARCHAR(100), value DECIMAL(15,2), start_date DATE, end_date DATE, renewal_date DATE, status VARCHAR(50) DEFAULT 'Active', terms TEXT, notes TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE tickets (id SERIAL PRIMARY KEY, ticket_number VARCHAR(50), title VARCHAR(255) NOT NULL, contact_name VARCHAR(255), account_name VARCHAR(255), priority VARCHAR(50) DEFAULT 'Medium', category VARCHAR(100), status VARCHAR(50) DEFAULT 'New', assigned_to VARCHAR(255), description TEXT, resolution TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE knowledge_base (id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, content TEXT, category VARCHAR(100), author VARCHAR(255), tags VARCHAR(255), views INT DEFAULT 0, rating DECIMAL(3,1), status VARCHAR(50) DEFAULT 'Published', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE work_orders (id SERIAL PRIMARY KEY, work_order_number VARCHAR(50), title VARCHAR(255) NOT NULL, account_name VARCHAR(255), contact_name VARCHAR(255), type VARCHAR(100), priority VARCHAR(50) DEFAULT 'Medium', status VARCHAR(50) DEFAULT 'New', assigned_to VARCHAR(255), scheduled_date DATE, completed_date DATE, estimated_hours DECIMAL(8,2), actual_hours DECIMAL(8,2) DEFAULT 0, description TEXT, location VARCHAR(255), created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE sla_policies (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, description TEXT, entity_type VARCHAR(100), priority VARCHAR(50), response_time_hours INT, resolution_time_hours INT, escalation_time_hours INT, status VARCHAR(50) DEFAULT 'Active', applicable_to VARCHAR(255), created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE campaigns (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, type VARCHAR(100), channel VARCHAR(100), status VARCHAR(50) DEFAULT 'Draft', start_date DATE, end_date DATE, budget DECIMAL(15,2), actual_cost DECIMAL(15,2), expected_revenue DECIMAL(15,2), target_audience VARCHAR(255), description TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE email_templates (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, subject VARCHAR(255), body TEXT, category VARCHAR(100), type VARCHAR(100), status VARCHAR(50) DEFAULT 'Draft', created_by VARCHAR(255), usage_count INT DEFAULT 0, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE customer_segments (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, description TEXT, criteria TEXT, member_count INT DEFAULT 0, type VARCHAR(100), status VARCHAR(50) DEFAULT 'Active', created_by VARCHAR(255), last_evaluated DATE, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE products (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, material_number VARCHAR(50), category VARCHAR(100), price DECIMAL(15,2), cost DECIMAL(15,2), quantity_in_stock INT, unit VARCHAR(50), description TEXT, status VARCHAR(50) DEFAULT 'Active', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE price_lists (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, description TEXT, currency VARCHAR(10) DEFAULT 'EUR', effective_date DATE, expiry_date DATE, discount_percent DECIMAL(5,2), type VARCHAR(100), status VARCHAR(50) DEFAULT 'Active', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE invoices (id SERIAL PRIMARY KEY, invoice_number VARCHAR(50), account_name VARCHAR(255), contact_name VARCHAR(255), amount DECIMAL(15,2), tax DECIMAL(15,2), total DECIMAL(15,2), status VARCHAR(50) DEFAULT 'Pending', due_date DATE, paid_date DATE, payment_terms VARCHAR(100), notes TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE payments (id SERIAL PRIMARY KEY, payment_number VARCHAR(50), account_name VARCHAR(255), invoice_number VARCHAR(50), amount DECIMAL(15,2), payment_method VARCHAR(100), payment_date DATE, reference VARCHAR(255), status VARCHAR(50) DEFAULT 'Completed', notes TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE expense_reports (id SERIAL PRIMARY KEY, report_number VARCHAR(50), employee_name VARCHAR(255), department VARCHAR(100), purpose TEXT, total_amount DECIMAL(15,2), category VARCHAR(100), status VARCHAR(50) DEFAULT 'Draft', submitted_date DATE, approved_by VARCHAR(255), approved_date DATE, notes TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE employees (id SERIAL PRIMARY KEY, first_name VARCHAR(100), last_name VARCHAR(100), email VARCHAR(255), phone VARCHAR(50), department VARCHAR(100), position VARCHAR(255), manager VARCHAR(255), hire_date DATE, salary DECIMAL(15,2), office_location VARCHAR(255), status VARCHAR(50) DEFAULT 'Active', skills VARCHAR(500), created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE departments (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, code VARCHAR(50), manager VARCHAR(255), parent_department VARCHAR(255), employee_count INT DEFAULT 0, budget DECIMAL(15,2), location VARCHAR(255), phone VARCHAR(50), email VARCHAR(255), status VARCHAR(50) DEFAULT 'Active', description TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE performance_reviews (id SERIAL PRIMARY KEY, employee_name VARCHAR(255), reviewer VARCHAR(255), review_period VARCHAR(100), overall_rating DECIMAL(3,1), goals_rating DECIMAL(3,1), skills_rating DECIMAL(3,1), communication_rating DECIMAL(3,1), status VARCHAR(50) DEFAULT 'Draft', strengths TEXT, improvements TEXT, review_date DATE, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE leave_requests (id SERIAL PRIMARY KEY, employee_name VARCHAR(255), leave_type VARCHAR(100), start_date DATE, end_date DATE, days_requested DECIMAL(5,1), reason TEXT, status VARCHAR(50) DEFAULT 'Pending', approved_by VARCHAR(255), created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE training_courses (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, description TEXT, category VARCHAR(100), instructor VARCHAR(255), duration_hours DECIMAL(8,2), max_participants INT, enrolled INT DEFAULT 0, start_date DATE, end_date DATE, format VARCHAR(100), status VARCHAR(50) DEFAULT 'Scheduled', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE projects (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, description TEXT, account_name VARCHAR(255), manager VARCHAR(255), priority VARCHAR(50), status VARCHAR(50) DEFAULT 'Planning', start_date DATE, end_date DATE, budget DECIMAL(15,2), actual_cost DECIMAL(15,2), progress INT DEFAULT 0, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE tasks (id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, description TEXT, project_name VARCHAR(255), assigned_to VARCHAR(255), priority VARCHAR(50) DEFAULT 'Medium', status VARCHAR(50) DEFAULT 'Not Started', due_date DATE, estimated_hours DECIMAL(8,2), actual_hours DECIMAL(8,2) DEFAULT 0, category VARCHAR(100), created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE activities (id SERIAL PRIMARY KEY, type VARCHAR(100), subject VARCHAR(255) NOT NULL, description TEXT, regarding VARCHAR(255), assigned_to VARCHAR(255), status VARCHAR(50) DEFAULT 'Planned', priority VARCHAR(50) DEFAULT 'Normal', start_date TIMESTAMP, end_date TIMESTAMP, location VARCHAR(255), created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE goals (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, owner VARCHAR(255), type VARCHAR(100), target_value DECIMAL(15,2), actual_value DECIMAL(15,2), start_date DATE, end_date DATE, status VARCHAR(50) DEFAULT 'Not Started', progress INT DEFAULT 0, notes TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE vendors (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, contact_name VARCHAR(255), email VARCHAR(255), phone VARCHAR(50), website VARCHAR(255), address TEXT, city VARCHAR(100), country VARCHAR(100), category VARCHAR(100), payment_terms VARCHAR(100), rating DECIMAL(3,1), status VARCHAR(50) DEFAULT 'Active', notes TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE territories (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, region VARCHAR(100), manager VARCHAR(255), description TEXT, target_revenue DECIMAL(15,2), actual_revenue DECIMAL(15,2), account_count INT, status VARCHAR(50) DEFAULT 'Active', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE competitors (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, website VARCHAR(255), industry VARCHAR(100), strengths TEXT, weaknesses TEXT, market_share DECIMAL(5,2), threat_level VARCHAR(50), notes TEXT, status VARCHAR(50) DEFAULT 'Active', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE forecasts (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, period VARCHAR(100), owner VARCHAR(255), target_amount DECIMAL(15,2), best_case DECIMAL(15,2), committed DECIMAL(15,2), pipeline DECIMAL(15,2), closed DECIMAL(15,2) DEFAULT 0, status VARCHAR(50) DEFAULT 'Open', notes TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE audit_logs (id SERIAL PRIMARY KEY, action VARCHAR(100) NOT NULL, entity_type VARCHAR(100), entity_id INT, user_name VARCHAR(255), changes TEXT, ip_address VARCHAR(50), timestamp TIMESTAMP DEFAULT NOW(), details TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE notifications (id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, message TEXT, type VARCHAR(100), recipient VARCHAR(255), priority VARCHAR(50) DEFAULT 'Normal', status VARCHAR(50) DEFAULT 'Unread', link VARCHAR(255), created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE general_ledger (id SERIAL PRIMARY KEY, doc_number VARCHAR(50), posting_date DATE, account VARCHAR(100), description TEXT, debit_amount DECIMAL(15,2), credit_amount DECIMAL(15,2), company_code VARCHAR(50), fiscal_year VARCHAR(10), currency VARCHAR(10) DEFAULT 'EUR', status VARCHAR(50) DEFAULT 'Posted', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE accounts_payable (id SERIAL PRIMARY KEY, invoice_number VARCHAR(50), vendor_name VARCHAR(255), amount DECIMAL(15,2), tax DECIMAL(15,2), total DECIMAL(15,2), due_date DATE, payment_status VARCHAR(50) DEFAULT 'Open', payment_date DATE, payment_method VARCHAR(100), days_overdue INT DEFAULT 0, notes TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE accounts_receivable (id SERIAL PRIMARY KEY, invoice_number VARCHAR(50), customer_name VARCHAR(255), amount DECIMAL(15,2), tax DECIMAL(15,2), total DECIMAL(15,2), due_date DATE, payment_status VARCHAR(50) DEFAULT 'Open', collection_date DATE, dunning_level VARCHAR(50) DEFAULT 'None', days_outstanding INT DEFAULT 0, notes TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE asset_accounting (id SERIAL PRIMARY KEY, asset_number VARCHAR(50), description VARCHAR(255), asset_class VARCHAR(100), acquisition_date DATE, acquisition_value DECIMAL(15,2), accumulated_depreciation DECIMAL(15,2), book_value DECIMAL(15,2), useful_life_years INT, depreciation_method VARCHAR(100), location VARCHAR(255), status VARCHAR(50) DEFAULT 'Active', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE bank_accounting (id SERIAL PRIMARY KEY, bank_name VARCHAR(255), account_number VARCHAR(100), bank_key VARCHAR(50), currency VARCHAR(10) DEFAULT 'EUR', balance DECIMAL(15,2), available_balance DECIMAL(15,2), last_statement_date DATE, account_type VARCHAR(100), status VARCHAR(50) DEFAULT 'Active', notes TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE cost_centers (id SERIAL PRIMARY KEY, cost_center_id VARCHAR(50), name VARCHAR(255), department VARCHAR(100), responsible_person VARCHAR(255), budget DECIMAL(15,2), actual_cost DECIMAL(15,2), variance DECIMAL(15,2), cost_center_type VARCHAR(100), valid_from DATE, valid_to DATE, status VARCHAR(50) DEFAULT 'Active', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE profit_centers (id SERIAL PRIMARY KEY, profit_center_id VARCHAR(50), name VARCHAR(255), segment VARCHAR(100), responsible_person VARCHAR(255), revenue DECIMAL(15,2), costs DECIMAL(15,2), profit DECIMAL(15,2), margin_percent DECIMAL(5,2), business_area VARCHAR(100), status VARCHAR(50) DEFAULT 'Active', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE internal_orders (id SERIAL PRIMARY KEY, order_number VARCHAR(50), description VARCHAR(255), order_type VARCHAR(100), responsible_person VARCHAR(255), budget DECIMAL(15,2), actual_cost DECIMAL(15,2), committed DECIMAL(15,2), cost_center VARCHAR(100), start_date DATE, end_date DATE, status VARCHAR(50) DEFAULT 'Created', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE profitability_analysis (id SERIAL PRIMARY KEY, segment VARCHAR(255), product_group VARCHAR(100), region VARCHAR(100), customer_group VARCHAR(100), revenue DECIMAL(15,2), cogs DECIMAL(15,2), gross_profit DECIMAL(15,2), operating_expenses DECIMAL(15,2), net_profit DECIMAL(15,2), margin_percent DECIMAL(5,2), period VARCHAR(50), status VARCHAR(50) DEFAULT 'Actual', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE purchase_orders (id SERIAL PRIMARY KEY, po_number VARCHAR(50), vendor_name VARCHAR(255), material VARCHAR(255), quantity DECIMAL(13,3), unit_price DECIMAL(15,2), total DECIMAL(15,2), currency VARCHAR(10) DEFAULT 'EUR', delivery_date DATE, plant VARCHAR(100), storage_location VARCHAR(100), status VARCHAR(50) DEFAULT 'Created', notes TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE purchase_requisitions (id SERIAL PRIMARY KEY, pr_number VARCHAR(50), description VARCHAR(255), requester VARCHAR(255), material VARCHAR(255), quantity DECIMAL(13,3), estimated_price DECIMAL(15,2), total DECIMAL(15,2), required_date DATE, cost_center VARCHAR(100), priority VARCHAR(50) DEFAULT 'Normal', status VARCHAR(50) DEFAULT 'Created', notes TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE goods_receipts (id SERIAL PRIMARY KEY, gr_number VARCHAR(50), po_number VARCHAR(50), vendor_name VARCHAR(255), material VARCHAR(255), quantity DECIMAL(13,3), unit VARCHAR(50), receipt_date DATE, plant VARCHAR(100), storage_location VARCHAR(100), batch VARCHAR(50), status VARCHAR(50) DEFAULT 'Posted', notes TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE inventory (id SERIAL PRIMARY KEY, material_number VARCHAR(50), description VARCHAR(255), plant VARCHAR(100), storage_location VARCHAR(100), quantity DECIMAL(13,3), unit VARCHAR(50), value DECIMAL(15,2), reorder_point DECIMAL(13,3), max_stock DECIMAL(13,3), last_count_date DATE, stock_type VARCHAR(100) DEFAULT 'Unrestricted', status VARCHAR(50) DEFAULT 'Active', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE material_master (id SERIAL PRIMARY KEY, material_number VARCHAR(50), description VARCHAR(255), material_type VARCHAR(100), material_group VARCHAR(100), base_unit VARCHAR(20), weight DECIMAL(10,3), weight_unit VARCHAR(10), dimensions VARCHAR(100), plant VARCHAR(100), storage_location VARCHAR(100), status VARCHAR(50) DEFAULT 'Active', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE bill_of_materials (id SERIAL PRIMARY KEY, bom_number VARCHAR(50), material VARCHAR(255), description VARCHAR(255), base_quantity DECIMAL(13,3), base_unit VARCHAR(20), components_count INT, bom_type VARCHAR(100), valid_from DATE, valid_to DATE, alternative VARCHAR(50), status VARCHAR(50) DEFAULT 'Active', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE production_orders (id SERIAL PRIMARY KEY, order_number VARCHAR(50), material VARCHAR(255), description VARCHAR(255), quantity DECIMAL(13,3), unit VARCHAR(20), start_date DATE, end_date DATE, plant VARCHAR(100), work_center VARCHAR(100), routing VARCHAR(100), priority VARCHAR(50) DEFAULT 'Normal', status VARCHAR(50) DEFAULT 'Created', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE mrp_runs (id SERIAL PRIMARY KEY, run_id VARCHAR(50), plant VARCHAR(100), run_date DATE, planning_scope VARCHAR(100), materials_planned INT, planned_orders_created INT, purchase_requisitions_created INT, exceptions INT, processing_time_minutes DECIMAL(8,2), status VARCHAR(50) DEFAULT 'Completed', notes TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE work_centers (id SERIAL PRIMARY KEY, work_center_id VARCHAR(50), name VARCHAR(255), plant VARCHAR(100), cost_center VARCHAR(100), capacity_type VARCHAR(50), available_capacity DECIMAL(10,2), capacity_unit VARCHAR(20), efficiency_percent DECIMAL(5,2), setup_time DECIMAL(8,2), responsible_person VARCHAR(255), status VARCHAR(50) DEFAULT 'Active', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE routings (id SERIAL PRIMARY KEY, routing_number VARCHAR(50), material VARCHAR(255), description VARCHAR(255), operations_count INT, total_setup_time DECIMAL(8,2), total_processing_time DECIMAL(8,2), total_time DECIMAL(8,2), time_unit VARCHAR(20), work_center VARCHAR(100), valid_from DATE, valid_to DATE, status VARCHAR(50) DEFAULT 'Active', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE equipment (id SERIAL PRIMARY KEY, equipment_id VARCHAR(50), description VARCHAR(255), equipment_type VARCHAR(100), serial_number VARCHAR(100), manufacturer VARCHAR(255), model VARCHAR(255), installation_date DATE, warranty_expiry DATE, location VARCHAR(255), cost_center VARCHAR(100), status VARCHAR(50) DEFAULT 'Active', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE maintenance_orders (id SERIAL PRIMARY KEY, order_number VARCHAR(50), description VARCHAR(255), equipment_id VARCHAR(50), order_type VARCHAR(100), priority VARCHAR(50) DEFAULT 'Normal', planned_start DATE, planned_end DATE, actual_start DATE, actual_end DATE, assigned_to VARCHAR(255), estimated_cost DECIMAL(15,2), actual_cost DECIMAL(15,2), status VARCHAR(50) DEFAULT 'Created', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE maintenance_plans (id SERIAL PRIMARY KEY, plan_number VARCHAR(50), description VARCHAR(255), equipment_id VARCHAR(50), plan_type VARCHAR(100), frequency VARCHAR(50), cycle_length INT, next_due_date DATE, last_completed_date DATE, assigned_to VARCHAR(255), estimated_duration_hours DECIMAL(8,2), status VARCHAR(50) DEFAULT 'Active', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE functional_locations (id SERIAL PRIMARY KEY, location_id VARCHAR(50), description VARCHAR(255), location_type VARCHAR(100), parent_location VARCHAR(100), plant VARCHAR(100), address TEXT, equipment_count INT DEFAULT 0, responsible_person VARCHAR(255), cost_center VARCHAR(100), status VARCHAR(50) DEFAULT 'Active', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE inspection_lots (id SERIAL PRIMARY KEY, lot_number VARCHAR(50), material VARCHAR(255), inspection_type VARCHAR(100), sample_size INT, inspected_quantity INT, defects_found INT, defect_rate DECIMAL(5,2), inspection_date DATE, inspector VARCHAR(255), result VARCHAR(50), status VARCHAR(50) DEFAULT 'Created', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE quality_notifications (id SERIAL PRIMARY KEY, notification_number VARCHAR(50), description VARCHAR(255), notification_type VARCHAR(100), priority VARCHAR(50) DEFAULT 'Medium', material VARCHAR(255), defect_type VARCHAR(255), reported_by VARCHAR(255), reported_date DATE, assigned_to VARCHAR(255), root_cause TEXT, corrective_action TEXT, status VARCHAR(50) DEFAULT 'Created', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE quality_plans (id SERIAL PRIMARY KEY, plan_number VARCHAR(50), description VARCHAR(255), material VARCHAR(255), inspection_type VARCHAR(100), inspection_points INT, sample_procedure VARCHAR(255), inspection_method VARCHAR(255), valid_from DATE, valid_to DATE, responsible VARCHAR(255), status VARCHAR(50) DEFAULT 'Active', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE storage_bins (id SERIAL PRIMARY KEY, bin_id VARCHAR(50), warehouse VARCHAR(100), storage_type VARCHAR(100), section VARCHAR(50), aisle VARCHAR(50), level VARCHAR(50), max_capacity DECIMAL(13,3), current_stock DECIMAL(13,3), capacity_unit VARCHAR(20), material_type_restriction VARCHAR(100), status VARCHAR(50) DEFAULT 'Available', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE warehouse_orders (id SERIAL PRIMARY KEY, order_number VARCHAR(50), order_type VARCHAR(100), material VARCHAR(255), quantity DECIMAL(13,3), unit VARCHAR(20), source_bin VARCHAR(50), destination_bin VARCHAR(50), warehouse VARCHAR(100), priority VARCHAR(50) DEFAULT 'Normal', assigned_to VARCHAR(255), status VARCHAR(50) DEFAULT 'Created', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE stock_transfers (id SERIAL PRIMARY KEY, transfer_number VARCHAR(50), material VARCHAR(255), description VARCHAR(255), quantity DECIMAL(13,3), unit VARCHAR(20), from_plant VARCHAR(100), from_storage VARCHAR(100), to_plant VARCHAR(100), to_storage VARCHAR(100), transfer_date DATE, shipping_type VARCHAR(100), status VARCHAR(50) DEFAULT 'Created', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE deliveries (id SERIAL PRIMARY KEY, delivery_number VARCHAR(50), sales_order VARCHAR(50), customer_name VARCHAR(255), ship_to_address TEXT, delivery_date DATE, actual_ship_date DATE, carrier VARCHAR(255), tracking_number VARCHAR(100), total_weight DECIMAL(10,2), weight_unit VARCHAR(10) DEFAULT 'KG', total_volume DECIMAL(10,2), status VARCHAR(50) DEFAULT 'Created', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE shipments (id SERIAL PRIMARY KEY, shipment_number VARCHAR(50), carrier VARCHAR(255), transport_mode VARCHAR(50), origin VARCHAR(255), destination VARCHAR(255), departure_date DATE, arrival_date DATE, total_weight DECIMAL(10,2), total_volume DECIMAL(10,2), freight_cost DECIMAL(15,2), tracking_number VARCHAR(100), status VARCHAR(50) DEFAULT 'Planned', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE billing_documents (id SERIAL PRIMARY KEY, billing_number VARCHAR(50), customer_name VARCHAR(255), sales_order VARCHAR(50), delivery_number VARCHAR(50), billing_type VARCHAR(100), amount DECIMAL(15,2), tax DECIMAL(15,2), total DECIMAL(15,2), billing_date DATE, payment_terms VARCHAR(50), currency VARCHAR(10) DEFAULT 'EUR', status VARCHAR(50) DEFAULT 'Created', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE returns (id SERIAL PRIMARY KEY, return_number VARCHAR(50), customer_name VARCHAR(255), original_order VARCHAR(50), original_delivery VARCHAR(50), reason VARCHAR(255), quantity DECIMAL(13,3), amount DECIMAL(15,2), return_date DATE, inspection_result VARCHAR(50) DEFAULT 'Pending', refund_status VARCHAR(50) DEFAULT 'Pending', status VARCHAR(50) DEFAULT 'Created', notes TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE sourcing_events (id SERIAL PRIMARY KEY, event_number VARCHAR(50), event_type VARCHAR(100), title VARCHAR(255), category VARCHAR(100), estimated_value DECIMAL(15,2), currency VARCHAR(10) DEFAULT 'EUR', start_date DATE, end_date DATE, participants INT, awarded_to VARCHAR(255), savings_percent DECIMAL(5,2), owner VARCHAR(255), status VARCHAR(50) DEFAULT 'Draft', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE procurement_contracts (id SERIAL PRIMARY KEY, contract_number VARCHAR(50), title VARCHAR(255), vendor VARCHAR(255), category VARCHAR(100), contract_type VARCHAR(100), start_date DATE, end_date DATE, total_value DECIMAL(15,2), consumed_value DECIMAL(15,2), currency VARCHAR(10) DEFAULT 'EUR', payment_terms VARCHAR(50), renewal_type VARCHAR(50), owner VARCHAR(255), status VARCHAR(50) DEFAULT 'Draft', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE recruiting (id SERIAL PRIMARY KEY, requisition_id VARCHAR(50), job_title VARCHAR(255), department VARCHAR(100), location VARCHAR(255), hiring_manager VARCHAR(255), recruiter VARCHAR(255), candidates_count INT DEFAULT 0, interviews_scheduled INT DEFAULT 0, offers_extended INT DEFAULT 0, target_date DATE, salary_range VARCHAR(100), employment_type VARCHAR(50), status VARCHAR(50) DEFAULT 'Draft', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE onboarding (id SERIAL PRIMARY KEY, onboarding_id VARCHAR(50), employee_name VARCHAR(255), position VARCHAR(255), department VARCHAR(100), start_date DATE, buddy_assigned VARCHAR(255), it_setup_status VARCHAR(50), training_plan VARCHAR(255), documents_completed VARCHAR(20) DEFAULT '0', orientation_date DATE, manager VARCHAR(255), progress_percent INT DEFAULT 0, status VARCHAR(50) DEFAULT 'Not Started', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE compensation (id SERIAL PRIMARY KEY, plan_id VARCHAR(50), employee_name VARCHAR(255), department VARCHAR(100), current_salary DECIMAL(15,2), proposed_salary DECIMAL(15,2), increase_percent DECIMAL(5,2), bonus_target DECIMAL(15,2), bonus_actual DECIMAL(15,2), equity_grants INT, effective_date DATE, review_cycle VARCHAR(50), approver VARCHAR(255), status VARCHAR(50) DEFAULT 'Draft', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE succession_planning (id SERIAL PRIMARY KEY, plan_id VARCHAR(50), key_position VARCHAR(255), current_holder VARCHAR(255), department VARCHAR(100), successor_1 VARCHAR(255), readiness_1 VARCHAR(50), successor_2 VARCHAR(255), readiness_2 VARCHAR(50), development_plan TEXT, risk_level VARCHAR(50), last_reviewed DATE, hr_partner VARCHAR(255), status VARCHAR(50) DEFAULT 'Active', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE travel_requests (id SERIAL PRIMARY KEY, request_number VARCHAR(50), employee_name VARCHAR(255), department VARCHAR(100), destination VARCHAR(255), purpose TEXT, departure_date DATE, return_date DATE, estimated_cost DECIMAL(15,2), currency VARCHAR(10) DEFAULT 'EUR', advance_requested DECIMAL(15,2), approver VARCHAR(255), approval_date DATE, status VARCHAR(50) DEFAULT 'Draft', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE travel_bookings (id SERIAL PRIMARY KEY, booking_id VARCHAR(50), travel_request VARCHAR(50), employee_name VARCHAR(255), booking_type VARCHAR(50), provider VARCHAR(255), departure VARCHAR(255), arrival VARCHAR(255), departure_date DATE, return_date DATE, cost DECIMAL(15,2), currency VARCHAR(10) DEFAULT 'EUR', confirmation_number VARCHAR(100), status VARCHAR(50) DEFAULT 'Confirmed', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE demand_plans (id SERIAL PRIMARY KEY, plan_id VARCHAR(50), product_family VARCHAR(100), region VARCHAR(100), planning_period VARCHAR(50), forecast_quantity DECIMAL(15,2), forecast_unit VARCHAR(20), confidence_level DECIMAL(5,2), actual_quantity DECIMAL(15,2), variance_percent DECIMAL(5,2), planner VARCHAR(255), last_updated DATE, algorithm VARCHAR(100), status VARCHAR(50) DEFAULT 'Draft', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE supply_plans (id SERIAL PRIMARY KEY, plan_id VARCHAR(50), product_family VARCHAR(100), region VARCHAR(100), planning_period VARCHAR(50), planned_quantity DECIMAL(15,2), available_capacity DECIMAL(15,2), utilization_percent DECIMAL(5,2), supply_source VARCHAR(100), lead_time_days INT, safety_stock DECIMAL(15,2), planner VARCHAR(255), last_updated DATE, status VARCHAR(50) DEFAULT 'Draft', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
    `);
    console.log('Tables created');

    for (const table of extendedSapTables) {
      await client.query(`
        CREATE TABLE ${table} (
          id SERIAL PRIMARY KEY,
          code VARCHAR(80) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          category VARCHAR(100),
          process_area VARCHAR(120),
          owner VARCHAR(255),
          amount DECIMAL(15,2),
          currency VARCHAR(10) DEFAULT 'EUR',
          start_date DATE,
          end_date DATE,
          status VARCHAR(50) DEFAULT 'Active',
          notes TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
    }
    console.log('Extended SAP module tables created');

    // SEED USERS
    const hash = await bcrypt.hash('password123', 10);
    await ins('users', ['email','password','full_name','role'], [
      ['admin@sapcrm.com', hash, 'SAP Admin', 'admin'],
      ['sarah.mueller@sapcrm.com', hash, 'Sarah Mueller', 'manager'],
      ['thomas.weber@sapcrm.com', hash, 'Thomas Weber', 'user'],
    ]);

    // SEED ACCOUNTS
    await ins('accounts', ['name','industry','website','phone','email','address','city','state','country','annual_revenue','employee_count','account_type','status','notes'], [
      ['BASF','Chemicals','basf.com','+49-621-600','info@basf.com','Carl-Bosch-Str 38','Ludwigshafen','RP','Germany',78700000000,111000,'Enterprise','Active','Global chemical leader'],
      ['Siemens','Technology','siemens.com','+49-89-636-00','contact@siemens.com','Werner-von-Siemens-Str 1','Munich','BY','Germany',62300000000,303000,'Enterprise','Active','Industrial automation'],
      ['BMW','Automotive','bmw.com','+49-89-382-0','info@bmw.com','Petuelring 130','Munich','BY','Germany',142600000000,120000,'Enterprise','Active','Premium automotive'],
      ['Bosch','Technology','bosch.com','+49-711-400-0','info@bosch.com','Robert-Bosch-Platz 1','Stuttgart','BW','Germany',88400000000,421000,'Enterprise','Active','IoT and mobility'],
      ['Daimler','Automotive','daimler.com','+49-711-17-0','contact@daimler.com','Mercedesstr 120','Stuttgart','BW','Germany',150000000000,298000,'Enterprise','Active','Mercedes-Benz parent'],
      ['Volkswagen','Automotive','volkswagen.com','+49-5361-9-0','info@vw.com','Berliner Ring 2','Wolfsburg','NI','Germany',279200000000,672000,'Enterprise','Active','Largest automaker EU'],
      ['Bayer','Pharma','bayer.com','+49-214-30-1','info@bayer.com','Kaiser-Wilhelm-Allee 1','Leverkusen','NW','Germany',50700000000,101000,'Enterprise','Active','Life sciences'],
      ['SAP SE','Software','sap.com','+49-6227-7-0','info@sap.com','Dietmar-Hopp-Allee 16','Walldorf','BW','Germany',31200000000,107000,'Enterprise','Active','Enterprise software'],
      ['Deutsche Bank','Banking','db.com','+49-69-910-00','info@db.com','Taunusanlage 12','Frankfurt','HE','Germany',28900000000,84000,'Enterprise','Active','Global banking'],
      ['Allianz','Insurance','allianz.com','+49-89-3800-0','info@allianz.com','Koeniginstr 28','Munich','BY','Germany',152500000000,159000,'Enterprise','Active','Insurance leader'],
      ['ThyssenKrupp','Industrial','thyssenkrupp.com','+49-201-844-0','info@tk.com','ThyssenKrupp Allee 1','Essen','NW','Germany',41100000000,96000,'Enterprise','Active','Steel and engineering'],
      ['Continental','Automotive','continental.com','+49-511-938-01','info@conti.com','Vahrenwalder Str 9','Hanover','NI','Germany',39400000000,190000,'Enterprise','Active','Tire and auto parts'],
      ['Henkel','Consumer','henkel.com','+49-211-797-0','info@henkel.com','Henkelstr 67','Dusseldorf','NW','Germany',22400000000,53000,'Enterprise','Active','Consumer brands'],
      ['E.ON','Energy','eon.com','+49-201-184-00','info@eon.com','Bruesseler Platz 1','Essen','NW','Germany',80300000000,72000,'Enterprise','Active','Energy provider'],
      ['Merck','Pharma','merck.com','+49-6151-72-0','info@merck.com','Frankfurter Str 250','Darmstadt','HE','Germany',22200000000,64000,'Enterprise','Active','Science and tech'],
    ]);

    // SEED CONTACTS
    await ins('contacts', ['first_name','last_name','email','phone','mobile','company','job_title','department','address','city','country','status','notes'], [
      ['Klaus','Schmidt','k.schmidt@basf.com','+49-621-601','+49-170-111','BASF','CTO','IT','Carl-Bosch-Str 38','Ludwigshafen','Germany','Active','Key technical contact'],
      ['Anna','Mueller','a.mueller@siemens.com','+49-89-637','+49-171-222','Siemens','VP Sales','Sales','Werner-von-Siemens 1','Munich','Germany','Active','Decision maker'],
      ['Hans','Weber','h.weber@bmw.com','+49-89-383','+49-172-333','BMW','IT Director','IT','Petuelring 130','Munich','Germany','Active','IT procurement lead'],
      ['Maria','Fischer','m.fischer@bosch.com','+49-711-401','+49-173-444','Bosch','Head of Digital','Digital','Robert-Bosch-Platz 1','Stuttgart','Germany','Active','Digital transformation'],
      ['Peter','Wagner','p.wagner@daimler.com','+49-711-172','+49-174-555','Daimler','CFO','Finance','Mercedesstr 120','Stuttgart','Germany','Active','Budget authority'],
      ['Sabine','Becker','s.becker@vw.com','+49-5361-92','+49-175-666','Volkswagen','CIO','IT','Berliner Ring 2','Wolfsburg','Germany','Active','IT strategy lead'],
      ['Thomas','Hoffmann','t.hoffmann@bayer.com','+49-214-302','+49-176-777','Bayer','VP Engineering','Engineering','Kaiser-Wilhelm 1','Leverkusen','Germany','Active','Technical buyer'],
      ['Julia','Richter','j.richter@sap.com','+49-6227-72','+49-177-888','SAP SE','Product Manager','Product','Dietmar-Hopp 16','Walldorf','Germany','Active','Internal champion'],
      ['Michael','Koch','m.koch@db.com','+49-69-911','+49-178-999','Deutsche Bank','CISO','Security','Taunusanlage 12','Frankfurt','Germany','Active','Security focused'],
      ['Laura','Braun','l.braun@allianz.com','+49-89-3801','+49-179-000','Allianz','Director IT','IT','Koeniginstr 28','Munich','Germany','Active','Cloud migration lead'],
      ['Stefan','Zimmermann','s.zimmer@tk.com','+49-201-845','+49-160-111','ThyssenKrupp','VP Operations','Operations','ThyssenKrupp Allee','Essen','Germany','Active','Operations buyer'],
      ['Christina','Krueger','c.krueger@conti.com','+49-511-939','+49-161-222','Continental','Head Procurement','Procurement','Vahrenwalder 9','Hanover','Germany','Active','Procurement lead'],
      ['Frank','Hartmann','f.hartmann@henkel.com','+49-211-798','+49-162-333','Henkel','IT Manager','IT','Henkelstr 67','Dusseldorf','Germany','Active','SAP key user'],
      ['Monika','Werner','m.werner@eon.com','+49-201-185','+49-163-444','E.ON','Digital Lead','Digital','Bruessel Platz 1','Essen','Germany','Active','Digital projects'],
      ['Andreas','Schaefer','a.schaefer@merck.com','+49-6151-73','+49-164-555','Merck','VP Technology','Technology','Frankfurter 250','Darmstadt','Germany','Active','Tech evaluation'],
    ]);

    // SEED LEADS
    await ins('leads', ['first_name','last_name','email','phone','company','job_title','source','qualification','estimated_value','status','notes'], [
      ['James','Thompson','j.thompson@airbus.com','+33-5-6193','Airbus','VP IT','Trade Show','Hot',450000,'Qualified','Met at Hannover Messe'],
      ['Yuki','Tanaka','y.tanaka@toyota.com','+81-565-28','Toyota','CIO','Website','Warm',320000,'New','Downloaded S/4HANA whitepaper'],
      ['Robert','Chen','r.chen@huawei.com','+86-755-2878','Huawei','IT Director','LinkedIn','Hot',580000,'Contacted','Interested in BTP'],
      ['Sophie','Dupont','s.dupont@total.com','+33-1-4744','TotalEnergies','Digital Lead','Webinar','Warm',275000,'Qualified','Attended cloud webinar'],
      ['Marco','Rossi','m.rossi@eni.com','+39-06-5982','ENI','Head of IT','Partner','Hot',390000,'New','Partner referral from Accenture'],
      ['Emily','Johnson','e.johnson@ge.com','+1-617-443','GE','VP Digital','Event','Warm',510000,'Contacted','SAPPHIRE NOW attendee'],
      ['Carlos','Garcia','c.garcia@repsol.com','+34-91-348','Repsol','CTO','SAP Store','Cold',180000,'New','Browsed SAP Store solutions'],
      ['Priya','Sharma','p.sharma@tata.com','+91-22-6665','Tata Group','IT Director','Referral','Hot',620000,'Qualified','Referred by existing customer'],
      ['Henrik','Larsson','h.larsson@volvo.com','+46-31-660','Volvo','CIO','Trade Show','Warm',340000,'Contacted','Automotive summit lead'],
      ['Lisa','Brown','l.brown@3m.com','+1-651-733','3M','VP Operations','Cold Call','Cold',150000,'New','Initial outreach'],
      ['Kenji','Watanabe','k.watanabe@hitachi.com','+81-3-3258','Hitachi','Digital Dir','Website','Warm',410000,'Qualified','Requested demo'],
      ['Elena','Petrov','e.petrov@gazprom.com','+7-495-719','Gazprom','IT Manager','Event','Cold',220000,'New','Energy conference lead'],
      ['David','Wilson','d.wilson@caterpillar.com','+1-309-675','Caterpillar','CIO','LinkedIn','Hot',470000,'Contacted','Active on LinkedIn'],
      ['Aisha','Mohammed','a.mohammed@aramco.com','+966-13-880','Saudi Aramco','VP Tech','Partner','Hot',750000,'Qualified','Strategic partner lead'],
      ['Pierre','Martin','p.martin@michelin.com','+33-4-7332','Michelin','Head Digital','Webinar','Warm',290000,'New','Manufacturing webinar'],
    ]);

    // SEED OPPORTUNITIES
    await ins('opportunities', ['name','account_name','contact_name','amount','phase','probability','close_date','source','competitor','status','notes'], [
      ['S/4HANA Implementation','BASF','Klaus Schmidt',4500000,'Negotiate',80,'2026-04-15','Direct','Oracle','Open','Full ERP transformation'],
      ['SuccessFactors Deployment','Siemens','Anna Mueller',1200000,'Develop',60,'2026-06-30','Partner','Workday','Open','HCM modernization'],
      ['Ariba Procurement Suite','BMW','Hans Weber',890000,'Qualify',40,'2026-08-15','Website','Coupa','Open','Procurement digitization'],
      ['BTP Development Platform','Bosch','Maria Fischer',2100000,'Prove',70,'2026-05-20','Direct','Microsoft Dynamics','Open','Custom app platform'],
      ['Concur Travel Management','Daimler','Peter Wagner',650000,'Identify',20,'2026-09-30','Event','SAP Concur competitor','Open','Travel expense mgmt'],
      ['Analytics Cloud Enterprise','Volkswagen','Sabine Becker',1800000,'Develop',55,'2026-07-15','Referral','Salesforce','Open','BI and analytics'],
      ['Commerce Cloud B2B','Bayer','Thomas Hoffmann',950000,'Qualify',35,'2026-10-01','Website','Adobe Experience','Open','B2B commerce portal'],
      ['Fieldglass VMS','SAP SE','Julia Richter',420000,'Close',95,'2026-03-15','Internal','None','Open','Vendor management'],
      ['IBP Supply Chain','Deutsche Bank','Michael Koch',1500000,'Negotiate',75,'2026-04-30','Direct','Oracle','Open','Supply chain planning'],
      ['Signavio Process Mining','Allianz','Laura Braun',780000,'Develop',50,'2026-08-01','Partner','Celonis','Open','Process optimization'],
      ['SAP Build Low-Code','ThyssenKrupp','Stefan Zimmermann',340000,'Qualify',30,'2026-11-15','Trade Show','Microsoft','Open','Citizen developer platform'],
      ['Datasphere Analytics','Continental','Christina Krueger',1100000,'Prove',65,'2026-06-01','Webinar','Snowflake','Open','Data warehouse modern'],
      ['Business AI Package','Henkel','Frank Hartmann',2800000,'Identify',15,'2026-12-31','LinkedIn','Google Cloud','Open','AI transformation'],
      ['Green Ledger ESG','E.ON','Monika Werner',560000,'Negotiate',85,'2026-03-30','Direct','None','Open','Sustainability reporting'],
      ['Digital Manufacturing','Merck','Andreas Schaefer',1950000,'Develop',45,'2026-09-15','Event','Siemens MOM','Open','Smart factory'],
    ]);

    // SEED QUOTES
    await ins('quotes', ['quote_number','name','account_name','contact_name','amount','discount','tax','total','valid_until','status','notes'], [
      ['QT-2026-001','S/4HANA License + Impl','BASF','Klaus Schmidt',4500000,5.00,855000,5130000,'2026-05-15','Sent','Includes 3yr support'],
      ['QT-2026-002','SuccessFactors HCM','Siemens','Anna Mueller',1200000,8.00,209760,1313760,'2026-07-30','Draft','Employee Experience suite'],
      ['QT-2026-003','Ariba Network','BMW','Hans Weber',890000,3.00,163947,1027347,'2026-09-15','Sent','Procurement network'],
      ['QT-2026-004','BTP Enterprise','Bosch','Maria Fischer',2100000,10.00,358200,2248200,'2026-06-20','Approved','Platform subscription'],
      ['QT-2026-005','Concur Professional','Daimler','Peter Wagner',650000,0.00,123500,773500,'2026-10-30','Draft','Travel and expense'],
      ['QT-2026-006','SAC Enterprise','Volkswagen','Sabine Becker',1800000,7.00,317340,1989540,'2026-08-15','Sent','Analytics bundle'],
      ['QT-2026-007','Commerce B2B','Bayer','Thomas Hoffmann',950000,5.00,171475,1074975,'2026-11-01','Draft','B2B storefront'],
      ['QT-2026-008','Fieldglass VMS','SAP SE','Julia Richter',420000,15.00,67830,425430,'2026-04-15','Approved','Internal deployment'],
      ['QT-2026-009','IBP Advanced','Deutsche Bank','Michael Koch',1500000,5.00,270750,1696500,'2026-05-30','Sent','Supply chain suite'],
      ['QT-2026-010','Signavio Enterprise','Allianz','Laura Braun',780000,3.00,143676,900276,'2026-09-01','Draft','Process intelligence'],
      ['QT-2026-011','Build Apps','ThyssenKrupp','Stefan Zimmermann',340000,0.00,64600,404600,'2026-12-15','Draft','Low-code platform'],
      ['QT-2026-012','Datasphere Pro','Continental','Christina Krueger',1100000,6.00,196020,1232220,'2026-07-01','Sent','Data management'],
      ['QT-2026-013','Business AI Suite','Henkel','Frank Hartmann',2800000,3.00,515760,3231360,'2026-01-31','Draft','AI package'],
      ['QT-2026-014','Green Ledger','E.ON','Monika Werner',560000,0.00,106400,666400,'2026-04-30','Approved','ESG compliance'],
      ['QT-2026-015','Digital Mfg Cloud','Merck','Andreas Schaefer',1950000,5.00,351975,2207475,'2026-10-15','Sent','Manufacturing suite'],
    ]);

    console.log('Sales data seeded');

    // SEED ORDERS
    await ins('orders', ['order_number','account_name','contact_name','amount','tax','total','status','order_date','delivery_date','shipping_address','notes'], [
      ['ORD-2026-001','BASF','Klaus Schmidt',4275000,812250,5087250,'Confirmed','2026-01-10','2026-02-10','Carl-Bosch-Str 38, Ludwigshafen','S/4HANA licenses'],
      ['ORD-2026-002','Siemens','Anna Mueller',1104000,209760,1313760,'Shipped','2025-12-15','2026-01-15','Werner-von-Siemens 1, Munich','SuccessFactors'],
      ['ORD-2026-003','BMW','Hans Weber',863300,163947,1027247,'Confirmed','2026-01-20','2026-03-20','Petuelring 130, Munich','Ariba licenses'],
      ['ORD-2026-004','Bosch','Maria Fischer',1890000,358200,2248200,'Processing','2026-02-01','2026-04-01','Robert-Bosch-Platz 1, Stuttgart','BTP subscription'],
      ['ORD-2026-005','Volkswagen','Sabine Becker',1674000,317340,1991340,'Confirmed','2025-11-20','2025-12-20','Berliner Ring 2, Wolfsburg','SAC Enterprise'],
      ['ORD-2026-006','SAP SE','Julia Richter',357000,67830,424830,'Delivered','2025-10-01','2025-10-15','Dietmar-Hopp 16, Walldorf','Fieldglass VMS'],
      ['ORD-2026-007','Allianz','Laura Braun',756600,143676,900276,'Confirmed','2026-01-05','2026-02-28','Koeniginstr 28, Munich','Signavio'],
      ['ORD-2026-008','E.ON','Monika Werner',560000,106400,666400,'Shipped','2025-12-01','2026-01-01','Bruessel Platz 1, Essen','Green Ledger'],
      ['ORD-2026-009','Deutsche Bank','Michael Koch',1425000,270750,1695750,'Processing','2026-02-10','2026-05-10','Taunusanlage 12, Frankfurt','IBP Advanced'],
      ['ORD-2026-010','Bayer','Thomas Hoffmann',902500,171475,1073975,'Confirmed','2026-01-15','2026-03-15','Kaiser-Wilhelm 1, Leverkusen','Commerce Cloud'],
      ['ORD-2026-011','Continental','Christina Krueger',1034000,196460,1230460,'Delivered','2025-09-15','2025-10-15','Vahrenwalder 9, Hanover','Datasphere'],
      ['ORD-2026-012','Henkel','Frank Hartmann',2716000,515760,3231760,'Processing','2026-02-15','2026-06-15','Henkelstr 67, Dusseldorf','Business AI'],
      ['ORD-2026-013','Merck','Andreas Schaefer',1852500,351975,2204475,'Confirmed','2026-01-25','2026-04-25','Frankfurter 250, Darmstadt','Digital Mfg'],
      ['ORD-2026-014','ThyssenKrupp','Stefan Zimmermann',340000,64600,404600,'Shipped','2025-11-01','2025-12-01','ThyssenKrupp Allee, Essen','Build Apps'],
      ['ORD-2026-015','Daimler','Peter Wagner',650000,123500,773500,'Confirmed','2026-02-05','2026-03-05','Mercedesstr 120, Stuttgart','Concur'],
    ]);

    // SEED CONTRACTS
    await ins('contracts', ['contract_number','name','account_name','contact_name','type','value','start_date','end_date','renewal_date','status','terms','notes'], [
      ['CTR-2026-001','S/4HANA Enterprise Agreement','BASF','Klaus Schmidt','Enterprise',4500000,'2026-01-01','2028-12-31','2028-10-01','Active','3-year term, annual billing','Full ERP'],
      ['CTR-2026-002','SuccessFactors SaaS','Siemens','Anna Mueller','SaaS',1200000,'2026-01-01','2027-12-31','2027-10-01','Active','2-year subscription','HCM suite'],
      ['CTR-2026-003','Ariba Network','BMW','Hans Weber','SaaS',890000,'2025-06-01','2027-05-31','2027-03-01','Active','24 months','Procurement'],
      ['CTR-2026-004','BTP Platform','Bosch','Maria Fischer','Platform',2100000,'2026-03-01','2029-02-28','2028-12-01','Active','3-year commitment','Dev platform'],
      ['CTR-2026-005','Concur Travel','Daimler','Peter Wagner','SaaS',650000,'2025-01-01','2026-12-31','2026-10-01','Active','Per-employee pricing','Travel mgmt'],
      ['CTR-2026-006','Analytics Cloud','Volkswagen','Sabine Becker','SaaS',1800000,'2025-07-01','2027-06-30','2027-04-01','Active','Annual renewal','BI analytics'],
      ['CTR-2026-007','Commerce Cloud','Bayer','Thomas Hoffmann','SaaS',950000,'2026-02-01','2028-01-31','2027-11-01','Active','2-year term','B2B commerce'],
      ['CTR-2026-008','Fieldglass VMS','SAP SE','Julia Richter','Internal',420000,'2025-04-01','2027-03-31','2027-01-01','Active','Internal use','VMS system'],
      ['CTR-2026-009','IBP Supply Chain','Deutsche Bank','Michael Koch','Enterprise',1500000,'2026-01-15','2028-01-14','2027-11-01','Active','3-year','Supply chain'],
      ['CTR-2026-010','Signavio Process','Allianz','Laura Braun','SaaS',780000,'2025-09-01','2027-08-31','2027-06-01','Active','2-year sub','Process mining'],
      ['CTR-2026-011','Build Low-Code','ThyssenKrupp','Stefan Zimmermann','SaaS',340000,'2026-01-01','2026-12-31','2026-10-01','Active','Annual','Low-code'],
      ['CTR-2026-012','Datasphere','Continental','Christina Krueger','SaaS',1100000,'2025-10-01','2027-09-30','2027-07-01','Active','2-year term','Data warehouse'],
      ['CTR-2026-013','Business AI','Henkel','Frank Hartmann','Enterprise',2800000,'2026-04-01','2029-03-31','2028-12-01','Draft','3-year agreement','AI suite'],
      ['CTR-2026-014','Green Ledger','E.ON','Monika Werner','SaaS',560000,'2026-01-01','2027-12-31','2027-10-01','Active','2-year sub','ESG reporting'],
      ['CTR-2026-015','Digital Manufacturing','Merck','Andreas Schaefer','Platform',1950000,'2026-06-01','2029-05-31','2029-03-01','Draft','3-year platform','Smart factory'],
    ]);

    // SEED TICKETS
    await ins('tickets', ['ticket_number','title','contact_name','account_name','priority','category','status','assigned_to','description','resolution'], [
      ['TK-2026-001','S/4HANA login issues','Klaus Schmidt','BASF','High','Authentication','Open','Thomas Weber','Users unable to login after update',null],
      ['TK-2026-002','SuccessFactors sync error','Anna Mueller','Siemens','Critical','Integration','In Progress','Sarah Mueller','Employee data not syncing','Investigating API'],
      ['TK-2026-003','Ariba PO approval stuck','Hans Weber','BMW','Medium','Workflow','Open','Thomas Weber','Purchase orders pending approval',null],
      ['TK-2026-004','BTP deployment failure','Maria Fischer','Bosch','High','Deployment','In Progress','Sarah Mueller','App fails to deploy to CF',null],
      ['TK-2026-005','Concur receipt scanning','Peter Wagner','Daimler','Low','Feature','New','Thomas Weber','OCR not recognizing receipts',null],
      ['TK-2026-006','Analytics slow queries','Sabine Becker','Volkswagen','Medium','Performance','Open','Sarah Mueller','Dashboard taking 30s to load',null],
      ['TK-2026-007','Commerce cart error','Thomas Hoffmann','Bayer','High','Bug','In Progress','Thomas Weber','Cart total not calculating',null],
      ['TK-2026-008','Fieldglass contractor onboard','Julia Richter','SAP SE','Medium','Process','Resolved','Sarah Mueller','Onboarding workflow broken','Fixed workflow config'],
      ['TK-2026-009','IBP forecast mismatch','Michael Koch','Deutsche Bank','High','Data','Open','Thomas Weber','Forecast numbers dont match',null],
      ['TK-2026-010','Signavio export PDF','Laura Braun','Allianz','Low','Feature','New','Sarah Mueller','PDF export missing diagrams',null],
      ['TK-2026-011','Build app crashes','Stefan Zimmermann','ThyssenKrupp','Critical','Bug','In Progress','Thomas Weber','Low-code app crashes on save',null],
      ['TK-2026-012','Datasphere connection','Christina Krueger','Continental','Medium','Integration','Open','Sarah Mueller','HANA connection timeout',null],
      ['TK-2026-013','AI model accuracy','Frank Hartmann','Henkel','Medium','AI','New','Thomas Weber','Prediction accuracy below 70%',null],
      ['TK-2026-014','Green Ledger report','Monika Werner','E.ON','High','Report','In Progress','Sarah Mueller','ESG report data incorrect',null],
      ['TK-2026-015','Manufacturing sensor data','Andreas Schaefer','Merck','Medium','IoT','Open','Thomas Weber','Sensor data gaps in dashboard',null],
    ]);

    // SEED KNOWLEDGE_BASE
    await ins('knowledge_base', ['title','content','category','author','tags','views','rating','status'], [
      ['Getting Started with S/4HANA','Complete guide to S/4HANA setup and configuration for new customers.','ERP','SAP Admin','s4hana,setup,guide',1520,4.8,'Published'],
      ['SuccessFactors Integration Guide','Step-by-step integration with Active Directory and third-party HR systems.','HCM','Sarah Mueller','successfactors,integration,hr',890,4.5,'Published'],
      ['Ariba Network Best Practices','Optimize your procurement workflows with Ariba Network best practices.','Procurement','Thomas Weber','ariba,procurement,bestpractices',650,4.3,'Published'],
      ['BTP Development Tutorial','Build your first application on SAP Business Technology Platform.','Development','SAP Admin','btp,development,tutorial',2100,4.9,'Published'],
      ['Concur Expense Policy Setup','Configure expense policies and approval workflows in SAP Concur.','Travel','Sarah Mueller','concur,expense,policy',430,4.1,'Published'],
      ['Analytics Cloud Dashboard Design','Create compelling dashboards with SAP Analytics Cloud.','Analytics','Thomas Weber','sac,dashboard,analytics',1200,4.7,'Published'],
      ['Commerce Cloud Storefront Setup','Launch your B2B storefront with SAP Commerce Cloud.','Commerce','SAP Admin','commerce,b2b,storefront',780,4.4,'Published'],
      ['Fieldglass Vendor Management','Manage external workforce effectively with SAP Fieldglass.','HR','Sarah Mueller','fieldglass,vendor,workforce',340,4.0,'Published'],
      ['IBP Demand Planning Guide','Configure demand planning scenarios in SAP IBP.','Supply Chain','Thomas Weber','ibp,demand,planning',560,4.6,'Published'],
      ['Signavio Process Mining','Discover process bottlenecks with SAP Signavio Process Mining.','Process','SAP Admin','signavio,process,mining',920,4.8,'Published'],
      ['Build Low-Code Apps','Create business apps without coding using SAP Build.','Development','Sarah Mueller','build,lowcode,apps',1450,4.7,'Published'],
      ['Datasphere Data Modeling','Model your data landscape with SAP Datasphere.','Data','Thomas Weber','datasphere,data,modeling',670,4.3,'Published'],
      ['Business AI Use Cases','Top 10 AI use cases for enterprise transformation.','AI','SAP Admin','ai,usecases,enterprise',2300,4.9,'Published'],
      ['Green Ledger ESG Reporting','Set up sustainability reporting with SAP Green Ledger.','Sustainability','Sarah Mueller','esg,sustainability,reporting',410,4.2,'Published'],
      ['Digital Manufacturing IoT','Connect factory sensors to SAP Digital Manufacturing.','Manufacturing','Thomas Weber','manufacturing,iot,sensors',530,4.5,'Published'],
    ]);

    console.log('Service data seeded');

    // SEED WORK_ORDERS
    await ins('work_orders', ['work_order_number','title','account_name','contact_name','type','priority','status','assigned_to','scheduled_date','completed_date','estimated_hours','description','location'], [
      ['WO-2026-001','S/4HANA Server Migration','BASF','Klaus Schmidt','Migration','High','In Progress','Thomas Weber','2026-03-01',null,120,'Migrate on-prem to cloud','Ludwigshafen DC'],
      ['WO-2026-002','SuccessFactors Config','Siemens','Anna Mueller','Configuration','Medium','New','Sarah Mueller','2026-03-15',null,80,'Configure org structure','Munich Office'],
      ['WO-2026-003','Ariba Catalog Upload','BMW','Hans Weber','Data','Medium','Completed','Thomas Weber','2026-01-15','2026-01-20',40,'Upload product catalog','Munich HQ'],
      ['WO-2026-004','BTP Security Audit','Bosch','Maria Fischer','Audit','High','In Progress','Sarah Mueller','2026-02-20',null,60,'Security compliance check','Stuttgart'],
      ['WO-2026-005','Concur SSO Setup','Daimler','Peter Wagner','Configuration','Medium','New','Thomas Weber','2026-04-01',null,24,'Configure SAML SSO','Stuttgart'],
      ['WO-2026-006','SAC Data Pipeline','Volkswagen','Sabine Becker','Integration','High','In Progress','Sarah Mueller','2026-02-15',null,96,'Set up ETL pipelines','Wolfsburg'],
      ['WO-2026-007','Commerce Storefront','Bayer','Thomas Hoffmann','Development','Medium','New','Thomas Weber','2026-04-15',null,160,'Build B2B storefront','Leverkusen'],
      ['WO-2026-008','Fieldglass Integration','SAP SE','Julia Richter','Integration','Low','Completed','Sarah Mueller','2025-12-01','2025-12-15',32,'HR system integration','Walldorf'],
      ['WO-2026-009','IBP Model Setup','Deutsche Bank','Michael Koch','Configuration','High','In Progress','Thomas Weber','2026-02-25',null,72,'Configure planning models','Frankfurt'],
      ['WO-2026-010','Signavio Workshop','Allianz','Laura Braun','Training','Medium','New','Sarah Mueller','2026-03-20',null,16,'Process mining workshop','Munich'],
      ['WO-2026-011','Build App Training','ThyssenKrupp','Stefan Zimmermann','Training','Low','New','Thomas Weber','2026-05-01',null,24,'Low-code developer training','Essen'],
      ['WO-2026-012','Datasphere Migration','Continental','Christina Krueger','Migration','High','In Progress','Sarah Mueller','2026-02-10',null,88,'Migrate data warehouse','Hanover'],
      ['WO-2026-013','AI Model Training','Henkel','Frank Hartmann','Development','Medium','New','Thomas Weber','2026-05-15',null,120,'Train custom AI models','Dusseldorf'],
      ['WO-2026-014','Green Ledger Setup','E.ON','Monika Werner','Configuration','Medium','Completed','Sarah Mueller','2026-01-05','2026-01-25',48,'ESG reporting config','Essen'],
      ['WO-2026-015','MES Integration','Merck','Andreas Schaefer','Integration','High','New','Thomas Weber','2026-06-01',null,140,'Connect MES to SAP DM','Darmstadt'],
    ]);

    // SEED SLA_POLICIES
    await ins('sla_policies', ['name','description','entity_type','priority','response_time_hours','resolution_time_hours','escalation_time_hours','status','applicable_to'], [
      ['Critical SLA','For critical production issues','Ticket','Critical',1,4,2,'Active','All Enterprise'],
      ['High Priority SLA','High priority issues','Ticket','High',2,8,4,'Active','All Enterprise'],
      ['Medium Priority SLA','Standard support','Ticket','Medium',4,24,12,'Active','All Customers'],
      ['Low Priority SLA','Non-urgent requests','Ticket','Low',8,48,24,'Active','All Customers'],
      ['Enterprise Gold','Premium enterprise support','Account','Critical',1,2,1,'Active','Gold Tier'],
      ['Enterprise Silver','Standard enterprise support','Account','High',2,12,6,'Active','Silver Tier'],
      ['Cloud SLA','Cloud service availability','Service','High',1,4,2,'Active','Cloud Customers'],
      ['On-Premise SLA','On-premise support','Service','Medium',4,24,8,'Active','On-Prem Customers'],
      ['Integration SLA','Integration issue resolution','Integration','High',2,16,8,'Active','All Integration'],
      ['Security SLA','Security incident response','Security','Critical',1,2,1,'Active','All Customers'],
      ['Performance SLA','Performance degradation','Performance','High',1,8,4,'Active','Enterprise'],
      ['Feature Request SLA','New feature requests','Feature','Low',24,720,168,'Active','All Customers'],
      ['Data Migration SLA','Data migration support','Migration','Medium',4,48,24,'Active','Migration Projects'],
      ['Training SLA','Training support requests','Training','Low',8,72,48,'Active','Training Customers'],
      ['Consulting SLA','Consulting engagement support','Consulting','Medium',4,24,12,'Active','Consulting Projects'],
    ]);

    // SEED CAMPAIGNS
    await ins('campaigns', ['name','type','channel','status','start_date','end_date','budget','actual_cost','expected_revenue','target_audience','description'], [
      ['S/4HANA Cloud Launch','Product Launch','Multi-channel','Active','2026-01-15','2026-04-15',500000,320000,5000000,'Enterprise CIOs','Major cloud ERP campaign'],
      ['SAPPHIRE NOW 2026','Event','Event','Planned','2026-05-10','2026-05-13',2000000,0,15000000,'All Segments','Annual customer conference'],
      ['BTP Developer Week','Webinar','Digital','Active','2026-02-01','2026-02-07',150000,95000,800000,'Developers','Developer enablement week'],
      ['AI Innovation Summit','Event','Hybrid','Planned','2026-06-20','2026-06-21',800000,0,6000000,'C-Level','AI transformation summit'],
      ['SME Digital Package','Demand Gen','Email','Active','2026-01-01','2026-06-30',250000,180000,2500000,'SME','Small business digital pack'],
      ['Green Ledger Campaign','Awareness','Social Media','Active','2026-02-15','2026-05-15',200000,120000,1500000,'Sustainability Leaders','ESG solution awareness'],
      ['SuccessFactors Webinar','Webinar','Digital','Completed','2025-11-15','2025-11-15',50000,48000,400000,'HR Leaders','HCM modernization webinar'],
      ['Partner Co-Marketing','Partner','Multi-channel','Active','2026-01-01','2026-12-31',1000000,250000,8000000,'Partner Customers','Joint partner campaigns'],
      ['Industry 4.0 Series','Content','Digital','Active','2026-02-01','2026-08-31',300000,100000,3000000,'Manufacturing','Manufacturing content series'],
      ['Ariba Network Growth','Demand Gen','Email','Active','2026-03-01','2026-09-30',180000,0,1200000,'Procurement','Procurement network expansion'],
      ['Customer Success Stories','Content','Multi-channel','Active','2026-01-01','2026-12-31',120000,45000,0,'All Segments','Customer testimonials'],
      ['Cloud Migration Promo','Promotion','Direct','Active','2026-01-15','2026-03-31',350000,280000,4000000,'On-Prem Customers','Migration incentive'],
      ['Analytics Bootcamp','Training','Hybrid','Planned','2026-04-01','2026-04-05',100000,0,600000,'Data Analysts','Analytics training event'],
      ['Year-End Push','Sales','Multi-channel','Planned','2026-10-01','2026-12-31',400000,0,10000000,'All Enterprise','Q4 sales acceleration'],
      ['Retail Summit','Event','Event','Planned','2026-09-15','2026-09-16',600000,0,4000000,'Retail','Retail industry summit'],
    ]);

    // SEED EMAIL_TEMPLATES
    await ins('email_templates', ['name','subject','body','category','type','status','created_by','usage_count'], [
      ['Welcome Email','Welcome to SAP CRM','Dear {name}, Welcome to SAP CRM. Your account has been set up.','Onboarding','Automated','Active','SAP Admin',1250],
      ['Quote Follow-up','Your SAP Quote - {quote_number}','Dear {name}, Following up on your recent quote...','Sales','Manual','Active','Sarah Mueller',890],
      ['Demo Invitation','SAP Product Demo Invitation','Join us for a live demo of {product}...','Marketing','Automated','Active','SAP Admin',2100],
      ['Renewal Reminder','Contract Renewal Reminder','Your contract {contract} expires on {date}...','Service','Automated','Active','Sarah Mueller',560],
      ['Ticket Update','Ticket {ticket_number} Update','Your support ticket has been updated...','Support','Automated','Active','Thomas Weber',3400],
      ['Monthly Newsletter','SAP CRM Monthly Update','Here are the latest updates from SAP CRM...','Marketing','Automated','Active','SAP Admin',4200],
      ['Event Invite','You are invited to {event}','Register now for {event} on {date}...','Events','Manual','Active','Sarah Mueller',780],
      ['NPS Survey','How was your experience?','Please rate your recent experience with SAP...','Survey','Automated','Active','Thomas Weber',1900],
      ['Win-Back','We miss you at SAP','It has been a while since your last login...','Retention','Automated','Draft','SAP Admin',120],
      ['Upsell Offer','Upgrade to SAP Enterprise','Unlock premium features with our enterprise plan...','Sales','Manual','Active','Sarah Mueller',340],
      ['Training Invite','SAP Training Enrollment','Enroll in our upcoming training session...','Training','Automated','Active','Thomas Weber',650],
      ['Payment Receipt','Payment Confirmation - {amount}','Thank you for your payment of {amount}...','Finance','Automated','Active','SAP Admin',2800],
      ['Feature Announcement','New Feature: {feature}','We are excited to announce {feature}...','Product','Automated','Active','Sarah Mueller',1100],
      ['Onboarding Checklist','Your SAP Onboarding Checklist','Complete these steps to get started...','Onboarding','Automated','Active','Thomas Weber',890],
      ['Case Study','Customer Success: {company}','Learn how {company} transformed with SAP...','Marketing','Manual','Draft','SAP Admin',210],
    ]);

    // SEED CUSTOMER_SEGMENTS
    await ins('customer_segments', ['name','description','criteria','member_count','type','status','created_by','last_evaluated'], [
      ['Enterprise DACH','Large enterprises in Germany, Austria, Switzerland','revenue > 10B AND country IN (DE,AT,CH)',45,'Geographic','Active','SAP Admin','2026-02-01'],
      ['Mid-Market EU','Mid-size European companies','revenue BETWEEN 100M AND 10B AND region=EU',230,'Size','Active','Sarah Mueller','2026-02-01'],
      ['Cloud-First','Customers preferring cloud solutions','deployment=cloud AND satisfaction > 4',180,'Behavioral','Active','Thomas Weber','2026-01-15'],
      ['Manufacturing','Manufacturing industry customers','industry=Manufacturing',120,'Industry','Active','SAP Admin','2026-02-01'],
      ['Financial Services','Banking and insurance','industry IN (Banking,Insurance)',85,'Industry','Active','Sarah Mueller','2026-01-20'],
      ['High Value','Top revenue customers','annual_spend > 1M',35,'Value','Active','Thomas Weber','2026-02-10'],
      ['At Risk','Customers with declining engagement','login_frequency < 2/month AND tickets > 5',28,'Behavioral','Active','SAP Admin','2026-02-15'],
      ['New Customers','Onboarded in last 90 days','created_date > NOW()-90d',42,'Lifecycle','Active','Sarah Mueller','2026-02-01'],
      ['Automotive','Automotive industry segment','industry=Automotive',65,'Industry','Active','Thomas Weber','2026-01-25'],
      ['Asia Pacific','APJ region customers','region=APJ',150,'Geographic','Active','SAP Admin','2026-02-01'],
      ['S/4HANA Users','Active S/4HANA customers','product=S4HANA AND status=Active',95,'Product','Active','Sarah Mueller','2026-02-05'],
      ['Multi-Product','Using 3+ SAP products','product_count >= 3',78,'Behavioral','Active','Thomas Weber','2026-02-01'],
      ['Sustainability Focus','ESG-focused customers','has_green_ledger=true OR sustainability_score>7',55,'Interest','Active','SAP Admin','2026-01-30'],
      ['Partner Managed','Managed by SI partners','managed_by=Partner',110,'Channel','Active','Sarah Mueller','2026-02-01'],
      ['Expansion Ready','Ready for upsell','satisfaction>4 AND usage>80pct AND product_count<3',62,'Opportunity','Active','Thomas Weber','2026-02-10'],
    ]);

    console.log('Marketing data seeded');

    // SEED PRODUCTS
    await ins('products', ['name','material_number','category','price','cost','quantity_in_stock','unit','description','status'], [
      ['SAP S/4HANA Cloud','MAT-001','ERP',250000,80000,999,'License','Intelligent cloud ERP for enterprise','Active'],
      ['SAP SuccessFactors','MAT-002','HCM',85000,25000,999,'License','Cloud human capital management','Active'],
      ['SAP Ariba','MAT-003','Procurement',120000,40000,999,'License','Intelligent procurement network','Active'],
      ['SAP BTP','MAT-004','Platform',180000,55000,999,'License','Business Technology Platform','Active'],
      ['SAP Concur','MAT-005','Travel',45000,15000,999,'License','Travel and expense management','Active'],
      ['SAP Fieldglass','MAT-006','HR',65000,20000,999,'License','External workforce management','Active'],
      ['SAP Analytics Cloud','MAT-007','Analytics',95000,30000,999,'License','Business intelligence and planning','Active'],
      ['SAP Commerce Cloud','MAT-008','Commerce',140000,45000,999,'License','Omnichannel commerce platform','Active'],
      ['SAP IBP','MAT-009','Supply Chain',160000,50000,999,'License','Integrated business planning','Active'],
      ['SAP Signavio','MAT-010','Process',75000,22000,999,'License','Process transformation suite','Active'],
      ['SAP Build','MAT-011','Development',55000,18000,999,'License','Low-code application development','Active'],
      ['SAP Datasphere','MAT-012','Data',110000,35000,999,'License','Business data fabric','Active'],
      ['SAP Business AI','MAT-013','AI',200000,65000,999,'License','Enterprise AI solutions','Active'],
      ['SAP Green Ledger','MAT-014','Sustainability',70000,22000,999,'License','Carbon accounting and ESG','Active'],
      ['SAP Digital Manufacturing','MAT-015','Manufacturing',175000,55000,999,'License','Industry 4.0 manufacturing','Active'],
    ]);

    // SEED PRICE_LISTS
    await ins('price_lists', ['name','description','currency','effective_date','expiry_date','discount_percent','type','status'], [
      ['Enterprise EUR 2026','Standard enterprise pricing in EUR','EUR','2026-01-01','2026-12-31',0.00,'Standard','Active'],
      ['Enterprise USD 2026','Standard enterprise pricing in USD','USD','2026-01-01','2026-12-31',0.00,'Standard','Active'],
      ['Mid-Market EUR','Mid-market discounted pricing','EUR','2026-01-01','2026-12-31',15.00,'Discount','Active'],
      ['Mid-Market USD','Mid-market discounted pricing','USD','2026-01-01','2026-12-31',15.00,'Discount','Active'],
      ['Partner Pricing','Partner reseller pricing','EUR','2026-01-01','2026-12-31',25.00,'Partner','Active'],
      ['Academic License','Education institution pricing','EUR','2026-01-01','2026-12-31',50.00,'Academic','Active'],
      ['Startup Package','Startup special pricing','EUR','2026-01-01','2026-12-31',40.00,'Special','Active'],
      ['Government Pricing','Government and public sector','EUR','2026-01-01','2026-12-31',20.00,'Government','Active'],
      ['Volume Tier 1','100-500 users volume discount','EUR','2026-01-01','2026-12-31',10.00,'Volume','Active'],
      ['Volume Tier 2','500-2000 users volume discount','EUR','2026-01-01','2026-12-31',18.00,'Volume','Active'],
      ['Volume Tier 3','2000+ users volume discount','EUR','2026-01-01','2026-12-31',25.00,'Volume','Active'],
      ['Promo Q1 2026','Q1 promotional pricing','EUR','2026-01-01','2026-03-31',20.00,'Promotional','Active'],
      ['APAC Pricing','Asia Pacific regional pricing','USD','2026-01-01','2026-12-31',5.00,'Regional','Active'],
      ['LATAM Pricing','Latin America regional pricing','USD','2026-01-01','2026-12-31',12.00,'Regional','Active'],
      ['Legacy Renewal','Legacy customer renewal rates','EUR','2026-01-01','2026-12-31',8.00,'Renewal','Active'],
    ]);

    // SEED INVOICES
    await ins('invoices', ['invoice_number','account_name','contact_name','amount','tax','total','status','due_date','paid_date','payment_terms','notes'], [
      ['INV-2026-001','BASF','Klaus Schmidt',4275000,812250,5087250,'Paid','2026-02-10','2026-02-05','Net 30','S/4HANA annual license'],
      ['INV-2026-002','Siemens','Anna Mueller',1104000,209760,1313760,'Paid','2026-01-15','2026-01-12','Net 30','SuccessFactors subscription'],
      ['INV-2026-003','BMW','Hans Weber',863300,163947,1027247,'Pending','2026-03-20',null,'Net 45','Ariba Network license'],
      ['INV-2026-004','Bosch','Maria Fischer',1890000,358200,2248200,'Pending','2026-04-01',null,'Net 30','BTP platform subscription'],
      ['INV-2026-005','Daimler','Peter Wagner',650000,123500,773500,'Overdue','2026-01-31',null,'Net 30','Concur annual license'],
      ['INV-2026-006','Volkswagen','Sabine Becker',1674000,317340,1991340,'Paid','2025-12-20','2025-12-18','Net 30','SAC Enterprise'],
      ['INV-2026-007','Bayer','Thomas Hoffmann',902500,171475,1073975,'Pending','2026-03-15',null,'Net 45','Commerce Cloud'],
      ['INV-2026-008','SAP SE','Julia Richter',357000,67830,424830,'Paid','2025-10-31','2025-10-28','Net 15','Fieldglass internal'],
      ['INV-2026-009','Deutsche Bank','Michael Koch',1425000,270750,1695750,'Pending','2026-05-10',null,'Net 60','IBP Advanced'],
      ['INV-2026-010','Allianz','Laura Braun',756600,143676,900276,'Paid','2026-01-31','2026-01-28','Net 30','Signavio Process'],
      ['INV-2026-011','ThyssenKrupp','Stefan Zimmermann',340000,64600,404600,'Pending','2026-03-01',null,'Net 30','Build Apps'],
      ['INV-2026-012','Continental','Christina Krueger',1034000,196460,1230460,'Paid','2025-10-15','2025-10-14','Net 30','Datasphere'],
      ['INV-2026-013','Henkel','Frank Hartmann',2716000,515760,3231760,'Draft','2026-06-15',null,'Net 45','Business AI suite'],
      ['INV-2026-014','E.ON','Monika Werner',560000,106400,666400,'Paid','2026-01-31','2026-01-25','Net 30','Green Ledger'],
      ['INV-2026-015','Merck','Andreas Schaefer',1852500,351975,2204475,'Pending','2026-04-25',null,'Net 45','Digital Manufacturing'],
    ]);

    // SEED PAYMENTS
    await ins('payments', ['payment_number','account_name','invoice_number','amount','payment_method','payment_date','reference','status','notes'], [
      ['PAY-2026-001','BASF','INV-2026-001',5087250,'Wire Transfer','2026-02-05','WT-BASF-2026-001','Completed','Full payment received'],
      ['PAY-2026-002','Siemens','INV-2026-002',1313760,'Wire Transfer','2026-01-12','WT-SIE-2026-001','Completed','Annual subscription'],
      ['PAY-2026-003','Volkswagen','INV-2026-006',1991340,'Wire Transfer','2025-12-18','WT-VW-2025-012','Completed','SAC payment'],
      ['PAY-2026-004','SAP SE','INV-2026-008',424830,'Internal','2025-10-28','INT-SAP-2025-010','Completed','Internal transfer'],
      ['PAY-2026-005','Allianz','INV-2026-010',900276,'Wire Transfer','2026-01-28','WT-ALZ-2026-001','Completed','Signavio payment'],
      ['PAY-2026-006','Continental','INV-2026-012',1230460,'Wire Transfer','2025-10-14','WT-CON-2025-010','Completed','Datasphere payment'],
      ['PAY-2026-007','E.ON','INV-2026-014',666400,'Wire Transfer','2026-01-25','WT-EON-2026-001','Completed','Green Ledger payment'],
      ['PAY-2026-008','BASF','INV-2026-001',2543625,'Wire Transfer','2026-01-15','WT-BASF-2026-P1','Completed','Partial payment 1'],
      ['PAY-2026-009','BMW','INV-2026-003',500000,'Wire Transfer','2026-02-20','WT-BMW-2026-P1','Processing','Partial payment'],
      ['PAY-2026-010','Bosch','INV-2026-004',1000000,'Wire Transfer','2026-02-28','WT-BOS-2026-P1','Processing','Installment 1'],
      ['PAY-2026-011','Deutsche Bank','INV-2026-009',847875,'Wire Transfer','2026-03-01','WT-DB-2026-P1','Processing','50% upfront'],
      ['PAY-2026-012','Daimler','INV-2026-005',773500,'Check','2026-02-15','CHK-DAI-2026-001','Pending','Late payment'],
      ['PAY-2026-013','Bayer','INV-2026-007',536987,'Wire Transfer','2026-02-18','WT-BAY-2026-P1','Processing','Partial payment'],
      ['PAY-2026-014','ThyssenKrupp','INV-2026-011',404600,'Wire Transfer','2026-02-25','WT-TK-2026-001','Processing','Full payment'],
      ['PAY-2026-015','Merck','INV-2026-015',1102237,'Wire Transfer','2026-03-05','WT-MER-2026-P1','Processing','50% upfront'],
    ]);

    // SEED EXPENSE_REPORTS
    await ins('expense_reports', ['report_number','employee_name','department','purpose','total_amount','category','status','submitted_date','approved_by','approved_date','notes'], [
      ['EXP-2026-001','Sarah Mueller','Sales','BASF customer visit',2450,'Travel','Approved','2026-01-15','SAP Admin','2026-01-16','Flight and hotel Munich-Ludwigshafen'],
      ['EXP-2026-002','Thomas Weber','Engineering','BTP training Berlin',1800,'Training','Approved','2026-01-20','Sarah Mueller','2026-01-21','3-day developer training'],
      ['EXP-2026-003','Sarah Mueller','Sales','SAPPHIRE NOW prep',5200,'Event','Submitted','2026-02-10',null,null,'Pre-event planning travel'],
      ['EXP-2026-004','Thomas Weber','Engineering','Merck on-site support',980,'Travel','Approved','2026-02-01','Sarah Mueller','2026-02-02','Day trip to Darmstadt'],
      ['EXP-2026-005','SAP Admin','Management','Executive retreat',3500,'Entertainment','Submitted','2026-02-12',null,null,'Team building event'],
      ['EXP-2026-006','Sarah Mueller','Sales','Siemens deal dinner',450,'Entertainment','Approved','2026-01-25','SAP Admin','2026-01-26','Client dinner Munich'],
      ['EXP-2026-007','Thomas Weber','Engineering','Hardware purchase',1200,'Equipment','Draft','2026-02-15',null,null,'Development laptop accessories'],
      ['EXP-2026-008','Sarah Mueller','Sales','BMW proposal meeting',1650,'Travel','Approved','2026-02-05','SAP Admin','2026-02-06','2-day Munich trip'],
      ['EXP-2026-009','Thomas Weber','Engineering','Cloud certification',800,'Training','Submitted','2026-02-08',null,null,'BTP certification exam'],
      ['EXP-2026-010','SAP Admin','Management','Q1 planning offsite',4200,'Travel','Approved','2026-01-10','SAP Admin','2026-01-10','Management offsite Berlin'],
      ['EXP-2026-011','Sarah Mueller','Sales','VW factory tour',1100,'Travel','Approved','2026-01-28','SAP Admin','2026-01-29','Wolfsburg visit'],
      ['EXP-2026-012','Thomas Weber','Engineering','Conference attendance',2800,'Conference','Submitted','2026-02-14',null,null,'Tech conference Berlin'],
      ['EXP-2026-013','Sarah Mueller','Sales','Client gifts Q1',750,'Entertainment','Draft','2026-02-18',null,null,'Quarterly client gifts'],
      ['EXP-2026-014','Thomas Weber','Engineering','Office supplies',320,'Supplies','Approved','2026-02-02','Sarah Mueller','2026-02-03','Monitors and cables'],
      ['EXP-2026-015','SAP Admin','Management','Recruitment dinner',680,'Entertainment','Submitted','2026-02-16',null,null,'Executive candidate dinner'],
    ]);

    console.log('Finance data seeded');

    // SEED EMPLOYEES
    await ins('employees', ['first_name','last_name','email','phone','department','position','manager','hire_date','salary','office_location','status','skills'], [
      ['Marcus','Hoffmann','m.hoffmann@sapcrm.com','+49-6227-7001','Engineering','VP Engineering','SAP Admin','2018-03-15',145000,'Walldorf','Active','Java,ABAP,Cloud Architecture'],
      ['Lisa','Braun','l.braun@sapcrm.com','+49-6227-7002','Sales','Sales Director','SAP Admin','2019-06-01',125000,'Walldorf','Active','Enterprise Sales,Negotiation'],
      ['Felix','Wagner','f.wagner@sapcrm.com','+49-89-7003','Engineering','Senior Developer','Marcus Hoffmann','2020-01-10',95000,'Munich','Active','JavaScript,React,Node.js'],
      ['Sophie','Klein','s.klein@sapcrm.com','+1-650-7004','Sales','Account Executive','Lisa Braun','2020-08-15',105000,'Palo Alto','Active','SaaS Sales,CRM'],
      ['Jan','Becker','j.becker@sapcrm.com','+353-1-7005','Engineering','Cloud Architect','Marcus Hoffmann','2019-11-01',110000,'Dublin','Active','AWS,Azure,Kubernetes'],
      ['Nina','Schmidt','n.schmidt@sapcrm.com','+65-7006','Marketing','Marketing Manager','SAP Admin','2021-02-01',88000,'Singapore','Active','Digital Marketing,Analytics'],
      ['Oliver','Fischer','o.fischer@sapcrm.com','+55-11-7007','Service','Support Lead','SAP Admin','2020-05-20',82000,'Sao Paulo','Active','ITSM,Support Management'],
      ['Emma','Richter','e.richter@sapcrm.com','+81-3-7008','Engineering','QA Engineer','Marcus Hoffmann','2021-07-15',78000,'Tokyo','Active','Testing,Automation,Selenium'],
      ['Raj','Patel','r.patel@sapcrm.com','+91-80-7009','Engineering','Developer','Marcus Hoffmann','2022-01-10',65000,'Mumbai','Active','Python,Machine Learning,AI'],
      ['David','Miller','d.miller@sapcrm.com','+1-212-7010','Finance','Finance Manager','SAP Admin','2019-09-01',115000,'New York','Active','Financial Planning,SAP FI'],
      ['Charlotte','Weber','c.weber@sapcrm.com','+44-20-7011','HR','HR Director','SAP Admin','2020-03-15',105000,'London','Active','Talent Management,SuccessFactors'],
      ['Liam','OBrien','l.obrien@sapcrm.com','+61-2-7012','Sales','Regional Manager','Lisa Braun','2021-04-01',98000,'Sydney','Active','Channel Sales,Partnerships'],
      ['Yuki','Sato','y.sato@sapcrm.com','+81-3-7013','Engineering','Data Engineer','Marcus Hoffmann','2022-06-01',85000,'Tokyo','Active','HANA,Datasphere,SQL'],
      ['Anna','Kowalski','a.kowalski@sapcrm.com','+49-6227-7014','Product','Product Manager','SAP Admin','2021-09-15',92000,'Walldorf','Active','Product Strategy,Agile'],
      ['Carlos','Santos','c.santos@sapcrm.com','+55-11-7015','Service','Technical Consultant','Oliver Fischer','2022-03-01',72000,'Sao Paulo','Active','S/4HANA,ABAP,Fiori'],
    ]);

    // SEED DEPARTMENTS
    await ins('departments', ['name','code','manager','parent_department','employee_count','budget','location','phone','email','status','description'], [
      ['Engineering','ENG','Marcus Hoffmann',null,450,25000000,'Walldorf','+49-6227-8001','eng@sapcrm.com','Active','Software development and architecture'],
      ['Sales','SAL','Lisa Braun',null,320,18000000,'Walldorf','+49-6227-8002','sales@sapcrm.com','Active','Global sales organization'],
      ['Marketing','MKT','Nina Schmidt',null,150,12000000,'Walldorf','+49-6227-8003','marketing@sapcrm.com','Active','Global marketing'],
      ['Service','SVC','Oliver Fischer',null,280,15000000,'Walldorf','+49-6227-8004','service@sapcrm.com','Active','Customer service and support'],
      ['Finance','FIN','David Miller',null,85,5000000,'New York','+1-212-8005','finance@sapcrm.com','Active','Financial operations'],
      ['HR','HRD','Charlotte Weber',null,65,4000000,'London','+44-20-8006','hr@sapcrm.com','Active','Human resources'],
      ['Product','PRD','Anna Kowalski',null,120,8000000,'Walldorf','+49-6227-8007','product@sapcrm.com','Active','Product management'],
      ['Cloud Operations','COP','Jan Becker','Engineering',95,10000000,'Dublin','+353-1-8008','cloudops@sapcrm.com','Active','Cloud infrastructure'],
      ['AI & Innovation','AIR','Raj Patel','Engineering',45,6000000,'Mumbai','+91-80-8009','ai@sapcrm.com','Active','AI research and development'],
      ['Enterprise Sales','ESA','Sophie Klein','Sales',180,12000000,'Palo Alto','+1-650-8010','enterprise@sapcrm.com','Active','Enterprise customer sales'],
      ['Partner Sales','PSA','Liam OBrien','Sales',85,5000000,'Sydney','+61-2-8011','partners@sapcrm.com','Active','Partner channel sales'],
      ['Digital Marketing','DMK','Nina Schmidt','Marketing',60,5000000,'Singapore','+65-8012','digital@sapcrm.com','Active','Digital campaigns'],
      ['Technical Support','TSP','Carlos Santos','Service',150,8000000,'Sao Paulo','+55-11-8013','support@sapcrm.com','Active','Technical customer support'],
      ['Quality Assurance','QAD','Emma Richter','Engineering',55,3000000,'Tokyo','+81-3-8014','qa@sapcrm.com','Active','Software quality assurance'],
      ['Data Engineering','DEN','Yuki Sato','Engineering',40,4000000,'Tokyo','+81-3-8015','data@sapcrm.com','Active','Data platform engineering'],
    ]);

    // SEED PERFORMANCE_REVIEWS
    await ins('performance_reviews', ['employee_name','reviewer','review_period','overall_rating','goals_rating','skills_rating','communication_rating','status','strengths','improvements','review_date'], [
      ['Marcus Hoffmann','SAP Admin','H2 2025',4.5,4.8,4.5,4.2,'Completed','Strong technical leadership, excellent architecture decisions','Delegate more to team leads','2026-01-15'],
      ['Lisa Braun','SAP Admin','H2 2025',4.7,4.9,4.5,4.8,'Completed','Exceeded sales targets by 23%, great client relationships','Focus on pipeline diversity','2026-01-15'],
      ['Felix Wagner','Marcus Hoffmann','H2 2025',4.2,4.0,4.5,4.0,'Completed','Excellent coding skills, fast learner','Improve documentation habits','2026-01-20'],
      ['Sophie Klein','Lisa Braun','H2 2025',4.8,5.0,4.5,4.8,'Completed','Top performer, closed 3 enterprise deals','Mentor junior sales reps','2026-01-20'],
      ['Jan Becker','Marcus Hoffmann','H2 2025',4.3,4.2,4.5,4.0,'Completed','Cloud migration expertise, reliable delivery','Present more in team meetings','2026-01-22'],
      ['Nina Schmidt','SAP Admin','H2 2025',4.0,3.8,4.2,4.0,'Completed','Creative campaigns, good analytics usage','Improve budget tracking','2026-01-22'],
      ['Oliver Fischer','SAP Admin','H2 2025',4.4,4.5,4.2,4.5,'Completed','Customer satisfaction improved 15%','Reduce average resolution time','2026-01-25'],
      ['Emma Richter','Marcus Hoffmann','H2 2025',4.1,4.0,4.2,4.0,'Completed','Thorough testing, good automation coverage','Learn performance testing','2026-01-25'],
      ['Raj Patel','Marcus Hoffmann','H2 2025',4.6,4.5,4.8,4.2,'Completed','Innovative AI solutions, published 2 papers','Improve project estimation','2026-01-28'],
      ['David Miller','SAP Admin','H2 2025',4.3,4.5,4.0,4.2,'Completed','Accurate forecasting, good cost controls','Adopt more automation','2026-01-28'],
      ['Charlotte Weber','SAP Admin','H2 2025',4.5,4.5,4.5,4.5,'Completed','Strong talent pipeline, improved retention','Expand global HR programs','2026-01-30'],
      ['Liam OBrien','Lisa Braun','H2 2025',4.0,3.8,4.0,4.2,'Completed','Good partner relationships, regional growth','Increase deal size','2026-01-30'],
      ['Yuki Sato','Marcus Hoffmann','H2 2025',4.4,4.2,4.8,3.8,'Completed','Excellent data platform work','Improve English communication','2026-02-01'],
      ['Anna Kowalski','SAP Admin','H2 2025',4.2,4.0,4.2,4.5,'Completed','Good product vision and roadmap','More competitive analysis','2026-02-01'],
      ['Carlos Santos','Oliver Fischer','H2 2025',3.9,3.8,4.0,4.0,'Draft','Good technical skills, customer focused','Get BTP certification','2026-02-05'],
    ]);

    // SEED LEAVE_REQUESTS
    await ins('leave_requests', ['employee_name','leave_type','start_date','end_date','days_requested','reason','status','approved_by'], [
      ['Felix Wagner','Annual Leave','2026-03-15','2026-03-22',5.0,'Family vacation','Approved','Marcus Hoffmann'],
      ['Sophie Klein','Annual Leave','2026-04-01','2026-04-12',8.0,'Spring holiday','Approved','Lisa Braun'],
      ['Jan Becker','Sick Leave','2026-02-10','2026-02-11',2.0,'Flu','Approved','Marcus Hoffmann'],
      ['Nina Schmidt','Annual Leave','2026-05-20','2026-05-30',7.0,'Travel to Japan','Pending',null],
      ['Oliver Fischer','Parental Leave','2026-06-01','2026-08-31',65.0,'Paternity leave','Approved','SAP Admin'],
      ['Emma Richter','Annual Leave','2026-03-01','2026-03-05',3.0,'Personal time','Approved','Marcus Hoffmann'],
      ['Raj Patel','Annual Leave','2026-04-14','2026-04-18',5.0,'Diwali celebration','Pending',null],
      ['David Miller','Sick Leave','2026-01-20','2026-01-21',2.0,'Medical appointment','Approved','SAP Admin'],
      ['Charlotte Weber','Annual Leave','2026-07-01','2026-07-14',10.0,'Summer holiday','Pending',null],
      ['Liam OBrien','Annual Leave','2026-03-10','2026-03-14',5.0,'Surfing trip','Approved','Lisa Braun'],
      ['Marcus Hoffmann','Annual Leave','2026-08-01','2026-08-15',11.0,'Summer break','Pending',null],
      ['Lisa Braun','Sick Leave','2026-02-05','2026-02-05',1.0,'Migraine','Approved','SAP Admin'],
      ['Yuki Sato','Annual Leave','2026-05-01','2026-05-06',4.0,'Golden Week','Approved','Marcus Hoffmann'],
      ['Carlos Santos','Annual Leave','2026-02-28','2026-03-04',3.0,'Carnival','Approved','Oliver Fischer'],
      ['Anna Kowalski','Study Leave','2026-04-20','2026-04-24',5.0,'MBA exam preparation','Pending',null],
    ]);

    // SEED TRAINING_COURSES
    await ins('training_courses', ['name','description','category','instructor','duration_hours','max_participants','enrolled','start_date','end_date','format','status'], [
      ['S/4HANA Fundamentals','Core ERP concepts and S/4HANA architecture','ERP','Marcus Hoffmann',40,30,28,'2026-03-01','2026-03-05','Classroom','Scheduled'],
      ['BTP Developer Bootcamp','Build apps on SAP Business Technology Platform','Development','Felix Wagner',24,25,22,'2026-03-15','2026-03-17','Hybrid','Scheduled'],
      ['Cloud Architecture','Designing scalable cloud solutions','Architecture','Jan Becker',16,20,18,'2026-04-01','2026-04-02','Virtual','Scheduled'],
      ['Sales Excellence','Advanced enterprise selling techniques','Sales','Lisa Braun',8,40,35,'2026-03-10','2026-03-10','Classroom','Scheduled'],
      ['Machine Learning with SAP','AI and ML capabilities in SAP ecosystem','AI','Raj Patel',32,20,20,'2026-04-15','2026-04-18','Hybrid','Scheduled'],
      ['Fiori UX Design','SAP Fiori design principles and implementation','UX','Emma Richter',16,25,15,'2026-05-01','2026-05-02','Virtual','Scheduled'],
      ['ABAP for Cloud','Modern ABAP development for cloud','Development','Carlos Santos',40,20,12,'2026-05-15','2026-05-19','Classroom','Scheduled'],
      ['Data Engineering with HANA','SAP HANA data modeling and optimization','Data','Yuki Sato',24,15,14,'2026-04-10','2026-04-12','Hybrid','Scheduled'],
      ['Leadership Development','Management and leadership skills','Management','Charlotte Weber',16,30,25,'2026-03-20','2026-03-21','Classroom','Scheduled'],
      ['Financial Reporting','SAP FI/CO reporting and analysis','Finance','David Miller',16,20,16,'2026-04-05','2026-04-06','Virtual','Scheduled'],
      ['Agile Product Management','Agile methodologies for product teams','Product','Anna Kowalski',8,25,20,'2026-03-25','2026-03-25','Virtual','Scheduled'],
      ['Customer Success Workshop','Best practices for customer engagement','Service','Oliver Fischer',8,35,30,'2026-04-20','2026-04-20','Classroom','Scheduled'],
      ['Digital Marketing Analytics','Data-driven marketing strategies','Marketing','Nina Schmidt',16,20,18,'2026-05-10','2026-05-11','Hybrid','Scheduled'],
      ['Security Fundamentals','Cloud security and compliance','Security','Jan Becker',8,30,22,'2026-06-01','2026-06-01','Virtual','Scheduled'],
      ['Process Mining with Signavio','Business process analysis and optimization','Process','Anna Kowalski',16,20,10,'2026-06-15','2026-06-16','Hybrid','Scheduled'],
    ]);

    console.log('HR data seeded');

    // SEED PROJECTS
    await ins('projects', ['name','description','account_name','manager','priority','status','start_date','end_date','budget','actual_cost','progress'], [
      ['BASF S/4HANA Migration','Full ERP migration to S/4HANA Cloud','BASF','Marcus Hoffmann','High','In Progress','2026-01-15','2026-12-31',4500000,1200000,25],
      ['Siemens HCM Rollout','SuccessFactors global deployment','Siemens','Lisa Braun','High','In Progress','2026-02-01','2026-09-30',1200000,300000,15],
      ['BMW Procurement Digital','Ariba implementation and integration','BMW','Felix Wagner','Medium','Planning','2026-04-01','2026-10-31',890000,0,0],
      ['Bosch BTP Platform','Custom app development on BTP','Bosch','Jan Becker','High','In Progress','2026-03-01','2026-11-30',2100000,450000,20],
      ['VW Analytics Dashboard','SAC enterprise analytics deployment','Volkswagen','Yuki Sato','Medium','In Progress','2025-12-01','2026-06-30',1800000,900000,55],
      ['Allianz Process Mining','Signavio process optimization initiative','Allianz','Anna Kowalski','Medium','Planning','2026-03-15','2026-08-31',780000,0,0],
      ['Deutsche Bank IBP','Supply chain planning implementation','Deutsche Bank','Marcus Hoffmann','High','In Progress','2026-02-15','2026-10-31',1500000,200000,10],
      ['E.ON ESG Reporting','Green Ledger implementation','E.ON','David Miller','Medium','In Progress','2026-01-01','2026-05-31',560000,280000,50],
      ['Merck Smart Factory','Digital Manufacturing deployment','Merck','Felix Wagner','High','Planning','2026-06-01','2027-05-31',1950000,0,0],
      ['Henkel AI Initiative','Business AI suite deployment','Henkel','Raj Patel','High','Planning','2026-04-01','2027-03-31',2800000,0,0],
      ['Continental Data Platform','Datasphere implementation','Continental','Yuki Sato','Medium','Completed','2025-06-01','2025-12-31',1100000,1050000,100],
      ['SAP Internal VMS','Fieldglass internal deployment','SAP SE','Oliver Fischer','Low','Completed','2025-04-01','2025-09-30',420000,390000,100],
      ['ThyssenKrupp Low-Code','SAP Build citizen developer program','ThyssenKrupp','Emma Richter','Low','In Progress','2026-01-15','2026-06-30',340000,85000,30],
      ['Bayer Commerce Portal','B2B commerce storefront build','Bayer','Carlos Santos','Medium','Planning','2026-04-15','2026-12-31',950000,0,0],
      ['Daimler Travel Mgmt','Concur rollout across divisions','Daimler','Nina Schmidt','Low','In Progress','2025-12-01','2026-04-30',650000,400000,65],
    ]);

    // SEED TASKS
    await ins('tasks', ['title','description','project_name','assigned_to','priority','status','due_date','estimated_hours','actual_hours','category'], [
      ['BASF data migration assessment','Assess current data landscape for migration','BASF S/4HANA Migration','Felix Wagner','High','Completed','2026-02-15',80,72,'Data'],
      ['BASF system architecture design','Design target S/4HANA architecture','BASF S/4HANA Migration','Jan Becker','High','In Progress','2026-03-15',120,45,'Architecture'],
      ['Siemens org structure mapping','Map organizational hierarchy for SF','Siemens HCM Rollout','Charlotte Weber','Medium','In Progress','2026-03-01',40,20,'Configuration'],
      ['Siemens SSO integration','Configure SAML SSO for SuccessFactors','Siemens HCM Rollout','Jan Becker','High','Not Started','2026-04-01',24,0,'Integration'],
      ['BMW supplier onboarding plan','Plan supplier migration to Ariba','BMW Procurement Digital','Sophie Klein','Medium','Not Started','2026-04-15',60,0,'Planning'],
      ['Bosch BTP dev environment','Set up BTP development environment','Bosch BTP Platform','Felix Wagner','High','Completed','2026-03-15',16,14,'Setup'],
      ['VW dashboard prototype','Create executive dashboard prototype','VW Analytics Dashboard','Yuki Sato','Medium','Completed','2026-01-15',40,38,'Development'],
      ['VW data pipeline setup','Configure ETL pipelines for SAC','VW Analytics Dashboard','Raj Patel','High','In Progress','2026-03-01',80,55,'Data'],
      ['DB forecast model config','Configure IBP forecast models','Deutsche Bank IBP','Marcus Hoffmann','High','In Progress','2026-03-15',60,15,'Configuration'],
      ['E.ON carbon data import','Import historical carbon emission data','E.ON ESG Reporting','David Miller','Medium','Completed','2026-02-01',32,30,'Data'],
      ['E.ON report templates','Create ESG report templates','E.ON ESG Reporting','Anna Kowalski','Medium','In Progress','2026-03-15',24,12,'Design'],
      ['TK citizen dev training','Train ThyssenKrupp citizen developers','ThyssenKrupp Low-Code','Emma Richter','Low','In Progress','2026-03-31',40,15,'Training'],
      ['Daimler expense policy config','Configure expense policies in Concur','Daimler Travel Mgmt','Nina Schmidt','Medium','Completed','2026-01-15',16,16,'Configuration'],
      ['Daimler approval workflow','Set up multi-level approval flows','Daimler Travel Mgmt','Oliver Fischer','Medium','In Progress','2026-02-28',24,18,'Workflow'],
      ['Henkel AI use case workshop','Workshop to identify AI use cases','Henkel AI Initiative','Raj Patel','High','Not Started','2026-04-15',16,0,'Planning'],
    ]);

    // SEED ACTIVITIES
    await ins('activities', ['type','subject','description','regarding','assigned_to','status','priority','start_date','end_date','location'], [
      ['Meeting','BASF Kickoff Meeting','Project kickoff with BASF stakeholders','BASF S/4HANA Migration','Marcus Hoffmann','Completed','High','2026-01-15 09:00','2026-01-15 12:00','Ludwigshafen'],
      ['Call','Siemens Weekly Sync','Weekly project status call','Siemens HCM Rollout','Lisa Braun','Completed','Normal','2026-02-18 14:00','2026-02-18 15:00','Virtual'],
      ['Email','BMW Proposal Sent','Sent detailed proposal to BMW procurement','BMW Procurement Digital','Sophie Klein','Completed','Normal','2026-02-10 10:00','2026-02-10 10:30','Virtual'],
      ['Meeting','Bosch Architecture Review','Technical architecture review session','Bosch BTP Platform','Jan Becker','Planned','High','2026-03-05 10:00','2026-03-05 16:00','Stuttgart'],
      ['Demo','VW Dashboard Demo','Executive dashboard demonstration','VW Analytics Dashboard','Yuki Sato','Completed','High','2026-02-01 11:00','2026-02-01 12:00','Wolfsburg'],
      ['Call','Allianz Discovery Call','Initial discovery for process mining','Allianz Process Mining','Anna Kowalski','Completed','Normal','2026-02-05 09:00','2026-02-05 10:00','Virtual'],
      ['Meeting','DB Planning Workshop','IBP planning workshop with DB team','Deutsche Bank IBP','Marcus Hoffmann','Planned','High','2026-03-10 09:00','2026-03-10 17:00','Frankfurt'],
      ['Task','E.ON Data Validation','Validate imported ESG data','E.ON ESG Reporting','David Miller','In Progress','Normal','2026-02-15 08:00','2026-02-15 17:00','Essen'],
      ['Meeting','Merck Factory Tour','Smart factory assessment tour','Merck Smart Factory','Felix Wagner','Planned','High','2026-05-15 09:00','2026-05-15 17:00','Darmstadt'],
      ['Call','Henkel AI Strategy','Discuss AI transformation strategy','Henkel AI Initiative','Raj Patel','Planned','High','2026-03-20 15:00','2026-03-20 16:00','Virtual'],
      ['Demo','TK Build Demo','Low-code platform capabilities demo','ThyssenKrupp Low-Code','Emma Richter','Completed','Normal','2026-02-01 14:00','2026-02-01 15:30','Essen'],
      ['Email','Bayer Commerce RFP','Sent RFP response for commerce project','Bayer Commerce Portal','Carlos Santos','Completed','Normal','2026-02-08 09:00','2026-02-08 09:30','Virtual'],
      ['Meeting','Daimler Go-Live Review','Pre-go-live readiness review','Daimler Travel Mgmt','Nina Schmidt','Planned','High','2026-03-15 10:00','2026-03-15 12:00','Stuttgart'],
      ['Call','Continental Support Review','Quarterly support review','Continental Data Platform','Oliver Fischer','Planned','Normal','2026-03-01 11:00','2026-03-01 12:00','Virtual'],
      ['Meeting','Quarterly Business Review','Internal QBR with leadership','Internal','SAP Admin','Planned','High','2026-03-28 09:00','2026-03-28 17:00','Walldorf'],
    ]);

    // SEED GOALS
    await ins('goals', ['name','owner','type','target_value','actual_value','start_date','end_date','status','progress','notes'], [
      ['Q1 Revenue Target','Lisa Braun','Revenue',15000000,8500000,'2026-01-01','2026-03-31','In Progress',57,'Strong pipeline building'],
      ['New Logo Acquisition','Sophie Klein','Sales',10,6,'2026-01-01','2026-06-30','In Progress',60,'6 new enterprise logos'],
      ['Customer Satisfaction Score','Oliver Fischer','Service',4.5,4.3,'2026-01-01','2026-12-31','In Progress',86,'NPS improving steadily'],
      ['Cloud Migration Revenue','Marcus Hoffmann','Revenue',20000000,5000000,'2026-01-01','2026-12-31','In Progress',25,'Major migrations in pipeline'],
      ['Marketing Qualified Leads','Nina Schmidt','Marketing',500,180,'2026-01-01','2026-06-30','In Progress',36,'Digital campaigns ramping'],
      ['Employee Retention','Charlotte Weber','HR',95,97,'2026-01-01','2026-12-31','In Progress',100,'Above target retention'],
      ['Partner Revenue','Liam OBrien','Revenue',8000000,2100000,'2026-01-01','2026-12-31','In Progress',26,'Partner program growing'],
      ['AI Product Adoption','Raj Patel','Product',50,12,'2026-01-01','2026-12-31','In Progress',24,'12 customers using AI'],
      ['Cost Optimization','David Miller','Finance',2000000,800000,'2026-01-01','2026-12-31','In Progress',40,'Operational savings'],
      ['Training Completion Rate','Charlotte Weber','HR',90,72,'2026-01-01','2026-06-30','In Progress',80,'On track for target'],
      ['BTP Platform Growth','Jan Becker','Product',100,35,'2026-01-01','2026-12-31','In Progress',35,'35 apps on BTP'],
      ['ESG Customer Target','David Miller','Sales',30,8,'2026-01-01','2026-12-31','In Progress',27,'Green Ledger adoption'],
      ['Support Ticket Resolution','Oliver Fischer','Service',85,82,'2026-01-01','2026-12-31','In Progress',96,'Within SLA resolution pct'],
      ['Product NPS Score','Anna Kowalski','Product',50,42,'2026-01-01','2026-12-31','In Progress',84,'Product satisfaction high'],
      ['Regional Expansion APAC','Nina Schmidt','Growth',5000000,1200000,'2026-01-01','2026-12-31','In Progress',24,'APAC market growing'],
    ]);

    console.log('Operations data seeded');

    // SEED VENDORS
    await ins('vendors', ['name','contact_name','email','phone','website','address','city','country','category','payment_terms','rating','status','notes'], [
      ['Accenture','John Smith','j.smith@accenture.com','+1-312-693','accenture.com','161 N Clark St','Chicago','USA','Consulting','Net 45',4.5,'Active','Global SI partner'],
      ['Deloitte','Emma Davis','e.davis@deloitte.com','+1-212-492','deloitte.com','30 Rockefeller Plaza','New York','USA','Consulting','Net 45',4.3,'Active','Advisory partner'],
      ['Capgemini','Pierre Duval','p.duval@capgemini.com','+33-1-4767','capgemini.com','11 Rue de Tilsitt','Paris','France','Consulting','Net 30',4.2,'Active','European SI partner'],
      ['AWS','Sarah Johnson','s.johnson@aws.com','+1-206-266','aws.amazon.com','440 Terry Ave N','Seattle','USA','Cloud','Net 30',4.7,'Active','Cloud infrastructure'],
      ['Microsoft Azure','Tom Williams','t.williams@microsoft.com','+1-425-882','azure.microsoft.com','One Microsoft Way','Redmond','USA','Cloud','Net 30',4.5,'Active','Cloud platform'],
      ['Google Cloud','Lisa Chen','l.chen@google.com','+1-650-253','cloud.google.com','1600 Amphitheatre Pkwy','Mountain View','USA','Cloud','Net 30',4.4,'Active','Cloud and AI'],
      ['Informatica','Raj Kumar','r.kumar@informatica.com','+1-650-385','informatica.com','2100 Seaport Blvd','Redwood City','USA','Data','Net 30',4.1,'Active','Data integration'],
      ['Celonis','Alex Rinke','a.rinke@celonis.com','+49-89-416','celonis.com','Theresienstr 6','Munich','Germany','Analytics','Net 30',4.6,'Active','Process mining tech'],
      ['UiPath','Daniel Dines','d.dines@uipath.com','+1-844-432','uipath.com','90 Park Ave','New York','USA','Automation','Net 30',4.3,'Active','RPA platform'],
      ['Snowflake','Frank Slootman','f.slootman@snowflake.com','+1-650-380','snowflake.com','106 E Babcock St','Bozeman','USA','Data','Net 30',4.5,'Active','Data cloud'],
      ['PwC','James Brown','j.brown@pwc.com','+44-20-7583','pwc.com','1 Embankment Pl','London','UK','Consulting','Net 45',4.2,'Active','Audit and advisory'],
      ['TCS','Rajesh Gopinathan','r.gopi@tcs.com','+91-22-6778','tcs.com','9th Floor Nirmal','Mumbai','India','Consulting','Net 30',4.0,'Active','IT services'],
      ['Wipro','Thierry Delaporte','t.dela@wipro.com','+91-80-2844','wipro.com','Doddakannelli','Bangalore','India','Consulting','Net 30',3.9,'Active','Technology services'],
      ['IBM','Arvind Krishna','a.krishna@ibm.com','+1-914-499','ibm.com','1 New Orchard Rd','Armonk','USA','Technology','Net 45',4.1,'Active','Hybrid cloud and AI'],
      ['ServiceNow','Bill McDermott','b.mcdermott@snow.com','+1-408-501','servicenow.com','2225 Lawson Ln','Santa Clara','USA','Platform','Net 30',4.4,'Active','Workflow platform'],
    ]);

    // SEED TERRITORIES
    await ins('territories', ['name','region','manager','description','target_revenue','actual_revenue','account_count','status'], [
      ['DACH','Europe','Lisa Braun','Germany, Austria, Switzerland',25000000,12500000,45,'Active'],
      ['EMEA North','Europe','Liam OBrien','UK, Ireland, Nordics',18000000,8200000,35,'Active'],
      ['EMEA South','Europe','Sophie Klein','France, Spain, Italy, Portugal',15000000,6800000,28,'Active'],
      ['North America East','Americas','David Miller','Eastern US and Canada',22000000,10500000,40,'Active'],
      ['North America West','Americas','Sophie Klein','Western US and Canada',20000000,9800000,38,'Active'],
      ['Greater China','APJ','Nina Schmidt','China, Hong Kong, Taiwan',16000000,5500000,25,'Active'],
      ['Japan','APJ','Yuki Sato','Japan market',12000000,4800000,20,'Active'],
      ['Korea','APJ','Nina Schmidt','South Korea market',8000000,3200000,15,'Active'],
      ['India','APJ','Raj Patel','India and Sri Lanka',10000000,4100000,22,'Active'],
      ['Southeast Asia','APJ','Nina Schmidt','ASEAN countries',9000000,3500000,18,'Active'],
      ['LATAM','Americas','Carlos Santos','Latin America',11000000,4200000,20,'Active'],
      ['Middle East','MEA','Liam OBrien','GCC and Middle East',14000000,5800000,18,'Active'],
      ['Africa','MEA','Liam OBrien','Sub-Saharan Africa',5000000,1800000,12,'Active'],
      ['ANZ','APJ','Liam OBrien','Australia and New Zealand',8000000,3600000,15,'Active'],
      ['Nordics','Europe','Charlotte Weber','Sweden, Norway, Denmark, Finland',7000000,3100000,14,'Active'],
    ]);

    // SEED COMPETITORS
    await ins('competitors', ['name','website','industry','strengths','weaknesses','market_share','threat_level','notes','status'], [
      ['Oracle','oracle.com','Enterprise Software','Strong database, large install base','Complex pricing, slow cloud transition',12.5,'High','Primary ERP competitor','Active'],
      ['Salesforce','salesforce.com','CRM','Market leader in CRM, strong ecosystem','Expensive, limited ERP capability',19.8,'High','CRM market leader','Active'],
      ['Microsoft Dynamics','dynamics.microsoft.com','Enterprise Software','Office 365 integration, Azure synergy','Less mature ERP, fragmented products',8.2,'High','Growing fast in mid-market','Active'],
      ['Workday','workday.com','HCM/Finance','Modern cloud HCM, user-friendly','Limited ERP scope, North America focused',5.5,'Medium','Strong in HCM space','Active'],
      ['ServiceNow','servicenow.com','IT Service','Excellent ITSM, workflow platform','Limited financial capabilities',4.8,'Medium','Expanding beyond IT','Active'],
      ['Infor','infor.com','Enterprise Software','Industry-specific solutions','Smaller market presence, Koch owned',3.2,'Medium','Industry verticals focus','Active'],
      ['IFS','ifs.com','Enterprise Software','Strong in asset management, field service','Limited global presence',1.8,'Low','Niche competitor','Active'],
      ['Epicor','epicor.com','Manufacturing ERP','Manufacturing focused, good mid-market','Limited enterprise scale',1.5,'Low','Manufacturing niche','Active'],
      ['Sage','sage.com','SME Software','Strong SME presence, accounting','Limited enterprise capability',2.8,'Low','SME segment only','Active'],
      ['NetSuite','netsuite.com','Cloud ERP','First cloud ERP, Oracle backed','Mid-market only, less customizable',3.5,'Medium','Oracle subsidiary','Active'],
      ['HubSpot','hubspot.com','CRM/Marketing','Excellent marketing automation, free tier','Not enterprise-grade, limited ERP',2.1,'Low','SME CRM competitor','Active'],
      ['Zoho','zoho.com','Business Software','Affordable, broad suite','Not enterprise-ready, limited support',1.2,'Low','Price competitor','Active'],
      ['Pega','pega.com','BPM/CRM','Strong process automation, AI','Complex implementation, niche market',1.0,'Low','Process automation niche','Active'],
      ['Adobe Experience','adobe.com','Marketing/Commerce','Best-in-class marketing tools','No ERP, expensive licensing',4.2,'Medium','Commerce and marketing','Active'],
      ['Coupa','coupa.com','Procurement','Leading procurement platform','Limited scope beyond procurement',2.0,'Medium','Procurement competitor','Active'],
    ]);

    // SEED FORECASTS
    await ins('forecasts', ['name','period','owner','target_amount','best_case','committed','pipeline','closed','status','notes'], [
      ['Q1 2026 DACH','Q1 2026','Lisa Braun',8000000,9500000,6200000,12000000,4500000,'Open','Strong BASF and Siemens deals'],
      ['Q1 2026 Americas','Q1 2026','Sophie Klein',6000000,7200000,4800000,9500000,3200000,'Open','BMW and Daimler pipeline'],
      ['Q1 2026 APJ','Q1 2026','Nina Schmidt',4000000,5000000,2800000,7000000,1800000,'Open','Growing APAC demand'],
      ['Q2 2026 DACH','Q2 2026','Lisa Braun',9000000,11000000,5500000,15000000,0,'Open','Major renewals due'],
      ['Q2 2026 Americas','Q2 2026','Sophie Klein',7000000,8500000,4200000,11000000,0,'Open','Enterprise pipeline strong'],
      ['Q2 2026 APJ','Q2 2026','Nina Schmidt',5000000,6500000,3000000,8500000,0,'Open','Expanding partner channel'],
      ['H1 2026 Cloud Revenue','H1 2026','Marcus Hoffmann',20000000,24000000,14000000,32000000,6300000,'Open','Cloud transition accelerating'],
      ['H1 2026 AI Revenue','H1 2026','Raj Patel',5000000,7000000,2500000,10000000,800000,'Open','Early AI adoption phase'],
      ['FY 2026 Total','FY 2026','SAP Admin',80000000,100000000,45000000,120000000,9500000,'Open','Annual company target'],
      ['FY 2026 Services','FY 2026','Oliver Fischer',15000000,18000000,8000000,22000000,3200000,'Open','Professional services'],
      ['Q1 2026 Partner','Q1 2026','Liam OBrien',3000000,3800000,2200000,5000000,1500000,'Open','Partner co-sell deals'],
      ['Q1 2026 Renewals','Q1 2026','Lisa Braun',12000000,12500000,11000000,13000000,9800000,'Open','High renewal rates'],
      ['FY 2026 Mid-Market','FY 2026','Sophie Klein',25000000,30000000,12000000,40000000,4200000,'Open','Mid-market expansion'],
      ['FY 2026 Manufacturing','FY 2026','Marcus Hoffmann',18000000,22000000,8000000,28000000,3100000,'Open','Industry 4.0 demand'],
      ['FY 2026 Sustainability','FY 2026','David Miller',8000000,10000000,4000000,15000000,1200000,'Open','ESG market growing'],
    ]);

    // SEED AUDIT_LOGS
    await ins('audit_logs', ['action','entity_type','entity_id','user_name','changes','ip_address','details'], [
      ['CREATE','Account',1,'SAP Admin','Created account BASF','192.168.1.1','Initial seed data'],
      ['UPDATE','Opportunity',1,'Sarah Mueller','Updated phase to Negotiate','192.168.1.2','Phase changed from Develop'],
      ['CREATE','Ticket',1,'Thomas Weber','Created ticket TK-2026-001','192.168.1.3','BASF login issue reported'],
      ['LOGIN','User',1,'SAP Admin','User logged in','192.168.1.1','Successful authentication'],
      ['UPDATE','Contract',5,'Sarah Mueller','Updated status to Active','192.168.1.2','Contract activated'],
      ['DELETE','Lead',16,'SAP Admin','Deleted duplicate lead','192.168.1.1','Duplicate removal'],
      ['CREATE','Quote',1,'Thomas Weber','Created quote QT-2026-001','192.168.1.3','BASF S/4HANA quote'],
      ['UPDATE','Employee',3,'Charlotte Weber','Updated salary','192.168.1.4','Annual salary review'],
      ['CREATE','Campaign',1,'Nina Schmidt','Created S/4HANA Cloud Launch','192.168.1.5','Q1 campaign'],
      ['UPDATE','Project',1,'Marcus Hoffmann','Updated progress to 25%','192.168.1.6','Monthly progress update'],
      ['LOGIN','User',2,'Sarah Mueller','User logged in','192.168.1.2','Successful authentication'],
      ['CREATE','Invoice',1,'David Miller','Created invoice INV-2026-001','192.168.1.7','BASF license invoice'],
      ['UPDATE','Ticket',2,'Sarah Mueller','Updated status to In Progress','192.168.1.2','Started investigation'],
      ['CREATE','Activity',1,'Marcus Hoffmann','Created BASF kickoff meeting','192.168.1.6','Project kickoff scheduled'],
      ['EXPORT','Report',0,'SAP Admin','Exported Q1 sales report','192.168.1.1','PDF export'],
    ]);

    // SEED NOTIFICATIONS
    await ins('notifications', ['title','message','type','recipient','priority','status','link'], [
      ['New Deal Closed','BASF S/4HANA deal worth $4.5M has been closed','Deal','SAP Admin','High','Unread','/opportunities/1'],
      ['Ticket Escalation','Ticket TK-2026-011 has been escalated to Critical','Alert','Sarah Mueller','Critical','Unread','/tickets/11'],
      ['Contract Renewal Due','Daimler contract expires in 60 days','Reminder','Lisa Braun','Medium','Unread','/contracts/5'],
      ['New Lead Assigned','Hot lead from Saudi Aramco assigned to you','Lead','Sophie Klein','High','Unread','/leads/14'],
      ['Invoice Overdue','Daimler invoice INV-2026-005 is 21 days overdue','Alert','David Miller','High','Read','/invoices/5'],
      ['Training Enrollment','You are enrolled in BTP Developer Bootcamp','Info','Felix Wagner','Normal','Read','/training_courses/2'],
      ['Leave Approved','Your annual leave has been approved','Info','Felix Wagner','Normal','Read','/leave_requests/1'],
      ['Performance Review Due','H2 2025 review for Carlos Santos is pending','Reminder','Oliver Fischer','Medium','Unread','/performance_reviews/15'],
      ['Campaign Launched','S/4HANA Cloud Launch campaign is now active','Info','Nina Schmidt','Normal','Read','/campaigns/1'],
      ['Budget Alert','Engineering Q1 budget at 85% utilization','Alert','Marcus Hoffmann','Medium','Unread','/departments/1'],
      ['New Quote Created','Quote QT-2026-013 created for Henkel','Info','Sarah Mueller','Normal','Unread','/quotes/13'],
      ['SLA Breach Warning','Ticket TK-2026-001 approaching SLA breach','Alert','Thomas Weber','High','Unread','/tickets/1'],
      ['Payment Received','Payment of $5.08M received from BASF','Finance','David Miller','Normal','Read','/payments/1'],
      ['Project Milestone','VW Analytics Dashboard reached 55% completion','Info','Yuki Sato','Normal','Unread','/projects/5'],
      ['System Maintenance','Scheduled maintenance window: March 1, 2-4 AM CET','System','SAP Admin','Normal','Unread','/notifications'],
    ]);

    // ===== SEED NEW ERP MODULES =====

    // SEED GENERAL_LEDGER
    await ins('general_ledger', ['doc_number','posting_date','account','description','debit_amount','credit_amount','company_code','fiscal_year','currency','status'], [
      ['GL-2026-001','2026-01-05','400000','Revenue - Product Sales',0,4500000,'1000','2026','EUR','Posted'],
      ['GL-2026-002','2026-01-05','110000','Accounts Receivable',4500000,0,'1000','2026','EUR','Posted'],
      ['GL-2026-003','2026-01-10','600000','Cost of Goods Sold',1200000,0,'1000','2026','EUR','Posted'],
      ['GL-2026-004','2026-01-10','300000','Inventory',0,1200000,'1000','2026','EUR','Posted'],
      ['GL-2026-005','2026-01-15','500000','Salary Expense',850000,0,'1000','2026','EUR','Posted'],
      ['GL-2026-006','2026-01-15','100000','Bank - Main Account',0,850000,'1000','2026','EUR','Posted'],
      ['GL-2026-007','2026-01-20','620000','Depreciation Expense',125000,0,'1000','2026','EUR','Posted'],
      ['GL-2026-008','2026-01-20','210000','Accumulated Depreciation',0,125000,'1000','2026','EUR','Posted'],
      ['GL-2026-009','2026-01-25','400100','Revenue - Services',0,780000,'1000','2026','EUR','Posted'],
      ['GL-2026-010','2026-01-25','110000','Accounts Receivable',780000,0,'1000','2026','EUR','Posted'],
      ['GL-2026-011','2026-02-01','510000','Rent Expense',95000,0,'1000','2026','EUR','Posted'],
      ['GL-2026-012','2026-02-01','100000','Bank - Main Account',0,95000,'1000','2026','EUR','Posted'],
      ['GL-2026-013','2026-02-05','520000','Marketing Expense',320000,0,'2000','2026','EUR','Posted'],
      ['GL-2026-014','2026-02-10','400000','Revenue - Product Sales',0,2100000,'2000','2026','USD','Posted'],
      ['GL-2026-015','2026-02-15','530000','Travel Expense',45000,0,'1000','2026','EUR','Parked'],
    ]);

    // SEED ACCOUNTS_PAYABLE
    await ins('accounts_payable', ['invoice_number','vendor_name','amount','tax','total','due_date','payment_status','payment_date','payment_method','days_overdue','notes'], [
      ['AP-2026-001','Accenture',850000,161500,1011500,'2026-02-15','Paid','2026-02-10','Wire',0,'Consulting services Q1'],
      ['AP-2026-002','AWS',125000,23750,148750,'2026-02-28','Paid','2026-02-25','Wire',0,'Cloud infrastructure Jan'],
      ['AP-2026-003','Deloitte',420000,79800,499800,'2026-03-15','Open',null,'Wire',0,'Advisory services'],
      ['AP-2026-004','Microsoft Azure',95000,18050,113050,'2026-03-01','Paid','2026-02-28','ACH',0,'Azure services'],
      ['AP-2026-005','Google Cloud',78000,14820,92820,'2026-03-10','Open',null,'Wire',0,'GCP compute'],
      ['AP-2026-006','Informatica',65000,12350,77350,'2026-02-20','Overdue',null,'Wire',8,'Data integration license'],
      ['AP-2026-007','Celonis',180000,34200,214200,'2026-04-01','Open',null,'Wire',0,'Process mining annual'],
      ['AP-2026-008','UiPath',45000,8550,53550,'2026-03-20','Open',null,'SEPA',0,'RPA licenses'],
      ['AP-2026-009','TCS',320000,60800,380800,'2026-02-28','Partially Paid','2026-02-15','Wire',0,'IT services'],
      ['AP-2026-010','Snowflake',110000,20900,130900,'2026-03-31','Open',null,'Wire',0,'Data cloud'],
      ['AP-2026-011','PwC',250000,47500,297500,'2026-04-15','Open',null,'Wire',0,'Audit services'],
      ['AP-2026-012','IBM',185000,35150,220150,'2026-03-15','Open',null,'Wire',0,'Hybrid cloud'],
      ['AP-2026-013','ServiceNow',92000,17480,109480,'2026-02-28','Paid','2026-02-27','ACH',0,'ITSM licenses'],
      ['AP-2026-014','Wipro',145000,27550,172550,'2026-03-31','Open',null,'Wire',0,'Development services'],
      ['AP-2026-015','Capgemini',380000,72200,452200,'2026-04-30','Open',null,'Wire',0,'SI project phase 2'],
    ]);

    // SEED ACCOUNTS_RECEIVABLE
    await ins('accounts_receivable', ['invoice_number','customer_name','amount','tax','total','due_date','payment_status','collection_date','dunning_level','days_outstanding','notes'], [
      ['AR-2026-001','BASF',4275000,812250,5087250,'2026-02-10','Paid','2026-02-05','None',0,'S/4HANA license'],
      ['AR-2026-002','Siemens',1104000,209760,1313760,'2026-01-15','Paid','2026-01-12','None',0,'SuccessFactors'],
      ['AR-2026-003','BMW',863300,163947,1027247,'2026-03-20','Open',null,'None',0,'Ariba Network'],
      ['AR-2026-004','Bosch',1890000,358200,2248200,'2026-04-01','Open',null,'None',0,'BTP platform'],
      ['AR-2026-005','Daimler',650000,123500,773500,'2026-01-31','Overdue',null,'Level 2',22,'Concur license'],
      ['AR-2026-006','Volkswagen',1674000,317340,1991340,'2025-12-20','Paid','2025-12-18','None',0,'SAC Enterprise'],
      ['AR-2026-007','Bayer',902500,171475,1073975,'2026-03-15','Open',null,'None',0,'Commerce Cloud'],
      ['AR-2026-008','Deutsche Bank',1425000,270750,1695750,'2026-05-10','Open',null,'None',0,'IBP Advanced'],
      ['AR-2026-009','Allianz',756600,143676,900276,'2026-01-31','Paid','2026-01-28','None',0,'Signavio'],
      ['AR-2026-010','ThyssenKrupp',340000,64600,404600,'2026-03-01','Open',null,'None',0,'Build Apps'],
      ['AR-2026-011','Continental',1034000,196460,1230460,'2025-10-15','Paid','2025-10-14','None',0,'Datasphere'],
      ['AR-2026-012','Henkel',2716000,515760,3231760,'2026-06-15','Open',null,'None',0,'Business AI'],
      ['AR-2026-013','E.ON',560000,106400,666400,'2026-01-31','Paid','2026-01-25','None',0,'Green Ledger'],
      ['AR-2026-014','Merck',1852500,351975,2204475,'2026-04-25','Open',null,'None',0,'Digital Mfg'],
      ['AR-2026-015','SAP SE',357000,67830,424830,'2025-10-31','Paid','2025-10-28','None',0,'Fieldglass'],
    ]);

    // SEED ASSET_ACCOUNTING
    await ins('asset_accounting', ['asset_number','description','asset_class','acquisition_date','acquisition_value','accumulated_depreciation','book_value','useful_life_years','depreciation_method','location','status'], [
      ['AST-001','Walldorf HQ Building','Buildings','2015-01-01',45000000,13500000,31500000,30,'Straight-Line','Walldorf','Active'],
      ['AST-002','Munich Office Building','Buildings','2018-06-01',28000000,5600000,22400000,30,'Straight-Line','Munich','Active'],
      ['AST-003','Data Center Servers','IT Equipment','2023-01-15',8500000,2833333,5666667,3,'Straight-Line','Walldorf DC','Active'],
      ['AST-004','Production Line Alpha','Machinery','2020-03-01',12000000,4800000,7200000,10,'Declining Balance','Stuttgart','Active'],
      ['AST-005','Company Vehicle Fleet','Vehicles','2024-01-01',2400000,480000,1920000,5,'Straight-Line','Various','Active'],
      ['AST-006','Office Furniture Set','Furniture','2022-07-01',1200000,342857,857143,7,'Straight-Line','Walldorf','Active'],
      ['AST-007','SAP License IP','Intangible','2020-01-01',15000000,7500000,7500000,10,'Straight-Line','Walldorf','Active'],
      ['AST-008','Lab Equipment','Machinery','2021-06-15',3500000,1166667,2333333,6,'Straight-Line','Darmstadt','Active'],
      ['AST-009','Network Infrastructure','IT Equipment','2023-06-01',4200000,933333,3266667,3,'Straight-Line','Walldorf DC','Active'],
      ['AST-010','HVAC System','Machinery','2019-01-01',6000000,3000000,3000000,10,'Straight-Line','Walldorf','Active'],
      ['AST-011','Solar Panel Array','Machinery','2022-01-01',2800000,560000,2240000,20,'Straight-Line','Walldorf','Active'],
      ['AST-012','Security System','IT Equipment','2024-03-01',850000,141667,708333,3,'Straight-Line','All Sites','Active'],
      ['AST-013','Warehouse Robotics','Machinery','2023-09-01',5200000,866667,4333333,6,'Declining Balance','Hanover','Active'],
      ['AST-014','Retired Mainframe','IT Equipment','2015-01-01',3000000,3000000,0,5,'Straight-Line','Walldorf','Retired'],
      ['AST-015','New Dublin Office','Buildings','2025-06-01',18000000,600000,17400000,30,'Straight-Line','Dublin','Under Construction'],
    ]);

    // SEED BANK_ACCOUNTING
    await ins('bank_accounting', ['bank_name','account_number','bank_key','currency','balance','available_balance','last_statement_date','account_type','status','notes'], [
      ['Deutsche Bank','DE89370400440532013000','COBADEFFXXX','EUR',45000000,42000000,'2026-02-20','Checking','Active','Main operating account'],
      ['Deutsche Bank','DE12370400440532013001','COBADEFFXXX','USD',12500000,11800000,'2026-02-20','Checking','Active','USD operations'],
      ['Commerzbank','DE55300400000123456789','COBADEFFXXX','EUR',28000000,25000000,'2026-02-19','Checking','Active','Secondary EUR account'],
      ['JPMorgan Chase','US33000000001234567890','CHASUS33XXX','USD',35000000,32000000,'2026-02-20','Checking','Active','US operations'],
      ['HSBC','GB29NWBK60161331926819','HSBCGB2LXXX','GBP',8500000,8000000,'2026-02-19','Checking','Active','UK operations'],
      ['UBS','CH93007620111234567890','UBSWCHZH80A','CHF',15000000,14000000,'2026-02-18','Checking','Active','Swiss operations'],
      ['Deutsche Bank','DE45370400440532013002','COBADEFFXXX','EUR',20000000,20000000,'2026-02-20','Fixed Deposit','Active','12-month term deposit'],
      ['Commerzbank','DE78300400000987654321','COBADEFFXXX','EUR',5000000,5000000,'2026-02-15','Savings','Active','Reserve account'],
      ['BNP Paribas','FR7630004000031234567890S','BNPAFRPPXXX','EUR',9200000,8800000,'2026-02-19','Checking','Active','France operations'],
      ['MUFG','JP2649000000012345678','BOTKJPJTXXX','JPY',1200000000,1100000000,'2026-02-20','Checking','Active','Japan operations'],
      ['ICBC','CN1234567890123456789','ICBKCNBJXXX','CNY',25000000,23000000,'2026-02-18','Checking','Active','China operations'],
      ['SBI','IN12345678901234567890','SBININBBXXX','INR',180000000,170000000,'2026-02-19','Checking','Active','India operations'],
      ['Santander','ES9121000418450200051332','BSCHESMMXXX','EUR',6500000,6000000,'2026-02-18','Checking','Active','Spain operations'],
      ['ANZ','AU1234567890123456','ANZBAU3MXXX','USD',4800000,4500000,'2026-02-19','Checking','Active','ANZ operations'],
      ['Deutsche Bank','DE67370400440532013003','COBADEFFXXX','EUR',10000000,0,'2026-02-20','Money Market','Active','Short-term investments'],
    ]);

    // SEED COST_CENTERS
    await ins('cost_centers', ['cost_center_id','name','department','responsible_person','budget','actual_cost','variance','cost_center_type','valid_from','valid_to','status'], [
      ['CC-1000','Engineering Development','Engineering','Marcus Hoffmann',25000000,6500000,18500000,'R&D','2026-01-01','2026-12-31','Active'],
      ['CC-1100','Cloud Operations','Engineering','Jan Becker',10000000,2800000,7200000,'IT','2026-01-01','2026-12-31','Active'],
      ['CC-1200','AI Research','Engineering','Raj Patel',6000000,1200000,4800000,'R&D','2026-01-01','2026-12-31','Active'],
      ['CC-2000','Global Sales','Sales','Lisa Braun',18000000,5200000,12800000,'Sales','2026-01-01','2026-12-31','Active'],
      ['CC-2100','Enterprise Sales','Sales','Sophie Klein',12000000,3800000,8200000,'Sales','2026-01-01','2026-12-31','Active'],
      ['CC-3000','Marketing','Marketing','Nina Schmidt',12000000,3500000,8500000,'Administration','2026-01-01','2026-12-31','Active'],
      ['CC-4000','Customer Service','Service','Oliver Fischer',15000000,4200000,10800000,'Support','2026-01-01','2026-12-31','Active'],
      ['CC-5000','Finance','Finance','David Miller',5000000,1100000,3900000,'Administration','2026-01-01','2026-12-31','Active'],
      ['CC-6000','Human Resources','HR','Charlotte Weber',4000000,900000,3100000,'Administration','2026-01-01','2026-12-31','Active'],
      ['CC-7000','Product Management','Product','Anna Kowalski',8000000,1800000,6200000,'Administration','2026-01-01','2026-12-31','Active'],
      ['CC-8000','Quality Assurance','Engineering','Emma Richter',3000000,650000,2350000,'Production','2026-01-01','2026-12-31','Active'],
      ['CC-8100','Data Engineering','Engineering','Yuki Sato',4000000,950000,3050000,'IT','2026-01-01','2026-12-31','Active'],
      ['CC-9000','Facilities Management','Operations','SAP Admin',8000000,2200000,5800000,'Administration','2026-01-01','2026-12-31','Active'],
      ['CC-9100','IT Infrastructure','IT','Jan Becker',6000000,1500000,4500000,'IT','2026-01-01','2026-12-31','Active'],
      ['CC-9200','Executive Office','Management','SAP Admin',3000000,800000,2200000,'Administration','2026-01-01','2026-12-31','Active'],
    ]);

    // SEED PROFIT_CENTERS
    await ins('profit_centers', ['profit_center_id','name','segment','responsible_person','revenue','costs','profit','margin_percent','business_area','status'], [
      ['PC-1000','Cloud ERP','ERP','Marcus Hoffmann',35000000,18000000,17000000,48.57,'Cloud','Active'],
      ['PC-1100','On-Premise ERP','ERP','Marcus Hoffmann',12000000,8000000,4000000,33.33,'Services','Active'],
      ['PC-2000','HCM Solutions','HCM','Charlotte Weber',8500000,4200000,4300000,50.59,'Cloud','Active'],
      ['PC-2100','Analytics','Analytics','Yuki Sato',6200000,3100000,3100000,50.00,'Cloud','Active'],
      ['PC-3000','Procurement','Procurement','Sophie Klein',5800000,2500000,3300000,56.90,'Cloud','Active'],
      ['PC-3100','Supply Chain','SCM','Marcus Hoffmann',7200000,4100000,3100000,43.06,'Cloud','Active'],
      ['PC-4000','Professional Services','Services','Oliver Fischer',15000000,11000000,4000000,26.67,'Services','Active'],
      ['PC-4100','Training Services','Services','Charlotte Weber',3200000,2100000,1100000,34.38,'Services','Active'],
      ['PC-5000','Platform (BTP)','Platform','Jan Becker',9800000,5500000,4300000,43.88,'Digital','Active'],
      ['PC-5100','AI Solutions','AI','Raj Patel',4500000,3200000,1300000,28.89,'Digital','Active'],
      ['PC-6000','Commerce Cloud','Commerce','Carlos Santos',4800000,2800000,2000000,41.67,'Cloud','Active'],
      ['PC-6100','Sustainability','ESG','David Miller',2800000,1500000,1300000,46.43,'Cloud','Active'],
      ['PC-7000','EMEA Region','Regional','Lisa Braun',45000000,28000000,17000000,37.78,'Manufacturing','Active'],
      ['PC-7100','Americas Region','Regional','Sophie Klein',32000000,20000000,12000000,37.50,'Retail','Active'],
      ['PC-7200','APJ Region','Regional','Nina Schmidt',18000000,12000000,6000000,33.33,'Cloud','Active'],
    ]);

    // SEED INTERNAL_ORDERS
    await ins('internal_orders', ['order_number','description','order_type','responsible_person','budget','actual_cost','committed','cost_center','start_date','end_date','status'], [
      ['IO-2026-001','BASF S/4HANA Implementation','Investment','Marcus Hoffmann',4500000,1200000,2800000,'CC-1000','2026-01-15','2026-12-31','Released'],
      ['IO-2026-002','Office Renovation Walldorf','Maintenance','SAP Admin',800000,250000,400000,'CC-9000','2026-02-01','2026-06-30','Released'],
      ['IO-2026-003','SAPPHIRE NOW 2026','Marketing','Nina Schmidt',2000000,500000,1200000,'CC-3000','2026-01-01','2026-06-30','Released'],
      ['IO-2026-004','AI Research Project','R&D','Raj Patel',1500000,300000,800000,'CC-1200','2026-01-01','2026-12-31','Released'],
      ['IO-2026-005','Data Center Upgrade','IT Project','Jan Becker',3000000,800000,1500000,'CC-9100','2026-03-01','2026-09-30','Created'],
      ['IO-2026-006','Employee Training Program','Overhead','Charlotte Weber',500000,120000,250000,'CC-6000','2026-01-01','2026-12-31','Released'],
      ['IO-2026-007','Security Enhancement','IT Project','Jan Becker',750000,200000,400000,'CC-1100','2026-02-01','2026-08-31','Released'],
      ['IO-2026-008','Customer Success Program','Marketing','Oliver Fischer',600000,150000,350000,'CC-4000','2026-01-15','2026-12-31','Released'],
      ['IO-2026-009','Green Energy Initiative','Investment','David Miller',2500000,100000,500000,'CC-9000','2026-04-01','2027-03-31','Created'],
      ['IO-2026-010','Product Launch Campaign','Marketing','Anna Kowalski',400000,180000,220000,'CC-7000','2026-01-01','2026-03-31','Released'],
      ['IO-2026-011','Merck Smart Factory','Investment','Felix Wagner',1950000,0,500000,'CC-1000','2026-06-01','2027-05-31','Created'],
      ['IO-2026-012','Sales Kickoff Event','Overhead','Lisa Braun',350000,340000,10000,'CC-2000','2026-01-10','2026-01-12','Technically Complete'],
      ['IO-2026-013','Compliance Audit','Overhead','David Miller',200000,50000,150000,'CC-5000','2026-02-01','2026-04-30','Released'],
      ['IO-2026-014','Partner Portal Development','IT Project','Felix Wagner',900000,200000,500000,'CC-1000','2026-03-01','2026-10-31','Created'],
      ['IO-2026-015','Annual Report Production','Overhead','David Miller',120000,45000,75000,'CC-5000','2026-01-01','2026-03-31','Released'],
    ]);

    // SEED PROFITABILITY_ANALYSIS
    await ins('profitability_analysis', ['segment','product_group','region','customer_group','revenue','cogs','gross_profit','operating_expenses','net_profit','margin_percent','period','status'], [
      ['Cloud ERP','S/4HANA','EMEA','Enterprise',18500000,7400000,11100000,4600000,6500000,35.14,'Q1 2026','Actual'],
      ['Cloud ERP','S/4HANA','Americas','Enterprise',12000000,4800000,7200000,3200000,4000000,33.33,'Q1 2026','Actual'],
      ['Cloud ERP','S/4HANA','APJ','Enterprise',6500000,2600000,3900000,1800000,2100000,32.31,'Q1 2026','Actual'],
      ['HCM','SuccessFactors','EMEA','Enterprise',4200000,1680000,2520000,1050000,1470000,35.00,'Q1 2026','Actual'],
      ['HCM','SuccessFactors','Americas','Mid-Market',3100000,1240000,1860000,800000,1060000,34.19,'Q1 2026','Actual'],
      ['Platform','BTP','EMEA','Enterprise',5500000,2750000,2750000,1200000,1550000,28.18,'Q1 2026','Actual'],
      ['Platform','BTP','Americas','Mid-Market',3200000,1600000,1600000,750000,850000,26.56,'Q1 2026','Actual'],
      ['Analytics','SAC','EMEA','Enterprise',3800000,1520000,2280000,900000,1380000,36.32,'Q1 2026','Actual'],
      ['Procurement','Ariba','EMEA','Enterprise',2900000,1015000,1885000,700000,1185000,40.86,'Q1 2026','Actual'],
      ['Commerce','Commerce Cloud','EMEA','Mid-Market',2400000,1200000,1200000,550000,650000,27.08,'Q1 2026','Actual'],
      ['Services','Consulting','EMEA','Enterprise',8000000,6000000,2000000,1200000,800000,10.00,'Q1 2026','Actual'],
      ['Services','Consulting','Americas','Enterprise',5500000,4125000,1375000,850000,525000,9.55,'Q1 2026','Actual'],
      ['Cloud ERP','S/4HANA','EMEA','Enterprise',22000000,8800000,13200000,5500000,7700000,35.00,'Q2 2026','Forecast'],
      ['HCM','SuccessFactors','Global','All',9500000,3800000,5700000,2400000,3300000,34.74,'Q2 2026','Plan'],
      ['Platform','BTP','Global','All',10000000,5000000,5000000,2200000,2800000,28.00,'FY 2026','Plan'],
    ]);

    console.log('FI/CO data seeded');

    // SEED PURCHASE_ORDERS
    await ins('purchase_orders', ['po_number','vendor_name','material','quantity','unit_price','total','currency','delivery_date','plant','storage_location','status','notes'], [
      ['PO-2026-001','Accenture','Consulting Services',1,850000,850000,'EUR','2026-03-31','1000','','Ordered','S/4HANA implementation'],
      ['PO-2026-002','AWS','Cloud Infrastructure',12,10000,120000,'USD','2026-02-28','1000','','Delivered','Monthly cloud services'],
      ['PO-2026-003','Dell Technologies','Server Hardware',50,8500,425000,'EUR','2026-04-15','1000','WH01','Ordered','Data center expansion'],
      ['PO-2026-004','Informatica','Data Integration License',1,65000,65000,'EUR','2026-03-01','1000','','Delivered','Annual license'],
      ['PO-2026-005','Lenovo','Laptops',200,1200,240000,'EUR','2026-03-20','2000','WH02','Partially Delivered','Employee laptops'],
      ['PO-2026-006','Cisco','Network Equipment',25,12000,300000,'EUR','2026-04-30','1000','WH01','Created','Network upgrade'],
      ['PO-2026-007','Microsoft','Office 365 Licenses',5000,25,125000,'EUR','2026-02-01','1000','','Delivered','Annual subscription'],
      ['PO-2026-008','Siemens','Industrial Sensors',500,450,225000,'EUR','2026-05-15','3000','WH03','Approved','Factory IoT sensors'],
      ['PO-2026-009','Bosch','Electric Motors',100,3500,350000,'EUR','2026-06-01','3000','WH03','Created','Production line upgrade'],
      ['PO-2026-010','BASF','Chemical Supplies',2000,85,170000,'EUR','2026-03-15','3000','WH04','Ordered','Raw materials Q2'],
      ['PO-2026-011','Continental','Rubber Components',5000,22,110000,'EUR','2026-04-01','3000','WH03','Approved','Production materials'],
      ['PO-2026-012','3M','Safety Equipment',1000,45,45000,'EUR','2026-03-10','2000','WH02','Delivered','PPE supplies'],
      ['PO-2026-013','Capgemini','Development Services',1,380000,380000,'EUR','2026-06-30','1000','','Ordered','BTP extension dev'],
      ['PO-2026-014','SAP SE','Software Licenses',1,250000,250000,'EUR','2026-01-15','1000','','Delivered','S/4HANA licenses'],
      ['PO-2026-015','TCS','Support Services',1,145000,145000,'EUR','2026-12-31','1000','','Ordered','Annual support contract'],
    ]);

    // SEED PURCHASE_REQUISITIONS
    await ins('purchase_requisitions', ['pr_number','description','requester','material','quantity','estimated_price','total','required_date','cost_center','priority','status','notes'], [
      ['PR-2026-001','New development servers','Jan Becker','Server Hardware',20,9000,180000,'2026-04-01','CC-1100','High','Approved','Cloud ops expansion'],
      ['PR-2026-002','Marketing event supplies','Nina Schmidt','Event Materials',1,50000,50000,'2026-05-01','CC-3000','Normal','Created','SAPPHIRE NOW materials'],
      ['PR-2026-003','AI GPU cluster','Raj Patel','GPU Servers',5,35000,175000,'2026-04-15','CC-1200','Urgent','Approved','ML training hardware'],
      ['PR-2026-004','Office furniture','SAP Admin','Office Furniture',100,800,80000,'2026-03-15','CC-9000','Low','Ordered','New Dublin office'],
      ['PR-2026-005','Security cameras','Jan Becker','Security Equipment',50,2000,100000,'2026-05-01','CC-9100','Normal','Created','Campus security upgrade'],
      ['PR-2026-006','Testing tools license','Emma Richter','Software License',1,45000,45000,'2026-03-01','CC-8000','Normal','Approved','QA automation tools'],
      ['PR-2026-007','Training materials','Charlotte Weber','Training Supplies',500,120,60000,'2026-04-01','CC-6000','Low','Created','Onboarding kits'],
      ['PR-2026-008','Network switches','Jan Becker','Network Equipment',30,4500,135000,'2026-04-15','CC-9100','High','Approved','Infrastructure upgrade'],
      ['PR-2026-009','Consulting engagement','Lisa Braun','Consulting Services',1,200000,200000,'2026-05-01','CC-2000','Normal','Created','Sales process optimization'],
      ['PR-2026-010','Data storage expansion','Yuki Sato','Storage Hardware',10,15000,150000,'2026-04-01','CC-8100','High','Approved','Datasphere capacity'],
      ['PR-2026-011','Monitors','SAP Admin','Computer Monitors',150,500,75000,'2026-03-20','CC-9000','Normal','Ordered','Employee equipment'],
      ['PR-2026-012','Cloud credits','Jan Becker','Cloud Services',1,300000,300000,'2026-06-01','CC-1100','Urgent','Approved','Azure expansion'],
      ['PR-2026-013','Catering services','SAP Admin','Catering',1,25000,25000,'2026-05-10','CC-9000','Low','Created','SAPPHIRE NOW catering'],
      ['PR-2026-014','Robotic arms','Felix Wagner','Industrial Robotics',3,85000,255000,'2026-07-01','CC-1000','High','Created','Smart factory project'],
      ['PR-2026-015','Printer supplies','SAP Admin','Office Supplies',1,8000,8000,'2026-03-01','CC-9000','Low','Rejected','Use digital alternatives'],
    ]);

    // SEED GOODS_RECEIPTS
    await ins('goods_receipts', ['gr_number','po_number','vendor_name','material','quantity','unit','receipt_date','plant','storage_location','batch','status','notes'], [
      ['GR-2026-001','PO-2026-002','AWS','Cloud Infrastructure',12,'Month','2026-02-01','1000','','','Posted','Jan cloud services'],
      ['GR-2026-002','PO-2026-004','Informatica','Data Integration License',1,'EA','2026-02-15','1000','','','Posted','License key received'],
      ['GR-2026-003','PO-2026-005','Lenovo','Laptops',120,'EA','2026-03-10','2000','WH02','B2026-001','Posted','Partial delivery 1'],
      ['GR-2026-004','PO-2026-007','Microsoft','Office 365 Licenses',5000,'EA','2026-02-01','1000','','','Posted','Digital delivery'],
      ['GR-2026-005','PO-2026-012','3M','Safety Equipment',1000,'EA','2026-03-05','2000','WH02','B2026-002','Posted','Full delivery'],
      ['GR-2026-006','PO-2026-014','SAP SE','Software Licenses',1,'EA','2026-01-20','1000','','','Posted','License activated'],
      ['GR-2026-007','PO-2026-003','Dell Technologies','Server Hardware',25,'EA','2026-03-25','1000','WH01','B2026-003','Posted','Partial delivery'],
      ['GR-2026-008','PO-2026-010','BASF','Chemical Supplies',1000,'KG','2026-03-01','3000','WH04','B2026-004','Posted','Partial delivery'],
      ['GR-2026-009','PO-2026-005','Lenovo','Laptops',80,'EA','2026-03-18','2000','WH02','B2026-005','Posted','Partial delivery 2'],
      ['GR-2026-010','PO-2026-001','Accenture','Consulting Services',1,'EA','2026-02-28','1000','','','Posted','Phase 1 milestone'],
      ['GR-2026-011','PO-2026-008','Siemens','Industrial Sensors',200,'EA','2026-04-10','3000','WH03','B2026-006','Blocked','Quality hold'],
      ['GR-2026-012','PO-2026-011','Continental','Rubber Components',2500,'EA','2026-03-20','3000','WH03','B2026-007','Posted','Partial delivery'],
      ['GR-2026-013','PO-2026-010','BASF','Chemical Supplies',1000,'KG','2026-03-15','3000','WH04','B2026-008','Posted','Delivery 2'],
      ['GR-2026-014','PO-2026-003','Dell Technologies','Server Hardware',25,'EA','2026-04-10','1000','WH01','B2026-009','Posted','Final delivery'],
      ['GR-2026-015','PO-2026-006','Cisco','Network Equipment',10,'EA','2026-04-15','1000','WH01','B2026-010','Posted','Partial delivery'],
    ]);

    // SEED INVENTORY
    await ins('inventory', ['material_number','description','plant','storage_location','quantity','unit','value','reorder_point','max_stock','last_count_date','stock_type','status'], [
      ['MAT-001','SAP S/4HANA Cloud License',  '1000','','999','EA',249750000,10,9999,'2026-02-01','Unrestricted','Active'],
      ['MAT-003','SAP Ariba License','1000','','999','EA',119880000,10,9999,'2026-02-01','Unrestricted','Active'],
      ['INV-001','Dell PowerEdge R750','1000','WH01',50,'EA',425000,10,100,'2026-02-15','Unrestricted','Active'],
      ['INV-002','Lenovo ThinkPad X1','2000','WH02',200,'EA',240000,50,500,'2026-03-18','Unrestricted','Active'],
      ['INV-003','Cisco Catalyst 9300','1000','WH01',10,'EA',120000,5,50,'2026-04-15','Unrestricted','Active'],
      ['INV-004','Industrial Sensor Kit','3000','WH03',200,'EA',90000,100,1000,'2026-04-10','Quality Inspection','Active'],
      ['INV-005','Rubber Components','3000','WH03',2500,'EA',55000,1000,10000,'2026-03-20','Unrestricted','Active'],
      ['INV-006','Chemical Compound A','3000','WH04',2000,'KG',170000,500,5000,'2026-03-15','Unrestricted','Active'],
      ['INV-007','Safety Helmets','2000','WH02',1000,'EA',45000,200,2000,'2026-03-05','Unrestricted','Active'],
      ['INV-008','Office Chairs','2000','WH02',75,'EA',60000,20,200,'2026-01-15','Unrestricted','Active'],
      ['INV-009','GPU Server Unit','1000','WH01',3,'EA',105000,2,10,'2026-01-20','Unrestricted','Active'],
      ['INV-010','Network Cable Cat6','1000','WH01',5000,'M',15000,1000,10000,'2026-02-01','Unrestricted','Active'],
      ['INV-011','Electric Motors','3000','WH03',0,'EA',0,20,200,'2026-01-01','Unrestricted','Active'],
      ['INV-012','Printer Toner','2000','WH02',120,'EA',6000,50,300,'2026-02-10','Unrestricted','Active'],
      ['INV-013','Defective Sensors','3000','WH03',15,'EA',6750,0,0,'2026-04-10','Blocked','Active'],
    ]);

    // SEED MATERIAL_MASTER
    await ins('material_master', ['material_number','description','material_type','material_group','base_unit','weight','weight_unit','dimensions','plant','storage_location','status'], [
      ['MM-001','Steel Sheet 2mm','Raw Material','Metals','KG',1.000,'KG','1000x2000x2mm','3000','WH03','Active'],
      ['MM-002','Aluminum Rod 10mm','Raw Material','Metals','KG',0.500,'KG','10mm x 6000mm','3000','WH03','Active'],
      ['MM-003','Electric Motor 5kW','Semi-Finished','Electrical','EA',25.000,'KG','300x200x200mm','3000','WH03','Active'],
      ['MM-004','Control Board v3','Semi-Finished','Electronics','EA',0.350,'KG','150x100x20mm','3000','WH03','Active'],
      ['MM-005','Assembled Pump Unit','Finished Good','Machinery','EA',45.000,'KG','500x400x350mm','3000','WH03','Active'],
      ['MM-006','Hydraulic Valve','Spare Part','Hydraulics','EA',2.500,'KG','80x60x40mm','3000','WH03','Active'],
      ['MM-007','Packaging Box Large','Packaging','Packaging','EA',0.800,'KG','600x400x400mm','3000','WH05','Active'],
      ['MM-008','Rubber Gasket Set','Raw Material','Rubber','SET',0.150,'KG','Various','3000','WH03','Active'],
      ['MM-009','PCB Assembly','Semi-Finished','Electronics','EA',0.200,'KG','200x150x5mm','3000','WH03','Active'],
      ['MM-010','Industrial Sensor','Finished Good','Electronics','EA',0.500,'KG','100x50x30mm','3000','WH03','Active'],
      ['MM-011','Lubricant Oil 5L','Raw Material','Chemicals','EA',4.500,'KG','5L Container','3000','WH04','Active'],
      ['MM-012','Wiring Harness','Semi-Finished','Electrical','EA',1.200,'KG','Variable','3000','WH03','Active'],
      ['MM-013','Safety Helmet','Trading Good','Safety','EA',0.400,'KG','Standard','2000','WH02','Active'],
      ['MM-014','Laptop ThinkPad X1','Trading Good','IT Equipment','EA',1.400,'KG','320x220x15mm','2000','WH02','Active'],
      ['MM-015','Server PowerEdge','Trading Good','IT Equipment','EA',18.000,'KG','2U Rack Mount','1000','WH01','Active'],
    ]);

    // SEED BILL_OF_MATERIALS
    await ins('bill_of_materials', ['bom_number','material','description','base_quantity','base_unit','components_count','bom_type','valid_from','valid_to','alternative','status'], [
      ['BOM-001','Assembled Pump Unit','Industrial pump assembly',1,'EA',12,'Production','2025-01-01','2027-12-31','1','Active'],
      ['BOM-002','Control Board v3','Electronic control board',1,'EA',8,'Production','2025-06-01','2027-12-31','1','Active'],
      ['BOM-003','Industrial Sensor','IoT sensor assembly',1,'EA',6,'Production','2025-03-01','2027-12-31','1','Active'],
      ['BOM-004','Wiring Harness','Standard wiring harness',1,'EA',15,'Production','2024-01-01','2026-12-31','1','Active'],
      ['BOM-005','PCB Assembly','Printed circuit board assy',1,'EA',22,'Production','2025-01-01','2027-12-31','1','Active'],
      ['BOM-006','Assembled Pump Unit','Engineering prototype',1,'EA',14,'Engineering','2025-06-01','2026-06-30','2','Active'],
      ['BOM-007','Hydraulic Valve','Valve sub-assembly',1,'EA',5,'Production','2024-06-01','2027-12-31','1','Active'],
      ['BOM-008','Electric Motor 5kW','Motor assembly',1,'EA',9,'Production','2025-01-01','2027-12-31','1','Active'],
      ['BOM-009','Packaging Box Large','Packaging with inserts',1,'SET',4,'Production','2025-01-01','2027-12-31','1','Active'],
      ['BOM-010','Industrial Sensor','Sales configuration',1,'EA',8,'Sales','2025-03-01','2027-12-31','1','Active'],
      ['BOM-011','Control Board v4','Next-gen control board',1,'EA',10,'Engineering','2026-01-01','2028-12-31','1','In Development'],
      ['BOM-012','Smart Pump Unit','IoT-enabled pump',1,'EA',18,'Engineering','2026-01-01','2028-12-31','1','In Development'],
      ['BOM-013','Sensor Array Module','Multi-sensor module',1,'EA',4,'Production','2025-09-01','2027-12-31','1','Active'],
      ['BOM-014','Power Supply Unit','24V power supply',1,'EA',7,'Production','2024-01-01','2026-12-31','1','Active'],
      ['BOM-015','Cable Assembly Kit','Standard cable kit',1,'SET',6,'Template','2025-01-01','2027-12-31','1','Active'],
    ]);

    // SEED PRODUCTION_ORDERS
    await ins('production_orders', ['order_number','material','description','quantity','unit','start_date','end_date','plant','work_center','routing','priority','status'], [
      ['PRD-2026-001','Assembled Pump Unit','Industrial pump batch',50,'EA','2026-02-01','2026-02-28','3000','WC-ASSY-01','RT-001','High','Confirmed'],
      ['PRD-2026-002','Control Board v3','Control boards Q1',200,'EA','2026-01-15','2026-02-15','3000','WC-ELEC-01','RT-002','Normal','Delivered'],
      ['PRD-2026-003','Industrial Sensor','IoT sensors batch',500,'EA','2026-02-15','2026-03-31','3000','WC-ELEC-02','RT-003','High','Released'],
      ['PRD-2026-004','Wiring Harness','Wiring harness lot',1000,'EA','2026-03-01','2026-03-15','3000','WC-ASSY-02','RT-004','Normal','Created'],
      ['PRD-2026-005','PCB Assembly','PCB assembly run',300,'EA','2026-02-20','2026-03-10','3000','WC-ELEC-01','RT-005','Urgent','Released'],
      ['PRD-2026-006','Hydraulic Valve','Valve production',150,'EA','2026-03-15','2026-04-15','3000','WC-MACH-01','RT-007','Normal','Created'],
      ['PRD-2026-007','Electric Motor 5kW','Motor assembly',80,'EA','2026-04-01','2026-04-30','3000','WC-ASSY-01','RT-008','High','Created'],
      ['PRD-2026-008','Assembled Pump Unit','Pump batch 2',75,'EA','2026-04-15','2026-05-15','3000','WC-ASSY-01','RT-001','Normal','Created'],
      ['PRD-2026-009','Sensor Array Module','Sensor modules',200,'EA','2026-03-01','2026-03-20','3000','WC-ELEC-02','RT-013','Normal','Released'],
      ['PRD-2026-010','Power Supply Unit','PSU production',400,'EA','2026-02-01','2026-02-20','3000','WC-ELEC-01','RT-014','Normal','Confirmed'],
      ['PRD-2026-011','Control Board v3','Control boards Q2',250,'EA','2026-04-01','2026-04-30','3000','WC-ELEC-01','RT-002','Normal','Created'],
      ['PRD-2026-012','Industrial Sensor','Sensors for Merck',100,'EA','2026-06-01','2026-06-30','3000','WC-ELEC-02','RT-003','High','Created'],
      ['PRD-2026-013','Cable Assembly Kit','Cable kits',500,'SET','2026-03-10','2026-03-25','3000','WC-ASSY-02','RT-015','Low','Released'],
      ['PRD-2026-014','Packaging Box Large','Packaging run',2000,'EA','2026-02-01','2026-02-10','3000','WC-PACK-01','RT-009','Low','Delivered'],
      ['PRD-2026-015','Assembled Pump Unit','Rush order Bosch',20,'EA','2026-03-01','2026-03-10','3000','WC-ASSY-01','RT-001','Urgent','Partially Delivered'],
    ]);

    // SEED MRP_RUNS
    await ins('mrp_runs', ['run_id','plant','run_date','planning_scope','materials_planned','planned_orders_created','purchase_requisitions_created','exceptions','processing_time_minutes','status','notes'], [
      ['MRP-2026-001','3000','2026-01-02','Plant-Wide',450,85,32,12,45.5,'Completed','First MRP run of year'],
      ['MRP-2026-002','3000','2026-01-09','Plant-Wide',450,62,28,8,42.3,'Completed','Weekly run'],
      ['MRP-2026-003','1000','2026-01-15','Plant-Wide',120,15,22,3,18.7,'Completed','IT materials planning'],
      ['MRP-2026-004','3000','2026-01-16','Plant-Wide',455,78,35,15,48.2,'Completed','Weekly run'],
      ['MRP-2026-005','3000','2026-01-23','Single Material',1,2,1,0,2.1,'Completed','Urgent pump materials'],
      ['MRP-2026-006','3000','2026-01-30','Plant-Wide',460,71,30,10,44.8,'Completed','End of month run'],
      ['MRP-2026-007','2000','2026-02-01','Plant-Wide',85,12,18,2,12.5,'Completed','Office supplies planning'],
      ['MRP-2026-008','3000','2026-02-06','Plant-Wide',465,92,38,18,52.1,'Completed','Weekly run - high demand'],
      ['MRP-2026-009','3000','2026-02-13','Plant-Wide',462,68,25,9,43.6,'Completed','Weekly run'],
      ['MRP-2026-010','3000','2026-02-20','MRP Area',180,45,15,5,22.3,'Completed','Electronics area only'],
      ['MRP-2026-011','3000','2026-02-20','Plant-Wide',470,88,42,20,55.8,'Completed','Weekly run'],
      ['MRP-2026-012','1000','2026-02-15','Plant-Wide',125,18,25,4,19.2,'Completed','Monthly IT run'],
      ['MRP-2026-013','3000','2026-02-27','Plant-Wide',468,75,33,11,46.5,'Completed','End of month'],
      ['MRP-2026-014','3000','2026-03-06','Plant-Wide',472,0,0,0,0,'Scheduled','Next weekly run'],
      ['MRP-2026-015','3000','2026-03-01','Global',1200,0,0,0,0,'Scheduled','Monthly global run'],
    ]);

    // SEED WORK_CENTERS
    await ins('work_centers', ['work_center_id','name','plant','cost_center','capacity_type','available_capacity','capacity_unit','efficiency_percent','setup_time','responsible_person','status'], [
      ['WC-ASSY-01','Assembly Line 1','3000','CC-8000','Both',160,'Hours',92.5,2.0,'Marcus Hoffmann','Active'],
      ['WC-ASSY-02','Assembly Line 2','3000','CC-8000','Both',160,'Hours',88.0,1.5,'Marcus Hoffmann','Active'],
      ['WC-ELEC-01','Electronics Production','3000','CC-8000','Machine',120,'Hours',95.0,1.0,'Emma Richter','Active'],
      ['WC-ELEC-02','Sensor Assembly','3000','CC-8000','Both',80,'Hours',90.0,0.5,'Emma Richter','Active'],
      ['WC-MACH-01','CNC Machining','3000','CC-8000','Machine',160,'Hours',85.0,3.0,'Felix Wagner','Active'],
      ['WC-MACH-02','Precision Grinding','3000','CC-8000','Machine',80,'Hours',82.0,2.5,'Felix Wagner','Active'],
      ['WC-WELD-01','Welding Station','3000','CC-8000','Labor',120,'Hours',88.0,1.0,'Carlos Santos','Active'],
      ['WC-PACK-01','Packaging Line','3000','CC-8000','Both',160,'Hours',95.0,0.5,'Oliver Fischer','Active'],
      ['WC-PAINT-01','Paint Shop','3000','CC-8000','Machine',80,'Hours',78.0,4.0,'Felix Wagner','Active'],
      ['WC-TEST-01','Quality Testing','3000','CC-8000','Both',80,'Hours',98.0,0.5,'Emma Richter','Active'],
      ['WC-LASR-01','Laser Cutting','3000','CC-8000','Machine',120,'Hours',90.0,2.0,'Felix Wagner','Active'],
      ['WC-3DPR-01','3D Printing','3000','CC-1200','Machine',40,'Hours',85.0,1.0,'Raj Patel','Active'],
      ['WC-INSP-01','Inspection Station','3000','CC-8000','Labor',80,'Hours',100.0,0.0,'Emma Richter','Active'],
      ['WC-STOR-01','Storage Operations','3000','CC-9000','Labor',160,'Hours',92.0,0.0,'Oliver Fischer','Active'],
      ['WC-MAINT-01','Maintenance Bay','3000','CC-9000','Both',40,'Hours',80.0,1.0,'Carlos Santos','Under Maintenance'],
    ]);

    // SEED ROUTINGS
    await ins('routings', ['routing_number','material','description','operations_count','total_setup_time','total_processing_time','total_time','time_unit','work_center','valid_from','valid_to','status'], [
      ['RT-001','Assembled Pump Unit','Pump assembly routing',8,12.0,45.0,57.0,'Minutes','WC-ASSY-01','2025-01-01','2027-12-31','Active'],
      ['RT-002','Control Board v3','Control board assembly',6,5.0,25.0,30.0,'Minutes','WC-ELEC-01','2025-06-01','2027-12-31','Active'],
      ['RT-003','Industrial Sensor','Sensor assembly routing',5,3.0,15.0,18.0,'Minutes','WC-ELEC-02','2025-03-01','2027-12-31','Active'],
      ['RT-004','Wiring Harness','Harness production',4,2.0,12.0,14.0,'Minutes','WC-ASSY-02','2024-01-01','2026-12-31','Active'],
      ['RT-005','PCB Assembly','PCB assembly process',7,4.0,20.0,24.0,'Minutes','WC-ELEC-01','2025-01-01','2027-12-31','Active'],
      ['RT-007','Hydraulic Valve','Valve machining + assembly',6,8.0,35.0,43.0,'Minutes','WC-MACH-01','2024-06-01','2027-12-31','Active'],
      ['RT-008','Electric Motor 5kW','Motor assembly routing',7,10.0,40.0,50.0,'Minutes','WC-ASSY-01','2025-01-01','2027-12-31','Active'],
      ['RT-009','Packaging Box Large','Packaging assembly',3,1.0,5.0,6.0,'Minutes','WC-PACK-01','2025-01-01','2027-12-31','Active'],
      ['RT-010','Steel Sheet Cutting','Laser cut steel sheets',2,5.0,8.0,13.0,'Minutes','WC-LASR-01','2025-01-01','2027-12-31','Active'],
      ['RT-011','Motor Housing','CNC machining routing',4,8.0,30.0,38.0,'Minutes','WC-MACH-01','2025-01-01','2027-12-31','Active'],
      ['RT-012','Surface Treatment','Paint and coating',3,10.0,25.0,35.0,'Minutes','WC-PAINT-01','2025-01-01','2027-12-31','Active'],
      ['RT-013','Sensor Array Module','Multi-sensor assembly',4,3.0,18.0,21.0,'Minutes','WC-ELEC-02','2025-09-01','2027-12-31','Active'],
      ['RT-014','Power Supply Unit','PSU assembly',5,4.0,22.0,26.0,'Minutes','WC-ELEC-01','2024-01-01','2026-12-31','Active'],
      ['RT-015','Cable Assembly Kit','Cable preparation',3,2.0,10.0,12.0,'Minutes','WC-ASSY-02','2025-01-01','2027-12-31','Active'],
      ['RT-016','Prototype Sensor v2','New sensor design routing',6,5.0,30.0,35.0,'Minutes','WC-ELEC-02','2026-01-01','2028-12-31','In Development'],
    ]);

    console.log('MM/PP data seeded');

    // SEED EQUIPMENT
    await ins('equipment', ['equipment_id','description','equipment_type','serial_number','manufacturer','model','installation_date','warranty_expiry','location','cost_center','status'], [
      ['EQ-001','CNC Milling Machine','Production Machine','SN-CNC-2020-001','DMG Mori','DMU 50','2020-03-15','2025-03-15','Plant 3000 - Hall A','CC-8000','Active'],
      ['EQ-002','Assembly Robot Arm','Production Machine','SN-ROB-2021-001','KUKA','KR 60-3','2021-06-01','2026-06-01','Plant 3000 - Line 1','CC-8000','Active'],
      ['EQ-003','HVAC Unit Building A','HVAC','SN-HVAC-2019-001','Carrier','30XA','2019-01-15','2029-01-15','Walldorf HQ','CC-9000','Active'],
      ['EQ-004','Industrial Laser Cutter','Production Machine','SN-LSR-2023-001','TRUMPF','TruLaser 5030','2023-01-10','2028-01-10','Plant 3000 - Hall B','CC-8000','Active'],
      ['EQ-005','Forklift Electric','Vehicle','SN-FLT-2022-001','Toyota','8FBE18T','2022-08-01','2027-08-01','Warehouse WH03','CC-9000','Active'],
      ['EQ-006','Air Compressor','Compressor','SN-CMP-2020-001','Atlas Copco','GA 37+','2020-05-20','2025-05-20','Plant 3000 - Utility','CC-9000','Active'],
      ['EQ-007','Precision Grinder','Production Machine','SN-GRD-2021-001','Studer','S33','2021-09-15','2026-09-15','Plant 3000 - Hall A','CC-8000','Active'],
      ['EQ-008','Paint Spray Booth','Production Machine','SN-PNT-2022-001','Duerr','EcoBell3','2022-03-01','2027-03-01','Plant 3000 - Paint Shop','CC-8000','Active'],
      ['EQ-009','Quality CMM','Instrument','SN-CMM-2023-001','Zeiss','CONTURA','2023-06-01','2028-06-01','Plant 3000 - QA Lab','CC-8000','Active'],
      ['EQ-010','Welding Station','Production Machine','SN-WLD-2021-001','Fronius','TPS 500i','2021-11-01','2026-11-01','Plant 3000 - Hall C','CC-8000','Active'],
      ['EQ-011','Conveyor System','Conveyor','SN-CNV-2020-001','Siemens','Simatic','2020-01-01','2030-01-01','Plant 3000 - Line 1','CC-8000','Active'],
      ['EQ-012','Hydraulic Press','Production Machine','SN-HYD-2019-001','Schuler','MSE 2000','2019-07-01','2024-07-01','Plant 3000 - Hall B','CC-8000','In Repair'],
      ['EQ-013','3D Printer Industrial','Production Machine','SN-3DP-2024-001','EOS','M 400-4','2024-01-15','2029-01-15','Plant 3000 - R&D','CC-1200','Active'],
      ['EQ-014','Backup Generator','Electrical','SN-GEN-2020-001','Caterpillar','C18','2020-06-01','2030-06-01','Plant 3000 - Utility','CC-9000','Active'],
      ['EQ-015','Retired Lathe','Production Machine','SN-LTH-2010-001','Mazak','QTN 200','2010-01-01','2015-01-01','Storage','CC-8000','Decommissioned'],
    ]);

    // SEED MAINTENANCE_ORDERS
    await ins('maintenance_orders', ['order_number','description','equipment_id','order_type','priority','planned_start','planned_end','actual_start','actual_end','assigned_to','estimated_cost','actual_cost','status'], [
      ['MO-2026-001','CNC annual calibration','EQ-001','Preventive','Normal','2026-03-01','2026-03-02','2026-03-01',null,'Carlos Santos',5000,2500,'In Progress'],
      ['MO-2026-002','Robot arm joint replacement','EQ-002','Corrective','Urgent','2026-02-15','2026-02-17','2026-02-15','2026-02-16','Felix Wagner',12000,11500,'Completed'],
      ['MO-2026-003','HVAC filter replacement','EQ-003','Preventive','Low','2026-04-01','2026-04-01',null,null,'Carlos Santos',800,0,'Created'],
      ['MO-2026-004','Laser alignment check','EQ-004','Condition-Based','Normal','2026-03-15','2026-03-15',null,null,'Felix Wagner',3000,0,'Created'],
      ['MO-2026-005','Forklift battery replacement','EQ-005','Corrective','High','2026-02-20','2026-02-21','2026-02-20','2026-02-21','Carlos Santos',4500,4200,'Completed'],
      ['MO-2026-006','Compressor oil change','EQ-006','Preventive','Normal','2026-03-10','2026-03-10',null,null,'Carlos Santos',600,0,'Released'],
      ['MO-2026-007','Grinder wheel replacement','EQ-007','Preventive','Normal','2026-04-15','2026-04-15',null,null,'Felix Wagner',2000,0,'Created'],
      ['MO-2026-008','Paint booth exhaust repair','EQ-008','Corrective','High','2026-02-25','2026-02-27','2026-02-25',null,'Carlos Santos',8000,5000,'In Progress'],
      ['MO-2026-009','CMM software update','EQ-009','Preventive','Low','2026-05-01','2026-05-01',null,null,'Emma Richter',1500,0,'Created'],
      ['MO-2026-010','Welding tip replacement','EQ-010','Preventive','Normal','2026-03-20','2026-03-20',null,null,'Carlos Santos',400,0,'Released'],
      ['MO-2026-011','Conveyor belt tension','EQ-011','Condition-Based','Normal','2026-03-05','2026-03-05','2026-03-05',null,'Felix Wagner',1200,800,'In Progress'],
      ['MO-2026-012','Hydraulic press overhaul','EQ-012','Corrective','Emergency','2026-02-10','2026-03-10','2026-02-10',null,'Felix Wagner',25000,18000,'In Progress'],
      ['MO-2026-013','3D printer nozzle clean','EQ-013','Preventive','Low','2026-04-01','2026-04-01',null,null,'Raj Patel',500,0,'Created'],
      ['MO-2026-014','Generator load test','EQ-014','Preventive','Normal','2026-06-01','2026-06-01',null,null,'Carlos Santos',2000,0,'Created'],
      ['MO-2026-015','Predictive vibration check','EQ-001','Predictive','Normal','2026-05-15','2026-05-15',null,null,'Emma Richter',1000,0,'Created'],
    ]);

    // SEED MAINTENANCE_PLANS
    await ins('maintenance_plans', ['plan_number','description','equipment_id','plan_type','frequency','cycle_length','next_due_date','last_completed_date','assigned_to','estimated_duration_hours','status'], [
      ['MP-001','CNC Annual Calibration','EQ-001','Time-Based','Annual',12,'2026-03-01','2025-03-01','Carlos Santos',8,'Active'],
      ['MP-002','Robot Arm Inspection','EQ-002','Time-Based','Quarterly',3,'2026-06-01','2026-03-01','Felix Wagner',4,'Active'],
      ['MP-003','HVAC Filter Change','EQ-003','Time-Based','Quarterly',3,'2026-04-01','2026-01-01','Carlos Santos',2,'Active'],
      ['MP-004','Laser Performance Check','EQ-004','Counter-Based','Monthly',1,'2026-03-15','2026-02-15','Felix Wagner',3,'Active'],
      ['MP-005','Forklift Safety Inspection','EQ-005','Time-Based','Monthly',1,'2026-03-20','2026-02-20','Carlos Santos',2,'Active'],
      ['MP-006','Compressor Maintenance','EQ-006','Time-Based','Quarterly',3,'2026-03-10','2025-12-10','Carlos Santos',4,'Active'],
      ['MP-007','Grinder Wheel Check','EQ-007','Counter-Based','Quarterly',3,'2026-04-15','2026-01-15','Felix Wagner',2,'Active'],
      ['MP-008','Paint Booth Cleaning','EQ-008','Time-Based','Monthly',1,'2026-03-25','2026-02-25','Carlos Santos',6,'Active'],
      ['MP-009','CMM Calibration','EQ-009','Time-Based','Semi-Annual',6,'2026-05-01','2025-11-01','Emma Richter',4,'Active'],
      ['MP-010','Welder Tip Replacement','EQ-010','Counter-Based','Monthly',1,'2026-03-20','2026-02-20','Carlos Santos',1,'Active'],
      ['MP-011','Conveyor Belt Inspection','EQ-011','Condition-Based','Monthly',1,'2026-04-05','2026-03-05','Felix Wagner',3,'Active'],
      ['MP-012','Hydraulic Press Overhaul','EQ-012','Time-Based','Annual',12,'2027-02-10','2026-02-10','Felix Wagner',40,'Suspended'],
      ['MP-013','3D Printer Maintenance','EQ-013','Time-Based','Monthly',1,'2026-04-01','2026-03-01','Raj Patel',2,'Active'],
      ['MP-014','Generator Annual Test','EQ-014','Time-Based','Annual',12,'2026-06-01','2025-06-01','Carlos Santos',4,'Active'],
      ['MP-015','Vibration Monitoring','EQ-001','Condition-Based','Weekly',1,'2026-03-07','2026-02-28','Emma Richter',1,'Active'],
    ]);

    // SEED FUNCTIONAL_LOCATIONS
    await ins('functional_locations', ['location_id','description','location_type','parent_location','plant','address','equipment_count','responsible_person','cost_center','status'], [
      ['FL-3000','Manufacturing Plant','Plant',null,'3000','Industriestr 1, Stuttgart','85','Marcus Hoffmann','CC-8000','Active'],
      ['FL-3000-A','Production Hall A','Building','FL-3000','3000','Hall A','15','Felix Wagner','CC-8000','Active'],
      ['FL-3000-B','Production Hall B','Building','FL-3000','3000','Hall B','12','Felix Wagner','CC-8000','Active'],
      ['FL-3000-C','Production Hall C','Building','FL-3000','3000','Hall C','8','Carlos Santos','CC-8000','Active'],
      ['FL-3000-L1','Assembly Line 1','Production Line','FL-3000-A','3000','Hall A, Line 1','6','Marcus Hoffmann','CC-8000','Active'],
      ['FL-3000-L2','Assembly Line 2','Production Line','FL-3000-A','3000','Hall A, Line 2','4','Marcus Hoffmann','CC-8000','Active'],
      ['FL-3000-QA','Quality Assurance Lab','Room','FL-3000-B','3000','Hall B, Room QA-1','3','Emma Richter','CC-8000','Active'],
      ['FL-3000-RD','R&D Workshop','Room','FL-3000-B','3000','Hall B, Room RD-1','2','Raj Patel','CC-1200','Active'],
      ['FL-3000-UT','Utility Area','Storage Area','FL-3000','3000','Utility Building','4','Carlos Santos','CC-9000','Active'],
      ['FL-3000-PS','Paint Shop','Room','FL-3000-C','3000','Hall C, Paint Area','2','Carlos Santos','CC-8000','Active'],
      ['FL-1000','Walldorf HQ','Plant',null,'1000','Dietmar-Hopp-Allee 16, Walldorf','25','SAP Admin','CC-9000','Active'],
      ['FL-1000-DC','Data Center','Building','FL-1000','1000','DC Building','20','Jan Becker','CC-9100','Active'],
      ['FL-2000','Office Complex','Plant',null,'2000','Petuelring 130, Munich','5','Nina Schmidt','CC-9000','Active'],
      ['FL-WH03','Warehouse WH03','Storage Area','FL-3000','3000','Warehouse 3','3','Oliver Fischer','CC-9000','Active'],
      ['FL-NEW','New Dublin Facility','Plant',null,'4000','Dublin, Ireland','0','Jan Becker','CC-9100','Under Construction'],
    ]);

    // SEED INSPECTION_LOTS
    await ins('inspection_lots', ['lot_number','material','inspection_type','sample_size','inspected_quantity','defects_found','defect_rate','inspection_date','inspector','result','status'], [
      ['IL-2026-001','Industrial Sensor','Incoming',50,50,2,4.00,'2026-02-15','Emma Richter','Accepted','Completed'],
      ['IL-2026-002','Rubber Components','Incoming',100,100,5,5.00,'2026-03-20','Emma Richter','Accepted','Completed'],
      ['IL-2026-003','Steel Sheet 2mm','Incoming',20,20,0,0.00,'2026-01-25','Emma Richter','Accepted','Completed'],
      ['IL-2026-004','Control Board v3','In-Process',30,30,1,3.33,'2026-02-10','Emma Richter','Accepted','Completed'],
      ['IL-2026-005','Assembled Pump Unit','Final',10,10,0,0.00,'2026-02-28','Emma Richter','Accepted','Completed'],
      ['IL-2026-006','Industrial Sensor Kit','Incoming',200,150,12,8.00,'2026-04-10','Emma Richter','Rejected','Completed'],
      ['IL-2026-007','PCB Assembly','In-Process',50,50,3,6.00,'2026-03-05','Emma Richter','Conditional','Completed'],
      ['IL-2026-008','Electric Motor 5kW','Final',5,5,0,0.00,'2026-02-20','Emma Richter','Accepted','Completed'],
      ['IL-2026-009','Wiring Harness','In-Process',100,80,4,5.00,'2026-03-10','Emma Richter','Accepted','In Progress'],
      ['IL-2026-010','Hydraulic Valve','Final',20,20,1,5.00,'2026-01-30','Emma Richter','Accepted','Completed'],
      ['IL-2026-011','Chemical Compound A','Incoming',10,10,0,0.00,'2026-03-01','Emma Richter','Accepted','Completed'],
      ['IL-2026-012','Server PowerEdge','Incoming',5,5,0,0.00,'2026-03-25','Emma Richter','Accepted','Completed'],
      ['IL-2026-013','Assembled Pump Unit','Audit',3,3,0,0.00,'2026-02-15','Emma Richter','Accepted','Completed'],
      ['IL-2026-014','Sensor Array Module','In-Process',40,0,0,0.00,'2026-03-15',null,null,'Created'],
      ['IL-2026-015','Power Supply Unit','Final',25,25,2,8.00,'2026-02-25','Emma Richter','Conditional','Completed'],
    ]);

    // SEED QUALITY_NOTIFICATIONS
    await ins('quality_notifications', ['notification_number','description','notification_type','priority','material','defect_type','reported_by','reported_date','assigned_to','root_cause','corrective_action','status'], [
      ['QN-2026-001','Sensor batch high defect rate','Vendor','Very High','Industrial Sensor Kit','Calibration Error','Emma Richter','2026-04-10','Felix Wagner','Vendor manufacturing process drift','Request vendor corrective action report','In Process'],
      ['QN-2026-002','PCB solder joint issues','Internal','High','PCB Assembly','Solder Defect','Emma Richter','2026-03-05','Felix Wagner','Wave solder temperature variance','Recalibrate solder machine','Completed'],
      ['QN-2026-003','Customer pump vibration complaint','Customer Complaint','Very High','Assembled Pump Unit','Excessive Vibration','Oliver Fischer','2026-02-20','Marcus Hoffmann','Bearing alignment issue','Replace bearings, update assembly procedure','In Process'],
      ['QN-2026-004','Rubber gasket dimension variance','Vendor','Medium','Rubber Gasket Set','Dimensional','Emma Richter','2026-03-15','Felix Wagner','Mold wear at vendor','Vendor to replace mold tooling','Created'],
      ['QN-2026-005','Wiring harness connector loose','Internal','High','Wiring Harness','Assembly Error','Carlos Santos','2026-03-10','Felix Wagner','Crimping tool worn','Replace crimping tool, retrain operators','Completed'],
      ['QN-2026-006','Motor overheating in test','Internal','Very High','Electric Motor 5kW','Performance','Emma Richter','2026-02-18','Felix Wagner','Winding insulation defect','Rework winding process','In Process'],
      ['QN-2026-007','Paint adhesion failure','Internal','Medium','Assembled Pump Unit','Surface Finish','Carlos Santos','2026-02-25','Felix Wagner','Pre-treatment chemical expired','Replace chemicals, add expiry checks','Completed'],
      ['QN-2026-008','Customer delivery damage','Customer Complaint','High','Control Board v3','Shipping Damage','Oliver Fischer','2026-01-28','Nina Schmidt','Inadequate packaging','Upgrade packaging design','Completed'],
      ['QN-2026-009','Steel sheet rust spots','Vendor','Medium','Steel Sheet 2mm','Corrosion','Emma Richter','2026-01-20','Felix Wagner','Improper storage at vendor','Request improved storage conditions','Closed'],
      ['QN-2026-010','Valve leak under pressure','Internal','High','Hydraulic Valve','Leak','Emma Richter','2026-01-30','Felix Wagner','O-ring specification error','Correct O-ring spec in BOM','Completed'],
      ['QN-2026-011','Label printing error','Internal','Low','Packaging Box Large','Labeling','Carlos Santos','2026-02-05','Nina Schmidt','Printer calibration drift','Recalibrate label printer','Closed'],
      ['QN-2026-012','Customer wrong item received','Customer Complaint','High','Industrial Sensor','Wrong Item','Oliver Fischer','2026-03-02','Oliver Fischer','Pick error in warehouse','Implement barcode verification','In Process'],
      ['QN-2026-013','Aluminum rod hardness variance','Vendor','Medium','Aluminum Rod 10mm','Material Property','Emma Richter','2026-02-12','Felix Wagner','Vendor heat treatment variance','Tighten incoming inspection','Created'],
      ['QN-2026-014','PSU voltage fluctuation','Internal','High','Power Supply Unit','Electrical','Emma Richter','2026-02-25','Felix Wagner','Capacitor quality issue','Switch capacitor supplier','In Process'],
      ['QN-2026-015','Sensor calibration drift','Internal','Medium','Industrial Sensor','Calibration','Emma Richter','2026-03-18','Raj Patel','Environmental sensitivity','Add temperature compensation','Created'],
    ]);

    // SEED QUALITY_PLANS
    await ins('quality_plans', ['plan_number','description','material','inspection_type','inspection_points','sample_procedure','inspection_method','valid_from','valid_to','responsible','status'], [
      ['QP-001','Incoming Raw Material Inspection','Steel Sheet 2mm','Incoming',5,'AQL 1.0','Dimensional + Visual','2025-01-01','2027-12-31','Emma Richter','Active'],
      ['QP-002','Incoming Electronic Components','Control Board v3','Incoming',8,'AQL 0.65','Functional + Visual','2025-01-01','2027-12-31','Emma Richter','Active'],
      ['QP-003','In-Process PCB Inspection','PCB Assembly','In-Process',12,'100% Critical, Sample Others','AOI + Manual','2025-01-01','2027-12-31','Emma Richter','Active'],
      ['QP-004','Final Pump Assembly QC','Assembled Pump Unit','Final',15,'100%','Performance + Pressure Test','2025-01-01','2027-12-31','Emma Richter','Active'],
      ['QP-005','Sensor Calibration Check','Industrial Sensor','Final',6,'100%','Calibration Verification','2025-03-01','2027-12-31','Emma Richter','Active'],
      ['QP-006','Motor Performance Test','Electric Motor 5kW','Final',8,'100%','Load + Temperature Test','2025-01-01','2027-12-31','Emma Richter','Active'],
      ['QP-007','Incoming Rubber Inspection','Rubber Gasket Set','Incoming',4,'AQL 2.5','Dimensional + Hardness','2025-01-01','2027-12-31','Emma Richter','Active'],
      ['QP-008','Valve Pressure Test','Hydraulic Valve','Final',5,'100%','Pressure + Leak Test','2024-06-01','2027-12-31','Emma Richter','Active'],
      ['QP-009','Wiring Continuity Check','Wiring Harness','In-Process',3,'100%','Continuity + Pull Test','2024-01-01','2026-12-31','Emma Richter','Active'],
      ['QP-010','PSU Electrical Test','Power Supply Unit','Final',7,'100%','Voltage + Load Test','2024-01-01','2026-12-31','Emma Richter','Active'],
      ['QP-011','Annual Process Audit','All Materials','Audit',20,'N/A','Process Audit Checklist','2026-01-01','2026-12-31','Emma Richter','Active'],
      ['QP-012','Packaging Integrity','Packaging Box Large','Final',3,'Sample 5%','Drop + Compression Test','2025-01-01','2027-12-31','Carlos Santos','Active'],
      ['QP-013','Chemical Purity Test','Chemical Compound A','Incoming',4,'Per Batch','Spectroscopy + pH','2025-01-01','2027-12-31','Emma Richter','Active'],
      ['QP-014','New Sensor v2 Validation','Industrial Sensor v2','Final',10,'100%','Full Characterization','2026-01-01','2028-12-31','Raj Patel','In Development'],
      ['QP-015','Server Acceptance Test','Server PowerEdge','Incoming',6,'100%','Burn-in + Benchmark','2023-01-01','2027-12-31','Jan Becker','Active'],
    ]);

    // SEED STORAGE_BINS
    await ins('storage_bins', ['bin_id','warehouse','storage_type','section','aisle','level','max_capacity','current_stock','capacity_unit','material_type_restriction','status'], [
      ['WH01-A01-01','WH01','High Rack','A','01','01',100,50,'EA','IT Equipment','Available'],
      ['WH01-A01-02','WH01','High Rack','A','01','02',100,75,'EA','IT Equipment','Available'],
      ['WH01-A02-01','WH01','High Rack','A','02','01',50,25,'EA','Network Equipment','Available'],
      ['WH01-B01-01','WH01','Floor','B','01','00',500,200,'EA','Server Hardware','Available'],
      ['WH02-A01-01','WH02','Shelf','A','01','01',200,120,'EA','Office Supplies','Available'],
      ['WH02-A01-02','WH02','Shelf','A','01','02',200,180,'EA','Office Equipment','Full'],
      ['WH02-B01-01','WH02','Floor','B','01','00',300,75,'EA','Furniture','Available'],
      ['WH03-A01-01','WH03','High Rack','A','01','01',1000,500,'EA','Electronic Components','Available'],
      ['WH03-A02-01','WH03','High Rack','A','02','01',500,250,'EA','Mechanical Parts','Available'],
      ['WH03-B01-01','WH03','Block','B','01','00',5000,2500,'EA','Raw Materials','Available'],
      ['WH03-C01-01','WH03','Picking','C','01','01',200,80,'EA','Finished Goods','Available'],
      ['WH03-Q01-01','WH03','Floor','Q','01','00',100,15,'EA','Quality Hold','Reserved'],
      ['WH04-A01-01','WH04','Hazardous','A','01','01',2000,1500,'KG','Chemicals','Available'],
      ['WH04-A01-02','WH04','Hazardous','A','01','02',1000,500,'KG','Chemicals','Available'],
      ['WH05-A01-01','WH05','Floor','A','01','00',10000,3000,'EA','Packaging','Available'],
    ]);

    // SEED WAREHOUSE_ORDERS
    await ins('warehouse_orders', ['order_number','order_type','material','quantity','unit','source_bin','destination_bin','warehouse','priority','assigned_to','status'], [
      ['WHO-2026-001','Put Away','Dell PowerEdge R750',25,'EA','RECEIVING','WH01-B01-01','WH01','Normal','Oliver Fischer','Confirmed'],
      ['WHO-2026-002','Pick','Lenovo ThinkPad X1',10,'EA','WH02-A01-02','SHIPPING','WH02','High','Oliver Fischer','In Progress'],
      ['WHO-2026-003','Transfer','Industrial Sensor',50,'EA','WH03-A01-01','WH03-C01-01','WH03','Normal','Carlos Santos','Created'],
      ['WHO-2026-004','Put Away','Chemical Compound A',1000,'KG','RECEIVING','WH04-A01-01','WH04','Urgent','Carlos Santos','In Progress'],
      ['WHO-2026-005','Pick','Assembled Pump Unit',5,'EA','WH03-C01-01','SHIPPING','WH03','High','Oliver Fischer','Confirmed'],
      ['WHO-2026-006','Replenishment','Rubber Components',500,'EA','WH03-B01-01','WH03-A02-01','WH03','Normal','Carlos Santos','Created'],
      ['WHO-2026-007','Inventory Count','All Materials',0,'EA','WH01-A01-01','WH01-A01-01','WH01','Low','Oliver Fischer','Created'],
      ['WHO-2026-008','Transfer','Safety Helmets',100,'EA','WH02-A01-01','WH03-A01-01','WH03','Normal','Carlos Santos','Confirmed'],
      ['WHO-2026-009','Pick','Control Board v3',20,'EA','WH03-A01-01','PRODUCTION','WH03','Urgent','Oliver Fischer','In Progress'],
      ['WHO-2026-010','Put Away','Cisco Network Switch',10,'EA','RECEIVING','WH01-A02-01','WH01','Normal','Oliver Fischer','Created'],
      ['WHO-2026-011','Transfer','Defective Sensors',15,'EA','WH03-A01-01','WH03-Q01-01','WH03','High','Emma Richter','Confirmed'],
      ['WHO-2026-012','Pick','Electric Motor 5kW',10,'EA','WH03-A02-01','PRODUCTION','WH03','Normal','Carlos Santos','Created'],
      ['WHO-2026-013','Replenishment','PCB Assembly',100,'EA','WH03-B01-01','WH03-A01-01','WH03','Normal','Oliver Fischer','Created'],
      ['WHO-2026-014','Inventory Count','All Materials',0,'EA','WH03-A01-01','WH03-A01-01','WH03','Low','Emma Richter','Created'],
      ['WHO-2026-015','Put Away','Packaging Boxes',2000,'EA','RECEIVING','WH05-A01-01','WH05','Low','Carlos Santos','Confirmed'],
    ]);

    // SEED STOCK_TRANSFERS
    await ins('stock_transfers', ['transfer_number','material','description','quantity','unit','from_plant','from_storage','to_plant','to_storage','transfer_date','shipping_type','status'], [
      ['ST-2026-001','Lenovo ThinkPad X1','Laptop transfer to Munich',50,'EA','2000','WH02','2000','MUNICH','2026-02-15','Internal','Received'],
      ['ST-2026-002','Dell PowerEdge R750','Servers to Dublin DC',10,'EA','1000','WH01','4000','DUBLIN','2026-03-01','Intercompany','In Transit'],
      ['ST-2026-003','Industrial Sensor','Sensors to Merck project',100,'EA','3000','WH03','3000','MERCK-SITE','2026-03-10','Cross-Plant','Created'],
      ['ST-2026-004','Safety Helmets','PPE to production plant',200,'EA','2000','WH02','3000','WH03','2026-02-20','Internal','Received'],
      ['ST-2026-005','Control Board v3','Boards for Bosch project',50,'EA','3000','WH03','3000','BOSCH-SITE','2026-03-15','Cross-Plant','Created'],
      ['ST-2026-006','Chemical Compound A','Chemicals rebalance',500,'KG','3000','WH04','3000','WH04-B','2026-02-28','Internal','Received'],
      ['ST-2026-007','Assembled Pump Unit','Pumps to BASF',10,'EA','3000','WH03','3000','BASF-SITE','2026-03-05','Cross-Plant','In Transit'],
      ['ST-2026-008','Network Cable Cat6','Cables to Munich office',1000,'M','1000','WH01','2000','WH02','2026-03-01','Internal','Received'],
      ['ST-2026-009','Office Chairs','Furniture to new Dublin office',25,'EA','2000','WH02','4000','DUBLIN','2026-04-01','Intercompany','Created'],
      ['ST-2026-010','GPU Server Unit','GPU servers for AI lab',2,'EA','1000','WH01','1000','AI-LAB','2026-02-10','Internal','Received'],
      ['ST-2026-011','Electric Motor 5kW','Motors to assembly line',20,'EA','3000','WH03','3000','LINE-1','2026-03-20','Internal','Created'],
      ['ST-2026-012','Packaging Box Large','Packaging to shipping',500,'EA','3000','WH05','3000','SHIPPING','2026-03-01','Internal','Received'],
      ['ST-2026-013','Rubber Components','Components to line 2',300,'EA','3000','WH03','3000','LINE-2','2026-03-12','Internal','In Transit'],
      ['ST-2026-014','Server PowerEdge','Server refresh Singapore',5,'EA','1000','WH01','5000','SG-DC','2026-04-15','Intercompany','Created'],
      ['ST-2026-015','Laptop ThinkPad X1','Laptops for new hires',20,'EA','2000','WH02','1000','WALLDORF','2026-03-25','Internal','Created'],
    ]);

    // SEED DELIVERIES
    await ins('deliveries', ['delivery_number','sales_order','customer_name','ship_to_address','delivery_date','actual_ship_date','carrier','tracking_number','total_weight','weight_unit','total_volume','status'], [
      ['DL-2026-001','ORD-2026-001','BASF','Carl-Bosch-Str 38, Ludwigshafen','2026-02-10','2026-02-08','DHL Express','DHL-2026-001001',25.0,'KG',0.5,'Delivered'],
      ['DL-2026-002','ORD-2026-002','Siemens','Werner-von-Siemens 1, Munich','2026-01-15','2026-01-14','UPS','UPS-2026-002001',15.0,'KG',0.3,'Delivered'],
      ['DL-2026-003','ORD-2026-003','BMW','Petuelring 130, Munich','2026-03-20',null,'DHL Express',null,20.0,'KG',0.4,'Created'],
      ['DL-2026-004','ORD-2026-004','Bosch','Robert-Bosch-Platz 1, Stuttgart','2026-04-01',null,'FedEx',null,18.0,'KG',0.35,'Created'],
      ['DL-2026-005','ORD-2026-005','Volkswagen','Berliner Ring 2, Wolfsburg','2025-12-20','2025-12-19','DHL Express','DHL-2025-005001',22.0,'KG',0.45,'Delivered'],
      ['DL-2026-006','ORD-2026-006','SAP SE','Dietmar-Hopp 16, Walldorf','2025-10-15','2025-10-14','Internal','INT-2025-006001',5.0,'KG',0.1,'Delivered'],
      ['DL-2026-007','ORD-2026-007','Allianz','Koeniginstr 28, Munich','2026-02-28','2026-02-27','UPS','UPS-2026-007001',12.0,'KG',0.25,'Shipped'],
      ['DL-2026-008','ORD-2026-008','E.ON','Bruessel Platz 1, Essen','2026-01-01','2025-12-30','DHL Express','DHL-2025-008001',10.0,'KG',0.2,'Delivered'],
      ['DL-2026-009','ORD-2026-010','Bayer','Kaiser-Wilhelm 1, Leverkusen','2026-03-15',null,'FedEx',null,16.0,'KG',0.3,'Picked'],
      ['DL-2026-010','ORD-2026-011','Continental','Vahrenwalder 9, Hanover','2025-10-15','2025-10-13','DHL Express','DHL-2025-010001',14.0,'KG',0.28,'Delivered'],
      ['DL-2026-011','ORD-2026-012','Henkel','Henkelstr 67, Dusseldorf','2026-06-15',null,null,null,20.0,'KG',0.4,'Created'],
      ['DL-2026-012','ORD-2026-013','Merck','Frankfurter 250, Darmstadt','2026-04-25',null,'UPS',null,18.0,'KG',0.35,'Created'],
      ['DL-2026-013','ORD-2026-014','ThyssenKrupp','ThyssenKrupp Allee, Essen','2025-12-01','2025-11-29','DHL Express','DHL-2025-013001',8.0,'KG',0.15,'Delivered'],
      ['DL-2026-014','ORD-2026-015','Daimler','Mercedesstr 120, Stuttgart','2026-03-05',null,'FedEx',null,12.0,'KG',0.25,'Packed'],
      ['DL-2026-015','ORD-2026-009','Deutsche Bank','Taunusanlage 12, Frankfurt','2026-05-10',null,null,null,15.0,'KG',0.3,'Created'],
    ]);

    // SEED SHIPMENTS
    await ins('shipments', ['shipment_number','carrier','transport_mode','origin','destination','departure_date','arrival_date','total_weight','total_volume','freight_cost','tracking_number','status'], [
      ['SH-2026-001','DHL Express','Road','Walldorf','Ludwigshafen','2026-02-08','2026-02-09',25.0,0.5,450,'DHL-2026-001001','Delivered'],
      ['SH-2026-002','UPS','Road','Walldorf','Munich','2026-01-14','2026-01-15',15.0,0.3,380,'UPS-2026-002001','Delivered'],
      ['SH-2026-003','DHL Express','Road','Walldorf','Wolfsburg','2025-12-19','2025-12-20',22.0,0.45,520,'DHL-2025-003001','Delivered'],
      ['SH-2026-004','UPS','Road','Walldorf','Munich','2026-02-27','2026-02-28',12.0,0.25,350,'UPS-2026-004001','Delivered'],
      ['SH-2026-005','DHL Express','Road','Walldorf','Essen','2025-12-30','2025-12-31',10.0,0.2,320,'DHL-2025-005001','Delivered'],
      ['SH-2026-006','FedEx','Air','Walldorf','New York','2026-03-15','2026-03-17',30.0,0.6,2800,'FDX-2026-006001','In Transit'],
      ['SH-2026-007','DHL Express','Road','Stuttgart','Hanover','2025-10-13','2025-10-14',14.0,0.28,420,'DHL-2025-007001','Delivered'],
      ['SH-2026-008','DB Schenker','Rail','Walldorf','Essen','2025-11-29','2025-12-01',8.0,0.15,180,'DBS-2025-008001','Delivered'],
      ['SH-2026-009','Kuehne+Nagel','Sea','Hamburg','Shanghai','2026-04-01','2026-05-15',5000.0,25.0,12000,null,'Planned'],
      ['SH-2026-010','DHL Express','Air','Walldorf','Tokyo','2026-03-20','2026-03-22',45.0,0.9,3500,'DHL-2026-010001','Planned'],
      ['SH-2026-011','FedEx','Road','Stuttgart','Dusseldorf','2026-04-10','2026-04-11',20.0,0.4,380,null,'Planned'],
      ['SH-2026-012','UPS','Road','Walldorf','Darmstadt','2026-04-20','2026-04-21',18.0,0.35,290,null,'Planned'],
      ['SH-2026-013','DHL Express','Road','Walldorf','Stuttgart','2026-03-03','2026-03-04',12.0,0.25,250,null,'Planned'],
      ['SH-2026-014','Maersk','Sea','Rotterdam','Singapore','2026-05-01','2026-06-15',2000.0,10.0,8500,null,'Planned'],
      ['SH-2026-015','DHL Express','Intermodal','Walldorf','Dublin','2026-04-15','2026-04-18',500.0,5.0,4200,null,'Planned'],
    ]);

    // SEED BILLING_DOCUMENTS
    await ins('billing_documents', ['billing_number','customer_name','sales_order','delivery_number','billing_type','amount','tax','total','billing_date','payment_terms','currency','status'], [
      ['BD-2026-001','BASF','ORD-2026-001','DL-2026-001','Invoice',4275000,812250,5087250,'2026-02-10','Net 30','EUR','Released'],
      ['BD-2026-002','Siemens','ORD-2026-002','DL-2026-002','Invoice',1104000,209760,1313760,'2026-01-15','Net 30','EUR','Released'],
      ['BD-2026-003','Volkswagen','ORD-2026-005','DL-2026-005','Invoice',1674000,317340,1991340,'2025-12-20','Net 30','EUR','Released'],
      ['BD-2026-004','SAP SE','ORD-2026-006','DL-2026-006','Invoice',357000,67830,424830,'2025-10-15','Net 15','EUR','Released'],
      ['BD-2026-005','E.ON','ORD-2026-008','DL-2026-008','Invoice',560000,106400,666400,'2026-01-01','Net 30','EUR','Released'],
      ['BD-2026-006','Continental','ORD-2026-011','DL-2026-010','Invoice',1034000,196460,1230460,'2025-10-15','Net 30','EUR','Released'],
      ['BD-2026-007','ThyssenKrupp','ORD-2026-014','DL-2026-013','Invoice',340000,64600,404600,'2025-12-01','Net 30','EUR','Released'],
      ['BD-2026-008','Allianz','ORD-2026-007','DL-2026-007','Invoice',756600,143676,900276,'2026-02-28','Net 30','EUR','Created'],
      ['BD-2026-009','BASF','ORD-2026-001',null,'Down Payment',1000000,190000,1190000,'2026-01-05','Net 15','EUR','Released'],
      ['BD-2026-010','Daimler','ORD-2026-015',null,'Pro Forma',650000,123500,773500,'2026-02-01','Net 30','EUR','Released'],
      ['BD-2026-011','BMW','ORD-2026-003',null,'Pro Forma',863300,163947,1027247,'2026-01-25','Net 45','EUR','Released'],
      ['BD-2026-012','Henkel',null,null,'Credit Memo',-50000,-9500,-59500,'2026-02-15','Net 30','EUR','Released'],
      ['BD-2026-013','Bosch','ORD-2026-004',null,'Down Payment',500000,95000,595000,'2026-02-05','Net 30','EUR','Released'],
      ['BD-2026-014','Deutsche Bank','ORD-2026-009',null,'Pro Forma',1425000,270750,1695750,'2026-02-15','Net 60','EUR','Created'],
      ['BD-2026-015','Merck','ORD-2026-013',null,'Pro Forma',1852500,351975,2204475,'2026-02-20','Net 45','EUR','Created'],
    ]);

    // SEED RETURNS
    await ins('returns', ['return_number','customer_name','original_order','original_delivery','reason','quantity','amount','return_date','inspection_result','refund_status','status','notes'], [
      ['RT-2026-001','Henkel','ORD-2026-012','DL-2026-011','Defective',1,50000,'2026-02-20','Accepted','Processed','Closed','Defective license key replaced'],
      ['RT-2026-002','ThyssenKrupp','ORD-2026-014','DL-2026-013','Wrong Item',1,15000,'2026-01-05','Accepted','Processed','Closed','Wrong edition shipped'],
      ['RT-2026-003','Continental','ORD-2026-011','DL-2026-010','Customer Changed Mind',1,120000,'2025-11-01','Accepted','Processed','Closed','Switched to different product'],
      ['RT-2026-004','Bayer','ORD-2026-010',null,'Not as Described',1,85000,'2026-03-01','Pending','Pending','Received','Feature mismatch claimed'],
      ['RT-2026-005','Allianz','ORD-2026-007','DL-2026-007','Damaged',1,45000,'2026-03-05','Pending','Pending','Created','Damaged during shipping'],
      ['RT-2026-006','BMW','ORD-2026-003',null,'Duplicate Order',1,120000,'2026-02-10','Accepted','Pending','Inspected','Duplicate license purchased'],
      ['RT-2026-007','E.ON','ORD-2026-008','DL-2026-008','Defective',1,25000,'2026-01-15','Rejected','Denied','Closed','No defect found on inspection'],
      ['RT-2026-008','Siemens','ORD-2026-002','DL-2026-002','Not as Described',1,60000,'2026-02-01','Pending','Pending','Received','Module functionality dispute'],
      ['RT-2026-009','Daimler','ORD-2026-015',null,'Customer Changed Mind',1,95000,'2026-02-25','Pending','Pending','Created','Budget reallocation'],
      ['RT-2026-010','BASF','ORD-2026-001','DL-2026-001','Defective',1,35000,'2026-02-15','Accepted','Processed','Closed','Integration module issue'],
      ['RT-2026-011','Deutsche Bank','ORD-2026-009',null,'Wrong Item',1,75000,'2026-03-10','Pending','Pending','Created','Wrong tier shipped'],
      ['RT-2026-012','Merck','ORD-2026-013',null,'Not as Described',1,110000,'2026-03-15','Pending','Pending','Created','Performance below specs'],
      ['RT-2026-013','Volkswagen','ORD-2026-005','DL-2026-005','Damaged',1,40000,'2026-01-02','Accepted','Processed','Closed','Shipping damage to media'],
      ['RT-2026-014','SAP SE','ORD-2026-006','DL-2026-006','Duplicate Order',1,30000,'2025-10-20','Accepted','Processed','Closed','Internal duplicate'],
      ['RT-2026-015','Bosch','ORD-2026-004',null,'Customer Changed Mind',1,200000,'2026-03-20','Pending','Pending','Created','Scope change request'],
    ]);

    console.log('PM/QM/WM/SD data seeded');

    // ─── ARIBA - PROCUREMENT ──────────────────────────────────────────

    // SEED SOURCING EVENTS
    await ins('sourcing_events', ['event_number','event_type','title','category','estimated_value','currency','start_date','end_date','participants','awarded_to','savings_percent','owner','status'], [
      ['SE-2026-001','RFQ','Q1 IT Hardware Refresh','IT Hardware',450000,'EUR','2026-01-10','2026-02-10',8,'Siemens',12.5,'Nina Schmidt','Awarded'],
      ['SE-2026-002','RFP','ERP Consulting Services 2026','Professional Services',1200000,'EUR','2026-01-15','2026-03-15',5,'Deloitte DE',8.3,'Oliver Fischer','Awarded'],
      ['SE-2026-003','Reverse Auction','Office Supplies Annual Contract','Office Supplies',85000,'EUR','2026-02-01','2026-02-15',12,'Staples EU',22.0,'Emma Richter','Closed'],
      ['SE-2026-004','RFQ','Raw Material Procurement - Steel','Raw Materials',2500000,'EUR','2026-02-05','2026-03-05',6,null,null,'Marcus Hoffmann','In Evaluation'],
      ['SE-2026-005','RFI','Logistics Provider Assessment','Logistics',750000,'EUR','2026-01-20','2026-02-20',10,null,null,'Felix Wagner','Published'],
      ['SE-2026-006','RFP','Chemical Supply Agreement','Chemicals',1800000,'EUR','2025-11-01','2025-12-15',7,'BASF',10.2,'Carlos Santos','Awarded'],
      ['SE-2026-007','Reverse Auction','Packaging Materials','Raw Materials',320000,'EUR','2026-02-10','2026-02-28',15,null,null,'Jan Becker','Published'],
      ['SE-2026-008','RFQ','Machinery Spare Parts','Machinery',190000,'EUR','2026-01-05','2026-01-25',4,'Bosch Rexroth',6.8,'Nina Schmidt','Awarded'],
      ['SE-2026-009','RFP','IT Infrastructure Managed Services','Professional Services',950000,'EUR','2026-03-01','2026-04-15',6,null,null,'Oliver Fischer','Draft'],
      ['SE-2026-010','RFQ','Laboratory Chemicals Q2','Chemicals',410000,'EUR','2026-02-15','2026-03-15',9,null,null,'Raj Patel','In Evaluation'],
      ['SE-2026-011','Reverse Auction','Fleet Vehicle Leasing','Logistics',620000,'EUR','2025-10-01','2025-10-31',8,'Volkswagen Leasing',18.5,'Marcus Hoffmann','Closed'],
      ['SE-2026-012','RFI','Cloud Migration Partners','IT Hardware',3000000,'EUR','2026-02-20','2026-04-01',4,null,null,'Felix Wagner','Published'],
      ['SE-2026-013','RFQ','Safety Equipment Procurement','Raw Materials',145000,'EUR','2026-01-12','2026-02-01',7,'Draeger',9.1,'Emma Richter','Awarded'],
      ['SE-2026-014','RFP','Facility Management Services','Professional Services',500000,'EUR','2026-03-10','2026-04-30',3,null,null,'Carlos Santos','Draft'],
      ['SE-2026-015','Reverse Auction','Print & Copy Services','Office Supplies',65000,'EUR','2026-02-18','2026-03-04',11,null,null,'Jan Becker','Cancelled'],
    ]);

    // SEED PROCUREMENT CONTRACTS
    await ins('procurement_contracts', ['contract_number','title','vendor','category','contract_type','start_date','end_date','total_value','consumed_value','currency','payment_terms','renewal_type','owner','status'], [
      ['PC-2026-001','IT Hardware Framework 2026','Siemens','IT Hardware','Framework','2026-01-01','2026-12-31',500000,125000,'EUR','Net 30','Auto-Renew','Nina Schmidt','Active'],
      ['PC-2026-002','ERP Consulting Master Agreement','Deloitte DE','Professional Services','Time & Material','2026-02-01','2027-01-31',1200000,180000,'EUR','Net 45','Manual','Oliver Fischer','Active'],
      ['PC-2026-003','Office Supplies Blanket Order','Staples EU','Office Supplies','Blanket','2026-01-01','2026-12-31',85000,32000,'EUR','Net 15','Auto-Renew','Emma Richter','Active'],
      ['PC-2026-004','Chemical Supply Agreement','BASF','Chemicals','Fixed Price','2025-07-01','2026-06-30',1800000,1450000,'EUR','Net 30','Manual','Carlos Santos','Expiring Soon'],
      ['PC-2026-005','Logistics Services Contract','DHL Supply Chain','Logistics','Framework','2025-04-01','2026-03-31',750000,680000,'EUR','Net 30','Auto-Renew','Felix Wagner','Expiring Soon'],
      ['PC-2026-006','Machinery Maintenance Agreement','Bosch Rexroth','Machinery','Fixed Price','2026-01-15','2027-01-14',190000,30000,'EUR','Net 30','Manual','Jan Becker','Active'],
      ['PC-2026-007','Managed IT Services','T-Systems','IT Hardware','Time & Material','2025-01-01','2025-12-31',950000,950000,'EUR','Net 60','Manual','Oliver Fischer','Expired'],
      ['PC-2026-008','Fleet Leasing Agreement','Volkswagen Leasing','Logistics','Framework','2025-11-01','2027-10-31',620000,155000,'EUR','Net 30','Auto-Renew','Marcus Hoffmann','Active'],
      ['PC-2026-009','Safety Equipment Supply','Draeger','Raw Materials','Blanket','2026-02-01','2027-01-31',145000,12000,'EUR','Net 30','Manual','Emma Richter','Active'],
      ['PC-2026-010','Lab Chemicals Annual','Merck','Chemicals','Blanket','2025-06-01','2026-05-31',410000,340000,'EUR','Net 45','Auto-Renew','Raj Patel','Expiring Soon'],
      ['PC-2026-011','Packaging Materials 2025','Mondi Group','Raw Materials','Fixed Price','2025-01-01','2025-12-31',320000,320000,'EUR','Net 30','Manual','Jan Becker','Expired'],
      ['PC-2026-012','Facility Management','ISS Deutschland','Professional Services','Time & Material','2025-03-01','2026-02-28',500000,485000,'EUR','Net 30','Manual','Carlos Santos','Expiring Soon'],
      ['PC-2026-013','Print Services Agreement','Ricoh DE','Office Supplies','Fixed Price','2026-03-01','2027-02-28',65000,0,'EUR','Net 30','Auto-Renew','Nina Schmidt','Draft'],
      ['PC-2026-014','Steel Supply Contract','ThyssenKrupp','Raw Materials','Framework','2024-07-01','2025-06-30',2500000,2500000,'EUR','Net 60','Manual','Marcus Hoffmann','Expired'],
      ['PC-2026-015','Cloud Infrastructure','AWS EMEA','IT Hardware','Time & Material','2026-01-01','2027-12-31',3000000,250000,'EUR','Net 30','Auto-Renew','Felix Wagner','Active'],
    ]);

    // ─── SUCCESSFACTORS HCM ADDITIONS ─────────────────────────────────

    // SEED RECRUITING
    await ins('recruiting', ['requisition_id','job_title','department','location','hiring_manager','recruiter','candidates_count','interviews_scheduled','offers_extended','target_date','salary_range','employment_type','status'], [
      ['REQ-2026-001','Senior SAP Consultant','Consulting','Munich','Oliver Fischer','Nina Schmidt',24,6,2,'2026-03-15','85000-110000','Full-Time','In Progress'],
      ['REQ-2026-002','Data Engineer','IT','Berlin','Felix Wagner','Emma Richter',18,4,1,'2026-02-28','75000-95000','Full-Time','Offer Stage'],
      ['REQ-2026-003','Financial Analyst','Finance','Frankfurt','Marcus Hoffmann','Nina Schmidt',32,8,0,'2026-04-01','65000-80000','Full-Time','In Progress'],
      ['REQ-2026-004','Supply Chain Manager','Operations','Hamburg','Carlos Santos','Jan Becker',15,3,1,'2026-03-01','90000-115000','Full-Time','Offer Stage'],
      ['REQ-2026-005','Marketing Specialist','Marketing','Munich','Emma Richter','Nina Schmidt',41,5,0,'2026-04-15','55000-70000','Full-Time','Open'],
      ['REQ-2026-006','QA Engineer (Contract)','IT','Berlin','Felix Wagner','Jan Becker',12,2,1,'2026-02-15','60000-75000','Contract','Filled'],
      ['REQ-2026-007','HR Business Partner','Human Resources','Walldorf','Nina Schmidt','Emma Richter',22,4,0,'2026-05-01','70000-90000','Full-Time','In Progress'],
      ['REQ-2026-008','Plant Operator','Production','Stuttgart','Raj Patel','Jan Becker',8,3,2,'2026-02-20','45000-55000','Full-Time','Filled'],
      ['REQ-2026-009','Legal Counsel','Legal','Frankfurt','Marcus Hoffmann','Nina Schmidt',10,2,0,'2026-06-01','95000-120000','Full-Time','Open'],
      ['REQ-2026-010','Intern - Software Development','IT','Berlin','Felix Wagner','Emma Richter',56,10,3,'2026-04-01','28000-32000','Intern','In Progress'],
      ['REQ-2026-011','Procurement Specialist','Procurement','Walldorf','Carlos Santos','Jan Becker',19,5,1,'2026-03-10','60000-75000','Full-Time','Offer Stage'],
      ['REQ-2026-012','Sales Executive','Sales','Munich','Oliver Fischer','Nina Schmidt',27,6,0,'2026-04-30','70000-95000','Full-Time','On Hold'],
      ['REQ-2026-013','Logistics Coordinator','Operations','Hamburg','Raj Patel','Jan Becker',14,3,0,'2026-03-20','50000-62000','Full-Time','Open'],
      ['REQ-2026-014','Cloud Architect','IT','Berlin','Felix Wagner','Emma Richter',9,2,0,'2026-05-15','100000-130000','Full-Time','In Progress'],
      ['REQ-2026-015','Executive Assistant','Administration','Walldorf','Marcus Hoffmann','Nina Schmidt',35,4,0,'2026-03-01','42000-52000','Full-Time','Cancelled'],
    ]);

    // SEED ONBOARDING
    await ins('onboarding', ['onboarding_id','employee_name','position','department','start_date','buddy_assigned','it_setup_status','training_plan','documents_completed','orientation_date','manager','progress_percent','status'], [
      ['ONB-2026-001','Lukas Bauer','SAP Consultant','Consulting','2026-03-01','Oliver Fischer','Completed','SAP S/4HANA Fundamentals','8/8','2026-03-01','Oliver Fischer',100,'Completed'],
      ['ONB-2026-002','Sophia Weber','Data Engineer','IT','2026-03-15','Felix Wagner','In Progress','Data Pipeline & Cloud Training','5/8','2026-03-15','Felix Wagner',65,'In Progress'],
      ['ONB-2026-003','Maximilian Braun','QA Engineer','IT','2026-02-15','Jan Becker','Completed','QA Processes & Tools','8/8','2026-02-15','Felix Wagner',100,'Completed'],
      ['ONB-2026-004','Hannah Keller','Supply Chain Manager','Operations','2026-03-01','Carlos Santos','Completed','SCM Module Overview','6/8','2026-03-01','Carlos Santos',80,'In Progress'],
      ['ONB-2026-005','Tobias Schneider','Plant Operator','Production','2026-02-20','Raj Patel','Completed','Safety & Operations','8/8','2026-02-20','Raj Patel',100,'Completed'],
      ['ONB-2026-006','Amelie Zimmermann','Plant Operator','Production','2026-02-20','Raj Patel','Completed','Safety & Operations','7/8','2026-02-20','Raj Patel',90,'In Progress'],
      ['ONB-2026-007','Finn Hartmann','Intern - Software Dev','IT','2026-04-01','Felix Wagner','Not Started','Developer Onboarding','0/8','2026-04-01','Felix Wagner',0,'Not Started'],
      ['ONB-2026-008','Clara Meier','Intern - Software Dev','IT','2026-04-01','Jan Becker','Not Started','Developer Onboarding','0/8','2026-04-01','Felix Wagner',0,'Not Started'],
      ['ONB-2026-009','Leon Fischer','Intern - Software Dev','IT','2026-04-01','Emma Richter','Not Started','Developer Onboarding','0/8','2026-04-01','Felix Wagner',0,'Not Started'],
      ['ONB-2026-010','Marie Lehmann','Procurement Specialist','Procurement','2026-03-10','Carlos Santos','In Progress','Ariba & Procurement','3/8','2026-03-10','Carlos Santos',40,'In Progress'],
      ['ONB-2026-011','Paul Krause','Financial Analyst','Finance','2026-04-01','Marcus Hoffmann','Not Started','FI/CO Module Training','0/8','2026-04-01','Marcus Hoffmann',0,'Not Started'],
      ['ONB-2026-012','Lena Vogel','Marketing Specialist','Marketing','2026-04-15','Emma Richter','Not Started','Marketing Tools & CRM','0/8','2026-04-15','Emma Richter',0,'Not Started'],
      ['ONB-2026-013','Erik Lange','HR Business Partner','Human Resources','2026-05-01','Nina Schmidt','Not Started','SuccessFactors HCM','0/8','2026-05-01','Nina Schmidt',0,'Not Started'],
      ['ONB-2026-014','Anna Richter','Sales Executive','Sales','2026-02-01','Oliver Fischer','Completed','CRM & Sales Process','8/8','2026-02-01','Oliver Fischer',100,'Completed'],
      ['ONB-2026-015','David Schulz','Logistics Coordinator','Operations','2026-03-20','Raj Patel','Not Started','WM & Logistics Training','1/8','2026-03-20','Raj Patel',10,'In Progress'],
    ]);

    // SEED COMPENSATION
    await ins('compensation', ['plan_id','employee_name','department','current_salary','proposed_salary','increase_percent','bonus_target','bonus_actual','equity_grants','effective_date','review_cycle','approver','status'], [
      ['COMP-2026-001','Nina Schmidt','Human Resources',92000,97500,6.0,15000,16200,500,'2026-04-01','Annual 2026','Marcus Hoffmann','Approved'],
      ['COMP-2026-002','Oliver Fischer','Consulting',110000,118000,7.3,20000,22500,750,'2026-04-01','Annual 2026','Marcus Hoffmann','Approved'],
      ['COMP-2026-003','Felix Wagner','IT',105000,112000,6.7,18000,19800,600,'2026-04-01','Annual 2026','Marcus Hoffmann','Pending Approval'],
      ['COMP-2026-004','Carlos Santos','Operations',98000,104000,6.1,16000,15500,400,'2026-04-01','Annual 2026','Marcus Hoffmann','Pending Approval'],
      ['COMP-2026-005','Emma Richter','Marketing',78000,83000,6.4,12000,13100,300,'2026-04-01','Annual 2026','Marcus Hoffmann','Approved'],
      ['COMP-2026-006','Jan Becker','IT',88000,93500,6.3,14000,14800,450,'2026-04-01','Annual 2026','Felix Wagner','Pending Approval'],
      ['COMP-2026-007','Raj Patel','Production',95000,100000,5.3,15000,14200,350,'2026-04-01','Annual 2026','Carlos Santos','Approved'],
      ['COMP-2026-008','Marcus Hoffmann','Finance',125000,135000,8.0,25000,28000,1000,'2026-04-01','Annual 2026','Board','Implemented'],
      ['COMP-2026-009','Lukas Bauer','Consulting',85000,89000,4.7,12000,0,200,'2026-04-01','Annual 2026','Oliver Fischer','Draft'],
      ['COMP-2026-010','Sophia Weber','IT',75000,80000,6.7,10000,0,250,'2026-04-01','Annual 2026','Felix Wagner','Draft'],
      ['COMP-2026-011','Hannah Keller','Operations',90000,95000,5.6,14000,0,350,'2026-04-01','Annual 2026','Carlos Santos','Pending Approval'],
      ['COMP-2026-012','Anna Richter','Sales',70000,75000,7.1,20000,18500,200,'2026-04-01','Annual 2026','Oliver Fischer','Approved'],
      ['COMP-2026-013','Tobias Schneider','Production',48000,51000,6.3,5000,5200,0,'2026-04-01','Annual 2026','Raj Patel','Approved'],
      ['COMP-2026-014','Amelie Zimmermann','Production',47000,50000,6.4,5000,4800,0,'2026-04-01','Annual 2026','Raj Patel','Approved'],
      ['COMP-2026-015','Marie Lehmann','Procurement',62000,66000,6.5,8000,0,150,'2026-04-01','Annual 2026','Carlos Santos','Draft'],
    ]);

    // SEED SUCCESSION PLANNING
    await ins('succession_planning', ['plan_id','key_position','current_holder','department','successor_1','readiness_1','successor_2','readiness_2','development_plan','risk_level','last_reviewed','hr_partner','status'], [
      ['SP-2026-001','VP Operations','Carlos Santos','Operations','Raj Patel','Ready 1-2 Years','Hannah Keller','Ready 3+ Years','Leadership Development Program','Medium','2026-01-15','Nina Schmidt','Active'],
      ['SP-2026-002','CTO','Felix Wagner','IT','Jan Becker','Ready 1-2 Years','Sophia Weber','Ready 3+ Years','Technical Leadership Track','High','2026-01-15','Nina Schmidt','Active'],
      ['SP-2026-003','CFO','Marcus Hoffmann','Finance','Paul Krause','Ready 3+ Years',null,'Development Needed','Finance Leadership Rotation','Critical','2026-02-01','Nina Schmidt','Under Review'],
      ['SP-2026-004','Head of Consulting','Oliver Fischer','Consulting','Lukas Bauer','Ready 1-2 Years','Anna Richter','Ready 3+ Years','Client Management Training','Medium','2026-01-20','Emma Richter','Active'],
      ['SP-2026-005','Head of Marketing','Emma Richter','Marketing','Lena Vogel','Ready 3+ Years',null,'Development Needed','Marketing Strategy Program','High','2026-02-10','Nina Schmidt','Under Review'],
      ['SP-2026-006','Head of HR','Nina Schmidt','Human Resources','Erik Lange','Ready 3+ Years',null,'Development Needed','HR Leadership Certification','High','2026-01-25','Marcus Hoffmann','Active'],
      ['SP-2026-007','Plant Director','Raj Patel','Production','Tobias Schneider','Ready 1-2 Years','Amelie Zimmermann','Ready 3+ Years','Operational Excellence Program','Low','2026-01-10','Nina Schmidt','Active'],
      ['SP-2026-008','Head of Procurement','Carlos Santos','Procurement','Marie Lehmann','Ready 3+ Years',null,'Development Needed','Strategic Sourcing Training','Medium','2026-02-05','Nina Schmidt','Active'],
      ['SP-2026-009','Head of Legal','Marcus Hoffmann','Legal',null,'Development Needed',null,'Development Needed','External Hire Strategy','Critical','2026-02-15','Nina Schmidt','Draft'],
      ['SP-2026-010','Sales Director','Oliver Fischer','Sales','Anna Richter','Ready Now',null,null,'Sales Leadership Coaching','Low','2026-01-30','Emma Richter','Active'],
      ['SP-2026-011','IT Security Lead','Felix Wagner','IT','Jan Becker','Ready Now','Sophia Weber','Ready 1-2 Years','Cybersecurity Certification','Medium','2026-02-01','Nina Schmidt','Active'],
      ['SP-2026-012','Supply Chain Director','Carlos Santos','Operations','Hannah Keller','Ready 1-2 Years','David Schulz','Ready 3+ Years','SCM Advanced Certification','Medium','2026-01-20','Nina Schmidt','Active'],
      ['SP-2026-013','Data & Analytics Lead','Felix Wagner','IT','Sophia Weber','Ready 1-2 Years',null,null,'Data Science Leadership','Low','2026-02-10','Nina Schmidt','Active'],
      ['SP-2026-014','Compliance Officer','Marcus Hoffmann','Legal',null,'Development Needed',null,'Development Needed','Regulatory Affairs Program','High','2026-02-15','Nina Schmidt','Draft'],
      ['SP-2026-015','Regional Director DACH','Oliver Fischer','Sales','Anna Richter','Ready 1-2 Years','Lukas Bauer','Ready 3+ Years','Regional Management Training','Medium','2026-01-25','Emma Richter','Completed'],
    ]);

    // ─── CONCUR - TRAVEL ──────────────────────────────────────────────

    // SEED TRAVEL REQUESTS
    await ins('travel_requests', ['request_number','employee_name','department','destination','purpose','departure_date','return_date','estimated_cost','currency','advance_requested','approver','approval_date','status'], [
      ['TR-2026-001','Oliver Fischer','Consulting','London, UK','Client Workshop - Barclays','2026-03-10','2026-03-13',2800,'EUR',500,'Marcus Hoffmann','2026-02-20','Approved'],
      ['TR-2026-002','Felix Wagner','IT','Amsterdam, NL','AWS Summit Europe','2026-04-05','2026-04-07',1950,'EUR',0,'Marcus Hoffmann','2026-02-25','Approved'],
      ['TR-2026-003','Carlos Santos','Operations','Vienna, AT','Supply Chain Forum 2026','2026-03-20','2026-03-22',1600,'EUR',300,'Marcus Hoffmann','2026-02-18','Approved'],
      ['TR-2026-004','Nina Schmidt','Human Resources','Zurich, CH','SuccessFactors User Conference','2026-04-15','2026-04-17',3200,'EUR',0,'Marcus Hoffmann',null,'Submitted'],
      ['TR-2026-005','Emma Richter','Marketing','Paris, FR','Digital Marketing Summit','2026-05-10','2026-05-12',2100,'EUR',400,'Marcus Hoffmann',null,'Submitted'],
      ['TR-2026-006','Jan Becker','IT','Prague, CZ','SAP TechEd 2026','2026-06-01','2026-06-04',2400,'EUR',0,'Felix Wagner',null,'Draft'],
      ['TR-2026-007','Raj Patel','Production','Stuttgart, DE','Manufacturing Excellence Expo','2026-03-05','2026-03-06',450,'EUR',0,'Carlos Santos','2026-02-15','Completed'],
      ['TR-2026-008','Marcus Hoffmann','Finance','Frankfurt, DE','Annual Banking Summit','2026-04-20','2026-04-21',800,'EUR',0,'Board','2026-03-01','Approved'],
      ['TR-2026-009','Lukas Bauer','Consulting','Milan, IT','Client Kickoff - Luxottica','2026-03-25','2026-03-28',2650,'EUR',500,'Oliver Fischer','2026-02-22','Approved'],
      ['TR-2026-010','Anna Richter','Sales','Barcelona, ES','SAP Sales Connect','2026-05-05','2026-05-08',2900,'EUR',600,'Oliver Fischer',null,'Submitted'],
      ['TR-2026-011','Sophia Weber','IT','Dublin, IE','Data Engineering Conference','2026-04-10','2026-04-12',2200,'EUR',0,'Felix Wagner',null,'Draft'],
      ['TR-2026-012','Hannah Keller','Operations','Rotterdam, NL','Port & Logistics Tour','2026-03-15','2026-03-16',900,'EUR',0,'Carlos Santos','2026-02-20','Approved'],
      ['TR-2026-013','Oliver Fischer','Consulting','New York, US','SAP Sapphire 2026','2026-06-15','2026-06-20',6500,'EUR',1000,'Marcus Hoffmann',null,'Submitted'],
      ['TR-2026-014','Felix Wagner','IT','Munich, DE','CyberSec Conference','2026-02-28','2026-03-01',350,'EUR',0,'Marcus Hoffmann','2026-02-10','Completed'],
      ['TR-2026-015','Carlos Santos','Operations','Copenhagen, DK','Green Supply Chain Summit','2026-05-20','2026-05-22',2050,'EUR',0,'Marcus Hoffmann',null,'Cancelled'],
    ]);

    // SEED TRAVEL BOOKINGS
    await ins('travel_bookings', ['booking_id','travel_request','employee_name','booking_type','provider','departure','arrival','departure_date','return_date','cost','currency','confirmation_number','status'], [
      ['BK-2026-001','TR-2026-001','Oliver Fischer','Flight','Lufthansa','Munich (MUC)','London (LHR)','2026-03-10','2026-03-13',680,'EUR','LH-8843291','Confirmed'],
      ['BK-2026-002','TR-2026-001','Oliver Fischer','Hotel','Hilton London Tower','London','London','2026-03-10','2026-03-13',1350,'EUR','HLT-992847','Confirmed'],
      ['BK-2026-003','TR-2026-002','Felix Wagner','Train','Deutsche Bahn / Thalys','Berlin (Hbf)','Amsterdam (Centraal)','2026-04-05','2026-04-07',320,'EUR','DB-7723841','Confirmed'],
      ['BK-2026-004','TR-2026-002','Felix Wagner','Hotel','NH Amsterdam Schiphol','Amsterdam','Amsterdam','2026-04-05','2026-04-07',540,'EUR','NH-339021','Confirmed'],
      ['BK-2026-005','TR-2026-003','Carlos Santos','Flight','Austrian Airlines','Munich (MUC)','Vienna (VIE)','2026-03-20','2026-03-22',380,'EUR','OS-5521093','Confirmed'],
      ['BK-2026-006','TR-2026-003','Carlos Santos','Hotel','Motel One Vienna','Vienna','Vienna','2026-03-20','2026-03-22',290,'EUR','MO-881234','Confirmed'],
      ['BK-2026-007','TR-2026-007','Raj Patel','Car Rental','Sixt','Stuttgart (Hbf)','Stuttgart (Hbf)','2026-03-05','2026-03-06',95,'EUR','SX-4410287','Completed'],
      ['BK-2026-008','TR-2026-007','Raj Patel','Hotel','B&B Hotel Stuttgart','Stuttgart','Stuttgart','2026-03-05','2026-03-06',79,'EUR','BB-220198','Completed'],
      ['BK-2026-009','TR-2026-009','Lukas Bauer','Flight','Eurowings','Munich (MUC)','Milan (MXP)','2026-03-25','2026-03-28',420,'EUR','EW-6693012','Confirmed'],
      ['BK-2026-010','TR-2026-009','Lukas Bauer','Hotel','Starhotels Rosa Grand','Milan','Milan','2026-03-25','2026-03-28',780,'EUR','SH-554892','Confirmed'],
      ['BK-2026-011','TR-2026-012','Hannah Keller','Train','Deutsche Bahn / NS','Hamburg (Hbf)','Rotterdam (Centraal)','2026-03-15','2026-03-16',210,'EUR','DB-8834521','Confirmed'],
      ['BK-2026-012','TR-2026-012','Hannah Keller','Hotel','citizenM Rotterdam','Rotterdam','Rotterdam','2026-03-15','2026-03-16',139,'EUR','CM-773291','Confirmed'],
      ['BK-2026-013','TR-2026-014','Felix Wagner','Train','Deutsche Bahn','Berlin (Hbf)','Munich (Hbf)','2026-02-28','2026-03-01',150,'EUR','DB-2298741','Completed'],
      ['BK-2026-014','TR-2026-008','Marcus Hoffmann','Train','Deutsche Bahn','Walldorf','Frankfurt (Hbf)','2026-04-20','2026-04-21',85,'EUR','DB-1127653','Confirmed'],
      ['BK-2026-015','TR-2026-015','Carlos Santos','Flight','SAS Scandinavian','Munich (MUC)','Copenhagen (CPH)','2026-05-20','2026-05-22',510,'EUR','SK-3348120','Cancelled'],
    ]);

    // ─── IBP - PLANNING ───────────────────────────────────────────────

    // SEED DEMAND PLANS
    await ins('demand_plans', ['plan_id','product_family','region','planning_period','forecast_quantity','forecast_unit','confidence_level','actual_quantity','variance_percent','planner','last_updated','algorithm','status'], [
      ['DP-2026-001','Industrial Sensors','DACH','2026-Q1',12500,'Units',88,12100,-3.2,'Carlos Santos','2026-02-15','Statistical','Approved'],
      ['DP-2026-002','Industrial Sensors','DACH','2026-Q2',13200,'Units',82,null,null,'Carlos Santos','2026-02-15','ML-Based','Active'],
      ['DP-2026-003','Automotive Parts','Western Europe','2026-Q1',8400,'Units',91,8650,3.0,'Raj Patel','2026-02-10','Statistical','Approved'],
      ['DP-2026-004','Automotive Parts','Western Europe','2026-Q2',9100,'Units',85,null,null,'Raj Patel','2026-02-10','Consensus','Active'],
      ['DP-2026-005','Chemical Compounds','EMEA','2026-Q1',45000,'Liters',79,42800,-4.9,'Hannah Keller','2026-02-12','ML-Based','Approved'],
      ['DP-2026-006','Chemical Compounds','EMEA','2026-Q2',48000,'Liters',75,null,null,'Hannah Keller','2026-02-12','ML-Based','Active'],
      ['DP-2026-007','Packaging Materials','DACH','2026-Q1',320000,'Units',93,318500,-0.5,'Jan Becker','2026-02-08','Statistical','Approved'],
      ['DP-2026-008','Packaging Materials','DACH','2026-Q2',335000,'Units',90,null,null,'Jan Becker','2026-02-08','Statistical','Active'],
      ['DP-2026-009','Electronics Modules','Global','2026-Q1',5600,'Units',72,5200,-7.1,'Felix Wagner','2026-02-14','Consensus','Approved'],
      ['DP-2026-010','Electronics Modules','Global','2026-Q2',6100,'Units',68,null,null,'Felix Wagner','2026-02-14','ML-Based','Draft'],
      ['DP-2026-011','Safety Equipment','Nordics','2026-Q1',3800,'Units',86,3950,3.9,'Emma Richter','2026-02-11','Manual Override','Approved'],
      ['DP-2026-012','Safety Equipment','Nordics','2026-Q2',4000,'Units',83,null,null,'Emma Richter','2026-02-11','Statistical','Active'],
      ['DP-2026-013','Precision Tools','Eastern Europe','2026-Q1',7200,'Units',77,6900,-4.2,'Carlos Santos','2026-02-13','Statistical','Approved'],
      ['DP-2026-014','Precision Tools','Eastern Europe','2026-Q2',7800,'Units',74,null,null,'Carlos Santos','2026-02-13','Consensus','Draft'],
      ['DP-2026-015','Industrial Sensors','DACH','2025-Q4',11800,'Units',92,11950,1.3,'Carlos Santos','2026-01-05','Statistical','Archived'],
    ]);

    // SEED SUPPLY PLANS
    await ins('supply_plans', ['plan_id','product_family','region','planning_period','planned_quantity','available_capacity','utilization_percent','supply_source','lead_time_days','safety_stock','planner','last_updated','status'], [
      ['SP-PLN-2026-001','Industrial Sensors','DACH','2026-Q1',12500,14000,89.3,'Make to Stock',14,2500,'Raj Patel','2026-02-15','Approved'],
      ['SP-PLN-2026-002','Industrial Sensors','DACH','2026-Q2',13200,14000,94.3,'Make to Stock',14,2500,'Raj Patel','2026-02-15','Active'],
      ['SP-PLN-2026-003','Automotive Parts','Western Europe','2026-Q1',8400,10000,84.0,'Make to Order',21,1200,'Carlos Santos','2026-02-10','Approved'],
      ['SP-PLN-2026-004','Automotive Parts','Western Europe','2026-Q2',9100,10000,91.0,'Make to Order',21,1200,'Carlos Santos','2026-02-10','Active'],
      ['SP-PLN-2026-005','Chemical Compounds','EMEA','2026-Q1',45000,50000,90.0,'Make to Stock',28,8000,'Hannah Keller','2026-02-12','Approved'],
      ['SP-PLN-2026-006','Chemical Compounds','EMEA','2026-Q2',48000,50000,96.0,'Purchase',28,8000,'Hannah Keller','2026-02-12','Active'],
      ['SP-PLN-2026-007','Packaging Materials','DACH','2026-Q1',320000,350000,91.4,'Purchase',7,50000,'Jan Becker','2026-02-08','Approved'],
      ['SP-PLN-2026-008','Packaging Materials','DACH','2026-Q2',335000,350000,95.7,'Purchase',7,50000,'Jan Becker','2026-02-08','Active'],
      ['SP-PLN-2026-009','Electronics Modules','Global','2026-Q1',5600,6000,93.3,'Make to Order',35,800,'Felix Wagner','2026-02-14','Approved'],
      ['SP-PLN-2026-010','Electronics Modules','Global','2026-Q2',6100,6500,93.8,'Make to Order',35,900,'Felix Wagner','2026-02-14','Draft'],
      ['SP-PLN-2026-011','Safety Equipment','Nordics','2026-Q1',3800,4500,84.4,'Transfer',10,600,'Emma Richter','2026-02-11','Approved'],
      ['SP-PLN-2026-012','Safety Equipment','Nordics','2026-Q2',4000,4500,88.9,'Transfer',10,600,'Emma Richter','2026-02-11','Active'],
      ['SP-PLN-2026-013','Precision Tools','Eastern Europe','2026-Q1',7200,8000,90.0,'Make to Stock',18,1400,'Carlos Santos','2026-02-13','Approved'],
      ['SP-PLN-2026-014','Precision Tools','Eastern Europe','2026-Q2',7800,8000,97.5,'Make to Stock',18,1400,'Carlos Santos','2026-02-13','Active'],
      ['SP-PLN-2026-015','Industrial Sensors','DACH','2025-Q4',11800,14000,84.3,'Make to Stock',14,2500,'Raj Patel','2026-01-05','Archived'],
    ]);

    const extendedSapSeeds = {
      ewm_warehouse_tasks: { prefix: 'EWM-TASK', name: 'Warehouse Task', categories: ['Picking', 'Putaway', 'Replenishment', 'Physical Inventory', 'Exception'], area: 'Design to Operate' },
      ewm_wave_picks: { prefix: 'EWM-WAVE', name: 'Wave Pick', categories: ['Wave', 'Pick Pack', 'Staging', 'Labor', 'Outbound'], area: 'Design to Operate' },
      transportation_freight_orders: { prefix: 'TM-FO', name: 'Freight Order', categories: ['Road', 'Ocean', 'Air', 'Rail', 'Parcel'], area: 'Order to Cash' },
      transportation_planning: { prefix: 'TM-PLAN', name: 'Transportation Plan', categories: ['Lane', 'Tender', 'Optimizer', 'Carrier', 'Freight Unit'], area: 'Order to Cash' },
      project_system_wbs: { prefix: 'PS-WBS', name: 'WBS Element', categories: ['Capital Project', 'Customer Project', 'Internal Project', 'Milestone', 'Budget'], area: 'Plan to Produce' },
      project_system_networks: { prefix: 'PS-NET', name: 'Project Network', categories: ['Network', 'Activity', 'Confirmation', 'Procurement', 'Settlement'], area: 'Plan to Produce' },
      treasury_cash_positions: { prefix: 'TR-CASH', name: 'Cash Position', categories: ['Cash Position', 'Liquidity', 'Bank', 'Forecast', 'Exposure'], area: 'Record to Report' },
      treasury_deals: { prefix: 'TR-DEAL', name: 'Treasury Deal', categories: ['FX', 'Money Market', 'Loan', 'Hedge', 'Counterparty'], area: 'Record to Report' },
      grc_access_risks: { prefix: 'GRC-RISK', name: 'Access Risk', categories: ['SoD', 'Critical Access', 'Mitigation', 'Emergency Access', 'Role Risk'], area: 'Governance' },
      grc_controls: { prefix: 'GRC-CTRL', name: 'Process Control', categories: ['Preventive', 'Detective', 'Manual', 'Automated', 'Remediation'], area: 'Governance' },
      fieldglass_workers: { prefix: 'FG-WKR', name: 'External Worker', categories: ['Contingent', 'Services', 'Statement of Work', 'Supplier', 'Compliance'], area: 'Hire to Retire' },
      fieldglass_work_orders: { prefix: 'FG-WO', name: 'External Work Order', categories: ['Work Order', 'SOW', 'Service Entry', 'Approval', 'Invoice'], area: 'Procure to Pay' },
      commerce_catalogs: { prefix: 'CX-CAT', name: 'Commerce Catalog', categories: ['Catalog', 'Product', 'Price', 'Promotion', 'Storefront'], area: 'Lead to Cash' },
      commerce_carts: { prefix: 'CX-CART', name: 'Commerce Cart', categories: ['Cart', 'Checkout', 'Promotion', 'Order Capture', 'Abandoned'], area: 'Lead to Cash' },
      analytics_stories: { prefix: 'SAC', name: 'Analytics Story', categories: ['Dashboard', 'Planning', 'Predictive', 'Boardroom', 'KPI'], area: 'Record to Report' },
      datasphere_data_flows: { prefix: 'DSP-FLOW', name: 'Datasphere Data Flow', categories: ['Space', 'Data Product', 'Replication', 'Transformation', 'Lineage'], area: 'Governance' },
      subscription_contracts: { prefix: 'BRIM-SUB', name: 'Subscription Contract', categories: ['Subscription', 'Usage', 'Rating', 'Convergent Invoice', 'Revenue'], area: 'Lead to Cash' },
      group_reporting: { prefix: 'GRP-RPT', name: 'Group Reporting Task', categories: ['Consolidation', 'Elimination', 'Intercompany', 'Currency Translation', 'Close'], area: 'Record to Report' },
      ehs_incidents: { prefix: 'EHS-INC', name: 'EHS Incident', categories: ['Incident', 'Investigation', 'Corrective Action', 'Compliance', 'Risk'], area: 'Design to Operate' },
      real_estate_contracts: { prefix: 'REFX', name: 'Real Estate Contract', categories: ['Lease', 'Rental Object', 'Condition', 'Renewal', 'Valuation'], area: 'Record to Report' },
      plm_change_records: { prefix: 'PLM-CR', name: 'PLM Change Record', categories: ['Engineering Change', 'BOM Change', 'Specification', 'Release', 'Impact'], area: 'Design to Operate' },
      advanced_atp_checks: { prefix: 'AATP', name: 'ATP Check', categories: ['Availability', 'Allocation', 'Substitution', 'Backorder', 'Confirmation'], area: 'Order to Cash' },
      settlement_rebates: { prefix: 'SETL-RBT', name: 'Settlement Rebate', categories: ['Rebate', 'Accrual', 'Claim', 'Condition Contract', 'Settlement'], area: 'Procure to Pay' },
      localization_tax_rules: { prefix: 'LOC-TAX', name: 'Localization Tax Rule', categories: ['VAT', 'Withholding', 'E-Invoice', 'Statutory Report', 'Localization'], area: 'Record to Report' },
      basis_system_jobs: { prefix: 'BASIS-JOB', name: 'Basis System Job', categories: ['Batch Job', 'Transport', 'Dump', 'Lock', 'System Health'], area: 'Governance' },
      payroll_runs: { prefix: 'PY-RUN', name: 'Payroll Run', categories: ['Regular Payroll', 'Off Cycle', 'Retro', 'Posting', 'Exception'], area: 'Hire to Retire' },
      time_sheets: { prefix: 'CATS', name: 'Time Sheet', categories: ['Attendance', 'Overtime', 'Absence', 'Approval', 'Costing'], area: 'Hire to Retire' },
      mdg_change_requests: { prefix: 'MDG-CR', name: 'MDG Change Request', categories: ['Business Partner', 'Material', 'Supplier', 'Finance', 'Hierarchy'], area: 'Governance' },
      mdg_data_quality: { prefix: 'MDG-DQ', name: 'MDG Data Quality Rule', categories: ['Completeness', 'Duplicate', 'Validation', 'Enrichment', 'Remediation'], area: 'Governance' },
      central_finance_documents: { prefix: 'CFIN-DOC', name: 'Central Finance Document', categories: ['Replication', 'Mapping', 'Reconciliation', 'Error', 'Posted'], area: 'Record to Report' },
      central_finance_mappings: { prefix: 'CFIN-MAP', name: 'Central Finance Mapping', categories: ['Company Code', 'GL Account', 'Cost Object', 'Profit Center', 'Business Partner'], area: 'Record to Report' },
      credit_management_cases: { prefix: 'FSCM-CRD', name: 'Credit Management Case', categories: ['Blocked Order', 'Limit Review', 'Exposure', 'Score', 'Release'], area: 'Order to Cash' },
      dispute_management_cases: { prefix: 'FSCM-DSP', name: 'Dispute Management Case', categories: ['Deduction', 'Short Pay', 'Chargeback', 'Reason Code', 'Resolution'], area: 'Order to Cash' },
      collections_worklists: { prefix: 'FSCM-COL', name: 'Collections Worklist', categories: ['Worklist', 'Promise to Pay', 'Dunning', 'Aging', 'Escalation'], area: 'Order to Cash' },
      cash_application_items: { prefix: 'FSCM-CASH', name: 'Cash Application Item', categories: ['Lockbox', 'Remittance', 'Matching', 'Exception', 'Clearing'], area: 'Order to Cash' },
      integration_suite_flows: { prefix: 'CPI-IFLOW', name: 'Integration Flow', categories: ['iFlow', 'Mapping', 'Adapter', 'Message', 'Exception'], area: 'Governance' },
      btp_subaccounts: { prefix: 'BTP-SUB', name: 'BTP Subaccount', categories: ['Subaccount', 'Entitlement', 'Destination', 'Service', 'Space'], area: 'Governance' },
      event_mesh_topics: { prefix: 'EVT-MESH', name: 'Event Mesh Topic', categories: ['Topic', 'Queue', 'Subscription', 'Event Type', 'Delivery'], area: 'Governance' },
      api_management_products: { prefix: 'API-PROD', name: 'API Management Product', categories: ['API Product', 'Proxy', 'Policy', 'Subscription', 'Analytics'], area: 'Governance' },
      ilm_retention_policies: { prefix: 'ILM-POL', name: 'ILM Retention Policy', categories: ['Retention', 'Legal Hold', 'Destruction', 'Archive', 'Audit'], area: 'Governance' },
      document_management_files: { prefix: 'DMS-DIR', name: 'Document Management File', categories: ['DIR', 'Attachment', 'Version', 'Object Link', 'Release'], area: 'Governance' },
      variant_config_models: { prefix: 'VC-MODEL', name: 'Variant Configuration Model', categories: ['Characteristic', 'Class', 'Dependency', 'Constraint', 'Variant Price'], area: 'Design to Operate' },
      product_compliance_specs: { prefix: 'PC-SPEC', name: 'Product Compliance Spec', categories: ['Specification', 'Dangerous Goods', 'Declaration', 'Marketability', 'Safety'], area: 'Design to Operate' },
      service_management_orders: { prefix: 'SVC-ORD', name: 'Service Management Order', categories: ['Service Order', 'Warranty', 'Confirmation', 'Entitlement', 'Billing'], area: 'Design to Operate' },
      field_service_assignments: { prefix: 'FSM-ASG', name: 'Field Service Assignment', categories: ['Dispatch', 'Technician', 'Mobile', 'Parts', 'Completion'], area: 'Design to Operate' },
      customer_identity_profiles: { prefix: 'CDC-ID', name: 'Customer Identity Profile', categories: ['Identity', 'Consent', 'Profile', 'Provider', 'Privacy'], area: 'Lead to Cash' },
      customer_data_segments: { prefix: 'CDP-SEG', name: 'Customer Data Segment', categories: ['Audience', 'Trait', 'Event', 'Activation', 'Destination'], area: 'Lead to Cash' },
      industry_utilities_devices: { prefix: 'ISU-DEV', name: 'Utilities Device', categories: ['Device', 'Meter Reading', 'Installation', 'Service Point', 'Exception'], area: 'Industry Cloud' },
      industry_utilities_billing: { prefix: 'ISU-BILL', name: 'Utilities Billing Item', categories: ['Billing', 'Rate', 'Consumption', 'Invoice', 'Print'], area: 'Industry Cloud' },
      industry_retail_assortments: { prefix: 'RTL-AST', name: 'Retail Assortment', categories: ['Assortment', 'Site', 'Merchandise', 'Listing', 'Availability'], area: 'Industry Cloud' },
      industry_retail_promotions: { prefix: 'RTL-PROMO', name: 'Retail Promotion', categories: ['Promotion', 'Offer', 'Markdown', 'Campaign', 'Uplift'], area: 'Industry Cloud' },
      industry_oil_gas_nominations: { prefix: 'OIL-NOM', name: 'Oil & Gas Nomination', categories: ['Nomination', 'Ticket', 'Exchange', 'Balancing', 'Settlement'], area: 'Industry Cloud' },
      industry_banking_loans: { prefix: 'BNK-LOAN', name: 'Banking Loan', categories: ['Loan', 'Facility', 'Collateral', 'Risk', 'Servicing'], area: 'Industry Cloud' },
      industry_insurance_claims: { prefix: 'INS-CLM', name: 'Insurance Claim', categories: ['Claim', 'Policy', 'Reserve', 'Adjudication', 'Settlement'], area: 'Industry Cloud' },
      industry_public_sector_grants: { prefix: 'PSM-GRANT', name: 'Public Sector Grant', categories: ['Grant', 'Fund', 'Sponsor', 'Obligation', 'Compliance'], area: 'Industry Cloud' },
      industry_healthcare_cases: { prefix: 'HC-CASE', name: 'Healthcare Case', categories: ['Case', 'Service', 'Authorization', 'Billing', 'Outcome'], area: 'Industry Cloud' },
      industry_higher_ed_students: { prefix: 'HER-STU', name: 'Higher Ed Student', categories: ['Student', 'Program', 'Enrollment', 'Fees', 'Academic Status'], area: 'Industry Cloud' },
      industry_defense_contracts: { prefix: 'DEF-CTR', name: 'Defense Contract', categories: ['Contract', 'Program', 'Deliverable', 'Funding', 'Compliance'], area: 'Industry Cloud' },
      industry_aerospace_programs: { prefix: 'AERO-PGM', name: 'Aerospace Program', categories: ['Program', 'Work Package', 'Engineering Gate', 'Delivery', 'Readiness'], area: 'Industry Cloud' },
      sustainability_esg_metrics: { prefix: 'ESG-MET', name: 'Sustainability Metric', categories: ['Emissions', 'Energy', 'Water', 'Waste', 'Target'], area: 'Governance' },
      green_ledger_entries: { prefix: 'GLGRN', name: 'Green Ledger Entry', categories: ['Carbon Entry', 'Emission Factor', 'Allocation', 'Assurance', 'Disclosure'], area: 'Record to Report' },
      signavio_process_models: { prefix: 'SGN-MDL', name: 'Signavio Process Model', categories: ['Process Model', 'Variant', 'Owner', 'Lifecycle', 'Transformation'], area: 'Governance' },
      process_mining_cases: { prefix: 'MIN-CASE', name: 'Process Mining Case', categories: ['Bottleneck', 'Conformance', 'Automation', 'Variant', 'Value'], area: 'Governance' },
      cloud_alm_projects: { prefix: 'CALM-PRJ', name: 'Cloud ALM Project', categories: ['Implementation', 'Task', 'Deliverable', 'Deployment', 'Readiness'], area: 'Governance' },
      cloud_alm_operations: { prefix: 'CALM-OPS', name: 'Cloud ALM Operation', categories: ['Alert', 'Health', 'Exception', 'Integration', 'Operations'], area: 'Governance' },
      solution_manager_changes: { prefix: 'SOLMAN-CHG', name: 'Solution Manager Change', categories: ['Change', 'Transport', 'Approval', 'Retrofit', 'Release'], area: 'Governance' },
      solution_manager_test_plans: { prefix: 'SOLMAN-TST', name: 'Solution Manager Test Plan', categories: ['Test Plan', 'Script', 'Defect', 'Cycle', 'Evidence'], area: 'Governance' },
      leanix_applications: { prefix: 'LEANIX-APP', name: 'LeanIX Application', categories: ['Application', 'Capability', 'Lifecycle', 'Risk', 'Transformation'], area: 'Governance' },
      walkme_guidance: { prefix: 'WALKME', name: 'WalkMe Guidance Flow', categories: ['Guidance', 'Flow', 'Adoption', 'Friction', 'Completion'], area: 'Governance' },
      joule_skills: { prefix: 'JOULE', name: 'Joule Skill', categories: ['Skill', 'Prompt', 'Grounding', 'Action', 'Agent'], area: 'Governance' },
      ai_core_deployments: { prefix: 'AICORE', name: 'AI Core Deployment', categories: ['Scenario', 'Deployment', 'Pipeline', 'Endpoint', 'Runtime'], area: 'Governance' },
      build_apps_projects: { prefix: 'BUILD-APP', name: 'Build Apps Project', categories: ['App', 'Data Resource', 'Release', 'Citizen Dev', 'Mobile'], area: 'Governance' },
      build_process_automations: { prefix: 'BUILD-BPA', name: 'Build Process Automation', categories: ['Workflow', 'Decision', 'Bot', 'Form', 'Run'], area: 'Governance' },
      build_work_zone_sites: { prefix: 'BUILD-WZ', name: 'Build Work Zone Site', categories: ['Site', 'Page', 'Role', 'Content', 'Adoption'], area: 'Governance' },
      identity_authentication_apps: { prefix: 'IAS-APP', name: 'Identity Authentication App', categories: ['Application', 'Trust', 'Policy', 'Provider', 'Login'], area: 'Governance' },
      identity_provisioning_jobs: { prefix: 'IPS-JOB', name: 'Identity Provisioning Job', categories: ['Source', 'Target', 'Transformation', 'Job', 'Error'], area: 'Governance' },
      btp_abap_environments: { prefix: 'BTP-ABAP', name: 'BTP ABAP Environment', categories: ['ABAP System', 'Component', 'Service', 'Extension', 'Transport'], area: 'Governance' },
      btp_kyma_workloads: { prefix: 'BTP-KYMA', name: 'BTP Kyma Workload', categories: ['Workload', 'Service', 'Event', 'Function', 'Health'], area: 'Governance' },
      cap_services: { prefix: 'CAP-SRV', name: 'CAP Service', categories: ['Service', 'Entity', 'Deployment', 'API', 'Handler'], area: 'Governance' },
      hana_cloud_databases: { prefix: 'HANA-DB', name: 'HANA Cloud Database', categories: ['Database', 'Schema', 'Memory', 'Workload', 'Backup'], area: 'Governance' },
      bw4hana_queries: { prefix: 'BW4-QRY', name: 'BW/4HANA Query', categories: ['Query', 'InfoProvider', 'Transformation', 'Process Chain', 'Usage'], area: 'Record to Report' },
      data_intelligence_pipelines: { prefix: 'DI-PIPE', name: 'Data Intelligence Pipeline', categories: ['Pipeline', 'Operator', 'Connection', 'Schedule', 'Execution'], area: 'Governance' },
      successfactors_employee_central: { prefix: 'SF-EC', name: 'Employee Central Record', categories: ['Employee', 'Job Info', 'Event', 'Position', 'Effective Date'], area: 'Hire to Retire' },
      successfactors_learning: { prefix: 'SF-LMS', name: 'SuccessFactors Learning Item', categories: ['Item', 'Curriculum', 'Assignment', 'Completion', 'Compliance'], area: 'Hire to Retire' },
      successfactors_goals: { prefix: 'SF-GOAL', name: 'SuccessFactors Goal', categories: ['Goal', 'Objective', 'Calibration', 'Rating', 'Review'], area: 'Hire to Retire' },
      successfactors_workforce_analytics: { prefix: 'SF-WFA', name: 'Workforce Analytics Metric', categories: ['Headcount', 'Turnover', 'Diversity', 'Forecast', 'Benchmark'], area: 'Hire to Retire' },
      sales_cloud_opportunities: { prefix: 'C4C-OPP', name: 'Sales Cloud Opportunity', categories: ['Opportunity', 'Activity', 'Account Plan', 'Forecast', 'Pipeline'], area: 'Lead to Cash' },
      service_cloud_cases: { prefix: 'C4C-CASE', name: 'Service Cloud Case', categories: ['Case', 'Ticket', 'Entitlement', 'Routing', 'SLA'], area: 'Lead to Cash' },
      cpq_quotes: { prefix: 'CPQ', name: 'SAP CPQ Quote', categories: ['Quote', 'Configuration', 'Approval', 'Pricing', 'Proposal'], area: 'Lead to Cash' },
      emarsys_campaigns: { prefix: 'EMARSYS', name: 'Emarsys Campaign', categories: ['Campaign', 'Segment', 'Email', 'Personalization', 'Conversion'], area: 'Lead to Cash' },
      customer_checkout_pos: { prefix: 'CCO-POS', name: 'Customer Checkout POS', categories: ['POS', 'Till', 'Receipt', 'Payment', 'Sync'], area: 'Lead to Cash' },
      digital_payments: { prefix: 'DIGPAY', name: 'Digital Payment', categories: ['Payment', 'Provider', 'Token', 'Authorization', 'Settlement'], area: 'Lead to Cash' },
      digital_manufacturing_orders: { prefix: 'DMC-ORD', name: 'Digital Manufacturing Order', categories: ['Order', 'Operation', 'Shop Floor', 'Yield', 'Exception'], area: 'Design to Operate' },
      manufacturing_execution_operations: { prefix: 'MES-OP', name: 'MES Operation', categories: ['Operation', 'Labor', 'Machine', 'Quality Gate', 'Confirmation'], area: 'Design to Operate' },
      manufacturing_insights: { prefix: 'MFG-INS', name: 'Manufacturing Insight', categories: ['OEE', 'Downtime', 'Scrap', 'Throughput', 'Analytics'], area: 'Design to Operate' },
      asset_performance_models: { prefix: 'APM-MDL', name: 'Asset Performance Model', categories: ['Model', 'Indicator', 'Risk', 'Recommendation', 'Alert'], area: 'Design to Operate' },
      asset_network_collaboration: { prefix: 'AIC-NET', name: 'Asset Network Collaboration', categories: ['Equipment', 'Document', 'Partner', 'Collaboration', 'Model'], area: 'Design to Operate' },
      yard_logistics_appointments: { prefix: 'YL-APT', name: 'Yard Logistics Appointment', categories: ['Appointment', 'Door', 'Check In', 'Yard Move', 'Loading'], area: 'Order to Cash' },
      logistics_business_network_shipments: { prefix: 'LBN-SHP', name: 'Logistics Network Shipment', categories: ['Shipment', 'Tracking', 'Carrier', 'Milestone', 'Exception'], area: 'Order to Cash' },
      advanced_financial_close_tasks: { prefix: 'AFC-TASK', name: 'Advanced Financial Close Task', categories: ['Close Task', 'Dependency', 'Approval', 'Cockpit', 'Exception'], area: 'Record to Report' },
      revenue_accounting_contracts: { prefix: 'RAR-CTR', name: 'Revenue Accounting Contract', categories: ['Contract', 'Obligation', 'Allocation', 'Recognition', 'Posting'], area: 'Record to Report' },
      profitability_performance_models: { prefix: 'PAPM-MDL', name: 'PaPM Model', categories: ['Model', 'Function', 'Allocation', 'Simulation', 'Result'], area: 'Record to Report' },
      document_reporting_compliance: { prefix: 'DRC', name: 'Document Compliance Record', categories: ['E-Document', 'Statutory Report', 'Submission', 'Validation', 'Response'], area: 'Record to Report' },
      contract_accounts_receivable_payable: { prefix: 'FI-CA', name: 'Contract AR/AP Item', categories: ['Contract Account', 'Open Item', 'Clearing', 'Dunning', 'Payment'], area: 'Record to Report' },
      funds_management_budget: { prefix: 'FM-BUD', name: 'Funds Management Budget', categories: ['Budget', 'Commitment', 'Availability', 'Consumption', 'Fund'], area: 'Record to Report' },
      joint_venture_accounting: { prefix: 'JVA', name: 'Joint Venture Accounting Item', categories: ['Venture', 'Equity Group', 'Billing', 'Cutback', 'Settlement'], area: 'Record to Report' },
      commodity_management_deals: { prefix: 'CMDTY', name: 'Commodity Management Deal', categories: ['Deal', 'Exposure', 'Derivative', 'Pricing', 'Risk'], area: 'Record to Report' },
      trade_promotion_management: { prefix: 'TPM', name: 'Trade Promotion', categories: ['Promotion', 'Fund', 'Claim', 'Deduction', 'Settlement'], area: 'Lead to Cash' },
      sales_performance_management: { prefix: 'SPM', name: 'Sales Performance Plan', categories: ['Incentive', 'Commission', 'Crediting', 'Payout', 'Dispute'], area: 'Lead to Cash' },
      territory_quota_plans: { prefix: 'TQP', name: 'Territory Quota Plan', categories: ['Territory', 'Quota', 'Assignment', 'Capacity', 'Coverage'], area: 'Lead to Cash' },
      enterprise_portfolio_initiatives: { prefix: 'EPPM', name: 'Enterprise Portfolio Initiative', categories: ['Initiative', 'Investment', 'Dependency', 'Benefit', 'Risk'], area: 'Governance' },
      innovation_management_ideas: { prefix: 'INNO', name: 'Innovation Management Idea', categories: ['Idea', 'Campaign', 'Review', 'Score', 'Conversion'], area: 'Governance' },
      sourcing_supplier_network: { prefix: 'BN-SUP', name: 'Supplier Network Record', categories: ['Supplier', 'Onboarding', 'Collaboration', 'Profile', 'Transaction'], area: 'Procure to Pay' },
      supplier_risk_assessments: { prefix: 'SUP-RISK', name: 'Supplier Risk Assessment', categories: ['Risk', 'Incident', 'Rating', 'Alert', 'Mitigation'], area: 'Procure to Pay' },
      quality_issue_resolution: { prefix: 'QIR', name: 'Quality Issue Resolution', categories: ['Issue', 'Containment', 'Root Cause', 'Corrective Action', 'Verification'], area: 'Design to Operate' },
      audit_management_plans: { prefix: 'AUDIT', name: 'Audit Management Plan', categories: ['Audit Plan', 'Workpaper', 'Finding', 'Action', 'Sign Off'], area: 'Governance' },
      environment_management_permits: { prefix: 'ENV-PER', name: 'Environment Management Permit', categories: ['Permit', 'Limit', 'Monitoring', 'Exceedance', 'Compliance'], area: 'Governance' },
      waste_management_records: { prefix: 'WASTE', name: 'Waste Management Record', categories: ['Manifest', 'Disposal', 'Transporter', 'Recycling', 'Regulatory'], area: 'Governance' },
      mobile_start_cards: { prefix: 'MSTART', name: 'Mobile Start Card', categories: ['Card', 'Launch Target', 'Role', 'Usage', 'Task'], area: 'Governance' },
      fiori_launchpad_spaces: { prefix: 'FLP', name: 'Fiori Launchpad Space', categories: ['Space', 'Page', 'Catalog', 'Role', 'Tile'], area: 'Governance' },
      enable_now_content: { prefix: 'SEN', name: 'Enable Now Content', categories: ['Simulation', 'Document', 'Learning', 'Publishing', 'Usage'], area: 'Governance' },
      business_network_assets: { prefix: 'BN-AST', name: 'Business Network Asset', categories: ['Asset', 'Operator', 'Document', 'Maintenance', 'Sharing'], area: 'Design to Operate' },
      business_network_material_traceability: { prefix: 'BN-MAT', name: 'Material Traceability Record', categories: ['Batch', 'Provenance', 'Event', 'Genealogy', 'Recall'], area: 'Design to Operate' },
    };
    const owners = ['Marcus Hoffmann', 'Nina Schmidt', 'Carlos Santos', 'Felix Wagner', 'Raj Patel'];
    const statuses = ['Active', 'In Review', 'Approved', 'Completed', 'Blocked'];
    for (const [table, cfg] of Object.entries(extendedSapSeeds)) {
      await ins(
        table,
        ['code', 'name', 'category', 'process_area', 'owner', 'amount', 'currency', 'start_date', 'end_date', 'status', 'notes'],
        Array.from({ length: 15 }, (_, i) => {
          const n = i + 1;
          return [
            `${cfg.prefix}-2026-${String(n).padStart(3, '0')}`,
            `${cfg.name} ${String(n).padStart(2, '0')}`,
            cfg.categories[i % cfg.categories.length],
            cfg.area,
            owners[i % owners.length],
            25000 + n * 17500,
            i % 3 === 0 ? 'USD' : 'EUR',
            `2026-${String((i % 12) + 1).padStart(2, '0')}-01`,
            `2026-${String((i % 12) + 1).padStart(2, '0')}-28`,
            statuses[i % statuses.length],
            `${cfg.name} sample record for ${cfg.area} process coverage`,
          ];
        })
      );
    }
    console.log('Extended SAP modules seeded');

    console.log('Ariba/HCM/Concur/IBP data seeded');


await client.query('COMMIT');
    console.log('SAP CRM Database seeded successfully!');
    console.log('Login: admin@sapcrm.com / password123');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}
seed();
