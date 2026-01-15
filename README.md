# Sanitation Revolving Fund Model: Technical Documentation

## Overview
This model simulates a **Sanitation Revolving Fund** that blends **Impact Capital (Grant/Equity)** and **Senior Debt** to finance market-based sanitation solutions. It models the flow of capital from investors to the Fund, then to Micro-Enterprises (MEs) for capacity building, and finally to Households (HHs) for toilet construction.

## Core Financial Engines

### 1. Centralized Cashflow Engine (New)
The model uses a **Double-Entry Style Ledger** for every monthly cycle:
*   **Auditable Flows**: Net Cash Flow is calculated strictly as `Sum(Inflows) - Sum(Outflows)`.
*   **Line-Item Granularity**: Revenue, Loan Repayments, Carbon Credits, Fixed Ops, Management Fees, and Defaults are tracked independently.
*   **Grant Accounting**: Grant disbursements are explicitly deducted from the Grant Fund as a cash outflow (`Toilets * Cost * GrantSupport%`).

### 2. Strict Financial Waterfall
Cash is allocated based on a rigid priority stack, ensuring the fund cannot "accidentally" spend money it owes to investors:
1.  **Senior Debt Service**: Principal + Interest to Investors (Must be paid first).
2.  **Fixed Operations**: Core staff and overhead (including a "Collections Floor" during hibernation).
3.  **Reserves**: 
    - **Debt Lookahead**: 3 months of future principal payments.
    - **Ops Buffer**: 3 months of fixed operational costs.
4.  **New Lending**: Loans and Grants are **only issued** if `Cash Balance > Reserves`.

### 3. Lifecycle Phases
*   **Grace Period Sprint**: During the Investor Grace Period, the fund builds capacity (MEs) while Debt Service is paused.
*   **Active Lending**: The fund lends to HHs based on demand.
    - **Growth Constraint**: Lending automatically stops if Solvency Guards (Reserves) are breached.
*   **Hibernation / Winding Down**: 
    - **Collections Mode**: If lending stops (due to end of term or insolvency), operations scale down to a minimum "Collections Team" (30% of peak cost) to ensure continued loan recovery without draining equity.
    - **M60 Stability**: This ensures the fund doesn't crash financially when winding down.

## Key Calculations

### Interest Rates
*   **Household Rate**: `Local Inflation + Risk Premium`.
*   **Real Rate Logic**: The model ensures `Nominal Rate > Inflation + Default Rate` to prevent capital erosion.

### Constraints & Buffers
*   **Debt Reserve**: A rolling buffer (3-Months) set aside for upcoming investor calls.
*   **Ops Buffer**: A liquidity reserve (3 months of Fixed Ops) to prevent operational insolvency.
*   **Primary Constraint Logic**: Growth is limited by the tightest of **Capital** (Cash Available), **Capacity** (Active MEs), or **Market Demand**.

## Data Sources
*   **World Bank API**: Used to fetch real-time Inflation (CPI), Lending Rates, and Poverty data to calibrate defaults and interest rates for the specific country context.
