# RiskLens

RiskLens is a smart inventory and risk analysis system designed for small and medium food and drink markets.

The goal of the project is to help businesses understand their stock, expiry risks, product costs, profit potential, and supplier data through a simple and clear dashboard.

## Project Overview

Food and drink markets deal with many challenges such as expiring products, low stock, pricing issues, and supplier management. RiskLens solves this by allowing users to upload product data and automatically analyze it.

Instead of manually checking products, the system highlights the most important problems so the business can react quickly.

## Main Features

- User authentication system
- Product dashboard
- CSV file upload
- Required column validation
- Low stock detection
- Expiry risk detection
- Inventory value calculation
- Profit and margin calculation
- Supplier tracking
- Clean and mobile-friendly UI

## CSV Format

The system requires a CSV file with the following columns:

name,stock_quantity,min_stock_level,cost_price,expiry_date,supplier_name

Example:

name,stock_quantity,min_stock_level,cost_price,expiry_date,supplier_name  
Milk 1L,18,15,0.90,2026-04-26,DairyFresh  
Bread White,9,20,0.50,2026-04-25,Bakery Local  
Water 1.5L,120,40,0.35,2027-12-31,AquaPure  

## How It Works

The user uploads a CSV file containing product data.

The system validates the file to ensure all required columns exist.

After validation, the data is processed and displayed in the dashboard.

The system analyzes each product and highlights risks such as low stock and expiry dates.

## Core Calculations

Inventory Value  
Inventory Value = Stock Quantity × Cost Price

Margin  
Margin = Selling Price − Cost Price

Margin Percentage  
Margin % = ((Selling Price − Cost Price) / Selling Price) × 100

Revenue  
Revenue = Stock Quantity × Selling Price

Total Profit  
Total Profit = (Selling Price − Cost Price) × Stock Quantity

Low Stock Logic  
If Stock Quantity < Minimum Stock Level → Low Stock Risk

Expiry Calculation  
Days Left = Expiry Date − Today

Risk Levels  
0–3 days → High Risk  
4–7 days → Medium Risk  
More than 7 days → Safe  

## Tech Stack

- React Native
- Expo
- TypeScript
- Supabase
- CSV parsing
- Dashboard-based UI

## Architecture

CSV Upload → Validation → Data Processing → Database → Dashboard → Risk Analysis

## Current Progress

We have successfully built the main dashboard, implemented CSV upload, added validation for required columns, and displayed product data with basic risk analysis.

The system already works with real data and shows useful insights for businesses.

## Challenges

- Handling different CSV formats and missing data
- Managing authentication and sessions
- Designing a simple and clean UI
- Converting raw data into useful insights
- Keeping the project realistic for real businesses

## Next Steps

- Improve dashboard with charts and analytics
- Add automatic alerts for expiry and low stock
- Implement supplier performance tracking
- Add demand and risk prediction
- Improve CSV templates and error handling
- Optimize performance and testing

## Future Vision

RiskLens aims to become a smart assistant for food and drink markets.

The goal is to help businesses reduce waste, avoid stock problems, and improve profitability by providing clear and actionable insights.

## Team Focus

This project focuses on real functionality, clear results, teamwork, and solving real-world business problems.
