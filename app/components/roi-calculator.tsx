"use client";

import { BadgeCheck, Calculator, Clock3, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";

const planOptions = [
  { label: "Starter", value: 390 },
  { label: "Growth", value: 790 },
  { label: "Managed baseline", value: 1500 }
];

export function RoiCalculator() {
  const [monthlyPlan, setMonthlyPlan] = useState(790);
  const [customerValue, setCustomerValue] = useState(250);
  const [extraCustomers, setExtraCustomers] = useState(4);
  const [hoursSaved, setHoursSaved] = useState(10);
  const [hourlyValue, setHourlyValue] = useState(60);

  const result = useMemo(() => {
    const customerRevenue = customerValue * extraCustomers;
    const timeValue = hoursSaved * hourlyValue;
    const monthlyUpside = customerRevenue + timeValue;
    const breakEvenCustomers = customerValue > 0 ? Math.ceil(monthlyPlan / customerValue) : 0;
    const netPlanningValue = monthlyUpside - monthlyPlan;

    return {
      customerRevenue,
      timeValue,
      monthlyUpside,
      breakEvenCustomers,
      netPlanningValue
    };
  }, [customerValue, extraCustomers, hourlyValue, hoursSaved, monthlyPlan]);

  return (
    <div className="roiCalculator" aria-label="VIDSLOOM break-even calculator">
      <div className="roiIntro">
        <p className="siteEyebrow">Break-Even Math</p>
        <h3>See how few extra customers can cover the monthly video engine.</h3>
        <p>
          Use conservative numbers. This is a planning tool, not a promise of views, revenue, or virality.
        </p>
      </div>
      <div className="roiControls">
        <label>
          <span>Plan</span>
          <select value={monthlyPlan} onChange={(event) => setMonthlyPlan(Number.parseInt(event.target.value, 10))}>
            {planOptions.map((plan) => (
              <option key={plan.label} value={plan.value}>
                {plan.label} - S${plan.value}/month
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Average customer value</span>
          <input
            min={1}
            type="number"
            value={customerValue}
            onChange={(event) => setCustomerValue(Number.parseInt(event.target.value || "0", 10))}
          />
        </label>
        <label>
          <span>Extra customers/month</span>
          <input
            min={0}
            type="number"
            value={extraCustomers}
            onChange={(event) => setExtraCustomers(Number.parseInt(event.target.value || "0", 10))}
          />
        </label>
        <label>
          <span>Owner hours saved/month</span>
          <input
            min={0}
            type="number"
            value={hoursSaved}
            onChange={(event) => setHoursSaved(Number.parseInt(event.target.value || "0", 10))}
          />
        </label>
        <label>
          <span>Owner hour value</span>
          <input
            min={0}
            type="number"
            value={hourlyValue}
            onChange={(event) => setHourlyValue(Number.parseInt(event.target.value || "0", 10))}
          />
        </label>
      </div>
      <div className="roiResults">
        <div>
          <Calculator size={18} />
          <span>Break-even</span>
          <strong>{result.breakEvenCustomers} customers</strong>
        </div>
        <div>
          <TrendingUp size={18} />
          <span>Revenue signal</span>
          <strong>S${result.customerRevenue.toLocaleString("en-SG")}</strong>
        </div>
        <div>
          <Clock3 size={18} />
          <span>Time value</span>
          <strong>S${result.timeValue.toLocaleString("en-SG")}</strong>
        </div>
        <div>
          <BadgeCheck size={18} />
          <span>Planning gap</span>
          <strong>{result.netPlanningValue >= 0 ? "+" : ""}S${result.netPlanningValue.toLocaleString("en-SG")}</strong>
        </div>
      </div>
      <p className="roiFinePrint">
        Best use: compare the plan cost against one measurable action, such as bookings, consultations, trial signups,
        product purchases, qualified DMs, or repeat customer orders.
      </p>
    </div>
  );
}
