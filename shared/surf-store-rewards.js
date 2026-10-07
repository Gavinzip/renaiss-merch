// Notion section 6B: planned shop allocations, independent of the raffle pool.
// Holding requirements are confirmed; redemption remains unopened.
export const surfStoreRewards = Object.freeze([
  Object.freeze({ id: 'mystery-box', plannedQuantity: 3, approximateQuantity: false, status: 'planned', minimumSbtBalance: 120, redemptionUrl: null }),
  Object.freeze({ id: 'pro-month', plannedQuantity: 20, approximateQuantity: false, status: 'planned', minimumSbtBalance: 100, redemptionUrl: null }),
  Object.freeze({ id: 'waves-rsvp', plannedQuantity: 10, approximateQuantity: true, status: 'ended', minimumSbtBalance: null, redemptionUrl: null }),
]);
