exports.calculateLeadScore = (lead) => {
  let score = 0;
  if (lead.email) score += 20;
  if (lead.phone) score += 20;
  if (lead.company) score += 15;
  if (Number(lead.value || 0) > 0) score += 25;
  if (lead.status === 'qualified') score += 20;
  return Math.min(score, 100);
};
