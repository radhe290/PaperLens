const Paper = require("../models/Paper");
const Chat = require("../models/Chat");

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date) {
  const day = date.getDay();
  const start = startOfDay(date);
  start.setDate(start.getDate() - day);
  return start;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function formatTrendDate(date) {
  return date.toISOString().slice(0, 10);
}

function buildDailyTrend(rawTrend, startDate, days) {
  const uploadsByDate = new Map(
    rawTrend.map((trendItem) => [trendItem.date, trendItem.uploads])
  );

  return Array.from({ length: days }, (_, index) => {
    const date = formatTrendDate(addDays(startDate, index));
    return {
      date,
      uploads: uploadsByDate.get(date) || 0
    };
  });
}

async function getAnalytics(req, res) {
  const now = new Date();
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);
  const last30DaysStart = startOfDay(addDays(now, -29));

  const summaryGeneratedExpression = {
    $or: [
      { $gt: [{ $strLenCP: { $ifNull: ["$summary.shortSummary", ""] } }, 0] },
      { $gt: [{ $size: { $ifNull: ["$summary.keyContributions", []] } }, 0] },
      {
        $gt: [
          {
            $strLenCP: {
              $ifNull: ["$summary.beginnerFriendlyExplanation", ""]
            }
          },
          0
        ]
      }
    ]
  };

  const analysisGeneratedExpression = {
    $or: [
      { $gt: [{ $strLenCP: { $ifNull: ["$analysis.domain", ""] } }, 0] },
      { $gt: [{ $strLenCP: { $ifNull: ["$analysis.subdomain", ""] } }, 0] },
      { $gt: [{ $strLenCP: { $ifNull: ["$analysis.difficulty", ""] } }, 0] },
      { $gt: [{ $size: { $ifNull: ["$analysis.concepts", []] } }, 0] },
      { $gt: [{ $size: { $ifNull: ["$analysis.prerequisites", []] } }, 0] },
      { $gt: [{ $size: { $ifNull: ["$analysis.learningPath", []] } }, 0] }
    ]
  };

  const [analyticsResult, chatMetrics] = await Promise.all([
    Paper.aggregate([
    { $match: { userId: req.userId } },
    {
      $facet: {
        overview: [
          {
            $group: {
              _id: null,
              totalPapers: { $sum: 1 },
              totalSummaries: {
                $sum: { $cond: [summaryGeneratedExpression, 1, 0] }
              },
              totalAnalyses: {
                $sum: { $cond: [analysisGeneratedExpression, 1, 0] }
              },
              uploadsThisWeek: {
                $sum: { $cond: [{ $gte: ["$uploadDate", weekStart] }, 1, 0] }
              },
              uploadsThisMonth: {
                $sum: { $cond: [{ $gte: ["$uploadDate", monthStart] }, 1, 0] }
              },
              averagePaperLength: { $avg: "$wordCount" },
              latestUpload: { $max: "$uploadDate" },
              oldestUpload: { $min: "$uploadDate" }
            }
          },
          {
            $project: {
              _id: 0,
              totalPapers: 1,
              totalSummaries: 1,
              totalAnalyses: 1,
              uploadsThisWeek: 1,
              uploadsThisMonth: 1,
              averagePaperLength: {
                $round: [{ $ifNull: ["$averagePaperLength", 0] }, 0]
              },
              latestUpload: 1,
              oldestUpload: 1
            }
          }
        ],
        last30DaysTrend: [
          { $match: { uploadDate: { $gte: last30DaysStart } } },
          {
            $group: {
              _id: {
                $dateToString: {
                  date: "$uploadDate",
                  format: "%Y-%m-%d"
                }
              },
              uploads: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } },
          { $project: { _id: 0, date: "$_id", uploads: 1 } }
        ],
        weeklyUploadTrend: [
          {
            $group: {
              _id: {
                year: { $isoWeekYear: "$uploadDate" },
                week: { $isoWeek: "$uploadDate" }
              },
              uploads: { $sum: 1 }
            }
          },
          { $sort: { "_id.year": -1, "_id.week": -1 } },
          { $limit: 12 },
          { $sort: { "_id.year": 1, "_id.week": 1 } },
          {
            $project: {
              _id: 0,
              label: {
                $concat: [
                  { $toString: "$_id.year" },
                  "-W",
                  { $toString: "$_id.week" }
                ]
              },
              uploads: 1
            }
          }
        ],
        recentUploads: [
          { $sort: { uploadDate: -1, _id: -1 } },
          { $limit: 5 },
          {
            $project: {
              _id: 1,
              title: 1,
              originalFilename: 1,
              uploadDate: 1,
              hasSummary: summaryGeneratedExpression,
              hasAnalysis: analysisGeneratedExpression
            }
          }
        ]
      }
    }
    ]),
    Chat.aggregate([
      { $match: { userId: req.userId } },
      {
        $facet: {
          overview: [
            {
              $project: {
                paperId: 1,
                questionCount: {
                  $size: {
                    $filter: {
                      input: "$messages",
                      as: "message",
                      cond: { $eq: ["$$message.role", "user"] }
                    }
                  }
                }
              }
            },
            {
              $group: {
                _id: null,
                totalChats: { $sum: 1 },
                totalQuestionsAsked: { $sum: "$questionCount" }
              }
            },
            { $project: { _id: 0, totalChats: 1, totalQuestionsAsked: 1 } }
          ],
          mostActivePapers: [
            {
              $project: {
                paperId: 1,
                questionCount: {
                  $size: {
                    $filter: {
                      input: "$messages",
                      as: "message",
                      cond: { $eq: ["$$message.role", "user"] }
                    }
                  }
                },
                updatedAt: 1
              }
            },
            { $match: { questionCount: { $gt: 0 } } },
            { $sort: { questionCount: -1, updatedAt: -1 } },
            { $limit: 5 },
            {
              $lookup: {
                from: "papers",
                localField: "paperId",
                foreignField: "_id",
                as: "paper"
              }
            },
            { $unwind: "$paper" },
            {
              $project: {
                _id: 0,
                paperId: 1,
                title: "$paper.title",
                questionCount: 1,
                updatedAt: 1
              }
            }
          ]
        }
      }
    ])
  ]);

  const analytics = analyticsResult?.[0];
  const chatAnalytics = chatMetrics?.[0];
  const chatOverview = chatAnalytics?.overview?.[0] || {
    totalChats: 0,
    totalQuestionsAsked: 0
  };

  const overview = analytics?.overview?.[0] || {
    totalPapers: 0,
    totalSummaries: 0,
    totalAnalyses: 0,
    uploadsThisWeek: 0,
    uploadsThisMonth: 0,
    averagePaperLength: 0,
    latestUpload: null,
    oldestUpload: null
  };

  const oldestUpload = overview.oldestUpload ? new Date(overview.oldestUpload) : null;
  const latestUpload = overview.latestUpload ? new Date(overview.latestUpload) : null;
  const activeWeeks =
    oldestUpload && latestUpload
      ? Math.max(
          1,
          Math.ceil((latestUpload - oldestUpload + 1) / (7 * 24 * 60 * 60 * 1000))
        )
      : 1;
  const last30DaysTrend = buildDailyTrend(
    analytics?.last30DaysTrend || [],
    last30DaysStart,
    30
  );
  const last7DaysTrend = last30DaysTrend.slice(-7);
  const papersPendingAnalysis = Math.max(
    overview.totalPapers - overview.totalAnalyses,
    0
  );
  const recentUploads = (analytics?.recentUploads || []).map((paper) => ({
    ...paper,
    status: {
      summaryGenerated: paper.hasSummary,
      analysisGenerated: paper.hasAnalysis
    }
  }));

  return res.status(200).json({
    totalPapers: overview.totalPapers,
    totalSummaries: overview.totalSummaries,
    totalAnalyses: overview.totalAnalyses,
    totalChats: chatOverview.totalChats,
    totalQuestionsAsked: chatOverview.totalQuestionsAsked,
    mostActivePapers: chatAnalytics?.mostActivePapers || [],
    uploadsThisWeek: overview.uploadsThisWeek,
    uploadsThisMonth: overview.uploadsThisMonth,
    latestUpload: overview.latestUpload,
    mostRecentUpload: overview.latestUpload,
    oldestUpload: overview.oldestUpload,
    averagePaperLength: overview.averagePaperLength,
    averageUploadsPerWeek:
      overview.totalPapers > 0
        ? Number((overview.totalPapers / activeWeeks).toFixed(1))
        : 0,
    summaryAnalysisMetrics: {
      papersWithSummaries: overview.totalSummaries,
      papersWithAnalyses: overview.totalAnalyses,
      papersPendingAnalysis,
      summaryPercentage:
        overview.totalPapers > 0
          ? Number(((overview.totalSummaries / overview.totalPapers) * 100).toFixed(1))
          : 0,
      analysisPercentage:
        overview.totalPapers > 0
          ? Number(((overview.totalAnalyses / overview.totalPapers) * 100).toFixed(1))
          : 0,
      pendingAnalysisPercentage:
        overview.totalPapers > 0
          ? Number(((papersPendingAnalysis / overview.totalPapers) * 100).toFixed(1))
          : 0
    },
    recentUploads,
    uploadTrends: {
      last7Days: last7DaysTrend,
      last30Days: last30DaysTrend,
      daily: last30DaysTrend,
      weekly: analytics?.weeklyUploadTrend || []
    }
  });
}

module.exports = {
  getAnalytics
};
