# Sanitation Revolving Fund Model: Technical Documentation

## Overview
This model simulates a **Sanitation Revolving Fund** that blends **Impact Capital (Grant/Equity)** and **Senior Debt** to finance market-based sanitation solutions. It models the flow of capital from investors to the Fund, then to Micro-Enterprises (MEs) for capacity building, and finally to Households (HHs) for toilet construction.

## Core Financial Engines

### 1. Capital Structure
*   **Grant Fund (Equity)**: First-loss capital used for setup costs, operational expenses, and bad debt absorption. The model **Auto-Sizes** this if the debt cannot be fully repaid.
*   **Loan Fund (Senior Debt)**: Repayable capital used exclusively for lending. It has **Senior Priority** on all cash inflows.

### 2. Generalized Repayment Engine (New)
The model now uses a robust **Lookahead Solver** to ensure solvency:
*   **Senior Priority**: Investor Principal Repayment is calculated *in advance* based on the inputs (Term, Grace Period) and is the #1 priority.
*   **Active Constraints**: Before issuing new loans, the model checks a **3-Month Liquidity Window**. If cash is insufficient to cover upcoming Debt Service + Ops, **New Lending serves as the shock absorber** and is reduced or paused.
*   **No "Magic" Fixes**: The model no longer automatically changes your Interest Rates or Terms. It simply stops lending if you run out of cash, forcing you to adjust the inputs (Grant %, Term) to find a viable model.

### 3. Senior Debt Schedule
Instead of a "Cash Sweep", the model builds a **Definitive Repayment Schedule**:
*   **Grace Period**: During the user-defined grace period (e.g. 6-12 months), no principal is paid, allowing the fund to build a portfolio.
*   **Amortization**: After the grace period, principal is due monthly. If the fund cannot pay, it is flagged as in **Default**.

### 4. Lifecycle Phases
*   **Grace Period Sprint**: During the Investor Grace Period, the fund aggressively builds capacity (hires MEs), temporarily bypassing strict solvency guards to creating a "Production Engine".
*   **Active Lending (M1-End)**: The fund lends to HHs and MEs based on demand density and liquidity.
    *   **Growth Freeze**: Lending slows if Cash < 2x Monthly Burn Rate.
    *   **ME Cap**: ME Exposure is capped at 15% of Total Capital to prioritize Toilet Assets.
*   **Winding Down (End + 12 Months)**: The model simulates an additional 12-month "Collection Tail".
    *   **Activity Stops**: No new loans are issued.
    *   **Harvest Mode**: Staffing reduces to collections-only.
    *   **Full Repayment**: All incoming inflows are swept to finalize Investor Repayment.

## Key Calculations

### Interest Rates
*   **Household Rate**: `Local Inflation + Risk Premium`.
*   **Real Rate Logic**: The model ensures `Nominal Rate > Inflation + Default Rate` to prevent capital erosion.

### Constraints & Buffers
*   **Debt Reserve**: A rolling buffer (3-6 months) set aside to ensure future debt payments can be met.
*   **Ops Buffer**: A liquidity reserve (3 months of Fixed Ops) to prevent operational insolvency.
*   **Primary Constraint Logic**: Growth is limited by the tightest of **Capital** (Cash Available), **Capacity** (Active MEs), or **Market Demand** (Population Saturation).

## Data Sources
*   **World Bank API**: Used to fetch real-time Inflation (CPI), Lending Rates, and Poverty data to calibrate defaults and interest rates for the specific country context.
