const { Activity } = require('../models/crm');

/**
 * Calculate lead score based on various factors
 * Score range: 0-100
 */
exports.calculateScore = async (lead) => {
  let score = 0;

  // 1. Lead Status (0-30 points)
  const statusScores = {
    new: 10,
    contacted: 15,
    qualified: 20,
    proposal: 25,
    negotiation: 30,
    won: 30,
    lost: 0,
  };
  score += statusScores[lead.status] || 0;

  // 2. Lead Value (0-25 points)
  if (lead.value) {
    if (lead.value >= 100000) score += 25;
    else if (lead.value >= 50000) score += 20;
    else if (lead.value >= 25000) score += 15;
    else if (lead.value >= 10000) score += 10;
    else if (lead.value >= 5000) score += 5;
  }

  // 3. Profile Completeness (0-15 points)
  let completeness = 0;
  if (lead.name) completeness += 3;
  if (lead.email) completeness += 3;
  if (lead.phone) completeness += 3;
  if (lead.company) completeness += 3;
  if (lead.notes) completeness += 3;
  score += completeness;

  // 4. Lead Source (0-10 points)
  const sourceScores = {
    Referral: 10,
    Website: 8,
    LinkedIn: 7,
    'Google Ads': 6,
    Facebook: 5,
    'Cold Call': 3,
    Email: 4,
  };
  score += sourceScores[lead.source] || 0;

  // 5. Engagement/Activity (0-20 points)
  try {
    const activities = await Activity.find({ leadId: lead._id });
    const activityCount = activities.length;

    if (activityCount >= 10) score += 20;
    else if (activityCount >= 7) score += 15;
    else if (activityCount >= 5) score += 10;
    else if (activityCount >= 3) score += 5;
    else if (activityCount >= 1) score += 2;

    // Bonus for recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentActivities = activities.filter(
      (a) => new Date(a.createdAt) >= sevenDaysAgo
    );
    if (recentActivities.length > 0) {
      score += Math.min(recentActivities.length * 2, 10);
    }
  } catch (error) {
    console.error('Error calculating activity score:', error);
  }

  // Ensure score is between 0 and 100
  return Math.min(Math.max(Math.round(score), 0), 100);
};

/**
 * Get score category
 */
exports.getScoreCategory = (score) => {
  if (score >= 80) return 'hot';
  if (score >= 60) return 'warm';
  if (score >= 40) return 'cold';
  return 'ice-cold';
};

/**
 * Get score recommendations
 */
exports.getRecommendations = (lead, score) => {
  const recommendations = [];

  if (score < 40) {
    recommendations.push('Consider nurturing this lead with email campaigns');
  }

  if (!lead.phone) {
    recommendations.push('Add phone number to improve contact options');
  }

  if (!lead.company) {
    recommendations.push('Add company information for better context');
  }

  if (lead.status === 'new') {
    recommendations.push('Reach out to this lead as soon as possible');
  }

  if (score >= 70 && lead.status !== 'won') {
    recommendations.push('This is a hot lead - prioritize follow-up');
  }

  return recommendations;
};
