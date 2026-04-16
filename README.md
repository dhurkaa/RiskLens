# RiskLens Food OS

RiskLens Food OS is a food retail intelligence platform built for grocery stores, minimarkets, food distributors, and inventory-driven food businesses.

Instead of showing only raw product data, the app helps businesses understand:

- which products are close to expiry
- which products are low on stock
- which products have weak margins
- which items have the highest operational risk
- what actions should be taken next
- how alerts and recommendations affect the business

The current version focuses on food products only.

## Core idea

RiskLens turns daily inventory data into practical operational intelligence.

A business can upload food product data through CSV, store everything in Supabase, and then use the app to:

- monitor stock health
- reduce waste exposure
- detect expiry pressure
- review pricing and margin issues
- analyze risky categories and suppliers
- generate operational recommendations

## Current features

### Dashboard
The dashboard provides a business overview with:

- total tracked products
- low stock products
- near expiry products
- waste pressure
- margin health
- inventory value
- recommendation opportunities
- supplier and category pressure summaries

### CSV Upload
The upload flow supports:

- CSV file selection
- CSV validation
- row preview before insert
- insert into `food_products`
- import log creation in `food_import_logs`
- automatic creation of alerts in `food_alerts`
- automatic creation of recommendations in `food_recommendations`

### Products page
The products page supports:

- product listing
- search by product, category, SKU, barcode, or supplier
- filters for low stock, near expiry, weak margin, and high risk
- product delete action
- sorted risk-first browsing

### Product details page
Each product has its own detail view with:

- stock and minimum stock
- selling price and cost price
- estimated margin
- expiry status
- supplier information
- related alerts
- related recommendations

### Edit product page
Products can be edited directly in the app:

- name
- category
- supplier
- SKU
- barcode
- stock quantity
- minimum stock level
- selling price
- cost price
- expiry date
- status

### Insights page
The insights page summarizes business intelligence such as:

- category pressure
- supplier risk
- alert severity breakdown
- recommendation mix
- top opportunity items
- business interpretation summary

## Tech stack

- Expo
- React Native
- Expo Router
- TypeScript
- Supabase
- PapaParse
- Expo Document Picker

## Database structure

The current implementation uses these core tables:

- `profiles`
- `food_products`
- `food_alerts`
- `food_recommendations`
- `food_import_logs`

### Main table purpose

#### `profiles`
Stores user information such as:

- full name
- business name
- email
- role

#### `food_products`
Stores product inventory fields such as:

- name
- category
- sku
- barcode
- stock quantity
- minimum stock level
- selling price
- cost price
- expiry date
- supplier name
- status

#### `food_alerts`
Stores generated business alerts, such as:

- low stock alerts
- expiry alerts
- pricing alerts
- compliance alerts

#### `food_recommendations`
Stores suggested actions, such as:

- discount
- restock
- price up
- price down

#### `food_import_logs`
Stores CSV upload history.

## Business logic currently implemented

The system currently generates operational intelligence using simple rules.

### Alert generation examples

- low stock when stock is at or below minimum level
- expiry alerts when a product is near expiry
- weak margin alerts when margin is too low
- compliance-style alerts when product fields are missing

### Recommendation generation examples

- discount recommendation for items close to expiry with enough stock to clear
- restock recommendation for low-stock items
- price-up recommendation for low-margin products
- price-down recommendation for products that should move faster before expiry

## Project structure

```bash
app/
  (tabs)/
    index.tsx           # dashboard
    upload.tsx          # CSV upload page
    products.tsx        # products list
    explore.tsx         # insights page
  product-details.tsx   # single product details
  edit-product.tsx      # edit product form

lib/
  supabase.ts           # Supabase client
