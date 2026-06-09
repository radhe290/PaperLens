/**
 * CRITICAL FIXES FOR PAPER CONTROLLER
 * 
 * This file contains enhanced debugging logging for:
 * 1. Generate Summary endpoint
 * 2. Generate Analysis endpoint
 * 3. Better error classification
 * 4. Request deduplication (prevent duplicate API calls)
 * 5. Caching (don't regenerate if already exists)
 */

// ADD THIS TO TOP OF FILE:
const requestDeduplication = new Map();

async function generateSummary(req, res) {
  const requestId = Math.random().toString(36).substring(7);
  const startTime = Date.now();
  const paperId = req.params.id;
  const userId = req.userId;

  console.log(`[SUMMARY-${requestId}] ========== REQUEST START ==========`);
  console.log(`[SUMMARY-${requestId}] timestamp: ${new Date().toISOString()}`);
  console.log(`[SUMMARY-${requestId}] paperId: ${paperId}`);
  console.log(`[SUMMARY-${requestId}] userId: ${userId}`);
  console.log(`[SUMMARY-${requestId}] route: ${req.originalUrl}`);

  // REQUEST DEDUPLICATION
  const dedupeKey = `summary:${paperId}:${userId}`;
  if (requestDeduplication.has(dedupeKey)) {
    console.log(`[SUMMARY-${requestId}] Duplicate request detected, waiting for existing request...`);
    try {
      const result = await requestDeduplication.get(dedupeKey);
      const duration = Date.now() - startTime;
      console.log(`[SUMMARY-${requestId}] ✓ Got result from duplicate request handler (${duration}ms)`);
      return res.status(200).json(result);
    } catch (error) {
      console.error(`[SUMMARY-${requestId}] Duplicate request failed:`, error.message);
      throw error;
    }
  }

  // MARK REQUEST AS IN-PROGRESS
  const requestPromise = (async () => {
    try {
      // === VALIDATION ===
      try {
        validatePaperId(paperId);
        console.log(`[SUMMARY-${requestId}] ✓ Paper ID format valid`);
      } catch (validationError) {
        console.error(`[SUMMARY-${requestId}] ✗ Invalid paper ID format:`, validationError.message);
        throw validationError;
      }

      // === DATABASE QUERY ===
      console.log(`[SUMMARY-${requestId}] Querying database for paper...`);
      const paper = await Paper.findOne({
        _id: paperId,
        userId
      });

      if (!paper) {
        console.error(`[SUMMARY-${requestId}] ✗ Paper not found in database`);

        // DEBUG: Check if paper exists with different user
        const paperExists = await Paper.findById(paperId).select("userId title");
        if (paperExists) {
          console.error(`[SUMMARY-${requestId}] DEBUG: Paper exists but OWNED BY DIFFERENT USER`, {
            paperId,
            ownerUserId: paperExists.userId.toString(),
            requestedBy: userId.toString(),
            ownerMatch: paperExists.userId.toString() === userId.toString()
          });
        } else {
          console.error(`[SUMMARY-${requestId}] DEBUG: Paper does not exist in database at all`);
        }

        throw createHttpError(404, "Paper not found.");
      }

      console.log(`[SUMMARY-${requestId}] ✓ Paper found:`, {
        title: paper.title,
        textLength: paper.extractedText?.length || 0,
        alreadyHasSummary: !!paper.summary?.shortSummary
      });

      // CHECK FOR CACHED SUMMARY
      if (paper.summary && paper.summary.shortSummary) {
        console.log(`[SUMMARY-${requestId}] ✓ Summary already exists, returning cached version`);
        const result = {
          message: "Summary retrieved from cache",
          paper,
          fromCache: true
        };
        return result;
      }

      // === GENERATE SUMMARY ===
      console.log(`[SUMMARY-${requestId}] Starting AI summary generation...`);
      const summary = await generatePaperSummary(paper.extractedText);
      console.log(`[SUMMARY-${requestId}] ✓ Summary generated successfully`);

      // === UPDATE DATABASE ===
      console.log(`[SUMMARY-${requestId}] Updating paper in database...`);
      const updated = await Paper.findOneAndUpdate(
        { _id: paper._id, userId },
        { 
          summary,
          summaryGeneratedAt: new Date()
        },
        { new: true, runValidators: true }
      );
      console.log(`[SUMMARY-${requestId}] ✓ Paper updated in database`);

      // === RECORD ACTIVITY ===
      try {
        await recordActivity({
          userId,
          type: "summary_generated",
          title: paper.title,
          metadata: { paperId: paper._id }
        });
        console.log(`[SUMMARY-${requestId}] ✓ Activity logged`);
      } catch (activityError) {
        console.warn(`[SUMMARY-${requestId}] Warning: Failed to log activity`, activityError.message);
        // Don't fail the entire request if activity logging fails
      }

      const result = {
        message: "Summary generated successfully",
        paper: updated
      };

      return result;

    } catch (error) {
      console.error(`[SUMMARY-${requestId}] Error in request processing:`, {
        errorType: error?.constructor?.name,
        errorMessage: error?.message,
        errorStatusCode: error?.statusCode,
        stack: error?.stack
      });
      throw error;
    }
  })();

  // STORE IN DEDUPLICATION MAP
  requestDeduplication.set(dedupeKey, requestPromise);

  try {
    const result = await requestPromise;
    const duration = Date.now() - startTime;
    console.log(`[SUMMARY-${requestId}] ========== REQUEST SUCCESS ==========`);
    console.log(`[SUMMARY-${requestId}] duration: ${duration}ms`);
    return res.status(200).json(result);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[SUMMARY-${requestId}] ========== REQUEST FAILED ==========`);
    console.error(`[SUMMARY-${requestId}] duration: ${duration}ms`);
    console.error(`[SUMMARY-${requestId}] error: ${error?.message}`);
    return res.status(error?.statusCode || 502).json({ error: error?.message || "Failed to generate summary." });
  } finally {
    // CLEANUP DEDUPLICATION MAP
    setTimeout(() => {
      requestDeduplication.delete(dedupeKey);
    }, 1000); // Keep in map for 1 second to catch duplicates
  }
}

async function generateAnalysis(req, res) {
  const requestId = Math.random().toString(36).substring(7);
  const startTime = Date.now();
  const paperId = req.params.id;
  const userId = req.userId;

  console.log(`[ANALYSIS-${requestId}] ========== REQUEST START ==========`);
  console.log(`[ANALYSIS-${requestId}] timestamp: ${new Date().toISOString()}`);
  console.log(`[ANALYSIS-${requestId}] paperId: ${paperId}`);
  console.log(`[ANALYSIS-${requestId}] userId: ${userId}`);

  // REQUEST DEDUPLICATION
  const dedupeKey = `analysis:${paperId}:${userId}`;
  if (requestDeduplication.has(dedupeKey)) {
    console.log(`[ANALYSIS-${requestId}] Duplicate request detected, waiting...`);
    try {
      const result = await requestDeduplication.get(dedupeKey);
      const duration = Date.now() - startTime;
      console.log(`[ANALYSIS-${requestId}] ✓ Got result from duplicate (${duration}ms)`);
      return res.status(200).json(result);
    } catch (error) {
      throw error;
    }
  }

  const requestPromise = (async () => {
    try {
      // === VALIDATION ===
      try {
        validatePaperId(paperId);
        console.log(`[ANALYSIS-${requestId}] ✓ Paper ID format valid`);
      } catch (validationError) {
        console.error(`[ANALYSIS-${requestId}] ✗ Invalid paper ID:`, validationError.message);
        throw validationError;
      }

      // === DATABASE QUERY ===
      console.log(`[ANALYSIS-${requestId}] Querying database...`);
      const paper = await Paper.findOne({
        _id: paperId,
        userId
      });

      if (!paper) {
        console.error(`[ANALYSIS-${requestId}] ✗ Paper not found`);

        // DEBUG INFO
        const paperExists = await Paper.findById(paperId).select("userId title");
        if (paperExists) {
          console.error(`[ANALYSIS-${requestId}] DEBUG: Paper exists but different owner:`, {
            ownerUserId: paperExists.userId.toString(),
            requestedBy: userId.toString()
          });
        }

        throw createHttpError(404, "Paper not found.");
      }

      console.log(`[ANALYSIS-${requestId}] ✓ Paper found: ${paper.title}`);

      // CHECK FOR CACHED ANALYSIS
      if (paper.analysis && paper.analysis.domain) {
        console.log(`[ANALYSIS-${requestId}] ✓ Analysis already exists, returning cached version`);
        const result = {
          message: "Analysis retrieved from cache",
          ...paper.analysis
        };
        return result;
      }

      // === GENERATE ANALYSIS ===
      console.log(`[ANALYSIS-${requestId}] Starting AI analysis generation...`);
      const analysis = await analyzePaper(paper.extractedText);
      console.log(`[ANALYSIS-${requestId}] ✓ Analysis generated successfully`);

      // === UPDATE DATABASE ===
      console.log(`[ANALYSIS-${requestId}] Updating paper...`);
      const updated = await Paper.findOneAndUpdate(
        { _id: paper._id, userId },
        { 
          analysis,
          analysisGeneratedAt: new Date()
        },
        { new: true, runValidators: true }
      );
      console.log(`[ANALYSIS-${requestId}] ✓ Paper updated`);

      // === RECORD ACTIVITY ===
      try {
        await recordActivity({
          userId,
          type: "analysis_generated",
          title: paper.title,
          metadata: { paperId: paper._id }
        });
        console.log(`[ANALYSIS-${requestId}] ✓ Activity logged`);
      } catch (activityError) {
        console.warn(`[ANALYSIS-${requestId}] Warning: Activity logging failed`, activityError.message);
      }

      const result = {
        message: "Analysis generated successfully",
        ...analysis
      };

      return result;

    } catch (error) {
      console.error(`[ANALYSIS-${requestId}] Error:`, {
        type: error?.constructor?.name,
        message: error?.message,
        statusCode: error?.statusCode
      });
      throw error;
    }
  })();

  requestDeduplication.set(dedupeKey, requestPromise);

  try {
    const result = await requestPromise;
    const duration = Date.now() - startTime;
    console.log(`[ANALYSIS-${requestId}] ========== REQUEST SUCCESS ========== (${duration}ms)`);
    return res.status(200).json(result);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[ANALYSIS-${requestId}] ========== REQUEST FAILED ========== (${duration}ms)`);
    const message = error?.statusCode === 503 
      ? "AI service is currently busy. Please try again in a few seconds." 
      : (error?.message || "Failed to generate analysis. Please try again.");
    return res.status(error?.statusCode || 502).json({ error: message });
  } finally {
    setTimeout(() => {
      requestDeduplication.delete(dedupeKey);
    }, 1000);
  }
}

// EXPORT THESE ENHANCED FUNCTIONS
module.exports = {
  // ... other exports ...
  generateSummary,
  generateAnalysis
};
