/**
 * Secondary validation prompt preamble — instructs the validator model
 * to provide an independent second opinion.
 */

export const SECONDARY_ANALYSIS_PREAMBLE = `IMPORTANT: You are providing an INDEPENDENT SECOND OPINION on this compliance analysis.
Do NOT assume any previous analysis is correct. Analyse the building plan and NCC requirements completely from scratch.
Be thorough and identify any issues that might have been missed. If something appears compliant, confirm it with specific NCC clause references.
Focus especially on safety-critical items where an error could have serious consequences.`;
