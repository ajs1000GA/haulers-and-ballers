import { parseNumber, parsePercent } from './formatters'

const SCORE_WEIGHTS = {
  resiAjs: 0.45,
  residentialRevenue: 0.3,
  reviewsPct: 0.15,
  lowIssueRate: 0.1,
}

function normalize(value, min, max) {
  if (max === min) {
    return max === 0 ? 0 : 100
  }

  return ((value - min) / (max - min)) * 100
}

function metricExtent(items, accessor) {
  const values = items.map(accessor).filter(Number.isFinite)
  return {
    min: Math.min(...values, 0),
    max: Math.max(...values, 0),
  }
}

function clampScore(value) {
  return Math.max(0, Math.min(100, value))
}

export function scoreTeammates(teammates) {
  const normalizedInput = teammates
    .filter((teammate) => teammate.name)
    .map((teammate, index) => ({
      ...teammate,
      id: teammate.id || `${teammate.name}-${index}`,
      resiAjs: parseNumber(teammate.resiAjs),
      residentialRevenue: parseNumber(teammate.residentialRevenue),
      reviewsPct: parsePercent(teammate.reviewsPct),
      cancelsPct: parsePercent(teammate.cancelsPct),
      complaintsPct: parsePercent(teammate.complaintsPct),
    }))

  const resiAjsExtent = metricExtent(normalizedInput, (item) => item.resiAjs)
  const residentialRevenueExtent = metricExtent(normalizedInput, (item) => item.residentialRevenue)
  const reviewsExtent = metricExtent(normalizedInput, (item) => item.reviewsPct)
  const issueExtent = metricExtent(
    normalizedInput,
    (item) => (item.cancelsPct + item.complaintsPct) / 2,
  )

  const scored = normalizedInput
    .map((teammate) => {
      const issueRate = (teammate.cancelsPct + teammate.complaintsPct) / 2
      const issuePenalty = normalize(issueRate, issueExtent.min, issueExtent.max)
      const lowIssueRate = 100 - issuePenalty
      const score = clampScore(
        normalize(teammate.resiAjs, resiAjsExtent.min, resiAjsExtent.max) * SCORE_WEIGHTS.resiAjs +
          normalize(
            teammate.residentialRevenue,
            residentialRevenueExtent.min,
            residentialRevenueExtent.max,
          ) *
            SCORE_WEIGHTS.residentialRevenue +
          normalize(teammate.reviewsPct, reviewsExtent.min, reviewsExtent.max) *
            SCORE_WEIGHTS.reviewsPct +
          lowIssueRate * SCORE_WEIGHTS.lowIssueRate,
      )

      return {
        ...teammate,
        score: Number(score.toFixed(1)),
        normalized: {
          resiAjs: normalize(teammate.resiAjs, resiAjsExtent.min, resiAjsExtent.max),
          residentialRevenue: normalize(
            teammate.residentialRevenue,
            residentialRevenueExtent.min,
            residentialRevenueExtent.max,
          ),
          reviewsPct: normalize(teammate.reviewsPct, reviewsExtent.min, reviewsExtent.max),
          lowIssueRate,
        },
      }
    })
    .sort((a, b) => b.score - a.score || b.resiAjs - a.resiAjs)

  return scored.map((teammate, index) => ({
    ...teammate,
    rank: index + 1,
    tier: getTier(index, scored.length),
    title: index === 0 ? 'Top Hauler' : getRankTitle(index),
    medal: getMedal(index),
  }))
}

export function getTier(index, total) {
  if (total <= 1) {
    return 'green'
  }

  const percentile = (index + 1) / total
  if (percentile <= 0.25) {
    return 'green'
  }
  if (percentile > 0.75) {
    return 'red'
  }
  return 'yellow'
}

export function getTierLabel(tier) {
  if (tier === 'green') {
    return 'Top 25%'
  }
  if (tier === 'red') {
    return 'Bottom 25%'
  }
  return 'Middle 50%'
}

export function getMedal(index) {
  return ['🥇', '🥈', '🥉'][index] || ''
}

function getRankTitle(index) {
  if (index <= 2) {
    return 'Podium Hauler'
  }
  if (index <= 9) {
    return 'Impact Player'
  }
  return 'In the Hunt'
}

export function getAchievements(teammate) {
  const badges = []

  if (teammate.rank === 1) {
    badges.push('Top Hauler')
  }
  if (teammate.resiAjs >= 1000) {
    badges.push('$1K Resi AJS Club')
  }
  if (teammate.reviewsPct >= 95) {
    badges.push('Review Machine')
  }
  if (teammate.residentialRevenue >= 100000) {
    badges.push('Six-Figure Resi')
  }
  if ((teammate.cancelsPct || 0) + (teammate.complaintsPct || 0) <= 3) {
    badges.push('Clean Sheet')
  }

  return badges.length ? badges : ['Grinding Upward']
}

export function buildTrend(teammate) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
  const base = Math.max(teammate.resiAjs || 0, 500)
  const seed = teammate.name
    .split('')
    .reduce((sum, letter) => sum + letter.charCodeAt(0), teammate.rank || 1)

  return months.map((month, index) => {
    const swing = ((seed + index * 17) % 11) - 5
    const growth = 1 + (index - months.length + 1) * 0.018
    return {
      month,
      resiAjs: Math.max(0, Math.round(base * growth + swing * 12)),
      score: Math.max(0, Math.min(100, Math.round((teammate.score || 0) + swing * 0.9 + index))),
    }
  })
}
